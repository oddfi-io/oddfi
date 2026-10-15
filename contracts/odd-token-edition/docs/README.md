# 文档索引

当前 `docs/` 已按**当前代码实现**收敛，旧的历史实施文档、测试记录和静态部署记录已做精简。2026-06-12 已完成 ODDToken 锁仓与发售 MVP 在 BSC Testnet 的全量新部署和真实链上验收；同日已保持 `HouseVault / BettingPool` proxy 不变完成 HouseVault 到 BettingPool L4 兜底注资小升级，并完成赔率 V3 line module 升级。2026-06-13 当前源码已将 `PrecisionConstants.SECONDS_PER_DAY` 从测试加速值 `3600` 恢复为自然日 `86400`，并将 Staking `7 / 30 / 60 / 90 / 180 / 360` 天、Global LP `7 / 14 / 28 / 60 / 90` 天档位恢复为产品文档口径；同日已完成普通单注与串关结算 `netLoss` hotfix，结算瀑布只按 `grossPayout - (fundingBase - totalMargin)` 的真实缺口入账，避免冷启动无 LP 时虚扣 `platformReserve`，且已发布到 BSC Testnet；同日已完成 BSC Mainnet 全量部署、BscScan 源码验证和链上权限/接线验收，部署记录见 `docs/deployment/bsc-mainnet-current.json`。当前测试网集成以 `docs/deployment/bsc-testnet-current.json`、`docs/development/api.md` 和 `skills/references/contracts.json` 登记的新 proxy/module 地址为准。当前 BSC Mainnet 核心 proxy 为 `ODDToken=0x3e130563e069c414F0a18863966c211aA5D518F9`、`TierSale=0x6FF56E20308647868811089906687fB7706d6517`、`HouseVault=0x5f67Cf50c01b6528f5fA841475806061bD0E16cD`、`DexLaunchController=0x7208e06B6DF913D59851E36d15585E0Ec9a4c22F`、`DexLpLocker=0xbB09DcCcE850371C58d784Bc652049DcE7F6Fe5C`、`EcosystemRewards=0x71f0C250E8F9ce43626822DE118Bc07fbb72cDA4`、`StakingPool=0x837BEB9C2Cd6B45af68CD62009d874569584DDcA`、`LiquidityPool=0x55419B1529b89FE3C72BdC3062515f431a63F06A`、`BettingPool=0x875D0CA32A74663E42a20d0C2b7E252b5A3121cA`。成熟质押提现和 LP 最终 withdraw 仍受协议锁定/解绑 epoch 约束，需要到期后再执行。

使用顺序建议：

1. `docs/progress/当前开发现状.md`
2. `docs/architecture/oddfi-mvp-总体架构.md`
3. `docs/architecture/solidity-ddd-mapping.md`
4. `docs/architecture/2026-04-23-BettingSettlementModule-架构方案.md`
5. `docs/development/api.md`
6. `docs/development/2026-06-13-结算缺口计算Hotfix方案.md`
7. `docs/research/2026-05-24-AH扩盘口最小改造调研.md`
8. `docs/product/赔率_规则设计_V3.md`
9. `docs/development/2026-06-12-赔率V3新增line最小实现方案.md`
10. `docs/development/2026-05-28-赔率V2-WCL落地实施计划.md`
11. `docs/development/2026-05-24-AH扩盘口比分结算实施方案.md`
12. `docs/development/2026-06-02-手动封锁市场实施方案.md`
13. `docs/product/OddFi-CashOut规则与计算公式-v1.1.md`
14. `docs/research/2026-06-03-CashOut最小实现调研.md`
15. `docs/development/2026-06-03-CashOut最小实现方案.md`
16. `docs/development/2026-06-06-串关MVP实施方案.md`
17. `docs/development/2026-06-08-BettingPool模块化入口壳实施方案.md`
18. `docs/development/2026-04-22-当前代码总览.md`
19. `docs/development/2026-04-23-BettingSettlementModule-实施方案.md`
20. 按模块阅读对应 `docs/development/2026-04-22-*-当前实现.md`

部署与升级统一以仓库脚本和 `docs/deployment/` 的最新部署记录为准：

