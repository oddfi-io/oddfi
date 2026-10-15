# SDK 架构与 DDD 分层

> 本文件是 ODD-SDK 架构层面的**强约束**与设计依据。`AGENTS.md` 引用本文件作为架构红线的唯一来源；本文件内容与 `AGENTS.md` 中"不可豁免清单"具有同等效力。

## 1. 设计目标

ODD-SDK 是 oddfi 协议合约的 **公开 Golang SDK**，第三方将直接 `go get` 依赖。架构必须同时满足：

- **领域语义稳定**：协议演进 / 链客户端替换 / ABI 重新生成不应引起公开 API 形状变化。
- **Go Ethereum 生态友好**：公开 API 可以直接使用 `go-ethereum` 的常用稳定类型，减少调用方适配成本；SDK 只隐藏 RPC client 生命周期、内部基础设施实现和生成 binding 细节。
- **可替换实现**：链客户端、日志、指标、tracer、时间源、随机源等可变依赖全部可注入。
- **零隐式状态**：禁止全局可变状态与 `init()` 副作用，使用方完全控制生命周期。
- **可独立测试**：领域层无 I/O，可纯单元测试；基础设施层用 anvil / 桩件做集成测试。

## 2. 分层与目录

依赖方向单向：**pkg（公开门面）→ application（用例）→ domain（合约业务）**，`infrastructure` 负责适配 RPC / abigen 绑定并服务于公开门面或应用用例。

```
/pkg                          公开 API（外部使用者唯一入口，stable surface）
/internal
  /domain                     合约业务域：一组合约业务一个子包，按 ABI / 合约能力划分
    /oddtoken                 ODDToken 业务：ERC-20 状态、授权、暂停状态、转账语义
    /stakingpool              StakingPool 业务：质押仓位、VIP 等级、奖励、提前解押
    /liquiditypool            LiquidityPool 业务：全局 / 单赛事流动性、仓位、解锁、epoch
    /bettingpool              BettingPool 业务：市场、下注、赔率、派彩、退款、推荐奖励
  /application                用例编排：跨合约业务流程、读模型查询、交易流程组合
  /infrastructure             基础设施：链客户端、ABI 绑定、缓存、重试、日志适配
    /bindings                 abigen 生成的 Go 绑定（一合约一子包），禁止外露
    /chain                    ethclient 包装、RPC 重试 / 退避 / nonce 管理
    /telemetry                Logger / Metrics / Tracer 适配器
/contracts
  /abi                        原始 ABI artifact（合约编译产物），生成绑定的输入
/examples                     可独立运行的最小示例
/test                         端到端 / 集成 / fuzz 测试
```

### 2.1 各层职责

| 层 | 职责 | 允许 import | 禁止 import |
| --- | --- | --- | --- |
| `domain` | 合约业务实体、业务枚举、业务错误；每个子包对应一个合约业务域或强相关业务域 | 标准库、必要的 `go-ethereum` 常用类型（如 `common.Address`、`common.Hash`、`*big.Int`） | `internal/infrastructure`、`internal/application`、ABI 生成 binding、具体 RPC / 文件 / DB 库 |
| `application` | 跨合约用例编排，按事务边界组合合约业务对象 | `domain`、标准库、必要的 `go-ethereum` 基础类型 | 基础设施实现细节、ABI 生成 binding、具体 RPC client |
| `infrastructure` | 包装 `ethclient`、abigen 绑定、日志器、指标；把技术调用适配为业务门面需要的能力 | `domain`、`application`、`go-ethereum/*`、第三方库 | 反向 import `pkg`；不得把内部具体实现要求泄漏为调用方生命周期负担 |
| `pkg`（interface） | 唯一对外门面：组合 `application` 用例与 `infrastructure` 默认实现，给外部稳定 API | `go-ethereum` 常用类型、`domain` 业务类型、`application`、`infrastructure` 构造函数 | 直接暴露 `*ethclient.Client`、直接暴露 `internal/*` 私有结构体、直接暴露 ABI 生成 binding 类型 |

### 2.2 依赖方向校验

