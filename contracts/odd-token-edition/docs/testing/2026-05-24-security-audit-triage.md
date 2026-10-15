# 2026-05-24 安全审计报告筛选与处理清单

**状态：** 当前有效  
**用途：** 对 `/Users/hawkwu/Desktop/odd-contract-verify` 下两份第三方 AI 审计报告进行人工复核后的处理跟踪表。  
**基线：** 当前 `src/`、`docs/progress/当前开发现状.md`、`docs/architecture/` 与 `docs/development/`。  

## 状态枚举

| 状态 | 含义 |
|---|---|
| `TODO` | 需要处理，尚未开始 |
| `IN_PROGRESS` | 正在处理 |
| `DONE` | 已完成代码/文档/测试处理 |
| `NEEDS_DECISION` | 需要产品或治理口径先确认 |
| `REJECTED` | 拒绝作为问题处理 |

## 一、需要处理的事项

| ID | 优先级 | 状态 | 问题 | 复核结论 | 处理要求 | 主要代码/文档位置 |
|---|---|---|---|---|---|---|
| AUDIT-001 | P0 | DONE | 旧 `settleMarket` 无界遍历注单 | 真实问题，已被 AH 扩盘口改造替换为 score-based 分批结算。旧一次性结算、旧 winningOutcome 分批结算和独立 Push 退款入口均已从 ABI 删除。 | 当前只保留 `settleMarketBetsByScore` 分批处理传入 betIds，并由 `finalizeMarketSettlement(marketId,0)` 在 `processedCount == totalBetCount` 后 O(1) 收口；`finalizeMarketSettlement(marketId,1/2)` 只在赛后标记 `Refunded / Cancelled`，真实退款继续走 `refundBets` 分批。 | `src/modules/betting/BettingSettlementModule.sol`；`src/modules/betting/BettingPool.sol`；`test/BatchMarketSettlement.t.sol`；`test/LocalScenarioMatrix.t.sol` |
| AUDIT-002 | P0 | DONE | 平台 20% Margin 只计算不落账 | 真实问题，已按平台 20% Margin 留在 BettingPool 并记入 `platformReserve` 的口径修复。 | `platformMarginShare` 正常结算时增加 `platformReserve`，触发 `PlatformReserveUpdated(reason=4)`；补有 LP 权重下的 reserve 记账测试。 | `src/modules/betting/BettingSettlementModule.sol:45`；`src/modules/betting/BettingSettlementModule.sol:209`；`test/PlatformMarginReserveAccounting.t.sol` |
| AUDIT-003 | P0 | DONE | `StakingPool.pause()` 阻断胜单 `claimPayout` | 真实问题，已按最小化修改处理。派奖税分给 staking 时调用 `notifyReward`，质押模块暂停不应冻结中奖领取。 | `StakingPool.notifyReward` 移除 `whenNotPaused`，保留 `onlyBettingPool` 与 `nonReentrant`；补 paused staking 下领奖测试。 | `src/modules/betting/BettingPool.sol:456`；`src/modules/staking/StakingPool.sol:147`；`test/StakingPausedClaimPayout.t.sol` |
| AUDIT-004 | P0 | DONE | USDT 推荐奖励兑换参数未绑定 | 已修复。`claimUSDTReferralRewards` 不再接收用户传入的 `swapRouter/usdtAddress`，改用治理配置的 `referralSwapRouter/referralUsdtToken/referralSwapPoolFee`；同时以推荐人 USDT 余额前后差额作为真实到账量并校验最低到账。 | 已完成；新增恶意 router 测试，覆盖 router 虚假返回 `amountOut` 但未实际转 USDT 时必须 revert 且推荐奖励账本不被清零。 | `src/modules/betting/BettingPool.sol`；`src/modules/betting/BettingPoolStorage.sol`；`test/ReferralUsdtClaimConfig.t.sol` |
| AUDIT-005 | P1 | DONE | UUPS implementation 未禁初始化 | 已修复。审计报告关于“初始化 implementation 即接管 proxy”的影响描述过度，但 implementation 本体可被初始化确实不符合 UUPS 标准安全写法。四个 UUPS implementation 均已在构造器中调用 `_disableInitializers()`，阻止 implementation 本体被直接初始化。 | 已完成；补充 fork-free 测试覆盖四个 implementation 直接 `initialize` 均 revert，并将相关 fork-free 测试改为 proxy 初始化路径。 | `src/modules/token/ODDToken.sol`；`src/modules/staking/StakingPool.sol`；`src/modules/liquidity/LiquidityPool.sol`；`src/modules/betting/BettingPool.sol`；`test/UUPSImplementationInitializer.t.sol` |
| AUDIT-006 | P1 | DONE | 结算 wrapper 重入保护 | 已修复。旧 `settleMarket / pushRefundMarket` wrapper 已删除；当前资产相关结算入口 `settleMarketBetsByScore / finalizeMarketSettlement / refundBets` 均在 `BettingPool` wrapper 层带 `nonReentrant`。 | 已完成；同步更新架构、开发和 API 文档中的 wrapper 权限口径。 | `src/modules/betting/BettingPool.sol` |
| AUDIT-007 | P1 | REJECTED | `settlementModule` 替换边界过宽 | 拒绝作为当前漏洞。`BettingSettlementModule` 是为解决 `BettingPool` runtime size 过大而引入的既定模块化架构，后续还会继续按同类方式拆分大模块。`delegatecall` 模块确实具备写 `BettingPool` storage 的能力，但这属于模块化升级/部署治理面的既定信任边界，不是普通用户可触发的代码漏洞。 | 暂不作为漏洞修复；后续若产品要求更强治理约束，可作为统一模块治理需求设计 timelock、两步提交、模块版本或 storage layout 校验，而不是针对本次审计单点处理。 | `src/modules/betting/BettingPool.sol:165`；`src/modules/betting/BettingPool.sol:904`；`docs/architecture/2026-04-23-BettingSettlementModule-架构方案.md` |
| AUDIT-008 | P1 | DONE | `setBettingDependencies` 迁移权限过宽 | 已收紧。该函数不再支持运行期热替换 `oddToken/stakingPool/liquidityPool`；三项依赖必须均未设置时才可一次性写入，否则 revert `DependenciesAlreadyConfigured()`。代码注释明确这些地址是跨合约账本锚点，不是 UUPS implementation 地址。 | 已完成；正常 UUPS 升级继续通过 proxy upgrade 替换 implementation，不通过本函数切依赖。若未来确实需要运行期迁移依赖，应另开迁移方案并定义账本清算前置条件。 | `src/modules/betting/BettingPool.sol:84`；`src/shared/errors/ConfigErrors.sol` |
| AUDIT-009 | P1 | NEEDS_DECISION | `_waterfall` 资不抵债时直接 revert | 真实风险，但需要产品先定规则。L2/L3/L4 均不足时市场无法关闭。 | 产品确认采用人工补足、协议亏空账本、按比例赔付或其他兜底；确认后实现并补测试。 | `src/modules/betting/BettingSettlementModule.sol:224` |
| AUDIT-010 | P1 | DONE | `lpLossOffsetRemaining` 语义不闭合 | 已修复命名与文档语义。原 `lpDeficit / LpDeficitRepaid` 容易误解为平台欠 LP 的真实债务和还款；当前改为 `lpLossOffsetRemaining / LpLossOffsetApplied`，并在代码注释和文档中明确它只是派奖税缓冲份额的优先冲抵指标，不会向 LiquidityPool 转账，也不会反向恢复 LP 历史亏损。 | 已完成；后续如产品要求真实 LP 回补，应另开架构需求新增 LiquidityPool 回补接口和仓位分配规则。 | `src/modules/betting/BettingPoolStorage.sol:102`；`src/modules/betting/BettingPool.sol:462`；`src/modules/betting/BettingSettlementModule.sol:224` |
| AUDIT-011 | P1 | REJECTED | LP payout reserve 与提款隔离不足 | 拒绝作为当前漏洞。`distributeLoss` 记录 payout window 时，会同步 `requestableLiquidity -= lpLossBooked`，并通过 `lossPerPrincipal` 把该损失计入 LP 仓位价值；后续 `requestUnbond` 使用 `_activePositionValue` 计算扣损后的可解绑价值，并从 `requestableLiquidity` 中移除该扣损后价值；`withdraw` 只转出已冻结的扣损后仓位价值。因此“已预留给赢家 claim 的金额”已经在结算时从 LP 可提款价值中扣除，不会再被 LP 提走。 | 已补 invariant 测试验证 `balance >= totalOutstandingPayoutReserved` 在 margin/loss/payout/requestUnbond/withdraw 交错后仍成立。 | `src/modules/liquidity/LiquidityPool.sol:394`；`src/modules/liquidity/LiquidityPool.sol:458`；`src/modules/liquidity/LiquidityPool.sol:508`；`src/modules/liquidity/LiquidityPool.sol:539`；`src/modules/liquidity/LiquidityPool.sol:626`；`test/LiquidityPayoutReserveInvariant.t.sol` |
| AUDIT-012 | P2 | REJECTED | 赔率缺上限 | 拒绝作为当前合约漏洞。产品文档只定义了赔率来源、赔率下限 `1.01`、轻仓上浮相对上限 `Base Odds × 1.08`、串关总赔率上限 `×200` 和单账户单场最高赔付 `30,000 ODD`，没有定义普通单市场 `Base Odds` 的绝对最大值。`openMarket` 和 `updateOdds` 均受 `OPERATOR_ROLE` 控制，赔率来自 Sportmonks/后端/运营受控流程，不是普通用户可输入参数。当前合约已做下限、步长、信号灯、红灯容量、单账户潜在赔付和流动性校验；若在没有产品口径的情况下链上硬编码绝对上限，可能误挡正常开盘或正常赔率更新。 | 暂不修复；后续若产品明确普通单市场赔率绝对上限，再作为新需求实现，并同时覆盖 `openMarket` 与 `updateOdds`。 | `src/modules/betting/BettingOddsLib.sol:151`；`src/modules/betting/BettingPool.sol:184`；`src/modules/betting/BettingPool.sol:210`；`docs/product/赔率_规则设计.md`；`docs/product/对赌池_规则设计.md` |
| AUDIT-013 | P2 | DONE | `SECONDS_PER_DAY = 3600` 主网误用风险 | 原复核结论为测试阶段临时加速配置，不作为当轮审计漏洞；2026-06-13 当前源码已按上线前参数核对要求恢复为 `86400`。 | 已完成源码与当前文档同步；链上合约需通过后续升级/部署流程使用新 implementation。 | `src/shared/constants/PrecisionConstants.sol:10`；`docs/progress/当前开发现状.md`；`docs/development/api.md` |
| AUDIT-014 | P2 | DONE | 根 README 过期 | 已修复。根 README 已移除过期的 `LiquidityManager` 当前模块描述和旧文档入口，改为当前 5 个真实模块与当前保留文档索引。 | 已完成；后续若模块边界变化，继续同步根 README、`docs/README.md` 与 progress。 | `README.md`；`docs/progress/当前开发现状.md` |
| AUDIT-015 | P2 | REJECTED | 测试体系过度依赖 fork RPC | 拒绝作为审计问题。当前自动化测试依赖 fork RPC 是已记录的测试执行口径；部署后还在 BSC Testnet 做过实链 smoke、场景联调和完整流程验证，不构成合约安全问题。 | 无需作为漏洞修复；后续如要提升 CI 稳定性，可另建工程优化任务补 fork-free 本地核心单测。 | `test/ForkMainnet*.t.sol`；`docs/progress/当前开发现状.md`；`docs/testing/2026-05-13-bsc-testnet-full-flow-report.md` |

