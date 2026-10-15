# ODDToken 锁仓与发售 MVP 全量场景测试方案

**日期：** 2026-06-12
**状态：** 测试设计完成；Token、配套合约、业务主路径、本地 E2E、对抗性、fuzz、场景矩阵、旧非 fork 矩阵和 BNB mainnet fork 已通过，MVP 全量部署脚本已补齐，BSC Testnet/live 待执行
**范围：** ODDToken 锁仓/来源账本、TierSale、HouseVault、DexLaunchController、EcosystemRewards、Betting / Staking / Liquidity 最小接入、部署 gate、E2E、对抗性测试和全量场景矩阵

## 1. 当前执行结论

当前本地可执行场景与 BNB mainnet fork 已跑完，外部 BSC Testnet/live 部署类场景尚未具备执行条件：

- `ODDToken` Phase 1/2 主干已本地实现；
- `TierSale / HouseVault / DexLaunchController / EcosystemRewards / DexLpLocker` 配套合约主干已本地实现；
- 已新增 `test/OddMvpSupportContracts.t.sol`，覆盖跨档购买与 sale refund、奖励 claim、HouseVault 出账限制、DexLaunchController V3 launch、LP NFT 锁定和到期释放主路径；
- `Betting / Staking / Liquidity` 用户资金入口/出口已完成最小代码接入；
- 已新增 `test/OddMvpBusinessIntegration.t.sol`，覆盖 Betting 普通单注、串关赢单、推荐 ODD claim、推荐 USDT claim、Staking 和 Liquidity 主路径；
- 已新增 `test/helpers/OddMvpTestBootstrap.sol`，旧非 fork 业务测试已迁移到 fixed sources / treasury sink / whitelist 初始化口径；
- 已新增 `test/ODDTokenSourcesFuzz.t.sol`、`test/OddMvpE2E.t.sol`、`test/OddMvpAdversarial.t.sol`、`test/OddMvpScenarioMatrix.t.sol` 和 `test/helpers/OddMvpTokenHarnesses.sol`；
- fuzz 3/3、E2E 1/1、对抗性 3/3、场景矩阵 7/7 已通过；
- `forge test --no-match-path 'test/ForkMainnet*' -vv` 已通过 96/96；
- `MAINNET_FORK_RPC_URL=<redacted BNB mainnet RPC> forge test --match-path 'test/ForkMainnet*.t.sol' -vv --jobs 1` 已通过 37/37；
- BNB mainnet fork 脚本全流程已通过：`MainnetForkValidation`、正常结算、push 退款、推荐奖励 USDT claim、waterfall 出款顺序；
- Slither 已执行，结果非 0，High/Medium 已在 `docs/testing/2026-06-12-ODDToken锁仓与发售MVP本地验证记录.md` 按类别记录豁免。

因此本文件继续作为完整测试矩阵。当前已跑通的本地与 BNB mainnet fork 测试不能替代 BSC Testnet live 验证和第三方审计；等具备链上部署参数后，必须按本文补齐部署后测试并全部执行通过，才能进入最终上线验收。

## 2. 执行门槛

进入全量测试前必须满足：

1. `ODDToken` 锁仓/来源账本接口完整；
2. `TierSale / HouseVault / DexLaunchController / EcosystemRewards` 已实现；
3. Pancake V3 LP NFT 12 个月强制锁定已通过 `DexLpLocker` 或等价外部 locker 接入闭合；
4. `BettingBetModule / BettingSettlementModule / BettingParlayModule / BettingReferralModule / StakingPool / LiquidityPool` 已按最小改动接入 Token 业务接口；
5. 所有测试 helper 不再依赖 admin 持有全量 ODD；
6. 部署脚本完成固定来源、白名单、treasury sink、DEX restricted target、初始分配和部署 gate；
7. `docs/development/api.md`、模块当前实现文档和 `docs/progress/当前开发现状.md` 已同步。

## 3. 测试文件规划