- 必须在 CI 配置 import 检查（`go-arch-lint` / `depguard` / 自写脚本）：
  - `internal/domain` 不得 import `internal/infrastructure`、`internal/application`、ABI 生成 binding、具体 RPC / 文件 / DB 库。
  - `internal/application` 不得 import `internal/infrastructure` 或 ABI 生成 binding。
  - `pkg/...` 不得 import `internal/infrastructure/bindings`。
- 校验失败即阻断 CI，不得通过 `nolint` 等方式绕过。

### 2.3 Domain 业务域划分

`internal/domain` 不再承担“通用 EVM 组件库”的职责，不创建 `Address`、`Amount`、`TxHash`、`UnsignedTx`、`SignedTx` 等仅为包裹 go-ethereum 类型的组件。Domain 只保存 oddfi 协议自己的业务概念。

当前四个 ABI / binding 对应四个首要业务域：

| Domain 包 | 对应 ABI / binding | 职责 |
| --- | --- | --- |
| `internal/domain/oddtoken` | `ODDToken.abi.json` / `bindings/oddtoken` | ODD 代币业务语义：名称、符号、精度、总供给、余额、授权、暂停状态、转账 / 授权操作的业务错误 |
| `internal/domain/stakingpool` | `StakingPool.abi.json` / `bindings/stakingpool` | 质押业务语义：仓位、plan、VIP 等级、日限额、奖励、提前 / 到期解押状态 |
| `internal/domain/liquiditypool` | `LiquidityPool.abi.json` / `bindings/liquiditypool` | 流动性业务语义：全局池、赛事池、LP 仓位、解锁请求、epoch、亏损 / margin 分配 |
| `internal/domain/bettingpool` | `BettingPool.abi.json` / `bindings/bettingpool` | 博彩业务语义：market、bet、odds、quote guard、settlement、claim、refund、referral |

Domain 包允许直接使用 `common.Address`、`common.Hash`、`*big.Int` 等 go-ethereum 基础类型，因为这些是调用方和链上交互的通用语言。只有当某个字段有明确 oddfi 业务含义时才定义 SDK 自有类型，例如 `MarketID`、`BetID`、`VIPTier`、`StakePosition`、`LiquidityPosition`。

## 3. 公开 API 设计规则

### 3.1 类型边界

- `/pkg` 可以暴露 `go-ethereum` 常用公开类型，包括 `common.Address`、`common.Hash`、`*big.Int`、`*types.Transaction`、`bind.TransactOpts`、`bind.CallOpts` 等，以便调用方直接复用现有以太坊工具链。
- `/pkg` 不得暴露 `*ethclient.Client`，也不得要求调用方持有或管理 SDK 内部 RPC client。
- `/pkg` 不得直接暴露 ABI 生成代码中的 binding 类型；每个合约通过 SDK 的业务门面暴露，例如 `ODDToken`、`StakingPool`、`LiquidityPool`、`BettingPool`。
- SDK 自有类型只在表达真实业务语义时引入，例如 `Market`、`Bet`、`LiquidityPosition`、`StakePosition`、`VIPTier`、`Reward`。不得为了包裹 `common.Address` / `*big.Int` / `common.Hash` / `*types.Transaction` 等通用链上类型而创建无业务增益的重复类型。

### 3.2 公开 API 形状

- **构造函数返回接口或不可导出结构体的指针**，不得返回带可变公开字段的结构体。
- **Option 模式注入依赖**：`func NewClient(cfg Config, opts ...Option) (*Client, error)`，`Option` 用于覆盖 logger / metrics / tracer / clock / retry policy 等 SDK 持有的可变依赖。
- **接口最小化**：每个公开接口只声明使用者真正需要调用的方法；不得用一个 "God interface" 把所有能力堆在一起。
- **godoc 第一句以符号名开头**，描述行为而非实现；并发安全性、是否阻塞、错误条件必须显式说明。
- **每个公开类型 / 关键函数必须配 `ExampleXxx`**，CI 跑 `go test ./...` 必须通过。

### 3.3 错误暴露

