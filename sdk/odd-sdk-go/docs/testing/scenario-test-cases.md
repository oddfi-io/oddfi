# Scenario Test Cases

Date: 2026-05-08

## 文件用途

本文档是独立的“场景测试用例清单”，方便开发、测试、审计人员直接查看每个验收场景应该怎么测。

执行结果和环境记录见：

- `docs/testing/contract-scenario-test-cases.md`
- `docs/testing/bettingpool-new-methods-e2e-results.md`
- `docs/testing/full-scenario-e2e-results.md`
- `docs/testing/validation-notes.md`
- `docs/testing/write-scenario-results.md`

## 执行分类

| 执行方式 | 说明 |
| --- | --- |
| SDK read-only e2e | 当前 SDK 仓库可直接执行，只做链上只读探活，不广播交易。 |
| Foundry contract test | 应在 `/Users/hawkwu/Desktop/odd-contract_odd` 合约仓库实现，覆盖状态变更、revert、事件、账务。 |
| SDK write e2e | 当前 SDK 仓库保存的真实上链测试，默认跳过，显式设置 `ODDFI_WRITE_E2E=1` 后广播测试网交易。 |
| SDK full match e2e | 当前 SDK 仓库保存的完整开盘、单场 LP、下注、结算、领奖、LP 解绑/提现轮询流程，默认跳过，显式设置 `ODDFI_FULL_E2E=1` 后广播测试网交易。 |
| Scope decision | 需要先冻结本轮是否交付，冻结后再转为 Foundry 测试。 |
| Out of scope | 非纯合约范围，不纳入本清单执行。 |

## SDK 已实现只读用例

| Case ID | 名称 | 步骤 | 预期 | 当前结果 |
| --- | --- | --- | --- | --- |
| SDK-E2E-001 | 四合约 proxy 只读探活 | 通过 `oddfi.NewClient` 配置四个 proxy，依次调用 ODDToken / StakingPool / LiquidityPool / BettingPool 只读方法。 | 所有调用成功，无交易广播，无私钥输入。 | PASS |
| SDK-E2E-002 | ODDToken 总量读取 | 调用 `ODDToken.TotalSupply(ctx)`。 | 返回 `*big.Int`，RPC 成功。 | PASS |
| SDK-E2E-003 | StakingPool 最小质押读取 | 调用 `StakingPool.MinStakeAmount(ctx)`。 | 返回 `*big.Int`，RPC 成功。 | PASS |
| SDK-E2E-004 | LiquidityPool 最小存入读取 | 调用 `LiquidityPool.MinDeposit(ctx)`。 | 返回 `*big.Int`，RPC 成功。 | PASS |
| SDK-E2E-005 | BettingPool 平台准备金读取 | 调用 `BettingPool.PlatformReserve(ctx)`。 | 返回 `*big.Int`，RPC 成功。 | PASS |

执行命令：

```bash
ODDFI_E2E=1 \
ODDFI_RPC_URL=<redacted> \
ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C \
ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 \
ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f \
ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F \
go test ./pkg/oddfi -run TestReadOnlyE2EAllConfiguredContracts -count=1
```

## SDK 已保存真实上链写用例

主要测试文件（对外 SDK 入口）：

- `pkg/oddfi/write_scenario_e2e_test.go`

补充测试文件（保留 adapter / binding 层验证）：

- `internal/infrastructure/contracts/write_scenario_e2e_test.go`

执行命令：

```bash
ODDFI_WRITE_E2E=1 \
ODDFI_RPC_URL=<redacted> \
ODDFI_PRIVATE_KEY=<redacted> \
ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C \
ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 \
ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f \
ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F \
go test ./pkg/oddfi -run 'TestWriteScenario.*ViaPublicSDK' -count=1 -v
```

单场景执行命令示例：

