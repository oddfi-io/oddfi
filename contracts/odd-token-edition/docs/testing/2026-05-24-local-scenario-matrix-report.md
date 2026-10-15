# 2026-05-24 本地场景矩阵测试报告

**状态：** 当前有效  
**执行范围：** 本地 Foundry fork-free 测试，不依赖测试网或外部 RPC  
**代码基线：** 当前 `src/`，已切换 AH 扩盘口与 score-based 分批结算

## 一、执行结论

本轮按 `docs/testing/合约场景测试文档.md` 的链上场景矩阵做本地真实流程测试，正向路径和反向路径均已覆盖到当前合约可执行范围。

已通过：

- `forge test --match-path test/LocalScenarioMatrix.t.sol --offline -vv`：`9 passed, 0 failed`
- `forge test --match-path test/BatchMarketSettlement.t.sol --offline -vv`：覆盖 AH 扩盘口、比分结算、零下注、full push、score mismatch 与 fuzz
- `forge test --offline --no-match-path 'test/Fork*' -vv`：`26 passed, 0 failed`
- `forge build --offline`：通过
- `forge build --sizes --offline`：通过，`BettingPool` runtime size `23,615 B`，`BettingSettlementModule` runtime size `9,853 B`
- `git diff --check`：通过

未执行：

- `Slither`：当前本地 PATH 未安装 `slither`。

本轮不执行：

- BSC Testnet 实链部署测试：当前未部署测试网，按本轮要求只测本地。
- `test/ForkMainnet*.t.sol`：需要 `MAINNET_FORK_RPC_URL`，不属于本轮本地验收。

## 二、本地场景映射

| 测试文件 | 测试方法 | 覆盖场景 |
|---|---|---|
| `test/LocalScenarioMatrix.t.sol` | `testDEP001ToDEP005_TokenPermissionsPauseAndAccessNegativePaths` | ODD 总量、普通转账、pause、越权治理、非授权终态标记 |
| `test/LocalScenarioMatrix.t.sol` | `testREF001ToREF005_ReferralBindingAutoBindingAndStakeDecoupling` | 显式绑定、自动绑定、重复绑定、自荐/零地址拒绝、推荐与质押解耦 |
| `test/LocalScenarioMatrix.t.sol` | `testTAX001ToTAX017_TaxSnapshotsClaimsNoTaxBranchesAndStaticBounds` | 下注税、派奖税快照、晚绑定、full push 不征派奖税、推荐 ODD/USDT claim |
| `test/LocalScenarioMatrix.t.sol` | `testBET001ToBET009_BettingLifecycleSettlementClaimPauseAndRefundNegativePaths` | 下单、锁盘拒绝、分批未完成不得 finalize、claim 幂等、暂停下 settlement/claim 边界、赛后 refund/cancel |
| `test/LocalScenarioMatrix.t.sol` | `testSTK001ToSTK017_StakingLifecycleRewardsVipPauseAndFailurePaths` | 质押最小值/档位、奖励、VIP、多仓位、pause、提前赎回、到期赎回、余额不足 |
| `test/LocalScenarioMatrix.t.sol` | `testLP001ToLP024_LiquidityLifecycleMarginLossUnbondEpochPauseAndBounds` | LP 存入、Match Pool、Margin/Loss、unbond/withdraw epoch、pause、余额/权限负向路径 |
| `test/LocalScenarioMatrix.t.sol` | `testWFL001ToWFL018_WaterfallL1L2TaxBufferReserveEmergencyAndInvariantPaths` | L1/L2/L3/L4 瀑布、lpLossOffsetRemaining 冲抵、reserve tap、熔断与补 reserve 恢复 |
| `test/LocalScenarioMatrix.t.sol` | `testSPC001ToSPC004_SpecialMarketsAhOuSameMatchIsolationAndExpandedLines` | AH 10 条 line 白名单、非法 line 拒绝、1X2/AH/OU 同场隔离、AH full push |
| `test/LocalScenarioMatrix.t.sol` | `testSEC001ToSEC006_IdempotencyReplayConfigBoundsAndSettlementModeLocks` | 参数上限、结算模式互斥、重复 claim、推荐 claim 重放保护 |
| `test/BatchMarketSettlement.t.sol` | 全部 11 个测试 | AH 全 line score resolver、outcome0/1 视角、full push、zero-bet finalize、batch/fuzz 边界 |

## 三、当前边界说明

- `SPC-003` 串关：当前链上没有串关合约，只保留常量口径，不作为本轮合约执行场景通过项。
- `TAX-016` `PayoutTooSmall`：在当前最小下注与最低赔率下无法从真实业务流自然触发，属于防御性分支；本轮以代码静态分支和现有最小下注/赔率约束确认，不伪造 storage。
- `BET-007` claim 时余额不足：当前真实路径会优先从 LiquidityPool payout window 拉取 gross payout；本地覆盖了低余额拉款相关路径，极端 LP payout window 不足会由底层 revert 保护。
- `WFL-012` 四层全部耗尽：当前实现直接 revert `SettlementCannotClose`，不会静默吞差额；人工补足或比例赔付仍属于后续产品决策。

## 四、验收口径

当前正常结算必须使用：

```solidity
getMarketBetIds(marketId, offset, limit)
settleMarketBetsByScore(marketId, homeScore, awayScore, betIds)
finalizeMarketSettlement(marketId, 0)
```

退款或取消必须在比赛结束后使用：

```solidity
finalizeMarketSettlement(marketId, 1) // Refunded
finalizeMarketSettlement(marketId, 2) // Cancelled
refundBets(marketId, betIds, refundAmounts)
```

AH full push 属于正常比分结算，market 终态为 `Settled`，相关 bet 可为 `Refunded`；不再存在独立 `pushRefundMarket`。
