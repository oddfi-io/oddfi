# OddFi ODD Contract

OddFi 的 ODD 版本智能合约仓库。

当前仓库已经完成 MVP 合约实现、BSC Testnet 部署、链上 smoke、场景联调、一键升级脚本落地。后续重点是持续验证增强、运维收口和主网前准备。

## 当前进度

当前整体状态以 `src/` 和 `docs/progress/当前开发现状.md` 为准：

- 已完成 5 个核心业务模块的合约实现：
  - `ODDToken`
  - `StakingPool`
  - `LiquidityPool`
  - `BettingPool`
  - `BettingSettlementModule`
- 已完成 BSC Testnet 部署；
- 已完成 BSC Testnet 链上 smoke 与真实场景联调；
- 已完成统一升级脚本，并已在 BSC Testnet 实链验证；
- 已补齐核心 API、权限、精度、事件与当前实现文档；
- `LiquidityManager` 与外部 Pancake LP 执行链路已从当前代码中移除，不再属于当前产品实现范围。

当前真实状态入口：

- [当前开发现状](docs/progress/当前开发现状.md)
- [docs 站点地图](docs/README.md)

## 建议阅读顺序

1. [当前开发现状](docs/progress/当前开发现状.md)
2. [总体架构](docs/architecture/oddfi-mvp-总体架构.md)
3. [Solidity DDD Mapping](docs/architecture/solidity-ddd-mapping.md)
4. [BettingSettlementModule 架构方案](docs/architecture/2026-04-23-BettingSettlementModule-架构方案.md)
5. [合约 API 文档](docs/development/api.md)
6. [当前代码总览](docs/development/2026-04-22-当前代码总览.md)
7. [合约场景测试文档](docs/testing/合约场景测试文档.md)
8. [安全审计报告筛选与处理清单](docs/testing/2026-05-24-security-audit-triage.md)
9. [安全审计修改同步说明](docs/testing/2026-05-24-security-audit-change-summary.md)

## 当前可用能力

### 业务合约

- `ODDToken`：ERC20 / BEP-20 兼容代币、pause、UUPS upgrade、初始化铸造；
- `StakingPool`：质押、奖励分配、VIP 等级读取；
- `LiquidityPool`：Global Pool、Match Pool、LP 仓位、requestable liquidity、payout window；
- `BettingPool`：开盘、赔率、下注、风控、退款、结算入口、领奖、推荐奖励、准备金与瀑布账本；
- `BettingSettlementModule`：通过 `delegatecall` 承接 `settleMarket`、`settleMarketBets`、`finalizeMarketSettlement`、`refundBets`、`pushRefundMarket` 等结算重逻辑。

### 工程能力

- Foundry 构建与测试；
- BSC Testnet proxy 合约部署记录；
- 一键部署与升级脚本：
  - [`script/DeployAll.s.sol`](script/DeployAll.s.sol)
  - [`script/DeployBscTestnet.s.sol`](script/DeployBscTestnet.s.sol)
  - [`script/upgrade_all_contracts.sh`](script/upgrade_all_contracts.sh)
  - [`script/deploy_and_verify.sh`](script/deploy_and_verify.sh)
  - [`script/deploy_and_verify_bsc_testnet.sh`](script/deploy_and_verify_bsc_testnet.sh)
- API 参考文档：
  - [合约 API 文档](docs/development/api.md)

## 目录说明

```text
src/        合约源码
script/     部署、升级、验证脚本
test/       Foundry 测试
docs/       当前架构、开发、进度、部署、测试与产品文档
```

## 维护说明

- 根目录 `README.md` 只做工程入口和当前状态摘要；
- 当前实现状态以 [当前开发现状](docs/progress/当前开发现状.md) 为准；
- `docs/` 目录结构和文档索引以 [docs 站点地图](docs/README.md) 为准；
- 新的实现变更必须同步更新 `docs/progress/当前开发现状.md`。
