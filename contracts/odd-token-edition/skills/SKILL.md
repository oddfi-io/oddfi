---
name: oddfi-contracts
description: Use this skill to work with the standalone OddFi Solidity contract toolpack. It bundles current ABIs, TypeScript contract scripts, local Foundry scenario runners, BSC Testnet address references, and workflow notes for ODDToken, StakingPool, LiquidityPool, BettingPool, BettingBetModule, BettingMarketModule, BettingReferralModule, BettingSettlementModule, BettingParlayModule, BettingParlayLens, TierSale, HouseVault, DexLaunchController, DexLpLocker, and EcosystemRewards. Use it for local scenario testing, method-level ABI access, market setup, betting, staking, liquidity, token source-locking, sale/reward distribution, DEX launch, score-based settlement/refund flows, governance calls, and chain smoke checks without depending on external documentation.
---

# OddFi 合约技能

这是一个独立可携带的 OddFi 合约操作 skill。复制整个 `skills/` 目录后，脚本、ABI、地址参考、流程说明和场景说明都在 skill 内部。

当前 ABI 基线是 2026-06-12 本地 Solidity 实现：AH 扩盘口 + score-based 分批结算 + 赔率 V2 WCL + 手动封锁 + Cash Out + 串关 MVP + `BettingPool` 模块化入口壳 + 赔率 V3 新增 line + `ODDToken` 锁仓与来源账本 MVP + `TierSale / HouseVault / DexLaunchController / DexLpLocker / EcosystemRewards` 配套合约。链上写操作或直连模块/Lens/support contract 查询前，必须确认目标链地址已升级或已部署到当前 ABI。

赔率 V3 新增 line 已在本地源码实现并发布到当前 BSC Testnet 地址；链上开盘 AH `line=10..12` 或 OU `line=3..10` 前，仍应核对 `BettingPool.settlementModule() / marketModule() / parlayModule()` 与 `references/contracts.json` 一致。

## 边界

- `assets/*.abi.json` 是当前本地合约 ABI，来自 Foundry artifact。
- `references/contracts.json` 是当前 BSC Testnet 地址参考。链上调用前必须核对当前 proxy implementation、module 和 Lens 地址是否已升级到 `assets/*.abi.json` 对应版本。
- 链上写操作前必须确认目标链 proxy implementation 与 `assets/*.abi.json` 匹配；不匹配时只跑本地场景或重新部署/升级。
- 2026-06-12 ODDToken 锁仓与发售 MVP 已完成 BSC Testnet 全量新部署；同日已升级 `HouseVault / BettingPool` implementation 支持 `HouseVault.fundBettingPlatformReserve` L4 兜底注资，并完成赔率 V3 line module 升级；`TierSale / HouseVault / DexLaunchController / DexLpLocker / EcosystemRewards` 与 betting module/lens 默认地址已登记在 `references/contracts.json` 和 `script/config.ts`，链上写操作前仍必须核对当前 proxy implementation 与 module getter。
- `BettingBetModule` 是 `BettingPool` 的 ordinary bet delegatecall implementation；写业务入口始终走 `BettingPool.placeBet`。
- `BettingMarketModule` 是 `BettingPool` 的 market delegatecall/staticcall implementation；`openMarket / updateOdds / previewSignal / isMatchTerminal` 业务入口始终走 `BettingPool`。
- `BettingReferralModule` 是 `BettingPool` 的 referral delegatecall implementation；推荐绑定和推荐奖励领取入口始终走 `BettingPool`。
- `BettingSettlementModule` 是 `BettingPool` 的 settlement delegatecall implementation；写业务入口始终走 `BettingPool` proxy，`getClaimStatus / estimateBetValue` 可通过 `BettingPool` wrapper 或模块直连 `view` 查询。
- `BettingParlayModule` 写业务入口始终走 `BettingPool` proxy，`getParlayClaimStatus / estimateParlayValue` 可通过 `BettingPool` wrapper 或模块直连 `view` 查询。
- `BettingParlayLens` 提供 `previewParlay` 与 `estimateParlayValue(bettingPool,user,parlayId)` 直连 `view` 查询。
- `TierSale` 提供 10 档销售、退款/取消、finalize 与 launch 额度批准 ABI。
- `HouseVault` 提供白名单业务合约、treasury sink 方向的 ODD treasury 出账 ABI，以及通过 `fundBettingPlatformReserve` 给 `BettingPool.platformReserve/accountedBalance` 注入 L4 兜底资金的专用入口。
- `DexLaunchController` 只提供 PancakeSwap V3 建池/注入流动性/剩余资产 sweep ABI。
- `DexLpLocker` 负责接收并锁定 PancakeSwap V3 LP NFT，按 beneficiary 到期释放。
- `EcosystemRewards` 提供类别预算、claimable 创建/取消/领取 ABI。
- 全 ABI 入口是 `script/method.ts`；快捷脚本只覆盖常用流程。