```bash
go test ./pkg/oddfi -run TestWriteScenarioODDTokenTransferViaPublicSDK -count=1 -v
go test ./pkg/oddfi -run TestWriteScenarioODDTokenApproveViaPublicSDK -count=1 -v
go test ./pkg/oddfi -run TestWriteScenarioStakingPoolStakeViaPublicSDK -count=1 -v
go test ./pkg/oddfi -run TestWriteScenarioLiquidityPoolDepositGlobalViaPublicSDK -count=1 -v
go test ./pkg/oddfi -run TestWriteScenarioBettingPoolAddPlatformReserveViaPublicSDK -count=1 -v
```

adapter / binding 层补充测试命令：

```bash
ODDFI_WRITE_E2E=1 \
ODDFI_RPC_URL=<redacted> \
ODDFI_PRIVATE_KEY=<redacted> \
ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C \
ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 \
ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f \
ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F \
go test ./internal/infrastructure/contracts -run 'TestWriteScenarioAdapter.*' -count=1 -v
```

可选参数：

| 环境变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ODDFI_SCENARIO_RECIPIENT` | sender 自己 | ODDToken transfer 收款人。 |
| `ODDFI_SCENARIO_TRANSFER_AMOUNT_WEI` | `1` | ODDToken transfer 金额，最小单位。 |
| `ODDFI_SCENARIO_APPROVE_AMOUNT_WEI` | `1` | ODDToken approve 金额，最小单位。 |
| `ODDFI_SCENARIO_STAKE_AMOUNT_WEI` | 链上 `StakingPool.minStakeAmount()` | stake 金额。 |
| `ODDFI_SCENARIO_STAKE_PLAN_ID` | `0` | stake plan id。 |
| `ODDFI_SCENARIO_LIQUIDITY_AMOUNT_WEI` | 链上 `LiquidityPool.minDeposit()` | depositGlobal 金额。 |
| `ODDFI_SCENARIO_LIQUIDITY_PLAN_ID` | `0` | liquidity plan id。 |
| `ODDFI_SCENARIO_RESERVE_AMOUNT_WEI` | `1` | `BettingPool.addPlatformReserve` 金额。 |

写测试输出内容：

- 每笔交易的 `tx_hash`；
- block number；
- gas used；
- sender BNB before / after / delta；
- sender ODD before / after / delta；
- 目标合约 ODD before / after / delta。

安全边界：

- 不调用 `grantRole`、`revokeRole`、`renounceRole`、`upgradeToAndCall`；
- 不转移 owner/admin 权限；
- 私钥只从运行时环境变量读取，不写入仓库。

| Case ID | 合约 | 方法 | 执行方式 | 输出 |
| --- | --- | --- | --- | --- |
| SDK-WRITE-ODD-001 | ODDToken | `transfer` | `TestWriteScenarioODDTokenTransferViaPublicSDK` | tx hash、gas、sender/recipient ODD、sender BNB |
| SDK-WRITE-ODD-002 | ODDToken | `approve` | `TestWriteScenarioODDTokenApproveViaPublicSDK` | tx hash、gas、allowance 相关 ODD 余额、sender BNB |
| SDK-WRITE-STK-001 | StakingPool | `stake` | `TestWriteScenarioStakingPoolStakeViaPublicSDK` | setup approve tx、stake tx、gas、sender/contract ODD 变化 |
| SDK-WRITE-LP-001 | LiquidityPool | `depositGlobal` | `TestWriteScenarioLiquidityPoolDepositGlobalViaPublicSDK` | setup approve tx、deposit tx、gas、sender/contract ODD 变化 |
| SDK-WRITE-BET-001 | BettingPool | `addPlatformReserve` | `TestWriteScenarioBettingPoolAddPlatformReserveViaPublicSDK` | setup approve tx、reserve tx、gas、sender/contract ODD 变化 |

最近一次真实上链结果见 `docs/testing/write-scenario-results.md`。

## SDK 完整比赛上链流程

主要测试文件：

- `pkg/oddfi/full_scenario_e2e_test.go`

覆盖流程：

1. 管理端 `OpenMarket` 开比赛盘；
2. LP 侧 `DepositMatch` 质押单场 LP；
3. 用户侧 `PlaceBet` 下注；
4. 管理端 `GetMarketBetIds -> SettleMarketBetsByScore -> FinalizeMarketSettlement` 结算；
5. 用户侧 `ClaimPayout` 领奖；
6. LP 侧 `RequestUnbond` 提取本金和收益第一阶段；
7. LP 侧 `Withdraw` 用户提现第二阶段。

执行命令：

```bash
ODDFI_FULL_E2E=1 \
ODDFI_RPC_URL=<redacted> \
ODDFI_PRIVATE_KEY=<redacted> \
ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C \
ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 \
ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f \
ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F \
go test ./pkg/oddfi -run TestE2EFullMatchScenario -count=1 -v -timeout 45m
```

## SDK BettingPool 新增写接口上链流程

主要测试文件：

- `pkg/oddfi/refund_methods_e2e_test.go`

覆盖流程：

1. 生成临时 bettor 地址并转入 BNB / ODD；
2. 管理端分别开 1x2 退款 market 和让球 -1 取消退款 market；
3. 管理端调用 `UpdateOdds`；
4. 用户侧分别下注；
5. 等待 `matchEndTime + 2`；
6. 管理端将 1x2 market `FinalizeMarketSettlement(resultKind=Refunded)` 后调用 `RefundBets`；
7. 管理端将让球 -1 market `FinalizeMarketSettlement(resultKind=Cancelled)` 后调用 `RefundBets`。

执行命令：

```bash
ODDFI_FULL_E2E=1 \
ODDFI_RPC_URL=<redacted> \
ODDFI_PRIVATE_KEY=<redacted> \
ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C \
ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 \
ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f \
ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F \
go test ./pkg/oddfi -run TestE2ENewBettingPoolWriteMethods -count=1 -v -timeout 25m
```

最近一次真实上链结果见 `docs/testing/bettingpool-new-methods-e2e-results.md`。

可选参数：

| 环境变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ODDFI_FULL_E2E_TOP_UP_RESERVE` | unset | 设为 `1` 时，若 `ClaimPayout` 因 BettingPool 余额不足 / payout waterfall 异常失败，测试会按缺口调用 `addPlatformReserve`，重试 claim，并继续 LP unbond / withdraw 轮询。 |
| `ODDFI_FULL_E2E_WAIT_WITHDRAW` | `10m` | Step 7 等待 LP 仓位进入 `Withdrawable` 的最长时间。 |
| `ODDFI_LP_POSITION_ID` | unset | 配合 `TestE2EWithdrawOnly`，用于稍后单独重跑 LP withdraw。 |