| 测试文件 | 类型 | 目标 |
| --- | --- | --- |
| `test/ODDTokenPhase1.t.sol` | 已有单元测试 | Token 初始化、分配、锁仓、业务快照、DEX 一次性额度主路径 |
| `test/OddMvpSupportContracts.t.sol` | 已有配套合约集成测试 | TierSale 跨档购买/refund、EcosystemRewards claim、HouseVault 限制、DexLaunchController V3 launch、DexLpLocker 锁定与释放主路径 |
| `test/ODDTokenSourcesFuzz.t.sol` | 已有 fuzz | sale/reward/business/transferable 混合来源消耗、还原、亏损、burn |
| TierSale 独立单元测试 | 暂不单独新增 | 主路径由 `OddMvpSupportContracts / OddMvpE2E / OddMvpScenarioMatrix` 覆盖；后续可按审计要求拆成独立单元测试 |
| EcosystemRewards 独立单元测试 | 暂不单独新增 | 主路径由 `OddMvpSupportContracts / OddMvpScenarioMatrix` 覆盖；后续可按审计要求拆成独立单元测试 |
| HouseVault 独立单元测试 | 暂不单独新增 | 主路径由 `OddMvpSupportContracts / OddMvpE2E / OddMvpScenarioMatrix` 覆盖；后续可按审计要求拆成独立单元测试 |
| DexLaunchController 独立单元测试 | 暂不单独新增 | 主路径由 `OddMvpSupportContracts / OddMvpE2E` 覆盖；后续可按审计要求拆成独立单元测试 |
| `test/OddMvpBusinessIntegration.t.sol` | 已有集成测试 | Betting 普通单注、串关、推荐 ODD/USDT、Staking、Liquidity 最小接入资金入口/出口主路径 |
| `test/OddMvpE2E.t.sol` | 已有 E2E | 从 sale 到 launch、LP NFT 锁定、HouseVault、业务回款和净盈利可花的完整链路 |
| `test/OddMvpAdversarial.t.sol` | 已有对抗性测试 | 权限、绕过锁仓、DEX 额度滥用、部署错配基础场景 |
| `test/OddMvpScenarioMatrix.t.sol` | 已有全量场景矩阵 | 本文件第 7 节本地可执行场景矩阵的核心覆盖 |
| 既有 `FundsFlowMatrix / EndToEndFundsChain / LocalScenarioMatrix / ParlayModule` | 已迁移并复跑 | 确认既有 betting、staking、liquidity 语义未被 Token 改造破坏 |

## 4. E2E 验收链路

### E2E-001 满额销售到 DEX launch

步骤：

1. 部署新 ODDToken 和全部配套合约；
2. 配置 fixed sources、treasury sink、whitelist、DEX restricted target；
3. 执行 `allocateInitialSupply`；
4. 启动 TierSale；
5. 多用户跨 10 档买满 `30,000,000 ODD`；
6. 确认 USDT 募资锁定，未 approve/transfer；
7. DexLaunchController 使用 `1,650,000 USDT + 10,000,000 ODD` 在 Pancake V3 建池；
8. PositionManager 拉 ODD 时扣减 `dexLiquidityTransferableAllocation`；
9. LP NFT 锁仓 12 个月；
10. 写入 `poolLaunchTime`；
11. 剩余资产回 treasury sink。

预期：

- sales ODD 全部登记为 sale source；
- DEX Router / PositionManager / Pool 均不在 whitelist；
- 建池后 sale 第 1 天解锁比例正确；
- `poolLaunchTime` 只能设置一次。

### E2E-002 非满额 forceFinalize launch

步骤：

1. 销售未满；
2. 管理员通过 timelock forceFinalize；
3. 记录参与建池的 USDT / ODD 数量；
4. DexLaunchController 按实际资产建池；
5. 未售 ODD 和剩余资产回 treasury sink。

预期：

- forceFinalize 事件字段完整；
- 建池经济下限由配置校验；
- 未售 ODD 不进入用户锁仓账本。

### E2E-003 sale cancel / refund