- `script/DeployBscTestnet.s.sol`
- `script/DeployAll.s.sol`
- `script/BscTestnetSmoke.s.sol`
- `script/BscTestnetScenarios.s.sol`
- `script/BscTestnetUpgradeAndValidate.s.sol`
- `script/BscTestnetUpgradeExistingOnly.s.sol`
- `script/BscTestnetParlayUpgrade.s.sol`
- `script/BscTestnetOddsV3LineUpgrade.s.sol`
- `script/BscTestnetOddsV3LineValidation.s.sol`
- `script/BscTestnetSettlementNetLossHotfixUpgrade.s.sol`
- `script/MainnetForkScenarioReport.s.sol`
- `script/MainnetForkValidation.s.sol`
- `script/bsc_testnet_scenario_report.py`
- `script/bsc_testnet_parlay_report.py`
- `script/deploy_and_verify.sh`
- `script/deploy_and_verify_bsc_testnet.sh`
- `script/upgrade_all_contracts.sh`

## 当前目录结构

```text
docs/
├── README.md
├── architecture/
├── deployment/
├── development/
├── product/
├── progress/
├── research/
└── testing/
```

## architecture/

当前保留的架构文档：

- `docs/architecture/oddfi-mvp-总体架构.md`：AH 扩盘口目标系统架构、资金流、权限边界
- `docs/architecture/2026-06-12-ODDToken锁仓与发售MVP架构补充.md`：ODDToken 锁仓、发售、来源账本和业务入口边界补充设计
- `docs/architecture/solidity-ddd-mapping.md`：模块边界、owner 边界、跨模块调用约束
- `docs/architecture/2026-04-23-BettingSettlementModule-架构方案.md`：`BettingPool + BettingSettlementModule` 模块化与 score-based 结算路由方案
- `docs/architecture/2026-04-20-mermaid-架构图与业务流程图.md`：AH 扩盘口目标结构图和核心流程图

## development/

当前保留的开发文档中，AH 扩盘口相关文档已同步到当前 Solidity 实现：

- `docs/development/api.md`
- `docs/development/2026-06-13-结算缺口计算Hotfix方案.md`：普通单注与串关结算 `netLoss` hotfix 方案与实施记录；详细记录测试反馈、冷启动无 LP 复现、普通单注和串关两条错误路径、最小修复公式、LP payout window 安全性证明、代码落点与验证矩阵；当前源码已应用并通过本地验收
- `docs/development/2026-06-12-赔率V3新增line最小实现方案.md`：赔率 V3 新增 AH/OU line 的最小实现方案、本地实施结果与 BSC Testnet 发布状态；只追加 line 编码、line count 和 score-based resolver，不改 ABI 与 storage layout
- `docs/development/2026-05-28-赔率V2-WCL落地实施计划.md`
- `docs/development/2026-05-24-AH扩盘口比分结算实施方案.md`
- `docs/development/2026-06-02-手动封锁市场实施方案.md`
- `docs/development/2026-06-03-CashOut最小实现方案.md`：Cash Out 最小实现方案与本地实施结果
- `docs/development/2026-06-06-串关MVP实施方案.md`：串关 MVP 实施方案与本地实现结果，采用 `BettingPool + BettingParlayModule(delegatecall)` 兼容现有资金和风控体系
- `docs/development/2026-06-08-BettingPool模块化入口壳实施方案.md`：`BettingPool` 模块化入口壳实施方案，新增 bet/market/referral 三个 delegatecall module，并将 4 个查询接口暴露回 `BettingPool` ABI
- `docs/development/2026-06-12-ODDToken锁仓与发售MVP实施方案.md`：ODDToken 锁仓/发售 MVP 开发中实施方案；Token、配套合约、LP NFT locker 和既有业务最小接入主干已本地实现
- `docs/development/2026-04-22-当前代码总览.md`
- `docs/development/2026-04-23-BettingSettlementModule-实施方案.md`
- `docs/development/2026-04-22-Shared-当前实现.md`
- `docs/development/2026-04-22-ODDToken-当前实现.md`
- `docs/development/2026-04-22-StakingPool-当前实现.md`
- `docs/development/2026-04-22-LiquidityPool-当前实现.md`
- `docs/development/2026-04-22-BettingPool-当前实现.md`

## research/

- `docs/research/2026-05-24-AH扩盘口最小改造调研.md`：AH 扩盘口、score-based 结算和旧结算接口删除的基准调研
- `docs/research/2026-06-03-CashOut最小实现调研.md`：Cash Out 最小实现调研，明确 `Locked` market 不允许提前撤出

## deployment/

当前保留最新 BSC Testnet 与 BSC Mainnet 全量部署记录：

- `docs/deployment/bsc-testnet-current.json`
- `docs/deployment/bsc-mainnet-current.json`

## testing/

当前测试文档保留：