输出内容：

- 每笔交易的 `tx_hash`、block、`gas_used`；
- 用户 / 管理员 BNB delta；
- 用户 / 管理员 / BettingPool / LiquidityPool 的 ODD before / after / delta；
- BettingPool `platformReserve` 与 `accountedBalance`；
- LiquidityPool payout window 的 `reservedAmount / paidOutAmount / settledAt`；
- `ClaimPayout` 失败时的 shortfall 与 `Panic(0x11)` 识别结果。

最近一次完整流程结果见 `docs/testing/full-scenario-e2e-results.md`。2026-05-13 本地非广播验证已通过 `go test ./...`；真实上链测试需运行环境私密设置 RPC URL 与私钥，不能把私钥写入源码、文档或命令历史。

## ODD / 基础权限

| Case ID | 优先级 | 名称 | 执行方式 | 核心步骤 | 预期 |
| --- | --- | --- | --- | --- | --- |
| DEP-001 | P0 | 固定总量与一次性铸造 | Foundry contract test + SDK read probe | 读取 `totalSupply()`，检查初始余额，尝试产品规则外 mint 路径。 | 总量 `100,000,000e18`，部署后不增发。 |
| DEP-002 | P0 | ERC20 / BEP20 兼容最小能力集 | Foundry contract test | 验证 `transfer / transferFrom / approve / balanceOf / allowance / totalSupply`，检查旧接口不存在或不可用。 | 只保留 ERC20 + AccessControl + Pausable 能力。 |
| DEP-003 | P0 | ODD 转账不收税 | Foundry contract test | `alice -> bob`、`bob -> carol` 普通转账。 | 接收方到账等于转出金额，税池/平台无额外进账。 |
| DEP-004 | P0 | 权限边界 | Foundry contract test | 非 owner/非授权地址调用 pause/config/settle/refund。 | 全部越权调用失败。 |
| DEP-005 | P0 | pause 生效范围 | Foundry contract test | 暂停 ODD 后尝试转账、下注、领奖、推荐 claim，再恢复重试。 | 暂停期间失败，恢复后可用。 |