步骤：

1. 用户购买 sale ODD；
2. cancelSale；
3. 用户交回仍持有的 sale ODD；
4. TierSale 按购买实付 USDT 退款；
5. 用户已下注/质押/LP/burn 导致 sale source 不足时，只能退可交回部分或 revert。

预期：

- 不存在管理员 clawback 用户余额；
- cancel 后不能继续购买或 launch；
- 退款必须同步扣减 sale source。

### E2E-004 sale ODD 下注赢/输/退

步骤：

1. 用户用 sale locked ODD 下普通单注；
2. 分别覆盖赢、输、退款、Cash Out；
3. claim / refund / cashOut 走 `registerBusinessOutcomeDelta`。

预期：

- 赢：本金按原来源恢复，净盈利可转；
- 输：未返还本金确认为 loss，用户锁仓来源减少；
- 退款：本金来源恢复；
- Cash Out：按实际到账确认本金/利润/亏损；
- 普通 `transfer/transferFrom` 不能绕过业务入口。

### E2E-005 DEX 买入 ODD 后下注

步骤：

1. 用户从 Pancake V3 买入可转 ODD；
2. 用该 ODD 下注；
3. 覆盖赢、输、退款。

预期：

- DEX 买入 ODD 不新增 sale/reward 锁仓；
- 赢的净盈利可转；
- 输只消耗可转来源，不误伤 sale/reward source。

### E2E-006 staking 来源回款

步骤：

1. 用户使用 sale/reward/transferable 混合 ODD stake；
2. 正常 unstake；
3. earlyUnstake；
4. pending reward 由 EcosystemRewards 或业务净收益路径发放。

预期：

- principal 按 business snapshot 恢复来源；
- reward 不被登记成本金来源，按奖励规则处理；
- earlyUnstake 的亏损或罚没不误锁用户余额。

### E2E-007 liquidity 来源回款

步骤：

1. 用户用混合来源 deposit Global / Match LP；
2. LP 正收益 withdraw；
3. LP 亏损 withdraw；
4. LP 清零或无法 withdraw 场景 zero-delta finalized。

预期：

- 正收益中的净盈利可转；
- 亏损扣减来源；
- 清零仓位通过 `businessOutDelta=0, finalized=true` 确认 loss。

### E2E-008 推荐奖励 ODD / USDT claim

步骤：

1. 用户下注产生 referrer ODD reward；
2. referrer claim ODD；
3. referrer claim USDT，经 Pancake V3 Router swap。

预期：

- ODD claim 走 `registerBusinessProfitAndTransfer`，可转；
- USDT claim 走 `registerBusinessProfitForDexSwap`；
- Router 只能把指定金额拉到 expected pool；
- 错 Router、错 pool、重复使用额度均失败。

### E2E-009 全系统资金链闭合

步骤：

1. sale -> launch；
2. 多用户下注普通单注和串关；
3. staking、LP、推荐奖励同时存在；
4. 普通单注 win/lose/refund/cashOut；
5. 串关 win/loss/refund；
6. payout reserve residual release；
7. LP unbond/withdraw；
8. staker unstake；
9. treasury sink 归集税费和剩余资产。

预期：

- `balanceOf` 与内部 accounted balance 闭合；
- 用户来源账本总和不超过余额；
- 业务 snapshot 的 `businessIn / totalBusinessOut / profitRecognized / lossRecognized` 可复算；
- platform reserve、taxBuffer、LP window、staking reward 均与现有实现一致。

## 5. 对抗性测试矩阵

