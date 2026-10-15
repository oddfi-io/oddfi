# Solidity 项目 DDD 映射规则

本文档定义领域驱动设计（DDD）在本 Solidity 智能合约项目中的具体落地方式。

## 核心概念映射

| DDD 概念 | Solidity 映射 | 说明 |
|----------|--------------|------|
| **限界上下文 (Bounded Context)** | 合约组 / 独立部署单元 | 每个限界上下文对应一组功能内聚的合约，通过接口（interface）与其他上下文交互 |
| **聚合根 (Aggregate Root)** | 主合约（入口合约） | 每个限界上下文有且仅有一个主合约作为外部调用入口，内部子合约不直接暴露给外部 |
| **实体 (Entity)** | 带唯一标识的 struct + 对应 mapping | 通过 `mapping(uint256 => Entity)` 或 `mapping(address => Entity)` 持有，具有生命周期 |
| **值对象 (Value Object)** | 不可变 struct / 常量 | 无唯一标识，仅通过属性值区分，创建后不可修改 |
| **领域事件 (Domain Event)** | Solidity event | 所有状态变更必须触发对应 event，用于链下索引和跨上下文通知 |
| **领域服务 (Domain Service)** | 内部 library | 不持有状态的纯计算逻辑封装为 library，供多个合约复用 |
| **仓储 (Repository)** | 合约内部 storage 封装 | 对 mapping / array 的 CRUD 操作封装为 internal 函数，集中管理存储布局 |
| **工厂 (Factory)** | Factory 合约 / 工厂函数 | 负责创建和初始化新合约实例（如 Clone / Proxy 模式） |
| **防腐层 (Anti-Corruption Layer)** | Adapter 合约 / Interface 封装 | 调用外部协议（如 Uniswap、Chainlink）时，必须通过 adapter 合约隔离，禁止在业务合约中直接引用外部合约地址 |

## 目录结构约定

```text
contracts/
├── core/                    # 核心域：项目最核心的业务逻辑
│   ├── interfaces/          # 核心域对外暴露的接口
│   ├── libraries/           # 核心域的领域服务（library）
│   └── ...                  # 核心域合约（聚合根 + 实体）
├── periphery/               # 外围域：辅助功能、集成适配
│   ├── adapters/            # 防腐层：外部协议适配器
│   └── ...
├── shared/                  # 共享内核：跨域复用的类型定义、常量、工具 library
│   ├── types/               # 共享 struct / enum 定义
│   ├── errors/              # 共享自定义 error 定义
│   └── constants/           # 共享常量
└── test/                    # 测试目录，结构镜像 contracts/
```

## 设计规则

### 1. 限界上下文边界

- 不同限界上下文之间**只能通过 interface 交互**，禁止直接 import 其他上下文的具体实现合约
- 每个限界上下文独立部署，通过构造函数或 setter 注入依赖地址
- 跨上下文调用失败时，调用方必须有明确的错误处理逻辑

### 2. 聚合根规则

- 外部用户（EOA / 其他合约）只能调用聚合根合约的 external 函数
- 聚合内部的子合约 / library 不暴露 external 函数给外部
- 聚合根负责维护聚合内部的一致性（不变量校验）

### 3. 领域事件

- 每个改变状态的 external / public 函数必须 emit 至少一个 event
- event 命名遵循 `动词过去式 + 名词` 格式，如 `TokenTransferred`、`OrderCreated`
- event 参数应包含足够信息供链下还原完整状态变更

### 4. 共享内核

- `shared/` 目录中的代码不得包含业务逻辑，仅限类型定义、常量、通用工具
- 修改 `shared/` 中的类型定义视为架构变更，必须先更新架构文档

### 5. 可升级性

- 若合约需要可升级，必须在架构文档中明确说明升级策略（Transparent Proxy / UUPS / Diamond 等）
- 可升级合约的 storage layout 必须在架构文档中记录，任何 storage 变更需经过评审
- 初始化函数必须使用 `initializer` 修饰符，禁止使用 constructor

## 命名约定

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 合约 | PascalCase，名词 | `OrderBook`, `TokenVault` |
| Interface | `I` 前缀 + PascalCase | `IOrderBook`, `ITokenVault` |
| Library | PascalCase + `Lib` 后缀 | `MathLib`, `ValidationLib` |
| Event | PascalCase，动词过去式 | `OrderCreated`, `FundsWithdrawn` |
| Custom Error | PascalCase，描述性 | `InsufficientBalance`, `Unauthorized` |
| Modifier | camelCase，形容词/条件 | `onlyOwner`, `whenNotPaused` |
| 函数 | camelCase，动词开头 | `createOrder`, `withdrawFunds` |
| 常量 | UPPER_SNAKE_CASE | `MAX_SUPPLY`, `FEE_DENOMINATOR` |