- 公开包必须导出可被 `errors.Is` 判别的哨兵错误（如 `ErrChainIDMismatch`、`ErrInsufficientLiquidity`、`ErrTxRevert`）。
- `ErrTxRevert` 必须为可被 `errors.As` 解析的结构化类型，至少包含：原始 `data []byte`、解码后的领域错误（若可解码）、tx hash。
- 错误层次：`UserError`（输入非法）/ `RevertError`（链上业务拒绝）/ `InfraError`（网络 / RPC）/ `ConfigError`（配置错）；使用者据此选择重试策略。

## 4. 链上交互流水线

涉及 SDK 自行组织交易的高阶业务流程时，建议按 `Build → Simulate → Sign → Send & Wait` 拆分；直接映射合约写方法时，可以接受调用方提供的 `*bind.TransactOpts` 并直接返回 `*types.Transaction`。

```go
tx, err := client.ODDToken().Transfer(opts, to, amount)    // 直接合约写方法
```

- 简单合约写方法：优先暴露 `Transfer(opts *bind.TransactOpts, ...) (*types.Transaction, error)` 这类 go-ethereum 兼容 API。
- 高阶业务流程：当 SDK 需要组合多个合约、预检查业务状态、解析业务错误或等待确认时，再引入 application 用例与明确的阶段拆分。
- 签名、nonce、gas 默认由调用方通过 `bind.TransactOpts` 控制；SDK 不隐藏私钥，不默认托管签名状态。

## 5. ABI 资产管理

- **原始 ABI artifact**（`.abi.json` / `.bin`）放 `/contracts/abi/`，按合约名一文件，扩展名固定 `.abi.json`；同目录 `README.md` 必须记录每个文件的 **来源仓库 + commit hash + solc 版本 + 编译命令 + 抓取日期**。
- **abigen 生成的 Go 绑定** 只能在 `/internal/infrastructure/bindings/<contract>/`；生成命令集中在 `/internal/infrastructure/bindings/gen.go` 用 `go generate` 钩子；生成文件首行必须保留 `// Code generated by abigen. DO NOT EDIT.`。
- **业务门面禁止直接暴露 bindings**：生成 binding 是基础设施实现细节；`/pkg` 与 `/examples` 不得直接 import bindings。SDK 可按合约业务模块组织门面（如 `ODDToken`、`StakingPool`、`LiquidityPool`、`BettingPool`），由基础设施层在 bindings 之上实现。
- 原始 artifact 与生成绑定必须 1:1 对应；新增 / 替换 artifact 时必须同步更新 `gen.go` 并重跑 `go generate`，CI 校验 `git diff --exit-code` 防止生成产物漂移。
- **同合约升级版本仅替换文件，禁止 `Foo_v2.abi.json` 类后缀**；版本通过 git history + `contracts/abi/README.md` 来源清单的 commit 字段追溯。

### 5.1 当前接入合约

> 实时接入状态见 `docs/progress/contracts.md`；下表为 **目标架构** 中各合约对应的领域映射。

| 合约 | ABI 文件 | 模块定位 | 领域层抽象（建议） | 升级模式 | 注意 |
| --- | --- | --- | --- | --- | --- |
| `BettingPool` | `BettingPool.abi.json` | 博彩主流程：开 / 结 / 退市、下注、派彩、推荐 | `internal/domain/bettingpool` + `pkg.Client.BettingPool()` | UUPS | market、bet、odds、quote guard、payout、refund、referral 是业务类型候选 |
| `LiquidityPool` | `LiquidityPool.abi.json` | 流动性：全局 / 单赛事入池、解锁、亏损分配 | `internal/domain/liquiditypool` + `pkg.Client.LiquidityPool()` | UUPS | position、unbond、epoch、pool weights 是业务类型候选 |
| `ODDToken` | `ODDToken.abi.json` | 平台代币（ERC-20 + Pause + Upgrade） | `internal/domain/oddtoken` + `pkg.Client.ODDToken()` | UUPS | ERC-20 通用字段直接使用 go-ethereum 类型；暂停 / 权限 / 业务错误可定义业务类型 |
| `StakingPool` | `StakingPool.abi.json` | 质押 / VIP 等级 / 奖励通知 / 提前解押 | `internal/domain/stakingpool` + `pkg.Client.StakingPool()` | UUPS | stake position、plan、VIP tier、reward、early unstake 是业务类型候选 |