| ID | 攻击/异常 | 预期 |
| --- | --- | --- |
| ADV-001 | 非管理员配置 fixed sources / whitelist / treasury sink | revert |
| ADV-002 | fixed sources 重复配置 | revert |
| ADV-003 | whitelist 添加 EOA | revert |
| ADV-004 | whitelist 添加 Router / PositionManager / V3 Pool / V2 Pair | revert |
| ADV-005 | 普通用户直接 transfer 到白名单业务合约 | revert |
| ADV-006 | 普通用户通过 approve + transferFrom 绕过 `consumeBusinessInflow` | revert |
| ADV-007 | 白名单业务合约普通 transfer 给用户 | revert |
| ADV-008 | 伪造 businessId / 非 snapshot owner 登记 outcome | revert |
| ADV-009 | businessId 重放 | revert |
| ADV-010 | finalized 后再次登记 outcome | revert |
| ADV-011 | `businessOutDelta=0, finalized=false` | revert |
| ADV-012 | `businessOutDelta=0, finalized=true` 全亏损 | success |
| ADV-013 | 多次 outcome delta 不重复确认 profit | success，累计正确 |
| ADV-014 | 用户只持有锁定 sale/reward 时普通转账 | revert |
| ADV-015 | 部分解锁后混合来源消耗 | 只消耗当前锁定来源和可转余额，不能多锁 |
| ADV-016 | burn 锁定来源 | 来源账本同步扣减 |
| ADV-017 | pause 后 transfer / transferFrom / burn / 业务入口 | revert |
| ADV-018 | DexLaunchController 错 spender 拉 ODD | revert |
| ADV-019 | DexLaunchController 错 pool 拉 ODD | revert |
| ADV-020 | DexLaunchController 超额拉 ODD | revert |
| ADV-021 | BusinessProfitSwap 错 Router / pool / 重复使用 | revert |
| ADV-022 | TierSale cancel 后继续 buy / launch | revert |
| ADV-023 | TierSale refund 时用户无法交回 ODD | revert 或只退可交回部分 |
| ADV-024 | EcosystemRewards 超预算分配 | revert |
| ADV-025 | HouseVault 向普通用户或 DEX 出账 | revert |
| ADV-026 | Timelock `minDelay < 48 hours` 部署 gate | fail |
| ADV-027 | 部署后残留旧 ODD 地址 | fail |
| ADV-028 | treasury sink 未登记时配置 platformTreasury | revert |
| ADV-029 | 外部回调尝试重入涉及资产转移入口 | revert |
| ADV-030 | 无上限数组输入 | 不存在或有明确上限 |

## 6. Fuzz / invariant

必须至少覆盖：

- `sourceLocked <= balanceOf(account)`；
- `transferable + locked == balanceOf(account)` 或在余额不足保护下不超过余额；
- 任意业务 snapshot：
  - `principalReturned <= businessIn`
  - `profitRecognized == max(totalBusinessOut - businessIn, 0)`
  - finalized 后 `lossRecognized == businessIn - min(totalBusinessOut,businessIn)`
- 多次 outcome delta 累计后事件和 storage 可复算；
- burn / loss / refund / profit 任意顺序下来源账本不下溢；
- `dexLiquidityTransferableAllocation` 单调递减；
- `businessProfitSwapAllowance` 只能按指定 spender/target 消耗；
- `poolLaunchTime` 设置后不可变；
- `totalSupply` 只因 burn 减少，不会增发。

## 7. 全量场景矩阵

### 7.1 Token / 来源账本

| ID | 场景 | 类型 |
| --- | --- | --- |
| TOK-001 | 初始化 mint 到 Token 自身 | 单元 |
| TOK-002 | 角色授予 adminTimelock / pauser | 单元 |
| TOK-003 | 固定来源配置与重复配置失败 | 单元 |
| TOK-004 | 初始分配一次性执行 | 单元 |
| TOK-005 | 普通用户可转余额转账成功 | 单元 |
| TOK-006 | sale locked 转账失败 | 单元 |
| TOK-007 | reward locked 转账失败 | 单元 |
| TOK-008 | sale 第 1 / 29 / 30 天解锁 | 单元 |
| TOK-009 | reward 0 / 90 / 180 天解锁 | 单元 |
| TOK-010 | business inflow 创建 snapshot | 单元 |
| TOK-011 | refund 恢复来源 | 单元 |
| TOK-012 | win 只锁本金，profit 可转 | 单元 |
| TOK-013 | loss 扣减来源 | 单元 |
| TOK-014 | mixed source 部分退款 | fuzz |
| TOK-015 | burn 消耗来源 | 单元 |

