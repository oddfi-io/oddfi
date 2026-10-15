# OddFi 合约独立流程手册

本文件属于 skill 内部资料。复制整个 `skills/` 目录后，ABI、脚本、地址参考和流程说明都随包携带。

## 1. 环境

```bash
cd skills
npm install
npm run typecheck
```

本地场景测试：

```bash
npm run local:scenarios
```

链上读写：

```bash
export RPC_URL=https://bsc-testnet-dataseed.bnbchain.org
export PRIVATE_KEY=0x...
```

`assets/*.abi.json` 是当前本地 Solidity ABI。`references/contracts.json` 记录当前 BSC Testnet 全量新部署地址；链上写交易前必须确认目标 implementation 已部署当前 ABI，并优先通过 proxy 地址调用业务入口。2026-06-12 ODDToken 锁仓与发售 MVP support contracts 已登记默认 BSC Testnet 地址，也可以通过对应 `*_ADDRESS` 环境变量临时覆盖。赔率 V3 新增 line 已在本地源码实现并发布到当前 BSC Testnet module；链上开盘 AH `line=10..12` 或 OU `line=3..10` 前应核对 `BettingPool` 的 module getter 与地址参考一致。

## 2. 全方法入口

```bash
npx tsx script/method.ts list BettingPool
npx tsx script/method.ts read BettingPool getMarketOdds '["<marketId>"]'
npx tsx script/method.ts read BettingPool getBet '["<betId>"]'
npx tsx script/method.ts write BettingPool pause '[]'
```

规则：

- `argsJson` 必须是 JSON 数组。
- `uint/int` 用字符串可避免 JS number 精度损失。
- `bytes32` 可传 `0x` + 64 hex；普通字符串会自动 `keccak256(text)`。
- 重载函数必须使用完整签名。

## 3. 本地场景

```bash
npm run local:scenarios
```

该命令从 `skills/` 向上定位 Foundry 项目根目录并执行：

```bash
forge test --match-path test/LocalScenarioMatrix.t.sol --offline -vv
forge test --match-path test/BatchMarketSettlement.t.sol --offline -vv
forge test --offline --no-match-path 'test/Fork*' -vv
```

如果复制后的 `skills/` 不在 Foundry 项目根目录下一层，该命令会拒绝运行；其它 ABI 和链上脚本仍可独立使用。

## 4. 市场与 line

市场类型：

- `0=1X2`
- `1=Asian Handicap`
- `2=Over/Under`

AH line：

- `0=-0.5`
- `1=-1`
- `2=-1.5`
- `3=-0.25`
- `4=-0.75`
- `5=-1.25`
- `6=+0`
- `7=+0.25`
- `8=+0.5`
- `9=+0.75`
- `10=-1.75`
- `11=-2`
- `12=-3`

OU line：

- `0=1.5`
- `1=2.5`
- `2=3.5`
- `3=0`
- `4=0.5`
- `5=1`
- `6=1.75`
- `7=2`
- `8=2.25`
- `9=2.75`
- `10=3`

开盘：

```bash
npx tsx script/market.ts id <matchId> <marketType> <line>
npx tsx script/market.ts open <matchId> <marketType> <line> <startTs> <endTs> <oddsCsv> [updatedAt]
npx tsx script/market.ts odds <marketId> <oddsCsv> [updatedAt]
npx tsx script/market.ts lock <marketId>
npx tsx script/market.ts status <marketId>
```

赔率精度为 `1e4`，例如 `18000` 表示 `1.8x`。

`lock` 是手动封锁 market：只能由具备 `OPERATOR_ROLE` 的地址调用，且必须在 `matchEndTime` 前或等于 `matchEndTime` 时调用。未手动封锁时，下注与赔率更新以 `matchEndTime` 为关闭边界。

## 5. 下单

```bash
npx tsx script/bet.ts approve 100
npx tsx script/bet.ts preview <marketId> <outcome> 100
npx tsx script/bet.ts place <marketId> <outcome> 100 <minOdds> <minAcceptedODD> <deadlineTs> [referrer]
npx tsx script/bet.ts cashout <betId> <minAmountOutODD> <deadlineTs> [quotedAt]
```

`place` 会自动读取当前 `quoteVersion / updatedAt` 并组装 `QuoteGuardInput`。如果遇到 `InvalidQuoteGuard`，重新 `preview` 后再下注。

Cash Out：

```bash
npx tsx script/bet.ts cashout <betId> <minAmountOutODD> <deadlineTs> [quotedAt]
```