## 推荐关系、下注税、派奖税

| Case ID | 优先级 | 名称 | 执行方式 | 核心步骤 | 预期 |
| --- | --- | --- | --- | --- | --- |
| REF-001 | P0 | 显式绑定推荐人成功 | Foundry contract test | `alice.bindReferrer(ref1)` 后读取映射。 | 绑定成功且不可修改。 |
| REF-002 | P0 | 首次下注自动绑定推荐人 | Foundry contract test | `bob.placeBet(..., ref2)`。 | 首次下注后推荐人为 `ref2`。 |
| REF-003 | P0 | 二次绑定被拒绝 | Foundry contract test | 已绑定用户再次绑定新推荐人。 | revert `InvalidReferrerBinding()`。 |
| REF-004 | P0 | 自荐与零地址绑定被拒绝 | Foundry contract test | 绑定自己和 `address(0)`。 | 均 revert `InvalidReferrerBinding()`。 |
| REF-005 | P0 | 推荐资格与质押状态解耦 | Foundry contract test | 未质押地址作为推荐人绑定、下注、claim。 | 推荐人无需有效质押。 |
| TAX-001 | P1 | 有推荐人的下注税分配 | Foundry contract test | 已绑定推荐人下注 `1,000 ODD`。 | 税 `10 ODD` 进入推荐奖励，本金 `1,000 ODD`。 |
| TAX-002 | P1 | 无推荐人的下注税转平台 | Foundry contract test | 无推荐关系用户下注。 | 下注税进入平台金库。 |
| TAX-003 | P0 | 最小下注金额校验 | Foundry contract test | 分别下注 `<100 ODD` 和 `=100 ODD`。 | 小于最小值 revert，等于最小值进入后续校验。 |
| TAX-004 | P0 | 余额不足支付本金+税 | Foundry contract test | 余额仅 `1,000 ODD` 时下注 `1,000 ODD`。 | 因本金+税不足失败。 |
| TAX-005 | P1 | 下注税 floor 舍入 | Foundry contract test | 使用非整税额下注金额。 | 税额 floor，余数不额外发放。 |
| TAX-006 | P1 | 晚绑定影响未结算订单派奖推荐份额 | Foundry contract test | 下单后、settle 前绑定推荐人，再 claim。 | 下注税不追溯，派奖推荐份额归新推荐人。 |
| TAX-007 | P1 | 晚绑定不追溯已结算订单 | Foundry contract test | settle 后再绑定，再 claim。 | 推荐份额不归新推荐人，转平台。 |
| TAX-008 | P1 | 默认派奖税分配路径 | Foundry contract test | 胜单 `2,000 ODD` claim。 | 税 `100 ODD`，用户得 `1,900`，四项按 `40/20/20/20` 分配。 |
| TAX-009 | P1 | 无推荐人的派奖税退化路径 | Foundry contract test | 无推荐人胜单 claim。 | 推荐人份额并入平台。 |
| TAX-010 | P1 | 派奖税 settle 快照 | Foundry contract test | 订单 A settle 后改税率，再 claim；订单 B 新配置 settle/claim。 | A 用旧快照，B 用新配置。 |
| TAX-011 | P1 | 派奖税 floor 舍入与余数 | Foundry contract test | 构造非整税额 payout。 | 税额 floor，用户净到账正确，余数进入平台。 |
| TAX-012 | P1 | 推荐奖励 claim 与零余额失败 | Foundry contract test | 累积奖励，claim 两次。 | 首次成功并清账，第二次 revert `InvalidReferralClaim()`。 |
| TAX-013 | P1 | owner 修改税率、分配、金库 | Foundry contract test | owner 改下注税、派奖税、分配、treasury，再创建新订单验证。 | 新订单用新参数，历史 settle 订单不受影响。 |
| TAX-014 | P1 | 输注、退款、返本不征派奖税 | Foundry contract test | 输单、Push 退款、payout <= principal 场景。 | 不扣派奖税。 |
| TAX-015 | P2 | `payout <= principal` 兜底 | Scope decision + Foundry | 构造防御性返本订单。 | 按退款/返本处理，不产生负税。 |
| TAX-016 | P2 | 极小派彩 `PayoutTooSmall` | Scope decision + Foundry | 构造 `payout - tax == 0`。 | revert `PayoutTooSmall()`。 |
| TAX-017 | P2 | 推荐人黑名单非链上范围 | Scope decision | 为推荐人累计奖励后直接 claim。 | BettingPool 不做黑名单校验。 |

