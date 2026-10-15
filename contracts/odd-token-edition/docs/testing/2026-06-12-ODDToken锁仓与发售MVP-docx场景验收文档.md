# ODDToken 锁仓与发售 MVP docx 场景验收文档

**日期：** 2026-06-12
**产品基线：** `docs/product/ODD代币合约需求文档.docx`
**实现基线：** 当前 `src/`、`script/`、`test/` 与 `docs/progress/当前开发现状.md`
**验收轮次：** 2 轮，本地 + BNB mainnet fork
**状态：** 两轮场景验收均通过；BSC Testnet live 与第三方审计不在本轮通过口径内

## 1. 验收边界

本文件把产品 docx 中的强制需求拆成可执行场景，并绑定到当前 Foundry 测试、BNB mainnet fork 测试与 fork 脚本。验收目标是确认：

- `ODDToken` 固定总量、初始化、五类分配、来源账本、锁仓/可转余额、burn、pause 和业务扩展接口满足产品要求；
- `TierSale / DexLaunchController / DexLpLocker / EcosystemRewards / HouseVault` 覆盖销售、建池、LP NFT 锁定、奖励和独立储备边界；
- `BettingPool / StakingPool / LiquidityPool` 只做最小资金入口/出口接入，不重写现有业务状态机；
- 白名单业务入金必须有 `businessId` 与来源快照，普通 `transfer / transferFrom` 不能绕过；
- 业务出金按 `businessIn / totalBusinessOut` 计算净盈利或亏损，净盈利可转，亏损扣减来源，不误伤 DEX 可转用户；
- PancakeSwap V3 建池和推荐奖励 USDT claim 不依赖把 Router / Pool / PositionManager 加入普通白名单；
- treasury sink、HouseVault、OpsTreasury/Timelock、平台税和平台收益路径不被错误登记为用户回款。

不纳入本轮通过口径：

- BSC Testnet live 部署/升级验收；
- 第三方审计；
- Slither High/Medium 的最终审计级修复结论。本轮仅沿用既有分类豁免记录。

## 2. 执行环境与命令口径

本地验收：

```bash
forge fmt --check <本轮 Solidity / test / script 触达文件>
forge build --skip test
forge test --no-match-path 'test/ForkMainnet*' -vv
git diff --check
```

BNB mainnet fork 验收使用用户提供的 Alchemy RPC，本文按 `<redacted BNB mainnet RPC>` 脱敏。该 RPC 并发 fork 偶发 TLS EOF，因此稳定命令固定为 `--jobs 1`：

```bash
MAINNET_FORK_RPC_URL=<redacted BNB mainnet RPC> forge test --match-path 'test/ForkMainnet*.t.sol' -vv --jobs 1
forge script script/MainnetForkValidation.s.sol:MainnetForkValidationScript --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000 -vv
forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runNormalSettlementScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000
forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runPushRefundScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000
forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runReferralUsdtScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000
forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runWaterfallScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000
```

## 3. docx 条款到场景映射

| 产品条款 | 强制要求摘要 | 场景组 |
| --- | --- | --- |
| 第 2 节 | Name/Symbol/decimals、固定总量、无增发、持有人 burn、pause 停止 burn | TOK、ADV |
| 第 3 节 | 五类初始分配不得进入 EOA，初始化先 mint 到 Token 自身，部署后配置地址并一次性分配 | TOK、DEP |
| 第 4 节 | 10 档 TierSale、跨档计价、USDT 锁定、cancel/refund、forceFinalize、V3 建池 | SALE、DEX |
| 第 5 节 | 锁仓/可转余额、白名单业务入口、来源快照、净盈利可转、亏损扣减、防绕过 | LOCK、BUS、ADV、INV |
| 第 6 节 | sale 29 天阶梯解锁、reward 180 天线性解锁、OpsTreasury 48 小时 Timelock | LOCK、REW、GOV |
| 第 7 节 | HouseVault 独立储备，不接管当前赔付；业务回款本金/净盈利拆分 | HV、BUS |
| 第 8 节 | 角色、pause、事件、禁止交易税/黑名单/管理员任意转移用户余额 | GOV、ADV |
| 第 8.1-8.4 节 | ODDToken 外部方法、角色清单、全量重部署、配套合约方法 | API、DEP、SALE、DEX、REW、HV |
| 第 9 节 | 关键边界：DEX 买入不误锁、混合下注、反洗解锁、部署顺序、treasury sink | ADV、BUS、FORK |
| 第 10 节 | 已定参数与可配置项 | PARAM、DEP |

