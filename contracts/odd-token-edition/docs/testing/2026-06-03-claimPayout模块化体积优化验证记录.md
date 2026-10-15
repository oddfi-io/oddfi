# claimPayout 模块化体积优化验证记录

**日期：** 2026-06-03
**范围：** `BettingPool.claimPayout` wrapper 化、派奖税分发迁入 `BettingSettlementModule`
**结论：** 本地构建、非 fork 回归与 BSC fork 回归通过，`BettingPool` runtime margin 从 `311 B` 提升到 `2,081 B`。

## 1. 变更范围

- `BettingPool.claimPayout(bytes32)` 保留为 `nonReentrant + whenNotPaused` wrapper。
- `BettingSettlementModule.claimPayout(bytes32)` 承接：
  - bet owner 校验；
  - `WonUnclaimed` / `WonClaimed` / market `Settled` 状态校验；
  - gross payout、派奖税和 net payout 计算；
  - BettingPool 余额不足时向 LiquidityPool 拉取 payout liquidity；
  - `WonClaimed` 终态写入；
  - `_distributePayoutTax` 与 `_injectTaxBuffer`；
  - 用户净赔付转账和事件。
- `BettingPool` 删除迁移后未再使用的 `_applyRefundRiskRollback(...)` 内部函数；模块内同名函数仍由 `refundBets(...)` 使用。

## 2. 构建结果

```bash
forge fmt --check src/modules/betting/BettingPool.sol src/modules/betting/BettingSettlementModule.sol src/modules/betting/interfaces/IBettingSettlementModule.sol
```

结果：通过。

```bash
forge build --sizes --skip test
```

结果：通过。

- `BettingPool` runtime size：`22,495 B`
- `BettingPool` runtime margin：`2,081 B`
- `BettingSettlementModule` runtime size：`14,023 B`
- `BettingSettlementModule` runtime margin：`10,553 B`

## 3. 回归测试

```bash
forge test --no-match-path 'test/Fork*' -vv
```

结果：通过，`46 passed, 0 failed, 0 skipped`。

重点覆盖：

- `StakingPausedClaimPayout.t.sol`
- `LocalScenarioMatrix.t.sol`
- `CashOut.t.sol`，11 passed，含 256 次 fuzz
- `BatchMarketSettlement.t.sol`，含 AH score settlement fuzz

```bash
MAINNET_FORK_RPC_URL=https://bsc-dataseed.binance.org forge test --match-path 'test/Fork*' -vv
```

结果：通过，`37 passed, 0 failed, 0 skipped`。

重点覆盖：

- `ForkMainnetFunds.t.sol` 中 claimPayout、payout liquidity、派奖税与推荐奖励路径
- `ForkMainnetCoverageEdgesBettingFunds.t.sol` 中 L2 payout、active staker tax、zero payout tax 路径
- `ForkMainnetUpgrade.t.sol` 中 fork upgrade 状态保全

```bash
npm --prefix skills run typecheck
```

结果：通过。

## 4. Slither

```bash
uvx --from slither-analyzer slither . --filter-paths 'lib|test|script' --json /tmp/slither-odd-claimpayout-module-20260603-after-deadcode.json
```

结果：已执行，Slither 因告警以非 0 退出；JSON 输出：`/tmp/slither-odd-claimpayout-module-20260603-after-deadcode.json`。

本轮共 `119 result(s)`；迁移后遗留的 `BettingPool._applyRefundRiskRollback` dead-code 告警已消失。

主要分类与处理口径：

- `controlled-delegatecall / low-level-calls / assembly`：来自 `BettingPool._delegateToSettlement(...)` 的模块化路由；`settlementModule` 由受限管理接口配置，且目标入口均有 `onlyDelegateCall`。
- `uninitialized-state / unused-state / constable-states`：来自 `BettingSettlementModule` 继承 `BettingPoolStorage` 但只通过 delegatecall 读取主合约 storage；初始化由 `BettingPool.initialize(...)` 完成。
- `reentrancy-no-eth / reentrancy-events`：`claimPayout` 在模块内会调用 `LiquidityPool.requestPayoutLiquidity(...)` 与 `StakingPool.notifyReward(...)`；外层 `BettingPool.claimPayout(...)` 保持 `nonReentrant + whenNotPaused`，模块入口仅允许 delegatecall，且 bet 在外部调用前已写入 `WonClaimed` 终态。本轮非 fork 与 fork 资金流测试均已覆盖该路径。
- `timestamp / incorrect-equality / divide-before-multiply`：来自比赛时间窗、Cash Out quote TTL、日限额 bucket、赔率 tick 归一化与业务比例计算，符合当前产品规则。
- `calls-loop / costly-loop`：来自批量结算/退款的有界数组处理，仍受 `FINALIZE_BATCH_HARD_CAP` 与 `REFUND_BATCH_DEFAULT` 限制。