## 对赌池核心流程

| Case ID | 优先级 | 名称 | 执行方式 | 核心步骤 | 预期 |
| --- | --- | --- | --- | --- | --- |
| BET-001 | P0 | 市场开关与下注前置校验 | Foundry contract test | 创建市场，开赛前下注，开赛/关闭后再下注。 | 开盘可下注，锁定/关闭后 revert。 |
| BET-002 | P1 | placeBet 成功账本变化 | Foundry contract test | 用户下注后检查 bet、方向总额、潜在赔付、未平仓。 | bet 为 Pending，账本增加正确。 |
| BET-003 | P0 | settle 后胜负状态流转 | Foundry contract test | 双边下注后 settle。 | 胜单待 claim，输单 lost，市场关闭并记录快照。 |
| BET-004 | P0 | claimPayout 只允许 Won | Foundry contract test | 对 Pending/Lost/Refunded/Claimed 调 claim。 | 全部失败。 |
| BET-005 | P1 | claimPayout 成功终态 | Foundry contract test | Won 单 claim 后再读状态和余额。 | 用户收净派彩，状态 Claimed，不可重复。 |
| BET-006 | P1 | claim 无期限 | Foundry contract test | 胜单延迟很久再 claim。 | 仍可 claim。 |
| BET-007 | P0 | claim 时合约余额不足 | Foundry contract test | 制造余额不足后 claim，再补足重试。 | 首次失败且状态不变，补足后成功。 |
| BET-008 | P1 | BettingPool 暂停阻断 settlement | Foundry contract test | pause 后 settler 调 settle，unpause 后重试。 | 暂停期间失败，恢复后成功。 |
| BET-009 | P0 | pause 阻断 bet/claim/referralClaim | Foundry contract test | pause 后分别调用三类操作。 | 全部失败，恢复后可用。 |

## 质押