### 7.2 TierSale

| ID | 场景 | 类型 |
| --- | --- | --- |
| SALE-001 | startSale 只可一次 | 单元 |
| SALE-002 | 10 档价格与每档额度 | 单元 |
| SALE-003 | 单档购买 | 单元 |
| SALE-004 | 跨档购买 | 单元 |
| SALE-005 | 超过剩余额度失败 | 单元 |
| SALE-006 | pause/resume/close | 单元 |
| SALE-007 | soldOut 后禁止继续买 | 单元 |
| SALE-008 | cancelSale 后退款 | 集成 |
| SALE-009 | 用户 ODD 不足退款失败 | 集成 |
| SALE-010 | forceFinalize 记录资产 | 集成 |
| SALE-011 | USDT decimals 适配 | 单元 |

### 7.3 DexLaunchController

| ID | 场景 | 类型 |
| --- | --- | --- |
| DEX-001 | 满额 launch V3 pool | 集成 |
| DEX-002 | 复用已存在 V3 pool | 集成 |
| DEX-003 | 非满额 forceFinalize launch | 集成 |
| DEX-004 | PositionManager 拉 ODD | 集成 |
| DEX-005 | LP NFT 进入 `DexLpLocker` 并锁 12 个月 | 集成 |
| DEX-006 | 剩余资产回 treasury sink | 集成 |
| DEX-007 | 错 spender/pool/超额失败 | 对抗 |
| DEX-008 | `markDexPoolLaunched` 二次失败 | 单元 |

### 7.4 EcosystemRewards / HouseVault

| ID | 场景 | 类型 |
| --- | --- | --- |
| REW-001 | 创建 claimable | 单元 |
| REW-002 | 取消 claimable | 单元 |
| REW-003 | 用户 claim 后登记 reward source | 集成 |
| REW-004 | 类别预算超额失败 | 单元 |
| REW-005 | 重复 claim 失败 | 单元 |
| HV-001 | HouseVault 向白名单划转 | 单元 |
| HV-002 | HouseVault 向 treasury sink 划转 | 单元 |
| HV-003 | HouseVault 向普通用户失败 | 对抗 |
| HV-004 | HouseVault 向 DEX target 失败 | 对抗 |
| HV-005 | HouseVault 通过 `fundBettingPlatformReserve` 注入 BettingPool L4 | `platformReserve / accountedBalance / BettingPool ODD balance` 同步增加，allowance 归零 |

### 7.5 Betting / Staking / Liquidity 接入

| ID | 场景 | 类型 |
| --- | --- | --- |
| BETSRC-001 | 普通单注入金调用 `consumeBusinessInflow` | 集成 |
| BETSRC-002 | 普通单注赢单 claim 登记 outcome | 集成 |
| BETSRC-003 | 普通单注输单 zero-delta finalized | 集成 |
| BETSRC-004 | 普通单注退款恢复来源 | 集成 |
| BETSRC-005 | Cash Out 盈亏登记 | 集成 |
| BETSRC-006 | 串关注单入金 snapshot | 集成 |
| BETSRC-007 | 串关赢单 claim | 集成 |
| BETSRC-008 | 串关全输 loss | 集成 |
| BETSRC-009 | 串关部分退款 | 集成 |
| STKSRC-001 | staking principal 入金 snapshot | 集成 |
| STKSRC-002 | normal unstake 恢复本金并确认 reward | 集成 |
| STKSRC-003 | earlyUnstake 亏损/罚没 | 集成 |
| LPSRC-001 | LP deposit snapshot | 集成 |
| LPSRC-002 | LP 正收益 withdraw | 集成 |
| LPSRC-003 | LP 亏损 withdraw | 集成 |
| LPSRC-004 | LP 清零 zero-delta finalized | 集成 |
| REFSRC-001 | 推荐 ODD claim 可转 | 集成 |
| REFSRC-002 | 推荐 USDT claim V3 swap | 集成 |