## 二、拒绝作为问题处理的事项

| ID | 状态 | 审计报告说法 | 拒绝理由 |
|---|---|---|---|
| REJECT-001 | REJECTED | 初始化 implementation 后可摧毁所有 proxy | 影响描述错误。implementation storage 与 proxy storage 不同，初始化 implementation 不能直接接管 proxy。保留 AUDIT-005 的标准禁初始化修复即可。 |
| REJECT-002 | REJECTED | `SETTLER_ROLE` 可设任意赛果是代码漏洞 | 当前架构采用中心化授权结算，这是治理/产品模型问题，不是代码缺陷。若未来要求 oracle 或挑战期，应作为新架构需求处理。 |
| REJECT-003 | REJECTED | UUPS 升级无 timelock 是合约漏洞 | 这是治理要求，不是当前代码漏洞。主网发布安全模型可要求 Safe/timelock，但不应混同为实现 bug。 |
| REJECT-004 | REJECTED | `bindReferrer` 可零下注钓鱼 | 不成立。下注有最小金额与 quote guard；只有用户调用并传入 referrer 且未绑定时才绑定。 |
| REJECT-005 | REJECTED | `claimUSDTReferralRewards` 全额清零是高危 | 当前 USDT 路径设计为全额兑换，ODD 直领路径支持部分领取。属于产品/UX 取舍，不是高危漏洞。 |
| REJECT-006 | REJECTED | 自定义 reentrancy guard 必须换 OZ | 当前状态位 guard 存在并初始化，不构成漏洞。可作为风格优化，但不是安全阻断。 |
| REJECT-007 | REJECTED | `_authorizeUpgrade` 未检查 `newImplementation.code.length` 是独立漏洞 | OZ UUPS 升级流程会做 UUPS 兼容检查。可以增强，但报告定级过高。 |
| REJECT-008 | REJECTED | `_distributePayoutTax` 先 transfer 再 `notifyReward` 会吞外部直接转账 | 不成立。`notifyReward(amount)` 只按传入 `amount` 记账，不会把额外 donation 自动计入奖励。 |
| REJECT-009 | REJECTED | `_setReservedAmount` 只累加不归零一定是 bug | 绝对化判断不成立。同一 match 多 market 共享 payout window 时累加可能是业务语义；同一 market 重复结算受 terminal 状态约束。 |
| REJECT-010 | REJECTED | `_otherOutcomeStakes` O(N) 是 Gas 风险 | outcome 数由模板限制为 2 或 3，不构成无界循环风险。 |
| REJECT-011 | REJECTED | `IBettingSettlementModule` 接口顺序不一致会 delegatecall 调错 | Solidity external call 按 selector，不按接口声明顺序。 |
| REJECT-012 | REJECTED | `forceApprove` 对 non-standard token 风险 | 当前 `oddToken` 是项目自身 ODD，不是任意可替换资产；仅作为未来迁移时的兼容注意事项。 |
| REJECT-013 | REJECTED | `notifyReward` 无 staker 时转 treasury 是漏洞 | 代码有明确分支和事件，属于产品口径，不是漏洞。 |
| REJECT-014 | REJECTED | `claimPayout` 税率 0 没短路 | 实际 `_distributePayoutTax` 已按 `taxAmount == 0 || payoutTaxRateBps == 0` 短路。 |
| REJECT-015 | REJECTED | 命名、magic number、错误码语义、`__gap` 大小偏好均按安全问题处理 | 这些最多进入重构/代码质量清单，不应按安全漏洞跟踪。 |
| REJECT-016 | REJECTED | 测试体系过度依赖外部 fork RPC，应作为审计问题修复 | 当前 fork RPC 依赖是文档化的测试执行口径；部署后已有 BSC Testnet smoke、场景联调和完整流程报告。可以作为 CI 体验优化，但不是合约安全问题。 |
| REJECT-017 | REJECTED | `SECONDS_PER_DAY = 3600` 是主网阻断漏洞 | 该数值曾是测试阶段明确要求的临时加速配置，不作为 2026-05-24 当轮审计漏洞处理；2026-06-13 当前源码已恢复为 `86400`。 |
| REJECT-018 | REJECTED | 普通单市场赔率缺少链上绝对上限 | 产品文档未定义普通单市场 `Base Odds` 绝对上限；赔率由 Sportmonks/后端/运营受控写入，并非普通用户输入。当前已有赔率下限、步长、信号灯、红灯容量、单账户潜在赔付和流动性校验。强行写死链上绝对上限可能误挡正常开盘或赔率更新；若未来产品冻结上限，再按需求实现。 |
| REJECT-019 | REJECTED | LP 提款可能拿走已预留给赢家 claim 的 payout reserve | 当前账本模型中，payout reserve 在 `distributeLoss` 时已经从 `requestableLiquidity` 与 LP 仓位价值中扣除；LP 后续解绑和提款只能拿扣损后的仓位价值，不会再拿走已预留赔付。可补 invariant 测试，但不作为漏洞修复。 |