| Case ID | 优先级 | 名称 | 执行方式 | 核心步骤 | 预期 |
| --- | --- | --- | --- | --- | --- |
| STK-001 | P0 | 质押档位与最小质押量 | Foundry contract test + SDK read probe | 遍历档位，测试 `<100` 和 `=100 ODD`。 | 合法档位可质押，低于最小值失败。 |
| STK-002 | P1 | 质押成功账本变化 | Foundry contract test | 质押 `1,000 ODD @30d` 后读仓位/权重/VIP。 | 权重、解锁时间、总权重正确。 |
| STK-003 | P1 | rewardPerShare 按权重分配 | Foundry contract test | 两个用户不同权重，注入 `280 ODD`。 | 分别得 `100/180 ODD`。 |
| STK-004 | P1 | 胜单派奖税进入质押池 | Foundry contract test | 胜单 claim 后观察 StakingPool。 | 奖励金额等于 settle 快照中的质押份额。 |
| STK-005 | P1 | 到期正常赎回 | Foundry contract test | 到期后 unstake。 | 用户收本金+收益，仓位失活，总权重下降。 |
| STK-006 | P0 | 提前赎回本金返还、罚正收益 | Foundry contract test | 解锁前 earlyUnstake，测试正收益/零收益。 | 本金全返，正收益罚没。 |
| STK-007 | P1 | 提前赎回罚没分配给留存用户 | Foundry contract test | stk1 提前赎回，观察 stk2。 | 罚没按剩余权重分配。 |
| STK-008 | P1 | 所有人同时提前赎回罚没去向 | Foundry contract test | 最后活跃用户提前赎回。 | 剩余权重 0 时罚没归平台。 |
| STK-009 | P2 | 总权重 0 时奖励注入 | Scope decision + Foundry | 无活跃质押时注入奖励。 | 行为按 M4 冻结结果验收。 |
| STK-010 | P1 | VIP 等级边界 | Foundry contract test | 遍历 VIP 阈值。 | 等级即时升降且边界正确。 |
| STK-011 | P2 | StakingPool pause 对 claim 联动影响 | Scope decision + Foundry | pause StakingPool 后胜单 claim。 | 按是否解耦冻结结果验收。 |
| STK-012 | P1 | 查询接口与下注侧实时读取 | Foundry contract test | 多仓位下读 tier/active stake，赎回后重读。 | 查询与实时状态一致。 |
| STK-013 | P1 | 多仓位独立记账 | Foundry contract test | 同一用户不同时间/档位多仓位，中间奖励注入。 | rewardDebt、收益、解锁时间独立。 |
| STK-014 | P1 | 到期赎回余额不足 | Foundry contract test | 制造池余额不足后 unstake。 | 不静默少付，仓位不误标记。 |
| STK-015 | P0 | pause 阻断质押主路径 | Foundry contract test | pause 后 stake/unstake/earlyUnstake。 | 暂停期间失败，恢复后可用。 |
| STK-016 | P0 | 推荐绑定不触发 stakeFor | Foundry contract test | 推荐绑定、下注税、推荐 claim 后检查质押池。 | 不自动创建质押仓位。 |
| STK-017 | P1 | 质押余额不足 | Foundry contract test | 余额低于质押金额时 stake。 | 失败且不创建仓位。 |

## 做市 LP

