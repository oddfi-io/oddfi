# ODDToken 锁仓与发售 MVP 本地验证记录

**日期：** 2026-06-12
**范围：** ODDToken 锁仓/来源账本、TierSale、EcosystemRewards、HouseVault、DexLaunchController、DexLpLocker、Betting / Staking / Liquidity 最小业务接入、本地 E2E、对抗性、fuzz、场景矩阵、旧非 fork 回归矩阵和 BNB mainnet fork 验证

## 1. 执行结论

本地可执行测试已通过：

- Token Phase 1/2 定向测试：7/7；
- 配套合约主路径与新增硬约束：8/8；
- 业务接入集成测试：6/6；
- ODDToken 来源账本 fuzz：3/3，Foundry 默认 256 runs；
- ODDToken MVP E2E：1/1；
- 对抗性测试：3/3；
- 场景矩阵：7/7；
- 非 fork 全量回归：96/96；
- 既有 `LiquidityPayoutReserveInvariant` 仍通过，256 runs / 128000 calls；
- BNB mainnet fork 测试套件：37/37；
- BNB mainnet fork 脚本全流程：`MainnetForkValidation`、正常结算、push 退款、推荐奖励 USDT claim、waterfall 出款顺序均通过。

尚未作为通过口径：

- BSC Testnet live：MVP 全量新部署脚本已补齐，尚未执行 live 部署/升级验证；
- Slither：已执行但非 0，High/Medium 已按类别记录豁免；审计前仍需逐条复核；
- 第三方审计：尚未执行。

## 2. 命令与结果

| 命令 | 结果 |
| --- | --- |
| `forge test --match-path test/ODDTokenPhase1.t.sol -vv` | 7 passed |
| `forge test --match-path test/OddMvpSupportContracts.t.sol -vv` | 8 passed |
| `forge test --match-path test/OddMvpBusinessIntegration.t.sol -vv` | 6 passed |
| `forge test --match-path test/ODDTokenSourcesFuzz.t.sol -vv` | 3 passed，fuzz 256 runs |
| `forge test --match-path test/OddMvpE2E.t.sol -vv` | 1 passed |
| `forge test --match-path test/OddMvpAdversarial.t.sol -vv` | 3 passed |
| `forge test --match-path test/OddMvpScenarioMatrix.t.sol -vv` | 7 passed |
| `forge test --no-match-path 'test/ForkMainnet*' -vv` | 96 passed / 0 failed / 0 skipped |
| `MAINNET_FORK_RPC_URL=<redacted BNB mainnet RPC> forge test --match-path 'test/ForkMainnet*.t.sol' -vv --jobs 1` | 37 passed / 0 failed / 0 skipped |
| `forge script script/MainnetForkValidation.s.sol:MainnetForkValidationScript --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000 -vv` | 通过，完整 betting/staking/liquidity/funds flow 验证完成 |
| `forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runNormalSettlementScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000` | 通过，正常结算与推荐 ODD claim 完成 |
| `forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runPushRefundScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000` | 通过，push refund 完成 |
| `forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runReferralUsdtScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000` | 通过，Pancake V3 推荐奖励 USDT claim 完成 |
| `forge script script/MainnetForkScenarioReport.s.sol:MainnetForkScenarioReport --sig 'runWaterfallScenario()' --fork-url <redacted BNB mainnet RPC> --fork-block-number 103725103 --timeout 120000` | 通过，waterfall 出款顺序完成 |
| `uvx --from slither-analyzer slither . --filter-paths 'lib\|test\|script' --json /tmp/slither-odd-token-mvp.json` | 已执行，Slither 返回非 0；390 findings，High/Medium 分组见第 4 节 |
| `forge fmt --check <本轮新增/触达 Solidity 与测试文件>` | 通过 |
| `forge build --skip test` | 通过；仅剩既有 lint/naming/unchecked-transfer/unsafe-typecast warnings |
| `git diff --check` | 通过 |

本轮最终收尾命令：

```bash
forge fmt --check src/modules/token/ODDToken.sol src/modules/token/interfaces/IODDTokenBusiness.sol src/modules/token/interfaces/IODDTokenTreasuryView.sol src/modules/token/TokenBusinessTypes.sol src/modules/token/TierSale.sol src/modules/token/EcosystemRewards.sol src/modules/token/HouseVault.sol src/modules/token/DexLaunchController.sol src/modules/token/DexLpLocker.sol src/modules/betting/BettingBetModule.sol src/modules/betting/BettingSettlementModule.sol src/modules/betting/BettingParlayModule.sol src/modules/betting/BettingReferralModule.sol src/modules/betting/BettingPool.sol src/modules/betting/BettingPoolStorage.sol src/modules/staking/StakingPool.sol src/modules/liquidity/LiquidityPool.sol test/ODDTokenPhase1.t.sol test/OddMvpSupportContracts.t.sol test/OddMvpBusinessIntegration.t.sol test/ODDTokenSourcesFuzz.t.sol test/OddMvpE2E.t.sol test/OddMvpAdversarial.t.sol test/OddMvpScenarioMatrix.t.sol test/ReferralUsdtClaimConfig.t.sol test/helpers/OddMvpTestBootstrap.sol test/helpers/OddMvpTokenHarnesses.sol script/DeployAll.s.sol script/DeployBscTestnet.s.sol script/BscTestnetUpgradeExistingOnly.s.sol
forge build --skip test
git diff --check
```