## 快速开始

```bash
cd skills
npm install
npm run typecheck
```

本地场景测试：

```bash
npm run local:scenarios
```

链上只读检查：

```bash
export RPC_URL=https://bsc-testnet-dataseed.bnbchain.org
npx tsx script/query.ts addresses
npx tsx script/method.ts list BettingPool
```

链上写操作需要：

```bash
export PRIVATE_KEY=0x...
```

## 当前核心 ABI

市场类型：

- `0`: 1X2
- `1`: Asian Handicap
- `2`: Over/Under

AH line：

- `0`: `-0.5`
- `1`: `-1`
- `2`: `-1.5`
- `3`: `-0.25`
- `4`: `-0.75`
- `5`: `-1.25`
- `6`: `+0`
- `7`: `+0.25`
- `8`: `+0.5`
- `9`: `+0.75`
- `10`: `-1.75`
- `11`: `-2`
- `12`: `-3`

OU line：

- `0`: `1.5`
- `1`: `2.5`
- `2`: `3.5`
- `3`: `0`
- `4`: `0.5`
- `5`: `1`
- `6`: `1.75`
- `7`: `2`
- `8`: `2.25`
- `9`: `2.75`
- `10`: `3`

结算入口：

```bash
npx tsx script/settle.ts list <marketId> [offset] [limit]
npx tsx script/settle.ts batch <marketId> <homeScore> <awayScore> <betId> [betId...]
npx tsx script/settle.ts score <marketId> <homeScore> <awayScore> [batchSize]
npx tsx script/settle.ts finalize <marketId> <resultKind>
npx tsx script/settle.ts refund <marketId> <betId:amountODD> [betId:amountODD...]
```

`resultKind`：

- `0`: 正常比分结算收口为 `Settled`
- `1`: 赛后标记 `Refunded`
- `2`: 赛后标记 `Cancelled`

正常结算流程：

```text
getMarketBetIds -> settleMarketBetsByScore -> finalizeMarketSettlement(marketId, 0)
```

退款/取消流程：

```text
finalizeMarketSettlement(marketId, 1 or 2) -> refundBets
```

AH full push 属于正常比分结算：market 终态为 `Settled`，bet 可为 `Refunded`。没有独立 `pushRefundMarket`。

## 常用脚本

全方法控制台：

```bash
npx tsx script/method.ts list ODDToken
npx tsx script/method.ts list StakingPool
npx tsx script/method.ts list LiquidityPool
npx tsx script/method.ts list BettingPool
npx tsx script/method.ts list BettingBetModule
npx tsx script/method.ts list BettingMarketModule
npx tsx script/method.ts list BettingReferralModule
npx tsx script/method.ts list BettingSettlementModule
npx tsx script/method.ts list BettingParlayModule
npx tsx script/method.ts list BettingParlayLens
npx tsx script/method.ts list TierSale
npx tsx script/method.ts list HouseVault
npx tsx script/method.ts list DexLaunchController
npx tsx script/method.ts list DexLpLocker
npx tsx script/method.ts list EcosystemRewards
npx tsx script/method.ts read BettingPool getBet '["<betId>"]'
npx tsx script/method.ts read BettingPool getClaimStatus '["<user>","<betId>"]'
npx tsx script/method.ts read BettingPool estimateBetValue '["<user>","<betId>"]'
npx tsx script/method.ts read BettingPool getParlayClaimStatus '["<user>","<parlayId>"]'
npx tsx script/method.ts read BettingPool estimateParlayValue '["<user>","<parlayId>"]'
npx tsx script/method.ts read BettingSettlementModule getClaimStatus '["<bettingPool>","<user>","<betId>"]'
npx tsx script/method.ts read BettingSettlementModule estimateBetValue '["<bettingPool>","<user>","<betId>"]'
npx tsx script/method.ts read BettingParlayModule getParlayClaimStatus '["<bettingPool>","<user>","<parlayId>"]'
npx tsx script/method.ts read BettingParlayModule estimateParlayValue '["<bettingPool>","<user>","<parlayId>"]'
npx tsx script/method.ts read BettingParlayLens estimateParlayValue '["<bettingPool>","<user>","<parlayId>"]'
npx tsx script/method.ts write BettingPool setRiskConfig '["80000000000000000000000","180000000000000000000000","280000000000000000000000"]'
```