| Case ID | 优先级 | 名称 | 执行方式 | 核心步骤 | 预期 |
| --- | --- | --- | --- | --- | --- |
| LP-001 | P0 | 全局池档位与最小值 | Foundry contract test + SDK read probe | 遍历全局池档位，测试 `<1000` 和 `=1000 ODD`。 | 合法可存入，低于最小值失败。 |
| LP-002 | P0 | 比赛独立池存入规则 | Foundry contract test | 开赛前/后分别存入独立池。 | 开赛前成功，开赛后失败。 |
| LP-003 | P2 | 独立池乘数固定 | Scope decision + Foundry | 尝试非 1.0x 独立池参数。 | 按 H3 冻结结果验收。 |
| LP-004 | P1 | Margin 80/20 分配 | Foundry contract test | 构造 G/M 存量和 Margin。 | LP/平台、G/M 分配正确。 |
| LP-005 | P1 | 无 LP 时 Margin 进入准备金 | Foundry contract test | G+M=0 时结算有 Margin 比赛。 | LP 80% 进入 platformReserve。 |
| LP-006 | P1 | L2 亏损按 G/M 比例承担 | Foundry contract test | 构造 L1 后剩余亏损。 | G/M 按存量比例扣减。 |
| LP-007 | P1 | LP 本金归零 Liquidated | Foundry contract test | L2 应扣减 >= G+M。 | 本金不为负，仓位终态。 |
| LP-008 | P0 | requestUnbond 只允许 Ready | Foundry contract test | 未到期/已到期分别 requestUnbond。 | 未到期失败，已到期进入 Unbonding。 |
| LP-009 | P1 | Unbonding 期间 P&L 冻结 | Scope decision + Foundry | Unbonding 后再发生结算。 | 按 M3 冻结结果验收。 |
| LP-010 | P1 | withdraw 等待 2 个完整 Epoch | Foundry contract test | 不足/满足 2 epoch 分别 withdraw。 | 未到期失败，到期成功。 |
| LP-011 | P1 | withdraw 到账金额 | Foundry contract test | 构造 P&L >0/=0/<0。 | 到账金额按本金和 P&L 计算。 |
| LP-012 | P0 | 无提前退出 | Foundry contract test | 全局锁定中、独立池比赛前尝试退出。 | 全部失败。 |
| LP-013 | P1 | 多仓位并存 | Foundry contract test | 同一地址持有全局/多个独立仓位。 | 独立记账和状态流转。 |
| LP-014 | P0 | 做市状态机 | Foundry contract test | 验证状态链和终态。 | 不跳步、不回退。 |
| LP-015 | P1 | 仅全局池有存量时独享 Margin | Foundry contract test | G>0, M=0 结算有 Margin。 | 全部 LP 份额进全局池。 |
| LP-016 | P1 | 仅独立池有存量时独享 Margin | Foundry contract test | G=0, M>0 结算有 Margin。 | 全部 LP 份额进独立池。 |
| LP-017 | P1 | 单侧池承担 L2 亏损 | Foundry contract test | 分别构造 G-only 和 M-only 亏损。 | 只有有存量的一侧承担。 |
| LP-018 | P1 | 比赛结束未结算禁止独立池存入 | Foundry contract test | 比赛结束但未 settle 时 depositMatch。 | 存入失败。 |
| LP-019 | P1 | requestUnbond 不可撤销、不可重复 | Foundry contract test | requestUnbond 后取消/重复/回退。 | 全部失败。 |
| LP-020 | P0 | pause 阻断 LP 主路径 | Foundry contract test | pause 后 deposit/requestUnbond/withdraw。 | 暂停期间失败，恢复后可用。 |
| LP-021 | P1 | Active -> Ready 到期切换 | Foundry contract test | 解锁前后读状态。 | 解锁前 Active，解锁后 Ready。 |
| LP-022 | P1 | LP 存入余额不足 | Foundry contract test | 余额低于存入金额时 deposit。 | 失败且不生成仓位。 |
| LP-023 | P2 | 非 UTC 部署首个 Epoch 边界 | Scope decision + Foundry | 非 UTC 00:00 部署后走 unbond/withdraw。 | 判定自洽或按修复目标通过。 |
| LP-024 | P1 | 展示乘数不参与 P&L | Foundry contract test | 相同本金不同档位，结算正/负 P&L。 | 实际 P&L 相同。 |

## 准备金瀑布

| Case ID | 优先级 | 名称 | 执行方式 | 核心步骤 | 预期 |
| --- | --- | --- | --- | --- | --- |
| WFL-001 | P0 | 仅使用 L1 | Foundry contract test | payout <= loser stakes。 | 不动 L2/L3/L4。 |
| WFL-002 | P1 | L1 后进入 L2 | Foundry contract test | 构造 L1 后仍有缺口且 G+M>0。 | L2 扣减，lpDeficit 增加。 |
| WFL-003 | P1 | L2 为 0 时跳到 L3 | Foundry contract test | G+M=0, taxBuffer>0。 | 直接扣 L3，lpDeficit 不变。 |
| WFL-004 | P1 | taxBuffer 覆盖 L3 缺口 | Foundry contract test | L2 后缺口且 L3 足够。 | taxBuffer 减少，不触发 L4。 |
| WFL-005 | P0 | L4 动用并触发事件 | Foundry contract test | L2/L3 后仍有缺口。 | platformReserve 扣减，触发 `ReserveTapped`。 |
| WFL-006 | P1 | 阶梯阈值告警 | Foundry contract test | reserve 从 15M 扣到 14.75M。 | 跨越档位事件正确。 |
| WFL-007 | P0 | emergency floor 熔断 | Foundry contract test | reserve <= 100k 后新下注和历史结算。 | 新下注暂停，历史订单仍可处理。 |
| WFL-008 | P1 | addPlatformReserve 恢复 | Foundry contract test | 熔断后补 reserve 并手动恢复。 | 余额恢复不自动恢复接单，需管理员动作。 |
| WFL-009 | P1 | 补足优先级 | Foundry contract test | lpDeficit/taxBuffer/reserve 同时可补。 | 先补 lpDeficit，再 taxBuffer，再 reserve。 |
| WFL-010 | P1 | taxBuffer 满后溢出进 reserve | Foundry contract test | taxBuffer 接近 cap 时注入。 | cap 满，溢出进入 reserve。 |
| WFL-011 | P0 | 非法外部转账不计入 reserve | Foundry contract test | 非管理员转 ODD 到 BettingPool。 | 余额增加但 platformReserve 不增加。 |
| WFL-012 | P0 | 四层全部耗尽 | Foundry contract test | 构造 L1-L4 后仍缺口。 | 不静默吞差额，留下可追踪状态。 |
| WFL-013 | P0 | taxBuffer/lpDeficit 异常值保护 | Foundry contract test | 尝试异常减少 taxBuffer 或负 deficit。 | 阻止异常状态。 |
| WFL-014 | P1 | taxBuffer=0 直接进入 L4 | Foundry contract test | L2 后缺口且 L3=0。 | 直接扣 reserve，事件正确。 |
| WFL-015 | P1 | 阶梯告警去重/重触发 | Foundry contract test | 跌破、同档内再扣、补足后再跌破。 | 同档不重复，补足后可重触发。 |
| WFL-016 | P1 | reserve 可高于初始常量 | Foundry contract test | 协议内路径提高 reserve 超过 15M。 | 不截断。 |
| WFL-017 | P1 | 初始 reserve 未注入空仓 | Foundry contract test | 未 add reserve 时触发 L4。 | 等价 reserve 耗尽，不假定隐式余额。 |
| WFL-018 | P1 | lpDeficit 回补不追溯已赎回 LP | Foundry contract test | deficit 后部分 LP 赎回，再注入补足。 | 只回补当前池中 LP。 |

