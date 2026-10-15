# 2026-06-05 BSC Testnet Full Validation Report

## 结论

- 当前 BSC Testnet 部署功能验收通过：下注、结算、Cash Out、派奖、Global/Match LP 存入、Match LP requestUnbond、质押与提前退出均已执行或验证。
- 当前 implementation/module/library 的 BscScan/Etherscan V2 源码验证状态均为 `verified=true`。
- 本轮未发现新的合约功能性失败。
- 需要改进的测试脚本问题：`script/bsc_testnet_full_flow_report.py` 的临时 `lpUser` 私钥不持久化，导致脚本结束后无法对已变为 `Withdrawable` 的 position 35 继续签名 `withdraw`。本轮已验证 `depositMatch -> requestUnbond -> 10 分钟后 withdraw 未成熟守卫`，并读链确认 position 35 后续 `effectiveState=Withdrawable`；实际提款应改成确定性测试账户后补跑。

## 环境

- chain: BSC Testnet
- chainId: `97`
- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- admin/deployer: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- ODDToken proxy: `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0`
- StakingPool proxy: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
- LiquidityPool proxy: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
- BettingPool proxy: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
- BettingSettlementModule: `0x120D754E3BD8aE9ba2fe27Fbd423f6B4C392f07d`

## 本地与 Fork 验证

- `forge build --sizes --skip test`：通过；`BettingPool` runtime size `22,495 B`，runtime margin `2,081 B`。
- `NO_PROXY='*' HTTP_PROXY='' HTTPS_PROXY='' ALL_PROXY='' forge test --offline --no-match-path 'test/Fork*' -vv`：通过，`46 passed / 0 failed`。
- `MAINNET_FORK_RPC_URL=https://bsc-dataseed.binance.org forge test --match-path 'test/Fork*' -vv`：通过，`37 passed / 0 failed`。
- `npm --prefix skills run typecheck`：通过。
- `RPC_URL=<BSC_TESTNET_RPC> npm --prefix skills run healthcheck`：通过；当前 implementation 与 `settlementModule()` 读链一致。

## Testnet 写入验收

- `BscTestnetSmoke`：通过。真实执行 `approve -> stake -> depositGlobal -> openMarket -> previewSignal -> placeBet`。
  - stakePositionId: `15`
  - lpPositionId: `30`
  - betId: `0x0000000000000000000000000000000000000000000000000000000000000199`
- `script/bsc_testnet_scenario_report.py`：通过。
  - 报告：`docs/testing/2026-06-03-bsc-testnet-cashout-upgrade-scenario-report.md`
  - 覆盖：ODD 转账、质押、Global LP、下注、score-based 结算、派奖、推荐奖励领取、push/refund。
- `script/bsc_testnet_cashout_report.py`：通过，`27 passed / 0 failed`。
  - 报告：`docs/testing/2026-06-03-bsc-testnet-cashout-upgrade-20260605-full-validation.md`
  - 覆盖：未锁盘 Cash Out 成功、`lockMarket` 后 Cash Out `eth_call` 与真实交易失败、赛后结算、胜单 `claimPayout`。
- `script/bsc_testnet_full_flow_report.py`：通过，`18 passed / 0 failed`。
  - 报告：`docs/testing/2026-06-03-bsc-testnet-cashout-upgrade-full-flow-report.md`
  - 覆盖：Match LP 存入、下注、等待比赛结束、`settleMarketBetsByScore`、`finalizeMarketSettlement`、`claimPayout`、`requestUnbond`、10 分钟后 `withdraw` 未成熟守卫。
- `script/bsc_testnet_line_matrix_report.py`：执行到 OU 3.5 over 后遇到 RPC `RemoteDisconnected`，不是合约 revert；随后用恢复脚本按已上链 `OPEN_*` 交易恢复剩余 market。
  - 恢复报告：`docs/testing/2026-06-05-bsc-testnet-line-matrix-recovery-report.md`
  - 覆盖：`19 scenarios / 41 bets / 17 claims / 77 checks passed / 0 failed`
  - 范围：1X2 主胜/平/客胜，OU `1.5/2.5/3.5` over/under，AH `-0.5/-1/-1.5/-0.25/-0.75/-1.25/+0/+0.25/+0.5/+0.75` 的 full win/full loss/push/half win/half loss 代表路径。
- `StakingPool.earlyUnstake(15)`：通过。
  - tx: `0x60d0d5756918cbdf0856e13c4b03c4332c95f83d290b712b3dd98d377b95834a`
  - position 15 复查：`active=false`。

## 源码验证状态

BscScan/Etherscan V2 `getsourcecode` 查询结果均为 `verified=True`：

- `ODDToken` implementation `0xa9ab02067b8c9438a340895c4c6427a252bb0d2a`
- `StakingPool` implementation `0xcf21808c6570ac42381fefaac1af671cdb38068e`
- `LiquidityPool` implementation `0xfceb5de290f08138ae857570b93d95e619cab130`
- `BettingPool` implementation `0x5f5d0fe6ee8a9eb4be6bfae43ab18c293e6a2b6b`
- `BettingSettlementModule` `0x120d754e3bd8ae9ba2fe27fbd423f6b4c392f07d`
- `BettingOddsLib` `0xde24f32de089540e95e453f969663e516dc4bc0e`
- `BettingReferralLib` `0xdae82a79fcb16a7627d48b318498bbd8d4e5a512`
- `BettingValidationLib` `0xf8c83078d2a5fe0c3075b83afb6341797bd6d5be`

## 需跟进

- 改造 `script/bsc_testnet_full_flow_report.py`：将 `bettor/lpUser/sink` 改为从 admin key 派生的确定性账户，避免 LP position 到达 `Withdrawable` 后无法继续签名 `withdraw`。
- 如要“实际提款”也纳入每轮自动验收，应单独设计一个可跨 epoch 复用的 deterministic LP 账户和 position 追踪文件。