`cashout` 会自动读取 bet 的 `marketId` 和当前 `quoteVersion`。未传 `quotedAt` 时使用最新链上 block timestamp；链上要求 `quotedAt + 5 seconds` 内成交。2026-06-03 BSC Testnet live 验收已发现该 5 秒 TTL 对真实 RPC/出块窗口过紧，未 lock 的 `cashOut` 真实交易 `status=0`；修正 TTL 前不要把 Cash Out 写交易视为可用。若 market 已被手动 `lock`，Cash Out 会失败，只能等待最终结算或退款。

推荐关系：

```bash
npx tsx script/bet.ts bind <referrer>
npx tsx script/bet.ts claim-ref <amountODD>
```

`claimUSDTReferralRewards(...)` 需要治理配置的 router/token、后端签名和 deadline，使用 `method.ts write BettingPool claimUSDTReferralRewards '[...]'`。

## 6. Score-Based 结算

正常比分结算：

```bash
npx tsx script/settle.ts list <marketId> [offset] [limit]
npx tsx script/settle.ts batch <marketId> <homeScore> <awayScore> <betId> [betId...]
npx tsx script/settle.ts finalize <marketId> 0
```

或一键分页：

```bash
npx tsx script/settle.ts score <marketId> <homeScore> <awayScore> [batchSize]
```

链上流程等价于：

```text
getMarketBetIds -> settleMarketBetsByScore -> finalizeMarketSettlement(marketId, 0)
```

注意：

- `homeScore / awayScore` 是整场比分。
- `outcome=0` 是主队视角，`outcome=1` 是客队视角；AH 由合约按 line 和比分推导 full win / half win / push / half loss / loss。
- AH / OU full push 走正常比分结算，market 最终为 `Settled`，bet 为 `Refunded`。
- 旧 `settleMarket`、旧 `settleMarketBets(...winningOutcome...)` 和 `pushRefundMarket` 不存在于当前 ABI。

## 7. Refunded / Cancelled

必须比赛结束后才能标记：

```bash
npx tsx script/settle.ts finalize <marketId> 1
npx tsx script/settle.ts refund <marketId> <betId:amountODD> [betId:amountODD...]
```

或：

```bash
npx tsx script/cancel.ts <marketId> 2 <betId> [betId...]
```

`resultKind`：

- `1=Refunded`
- `2=Cancelled`

如果某 market 已开始 `settleMarketBetsByScore`，不能再改为 `Refunded / Cancelled`。

## 8. 派奖

```bash
npx tsx script/bet.ts claim <betId>
```

`claimPayout` 只允许 market 已 `Settled` 且 bet 为 `WonUnclaimed`。`Refunded / Cancelled` 的 bet 走 `refundBets`。`CashedOut` 的 bet 已终态关闭，不能 claim、refund 或再次 cashout。

## 9. LP 与质押

Staking：

```bash
npx tsx script/stake.ts approve 100
npx tsx script/stake.ts stake 100 0
npx tsx script/stake.ts info <address>
npx tsx script/stake.ts position <positionId>
npx tsx script/stake.ts unstake <positionId>
npx tsx script/stake.ts early <positionId>
```

Liquidity：

```bash
npx tsx script/lp.ts approve 1000
npx tsx script/lp.ts global 1000 0
npx tsx script/lp.ts match <matchId> 1000
npx tsx script/lp.ts requestable
npx tsx script/lp.ts window <matchId>
npx tsx script/lp.ts unbond <positionId>
npx tsx script/lp.ts withdraw <positionId>
```

## 10. 查询与健康检查

```bash
npx tsx script/query.ts addresses
npx tsx script/query.ts pool
npx tsx script/query.ts token <address>
npx tsx script/query.ts staking <address>
npx tsx script/query.ts lp <positionId>
npx tsx script/query.ts market <marketId>
npx tsx script/query.ts odds <marketId>
npx tsx script/query.ts bet <betId>
npx tsx script/query.ts risk <address>
```

`npm run healthcheck` 会读取链上 proxy implementation 和核心依赖绑定。当前 `skills/assets` ABI 已包含 2026-06-03 Cash Out 本地实现；如果目标链 implementation 与当前 ABI 不一致，不要继续链上写交易。

## 11. 常见失败

- `写操作需要先设置 PRIVATE_KEY=0x...`：当前命令会发交易。
- `AccessControlUnauthorizedAccount`：当前私钥没有对应角色。
- `InvalidQuoteGuard`：赔率或报价变化，重新 `preview`。
- `MarketLocked`：市场已锁盘或已结束。
- `PayoutNotClaimable`：market 未 `Settled` 或 bet 不是中奖未领取状态。
- `function not found` / ABI decode 失败：链上 proxy implementation 与 `assets/*.abi.json` 不一致。