BNB mainnet fork 使用用户提供的 Alchemy RPC，文档中按 `<redacted BNB mainnet RPC>` 脱敏。并发执行 fork suite 时该 RPC 偶发 TLS EOF，固定 `--jobs 1` 后测试稳定通过；这是 RPC/连接稳定性问题，不是合约 revert。

## 3. 本地测试覆盖说明

`ODDTokenSourcesFuzz.t.sol` 覆盖：

- sale source 进入业务；
- 业务全亏、部分回款、净盈利；
- principal restore 与 lossRecognized / profitRecognized；
- 业务净盈利直接可转；
- burn 扣减 sale/reward locked source。

`OddMvpE2E.t.sol` 覆盖：

- TierSale 用户购买；
- forceFinalize 与 approveLaunch；
- DexLaunchController 走 Pancake V3 PositionManager mock 建池；
- DEX restricted target 登记；
- V3 LP NFT 进入 DexLpLocker 并记录 unlockAt；
- HouseVault 向白名单业务合约出账；
- 业务回款本金还原，净盈利可转。

`OddMvpAdversarial.t.sol` 覆盖：

- 用户普通 `transfer / transferFrom` 不能直接转入白名单业务合约；
- DEX restricted target 不能再加入 whitelist；
- 业务盈利 swap 额度必须匹配精确 router 和 expected pool，且一次消耗。

`OddMvpSupportContracts.t.sol` 已额外覆盖：

- `DexLaunchController.launch` desired ODD/USDT 必须精确等于 TierSale 已批准数量；
- `sweepRemainder` 对 USDT 等任意 token 都只能扫回 treasury sink；
- `DexLpLocker.releasePosition` 到期后只能释放到锁定 beneficiary；
- `EcosystemRewards` 类别预算总和与累计分配不能超过 15,000,000 ODD。

`ReferralUsdtClaimConfig.t.sol` 已额外覆盖：

- `BettingPool / StakingPool` 平台 treasury 更新必须指向 ODDToken 登记的 treasury sink；
- 两参数 `setReferralSwapConfig(router,usdt)` 会失败，必须使用包含 expected pool 的三参数配置。

`OddMvpScenarioMatrix.t.sol` 覆盖：

- 直接转业务失败、业务入口成功；
- 全亏扣减锁仓；
- 部分回款只扣净亏损；
- 净盈利可花且不解锁本金；
- sale launch 后按 29 天曲线解锁；
- reward launch 后 180 天线性解锁；
- 业务盈利 DEX swap 额度单次消耗。

## 4. Slither High / Medium 分组豁免

本次 Slither 使用：

```bash
uvx --from slither-analyzer slither . --filter-paths 'lib|test|script' --json /tmp/slither-odd-token-mvp.json
```

结果：390 findings，Slither 非 0 退出。High / Medium 分组如下：

| Impact | Check | 数量 | 当前处理 |
| --- | --- | ---: | --- |
| High | `arbitrary-send-erc20` | 1 | `DexLaunchController.launch` 从固定 `TierSale` 拉 USDT；`TierSale.approveLaunch` 已检查 spender、USDT 数量和 ODD 数量，属于受控 launch 路径。审计前复核。 |
| High | `controlled-delegatecall` | 5 | `BettingPool` 模块化架构的既有 delegatecall wrapper；模块地址由 admin 设置，入口保留 `nonReentrant / whenNotPaused`，符合当前已文档化架构。 |
| High | `reentrancy-balance` | 3 | 退款和推荐 USDT 路径的余额前后检查；外层 wrapper / Token 关键路径已 `nonReentrant`，模块通过 delegatecall 使用。审计前复核。 |
| High | `uninitialized-state` | 57 | Betting modules 被 Slither 当独立合约分析；真实运行通过 `BettingPool` delegatecall 使用 proxy storage，属于模块化架构假阳性。 |
| Medium | `divide-before-multiply` | 10 | 赔率展示、税费拆分和 pool split 中的有意向下取整；已有对应业务测试覆盖。 |
| Medium | `incorrect-equality` | 6 | 零值、global pool、day bucket 和状态精确检查，属于业务分支条件。 |
| Medium | `reentrancy-no-eth` | 13 | 与模块 delegatecall、staking notify、推荐路径相关；当前入口按 `nonReentrant` 和权限边界保护。审计前复核。 |
| Medium | `uninitialized-local` | 14 | Solidity 默认零值 struct/local 使用；当前测试覆盖对应路径。 |
| Medium | `unused-return` | 23 | 忽略不参与安全判断的返回值或命名返回项，当前无资金安全依赖。 |

Low / Informational / Optimization 本轮未作为阻塞项，审计前可继续清理。

## 5. 未执行项

- BSC Testnet live smoke / full-flow / line matrix：当前 ODDToken MVP 全量新部署脚本已补齐，但尚未实际部署或升级验证。
- 第三方审计：未执行。

## 6. 验收判断

本地开发和 BNB mainnet fork 阶段已通过，可继续推进到 BSC Testnet 部署/升级验证；不能直接进入最终上线。进入上线前至少需要：

1. BSC Testnet 完成原址或全量重部署验证；
2. Slither High/Medium 豁免逐条复核，必要项修复；
3. 第三方审计完成并回归。
