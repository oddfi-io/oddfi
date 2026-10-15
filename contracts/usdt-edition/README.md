# OddFi Contracts

OddFi USDT 版本体育竞猜智能合约，部署在 BNB Smart Chain 上。

## 概述

用户以 USDT 参与体育赛事预测，资金由智能合约托管，下注由链下后端验证后调用合约锁定余额，结算由多签触发，用户随时可提现。

**核心特性：**
- 充值即可下注，下注无需每次签名
- 资金由合约托管，平台无法直接动用
- 结算经 Gnosis Safe 多签，单人无法完成
- UUPS 可升级架构

## 支持盘口

| 类型 | 说明 |
|------|------|
| 胜负平 (X12) | 主胜 / 平局 / 客胜 |
| 让分 (AH) | 亚盘 -0.5 / -1 / -1.5 |
| 总分 (OU) | 大小球 2.5 / 3.5 / 4.5 |

## 项目结构

```
├── src/                    # 合约源码
│   ├── core/
│   │   ├── BettingPool.sol         # 聚合根（UUPS Proxy）
│   │   ├── interfaces/             # 接口定义
│   │   └── libraries/              # 领域服务库
│   └── shared/                     # 共享类型、常量、错误
├── test/                   # Foundry 测试（225 tests, 97%+ 覆盖率）
├── script/                 # Forge 部署脚本
├── skills/                 # TypeScript 交互脚本（viem）
├── docs/                   # 文档
│   ├── architecture/       # 架构设计
│   ├── development/        # 开发文档
│   ├── product/            # 产品需求
│   ├── progress/           # 开发现状
│   ├── testing/            # 安全审查报告
│   └── deployment/         # 部署信息
└── lib/                    # 依赖（forge-std, OpenZeppelin, solmate）
```

## 技术栈

- Solidity ^0.8.20 / Foundry
- OpenZeppelin v5 (UUPS, Pausable, SafeERC20)
- BNB Smart Chain

## 快速开始

```bash
# 安装依赖
forge install

# 编译
forge build

# 测试
forge test

# 覆盖率
forge coverage
```

## 测试网部署

合约已部署至 BNB Testnet (ChainID 97)：

| 合约 | 地址 |
|------|------|
| BettingPool (Proxy) | `0xCcAD84d0772262AeDe15B1B702d1Bd69D02f177D` |
| MockUSDT | `0xd8f86e84b4475d7bd398788e594124429e7700cf` |

交互脚本见 `skills/` 目录。

## 文档

- [产品需求](docs/product/产品需求_USDT版本.md)
- [开发文档](docs/development/USDT版本合约任务.md)
- [安全审查](docs/testing/security-review.md)
- [交互技能](skills/SKILL.md)