## 特殊市场

| Case ID | 优先级 | 名称 | 执行方式 | 核心步骤 | 预期 |
| --- | --- | --- | --- | --- | --- |
| SPC-001 | P1 | 让球 -1 Push 退款 | Scope decision + Foundry | 让球 -1 恰好赢 1 球。 | 双边原额退款，订单 Refunded。 |
| SPC-002 | P1 | 半球线不存在 Push | Foundry contract test | -0.5/-1.5/大小球半球线结算。 | 不触发 Push，只判胜负。 |
| SPC-003 | P2 | 串关限制 | Scope decision + Foundry | 同场、腿数、总赔率、最高赔付。 | 有串关合约时执行，否则延期。 |
| SPC-004 | P1 | Push 不污染同场其他市场 | Scope decision + Foundry | 同场多市场，只一个 Push。 | 仅目标盘口退款。 |

## 暂停、安全、回归

| Case ID | 优先级 | 名称 | 执行方式 | 核心步骤 | 预期 |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | P1 | pause 不篡改历史订单 | Foundry contract test | 创建订单后 pause 再读取。 | 历史状态不变。 |
| SEC-002 | P1 | 熔断只暂停新接单 | Foundry contract test | emergency floor 后处理历史订单。 | 已接订单仍可结算。 |
| SEC-003 | P0 | claimPayout 幂等与重放保护 | Foundry contract test | 同一胜单连续 claim 两次。 | 首次成功，第二次失败。 |
| SEC-004 | P0 | referralClaim 幂等与重放保护 | Foundry contract test | 推荐奖励连续 claim 两次。 | 第二次失败，不重复提取。 |
| SEC-005 | P0 | 参数修改上限保护 | Foundry contract test | 设置超限税率/比例不匹配。 | 全部失败。 |
| SEC-006 | P1 | 最小/最大参数边界回归 | Foundry contract test | 覆盖最小下注、最小质押、最小 LP、税率上限、cap/floor。 | 每个边界行为明确可复现。 |

## 非合约范围

以下能力不写入纯合约测试：

- 外部赔率源拉取与对比；
- Redis / WebSocket / 前端弹窗；
- 人工审核队列 / 运营值班 / 告警送达；
- 多签钱包实现 / 多签审批流程本身；
- Telegram / PagerDuty / 后端排队缓存。
