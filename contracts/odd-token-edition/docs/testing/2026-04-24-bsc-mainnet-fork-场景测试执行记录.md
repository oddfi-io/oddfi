# 2026-04-24 BSC 主网 Fork 场景测试执行记录

> 历史记录说明：本报告来自 AH 扩盘口与 score-based 结算改造之前，覆盖的是当时 ABI 下的 `settleMarket / pushRefundMarket` 路径。当前验收不再以这些旧入口为准；当前本地验收见 `2026-05-24-local-scenario-matrix-report.md`，当前 API 以 `docs/development/api.md` 为准。

## 环境
- Mainnet fork RPC: `MAINNET_FORK_RPC_URL` 环境变量
- 本地执行方式：Foundry / Anvil BSC 主网 fork
- 当前代码基线：`src/` 当前工作区代码

## 全量回归结果
- 命令：`MAINNET_FORK_RPC_URL='<BSC_MAINNET_RPC_URL>' forge test --offline`
- 结果：`35 passed, 0 failed, 0 skipped`

## 覆盖范围
- DEP / 基础权限
- 推荐关系 / 下注税 / 派奖税
- placeBet / settleMarket / claimPayout（历史旧 ABI）
- pushRefundMarket（历史旧 ABI）
- 质押 / 做市 / 瀑布
- 推荐奖励 ODD Claim / USDT Claim（真实 Pancake V3 Router）

## 当前结论
- 当时主网 fork 全量测试未发现新的功能性错误。
- 该结论只代表 2026-04-24 历史代码基线，不代表当前 AH 扩盘口版本的验收结论。

## 备注
- 本轮已开始补“逐场景交易哈希 / gas / 事件日志”版测试记录。
- 在本地 Anvil fork 上进行长链路广播采集时，BSC fork 上游 RPC 出现超时，导致广播型追踪记录未全部稳定产出。
- 合约逻辑本身未暴露新的失败案例；当前阻塞点为 fork 上游稳定性，而不是链上业务失败。