## 4. 完整场景矩阵

### 4.1 Token 初始化、分配与治理

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| TOK-001 | `initialize(adminTimelock,pauser)` | 固定总量 mint 到 `address(this)`，授予 admin/pauser 角色 | `ODDTokenPhase1` |
| TOK-002 | 禁止对外 mint | 除初始化外无增发入口 | `ODDTokenPhase1`、build ABI |
| TOK-003 | 五类 fixed sources 配置 | 非零、合约地址、只可一次性用于分配 | `ODDTokenPhase1`、`OddMvpE2E` |
| TOK-004 | `allocateInitialSupply` | 30% / 25% / 10% / 15% / 20% 一次性分配，不进 EOA | `ODDTokenPhase1` |
| TOK-005 | treasury sink 配置 | platform treasury / ops treasury 必须先登记 | `ReferralUsdtClaimConfig` |
| TOK-006 | whitelist 配置 | EOA 和 DEX restricted target 不可进入普通白名单 | `ODDTokenPhase1`、`OddMvpAdversarial` |
| TOK-007 | pause / unpause | pause 后 transfer、transferFrom、burn、业务资金流失败 | `ForkMainnetCoverageCore`、非 fork 回归 |
| TOK-008 | burn 锁定来源 | 按来源消耗顺序扣减内部账本，总量减少 | `ODDTokenSourcesFuzz` |
| TOK-009 | 事件与 view | 来源、业务快照、locked/transferable、loss/profit 可查 | `ODDTokenPhase1`、`OddMvpBusinessIntegration` |

### 4.2 TierSale 销售与取消/退款

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| SALE-001 | 未开始销售 | 购买失败，`startSale` 只允许一次 | `OddMvpSupportContracts` |
| SALE-002 | 单档购买 | USDT 计价正确，ODD 即时到账并登记 sale source | `OddMvpSupportContracts` |
| SALE-003 | 跨档购买 | 按多个档位拆分计价，一笔结算 | `OddMvpSupportContracts` |
| SALE-004 | 超过剩余量购买 | revert，不做部分成交 | `OddMvpSupportContracts` |
| SALE-005 | per-address cap 默认 0 | 默认不限制；后续可治理配置 | `OddMvpSupportContracts`、代码审查 |
| SALE-006 | cancelSale 后 refund | 用户必须交回 sale ODD，退款同步扣减 sale source | `OddMvpSupportContracts` |
| SALE-007 | 已花掉/已 burn 的 sale ODD 退款 | 只能退可交回部分或 revert，不允许管理员 clawback | `OddMvpSupportContracts`、`OddMvpScenarioMatrix` |
| SALE-008 | forceFinalize | 记录实际参与建池 USDT / ODD，进入 launch 路径 | `OddMvpE2E`、fork 脚本 |
| SALE-009 | 募资 USDT 中途提款 | 非 launch / cancel/refund 路径不得提款 | `OddMvpSupportContracts`、代码审查 |

### 4.3 DEX 建池与 LP NFT 锁定

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| DEX-001 | 满额销售后 V3 launch | 使用 Pancake V3 NonfungiblePositionManager 建池 | `OddMvpE2E`、fork 脚本 |
| DEX-002 | 非满额 forceFinalize launch | 按实际资产建池并发事件 | `OddMvpE2E`、`MainnetForkValidation` |
| DEX-003 | desired 金额不等于 TierSale approval | revert | `OddMvpSupportContracts` |
| DEX-004 | PositionManager 拉 ODD | 只允许指定 spender、指定 V3 pool、指定额度 | `ODDTokenPhase1`、`OddMvpSupportContracts` |
| DEX-005 | Router / PositionManager / Pool restricted | 不能加入普通 whitelist | `ODDTokenPhase1`、`OddMvpAdversarial` |
| DEX-006 | LP NFT 锁 12 个月 | mint 到 `DexLpLocker`，到期前不可释放 | `OddMvpSupportContracts`、`OddMvpE2E` |
| DEX-007 | LP NFT 释放地址 | 到期后只能释放到锁定 beneficiary | `OddMvpSupportContracts` |
| DEX-008 | 剩余 ODD / USDT sweep | 只能回 treasury sink | `OddMvpSupportContracts` |
| DEX-009 | `poolLaunchTime` | 只写一次，非零，不能是未来时间 | `ODDTokenPhase1`、`OddMvpE2E` |

