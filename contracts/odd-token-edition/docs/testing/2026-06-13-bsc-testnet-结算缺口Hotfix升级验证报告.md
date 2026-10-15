# 2026-06-13 BSC Testnet 结算缺口 Hotfix 升级验证报告

**网络：** BNB Smart Chain Testnet
**chainId：** `97`
**目标：** 发布并验证普通单注与串关结算 `netLoss` hotfix，避免冷启动无 LP 或 LP 不足时按旧保守口径虚扣 `platformReserve`。
**安全说明：** 本报告只记录地址、交易 hash 和验证结论，不记录私钥、RPC token 或浏览器验证 key。

## 1. 发布范围

本次遵循最小修复原则：

- 保持 `BettingPool` proxy 不变：`0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
- 保持 `BettingPool` implementation 不变：`0x3a4845AAdDf529dd3Ee8F073EA7dE9e565df56DA`
- 保持 `BettingMarketModule` 不变：`0xD786A66a77Ff137A09Aa2fa69BbD8f6AE42f79De`
- 保持 `BettingReferralModule` 不变：`0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B`
- 保持 `BettingParlayLens` 不变：`0xd139C9C041783D48A3D36aedb8Ea7d99859bD2a2`
- 仅替换 `BettingSettlementModule` 与 `BettingParlayModule`

## 2. 当前地址

| 合约 | 地址 | 状态 |
|---|---|---|
| `BettingSettlementModule` | `0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39` | current |
| `BettingParlayModule` | `0xD7AcFb964C01D4be09757207034FD919dA06fE96` | current |
| `BettingOddsLib` | `0x6d700796d862bdeb4566192f32f4f287a136a1d6` | current for 2026-06-13 settlement/parlay modules |

被替换地址：

| 合约 | 旧地址 |
|---|---|
| `BettingSettlementModule` | `0xD05070e92F8981578e27DF3BFA32094549Ec54Dc` |
| `BettingParlayModule` | `0xeDBC57c205129FDB0501cEa42Fc4bD68C1AAcBaA` |
| `BettingOddsLib` | `0x8143fe80565acbc809f1c1fd0d57c758495f7aa6` |

## 3. 发布交易

| 操作 | tx hash |
|---|---|
| 部署 `BettingOddsLib` | `0x643e8a37f152ae9f73091f68db726ca5fb262eff0b7c514546d9d106be3723e3` |
| 部署 `BettingSettlementModule` | `0xcc83fe3e0eea2fbccd4ebd1f7ee049a23ea8b91169b736e164ddb259ab10e6ee` |
| 部署 `BettingParlayModule` | `0x2f718917652a843232d48ba88a4e023d8f7be3c2242d310c9b38440587378c2e` |
| `BettingPool.setSettlementModule` | `0x4d9c85fa712ec74ddd125fd00efb11b3e07eaec43f021a2a590443d65044f876` |
| `BettingPool.setParlayModule` | `0x24b740a8eb74d0d875d1de7e4a1dc76afae3c06b1b11815d582cd30ef39163e2` |

发布后链上 getter：

- `BettingPool.settlementModule()` 返回 `0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39`
- `BettingPool.parlayModule()` 返回 `0xD7AcFb964C01D4be09757207034FD919dA06fE96`
- `BettingPool.marketModule()` 仍为 `0xD786A66a77Ff137A09Aa2fa69BbD8f6AE42f79De`
- `BettingPool.referralModule()` 仍为 `0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B`

## 4. 源码验证与字节码匹配

源码验证：

- `BettingOddsLib`：BscScan Testnet 已验证
- `BettingSettlementModule`：BscScan Testnet 已验证
- `BettingParlayModule`：BscScan Testnet 已验证

字节码匹配：

| 合约 | 结论 |
|---|---|
| `BettingOddsLib` | 链上 runtime 与本地构建完整匹配，hash `0xacce074a31e4ac78f34a5682d3770fe0f28ae91421f1db89a7e787ab1f09985f` |
| `BettingSettlementModule` | 替换 `SELF` immutable 地址并剔除 metadata 差异后，runtime 逻辑体匹配，body hash `0x5fedf9e5ef5dfd8ef6fb596ab50be73fcf5614f3da3afa135a588ab901a4348e` |
| `BettingParlayModule` | 替换 `SELF` immutable 地址并剔除 metadata 差异后，runtime 逻辑体匹配，body hash `0xcc5586131542fcf0e42a47a9e9862da77ac8c36e9adb969dc42f265188485fbb` |

## 5. 测试网验收

| 验收项 | 结果 | 记录 |
|---|---|---|
| module getter 与权限前置检查 | 通过 | `BscTestnetOddsV3LineValidation.checkDeployment()` |
| 新增 line eth_call 开盘矩阵 | 通过 | `BscTestnetOddsV3LineValidation.checkLineMatrix(...)` |
| AH 10 / OU 8 / OU 10 单关与串关 prepare + settle | 通过 | `BscTestnetOddsV3LineValidation.prepare/settle(...)`，`parlayId=0x2fa9a6f60e8d2b355b431fefcfc02583f492dc23c099293ad28bb6096e9a018e` |
| Smoke | 通过 | `BscTestnetSmoke.s.sol`，下注 `betId=0x0000000000000000000000000000000000000000000000000000000000000010` |
| 普通下注 full-flow | 通过 | `docs/testing/2026-06-03-bsc-testnet-cashout-upgrade-full-flow-netloss-hotfix-20260613.md` |
| Cash Out 场景 | 通过，33 passed / 0 failed | `docs/testing/2026-06-03-bsc-testnet-cashout-upgrade-netloss-hotfix-20260613.md` |
| 串关 place/settle/claim/residual release | 通过，38 passed / 0 failed | `docs/testing/2026-06-08-bsc-testnet-modular-entrypoint-parlay-netloss-hotfix-20260613.md` |
| Query interfaces | 通过 | `docs/testing/2026-06-13-bsc-testnet-query-interfaces-netloss-hotfix-report.md` |

`bsc_testnet_line_matrix_report.py` 本轮在 BSC Testnet RPC receipt 等待阶段中断，未生成完整通过报告，因此不作为通过项。该脚本中断前已完成 19 个场景 / 41 笔下注、1X2 全部结算和 OU 1.5 over 结算；新增 line 完整覆盖以 `BscTestnetOddsV3LineValidation` 的 eth_call matrix 与 prepare/settle 真实交易为准。

## 6. 本地回归

本地回归记录见 `docs/testing/2026-06-13-结算缺口计算Hotfix本地验证记录.md`。已覆盖：

- hotfix 专项 fuzz：`test/SettlementNetLossHotfix.t.sol` 4/4 通过，fuzz 256 runs；
- 资金流矩阵：`test/FundsFlowMatrix.t.sol` 7/7 通过；
- E2E 资金链路：`test/EndToEndFundsChain.t.sol` 1/1 通过；
- 本地场景矩阵：`test/LocalScenarioMatrix.t.sol` 12/12 通过；
- 非 fork 全量回归：107/107 通过。

## 7. Slither 复核

已执行：

```bash
uvx --from slither-analyzer slither . --filter-paths 'test|script|lib' --exclude-informational --exclude-low
```

结果：Slither 可执行，但全仓 High/Medium 口径返回既有架构类 findings，命令退出码为 `255`，不记录为“干净通过”。本次 hotfix 未为这些既有项扩大攻击面，主要 triage 如下：

| 类别 | 结论 |
|---|---|
| `controlled-delegatecall` | `BettingPool` 入口壳通过 owner/admin 配置的 module 地址执行 delegatecall，是当前模块化架构设计；写入口仍由 `BettingPool` wrapper 承担权限、暂停和 `nonReentrant`。 |
| `uninitialized-state` | module 合约直接部署后自身 storage 不初始化，但写业务入口只应经 `BettingPool` delegatecall 使用 proxy storage；这是模块化 storage layout 设计，不代表当前 proxy 未初始化。 |
| `reentrancy-*` | Slither 不能跨 delegatecall wrapper 识别 `BettingPool` 外层 `nonReentrant`；本次触达的结算/串关写路径仍通过 `BettingPool` wrapper 进入，且测试已覆盖 claim、refund、cashout、settle、reserve release。 |
| `uninitialized-local` | 多处 struct/local 变量依赖 Solidity 默认零值初始化，测试覆盖相应分支；本次新增的 `selfFundedPayout/netLoss` 计算不依赖未初始化局部变量。 |
| `unused-return` | 多为显式忽略不需要的 tuple 返回值或调用会 revert 的业务入金/出金接口返回值；不影响本次 `netLoss` 计算。 |
| `arbitrary-send-erc20` | 来自 `DexLaunchController.launch` 的既有发售/DEX 路径，与本次 settlement/parlay module hotfix 无关。 |

因此本轮 Slither 结论为：**全仓仍存在已知架构类 High/Medium findings，需要在既有审计 triage 中持续跟踪；本次 hotfix 未新增可归因于 `netLoss` 修改的 Slither finding。**

## 8. 结论

本次 hotfix 已完成 BSC Testnet 发布、源码验证、字节码逻辑匹配和真实链上验收。普通单注与串关的 `netLoss` 均已改为只把真实经济缺口送入 L2/L3/L4 瀑布，避免旧口径在自付资金足够时虚扣 `platformReserve`。
