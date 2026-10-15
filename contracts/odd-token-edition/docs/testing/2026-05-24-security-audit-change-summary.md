# 2026-05-24 合约安全审计修改同步说明

**状态：** 当前有效  
**用途：** 面向前端、后端、运营和测试同步本轮安全审计处理后的合约行为变化。  
**来源：** `docs/testing/2026-05-24-security-audit-triage.md`  
**代码基线：** 当前 `src/`  

## 一、总体结论

本轮共复核 `AUDIT-001` 到 `AUDIT-015`：

- 已修复并落地：`AUDIT-001 / 002 / 003 / 004 / 005 / 006 / 008 / 010 / 013 / 014`；
- 已拒绝为当前代码漏洞：`AUDIT-007 / 011 / 012 / 015`；
- 仍需产品或治理口径确认：`AUDIT-009`。

本轮有外部调用影响的主要变化集中在 `BettingPool`：

1. 正常胜负结算已切换为 score-based 分批路径；
2. `claimPayout` 必须等 market 完成 `Settled` 后才能领取；
3. 退款/取消由 `finalizeMarketSettlement(marketId,1/2)` 只标记 market 终态，真实退款仍由 `refundBets` 分批执行；
4. 平台 20% margin 留在 `BettingPool` 并计入 `platformReserve`；
5. USDT 推荐奖励兑换 router/token 改为治理配置；
6. `setBettingDependencies` 不再允许运行期替换已配置依赖；
7. UUPS implementation 本体禁止直接初始化。

## 二、前端需要关注

### 2.1 胜单领取

`claimPayout(betId)` 现在额外要求：

- bet 状态为 `WonUnclaimed`；
- 对应 market 状态必须已经是 `Settled`。

影响：

- 分批结算期间，即使某个 bet 已经被批处理为 `WonUnclaimed`，前端也不能提前领取；
- 前端展示“可领取”时应同时检查 `getBet(betId).settlementState == WonUnclaimed` 和 `getMarket(bet.marketId).status == Settled`。

### 2.2 推荐奖励 USDT 领取

`claimUSDTReferralRewards` 当前签名为：

```solidity
claimUSDTReferralRewards(
    uint256 rewardMinUsdtOutAmount,
    uint256 signatureDeadline,
    bytes signature,
    uint256 minUsdtOut
) returns (uint256 amountOut)
```

前端不再传入 `swapRouter` 或 `usdtAddress`。

影响：

- Router 和 USDT token 由治理通过 `setReferralSwapConfig(address swapRouter, address usdtToken)` 配置；
- `amountOut` 以用户 USDT 余额前后差额为准；
- 若真实到账低于 `minUsdtOut` 或签名绑定的 `rewardMinUsdtOutAmount`，交易 revert；
- ODD 直领奖励路径 `claimReferralRewards(uint256 oddAmount)` 不变，仍支持部分领取。

### 2.3 新增只读分页接口

新增：

```solidity
getMarketBetIds(bytes32 marketId, uint256 offset, uint256 limit) returns (bytes32[] result)
```

主要给后端或 keeper 分批结算使用，前端如果需要展示某 market 下 betId 列表，也可以分页读取。

## 三、后端 / 运营需要关注

### 3.1 正常胜负结算

所有正常胜负结算统一使用分批比分结算：

1. 通过 `getMarketBetIds(marketId, offset, limit)` 分页读取 betIds；
2. 多次调用：

```solidity
settleMarketBetsByScore(marketId, homeScore, awayScore, betIds)
```

3. 所有 betIds 处理完后调用：

```solidity
finalizeMarketSettlement(marketId, 0)
```

注意：

- 每批 `betIds.length` 必须 `> 0` 且不超过 `BettingConstants.FINALIZE_BATCH_HARD_CAP`；
- 首批会锁定 `homeScore / awayScore`，后续批次必须传相同比分；
- 每个 bet 必须属于该 market 且仍为 `Pending`，重复传入会 revert；
- 一旦 market 开始分批比分结算，不能再改成 `Refunded / Cancelled`；
- `finalizeMarketSettlement(marketId,0)` 不遍历全量 bet，只检查 `processedCount == totalBetCount` 后按累计值收口 margin、瀑布和 market 终态；
- 零下注 market 可在比赛结束后直接调用 `finalizeMarketSettlement(marketId,0)` 结算为 `Settled`。

### 3.2 退款或取消

退款或取消使用：

```solidity
finalizeMarketSettlement(marketId, 1) // Refunded
finalizeMarketSettlement(marketId, 2) // Cancelled
```

该入口只做：

- 标记 market 为 `Refunded` 或 `Cancelled`；
- `quoteVersion += 1`；
- 发 `MarketSettlementFinalized`，金额字段全部为 `0`。

它不会：

- 遍历注单；
- 改 bet 状态；
- 计算 margin；
- 执行瀑布；
- 给用户退款。

真实退款仍由后端继续分批调用：

```solidity
refundBets(marketId, betIds, refundAmounts)
```

AH full push 不再走专门入口：它属于正常比分结算，market 最终为 `Settled`，对应 bet 为 `Refunded`。