查询：

```bash
npx tsx script/query.ts addresses
npx tsx script/query.ts token <address>
npx tsx script/query.ts staking <address>
npx tsx script/query.ts lp <positionId>
npx tsx script/query.ts market <marketId>
npx tsx script/query.ts odds <marketId>
npx tsx script/query.ts bet <betId>
npx tsx script/query.ts risk <address>
npx tsx script/query.ts pool
```

ODDToken：

```bash
npx tsx script/token.ts balance <address>
npx tsx script/token.ts allowance <owner> <spender>
npx tsx script/token.ts approve <spender> <amountODD>
npx tsx script/token.ts transfer <to> <amountODD>
```

StakingPool：

```bash
npx tsx script/stake.ts approve <amountODD>
npx tsx script/stake.ts stake <amountODD> <planId>
npx tsx script/stake.ts unstake <positionId>
npx tsx script/stake.ts early <positionId>
npx tsx script/stake.ts info <address>
npx tsx script/stake.ts position <positionId>
```

LiquidityPool：

```bash
npx tsx script/lp.ts approve <amountODD>
npx tsx script/lp.ts global <amountODD> <planId>
npx tsx script/lp.ts match <matchId> <amountODD>
npx tsx script/lp.ts unbond <positionId>
npx tsx script/lp.ts withdraw <positionId>
npx tsx script/lp.ts info <positionId>
npx tsx script/method.ts read LiquidityPool previewWithdraw '["<positionId>"]'
npx tsx script/lp.ts window <matchId>
npx tsx script/lp.ts requestable
```

BettingPool：

```bash
npx tsx script/market.ts id <matchId> <marketType> <line>
npx tsx script/market.ts open <matchId> <marketType> <line> <startTs> <endTs> <oddsCsv> [updatedAt]
npx tsx script/market.ts odds <marketId> <oddsCsv> [updatedAt]
npx tsx script/market.ts lock <marketId>
npx tsx script/market.ts status <marketId>
npx tsx script/bet.ts approve <amountODD>
npx tsx script/bet.ts bind <referrer>
npx tsx script/bet.ts preview <marketId> <outcome> <amountODD>
npx tsx script/bet.ts place <marketId> <outcome> <amountODD> <minOdds> <minAcceptedODD> <deadlineTs> [referrer]
npx tsx script/bet.ts cashout <betId> <minAmountOutODD> <deadlineTs> [quotedAt]
npx tsx script/bet.ts claim <betId>
npx tsx script/bet.ts claim-ref <amountODD>
```

本地一键场景：

```bash
npm run local:scenarios
```

链上 smoke 场景：

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://bsc-testnet-dataseed.bnbchain.org
npm run scenario
```

只有当目标链 ABI 已升级到当前 `assets/*.abi.json` 时才运行链上 smoke。

## 参考文件

- `references/workflows.md`：流程细节、参数说明、失败处理。
- `references/scenarios.md`：场景矩阵和本地/链上覆盖边界。
- `references/contracts.json`：BSC Testnet 历史地址、implementation 和部署 hash。
- `assets/*.abi.json`：当前 ABI。

## 权限速查

| 操作 | 权限 |
|---|---|
| `openMarket / updateOdds / lockMarket` | `OPERATOR_ROLE` |
| `settleMarketBetsByScore / finalizeMarketSettlement / refundBets` | `SETTLER_ROLE` |
| `set* / addPlatformReserve` | `DEFAULT_ADMIN_ROLE` |
| `pause / unpause` | `PAUSER_ROLE` |
| `upgradeToAndCall` | `UPGRADER_ROLE` |
| `stake / unstake / depositGlobal / placeBet / cashOut / claimPayout` | 用户自行调用 |