### 7.6 既有业务回归

必须迁移并复跑：

- `LocalScenarioMatrix.t.sol`
- `FundsFlowMatrix.t.sol`
- `EndToEndFundsChain.t.sol`
- `ParlayModule.t.sol`
- `CashOut.t.sol`
- `BatchMarketSettlement.t.sol`
- `PlatformMarginReserveAccounting.t.sol`
- `StakingPausedClaimPayout.t.sol`
- `LiquidityPayoutReserveInvariant.t.sol`
- 所有 `ForkMainnet*.t.sol`

验收要求：

- 旧业务语义不因 Token 接入被破坏；
- 除测试夹具资金来源迁移外，不应为了通过测试重写业务状态机；
- 所有失败必须归类为真实 bug、测试夹具迁移、或明确延期项。

## 8. 必跑命令

完整实现后，本地必须执行：

```bash
forge fmt --check
forge build --sizes
forge test --match-path 'test/ODDToken*.t.sol' -vv
forge test --match-path 'test/OddMvpSupportContracts.t.sol' -vv
forge test --match-path 'test/OddMvpBusinessIntegration.t.sol' -vv
forge test --match-path 'test/ODDTokenSourcesFuzz.t.sol' -vv
forge test --match-path 'test/OddMvpE2E.t.sol' -vv
forge test --match-path 'test/OddMvpAdversarial.t.sol' -vv
forge test --match-path 'test/OddMvpScenarioMatrix.t.sol' -vv
forge test --no-match-path 'test/ForkMainnet*' -vv
```

具备 BNB mainnet fork RPC 后执行；当前用户提供的 Alchemy RPC 已按以下口径通过，文档中脱敏记录：

```bash
MAINNET_FORK_RPC_URL=<redacted BNB mainnet RPC> forge test --match-path 'test/ForkMainnet*.t.sol' -vv --jobs 1
forge script script/MainnetForkValidation.s.sol:MainnetForkValidationScript --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000 -vv
forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runNormalSettlementScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000
forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runPushRefundScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000
forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runReferralUsdtScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000
forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runWaterfallScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000
```

说明：并发 fork 测试在该 RPC 上偶发 TLS EOF，`--jobs 1` 为当前稳定执行口径。

审计前执行：

```bash
uvx --from slither-analyzer slither . --filter-paths 'lib|test|script' --json /tmp/slither-odd-token-mvp.json
```

所有 High / Medium 必须修复或在 `docs/testing/` 写明豁免理由。

## 9. 测试报告要求

全量执行后必须新增报告；本轮本地执行已合并归档到 `docs/testing/2026-06-12-ODDToken锁仓与发售MVP本地验证记录.md`：

- `docs/testing/YYYY-MM-DD-ODDToken锁仓与发售MVP本地验证记录.md`
- `docs/testing/YYYY-MM-DD-ODDToken锁仓与发售MVP对抗性测试记录.md`，可独立拆分，也可合并进本地验证记录；
- `docs/testing/YYYY-MM-DD-ODDToken锁仓与发售MVP场景矩阵报告.md`，可独立拆分，也可合并进本地验证记录；
- 如有测试网部署，再新增 BSC Testnet live 报告。

报告必须记录：

- 执行命令；
- 测试通过/失败数量；
- 失败用例原因；
- 资金链路不变量；
- 未执行项和原因；
- 是否阻塞部署、审计或上线。

## 10. 当前待办结论

本测试方案已具备指导后续开发和验收的粒度。当前本地可执行测试与 BNB mainnet fork 已跑通，不能标记为最终上线验收完成的原因是 BSC Testnet live 验证、审计前 Slither 复核和第三方审计尚未完成。具备链上部署参数后，必须按本文补齐部署后测试并全部执行通过；任何失败都需要修复到通过，或形成明确的产品/技术延期结论。