### 4.4 解锁与来源账本

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| LOCK-001 | 建池前 sale 解锁 | 解锁比例恒为 0 | `ODDTokenPhase1` |
| LOCK-002 | sale 第 1 天 | 按 `1 / 435` 解锁 | `OddMvpScenarioMatrix` |
| LOCK-003 | sale 第 29 天后 | 100% 解锁 | `ODDTokenPhase1`、`OddMvpScenarioMatrix` |
| LOCK-004 | reward 建池前 | 解锁比例为 0 | `OddMvpScenarioMatrix` |
| LOCK-005 | reward 180 天线性 | 多笔领取共享全局曲线 | `OddMvpScenarioMatrix` |
| LOCK-006 | 可转余额普通转账 | 只允许动用当前可转额度 | `ODDTokenPhase1` |
| LOCK-007 | 锁定余额普通转账 | 超可转部分 revert | `ODDTokenPhase1`、`OddMvpScenarioMatrix` |
| LOCK-008 | 接收可转余额 | 接收方获得可转来源，不新增锁定 | `OddMvpScenarioMatrix` |
| LOCK-009 | 来源消耗顺序 | businessReturn -> sale -> reward -> transferable | `ODDTokenSourcesFuzz` |
| LOCK-010 | burn 后解锁 | 已 burn 来源不再产生未来可转额度 | `ODDTokenSourcesFuzz` |

### 4.5 白名单业务入金、回款、亏损与净盈利

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| BUS-001 | 普通 transfer 到白名单业务合约 | revert，无 orphan inflow | `OddMvpAdversarial`、`OddMvpScenarioMatrix` |
| BUS-002 | approve + transferFrom 绕过业务入口 | revert | `OddMvpAdversarial` |
| BUS-003 | 业务入口入金 | 生成全局唯一 `businessId` 和来源快照 | `OddMvpBusinessIntegration` |
| BUS-004 | 部分回款 | 按比例还原本金来源，未返还部分保留为风险来源 | `OddMvpScenarioMatrix` |
| BUS-005 | 全亏/zero-delta finalized | 确认亏损并扣减来源，不二次扣减用户余额 | `ODDTokenPhase1`、`OddMvpScenarioMatrix` |
| BUS-006 | 净盈利 | `totalBusinessOut - businessIn > 0` 的部分即时可转 | `ODDTokenPhase1`、`OddMvpBusinessIntegration` |
| BUS-007 | DEX 买入 ODD 后下注赢/退 | 本金与盈利不被重新登记为锁定 | `OddMvpScenarioMatrix`、fork funds |
| BUS-008 | 混合来源下注 | 本金按快照还原，亏损按已消耗来源扣减 | `ODDTokenSourcesFuzz`、`OddMvpBusinessIntegration` |
| BUS-009 | finalized 后重复登记 | revert | `OddMvpScenarioMatrix`、非 fork 回归 |
| BUS-010 | `businessOutDelta=0, finalized=false` | revert | `ODDTokenPhase1` |

### 4.6 Betting / Parlay / CashOut

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| BET-001 | 普通单注入金 | `consumeBusinessInflow`，提前绑定 betId | `OddMvpBusinessIntegration` |
| BET-002 | 普通单注赢单 claim | 本金还原，净盈利可转，payout 资金流闭合 | `OddMvpBusinessIntegration`、`ForkMainnetFunds` |
| BET-003 | 普通单注输单 | zero-delta finalized 或最终 loss 扣减来源 | `OddMvpBusinessIntegration` |
| BET-004 | 普通单注 push/refund | 本金来源恢复，风险账本回滚 | `ForkMainnetFunds`、`MainnetForkScenarioReport` |
| BET-005 | CashOut 盈利 | profit 可转，LP payout / reserve 仍按旧业务规则 | `CashOut`、非 fork 回归 |
| BET-006 | CashOut 亏损 | 亏损扣减来源，保留平台资金流 | `CashOut`、非 fork 回归 |
| BET-007 | 串关注单入金 | 串关 business snapshot，不复制锁仓算法 | `OddMvpBusinessIntegration` |
| BET-008 | 串关赢单 | 净盈利可转，最高赔付/资金占用语义不变 | `OddMvpBusinessIntegration`、`ParlayModule` |
| BET-009 | 串关退款/部分退款 | 按实际 refund delta 登记，不误算 profit/loss | `FundsFlowMatrix`、非 fork回归 |
| BET-010 | 推荐 ODD claim | 作为业务净收益，立即可转 | `OddMvpBusinessIntegration`、fork scripts |
| BET-011 | 推荐 USDT claim | 仅允许 expected V3 pool，额度一次性消耗 | `ReferralUsdtClaimConfig`、`ForkMainnetFunds`、fork scripts |