- `docs/testing/合约场景测试文档.md`
- `docs/testing/2026-05-28-赔率V2-WCL落地测试记录.md`
- `docs/testing/2026-04-24-bsc-mainnet-fork-场景测试执行记录.md`
- `docs/testing/2026-05-01-bsc-testnet-循环验收记录.md`
- `docs/testing/2026-05-13-bsc-testnet-full-flow-report.md`
- `docs/testing/2026-05-24-local-scenario-matrix-report.md`
- `docs/testing/2026-05-25-bsc-testnet-upgrade-and-scenario-report.md`
- `docs/testing/2026-06-01-bsc-testnet-full-redeploy-scenario-report.md`
- `docs/testing/2026-06-01-bsc-testnet-full-redeploy-full-flow-report.md`
- `docs/testing/2026-06-01-bsc-testnet-line-matrix-report.md`
- `docs/testing/2026-06-02-手动封锁市场本地验证记录.md`
- `docs/testing/2026-06-02-bsc-testnet-manual-lock-upgrade-scenario-report.md`
- `docs/testing/2026-06-02-bsc-testnet-manual-lock-upgrade-full-flow-report.md`
- `docs/testing/2026-06-02-bsc-testnet-manual-lock-upgrade-line-matrix-report.md`
- `docs/testing/2026-06-03-CashOut产品文档对抗性验证.md`
- `docs/testing/2026-06-03-CashOut本地验证记录.md`
- `docs/testing/2026-06-03-claimPayout模块化体积优化验证记录.md`
- `docs/testing/2026-06-03-bsc-testnet-cashout-upgrade-report.md`
- `docs/testing/2026-06-03-bsc-testnet-cashout-upgrade-current-run.md`
- `docs/testing/2026-06-06-串关MVP本地验证记录.md`
- `docs/testing/2026-06-06-串关与普通下注资金流本地验证记录.md`
- `docs/testing/2026-06-06-端到端资金链路本地验证记录.md`
- `docs/testing/2026-06-07-bsc-testnet-parlay-upgrade-full-flow-report.md`
- `docs/testing/2026-06-07-bsc-testnet-parlay-upgrade-cashout-report.md`
- `docs/testing/2026-06-07-bsc-testnet-parlay-upgrade-current-run.md`
- `docs/testing/2026-06-07-bsc-testnet-parlay-upgrade-line-matrix-report.md`
- `docs/testing/2026-06-12-ODDToken锁仓与发售MVP全量场景测试方案.md`
- `docs/testing/2026-06-12-ODDToken锁仓与发售MVP本地验证记录.md`
- `docs/testing/2026-06-12-ODDToken锁仓与发售MVP-docx场景验收文档.md`
- `docs/testing/2026-06-12-bsc-testnet-HouseVault-L4-upgrade-validation.md`
- `docs/testing/2026-06-12-赔率V3新增line本地验证记录.md`
- `docs/testing/2026-06-12-bsc-testnet-赔率V3新增line升级验证报告.md`
- `docs/testing/2026-06-13-结算缺口计算Hotfix本地验证记录.md`
- `docs/testing/2026-05-24-security-audit-triage.md`
- `docs/testing/2026-05-24-security-audit-change-summary.md`

说明：

- 旧 BSC Testnet 测试报告和旧部署地址记录已删除；
- 当前脚本操作地址以 `docs/development/api.md`、仓库 `script/` 和 `docs/deployment/bsc-testnet-current.json` 为准。
- 当前本地正反场景验收以 `2026-05-24-local-scenario-matrix-report.md` 为准；历史 fork/testnet 报告只代表当时 ABI。

## progress/

- `docs/progress/当前开发现状.md`：当前代码、文档、测试的最新统一状态

## product/

保留产品规则和产品清单，作为业务基线参考。

- `docs/product/ODD代币合约需求文档.docx`：ODDToken 锁仓、发售、DEX 建池、奖励、业务回款拆分和治理权限产品基线
- `docs/product/赔率_规则设计_V3.md`：赔率 V3 line 产品规则；当前已本地实现并发布到 BSC Testnet，明确保留已有 line，并新增 AH `-1.75/-2/-3` 与 OU `0/0.5/1/1.75/2/2.25/2.75/3`
- `docs/product/OddFi-CashOut规则与计算公式-v1.1.md`：Cash Out 产品规则与计算公式；当前 Solidity 与 BSC Testnet ABI 已包含该入口，`2026-06-03-bsc-testnet-cashout-upgrade-current-run.md` 已验证未锁盘 Cash Out、锁盘后失败、赛后结算和 claimPayout 均通过

## 维护规则

- 已实现行为以当前代码为事实源；新需求按流程先同步目标文档，再改代码
- 新的实现变更必须同步更新 `docs/progress/当前开发现状.md`
- 架构边界变化先改 `docs/architecture/`
- API 变化同步改 `docs/development/api.md`
- 模块行为变化同步改对应模块实现文档
