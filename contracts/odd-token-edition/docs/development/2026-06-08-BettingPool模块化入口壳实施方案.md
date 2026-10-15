# BettingPool 模块化入口壳实施方案

**日期：** 2026-06-08
**状态：** 已实现并发布到 BSC Testnet，源码验证和 live 验证已通过
**范围：** `BettingPool` runtime size 优化、入口壳模块化、4 个查询接口回到 `BettingPool` ABI

## 1. 背景

2026-06-08 新增的 4 个查询接口当前可通过 module/lens 直连调用：

- `BettingSettlementModule.getClaimStatus(bettingPool,user,betId)`
- `BettingSettlementModule.estimateBetValue(bettingPool,user,betId)`
- `BettingParlayModule.getParlayClaimStatus(bettingPool,user,parlayId)`
- `BettingParlayLens.estimateParlayValue(bettingPool,user,parlayId)`

但若把 4 个 wrapper 直接加回 `BettingPool`，当前体积会超过 EIP-170：

- `BettingPool` 当前可发布版 runtime size：`23,877 B`，剩余 `699 B`
- 直接 wrapper 版本：`25,097 B`，超 `521 B`
- `staticcall` 瘦身 wrapper 版本：`24,991 B`，超 `415 B`

因此需要先把 `BettingPool` 的重写路径继续拆到 module，使 `BettingPool` 只保留公共 ABI wrapper、权限/暂停/重入保护、storage 和模块路由。

## 2. 目标架构

本轮新增 3 个 `BettingPool` 卫星 module：

- `BettingBetModule`：承接普通单注 `placeBet` 两个 overload 的成交、风控、下注税、推荐税、market exposure 与赔率刷新；
- `BettingMarketModule`：承接 `openMarket / updateOdds` 写路径，并提供 `previewSignal / isMatchTerminal` 的直连只读实现供 `BettingPool` staticcall wrapper 使用；
- `BettingReferralModule`：承接 `bindReferrer / claimReferralRewards / claimUSDTReferralRewards` 的推荐关系、推荐奖励领取与 USDT swap 逻辑。

`BettingPool` 保留：

- proxy storage owner；
- 对外稳定 ABI；
- 角色权限、暂停、重入保护、升级授权；
- module 地址治理 setter；
- 轻量 storage getter；
- `delegatecall / staticcall` 路由。

`BettingPool` 新增 4 个查询 wrapper：
  - `getClaimStatus(user,betId)`
  - `estimateBetValue(user,betId)`
  - `getParlayClaimStatus(user,parlayId)`
  - `estimateParlayValue(user,parlayId)`

串关估值为了支持 `BettingPool` wrapper，`BettingParlayModule` 补充直连只读 `estimateParlayValue(bettingPool,user,parlayId)`。`BettingParlayLens` 保持兼容为前端/后端独立 Lens 入口。

## 3. 非目标

- 不迁移 storage；
- 不引入独立资金池；
- 不改变 `placeBet / claim / settlement / parlay` 对外业务语义；
- 不把普通 storage getter 强行改成 module 路由；
- 不在本阶段拆分所有治理 setter。

## 4. 验收标准

- `forge build --offline --skip test --sizes` 通过，`BettingPool` runtime size 低于 `24,576 B`，且保留可用余量；
- 普通下注、结算、Cash Out、串关测试通过；
- 4 个 `BettingPool` 查询 wrapper 本地场景验证通过；
- `docs/development/api.md`、`docs/progress/当前开发现状.md` 和 skills ABI 同步。

## 5. 本地实施结果

- 已新增 `src/modules/betting/BettingBetModule.sol`、`BettingMarketModule.sol`、`BettingReferralModule.sol`；
- 已新增 `BettingPoolStorage.betModule / marketModule / referralModule`，消耗原 `__gap` 3 个 slot；
- 已新增 `BettingPool.setBetModule / setMarketModule / setReferralModule` 与对应 `*ModuleUpdated` 事件；
- `BettingPool.placeBet / openMarket / updateOdds / bindReferrer / claimReferralRewards / claimUSDTReferralRewards` 均已改为 wrapper；
- `BettingPool.previewSignal / isMatchTerminal` 已改为 `staticcall` 到 `BettingMarketModule` 的只读 wrapper；
- `BettingPool` 内部业务 helper 已清理，仅保留 module 调度、升级授权和重入保护壳层 helper；
- `BettingPool` 已新增 4 个只读 wrapper：
  - `getClaimStatus(userAddress,betId)`
  - `estimateBetValue(userAddress,betId)`
  - `getParlayClaimStatus(userAddress,parlayId)`
  - `estimateParlayValue(userAddress,parlayId)`
- `BettingParlayModule` 已补充 `estimateParlayValue(bettingPool,userAddress,parlayId)`，供 `BettingPool` wrapper 和模块直连查询共用；
- 当前 size：
  - `BettingPool`: `17,060 B`，剩余 `7,516 B`
  - `BettingBetModule`: `11,314 B`
  - `BettingMarketModule`: `10,677 B`
  - `BettingReferralModule`: `4,981 B`
  - `BettingSettlementModule`: `17,150 B`
  - `BettingParlayModule`: `18,543 B`
- 本地验证：
  - `forge build --offline --skip test --sizes` 通过；
  - `forge test --offline --match-path test/ParlayModule.t.sol -vv` 6/6 通过；
  - `forge test --offline --no-match-path 'test/ForkMainnet*' -vv` 60/60 通过。

## 6. BSC Testnet 发布结果

- `BettingPool` proxy 保持 `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` 不变；
- `BettingPool` implementation：`0x725f71F9937354bd6E3a3b7882E5754D3CdBF077`；
- `BettingSettlementModule`：`0xc1df22382Bae9Ec85A39503236a4151bB5B6c49E`；
- `BettingBetModule`：`0x47a1D9c3fB8aBB2a5BB4E89662F0158c41AC192E`；
- `BettingMarketModule`：`0xABDD827CCBbba26770c4e912257C20bE5991151c`；
- `BettingReferralModule`：`0x5F7355eB3bBb9C851B77eAc8342d85C44468A97C`；
- `BettingParlayModule`：`0x4d8C65378764A790cdD7A40dd9f7BC3Fb12D2c51`；
- `BettingParlayLens`：`0x54A40Ac7806904048Cf5F972C017aC2e33fDD15e`；
- 新增实现、模块和 Lens 均已通过 BscScan Testnet 源码验证；
- live 验证覆盖普通下注 full-flow、Cash Out、串关下注/结算/claim/residual release 和新增公共查询接口；报告见 `docs/testing/2026-06-08-bsc-testnet-modular-entrypoint-*.md` 与 `docs/testing/2026-06-08-bsc-testnet-query-interfaces-live-report.md`。line-scope 盘口矩阵本轮测试网重跑在结算阶段遇到 RPC 长时间挂起，未生成完整通过报告；本地矩阵测试已通过。