### 4.7 Staking / Liquidity

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| STK-001 | stake 混合来源 | 生成 staking position snapshot | `OddMvpBusinessIntegration` |
| STK-002 | normal unstake | 本金按原来源恢复，正收益可转 | `OddMvpBusinessIntegration`、`ForkMainnetCoverageCore` |
| STK-003 | earlyUnstake | 罚没/亏损不误锁，奖励路径保持原语义 | `ForkMainnetCoverageCore`、非 fork 回归 |
| STK-004 | platformTreasury 更新 | 必须是 treasury sink | `ReferralUsdtClaimConfig` |
| LP-001 | depositGlobal / depositMatch | 生成 LP position snapshot | `OddMvpBusinessIntegration`、`EndToEndFundsChain` |
| LP-002 | LP 正收益 withdraw | 本金还原，净盈利可转 | `OddMvpBusinessIntegration`、`ForkMainnetFunds` |
| LP-003 | LP 亏损 withdraw | 亏损扣减来源 | `LiquidityPayoutReserveInvariant`、非 fork 回归 |
| LP-004 | payout reserve residual release | 释放残留，LP accounting 闭合 | `FundsFlowMatrix`、fork scripts |

### 4.8 Rewards / HouseVault / Treasury

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| REW-001 | admin 创建 claimable | 受 `REWARD_DISTRIBUTOR_ROLE` 控制 | `OddMvpSupportContracts` |
| REW-002 | cancel claimable | 用户不能领取已取消额度 | `OddMvpSupportContracts` |
| REW-003 | 用户 claim | 登记 reward source，按 180 天曲线解锁 | `OddMvpSupportContracts`、`OddMvpScenarioMatrix` |
| REW-004 | 类别预算超 15,000,000 ODD | revert | `OddMvpSupportContracts` |
| HV-001 | HouseVault 向白名单合约划转 | 允许，不登记用户回款 | `OddMvpSupportContracts` |
| HV-002 | HouseVault 向 treasury sink 划转 | 允许 | `OddMvpSupportContracts` |
| HV-003 | HouseVault 向普通用户 / DEX target | revert | `OddMvpSupportContracts` |
| TRS-001 | 白名单业务合约 -> treasury sink | 只做平台路径，不登记用户来源 | `LocalScenarioMatrix`、非 fork 回归 |
| TRS-002 | treasury sink -> 任意地址 | Token 层视为平台可转，治理由 Timelock 保证 | `ODDTokenPhase1`、代码审查 |

### 4.9 部署 gate、升级与 fork

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| DEP-001 | proxy 构造器 initData | 不留下可抢先 initialize 窗口 | `UUPSImplementationInitializer`、`DeployAll` build |
| DEP-002 | 新业务合约引用新 ODD | 不残留旧 ODD 地址 | `ForkMainnetUpgrade`、代码审查 |
| DEP-003 | 开放 sale/bet/stake/LP 前 gate | fixed sources、whitelist、treasury sink、分配全部完成 | `DeployAll` build、fork scripts |
| DEP-004 | BNB mainnet fork chainId | 必须为 56 | `ForkMainnetValidation` |
| DEP-005 | fork 上真实 Pancake V3 referral swap | ODD -> USDT 输出成功 | `ForkMainnetFunds`、`MainnetForkScenarioReport` |
| DEP-006 | upgrade 状态保全 | 核心 storage 与权限不被破坏 | `ForkMainnetUpgrade` |

### 4.10 对抗性与 invariant