## 三、后续处理记录

| 日期 | ID | 状态变化 | 处理说明 | 验证 |
|---|---|---|---|---|
| 2026-05-24 | ALL | 新建 | 完成两份 AI 审计报告的人工筛选，建立处理与拒绝清单。 | `forge build --offline` 通过；未执行 Slither。 |
| 2026-05-24 | AUDIT-015 | `TODO` -> `REJECTED` | 复核后确认 fork RPC 依赖不是审计问题；当前已有 BSC Testnet 实链场景测试记录支撑。 | 参考 `docs/testing/2026-05-13-bsc-testnet-full-flow-report.md`。 |
| 2026-05-24 | AUDIT-014 | `TODO` -> `DONE` | 根 README 已按当前实现重写，移除 `LiquidityManager` 和旧历史文档链接，补充 `BettingSettlementModule` 与当前文档入口。 | 文档检查通过；未改合约代码。 |
| 2026-05-24 | AUDIT-013 | `TODO` -> `REJECTED` | 复核后确认 `SECONDS_PER_DAY = 3600` 是测试阶段要求的临时参数；主网上线前统一做参数核对，不作为单独审计漏洞。 | 参考 `docs/progress/当前开发现状.md` 与 `docs/deployment/bsc-testnet-current.json`。 |
| 2026-06-13 | AUDIT-013 | `REJECTED` -> `DONE` | 当前源码已将 `PrecisionConstants.SECONDS_PER_DAY` 恢复为 `86400`，并同步 `docs/README.md`、`docs/progress/当前开发现状.md`、`docs/development/api.md` 与共享模块实现说明。 | `forge fmt --check`、`forge build --offline --skip test`、`forge test --offline --no-match-path 'test/ForkMainnet*' -vv`。 |
| 2026-05-24 | AUDIT-012 | `TODO` -> `REJECTED` | 复核产品文档后确认普通单市场赔率没有绝对上限定义，且赔率由 Sportmonks/后端/运营受控输入；当前不强行增加链上硬上限，避免误挡正常开盘或赔率更新。 | 参考 `docs/product/赔率_规则设计.md`、`docs/product/对赌池_规则设计.md` 与 `BettingPool.openMarket/updateOdds` 权限。 |
| 2026-05-24 | AUDIT-011 | `TODO` -> `REJECTED` | 阅读 `LiquidityPool` 资金路径后确认：LP loss 在 `distributeLoss` 时已从 `requestableLiquidity` 和 LP 仓位价值扣除，后续提款只能提扣损后的价值，不会提走 payout window 中已预留给赢家的资金。 | 参考 `LiquidityPool.distributeLoss/requestUnbond/withdraw/requestPayoutLiquidity/_setReservedAmount`。 |
| 2026-05-24 | AUDIT-011 | `REJECTED` | 补充 invariant 测试 | 新增 `test/LiquidityPayoutReserveInvariant.t.sol`，随机交错 LP 存入、开 match、margin、loss、payout、requestUnbond、withdraw，验证 `LiquidityPool` 实际 ODD 余额始终覆盖 `totalOutstandingPayoutReserved`。 | `forge test --match-path test/LiquidityPayoutReserveInvariant.t.sol --offline`。 |
| 2026-05-24 | AUDIT-010 | `NEEDS_DECISION` -> `DONE` | 将 `lpDeficit / LpDeficitRepaid` 改名为 `lpLossOffsetRemaining / LpLossOffsetApplied`，并补代码注释和文档说明：该指标只决定派奖税缓冲份额的优先冲抵顺序，不代表真实 LP 应收债务。 | `forge build --offline` 通过；`forge test --match-path test/LiquidityPayoutReserveInvariant.t.sol --offline -vv` 通过。 |
| 2026-05-24 | AUDIT-008 | `TODO` -> `DONE` | `setBettingDependencies` 改为仅允许依赖全空时一次性设置，并补充代码注释说明该函数不是 UUPS implementation 升级入口。 | `forge build --offline` 通过；`forge test --match-path test/BettingDependenciesConfig.t.sol --offline -vv` 通过。现有 fork coverage 定向测试因未提供 `MAINNET_FORK_RPC_URL` 未执行。 |
| 2026-05-24 | AUDIT-007 | `TODO` -> `REJECTED` | 确认 `settlementModule` 是为解决 `BettingPool` 合约体积而引入的既定模块拆分方案，后续也会存在更多同类模块。该风险归入模块化治理信任边界，不按当前代码漏洞处理。 | 文档判定；未改合约代码。 |
| 2026-05-24 | AUDIT-006 | `TODO` -> `DONE` | 当前 `settleMarketBetsByScore / finalizeMarketSettlement / refundBets` wrapper 均带 `nonReentrant`；旧 `settleMarket / pushRefundMarket` wrapper 已在 AH 扩盘口改造中删除。 | `forge build --offline` 通过。 |
| 2026-05-24 | AUDIT-005 | `TODO` -> `DONE` | 四个 UUPS implementation 增加 `_disableInitializers()` 构造器，禁止 implementation 本体直接初始化；新增 implementation 直接初始化必须 revert 的测试，并将相关测试/脚本夹具改为 proxy 初始化路径。文档明确该构造器只锁 implementation 自身 storage，不影响 proxy 通过 `upgradeToAndCall` 升级或执行 `reinitializer`。 | `forge build --offline` 通过；`forge test --match-path test/UUPSImplementationInitializer.t.sol --offline -vv`、`forge test --match-path test/BettingDependenciesConfig.t.sol --offline -vv`、`forge test --match-path test/LiquidityPayoutReserveInvariant.t.sol --offline -vv` 通过。 |
| 2026-05-24 | AUDIT-004 | `TODO` -> `DONE` | 最小化修复 USDT 推荐奖励兑换路径：新增治理配置 `setReferralSwapConfig`，claim 不再接收用户传入 router/token，并以 USDT 真实余额差额作为 `amountOut`。 | `forge build --offline` 通过；`forge test --match-path test/ReferralUsdtClaimConfig.t.sol --offline -vv`、`forge test --match-path test/BettingDependenciesConfig.t.sol --offline -vv`、`forge test --match-path test/UUPSImplementationInitializer.t.sol --offline -vv` 通过。 |
| 2026-05-24 | AUDIT-003 | `TODO` -> `DONE` | 最小化修复 StakingPool 暂停阻断胜单领奖：`notifyReward` 不再受 `whenNotPaused` 限制，但仍只能由 `BettingPool` 调用且保持 `nonReentrant`；同步修正文档中“StakingPool 暂停需同步暂停 BettingPool”的旧假设。 | `forge test --match-path test/StakingPausedClaimPayout.t.sol --offline -vv` 通过；`forge build --offline` 通过，剩余为既有 lint/AST 警告。 |
| 2026-05-24 | AUDIT-002 | `TODO` -> `DONE` | 平台 20% Margin 明确为留在 BettingPool 并记入 `platformReserve`，作为 L4 准备金收入；不转出到 `platformTreasury`，也不扣减 `accountedBalance`。 | `forge test --match-path test/PlatformMarginReserveAccounting.t.sol --offline -vv` 通过；`forge build --offline` 通过，剩余为既有 lint/AST 警告。 |
| 2026-05-24 | AUDIT-001 | `TODO` -> `DONE` | 当前 score-based 分批结算路径为 `settleMarketBetsByScore` 分批处理 betIds 并累计 score progress，`finalizeMarketSettlement(marketId,0)` 只按累计值收口结算，不再扫全量 bet；旧 `settleMarket / settleMarketBets(winningOutcome) / pushRefundMarket` 已删除；`claimPayout` 增加 market 必须已 `Settled` 的保护；`Refunded/Cancelled` 终态标记收口到 `finalizeMarketSettlement(marketId,1/2)`，逐笔退款继续走 `refundBets`。 | `forge test --match-path test/BatchMarketSettlement.t.sol --offline -vv`、`forge test --match-path test/LocalScenarioMatrix.t.sol --offline -vv`、`forge test --offline --no-match-path 'test/Fork*' -vv`、`forge build --offline` 通过。 |