### 5.2 代理与升级

- 全部已接入合约采用 UUPS：使用者交互的是 **proxy 地址**，ABI 描述的是 **implementation**。
- SDK 必须：
  - 公开 API 仅接受 / 暴露 proxy 地址；如使用者关心 implementation 地址，提供独立查询方法。
  - 监听 `Upgraded(address)` 事件并提供使用者钩子（`OnUpgrade(handler)`）。
  - 当 implementation 升级伴随 ABI 变化时，按 SemVer MAJOR 发版；CHANGELOG 必须列出新旧 selector 对照。
- 权限 / 升级类写函数是否暴露由对应业务门面设计决定；若暴露，必须在 godoc、开发文档和测试中清楚标注权限前置条件、链上风险、回滚方式和验收要求。

## 6. 命名约束

- 包名小写、单数、无下划线（`oddtoken`、`stakingpool`、`liquiditypool`、`bettingpool`），禁止 `oddtokenpkg` / `oddtoken_v2` 类后缀。
- 公开类型 / 函数采用 oddfi 领域语言（`ODDToken`、`StakePosition`、`LiquidityPosition`、`Bet`、`Market`），禁止基础设施术语（`EthToken`、`TxBuilder`、`RPCClient`）出现在 `/pkg`。
- 错误变量以 `Err` 开头并导出（`ErrInsufficientLiquidity`），错误类型以 `Error` 结尾（`RevertError`、`ConfigError`）。
- 接口名表达能力，不带 `I` 前缀；单方法接口用 `-er` 后缀（如 `Logger` / `Meter` 这类实际注入点）。
- 构造函数：`NewXxx` 返回值（或值指针）；多种构造方式用 `NewXxxFromYyy` 区分。

## 7. 依赖注入与生命周期

- 所有 SDK 持有的可变依赖（链客户端、日志、指标、tracer、时间源 `clock.Clock`、随机源 `io.Reader`、重试策略）必须通过构造函数 / Option 注入。
- 禁止 `init()` 中执行 I/O、注册全局表、读环境变量。
- 禁止包级可变变量；包级常量与 `var ErrXxx = errors.New(...)` 哨兵错误除外。
- 禁止 `sync.Once` 隐藏的 lazy 单例；如确实需要懒加载，必须挂在结构体上由调用方持有。
- 资源释放：持有连接 / goroutine 的对象必须暴露 `Close(ctx) error`，文档说明调用语义。

## 8. 反例（即时拒收）

下列代码片段在 PR 中出现即拒收，无需进一步评审：

```go
// ❌ pkg 直接暴露内部 RPC client 生命周期
func (c *Client) RawClient() *ethclient.Client

// ❌ pkg / examples 直接 import 生成 binding
import "github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/oddtoken"

// ❌ domain 变成通用 EVM 组件封装，而不是业务域
package domain
type Address struct { /* only wraps common.Address */ }

// ❌ 领域层 import 基础设施 / binding
package domain
import "github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/oddtoken"

// ❌ 库代码 panic
if cfg == nil { panic("nil config") }

// ❌ 全局单例
var defaultClient = mustNewClient()

// ❌ SDK 公共 API 接收或托管私钥；签名应由调用方提供的 bind.TransactOpts 完成
func NewClientWithPrivateKey(rawPrivateKey string) (*Client, error)

// ❌ 阻塞 I/O 缺 ctx
func (c *Client) WaitReceipt(hash common.Hash) (*types.Receipt, error)

// ❌ init 执行 I/O
func init() { http.DefaultClient.Get("...") }
```

## 9. 与其他规范的关系

- 本文件覆盖 **架构与公开 API 形状**。
- 编码细节（错误处理、并发、日志、依赖、安全工具）见 `AGENTS.md` 第 4 节。
- 测试与对抗性测试见 `AGENTS.md` 第 6 节与 `docs/testing/`。
- 流程（评审、变更、验收）见 `AGENTS.md` 第 5/6/7 节。