| ID | 场景 | 预期 | 覆盖 |
| --- | --- | --- | --- |
| ADV-001 | 错权限配置角色/地址 | revert | `OddMvpAdversarial`、fork coverage |
| ADV-002 | DEX target 进入 whitelist | revert | `OddMvpAdversarial` |
| ADV-003 | BusinessProfitSwap 错 router/pool/重复使用 | revert | `OddMvpAdversarial`、`ReferralUsdtClaimConfig` |
| ADV-004 | 无上限数组/循环 | 不存在或有长度上限 | 代码审查、Slither 记录 |
| ADV-005 | 涉资产入口重入 | nonReentrant 或状态先写入 | 非 fork 回归、Slither 记录 |
| INV-001 | locked source 不超过余额 | fuzz / scenario 不变量 | `ODDTokenSourcesFuzz` |
| INV-002 | `principalReturned <= businessIn` | fuzz / scenario 不变量 | `ODDTokenSourcesFuzz` |
| INV-003 | `profit/loss` 可由 `totalBusinessOut - businessIn` 复算 | fuzz / scenario 不变量 | `ODDTokenSourcesFuzz`、`OddMvpScenarioMatrix` |
| INV-004 | LP payout reserve 有余额覆盖 | invariant | `LiquidityPayoutReserveInvariant` |

## 5. 两轮验收判定规则

每轮必须满足：

1. 格式检查通过；
2. 构建通过，无 compile error；
3. 本地非 fork 回归 `96/96` 通过；
4. BNB mainnet fork suite `37/37` 通过；
5. 五个 fork 脚本场景全部通过；
6. `git diff --check` 通过；
7. 失败不得用“跳过”替代，必须修复后重跑本轮。

## 6. 两轮执行结果

| 轮次 | 命令 | 结果 |
| --- | --- | --- |
| Round 1 | `forge fmt --check <本轮触达文件>` | 通过 |
| Round 1 | `forge build --skip test` | 通过；仅输出既有 Foundry lint notes/warnings，无 compile error |
| Round 1 | `forge test --no-match-path 'test/ForkMainnet*' -vv` | 96 passed / 0 failed / 0 skipped |
| Round 1 | `MAINNET_FORK_RPC_URL=<redacted> forge test --match-path 'test/ForkMainnet*.t.sol' -vv --jobs 1` | 37 passed / 0 failed / 0 skipped |
| Round 1 | `MainnetForkValidation` + 4 个 `MainnetForkScenarioReport` 场景 | 5/5 通过：validation、normal settlement、push refund、referral USDT、waterfall |
| Round 1 | `git diff --check` | 通过 |
| Round 2 | `forge fmt --check <本轮触达文件>` | 通过 |
| Round 2 | `forge build --skip test` | 通过；仅输出既有 Foundry lint notes/warnings，无 compile error |
| Round 2 | `forge test --no-match-path 'test/ForkMainnet*' -vv` | 96 passed / 0 failed / 0 skipped |
| Round 2 | `MAINNET_FORK_RPC_URL=<redacted> forge test --match-path 'test/ForkMainnet*.t.sol' -vv --jobs 1` | 37 passed / 0 failed / 0 skipped |
| Round 2 | `MainnetForkValidation` + 4 个 `MainnetForkScenarioReport` 场景 | 5/5 通过：validation、normal settlement、push refund、referral USDT、waterfall |
| Round 2 | `git diff --check` | 通过 |

## 7. 最终验收结论

按产品 docx 拆出的本地可执行场景、BNB mainnet fork 场景和 fork 脚本场景已完成两轮验收，均通过。当前结论：

- ODDToken 锁仓/来源账本、TierSale、DexLaunchController、DexLpLocker、EcosystemRewards、HouseVault 和 Betting / Staking / Liquidity 最小业务接入满足本轮 docx 场景验收口径；
- 推荐奖励 USDT claim 已在 BNB mainnet fork 中通过 Pancake V3 真实路由验证；
- waterfall、push refund、normal settlement、staking/liquidity/funds flow 和 upgrade state preservation 均已在 fork 口径通过；
- 并发 fork 在该 RPC 上仍可能出现 TLS EOF，因此验收命令固定使用 `--jobs 1`；
- BSC Testnet live、第三方审计、Slither High/Medium 审计级最终处理仍是上线前未完成项。