### 3.3 结算事件监听

`MarketSettlementFinalized` 的解释需要按 `resultKind` 分支：

| resultKind | 含义 | 金额字段 |
|---|---|---|
| `0` | 正常胜负结算 | `grossPayout / lpMarginShare / platformMarginShare` 为真实结算汇总 |
| `1` | 退款终态标记 | 金额字段固定为 `0` |
| `2` | 取消终态标记 | 金额字段固定为 `0` |

新增事件：

```solidity
MarketSettlementScoreBatchProcessed(
    bytes32 indexed marketId,
    uint16 homeScore,
    uint16 awayScore,
    uint256 processedCount,
    uint256 totalBetCount
)
```

后端可以用该事件追踪分批结算进度。

### 3.4 治理配置变更

新增或收紧的治理配置：

| 方法 | 变化 |
|---|---|
| `setReferralSwapConfig(address,address)` | 配置 USDT 推荐奖励固定 router/token |
| `setBettingDependencies(address,address,address)` | 仅允许三项依赖均未设置时一次性配置；已配置后不能用来运行期替换依赖 |
| `setSettlementModule(address)` | 仍可切换结算模块，属于模块化架构治理信任边界 |

## 四、资金与账本变化

### 4.1 平台 20% margin

正常胜负结算时：

- LP 份额按 `lpMarginShareBps` 处理；
- 平台 20% margin 留在 `BettingPool`；
- 平台 margin 计入 `platformReserve`；
- 触发 `PlatformReserveUpdated(reason=4)`。

这笔资金不再被视为只计算不落账，也不会直接转出到 `platformTreasury`。

### 4.2 LP loss offset 命名

原语义已改为：

- `lpLossOffsetRemaining`
- `LpLossOffsetApplied`

它只表示 L2 LP 已承担亏损中，后续派奖税 taxBuffer 份额需要优先冲抵的指标余额。

它不是：

- 平台欠 LP 的应付债务；
- 需要向 `LiquidityPool` 转账的真实还款；
- 恢复 LP 历史 `lossPerPrincipal` 的回补动作。

## 五、升级与部署注意

四个 UUPS implementation 已在构造器中执行 `_disableInitializers()`：

- `ODDToken`
- `StakingPool`
- `LiquidityPool`
- `BettingPool`

影响：

- 直接调用 implementation 地址的 `initialize` 会 revert；
- proxy 初始化和 UUPS 升级不受影响；
- 后续升级如需补初始化，应通过 proxy 调用 `upgradeToAndCall(newImplementation, data)`，并在 `data` 中传入新版本的 `reinitializer` calldata。

`BettingSettlementModule` 不是前端或后端常规直连接口，所有业务调用仍应走 `BettingPool` wrapper。

## 六、测试与验证

本轮已执行并通过：

- `forge test --match-path test/BatchMarketSettlement.t.sol --offline -vv`
- `forge test --match-path test/PlatformMarginReserveAccounting.t.sol --offline -vv`
- `forge test --match-path test/StakingPausedClaimPayout.t.sol --offline -vv`
- `forge test --match-path test/BettingDependenciesConfig.t.sol --offline -vv`
- `forge test --match-path test/UUPSImplementationInitializer.t.sol --offline -vv`
- `forge test --match-path test/LiquidityPayoutReserveInvariant.t.sol --offline -vv`
- `forge test --match-path test/LocalScenarioMatrix.t.sol --offline -vv`
- `forge test --offline --no-match-path 'test/Fork*' -vv`

`LocalScenarioMatrix` 覆盖当前本地正反场景：DEP / REF / TAX / BET / STK / LP / WFL / SPC / SEC。最新一次本地结果以 `docs/testing/2026-05-24-local-scenario-matrix-report.md` 为准。
- `forge build --offline`
- `forge build --sizes --offline`
- `Slither` 当前本地 PATH 未安装，未执行；提交审计前需在具备 Slither 的环境补跑并处理 High / Medium。
- `MAINNET_FORK_RPC_URL=<BSC_MAINNET_RPC_URL> forge test --match-path test/ForkMainnetCoverageBetting.t.sol -vv`
- `MAINNET_FORK_RPC_URL=<BSC_MAINNET_RPC_URL> forge test --match-path test/ForkMainnetCoverageEdgesBettingValidation.t.sol -vv`

当前 size：

- `BettingPool` runtime size：`23,615 B`
- `BettingSettlementModule` runtime size：`9,853 B`

## 七、仍未改动的审计项

### AUDIT-009

`_waterfall` 在 L2/L3/L4 均不足时仍会 revert，市场无法关闭。该项需要产品确认兜底策略后再实现，例如：

- 人工补足后重试；
- 协议亏空账本；
- 按比例赔付；
- 其他治理确认的兜底规则。

当前不在本轮代码修复范围内。

### AUDIT-012

普通单市场赔率没有新增链上绝对上限。当前产品文档未定义普通单市场 `Base Odds` 绝对最大值，且 `openMarket / updateOdds` 均由 `OPERATOR_ROLE` 控制。后续如产品明确上限，再同时覆盖开盘和更新赔率。
