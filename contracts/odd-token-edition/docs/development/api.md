# 当前合约 API

**状态：** AH 扩盘口当前 API + 赔率 V3 line 已发布到 BSC Testnet 与 BSC Mainnet + 结算缺口 netLoss hotfix 已发布到 BSC Testnet 与 BSC Mainnet + 手动封锁 market + Cash Out + 串关 MVP + BettingPool 模块化入口壳 + ODDToken 锁仓与来源账本
**日期：** 2026-06-13
**基线：** `docs/research/2026-05-24-AH扩盘口最小改造调研.md`、`docs/development/2026-05-24-AH扩盘口比分结算实施方案.md`、`docs/development/2026-06-02-手动封锁市场实施方案.md`、`docs/development/2026-06-06-串关MVP实施方案.md`、`docs/development/2026-06-08-BettingPool模块化入口壳实施方案.md`、`docs/development/2026-06-12-ODDToken锁仓与发售MVP实施方案.md`、`docs/development/2026-06-12-赔率V3新增line最小实现方案.md` 与 `docs/development/2026-06-13-结算缺口计算Hotfix方案.md`

**最新升级提示：** 2026-06-13 已完成 BSC Mainnet 全量部署、BscScan 源码验证和链上权限/接线验收，正式网地址见第 1.1 节与 `docs/deployment/bsc-mainnet-current.json`。同日已完成结算缺口 `netLoss` hotfix 测试网发布：`BettingPool` proxy 不变，仅切换 `BettingSettlementModule=0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39` 与 `BettingParlayModule=0xD7AcFb964C01D4be09757207034FD919dA06fE96`，并部署新链接库 `BettingOddsLib=0x6d700796d862bdeb4566192f32f4f287a136a1d6`；三者均已通过 BscScan Testnet 源码验证，链上 full-flow、Cash Out、串关、query interface 与新增 line 验证通过。`HouseVault.fundBettingPlatformReserve` 与 `BettingPool.addPlatformReserve` 的 HouseVault 调用权限仍为 2026-06-12 升级后的当前 proxy；`HouseVault` implementation 为 `0x7e12549BC39B25B1Df4034abEDB9a0109E700128`，`BettingPool` implementation 为 `0x3a4845AAdDf529dd3Ee8F073EA7dE9e565df56DA`。

**赔率 V3 line 提示：** 当前本地源码、BSC Testnet 与 BSC Mainnet 均已支持 AH `line=10..12` 与 OU `line=3..10`，并由 score-based settlement 支持新增 Push / half win / half loss；前后端继续通过 `BettingPool` proxy 写入，module 地址仅用于状态核对和直连只读查询。

本文描述 AH 扩盘口改造后的当前 external / public API、标准继承 API、标准事件与自定义事件，并补充每个业务方法的参数来源、单位、返回值含义、关键校验与状态副作用。

- 前后端交互默认使用 **proxy 地址**；
- `BettingBetModule / BettingMarketModule / BettingReferralModule / BettingSettlementModule / BettingParlayModule` 是 `BettingPool` 的 module 实现；写入口仍通过 `BettingPool` proxy wrapper 调用，只读查询可优先调用 `BettingPool` wrapper，也可按说明直连 module/lens；
- 所有 ODD 金额默认单位为 `1e18`，例如 `100 ODD = 100 * 1e18`；
- `BPS = 10_000`，例如 `500 = 5%`，`10_000 = 100%`；
- 赔率精度为 `1e4`，例如 `10100 = 1.01`，`20000 = 2.00`，赔率步长为 `100`；
- 时间戳使用 Unix seconds；
- `bytes32` 用作 `matchId / marketId / betId` 等业务 ID。

---

## 1. BSC 当前地址

### 1.1 BSC Mainnet 当前地址

当前 BSC Mainnet 全量部署记录来自：

- `script/DeployAll.s.sol`
- `script/deploy_and_verify.sh`
- `docs/deployment/bsc-mainnet-current.json`

| 合约 | 类型 | 地址 |
|---|---|---|
| `ODDToken` | Proxy | `0x3e130563e069c414F0a18863966c211aA5D518F9` |
| `ODDToken` | Current implementation | `0x476Fc1B7cEDA60F3681530E91DEF246dB4645c5f` |
| `TierSale` | Proxy | `0x6FF56E20308647868811089906687fB7706d6517` |
| `TierSale` | Current implementation | `0x7900f36d29375C701419C80FcC15500E44984ad8` |
| `HouseVault` | Proxy | `0x5f67Cf50c01b6528f5fA841475806061bD0E16cD` |
| `HouseVault` | Current implementation | `0x5A855b672a33cA2C924B044Cd3187B45D419f8b2` |
| `DexLaunchController` | Proxy | `0x7208e06B6DF913D59851E36d15585E0Ec9a4c22F` |
| `DexLaunchController` | Current implementation | `0x9e6A683D401607407E8eC67F1AEa2F9e77AECEDF` |
| `DexLpLocker` | Proxy | `0xbB09DcCcE850371C58d784Bc652049DcE7F6Fe5C` |
| `DexLpLocker` | Current implementation | `0x0135A4cbecB51ce23b8B9c98753Fd40B6254f1f9` |
| `EcosystemRewards` | Proxy | `0x71f0C250E8F9ce43626822DE118Bc07fbb72cDA4` |
| `EcosystemRewards` | Current implementation | `0xdCF4BcB0970B30f5159DA69b8827941aE0ac4D55` |
| `StakingPool` | Proxy | `0x837BEB9C2Cd6B45af68CD62009d874569584DDcA` |
| `StakingPool` | Current implementation | `0xc4cc6CD6F91E10dA45F987a4C8f4D3402bEF6fa8` |
| `LiquidityPool` | Proxy | `0x55419B1529b89FE3C72BdC3062515f431a63F06A` |
| `LiquidityPool` | Current implementation | `0x5cA3C168E184843c35e467E7D69dbd5Be9AfcC02` |
| `BettingPool` | Proxy | `0x875D0CA32A74663E42a20d0C2b7E252b5A3121cA` |
| `BettingPool` | Current implementation | `0xD2D01482B684A3D486547657B93F3570B0714388` |
| `BettingSettlementModule` | Implementation | `0x22A2dd5896b4f6741923A4e044AF86C027E90b06` |
| `BettingBetModule` | Implementation | `0x1429A40c5D6f7905486c4f56E5133F0811276B2F` |
| `BettingMarketModule` | Implementation | `0x9fa51AAe630a719Fe9546ef8D72F92cA65B2591D` |
| `BettingReferralModule` | Implementation | `0x7DAcc7aC1Ffc2F51e6db14068c650CD2A5A25907` |
| `BettingParlayModule` | Implementation | `0xBBDbDbc15AEDEa78903D585C4d37aD91dfD2E0B1` |
| `BettingParlayLens` | Read-only lens | `0x7Be018a244Dfd6585cb5d55112Fa3fEBf6C78a0f` |
| `BettingOddsLib` | Library | `0x6D700796D862bdeB4566192f32F4f287A136A1D6` |
| `BettingValidationLib` | Library | `0x46574DE605d72512dC02f3bD67E615f7aE1e35dB` |
| `BettingReferralLib` | Library | `0x29a988A4cEb81CC41066e82691F028229A7677D2` |

外部依赖与权限地址：

| 项 | 地址 |
|---|---|
| BSC USDT | `0x55d398326f99059fF775485246999027B3197955` |
| Pancake V3 NonfungiblePositionManager | `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364` |
| Pancake V3 SwapRouter | `0x13f4EA83D0bd40E75C8222255bc855a974568Dd4` |
| Admin | `0x045f869618321e4CFF067C565dF8Effbd253e415` |
| Pauser / platform treasury / ops treasury / referral claim signer | `0x38002091a8580a64Ffa62a9A5BEaEE59EBA51dB1` |

说明：

- 前端、后端、运营脚本只应直连 `ODDToken / TierSale / HouseVault / DexLaunchController / DexLpLocker / EcosystemRewards / StakingPool / LiquidityPool / BettingPool` 的 proxy 地址；
- `BettingBetModule / BettingMarketModule / BettingReferralModule / BettingSettlementModule / BettingParlayModule` 只通过 `BettingPool` 配置，并由 `BettingPool` 通过 `delegatecall` 调用写路径；
- `BettingParlayLens` 是只读 lens，不持有业务资金，不作为写入口；
- 正式网合约、modules、libraries 和 ERC1967 proxy 均已通过 BscScan 源码验证；
- 正式网链上验收已覆盖 ODD fixed sources、initial supply、treasury sink、whitelist、DEX restricted target、staking/liquidity/betting 依赖、BettingPool module 地址、referral signer/pool fee、admin/pauser/ops/deployer 角色矩阵；
- implementation 与 library 地址可能随后续升级变化，业务集成不应把 implementation 地址当成稳定入口；完整部署交易和验证状态见 `docs/deployment/bsc-mainnet-current.json`。

### 1.2 BSC Testnet 当前地址

当前仓库脚本中的测试网操作参数来自：

- `script/BscTestnetSmoke.s.sol`
- `script/BscTestnetScenarios.s.sol`
- `script/BscTestnetUpgradeAndValidate.s.sol`
- `script/BscTestnetUpgradeExistingOnly.s.sol`
- `script/BscTestnetParlayUpgrade.s.sol`
- `script/BscTestnetModularEntrypointUpgrade.s.sol`
- `script/BscTestnetSettlementNetLossHotfixUpgrade.s.sol`
- `docs/deployment/bsc-testnet-current.json`

| 合约 | 类型 | 地址 |
|---|---|---|
| `ODDToken` | Proxy | `0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0` |
| `StakingPool` | Proxy | `0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F` |
| `LiquidityPool` | Proxy | `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50` |
| `BettingPool` | Proxy | `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3` |
| `BettingPool` | Current implementation | `0x3a4845AAdDf529dd3Ee8F073EA7dE9e565df56DA` |
| `BettingSettlementModule` | Implementation | `0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39` |
| `BettingBetModule` | Implementation | `0xe911D8472F53f64E8B06eAb31E8Ec6Cc5B4c8825` |
| `BettingMarketModule` | Implementation | `0xD786A66a77Ff137A09Aa2fa69BbD8f6AE42f79De` |
| `BettingReferralModule` | Implementation | `0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B` |
| `BettingParlayModule` | Implementation | `0xD7AcFb964C01D4be09757207034FD919dA06fE96` |
| `BettingParlayLens` | Read-only lens | `0xd139C9C041783D48A3D36aedb8Ea7d99859bD2a2` |
| `TierSale` | Proxy | `0xBe938fB7AF656B111a123B749bB724d8351497C7` |
| `HouseVault` | Proxy | `0x41e87F99f1a3dBDb09A337AEf4C4841d90b5d280` |
| `HouseVault` | Current implementation | `0x7e12549BC39B25B1Df4034abEDB9a0109E700128` |
| `DexLaunchController` | Proxy | `0x070f72Fda6eAa8335162A5A5629Fb12f9f8b6d54` |
| `DexLpLocker` | Proxy | `0xC30d6407df0E7291dbE8A58A2c44808C92AFD3a9` |
| `EcosystemRewards` | Proxy | `0x6c5352D01160E50C50b66dD61BD3d48Ff6B4E2ac` |
| `BettingOddsLib` | Library | `0x6d700796d862bdeb4566192f32f4f287a136a1d6` |
| `BettingReferralLib` | Library | `0x41492e7D1fFa49bF0C9cf2eED8A1D134c0E6c44e` |

说明：

- 前端、后端、运营脚本只应直连 `ODDToken / StakingPool / LiquidityPool / BettingPool` 的 proxy 地址；
- `BettingBetModule / BettingMarketModule / BettingReferralModule / BettingSettlementModule / BettingParlayModule` 只通过 `BettingPool` 配置，并由 `BettingPool` 通过 `delegatecall` 调用写路径；
- `BettingParlayLens` 是只读 lens，不持有业务资金，不作为写入口；
- 2026-06-12 BSC Testnet 已按 ODDToken 锁仓与发售 MVP 口径完成全量新部署，上表地址取代 2026-06-01/2026-06-08 旧 proxy；
- 2026-06-12 实链验收覆盖发售/DEX 建池、三类来源质押、普通下注、推荐 ODD/USDT、Cash Out、串关、结算、claim、流动性添加/解绑；`BettingReferralModule` 在实链发现 Pancake V3 `exactInputSingle` selector 问题后已替换为 `0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B`；
- 2026-06-12 已完成 HouseVault L4 兜底注资小升级：保持 `HouseVault / BettingPool` proxy 不变，仅升级 implementation；真实链上验证 tx `0x8c1c1d50283772c1d42d5b3de7291fd2f1822da23b1469047bba680faa0a21f3` 已确认 `platformReserve / accountedBalance / BettingPool ODD balance` 同步增加 `1 ODD`，且 HouseVault 对 BettingPool allowance 归零；
- 2026-06-12 已完成赔率 V3 line module 升级：保持 `BettingPool` proxy 不变，切换 `settlementModule / marketModule / parlayModule`，并部署新版 `BettingParlayLens`；AH `line=10..12` 与 OU `line=3..10` 已可在 BSC Testnet 使用；
- 2026-06-13 已完成结算缺口 `netLoss` hotfix module 升级：保持 `BettingPool` proxy、`BettingMarketModule`、`BettingReferralModule` 与 `BettingParlayLens` 不变，仅切换 `settlementModule / parlayModule`；普通单注和串关赢单的瀑布净缺口均改为扣除下注税后自付资金后再进入 L2/L3/L4；
- implementation 与 library 地址可能随部署或升级变化，业务集成不应把 implementation 地址当成稳定入口；完整部署交易和验证状态见 `docs/deployment/bsc-testnet-current.json`。

---

## 2. 角色与调用方分类

### 2.1 角色

统一定义在 `src/shared/access/Roles.sol`。

| 角色 | 用途 |
|---|---|
| `DEFAULT_ADMIN_ROLE` | 最高治理权限；管理地址、税率、阈值、模块地址等 |
| `UPGRADER_ROLE` | UUPS proxy 升级权限 |
| `PAUSER_ROLE` | 暂停 / 恢复关键写路径 |
| `SETTLER_ROLE` | 比赛/市场比分结算、退款、取消 |
| `OPERATOR_ROLE` | 开盘、赔率更新 |
| `KEEPER_ROLE` | 当前保留的低风险自动执行角色；当前主业务接口里暂未作为核心限制 |
| `WHITELIST_ADMIN_ROLE` | ODDToken 白名单、treasury sink、DEX restricted target 与固定来源配置 |
| `HOUSEVAULT_MANAGER_ROLE` | HouseVault 储备管理预留角色 |
| `DEX_LAUNCHER_ROLE` | DEX launch 标记与建池相关受控操作 |
| `SALE_ADMIN_ROLE` | TierSale 发售管理预留角色 |
| `REWARD_DISTRIBUTOR_ROLE` | EcosystemRewards 奖励额度分配预留角色 |

### 2.2 调用方分类

| 分类 | 调用方 | 特点 |
|---|---|---|
| 公共 API | 任何地址、前端、后端 | 多数为 `view` / 标准查询 |
| 前端 API | 用户钱包 | 需要用户签名并直接改变用户仓位、下注、领奖、授权等状态 |
| 后端 / 治理 API | 运营钱包、结算服务、多签、治理脚本 | 通常有角色限制，或只能被指定合约调用 |

---

## 3. 编码、单位与枚举表

### 3.1 金额、税率、赔率

| 名称 | 精度 | 示例 | 说明 |
|---|---:|---:|---|
| ODD 金额 | `1e18` | `100 ether` = 100 ODD | 所有 ODD 数量、下注额、质押额、LP 金额 |
| BPS | `10_000` | `100` = 1% | 税率、分成比例、权重倍率 |
| 赔率 | `1e4` | `25000` = 2.50 | `baseOdds / quotedOdds / lockedOdds / minOdds` |
| 赔率步长 | `100` | `20100` = 2.01 | 赔率必须不低于 `10100` 且能被 `100` 整除 |

### 3.2 `marketType` 与 `line`

`marketType + line + matchId` 共同决定一个独立 market：

```solidity
marketId = keccak256(abi.encode(matchId, marketType, line));
```

重要约定：

- `line` 是链上枚举索引，不是盘口小数值，也不是小数放大后的整数；
- 同一个 `line` 数字在不同 `marketType` 下含义不同，例如 `line=0` 在 1X2 是占位值，在 AH 是 `home -0.5`，在 OU 是 `1.5`；
- AH 的 `line` 永远按主队视角编码，即 `line` 描述的是 home side 的盘口；
- 若数据源给的是客队视角盘口，后端开盘前必须转换成主队视角，并按合约 outcome 顺序重排 odds；
- 不要把 `-0.25` 传成 `-25`、`-2500` 或二补码整数；链上 `uint8 line=3` 才表示 AH `home -0.25`；
- 不要把 AH `+0` 传成 `line=0`；AH `+0` 的链上编码是 `line=6`，AH `line=0` 表示 `home -0.5`。

| `marketType` | 市场 | 合法 `line` | `line` 业务含义 | outcome 数 |
|---:|---|---|---|---:|
| `0` | 1x2 / 胜平负 | `0` | 无盘口线，占位值 | 3 |
| `1` | AH / 亚洲让球 | `0` | home `-0.5` | 2 |
| `1` | AH / 亚洲让球 | `1` | home `-1.0` | 2 |
| `1` | AH / 亚洲让球 | `2` | home `-1.5` | 2 |
| `1` | AH / 亚洲让球 | `3` | home `-0.25` | 2 |
| `1` | AH / 亚洲让球 | `4` | home `-0.75` | 2 |
| `1` | AH / 亚洲让球 | `5` | home `-1.25` | 2 |
| `1` | AH / 亚洲让球 | `6` | home `+0` | 2 |
| `1` | AH / 亚洲让球 | `7` | home `+0.25` | 2 |
| `1` | AH / 亚洲让球 | `8` | home `+0.5` | 2 |
| `1` | AH / 亚洲让球 | `9` | home `+0.75` | 2 |
| `1` | AH / 亚洲让球 | `10` | home `-1.75` | 2 |
| `1` | AH / 亚洲让球 | `11` | home `-2.0` | 2 |
| `1` | AH / 亚洲让球 | `12` | home `-3.0` | 2 |
| `2` | 大小球 | `0` | 1.5 | 2 |
| `2` | 大小球 | `1` | 2.5 | 2 |
| `2` | 大小球 | `2` | 3.5 | 2 |
| `2` | 大小球 | `3` | 0 | 2 |
| `2` | 大小球 | `4` | 0.5 | 2 |
| `2` | 大小球 | `5` | 1 | 2 |
| `2` | 大小球 | `6` | 1.75 | 2 |
| `2` | 大小球 | `7` | 2 | 2 |
| `2` | 大小球 | `8` | 2.25 | 2 |
| `2` | 大小球 | `9` | 2.75 | 2 |
| `2` | 大小球 | `10` | 3 | 2 |

通用说明：

- 同一场比赛可开多个 market；
- 每个 market 独立记录赔率、下注暴露、WCL、信号灯、结算状态；
- 同一 `matchId` 下多个 market 共用一个 Match Pool；
- `openMarket` 的 `baseOdds.length` 必须等于该 market 的 outcome 数；
- `baseOdds[i]` 与 `outcome=i` 一一对应，不能只改展示文字而不改数组顺序；
- AH / OU full push、half win、half loss 由 score-based 正常结算统一处理，不使用独立 Push 退款入口或子注单。

### 3.3 outcome 编码

合约只校验 `outcome < outcomeCount`，但比分结算会按下表解释 outcome。前端展示、后端开盘和结算服务必须保持同一套编码。

| 市场 | outcome | `baseOdds` 下标 | 含义 |
|---|---:|---:|---|
| 1X2 | `0` | `baseOdds[0]` | 主胜，`homeScore > awayScore` |
| 1X2 | `1` | `baseOdds[1]` | 平局，`homeScore == awayScore` |
| 1X2 | `2` | `baseOdds[2]` | 客胜，`homeScore < awayScore` |
| AH | `0` | `baseOdds[0]` | 主队方向，使用当前 `line` 标注的 home 盘口 |
| AH | `1` | `baseOdds[1]` | 客队方向，是当前 home 盘口的对手盘 |
| OU | `0` | `baseOdds[0]` | Over / 大球 |
| OU | `1` | `baseOdds[1]` | Under / 小球 |

AH 链上统一主队视角：`line` 永远表示主队盘口；`outcome=0` 永远是主队方向，`outcome=1` 永远是客队方向。若数据源返回客队视角盘口，后端必须先换算成主队视角：

| 数据源盘口示例 | 链上编码 | odds 放置方式 |
|---|---|---|
| Home `-0.25` vs Away `+0.25` | `marketType=1,line=3` | `baseOdds[0]=Home -0.25` odds，`baseOdds[1]=Away +0.25` odds |
| Away `-0.25` vs Home `+0.25` | `marketType=1,line=7` | `baseOdds[0]=Home +0.25` odds，`baseOdds[1]=Away -0.25` odds |
| Home `+0` vs Away `+0` | `marketType=1,line=6` | `baseOdds[0]=Home +0` odds，`baseOdds[1]=Away +0` odds |
| Away `-0.75` vs Home `+0.75` | `marketType=1,line=9` | `baseOdds[0]=Home +0.75` odds，`baseOdds[1]=Away -0.75` odds |

### 3.4 AH line 逐线结算注释

AH 结算使用 `scoreDiff = int256(homeScore) - int256(awayScore)`。下表写的是单笔 bet 的链上结果；客队方向不是重新传一条客队 line，而是在同一个 market 内选择 `outcome=1`。

| `line` | home 盘口 | `outcome=0` 主队方向结果 | `outcome=1` 客队方向结果 |
|---:|---|---|---|
| `0` | home `-0.5` | `scoreDiff >= 1` full win；`scoreDiff <= 0` full loss | `scoreDiff <= 0` full win；`scoreDiff >= 1` full loss |
| `1` | home `-1.0` | `scoreDiff >= 2` full win；`scoreDiff == 1` full push；`scoreDiff <= 0` full loss | `scoreDiff <= 0` full win；`scoreDiff == 1` full push；`scoreDiff >= 2` full loss |
| `2` | home `-1.5` | `scoreDiff >= 2` full win；`scoreDiff <= 1` full loss | `scoreDiff <= 1` full win；`scoreDiff >= 2` full loss |
| `3` | home `-0.25` | `scoreDiff >= 1` full win；`scoreDiff == 0` half loss；`scoreDiff <= -1` full loss | `scoreDiff <= -1` full win；`scoreDiff == 0` half win；`scoreDiff >= 1` full loss |
| `4` | home `-0.75` | `scoreDiff >= 2` full win；`scoreDiff == 1` half win；`scoreDiff <= 0` full loss | `scoreDiff <= 0` full win；`scoreDiff == 1` half loss；`scoreDiff >= 2` full loss |
| `5` | home `-1.25` | `scoreDiff >= 2` full win；`scoreDiff == 1` half loss；`scoreDiff <= 0` full loss | `scoreDiff <= 0` full win；`scoreDiff == 1` half win；`scoreDiff >= 2` full loss |
| `6` | home `+0` | `scoreDiff >= 1` full win；`scoreDiff == 0` full push；`scoreDiff <= -1` full loss | `scoreDiff <= -1` full win；`scoreDiff == 0` full push；`scoreDiff >= 1` full loss |
| `7` | home `+0.25` | `scoreDiff >= 1` full win；`scoreDiff == 0` half win；`scoreDiff <= -1` full loss | `scoreDiff <= -1` full win；`scoreDiff == 0` half loss；`scoreDiff >= 1` full loss |
| `8` | home `+0.5` | `scoreDiff >= 0` full win；`scoreDiff <= -1` full loss | `scoreDiff <= -1` full win；`scoreDiff >= 0` full loss |
| `9` | home `+0.75` | `scoreDiff >= 0` full win；`scoreDiff == -1` half loss；`scoreDiff <= -2` full loss | `scoreDiff <= -2` full win；`scoreDiff == -1` half win；`scoreDiff >= 0` full loss |
| `10` | home `-1.75` | `scoreDiff >= 3` full win；`scoreDiff == 2` half win；`scoreDiff <= 1` full loss | `scoreDiff <= 1` full win；`scoreDiff == 2` half loss；`scoreDiff >= 3` full loss |
| `11` | home `-2.0` | `scoreDiff >= 3` full win；`scoreDiff == 2` full push；`scoreDiff <= 1` full loss | `scoreDiff <= 1` full win；`scoreDiff == 2` full push；`scoreDiff >= 3` full loss |
| `12` | home `-3.0` | `scoreDiff >= 4` full win；`scoreDiff == 3` full push；`scoreDiff <= 2` full loss | `scoreDiff <= 2` full win；`scoreDiff == 3` full push；`scoreDiff >= 4` full loss |

资金语义：

- full win：整笔有效注码进入胜出部分，`claimablePayout = winStake * lockedOdds / 1e4`，bet 状态为 `WonUnclaimed`；
- full loss：整笔有效注码进入输掉部分，bet 状态为 `Lost`；
- full push：整笔有效注码退回，bet 状态为 `Refunded`，market 仍通过正常结算进入 `Settled`；
- half win：`winStake = currentStake / 2`，`refundStake = currentStake - winStake`；胜出部分产生 `claimablePayout`，退款部分直接退回，bet 状态为 `WonUnclaimed`；
- half loss：`lossStake = currentStake / 2`，`refundStake = currentStake - lossStake`；输掉部分进入 market 汇总，退款部分直接退回，bet 状态通常为 `Lost`；
- 当 `currentStake` 不能被 2 整除时，余数进入 `refundStake`，不进入 win/loss、margin 或 payout tax；
- `currentStake = acceptedAmount - refundedAmount`，因此提前部分退款后的剩余有效注码才参与比分结算。

### 3.5 OU line 逐线结算注释

OU 支持半球线、整数线和四分之一线；整数线可能 full push，四分之一线可能 half win / half loss。`totalGoals = homeScore + awayScore`。

| `line` | 盘口 | `outcome=0` Over / 大球 | `outcome=1` Under / 小球 |
|---:|---|---|---|
| `0` | `1.5` | `totalGoals >= 2` full win；否则 full loss | `totalGoals <= 1` full win；否则 full loss |
| `1` | `2.5` | `totalGoals >= 3` full win；否则 full loss | `totalGoals <= 2` full win；否则 full loss |
| `2` | `3.5` | `totalGoals >= 4` full win；否则 full loss | `totalGoals <= 3` full win；否则 full loss |
| `3` | `0` | `totalGoals >= 1` full win；`totalGoals == 0` full push | `totalGoals == 0` full push；`totalGoals >= 1` full loss |
| `4` | `0.5` | `totalGoals >= 1` full win；`totalGoals == 0` full loss | `totalGoals == 0` full win；`totalGoals >= 1` full loss |
| `5` | `1` | `totalGoals >= 2` full win；`totalGoals == 1` full push；`totalGoals == 0` full loss | `totalGoals == 0` full win；`totalGoals == 1` full push；`totalGoals >= 2` full loss |
| `6` | `1.75` | `totalGoals >= 3` full win；`totalGoals == 2` half win；`totalGoals <= 1` full loss | `totalGoals <= 1` full win；`totalGoals == 2` half loss；`totalGoals >= 3` full loss |
| `7` | `2` | `totalGoals >= 3` full win；`totalGoals == 2` full push；`totalGoals <= 1` full loss | `totalGoals <= 1` full win；`totalGoals == 2` full push；`totalGoals >= 3` full loss |
| `8` | `2.25` | `totalGoals >= 3` full win；`totalGoals == 2` half loss；`totalGoals <= 1` full loss | `totalGoals <= 1` full win；`totalGoals == 2` half win；`totalGoals >= 3` full loss |
| `9` | `2.75` | `totalGoals >= 4` full win；`totalGoals == 3` half win；`totalGoals <= 2` full loss | `totalGoals <= 2` full win；`totalGoals == 3` half loss；`totalGoals >= 4` full loss |
| `10` | `3` | `totalGoals >= 4` full win；`totalGoals == 3` full push；`totalGoals <= 2` full loss | `totalGoals <= 2` full win；`totalGoals == 3` full push；`totalGoals >= 4` full loss |

### 3.6 1X2 结算注释

1X2 仅支持 `line=0`，该 `line` 只是占位值。

| outcome | 含义 | 结算条件 |
|---:|---|---|
| `0` | 主胜 | `homeScore > awayScore` |
| `1` | 平局 | `homeScore == awayScore` |
| `2` | 客胜 | `homeScore < awayScore` |

### 3.7 状态枚举

| 枚举 | 编码 | 含义 |
|---|---:|---|
| `MarketStatus.Open` | 0 | 可下注；未锁盘、未终态 |
| `MarketStatus.Locked` | 1 | 已锁盘；禁止下注和赔率更新 |
| `MarketStatus.Settled` | 2 | 已正常结算 |
| `MarketStatus.Refunded` | 3 | 已进入退款状态 |
| `MarketStatus.Cancelled` | 4 | 已取消 |
| `BetSettlementState.Pending` | 0 | 注单未结算 |
| `BetSettlementState.Refunded` | 1 | 注单已退款 |
| `BetSettlementState.Lost` | 2 | 注单已判负 |
| `BetSettlementState.WonUnclaimed` | 3 | 注单已中奖但未领取 |
| `BetSettlementState.WonClaimed` | 4 | 注单中奖且已领取 |
| `BetSettlementState.CashedOut` | 5 | 注单已提前 Cash Out，终态关闭 |
| `SignalColor.Green` | 0 | 正常接单 |
| `SignalColor.Yellow` | 1 | 风险升高，赔率开始或即将调整 |
| `SignalColor.Orange` | 2 | 高风险，赔率压缩更明显 |
| `SignalColor.Red` | 3 | 红灯；该方向当前不可继续成交 |
| `PoolType.Global` | 0 | 全局 LP 池 |
| `PoolType.Match` | 1 | 单场比赛 Match Pool |
| `LpPositionState.Active` | 0 | LP 仓位活跃 |
| `LpPositionState.Unbonding` | 1 | 已申请解绑，等待 epoch 成熟 |
| `LpPositionState.Ready` | 2 | `getPositionState` 返回的有效展示状态：锁仓已到期，可申请解绑 |
| `LpPositionState.Withdrawn` | 3 | 已提款 |
| `LpPositionState.Liquidated` | 4 | 亏损覆盖本金，仓位归零 |
| `LpPositionState.Withdrawable` | 5 | 解绑等待已完成，可提款 |
| `StakeSourceType.Manual` | 0 | 用户手动质押 |
| `StakeSourceType.ReferralTax` | 1 | 历史保留枚举；当前推荐奖励自动建仓已移除 |
| `SettlementResultKind.Settled` | 0 | 正常结算，有胜负方向 |
| `SettlementResultKind.Refunded` | 1 | 市场退款 |
| `SettlementResultKind.Cancelled` | 2 | 市场取消 |
| `ParlayState.Pending` | 0 | 串关未结算 |
| `ParlayState.Lost` | 1 | 串关已判负 |
| `ParlayState.WonUnclaimed` | 2 | 串关已中奖但未领取 |
| `ParlayState.WonClaimed` | 3 | 串关中奖且已领取 |
| `ParlayState.Refundable` | 4 | 串关全部有效 leg 都 void，可退本金 |
| `ParlayState.Refunded` | 5 | 串关本金已退回 |
| `ParlayLegResult.Pending` | 0 | 串关 leg 未物化结果 |
| `ParlayLegResult.FullWin` | 1 | leg 全赢 |
| `ParlayLegResult.FullLoss` | 2 | leg 全输 |
| `ParlayLegResult.FullPush` | 3 | leg 全退，不计入组合赔率 |
| `ParlayLegResult.HalfWin` | 4 | leg 半赢，按 `(lockedOdds + 1.00) / 2` 进入组合因子 |
| `ParlayLegResult.HalfLoss` | 5 | leg 半输，按 `0.5` 进入组合因子 |
| `ParlayLegResult.Void` | 6 | leg 所属 market 退款或取消，不计入组合赔率 |

---

## 4. 通用标准 API

以下接口来自 OpenZeppelin 继承，虽然不一定在业务源码中逐个重写，但在 ABI 中真实存在。

### 4.1 AccessControl

适用合约：`ODDToken / TierSale / EcosystemRewards / HouseVault / DexLaunchController / DexLpLocker / StakingPool / LiquidityPool / BettingPool`

#### `DEFAULT_ADMIN_ROLE() returns (bytes32)`

- 分类：公共 API
- 作用：返回默认管理员角色 ID。
- 入参：无。
- 出参：
  - `bytes32`：OpenZeppelin 默认管理员角色 ID，通常为 `0x00`。

#### `hasRole(bytes32 role, address account) returns (bool)`

- 分类：公共 API
- 作用：查询 `account` 是否拥有 `role`。
- 入参：
  - `role: bytes32`：角色 ID，例如 `DEFAULT_ADMIN_ROLE` 或 `OPERATOR_ROLE`；
  - `account: address`：被查询地址。
- 出参：
  - `bool`：`true` 表示拥有该角色。

#### `getRoleAdmin(bytes32 role) returns (bytes32)`

- 分类：公共 API
- 作用：查询哪个 admin role 可以管理 `role`。
- 入参：
  - `role: bytes32`：目标角色 ID。
- 出参：
  - `bytes32`：该角色的管理员角色 ID。

#### `supportsInterface(bytes4 interfaceId) returns (bool)`

- 分类：公共 API
- 作用：ERC165 接口支持查询。
- 入参：
  - `interfaceId: bytes4`：接口 ID。
- 出参：
  - `bool`：是否支持。

#### `grantRole(bytes32 role, address account)`

- 分类：后端 / 治理 API
- 权限：调用者必须拥有 `getRoleAdmin(role)` 返回的 admin role。
- 作用：授予 `account` 某个角色。
- 入参：
  - `role: bytes32`：要授予的角色；
  - `account: address`：获得角色的地址。
- 出参：无。
- 事件：`RoleGranted`。

#### `revokeRole(bytes32 role, address account)`

- 分类：后端 / 治理 API
- 权限：调用者必须拥有 `getRoleAdmin(role)` 返回的 admin role。
- 作用：撤销 `account` 的某个角色。
- 入参：
  - `role: bytes32`：要撤销的角色；
  - `account: address`：被撤销角色的地址。
- 出参：无。
- 事件：`RoleRevoked`。

#### `renounceRole(bytes32 role, address callerConfirmation)`

- 分类：公共 / 自助治理 API
- 作用：调用者主动放弃自己的角色。
- 入参：
  - `role: bytes32`：要放弃的角色；
  - `callerConfirmation: address`：必须等于 `msg.sender`，用于防误操作。
- 出参：无。
- 事件：`RoleRevoked`。

### 4.2 Pausable

适用合约：`ODDToken / TierSale / EcosystemRewards / HouseVault / DexLaunchController / DexLpLocker / StakingPool / LiquidityPool / BettingPool`

#### `paused() returns (bool)`

- 分类：公共 API
- 作用：查询当前合约是否暂停。
- 入参：无。
- 出参：
  - `bool`：`true` 表示关键写路径暂停。

#### `pause()`

- 分类：后端 / 治理 API
- 权限：`PAUSER_ROLE`。
- 作用：暂停关键写路径。
- 入参：无。
- 出参：无。
- 事件：`Paused`。

#### `unpause()`

- 分类：后端 / 治理 API
- 权限：`PAUSER_ROLE`。
- 作用：恢复关键写路径。
- 入参：无。
- 出参：无。
- 事件：`Unpaused`。

### 4.3 UUPS

适用合约：`ODDToken / TierSale / EcosystemRewards / HouseVault / DexLaunchController / DexLpLocker / StakingPool / LiquidityPool / BettingPool`

#### `UPGRADE_INTERFACE_VERSION() returns (string)`

- 分类：公共 API
- 作用：返回当前 OpenZeppelin UUPS 接口版本字符串。
- 入参：无。
- 出参：
  - `string`：接口版本。

#### `proxiableUUID() returns (bytes32)`

- 分类：公共 API
- 作用：返回 UUPS implementation slot UUID。
- 注意：不建议通过 proxy 地址调用；OpenZeppelin 的 `notDelegated` 保护会让 proxy 调用失败。

#### `upgradeToAndCall(address newImplementation, bytes data)`

- 分类：后端 / 治理 API
- 权限：`UPGRADER_ROLE`。
- 作用：升级 proxy 指向的新 implementation，并可选执行初始化 calldata。
- 入参：
  - `newImplementation: address`：新实现合约地址，必须是已部署合约；
  - `data: bytes`：升级后通过 delegatecall 执行的数据；无初始化动作时传空 bytes。
- 出参：无。
- 事件：`Upgraded`。
- 升级约束：
  - implementation 合约本体构造器会执行 `_disableInitializers()`，只锁住 implementation 自己的 storage；
  - 正常升级仍通过 proxy 调用 `upgradeToAndCall(newImplementation, data)`，`data` 中的 `initializeVn / reinitializer` 会通过 delegatecall 写入 proxy storage；
  - 新版本若需要补初始化，应新增 `reinitializer(n)` 入口，并把对应 calldata 放入 `upgradeToAndCall` 的 `data`；
  - 新版本若不需要补初始化，`data` 传空 bytes；
  - 禁止直接对 implementation 地址调用 `initialize / initializeVn / reinitializer`，这不会初始化 proxy，也会因 `_disableInitializers()` revert。

### 4.4 通用标准事件

#### `RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)`

- 适用：AccessControl 合约。
- 作用：角色授予成功。
- 参数：
  - `role: bytes32`：被授予的角色；
  - `account: address`：获得角色的地址；
  - `sender: address`：执行授予的地址。

#### `RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)`

- 适用：AccessControl 合约。
- 作用：角色撤销或主动放弃成功。
- 参数：
  - `role: bytes32`：被撤销的角色；
  - `account: address`：失去角色的地址；
  - `sender: address`：执行撤销或主动放弃的地址。

#### `RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)`

- 适用：AccessControl 合约。
- 作用：角色管理关系变更。
- 参数：
  - `role: bytes32`：目标角色；
  - `previousAdminRole: bytes32`：旧管理员角色；
  - `newAdminRole: bytes32`：新管理员角色。

#### `Paused(address account)`

- 适用：Pausable 合约。
- 作用：合约进入暂停状态。
- 参数：
  - `account: address`：执行暂停的地址。

#### `Unpaused(address account)`

- 适用：Pausable 合约。
- 作用：合约恢复非暂停状态。
- 参数：
  - `account: address`：执行恢复的地址。

#### `Upgraded(address indexed implementation)`

- 适用：UUPS proxy。
- 作用：proxy implementation 升级完成。
- 参数：
  - `implementation: address`：新实现合约地址。

#### `Initialized(uint64 version)`

- 适用：Initializable / reinitializer 合约。
- 作用：初始化或升级初始化完成。
- 参数：
  - `version: uint64`：初始化版本号。
- 说明：UUPS implementation 合约本体构造时已调用 `_disableInitializers()`，`initialize / reinitializer` 仅应通过 proxy 执行。

---

## 5. 结构体返回值字典

### 5.1 `QuoteGuardInput`

用于 `placeBet` 的报价保护结构体。

| 字段 | 类型 | 含义 |
|---|---|---|
| `quoteVersion` | `uint256` | 前端读取 `getMarketOdds` 时得到的当前赔率版本；下注时必须等于链上当前版本 |
| `quotedAt` | `uint64` | 前端读取 `getMarketOdds` 时得到的当前 `updatedAt`；下注时必须等于链上当前值 |
| `minOdds` | `uint256` | 用户可接受的最低锁定赔率，赔率精度 `1e4` |
| `minAcceptedAmount` | `uint256` | 用户可接受的最低成交额；用于防止部分成交过小 |
| `deadline` | `uint256` | 该报价保护的过期时间戳，超过后下注回滚 |

### 5.2 `StakingPool.StakePosition`

| 字段 | 类型 | 含义 |
|---|---|---|
| `owner` | `address` | 仓位 owner |
| `principal` | `uint256` | 质押本金，单位 ODD `1e18` |
| `weight` | `uint256` | 奖励权重，按本金和计划倍率计算 |
| `unlockAt` | `uint64` | 正常解押时间 |
| `rewardDebt` | `uint256` | 建仓时的奖励累加器快照 |
| `planId` | `uint16` | 质押计划编号 |
| `sourceType` | `StakeSourceType` | 仓位来源；当前前端主路径为 `Manual` |
| `active` | `bool` | 是否仍为活跃仓位 |

### 5.3 `LiquidityPool.Pool`

| 字段 | 类型 | 含义 |
|---|---|---|
| `poolType` | `PoolType` | `Global` 或 `Match` |
| `matchId` | `bytes32` | Match Pool 对应比赛 ID；Global Pool 为 `bytes32(0)` |
| `exists` | `bool` | 池是否已创建 |
| `depositOpen` | `bool` | 是否允许继续存入 |
| `depositCloseAt` | `uint64` | Match Pool 存入截止时间，当前等于 `matchStartTime` |
| `unlockAt` | `uint64` | Match Pool 解锁时间，当前等于 `matchEndTime` |
| `totalDeposited` | `uint256` | 当前池内活跃本金合计 |
| `totalWeight` | `uint256` | 当前池内活跃权重合计 |
| `rewardPerWeight` | `uint256` | 每单位权重累计收益，精度 `1e18` |
| `lossPerPrincipal` | `uint256` | 每单位本金累计亏损，精度 `1e18` |

### 5.4 `LiquidityPool.LpPosition`

| 字段 | 类型 | 含义 |
|---|---|---|
| `owner` | `address` | LP 仓位 owner |
| `poolId` | `uint256` | 池 ID；Global Pool 为 `0`，Match Pool 为 `uint256(matchId)` |
| `principal` | `uint256` | LP 本金 |
| `weight` | `uint256` | 分配收益权重；当前 Global Pool 代码按本金计权 |
| `unlockAt` | `uint64` | 可申请解绑的最早时间 |
| `rewardDebt` | `uint256` | 建仓时收益累加器快照 |
| `lossDebt` | `uint256` | 建仓时亏损累加器快照 |
| `unbondingEpoch` | `uint32` | 申请解绑时所在 epoch |
| `frozenRewardPerWeight` | `uint256` | 申请解绑时冻结的收益累加器 |
| `frozenLossPerPrincipal` | `uint256` | 申请解绑时冻结的亏损累加器 |
| `planId` | `uint16` | Global Pool 锁仓计划；Match Pool 固定为 `0` |
| `state` | `LpPositionState` | 仓位状态 |

### 5.5 `LiquidityPool.PayoutLiquidityWindow`

| 字段 | 类型 | 含义 |
|---|---|---|
| `matchId` | `bytes32` | 比赛 ID |
| `reservedAmount` | `uint256` | 当前仍有效的 LP 赔付预留上限；释放 unused reserve 后会下降到 `paidOutAmount` |
| `paidOutAmount` | `uint256` | 已实际转给 `BettingPool` 的赔付流动性 |
| `settledAt` | `uint64` | 最近一次设置预留窗口的时间 |

### 5.6 `BettingPoolStorage.MarketConfig`

| 字段 | 类型 | 含义 |
|---|---|---|
| `matchId` | `bytes32` | 比赛 ID；同场多个 market 共用同一个 Match Pool |
| `marketType` | `uint8` | 市场类型，见 `marketType` 表 |
| `line` | `uint8` | 链上盘口枚举索引，含义取决于 `marketType`；尤其 AH 必须按第 3.2 / 3.4 节的主队视角编码，不是盘口小数值 |
| `outcomeCount` | `uint8` | 该 market 支持的下注方向数 |
| `matchStartTime` | `uint64` | 开赛时间 |
| `lockAt` | `uint64` | 手动封锁时间；未手动封锁时默认等于 `matchEndTime` |
| `status` | `MarketStatus` | 市场状态 |
| `matchEndTime` | `uint64` | 比赛结束边界；结算要求当前时间不早于该值 |

### 5.7 `BettingPoolStorage.Bet`

| 字段 | 类型 | 含义 |
|---|---|---|
| `owner` | `address` | 注单 owner |
| `marketId` | `bytes32` | 所属 market |
| `outcome` | `uint8` | 用户下注方向 |
| `acceptedAmount` | `uint256` | 实际成交注码，不含下注税 |
| `refundedAmount` | `uint256` | 已退还注码 |
| `lockedOdds` | `uint256` | 下单时锁定赔率，精度 `1e4` |
| `acceptedDayBucket` | `uint32` | 成交所在 UTC day bucket，用于每日限额回滚 |
| `settlementState` | `BetSettlementState` | 注单结算状态 |
| `claimablePayout` | `uint256` | 胜单可领取毛赔付 |
| `payoutTaxRateBps` | `uint16` | 结算时快照的派奖税率 |
| `taxAllocStakingBps` | `uint16` | 结算时快照的质押池税收分配 |
| `taxAllocTaxBufferBps` | `uint16` | 结算时快照的 taxBuffer 分配 |
| `taxAllocReferrerBps` | `uint16` | 结算时快照的推荐奖励分配 |
| `referrerSnapshot` | `address` | 结算时快照的推荐人 |

### 5.8 `BettingPoolStorage.UserRiskLedger`

| 字段 | 类型 | 含义 |
|---|---|---|
| `dayBucket` | `uint32` | 当前风险账本对应的 UTC day bucket |
| `dailyAcceptedAmount` | `uint256` | 当日已成交下注额，用于 VIP 每日限额 |
| `unsettledStake` | `uint256` | 用户当前未结算注码 |

### 5.9 `ParlayLegInput`

用于 `BettingPool.placeParlay` 和 `BettingParlayLens.previewParlay` 的单个串关 leg 输入。

| 字段 | 类型 | 含义 |
|---|---|---|
| `marketId` | `bytes32` | 底层 market ID |
| `outcome` | `uint8` | 用户选择方向，必须小于该 market 的 `outcomeCount` |
| `quoteVersion` | `uint256` | 来自 `getMarketOdds(marketId)` 的当前 `quoteVersion` |
| `quotedAt` | `uint64` | 来自 `getMarketOdds(marketId)` 的当前 `updatedAt` |
| `minOdds` | `uint256` | 该 leg 可接受的最低锁定赔率，赔率精度 `1e4` |

### 5.10 `ParlayLeg`

`parlayLegs(parlayId, index)` 的返回结构。

| 字段 | 类型 | 含义 |
|---|---|---|
| `marketId` | `bytes32` | 底层 market ID |
| `matchId` | `bytes32` | 底层比赛 ID；同一张串关内不允许重复 |
| `marketType` | `uint8` | 底层 market 类型，见第 3.2 节 |
| `line` | `uint8` | 底层盘口枚举索引 |
| `outcome` | `uint8` | 用户选择方向 |
| `lockedOdds` | `uint256` | 下串关时该 leg 锁定赔率 |
| `syntheticPayout` | `uint256` | 下单时为该 leg 写入 WCL / 用户 market 潜在赔付的合成最大赔付，当前等于整张串关 `maxPayout` |
| `result` | `ParlayLegResult` | `settleParlay` 后物化的 leg 结果 |

### 5.11 `ParlayBet`

`parlays(parlayId)` 的返回结构。

| 字段 | 类型 | 含义 |
|---|---|---|
| `owner` | `address` | 串关 owner |
| `stake` | `uint256` | 串关注码，不含下注税 |
| `lockedComboOdds` | `uint256` | 锁定组合赔率，赔率精度 `1e4`，最高 `200x` |
| `maxPayout` | `uint256` | 单张串关最大毛赔付；当前最高 `30,000 ODD` |
| `claimablePayout` | `uint256` | 已结算后可领取毛赔付或可退本金 |
| `parlayRiskId` | `bytes32` | 串关专用 riskId，用于 Global LP payout window 和 residual reserve 释放 |
| `acceptedDayBucket` | `uint32` | 成交所在 UTC day bucket |
| `legCount` | `uint8` | leg 数量，当前 `2..6` |
| `state` | `ParlayState` | 串关状态 |
| `payoutTaxRateBps` | `uint16` | 结算为中奖时快照的派奖税率 |
| `taxAllocStakingBps` | `uint16` | 中奖时快照的质押池税收分配 |
| `taxAllocTaxBufferBps` | `uint16` | 中奖时快照的 taxBuffer 分配 |
| `taxAllocReferrerBps` | `uint16` | 中奖时快照的推荐奖励分配 |
| `referrerSnapshot` | `address` | 中奖时快照的推荐人 |

### 5.12 `MarketFinalResult`

`marketFinalResults(marketId)` 的返回结构，供串关结算和 lens 估值读取底层 market 最终结果。

| 字段 | 类型 | 含义 |
|---|---|---|
| `finalized` | `bool` | 该 market 是否已经通过 `finalizeMarketSettlement` 记录最终结果 |
| `resultKind` | `uint8` | `0=Settled,1=Refunded,2=Cancelled` |
| `scoreSettled` | `bool` | 正常结算时是否存在 score-based 比分结果 |
| `homeScore` | `uint16` | score-based 结算记录的主队比分 |
| `awayScore` | `uint16` | score-based 结算记录的客队比分 |

### 5.13 `ParlayPreview`

`BettingParlayLens.previewParlay` 的返回结构。

| 字段 | 类型 | 含义 |
|---|---|---|
| `rawComboOdds` | `uint256` | 未按 `200x` 封顶前的原始组合赔率 |
| `lockedComboOdds` | `uint256` | 实际可锁定组合赔率，已按 `200x` 封顶 |
| `maxPayout` | `uint256` | 当前 stake 对应最大毛赔付，已按 `30,000 ODD` 封顶 |
| `maxRequiredPayout` | `uint256` | 本张串关需要占用的最大赔付容量，当前等于 `maxPayout` |
| `availableParlayCapacity` | `uint256` | 当前可用于新增串关的容量，按 `Global LP requestable + taxBuffer + platformReserve - openParlayMaxPayout` 计算 |
| `cappedByOdds` | `bool` | 是否因组合赔率超过 `200x` 被截断 |
| `cappedByPayout` | `bool` | 是否因毛赔付超过 `30,000 ODD` 被截断 |

### 5.14 `ParlayEstimatedValue`

`BettingParlayLens.estimateParlayValue` 的返回结构。

| 字段 | 类型 | 含义 |
|---|---|---|
| `state` | `uint8` | 当前 `ParlayState` |
| `stake` | `uint256` | 串关注码 |
| `lockedComboOdds` | `uint256` | 下单时锁定组合赔率 |
| `maxPayout` | `uint256` | 单张最大毛赔付 |
| `estimatedValue` | `uint256` | 当前展示估值；不可 claim、不可提现、不是 Cash Out 报价 |
| `floatingPnL` | `int256` | 过程浮动盈亏，`estimatedValue - stake`；仅用于展示 |
| `factorProduct` | `uint256` | 当前估值因子，精度 `1e18` |
| `finalizedLegCount` | `uint8` | 已有最终结果的 leg 数量 |
| `unresolvedLegCount` | `uint8` | 尚未最终结算的 leg 数量 |
| `hasFullLoss` | `bool` | 是否已有任一 leg 全输 |
| `isFinal` | `bool` | 估值是否已经终态 |

---

## 6. ODDToken

**所属合约：** `ODDToken`
**测试网地址：** `0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0`

`ODDToken` 当前实现已进入锁仓与来源账本 Phase 1/2，并已随 `TierSale / EcosystemRewards / HouseVault / DexLaunchController / DexLpLocker` 在 2026-06-12 完成 BSC Testnet 全量新部署。下列新增接口以当前源码和测试网当前 ABI 为准。

Token 仍不承载交易税、黑名单、推荐关系、赔率、结算、LP 瀑布或 staking 公式；新增职责集中在固定总量分配、来源锁仓、业务入金/出金快照、净盈利可转和 DEX launch / swap 受控放行。

### 6.1 前端 API

#### `transfer(address to, uint256 value) returns (bool)`

- 作用：把调用者自己的 ODD 转给 `to`。
- 入参：
  - `to: address`：接收方地址；
  - `value: uint256`：转账数量，单位 ODD `1e18`。
- 出参：
  - `bool`：ERC20 标准返回值，成功返回 `true`。
- 关键校验：
  - 合约未暂停；
  - 调用者余额足够；
  - 普通用户不能直接转入白名单业务合约；
  - 普通用户转出数量不得超过 `transferableBalanceOf(msg.sender)`；
  - TierSale / EcosystemRewards / HouseVault / DexLaunchController 等固定来源地址存在额外出账限制。
- 事件：`Transfer`。

#### `approve(address spender, uint256 value) returns (bool)`

- 作用：授权 `spender` 从调用者账户中转出最多 `value` ODD。
- 入参：
  - `spender: address`：被授权地址，常见为 `StakingPool / LiquidityPool / BettingPool`；
  - `value: uint256`：授权额度，单位 ODD `1e18`。
- 出参：
  - `bool`：成功返回 `true`。
- 事件：`Approval`。
- 前端提示：质押、LP 存入、下注前需先对目标业务合约授权足够额度。

#### `transferFrom(address from, address to, uint256 value) returns (bool)`

- 作用：在 allowance 范围内从 `from` 转 ODD 到 `to`。
- 入参：
  - `from: address`：资金来源地址；
  - `to: address`：接收地址；
  - `value: uint256`：转账数量。
- 出参：
  - `bool`：成功返回 `true`。
- 关键校验：
  - 合约未暂停；
  - `from` 对 `msg.sender` 的 allowance 足够；
  - `from` 余额足够；
  - 普通路径仍必须满足可转余额限制；
  - 只有匹配 DexLaunchController 建池或业务净盈利 swap 的一次性额度时，DEX restricted target 拉币才会被受控放行。
- 事件：`Transfer`，通常还会更新 `Approval` 状态。

#### `burn(uint256 amount)`

- 作用：销毁调用者自己的 ODD，并同步扣减来源账本。
- 入参：
  - `amount: uint256`：销毁数量，必须大于 0。
- 关键校验：
  - 合约未暂停；
  - 调用者余额足够；
  - 按 `businessLocked -> sale -> reward -> transferable` 顺序扣减来源。
- 事件：`Transfer(account,address(0),amount)`、`SourceBurned`。

### 6.2 公共 API

#### `name() returns (string)`

- 作用：返回代币名称。
- 出参：`"OddFi"`。

#### `symbol() returns (string)`

- 作用：返回代币符号。
- 出参：`"ODD"`。

#### `decimals() returns (uint8)`

- 作用：返回代币小数位。
- 出参：`18`。

#### `totalSupply() returns (uint256)`

- 作用：返回总供应量。
- 出参：初始化铸造总量，当前为 `100,000,000 * 1e18`。

#### `balanceOf(address account) returns (uint256)`

- 作用：查询地址 ODD 余额。
- 入参：
  - `account: address`：目标地址。
- 出参：
  - `uint256`：余额，单位 ODD `1e18`。

#### `allowance(address owner, address spender) returns (uint256)`

- 作用：查询 `spender` 仍可从 `owner` 转出的额度。
- 入参：
  - `owner: address`：授权人；
  - `spender: address`：被授权人。
- 出参：
  - `uint256`：剩余额度。

#### `fixedSources() returns (FixedSources)`

- 作用：返回五类固定来源地址。
- 返回字段：
  - `tierSale`
  - `houseVault`
  - `dexLaunchController`
  - `ecosystemRewards`
  - `opsTreasury`

#### `sourceBalanceOf(address account) returns (SourceBreakdown)`

- 作用：返回账户当前来源拆分。
- 返回字段：
  - `saleLocked`：销售来源当前仍锁定数量；
  - `rewardLocked`：奖励来源当前仍锁定数量；
  - `businessLocked`：业务保守锁定剩余数量；
  - `transferable`：当前可自由转出数量。

#### `transferableBalanceOf(address account) returns (uint256)`

- 作用：返回账户当前可自由转出的 ODD。
- 计算口径：`balanceOf(account) - lockedBalanceOf(account)`，若锁定值超过余额则返回 0。

#### `lockedBalanceOf(address account) returns (uint256)`

- 作用：返回账户当前锁定总额。
- 包含：
  - 销售来源按 29 天曲线尚未解锁部分；
  - 奖励来源按 180 天曲线尚未解锁部分；
  - `businessLockedRemaining`。

#### `previewSaleUnlock(address account) returns (uint256 unlockedAmount, uint256 lockedAmount)`

- 作用：预览销售来源当前已解锁和仍锁定数量。
- `poolLaunchTime == 0` 时，销售来源全部视为锁定。

#### `previewRewardUnlock(address account) returns (uint256 unlockedAmount, uint256 lockedAmount)`

- 作用：预览奖励来源当前已解锁和仍锁定数量。
- `poolLaunchTime == 0` 时，奖励来源全部视为锁定。

#### `businessSnapshotOf(bytes32 businessId) returns (BusinessSnapshot)`

- 作用：返回业务入金快照累计状态。
- 关键字段：
  - `businessIn`
  - `totalBusinessOut`
  - `principalReturned`
  - `profitRecognized`
  - `lossRecognized`
  - `finalized`
  - `sourceIn`

#### `businessLossOf(bytes32 businessId) returns (uint256)`

- 作用：返回指定业务快照已确认亏损。

#### `isWhitelist(address account) returns (bool)`

- 作用：查询是否为 ODDToken 白名单业务合约。

#### `isTreasurySink(address account) returns (bool)`

- 作用：查询是否为 treasury sink。

#### `isDexRestrictedTarget(address account) returns (bool)`

- 作用：查询是否为 DEX restricted target。该标记用于防止 Router / PositionManager / V3 Pool 等进入普通业务白名单，并用于一次性 DEX 拉币校验。

### 6.3 后端 / 治理 API

#### `initialize(address adminTimelock, address pauser)`

- 调用时机：仅 proxy 初始化时调用一次。
- 作用：初始化 ERC20、Pausable、AccessControl，并把固定总量铸造到 `address(this)`。
- 入参：
  - `adminTimelock: address`：初始治理/时间锁地址；不能为零地址；
  - `pauser: address`：应急暂停地址；不能为零地址。
- 出参：无。
- 状态变化：
  - 给 `adminTimelock` 授予治理、升级、白名单、sale、reward、house vault、DEX launch 相关角色；
  - 给 `pauser` 授予 `PAUSER_ROLE`；
  - mint `100,000,000 * 1e18` ODD 给 `address(this)`。
- 事件：`TokenInitialized`、`Transfer`。

#### `setFixedSourceContracts(FixedSources calldata sources)`

- 权限：`WHITELIST_ADMIN_ROLE`。
- 作用：配置 TierSale、HouseVault、DexLaunchController、EcosystemRewards、OpsTreasury 五类固定来源。
- 关键校验：
  - 只能配置一次；
  - 前四类地址必须非零且有代码；
  - `opsTreasury` 必须非零。

#### `setWhitelist(address account, bool allowed)`

- 权限：`WHITELIST_ADMIN_ROLE`。
- 作用：配置业务白名单。
- 关键校验：
  - `allowed == true` 时，`account` 必须是合约地址；
  - DEX restricted target 不能进入白名单。

#### `setTreasurySink(address account, bool allowed)`

- 权限：`WHITELIST_ADMIN_ROLE`。
- 作用：配置 treasury sink。

#### `setDexRestrictedTarget(address account, bool restricted)`

- 权限：`WHITELIST_ADMIN_ROLE`。
- 作用：登记 Pancake V3 Router、NonfungiblePositionManager、V3 Pool、旧 V2 Pair / Router、聚合器等限制目标。
- 关键校验：已在白名单中的地址不能被登记为 restricted target。

#### `setDexLaunchTransferTarget(address spender, address pool)`

- 权限：`WHITELIST_ADMIN_ROLE`。
- 作用：配置 DexLaunchController 建池时允许拉 ODD 的 Pancake V3 spender 与目标 pool。
- 关键校验：`spender` 和 `pool` 必须都已登记为 `dexRestrictedTarget`。

#### `allocateInitialSupply()`

- 权限：`WHITELIST_ADMIN_ROLE`。
- 作用：从 `address(this)` 一次性分配固定总量。
- 关键校验：
  - 固定来源已配置；
  - 只能执行一次；
  - `opsTreasury` 已登记为 treasury sink。
- 分配：
  - TierSale：`30,000,000 ether`
  - HouseVault：`25,000,000 ether`
  - DexLaunchController：`10,000,000 ether`
  - EcosystemRewards：`15,000,000 ether`
  - OpsTreasury：`20,000,000 ether`

#### `distributeSalePurchase(address user, uint256 amount)`

- 调用方：只能是已配置的 `tierSale`。
- 作用：把销售 ODD 发给用户，并增加用户销售来源账本。

#### `reclaimSalePurchase(address user, uint256 amount)`

- 调用方：只能是已配置的 `tierSale`。
- 作用：sale cancel/refund 时从用户收回仍可交回的销售来源 ODD，并扣减用户销售来源账本。
- 关键校验：
  - `user != address(0)`；
  - `amount > 0`；
  - 用户 `salePrincipalRemaining >= amount`；
  - 用户已授权 TierSale 足够 ODD。

#### `distributeRewardClaim(address user, uint256 amount)`

- 调用方：只能是已配置的 `ecosystemRewards`。
- 作用：把奖励 ODD 发给用户，并增加用户奖励来源账本。

#### `consumeBusinessInflow(address user, uint16 businessType, bytes32 rawId, uint256 amount) returns (bytes32 businessId)`

- 调用方：白名单业务合约。
- 作用：登记用户进入业务的 ODD，并生成来源快照。
- 关键校验：
  - `businessId = keccak256(abi.encode(msg.sender,businessType,rawId))`；
  - 同一 `businessId` 不得重复；
  - 消耗用户对业务合约的 allowance；
  - 内部完成 `user -> businessContract` 转账。

#### `registerBusinessOutcomeDelta(address user, bytes32 businessId, uint256 businessOutDelta, bool finalized)`

- 调用方：创建该 snapshot 的业务合约。
- 作用：登记用户业务出金、恢复本金来源、确认净盈利或亏损。
- 关键规则：
  - `businessOutDelta` 是本次实际转给用户的 ODD；
  - `businessOutDelta == 0 && finalized == true` 允许，用于全亏损确认；
  - `businessOutDelta == 0 && finalized == false` 失败；
  - finalized 后不得再次登记；
  - 超过本金的部分为净盈利，可转，不新增锁定来源。

#### `registerBusinessProfitAndTransfer(address user, uint16 businessType, bytes32 rawId, uint256 amount) returns (bytes32 businessId)`

- 调用方：白名单业务合约。
- 作用：登记无本金入金的业务净收益，并从业务合约转 ODD 给用户。
- 典型路径：ODD 推荐奖励 claim。

#### `registerBusinessProfitForDexSwap(address user, uint16 businessType, bytes32 rawId, uint256 amount, address routerOrSpender, address expectedPoolOrTarget) returns (bytes32 businessId)`

- 调用方：白名单业务合约。
- 作用：登记业务净收益被用户选择用于 DEX swap，并创建一次性 `transferFrom` 放行额度。
- 关键校验：
  - `routerOrSpender` 和 `expectedPoolOrTarget` 必须是 `dexRestrictedTarget`；
  - 额度只能由匹配的 `from / msg.sender / to` 消耗。

#### `clearBusinessProfitSwapAllowance(address routerOrSpender, address expectedPoolOrTarget) returns (uint256 clearedAmount)`

- 调用方：业务合约自身。
- 作用：清理本业务合约未使用的业务净盈利 swap 一次性额度。

#### `markDexPoolLaunched(uint64 launchTime)`

- 权限：`DEX_LAUNCHER_ROLE`。
- 作用：设置全局 `poolLaunchTime`，启动 sale / reward 解锁曲线。
- 关键校验：
  - 只能设置一次；
  - `launchTime != 0`；
  - `launchTime <= block.timestamp`。

#### `pause()` / `unpause()`

- 权限：`PAUSER_ROLE`。
- 作用：暂停或恢复代币转账。
- 说明：暂停后 `transfer / transferFrom / burn / 业务发放 / 业务入金 / 业务出金` 等路径会回滚；`approve / allowance` 不走转账更新逻辑，当前不受暂停影响。

#### `upgradeToAndCall(address newImplementation, bytes data)`

- 权限：`UPGRADER_ROLE`。
- 作用：升级 Token proxy。

### 6.4 事件

#### `TokenInitialized(address indexed adminTimelock, address indexed pauser, uint256 totalSupply)`

- `adminTimelock`：初始化治理/时间锁地址；
- `pauser`：应急暂停地址；
- `totalSupply`：初始化铸造总量。

#### `FixedSourcesConfigured(...)`

- 固定来源配置事件。

#### `InitialSupplyAllocated(...)`

- 初始供应分配事件。

#### `WhitelistUpdated(address indexed account, bool allowed)`

- 白名单变更事件。

#### `TreasurySinkUpdated(address indexed account, bool allowed)`

- treasury sink 变更事件。

#### `DexRestrictedTargetUpdated(address indexed account, bool restricted)`

- DEX restricted target 变更事件。

#### `DexLaunchTransferTargetUpdated(address indexed spender, address indexed pool)`

- DEX launch 一次性拉币目标配置事件。

#### `SalePurchaseDistributed(address indexed user, uint256 amount)`

- 销售 ODD 发放并登记来源事件。

#### `SalePurchaseReclaimed(address indexed user, uint256 amount)`

- sale cancel/refund 时销售来源 ODD 收回事件。

#### `RewardClaimDistributed(address indexed user, uint256 amount)`

- 奖励 ODD 发放并登记来源事件。

#### `BusinessInflowConsumed(...)`

- 业务入金快照创建事件。

#### `BusinessOutcomeRegistered(...)`

- 业务出金、净盈利、亏损确认事件。

#### `BusinessProfitTransferred(...)`

- 无本金入金的 ODD 净收益转账事件。

#### `BusinessProfitSwapped(...)`

- 业务净收益用于 DEX swap 的一次性额度登记事件。

#### `DexPoolLaunchMarked(uint64 launchTime)`

- DEX pool launch 时间登记事件。

#### `SourceBurned(address indexed account, uint256 amount, SourceBreakdown sourceBurned)`

- burn 来源扣减事件。

#### `Transfer(address indexed from, address indexed to, uint256 value)`

- 标准 ERC20 转账 / mint / burn 事件。

#### `Approval(address indexed owner, address indexed spender, uint256 value)`

- 标准 ERC20 授权事件。

### 6.5 ODDToken MVP 配套合约 API

以下合约是 ODDToken 锁仓与发售 MVP 配套合约，已于 2026-06-12 部署到 BSC Testnet。前后端和脚本应使用第 1 节登记的 proxy 地址，implementation 地址只用于验证和审计追踪。

#### `TierSale.initialize(address admin, address oddTokenAddress, address usdtAddress)`

- 作用：初始化销售合约、ODDToken 和 USDT 地址。
- 关键校验：三个地址均非零，ODDToken 和 USDT 必须有代码。

#### `TierSale.startSale()`

- 权限：`SALE_ADMIN_ROLE`。
- 作用：启动销售，`saleStartTime = block.timestamp`，只能调用一次。

#### `TierSale.buy(uint256 oddAmount) returns (uint256 purchaseId, uint256 usdtAmount)`

- 前端 API。
- 作用：用户按当前档位购买 ODD。
- 关键规则：
  - 购买前用户需先授权 USDT 给 TierSale；
  - 支持跨档计价；
  - 不做部分成交，超过剩余额度直接 revert；
  - 收 USDT 后调用 `ODDToken.distributeSalePurchase`，把 ODD 发给用户并登记 sale source。

#### `TierSale.refundPurchase(uint256 purchaseId, uint256 oddAmount) returns (uint256 usdtAmount)`

- 前端 API。
- 作用：sale cancelled 后，用户交回销售 ODD 并按对应 purchase 比例退 USDT。
- 关键规则：
  - 只能由 purchase owner 调用；
  - 用户需先授权 ODD 给 TierSale；
  - 内部调用 `ODDToken.reclaimSalePurchase` 扣减 sale source；
  - 按该 purchase 剩余未退 USDT 与本次交回 ODD 比例退款。

#### `TierSale.forceFinalize(uint256 usdtAmount, uint256 oddAmount)`

- 权限：`SALE_ADMIN_ROLE`。
- 作用：销售未满时由治理人工确认进入 launch 的 USDT 与 ODD 数量。

#### `TierSale.approveLaunch(address spender, uint256 usdtAmount, uint256 oddAmount)`

- 权限：`SALE_ADMIN_ROLE`。
- 作用：在 soldOut 或 forceFinalized 后，批准 DexLaunchController 拉取指定 USDT，并记录 launch ODD 数量。

#### `TierSale.launchApproval() returns (bool approved, address spender, uint256 usdtAmount, uint256 oddAmount)`

- 作用：供 DexLaunchController 读取 launch 是否已批准及批准金额。

#### `TierSale.previewBuy(uint256 oddAmount) returns (uint256 usdtAmount)`

- 作用：预览本次购买需要支付的 USDT，使用 USDT `decimals()` 换算。

#### `TierSale.getCurrentTier() returns (uint256 tier)` / `getRemainingByTier(uint256 tier)` / `soldOut()`

- 作用：读取当前销售档位、指定档位剩余额度和是否售罄。

#### `TierSale.pauseSale()` / `resumeSale()` / `closeSale()` / `cancelSale()` / `setPerAddressCap(uint256 newCap)`

- 作用：销售暂停、恢复、关闭、取消和单地址购买上限配置。

#### `EcosystemRewards.initialize(address admin, address oddTokenAddress)`

- 作用：初始化奖励合约和 ODDToken 地址。

#### `EcosystemRewards.setCategoryBudget(uint8 category, uint256 budget)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：设置奖励类别预算；不得低于已分配额度。

#### `EcosystemRewards.createClaimable(address user, uint8 category, uint256 amount) returns (uint256 claimId)`

- 权限：`REWARD_DISTRIBUTOR_ROLE`。
- 作用：创建用户可领取奖励额度。

#### `EcosystemRewards.cancelClaimable(uint256 claimId)`

- 权限：`REWARD_DISTRIBUTOR_ROLE`。
- 作用：取消未领取 claimable，并释放类别预算占用。

#### `EcosystemRewards.claim(uint256 claimId)`

- 前端 API。
- 作用：用户领取奖励；内部调用 `ODDToken.distributeRewardClaim`，登记 reward source。

#### `HouseVault.initialize(address admin, address oddTokenAddress)`

- 作用：初始化储备合约和 ODDToken 地址。

#### `HouseVault.transferOdd(address to, uint256 amount)`

- 权限：`HOUSEVAULT_MANAGER_ROLE`。
- 作用：从 HouseVault 向白名单业务合约或 treasury sink 划转 ODD。
- 关键校验：目标不得是 DEX restricted target，且必须是白名单或 treasury sink。

#### `HouseVault.fundBettingPlatformReserve(address bettingPool, uint256 amount)`

- 权限：`HOUSEVAULT_MANAGER_ROLE`。
- 作用：从 HouseVault 向 `BettingPool` 注入 L4 `platformReserve` 兜底资金。
- 资金流：HouseVault 授权 `BettingPool` 后调用 `BettingPool.addPlatformReserve(amount)`；`BettingPool` 再从 HouseVault 拉取 ODD，并同步增加 `platformReserve` 与 `accountedBalance`。
- 关键校验：`bettingPool` 不能为零地址且必须有代码；`amount > 0`；目标 `BettingPool` 必须接受 HouseVault 作为 `ODDToken.fixedSources().houseVault`。
- 部署状态：已升级到 BSC Testnet 当前 `HouseVault` proxy，可调用；验证 tx `0x8c1c1d50283772c1d42d5b3de7291fd2f1822da23b1469047bba680faa0a21f3` 已完成 `1 ODD` L4 注资。

#### `DexLaunchController.initialize(address admin, address oddTokenAddress, address usdtAddress, address tierSaleAddress, address positionManagerAddress, address lpLockerAddress, address treasurySinkAddress)`

- 作用：初始化 DEX launch 控制器。
- 关键校验：核心合约地址非零，ODDToken/USDT/TierSale/PositionManager/DexLpLocker 必须有代码。

#### `DexLaunchController.setLaunchConfig(uint24 poolFee, int24 tickLower, int24 tickUpper, uint160 sqrtPriceX96, uint256 lpLockDuration)`

- 权限：`DEX_LAUNCHER_ROLE`。
- 作用：配置 PancakeSwap V3 pool fee、tick range、初始价格和 LP 锁定期。

#### `DexLaunchController.launch(uint256 oddAmountDesired, uint256 usdtAmountDesired, uint256 oddAmountMin, uint256 usdtAmountMin, uint256 deadline) returns (address launchedPool, uint256 tokenId, uint128 liquidity, uint256 actualOddUsed, uint256 actualUsdtUsed)`

- 权限：`DEX_LAUNCHER_ROLE`。
- 作用：通过 PancakeSwap V3 NonfungiblePositionManager 创建或复用 ODD/USDT pool 并 mint LP NFT。
- 关键规则：
  - 只允许执行一次；
  - 必须先由 TierSale approve launch；
  - 使用 PancakeSwap V3，不使用 V2；
  - launch 时把 PositionManager 和 pool 登记为 `dexRestrictedTarget`，并设置 Token DEX launch 一次性拉币目标；
  - mint recipient 为 `DexLpLocker`；
  - mint 成功后调用 `DexLpLocker.lockPosition(tokenId, unlockAt)`；
  - 成功后调用 `ODDToken.markDexPoolLaunched`。

#### `DexLaunchController.sweepRemainder(address token, address to, uint256 amount)`

- 权限：`DEX_LAUNCHER_ROLE`。
- 作用：launch 后扫回剩余资产。
- 关键校验：若 `token == ODDToken`，`to` 必须是 treasury sink。

#### `DexLpLocker.initialize(address admin, address positionManagerAddress, address beneficiary)`

- 作用：初始化 LP NFT locker。
- 关键校验：
  - `positionManagerAddress` 必须非零且有代码；
  - `beneficiary` 必须非零；
  - 初始化后 `admin` 获得治理、升级、暂停和 `DEX_LAUNCHER_ROLE`。

#### `DexLpLocker.lockPosition(uint256 tokenId, uint64 unlockAt)`

- 权限：`DEX_LAUNCHER_ROLE`。
- 作用：登记已进入 locker 的 Pancake V3 LP NFT 锁定信息。
- 关键校验：
  - locker 当前必须是 `tokenId` owner；
  - `unlockAt > block.timestamp`；
  - 同一 `tokenId` 不能重复锁定。

#### `DexLpLocker.releasePosition(uint256 tokenId, address to)`

- 权限：`DEX_LAUNCHER_ROLE`。
- 作用：LP NFT 到期后释放到指定地址。
- 关键校验：
  - `to != address(0)`；
  - `tokenId` 已锁定且未释放；
  - `block.timestamp >= unlockAt`。

#### `DexLpLocker.setDefaultBeneficiary(address beneficiary)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新后续锁定 position 的默认 beneficiary。

#### `DexLpLocker.lockedPositions(uint256 tokenId) returns (address beneficiary, uint64 lockedAt, uint64 unlockAt, bool released)`

- 作用：查询 LP NFT 锁定状态。

---

## 7. StakingPool

**所属合约：** `StakingPool`
**测试网地址：** `0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F`

`StakingPool` 只维护质押仓位、奖励累加器、VIP 等级读取，不 owner 推荐奖励来源规则。

### 7.1 质押计划与 VIP 基线

| `planId` | 当前源码锁定周期 | 权重倍率 |
|---:|---:|---:|
| `0` | 7 天 | 50% |
| `1` | 30 天 | 100% |
| `2` | 60 天 | 180% |
| `3` | 90 天 | 400% |
| `4` | 180 天 | 800% |
| `5` | 360 天 | 1500% |

默认最小质押额：`100 ODD`。

VIP 由 `activeStakeAmount(user)` 决定，默认 0-10 档；治理可通过 `setVipTierConfig` 修改每档门槛和每日下注上限。

### 7.2 前端 API

#### `stake(uint256 amount, uint16 planId) returns (uint256 positionId)`

- 作用：用户创建一个新的质押仓位。
- 前置操作：用户需先 `ODDToken.approve(StakingPool, amount)`。
- 入参：
  - `amount: uint256`：质押本金，单位 ODD `1e18`，必须不小于 `minStakeAmount`；
  - `planId: uint16`：质押计划编号，当前合法值 `0..5`。
- 出参：
  - `positionId: uint256`：新建仓位 ID，可用于 `positions(positionId)` 查询和后续解押。
- 关键校验：
  - 合约未暂停；
  - `amount >= minStakeAmount`；
  - `planId` 是合法质押计划；
  - allowance 和余额足够。
- 状态变化：
  - 创建 `StakePosition`；
  - `unlockAt = block.timestamp + lockDays * 86400`；
  - `weight = amount * multiplierBps / 10000`；
  - 增加用户活跃质押本金、总权重和账面余额；
  - 通过 `ODDToken.consumeBusinessInflow(user, STAKING_POSITION, positionId, amount)` 从用户转入 ODD，并创建 staking 业务来源快照。
- 事件：`StakeCreated`、`StakeAccountingSnapshot`、`Transfer`。

#### `unstake(uint256 positionId)`

- 作用：仓位到期后正常解押，领取本金和已累积奖励。
- 入参：
  - `positionId: uint256`：调用者自己的活跃仓位 ID。
- 出参：无。
- 关键校验：
  - 合约未暂停；
  - `msg.sender` 是仓位 owner；
  - 仓位仍 active；
  - `block.timestamp >= unlockAt`。
- 状态变化：
  - 仓位置为非活跃；
  - 扣减活跃本金、总权重、账面余额；
  - 通过 `ODDToken.registerBusinessOutcomeDelta(user, businessId, principal + pendingReward, true)` 登记出金，本金部分恢复原来源，`pendingReward` 作为净盈利变为可转。
- 事件：`StakeWithdrawn(early=false)`、`StakeAccountingSnapshot`。

#### `earlyUnstake(uint256 positionId)`

- 作用：仓位未到期时提前解押。
- 入参：
  - `positionId: uint256`：调用者自己的活跃仓位 ID。
- 出参：无。
- 关键校验：
  - 合约未暂停；
  - `msg.sender` 是仓位 owner；
  - 仓位仍 active；
  - `block.timestamp < unlockAt`。
- 状态变化：
  - 用户只取回本金；
  - 未领取奖励不会给提前解押用户，若还有其他活跃质押者则重新注入奖励累加器，否则转给平台金库。
  - 通过 `ODDToken.registerBusinessOutcomeDelta(user, businessId, principal, true)` 登记本金返还并关闭业务快照。
- 事件：`StakeWithdrawn(early=true)`，必要时触发 `RewardNotified` 或 `RewardRedirectedToPlatform`。

### 7.3 公共 API

#### `getActiveStakeAmount(address user) returns (uint256)`

- 作用：查询用户当前活跃质押本金。
- 入参：
  - `user: address`：目标用户。
- 出参：
  - `uint256`：活跃本金，单位 ODD `1e18`。
- 业务用途：BettingPool 用它判断用户 VIP 档位和每日下注上限。

#### `getUserTier(address user) returns (uint8)`

- 作用：按当前活跃质押本金查询 VIP 档位。
- 入参：
  - `user: address`：目标用户。
- 出参：
  - `uint8`：VIP 档位，默认 `0..10`。

#### `getUserDailyLimit(address user) returns (uint256)`

- 作用：查询用户当前每日下注限额。
- 入参：
  - `user: address`：目标用户。
- 出参：
  - `uint256`：每日可成交下注额上限，单位 ODD `1e18`。

#### `isActiveStaker(address user) returns (bool)`

- 作用：判断用户是否有活跃质押本金。
- 入参：
  - `user: address`：目标用户。
- 出参：
  - `bool`：`activeStakeAmount(user) > 0`。

#### 公共 getter

| Getter | 返回值含义 |
|---|---|
| `positions(uint256 positionId)` | 指定质押仓位详情 |
| `activeStakeAmount(address user)` | 用户活跃质押本金 |
| `nextPositionId()` | 下一个质押仓位 ID |
| `accRewardPerShare()` | 当前奖励累加器，精度 `1e18` |
| `totalWeightedShares()` | 活跃质押权重总和 |
| `accountedOddBalance()` | 质押池内部账面 ODD |
| `minStakeAmount()` | 最小质押额 |
| `oddToken()` | ODDToken 地址 |
| `platformTreasury()` | 平台金库地址 |
| `bettingPool()` | 允许调用 `notifyReward` 的 BettingPool 地址 |

### 7.4 后端 / 治理 API

#### `initialize(address admin, address oddTokenAddress, address initialPlatformTreasury)`

- 调用时机：仅 proxy 初始化时调用一次。
- 作用：初始化质押池、角色、ODD 地址、平台金库、默认 VIP 配置。
- 入参：
  - `admin: address`：初始治理地址；
  - `oddTokenAddress: address`：ODDToken proxy 地址；
  - `initialPlatformTreasury: address`：平台金库地址。
- 出参：无。
- 关键校验：三个地址均不能为零地址。
- 事件：`StakingInitialized`、`StakingConfigUpdated`、`VipConfigUpdated`。

#### `initializeV2(address initialBettingPool)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 调用时机：升级到 V2 后补初始化。
- 作用：设置允许注入奖励的 BettingPool 地址。
- 入参：
  - `initialBettingPool: address`：BettingPool proxy 地址，不能为零地址。
- 出参：无。
- 事件：`BettingPoolUpdated`。

#### `notifyReward(uint256 amount)`

- 分类：跨合约 API。
- 权限：仅 `bettingPool` 地址。
- 作用：BettingPool 在派奖税分账时把质押池份额注入本池。
- 入参：
  - `amount: uint256`：本次奖励金额，单位 ODD `1e18`，必须大于 0。
- 出参：无。
- 关键校验：
  - `msg.sender == bettingPool`；
  - 质押池实际 ODD 余额已包含这笔奖励。
- 暂停语义：
  - 不受 `StakingPool.pause()` 影响；pause 只冻结用户 `stake / unstake / earlyUnstake` 等主动操作，不阻断 BettingPool 已结算胜单 `claimPayout` 时的派奖税注入。
- 状态变化：
  - 若 `totalWeightedShares > 0`，增加 `accRewardPerShare`；
  - 若无活跃权重，则奖励转给 `platformTreasury`。
- 事件：`RewardNotified` 或 `RewardRedirectedToPlatform`。

#### `setPlatformTreasury(address newPlatformTreasury)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新平台金库地址。
- 入参：
  - `newPlatformTreasury: address`：新金库，不能为零地址。
- 出参：无。
- 事件：`StakingConfigUpdated`。

#### `setBettingPool(address newBettingPool)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新允许调用 `notifyReward` 的 BettingPool 地址。
- 入参：
  - `newBettingPool: address`：新 BettingPool proxy 地址，不能为零地址。
- 出参：无。
- 事件：`BettingPoolUpdated`。

#### `setMinStakeAmount(uint256 newMinStakeAmount)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新最小质押额。
- 入参：
  - `newMinStakeAmount: uint256`：新最小值，必须大于 0。
- 出参：无。
- 事件：`MinStakeAmountUpdated`。

#### `setVipTierConfig(uint8 tier, uint256 threshold, uint256 dailyLimit)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新单个 VIP 档位的门槛和每日下注限额。
- 入参：
  - `tier: uint8`：目标档位，合法范围 `0..10`；
  - `threshold: uint256`：该档位最低活跃质押本金，单位 ODD `1e18`；
  - `dailyLimit: uint256`：该档位每日下注成交额上限，单位 ODD `1e18`。
- 关键校验：
  - `tier < 11`；
  - `tier = 0` 时 `threshold` 必须为 0；
  - threshold 与 dailyLimit 必须保持相邻档位单调不逆序。
- 出参：无。
- 事件：`VipTierConfigUpdated`、`VipConfigUpdated`。

### 7.5 事件

#### `StakingInitialized(address indexed admin, address indexed oddToken, address indexed treasury)`

- 初始化完成事件。
- `admin`：初始治理地址；
- `oddToken`：ODDToken 地址；
- `treasury`：平台金库地址。

#### `StakeCreated(uint256 indexed positionId, address indexed user, uint256 principal, uint16 planId, uint8 sourceType, uint256 weight, uint64 unlockAt)`

- 用户创建质押仓位。
- `positionId`：仓位 ID；
- `user`：仓位 owner；
- `principal`：本金；
- `planId`：计划编号；
- `sourceType`：仓位来源；
- `weight`：奖励权重；
- `unlockAt`：可正常解押时间。

#### `StakeWithdrawn(uint256 indexed positionId, address indexed user, uint256 principal, uint256 reward, bool early)`

- 用户解押事件。
- `reward`：本次实际领取或释放的奖励金额；
- `early`：是否提前解押。

#### `RewardNotified(address indexed caller, uint256 amount, uint256 newAccRewardPerShare)`

- 新奖励进入质押累加器。

#### `RewardRedirectedToPlatform(address indexed caller, uint256 amount, address indexed treasury)`

- 无活跃质押权重时，奖励转给平台金库。

#### `StakingConfigUpdated(address indexed operator, address indexed treasury)`

- 平台金库配置更新。

#### `BettingPoolUpdated(address indexed operator, address indexed bettingPool)`

- BettingPool 地址更新。

#### `MinStakeAmountUpdated(address indexed operator, uint256 oldAmount, uint256 newAmount)`

- 最小质押额更新。

#### `VipConfigUpdated(address indexed operator, bytes32 configHash)`

- VIP 配置整体 hash 更新。

#### `VipTierConfigUpdated(address indexed operator, uint8 indexed tier, uint256 threshold, uint256 dailyLimit)`

- 单个 VIP 档位更新。

#### `StakeAccountingSnapshot(uint256 indexed positionId, address indexed user, uint8 actionKind, uint256 activeStakeAfter, uint256 totalWeightedSharesAfter, uint256 accountedOddBalanceAfter, uint256 accRewardPerShareAfter)`

- 质押池会计快照。
- `actionKind` 当前代码含义：
  - `0`：手动质押；
  - `2`：奖励注入；
  - `3`：奖励转平台；
  - `4`：正常解押；
  - `5`：提前解押。

---

## 8. LiquidityPool

**所属合约：** `LiquidityPool`
**测试网地址：** `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50`

`LiquidityPool` owner Global Pool / Match Pool、LP 仓位、requestable liquidity、payout window 和 L2 loss / margin 会计。

### 8.1 LP 计划与池关系

| 池 | `poolId` | 创建方式 | 存入截止 | 解锁条件 |
|---|---|---|---|---|
| Global Pool | `0` | 初始化即存在 | 持续开放 | 按 `planId` 锁定天数 |
| Match Pool | `uint256(matchId)` | BettingPool 第一次为比赛 `openMarket` 时自动创建 | `matchStartTime` | 仓位 `unlockAt = matchEndTime`；申请解绑还要求该比赛所有 market 终态 |

Global Pool 当前计划：

| `planId` | 当前源码锁定周期 | 显示倍率 |
|---:|---:|---:|
| `0` | 7 天 | 50% |
| `1` | 14 天 | 100% |
| `2` | 28 天 | 180% |
| `3` | 60 天 | 250% |
| `4` | 90 天 | 350% |

注意：当前 v2 会计代码中，Global Pool 的实际 `weight = amount`，锁仓倍率保留为显示/计划语义；Match Pool 权重倍率为 100%。

默认最小 LP 存入额：`1,000 ODD`。

### 8.2 前端 API

#### `depositGlobal(uint256 amount, uint16 planId) returns (uint256 positionId)`

- 作用：向 Global Pool 存入 ODD，创建 LP 仓位。
- 前置操作：用户需先 `ODDToken.approve(LiquidityPool, amount)`。
- 入参：
  - `amount: uint256`：存入金额，单位 ODD `1e18`，必须不小于 `minDeposit`；
  - `planId: uint16`：Global Pool 计划编号，当前合法值 `0..4`。
- 出参：
  - `positionId: uint256`：新 LP 仓位 ID。
- 关键校验：
  - 合约未暂停；
  - `amount >= minDeposit`；
  - `planId` 合法；
  - Global Pool 开放；
  - allowance 和余额足够。
- 状态变化：
  - 创建 `LpPosition`；
  - `poolId = 0`；
  - `unlockAt = block.timestamp + lockDays * 86400`；
  - 增加 `pools[0].totalDeposited / totalWeight`；
  - 增加 `totalActiveDeposited / requestableLiquidity`；
  - 通过 `ODDToken.consumeBusinessInflow(user, LP_POSITION, positionId, amount)` 从用户转入 ODD，并创建 LP 业务来源快照。
- 事件：`LiquidityDeposited`、`LiquidityAccountingSnapshot`。

#### `depositMatch(bytes32 matchId, uint256 amount) returns (uint256 positionId)`

- 作用：向某场比赛的 Match Pool 存入 ODD。
- 前置操作：
  - 该比赛必须已经由 `BettingPool.openMarket` 首次触发 `openMatchPool`；
  - 用户需先 `ODDToken.approve(LiquidityPool, amount)`。
- 入参：
  - `matchId: bytes32`：比赛 ID；
  - `amount: uint256`：存入金额，单位 ODD `1e18`。
- 出参：
  - `positionId: uint256`：新 LP 仓位 ID。
- 关键校验：
  - 合约未暂停；
  - Match Pool 已存在且类型正确；
  - `depositOpen = true`；
  - `block.timestamp < depositCloseAt`，当前即开赛前；
  - `amount >= minDeposit`。
- 状态变化：
  - 创建 `poolId = uint256(matchId)` 的 LP 仓位；
  - `unlockAt = matchEndTime`；
  - 增加 Match Pool 活跃本金、权重和全局可接单流动性；
  - 通过 `ODDToken.consumeBusinessInflow(user, LP_POSITION, positionId, amount)` 从用户转入 ODD，并创建 LP 业务来源快照。
- 事件：`LiquidityDeposited`、`LiquidityAccountingSnapshot`。

#### `requestUnbond(uint256 positionId)`

- 作用：用户在仓位可退出后申请解绑。
- 入参：
  - `positionId: uint256`：调用者自己的 LP 仓位 ID。
- 出参：无。
- 关键校验：
  - 合约未暂停；
  - `msg.sender` 是仓位 owner；
  - 仓位的存储状态必须是 `Active`；
  - `block.timestamp >= position.unlockAt`；
  - 若是 Match Pool，`BettingPool.isMatchTerminal(matchId)` 必须为 true。
- 状态变化：
  - 冻结当前 `rewardPerWeight / lossPerPrincipal`；
  - 记录 `unbondingEpoch`；
  - 状态变为 `Unbonding`；
  - 从活跃池会计中移除该仓位价值，减少 `requestableLiquidity`。
- 事件：`UnbondRequested`、`LiquidityPositionStateChanged`、`LiquidityAccountingSnapshot`。

#### `withdraw(uint256 positionId)`

- 作用：解绑等待期结束后提取 LP 仓位资产。
- 入参：
  - `positionId: uint256`：调用者自己的 LP 仓位 ID。
- 出参：无。
- 关键校验：
  - 合约未暂停；
  - `msg.sender` 是仓位 owner；
  - 仓位必须已经走过 `requestUnbond`；
  - 存储状态必须是 `Unbonding` 或 `Withdrawable`；代码也接受 `Ready` 枚举值，但当前主流程不会把仓位存储状态写成 `Ready`；
  - 当前 epoch 必须达到 `unbondingEpoch + unbondEpochs + 1`。
- 状态变化：
  - 根据冻结的收益/亏损累加器计算 `withdrawAmount` 和 `netPnl`；
  - 若亏损覆盖本金，最终状态为 `Liquidated`，提款为 0；
  - 否则最终状态为 `Withdrawn` 并转出 ODD；
  - 始终通过 `ODDToken.registerBusinessOutcomeDelta(user, businessId, withdrawAmount, true)` 登记 LP 业务结果，亏损时扣减业务锁定，净盈利时增加用户可转余额。
- 事件：`LiquidityWithdrawn`、`LiquidityPositionStateChanged`、`LiquidityAccountingSnapshot`。

#### `previewWithdraw(uint256 positionId) returns (uint256 withdrawAmount, int256 netPnl, LpPositionState effectiveState)`

- 作用：预览指定 LP 仓位按当前状态可提款金额。
- 入参：
  - `positionId: uint256`：LP 仓位 ID。
- 出参：
  - `withdrawAmount: uint256`：按冻结收益/亏损累加器计算出的 ODD 提款数量；未进入 `Unbonding / Withdrawable` 时返回 `0`；
  - `netPnl: int256`：按冻结收益/亏损累加器计算的净收益或净亏损；未进入 `Unbonding / Withdrawable` 时返回 `0`；
  - `effectiveState: LpPositionState`：与 `getPositionState(positionId)` 一致的有效状态。
- 说明：
  - 该接口只读，不校验调用者是否为仓位 owner；
  - 仓位在 `requestUnbond` 时冻结收益/亏损累加器，因此解绑后 preview 金额与后续 `withdraw` 执行口径一致；
  - `effectiveState == Withdrawable` 时，返回金额即可作为前端展示的当前可提款数量；`Unbonding` 阶段返回的是等待期结束后的预计提款数量。

### 8.3 公共 API

#### `getPayoutLiquidityWindow(bytes32 matchId) returns (uint256 reservedAmount, uint256 paidOutAmount, uint256 settledAt)`

- 作用：查询某比赛的 LP 赔付预留窗口。
- 入参：
  - `matchId: bytes32`：比赛 ID。
- 出参：
  - `reservedAmount: uint256`：当前仍有效的 LP 赔付预留上限；
  - `paidOutAmount: uint256`：已实际转给 BettingPool 的金额；
  - `settledAt: uint256`：最近一次设置预留窗口时间戳。

#### `getPoolWeights(bytes32 matchId) returns (uint256 globalWeight, uint256 matchWeight)`

- 作用：查询 Global Pool 和指定 Match Pool 当前活跃权重。
- 入参：
  - `matchId: bytes32`：比赛 ID。
- 出参：
  - `globalWeight: uint256`：Global Pool 活跃权重；
  - `matchWeight: uint256`：该 Match Pool 活跃权重。
- 业务用途：BettingPool 结算时按权重拆分 LP margin。

#### `getPositionState(uint256 positionId) returns (LpPositionState)`

- 作用：返回对前端更友好的有效状态。
- 入参：
  - `positionId: uint256`：LP 仓位 ID。
- 出参：
  - `LpPositionState`：若 active 仓位已到 `unlockAt`，返回 `Ready`；若 unbonding 已过等待期，返回 `Withdrawable`。
- 说明：这是前端展示用的有效状态，不一定等于 `positions[positionId].state` 的原始存储值；显示为 `Ready` 时下一步应调用 `requestUnbond`，不是直接 `withdraw`。

#### `getRequestableLiquidity() returns (uint256)`

- 作用：查询当前可用于接单和承接 L2 风险的流动性。
- 入参：无。
- 出参：
  - `uint256`：可请求流动性，单位 ODD `1e18`。

#### `getGlobalRequestableLiquidity() returns (uint256)`

- 作用：查询当前 Global Pool 可用于串关和 Global 风险的流动性。
- 入参：无。
- 出参：
  - `uint256`：Global Pool 可请求流动性，单位 ODD `1e18`。
- 业务用途：
  - `BettingParlayModule` 和 `BettingParlayLens` 用它计算串关可用容量；
  - 串关不使用任意单场 Match Pool 承担跨场亏损，只使用 Global Pool、taxBuffer 和 platformReserve。

#### 公共 getter

| Getter | 返回值含义 |
|---|---|
| `pools(uint256 poolId)` | 池详情 |
| `positions(uint256 positionId)` | LP 仓位详情 |
| `payoutWindows(bytes32 matchId)` | 赔付预留窗口 |
| `epochStart()` | epoch 起始时间 |
| `minDeposit()` | 最小 LP 存入额 |
| `unbondEpochs()` | 解绑等待 epoch 数 |
| `nextLpPositionId()` | 下一个 LP 仓位 ID |
| `oddToken()` | ODDToken 地址 |
| `totalActiveDeposited()` | 全部活跃 LP 本金 |
| `totalOutstandingPayoutReserved()` | 尚未实际支付的赔付预留总额 |
| `requestableLiquidity()` | 当前可请求流动性 |
| `globalRequestableLiquidity()` | Global Pool 当前可请求流动性 |
| `globalRequestableLiquidityInitialized()` | Global requestable liquidity 是否已完成升级初始化 |
| `bettingPool()` | 被允许调用结算相关接口的 BettingPool 地址 |

### 8.4 后端 / 治理 API

#### `initialize(address admin, address oddTokenAddress, address initialBettingPool)`

- 调用时机：仅 proxy 初始化时调用一次。
- 作用：初始化 Global Pool、角色、ODD 地址、BettingPool 地址和基础参数。
- 入参：
  - `admin: address`：初始治理地址；
  - `oddTokenAddress: address`：ODDToken proxy 地址；
  - `initialBettingPool: address`：BettingPool proxy 地址。
- 关键校验：三个地址均不能为零地址。
- 出参：无。
- 事件：`LiquidityConfigUpdated`。

#### `initializeGlobalRequestableLiquidity(uint256 value)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 调用时机：LiquidityPool 升级到包含 `globalRequestableLiquidity` 的版本后补初始化一次。
- 作用：初始化 Global Pool 可请求流动性快照，供串关容量和 Global risk 会计使用。
- 入参：
  - `value: uint256`：初始化的 Global 可请求流动性，通常由升级脚本按当前 Global Pool 状态传入。
- 出参：无。
- 关键校验：
  - `globalRequestableLiquidityInitialized` 必须为 `false`，已经初始化后再次调用会 revert。
- 状态变化：
  - 写入 `globalRequestableLiquidity = value`；
  - 写入 `globalRequestableLiquidityInitialized = true`。

#### `setBettingPool(address newBettingPool)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新唯一允许调用 `openMatchPool / distributeLoss / requestPayoutLiquidity` 等接口的 BettingPool 地址。
- 入参：
  - `newBettingPool: address`：新 BettingPool 地址，不能为零地址。
- 出参：无。
- 事件：`LiquidityConfigUpdated`。

#### `setMinDeposit(uint256 newMinDeposit)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新 LP 最小存入额。
- 入参：
  - `newMinDeposit: uint256`：新最小额，必须大于 0。
- 出参：无。
- 事件：`MinDepositUpdated`。

#### `setUnbondEpochs(uint32 newUnbondEpochs)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新 LP 解绑等待 epoch 数。
- 入参：
  - `newUnbondEpochs: uint32`：新等待 epoch 数，必须大于 0。
- 出参：无。
- 事件：`UnbondEpochsUpdated`。

#### `openMatchPool(bytes32 matchId, uint64 matchStartTime, uint64 matchEndTime)`

- 分类：跨合约 API。
- 权限：仅 `bettingPool`。
- 作用：首次为某比赛开 market 时，创建该比赛的 Match Pool。
- 入参：
  - `matchId: bytes32`：比赛 ID，不能为 `bytes32(0)`；
  - `matchStartTime: uint64`：开赛时间，也是 Match Pool 存入截止时间；
  - `matchEndTime: uint64`：比赛结束时间，也是 Match Pool unlockAt。
- 关键校验：
  - `matchStartTime > 0`；
  - `matchEndTime > matchStartTime`；
  - `pools[uint256(matchId)]` 尚不存在。
- 状态变化：
  - 创建 `PoolType.Match` 池；
  - `depositOpen = true`；
  - `depositCloseAt = matchStartTime`；
  - `unlockAt = matchEndTime`。
- 事件：`MatchPoolOpened`、`LiquidityAccountingSnapshot(actionKind=2)`。
- 关系说明：该接口不应由后端直接调用，正常由 `BettingPool.openMarket` 第一次遇到该 `matchId` 时自动调用。

#### `closeMatchPoolDeposit(bytes32 matchId)`

- 分类：跨合约 API。
- 权限：仅 `bettingPool`。
- 作用：手动封锁 market 时关闭该比赛 Match Pool 的新存入。
- 入参：
  - `matchId: bytes32`：比赛 ID。
- 关键校验：Match Pool 必须存在且类型正确。
- 状态变化：
  - `depositOpen = false`。
- 事件：`MatchPoolDepositClosed`、`LiquidityAccountingSnapshot(actionKind=3)`。

#### `distributeMargin(bytes32 matchId, uint256 lpMarginShare)`

- 分类：跨合约 API。
- 权限：仅 `bettingPool`。
- 作用：市场结算后，将 LP 应得 margin 计入 Global Pool 和 Match Pool 的收益累加器。
- 入参：
  - `matchId: bytes32`：比赛 ID；
  - `lpMarginShare: uint256`：BettingPool 转入并应分给 LP 的 margin，单位 ODD `1e18`。
- 出参：无。
- 分配规则：
  - 若只有 Global 权重，则全部给 Global；
  - 若只有 Match 权重，则全部给 Match；
  - 两者都有时按 `globalWeight : matchWeight` 拆分。
- 状态变化：
  - 增加对应 pool 的 `rewardPerWeight`；
  - 增加 `requestableLiquidity`。
- 事件：`MarginDistributed`、`LiquidityAccountingSnapshot(actionKind=4)`。

#### `distributeLoss(bytes32 matchId, uint256 netLoss) returns (uint256 lpLossBooked)`

- 分类：跨合约 API。
- 权限：仅 `bettingPool`。
- 作用：结算亏损进入瀑布 L2 时，由 LP 池按可用流动性实际承担亏损。
- 入参：
  - `matchId: bytes32`：比赛 ID；
  - `netLoss: uint256`：需要 L2 尝试承担的净亏损，单位 ODD `1e18`。
- 出参：
  - `lpLossBooked: uint256`：LP 实际承担金额；可能小于 `netLoss`。
- 关键逻辑：
  - `lpLossBooked = min(netLoss, requestableLiquidity)`；
  - Global / Match 按活跃本金比例分摊；
  - 增加 `lossPerPrincipal`；
  - 减少 `requestableLiquidity`；
  - 设置 payout window 的 `reservedAmount`。
- 事件：`LossDistributed`、`PayoutLiquidityReserved`、`LiquidityAccountingSnapshot(actionKind=5)`。

#### `distributeGlobalMargin(bytes32 riskId, uint256 lpMarginShare)`

- 分类：跨合约 API。
- 权限：仅 `bettingPool`。
- 作用：串关或其他 Global risk 结算后，将 LP 应得 margin 只计入 Global Pool。
- 入参：
  - `riskId: bytes32`：Global 风险 ID；串关使用 `parlayRiskId`；
  - `lpMarginShare: uint256`：BettingPool 转入并应分给 Global LP 的 margin，单位 ODD `1e18`。
- 出参：无。
- 状态变化：
  - 有 Global 权重时增加 Global Pool `rewardPerWeight`；
  - 增加 `requestableLiquidity` 与 `globalRequestableLiquidity`；
  - 无 Global 权重或金额为 0 时只发事件，不改变资金账本。
- 事件：`GlobalMarginDistributed`、`MarginDistributed`、`LiquidityAccountingSnapshot(actionKind=9)`。

#### `distributeGlobalLoss(bytes32 riskId, uint256 netLoss) returns (uint256 lpLossBooked)`

- 分类：跨合约 API。
- 权限：仅 `bettingPool`。
- 作用：串关或其他 Global risk 亏损进入瀑布 L2 时，仅由 Global Pool 按可用流动性承担亏损。
- 入参：
  - `riskId: bytes32`：Global 风险 ID；串关使用 `parlayRiskId`；
  - `netLoss: uint256`：需要 L2 尝试承担的净亏损，单位 ODD `1e18`。
- 出参：
  - `lpLossBooked: uint256`：Global LP 实际承担金额，可能小于 `netLoss`。
- 关键逻辑：
  - `lpLossBooked = min(netLoss, globalRequestableLiquidity, requestableLiquidity)`；
  - 增加 Global Pool `lossPerPrincipal`；
  - 减少 `requestableLiquidity` 与 `globalRequestableLiquidity`；
  - 用 `riskId` 设置 payout window 的 `reservedAmount`。
- 事件：`GlobalLossDistributed`、`LossDistributed`、`PayoutLiquidityReserved`、`LiquidityAccountingSnapshot(actionKind=10)`。

#### `requestPayoutLiquidity(bytes32 matchId, uint256 amount)`

- 分类：跨合约 API。
- 权限：仅 `bettingPool`。
- 作用：BettingPool 派奖余额不足时，从已预留赔付窗口中拉取 ODD。
- 入参：
  - `matchId: bytes32`：比赛 ID；
  - `amount: uint256`：本次请求转给 BettingPool 的金额。
- 关键校验：
  - payout window 已存在；
  - `amount <= reservedAmount - paidOutAmount`；
  - LiquidityPool 实际 ODD 余额足够。
- 状态变化：
  - 增加 `paidOutAmount`；
  - 减少 `totalOutstandingPayoutReserved`；
  - 转 ODD 给 `bettingPool`。
- 事件：`PayoutLiquidityTransferred`、`LiquidityAccountingSnapshot(actionKind=8)`。

#### `releasePayoutReserve(bytes32 matchId) returns (uint256 releasedAmount)`

- 分类：跨合约 API。
- 权限：仅 `bettingPool`。
- 作用：当 `BettingPool` 判断某个 risk 已无剩余可 claim 赔付，或 claim 窗口过期时，释放未实际拉走的 payout reserve。
- 入参：
  - `matchId: bytes32`：普通单注为比赛 `matchId`，串关为 `parlayRiskId`。
- 出参：
  - `releasedAmount: uint256`：本次释放回可用 LP 流动性的金额。
- 状态变化：
  - `releasedAmount = reservedAmount - paidOutAmount`；
  - `reservedAmount` 下降到 `paidOutAmount`；
  - `requestableLiquidity += releasedAmount`；
  - 按当前 active pool 权重将 `releasedAmount` 作为 LP reward 回补；Global 份额同步回到 `globalRequestableLiquidity`；
  - `totalOutstandingPayoutReserved` 同步减少。
- 事件：`PayoutReserveReleased`、`PayoutReserveOutstanding(matchId, 0)`、`LiquidityAccountingSnapshot(actionKind=11)`。

### 8.5 事件

#### `MatchPoolOpened(bytes32 indexed matchId, uint256 indexed poolId, uint64 matchEndTime, uint64 depositCloseAt)`

- Match Pool 创建。
- `poolId = uint256(matchId)`；
- `depositCloseAt` 当前等于开赛时间；

#### `PayoutReserveOutstanding(bytes32 indexed matchId, uint256 outstandingAmount)`

- payout reserve 当前残留金额事件；
- `matchId` 对普通单注为比赛 ID，对串关为 `parlayRiskId`；
- `outstandingAmount = reservedAmount - paidOutAmount`；
- 在 `PayoutLiquidityReserved`、`PayoutLiquidityTransferred`、`PayoutReserveReleased` 后发出；
- 后端可监听 `outstandingAmount > 0` 的 riskId 进入待检查队列，在运营确认无需继续保留后调用 `BettingPool.releasePayoutReserve(riskId)`。
- `matchEndTime` 当前等于 Match Pool 解锁时间。

#### `LiquidityConfigUpdated(address indexed operator, address indexed newBettingPool)`

- BettingPool 地址或初始化配置更新。

#### `MinDepositUpdated(address indexed operator, uint256 oldAmount, uint256 newAmount)`

- 最小 LP 存入额更新。

#### `UnbondEpochsUpdated(address indexed operator, uint32 oldEpochs, uint32 newEpochs)`

- 解绑等待 epoch 数更新。

#### `MatchPoolDepositClosed(bytes32 indexed matchId, uint256 indexed poolId, uint8 reason)`

- Match Pool 关闭新存入。
- 当前 `reason = 0` 表示手动封锁触发。

#### `LiquidityDeposited(uint256 indexed positionId, uint256 indexed poolId, address indexed user, uint256 amount, uint256 weight, uint16 planId, uint64 unlockAt)`

- 用户 LP 存入成功。

#### `MarginDistributed(bytes32 indexed matchId, uint256 lpMarginShare, uint256 globalShare, uint256 matchShare)`

- LP margin 分账结果。

#### `GlobalMarginDistributed(bytes32 indexed riskId, uint256 lpMarginShare)`

- Global risk LP margin 分账结果；
- 串关使用 `parlayRiskId` 作为 `riskId`。

#### `LossDistributed(bytes32 indexed matchId, uint256 lpLossBooked, uint256 globalLossShare, uint256 matchLossShare)`

- L2 实际亏损分摊结果。

#### `GlobalLossDistributed(bytes32 indexed riskId, uint256 lpLossBooked)`

- Global risk L2 实际亏损分摊结果；
- 串关使用 `parlayRiskId` 作为 `riskId`。

#### `PayoutLiquidityReserved(bytes32 indexed matchId, uint256 reservedAmount, uint256 paidOutAmount, uint64 settledAt)`

- 赔付流动性预留窗口更新。

#### `PayoutReserveReleased(bytes32 indexed matchId, uint256 releasedAmount, uint256 globalShare, uint256 matchShare, uint256 reservedAmount, uint256 paidOutAmount)`

- unused payout reserve 被释放回 LP 可用流动性；
- `matchId` 对普通单注为比赛 ID，对串关为 `parlayRiskId`；
- `releasedAmount = oldReservedAmount - paidOutAmount`；
- `globalShare / matchShare` 表示释放金额回补到 Global / Match Pool 的份额；
- `reservedAmount` 释放后等于 `paidOutAmount`。

#### `UnbondRequested(uint256 indexed positionId, address indexed user, uint32 unbondingEpoch, uint256 frozenRewardPerWeight, uint256 frozenLossPerPrincipal)`

- LP 进入解绑等待。

#### `LiquidityWithdrawn(uint256 indexed positionId, address indexed user, uint256 withdrawAmount, uint8 finalState, int256 netPnl)`

- LP 提款完成。
- `finalState` 为 `Withdrawn` 或 `Liquidated`；
- `netPnl` 可正可负。

#### `PayoutLiquidityTransferred(bytes32 indexed matchId, uint256 amount, uint256 newPaidOutAmount)`

- 赔付流动性转给 BettingPool。

#### `LiquidityPositionStateChanged(uint256 indexed positionId, address indexed user, uint8 previousState, uint8 newState, uint256 principal, uint256 weight)`

- LP 仓位状态变化。

#### `LiquidityAccountingSnapshot(bytes32 indexed matchId, uint256 indexed poolId, uint256 indexed positionId, uint8 actionKind, uint256 requestableLiquidityAfter, uint256 totalActiveDepositedAfter, uint256 totalOutstandingPayoutReservedAfter, uint256 poolTotalDepositedAfter, uint256 poolTotalWeightAfter)`

- LP 会计快照。
- `actionKind` 当前代码含义：
  - `0`：Global deposit；
  - `1`：Match deposit；
  - `2`：Open Match Pool；
  - `3`：Close Match Pool deposit；
  - `4`：Distribute margin；
  - `5`：Distribute loss；
  - `6`：Request unbond；
  - `7`：Withdraw；
  - `8`：Request payout liquidity；
  - `9`：Distribute global margin；
  - `10`：Distribute global loss；
  - `11`：Release payout reserve。

---

## 9. BettingPool

**所属合约：** `BettingPool`
**测试网地址：** `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
**部署提示：** 本文 ABI 已包含 2026-06-12 ODDToken 业务来源接入、`BettingPool` 模块化入口壳、4 个查询 wrapper、串关 MVP、Cash Out、claimPayout 模块化、payout reserve residual release、HouseVault L4 注资权限，以及 2026-06-13 结算缺口 `netLoss` hotfix；BSC Testnet 当前 `BettingPool` proxy 已升级到 implementation `0x3a4845AAdDf529dd3Ee8F073EA7dE9e565df56DA`，并配置 hotfix 后的 `settlementModule / parlayModule`。
**本地/测试网验收：** 2026-06-13 已完成 hotfix 本地 E2E、fuzz、资金流和下注结算场景测试，并在 BSC Testnet 完成真实链上 full-flow、Cash Out、串关、query interface、smoke 与新增 line 验证；旧 line-matrix 报告脚本本轮因 BSC Testnet RPC receipt 等待卡住后中断，不作为通过项，新增 line 覆盖以专门的 `BscTestnetOddsV3LineValidation` 结果为准。

`BettingPool` 是下注、赔率、市场、结算、Cash Out、串关、税、推荐奖励和瀑布的业务聚合根。2026-06-08 起 `BettingPool` 作为入口壳保留公共 ABI、权限、暂停、重入保护、storage 和模块地址路由：普通下注 `placeBet` 的重逻辑通过 `delegatecall` 到 `BettingBetModule` 执行；`openMarket / updateOdds` 通过 `delegatecall` 到 `BettingMarketModule` 执行，`previewSignal / isMatchTerminal` 通过 `staticcall` 到 `BettingMarketModule` 查询；`bindReferrer / claimReferralRewards / claimUSDTReferralRewards` 通过 `delegatecall` 到 `BettingReferralModule` 执行；`cashOut / claimPayout / settleMarketBetsByScore / finalizeMarketSettlement / refundBets / releasePayoutReserve` 的重逻辑通过 `delegatecall` 到 `BettingSettlementModule` 执行；`placeParlay / settleParlay / claimParlayPayout` 的重逻辑通过 `delegatecall` 到 `BettingParlayModule` 执行；对外写入口仍是 BettingPool proxy。ODDToken MVP 下，下注/串关入金通过 Token 业务入口消费用户来源，claim/refund/cashout/loss 通过 Token 登记业务结果，普通用户不能再直接把 ODD 转入 BettingPool。

### 9.1 前端 API

#### `bindReferrer(address referrer)`

- 作用：用户显式绑定推荐人。
- 入参：
  - `referrer: address`：推荐人地址。
- 出参：无。
- 关键校验：
  - 用户尚未绑定推荐人；
  - `referrer != msg.sender`；
  - `referrer != address(0)`。
- 状态变化：
  - 写入 `referrers[msg.sender] = referrer`。
- 事件：`ReferrerBound`。
- 说明：用户也可以在首次 `placeBet(..., referrer)` 时顺带绑定。

#### `previewSignal(bytes32 marketId, uint8 outcome, uint256 requestedAmount) returns (SignalColor signal, uint256 acceptedAmount, uint256 lockedOdds, bool partialFill, uint256 maxAcceptableAmount)`

- 作用：下单前预览本次下注可能得到的信号灯、实际成交额和锁定赔率。
- 入参：
  - `marketId: bytes32`：目标 market ID；
  - `outcome: uint8`：下注方向，必须小于该 market 的 `outcomeCount`；
  - `requestedAmount: uint256`：用户希望下注的金额，不含下注税。
- 出参：
  - `signal: SignalColor`：按本次下注后暴露预估出的信号灯；
  - `acceptedAmount: uint256`：预计实际成交额；
  - `lockedOdds: uint256`：本次下注预计锁定赔率，精度 `1e4`；小额未触红时锁当前报价，大额滑点使用一次性 post-trade 预览价，红灯容量路径使用 `O_new=max(BaseOdds×0.88,1.01)`；
  - `partialFill: bool`：是否因为红灯阈值限制而只能部分成交；
  - `maxAcceptableAmount: uint256`：当前方向到红灯阈值前最多还能接的金额。
- 关键校验：
  - market 存在；
  - market 未终态；
  - 当前时间未到 `matchEndTime`；
  - market 未手动封锁；
  - `requestedAmount > 0`；
  - `outcome` 合法。
- 说明：
  - 这是只读预估，不锁定链上状态；
  - 该函数只要求 `requestedAmount > 0`，不校验 `MIN_BET_AMOUNT`、VIP 日限额、用户潜在赔付上限、全局流动性或 `QuoteGuardInput`；
  - 真正下注仍必须用 `QuoteGuardInput` 防止报价变化；
  - WCL 使用 V2 口径：`payoutByOutcome[outcome] - totalStake`；
  - 若当前方向已无红灯容量，返回 `acceptedAmount=0, partialFill=true`。

#### `placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, QuoteGuardInput guard) returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)`

- 作用：下注入口，不附带推荐人参数。
- 前置操作：
  - 用户需先 `ODDToken.approve(BettingPool, requestedAmount + betTax)`；
  - 前端应先调用 `getMarketOdds` 和 `previewSignal` 组装 `guard`。
- 入参：
  - `marketId: bytes32`：目标 market；
  - `outcome: uint8`：下注方向；
  - `requestedAmount: uint256`：用户希望下注的金额，不含下注税；
  - `guard: QuoteGuardInput`：报价保护。
- `guard` 填法：
  - `quoteVersion`：来自 `getMarketOdds(marketId)` 返回的 `quoteVersion`；
  - `quotedAt`：来自 `getMarketOdds(marketId)` 返回的 `updatedAt`；
  - `minOdds`：用户可接受的最低赔率；
  - `minAcceptedAmount`：用户可接受的最低实际成交额；
  - `deadline`：本次报价保护过期时间。
- 出参：
  - `betId: bytes32`：新注单 ID；
  - `acceptedAmount: uint256`：实际成交注码；
  - `lockedOdds: uint256`：最终锁定赔率。
- 关键校验：
  - 合约未暂停；
  - market 存在且为 `Open`；
  - market 未手动封锁；
  - 当前时间未到 `matchEndTime`；
  - `requestedAmount >= MIN_BET_AMOUNT`；
  - `guard.quoteVersion == marketOdds[marketId].quoteVersion`；
  - `guard.quotedAt == marketOdds[marketId].updatedAt`；
  - `block.timestamp <= guard.deadline`；
  - 实际成交额不低于 `guard.minAcceptedAmount`；
  - 锁定赔率不低于 `guard.minOdds`；
  - 用户当日成交额不超过 StakingPool 返回的 VIP dailyLimit；
  - 用户单 market 潜在赔付不超过合约限制；
  - 可用流动性足够。
- 说明：产品文档中该限制常称为“单场”潜在赔付上限；当前代码实际按 `user + marketId` 维度记账，不跨同一 `matchId` 下多个 market 聚合。
- 状态变化：
  - 通过 `ODDToken.consumeBusinessInflow(user, BET_SINGLE, betId, acceptedAmount + betTax)` 扣减用户 ODD 并创建普通单注业务来源快照；
  - 记录 `Bet`；
  - 增加 market 暴露、用户风险账本和用户 market 潜在赔付；market 暴露同时写入 `totalStakedByOutcome[outcome] += acceptedAmount` 和 `payoutByOutcome[outcome] += acceptedAmount × lockedOdds / 1e4`；
  - 重算 `quotedOdds` 和 `signalColor`；
  - 若用户已有推荐人，下注税累计为推荐奖励；否则下注税转平台金库。
- 事件：`BetPlaced`、必要时 `ReferralRewardAccumulated`。

#### `placeBet(bytes32 marketId, uint8 outcome, uint256 requestedAmount, QuoteGuardInput guard, address referrer) returns (bytes32 betId, uint256 acceptedAmount, uint256 lockedOdds)`

- 作用：下注入口，允许首次下注时绑定推荐人。
- 入参：同上，外加：
  - `referrer: address`：推荐人地址；传 `address(0)` 表示不绑定。
- 出参：同上。
- 额外逻辑：
  - 若 `referrer != address(0)` 且用户尚未绑定推荐人，会先执行推荐关系绑定；
  - 若用户已经绑定推荐人，再传非零 `referrer` 会被忽略，不会覆盖已有推荐关系，也不会因为这个参数单独回滚。

#### `cashOut(bytes32 betId, uint256 expectedQuoteVersion, uint64 quotedAt, uint256 minAmountOut, uint256 deadline)`

- 作用：用户对自己名下 `Pending` 注单整单提前结算。
- 前置操作：
  - 前端读取 `getBet(betId)`、`getMarket(marketId)` 和 `getMarketOdds(marketId)`；
  - 前端按同一公式计算本次可返还金额，并让用户确认 `minAmountOut`。
- 入参：
  - `betId: bytes32`：目标注单；
  - `expectedQuoteVersion: uint256`：来自 `getMarketOdds(marketId).quoteVersion`；
  - `quotedAt: uint64`：前端生成 Cash Out 报价的确认时间戳，不使用 `getMarketOdds.updatedAt`；
  - `minAmountOut: uint256`：用户可接受的最低返还 ODD；
  - `deadline: uint256`：交易截止时间。
- 关键校验：
  - 合约未暂停；
  - `msg.sender` 必须是 bet owner；
  - 注单状态必须是 `Pending`；
  - market 必须存在且为 `Open`；
  - market 被 `lockMarket` 手动封锁为 `Locked` 后不可 Cash Out，只能等待最终结算或退款；
  - `block.timestamp < matchEndTime`；
  - `expectedQuoteVersion == marketOdds[marketId].quoteVersion`；
  - `quotedAt <= block.timestamp <= quotedAt + 30 seconds`；
  - `block.timestamp <= deadline`；
  - 当前 outcome 的 `quotedOdds` 必须大于 0；
  - 返还金额必须不低于 `10 ODD` 且不低于 `minAmountOut`。
- 计算公式：
  - `remainingStake = acceptedAmount - refundedAmount`；
  - `releasedPayout = remainingStake * lockedOdds / 1e4`；
  - `theoreticalValue = releasedPayout * 1e4 / currentOdds`；
  - 距开赛超过 30 分钟时 `feeBps=1000`，否则 `feeBps=2000`；
  - `cashOutAmount = theoreticalValue * (10000 - feeBps) / 10000`。
- 状态变化：
  - 注单状态变为 `CashedOut`；
  - `marketPreClosedBetCount[marketId] += 1`，用于最终结算兼容；
  - 释放该注单剩余 `S_i/P_i`、用户 `unsettledStake` 和用户 market 潜在赔付；
  - 不回滚 `dailyAcceptedAmount`；
  - 不把 `refundedAmount` 伪写为 `acceptedAmount`；
  - 重算赔率和信号灯，并使 `quoteVersion += 1`。
- 资金处理：
  - 若 `cashOutAmount <= remainingStake`，差额留在 BettingPool 并记入 `platformReserve`；
  - 若 `cashOutAmount > remainingStake`，超出部分按 L2 -> L3 -> L4 瀑布承担；L2 booked loss 会通过 `LiquidityPool.requestPayoutLiquidity` 拉取到 BettingPool 后再出账；
  - 成功后通过 `ODDToken.registerBusinessOutcomeDelta(user, businessId, cashOutAmount, true)` 登记出金，净盈利变可转，亏损扣减业务锁定。
- 事件：`BetCashedOut`、`OddsUpdated`，返还额低于本金时还会发 `PlatformReserveUpdated(reason=5)`。

#### `claimPayout(bytes32 betId)`

- 作用：领取已结算胜单派彩。
- 实现：`BettingPool` 只保留 `nonReentrant + whenNotPaused` wrapper，owner 校验、可领取状态校验、派奖税分发、LP payout liquidity 拉款和资金出账在 `BettingSettlementModule` 中执行。
- 入参：
  - `betId: bytes32`：目标注单 ID。
- 出参：无。
- 关键校验：
  - 合约未暂停；
  - `msg.sender` 必须是 bet owner；
  - 注单状态必须是 `WonUnclaimed`；
  - market 状态必须已经是 `Settled`，分批结算场景下需等 `finalizeMarketSettlement` 完成后才能领取；
  - 净赔付 `grossPayout - taxAmount` 必须大于 0。
- 状态变化：
  - 注单状态变为 `WonClaimed`；
  - 按注单中快照的税率计算派彩税；
  - 若 BettingPool 实际 ODD 余额小于 `grossPayout`，会按 `grossPayout - currentBalance` 从 LiquidityPool 已预留窗口拉取赔付流动性；
  - 拉取资金按 gross payout 口径判断，避免内部派奖税份额仍留在 BettingPool 账上时低估实际赔付资金需求；
  - 若该 `riskId` 下 claim 后仍有 unused LP payout reserve，不会自动释放；后端应通过 `PayoutReserveOutstanding` 事件索引残留，并在确认无需继续保留后调用 `BettingPool.releasePayoutReserve(riskId)`；
  - 派彩税分配到 StakingPool、taxBuffer、平台金库、推荐奖励；
  - 通过 `ODDToken.registerBusinessOutcomeDelta(user, businessId, netPayout, true)` 登记净赔付，净盈利变可转。
- 事件：`BetClaimed`、`PayoutClaimed`，可能触发 `TaxBufferFunded / LpLossOffsetApplied / ReferralRewardAccumulated`。

#### `claimReferralRewards(uint256 oddAmount) returns (uint256 claimedAmount)`

- 作用：直接领取 ODD 推荐奖励。
- 入参：
  - `oddAmount: uint256`：本次领取 ODD 数量，必须大于 0 且不超过 `referrerRewardsOdd[msg.sender]`。
- 出参：
  - `claimedAmount: uint256`：实际领取数量，当前等于 `oddAmount`。
- 关键校验：
  - 合约未暂停；
  - 可领取余额大于 0；
  - `oddAmount` 合法。
- 状态变化：
  - 减少 `referrerRewardsOdd[msg.sender]`；
  - 减少 `accountedBalance`；
  - 通过 `ODDToken.registerBusinessProfitAndTransfer(msg.sender, REFERRAL_REWARD, rawId, oddAmount)` 发放无本金入金的业务净盈利 ODD。
- 事件：`ReferralClaimed`。

#### `claimUSDTReferralRewards(uint256 rewardMinUsdtOutAmount, uint256 signatureDeadline, bytes signature, uint256 minUsdtOut) returns (uint256 amountOut)`

- 作用：把当前全部 ODD 推荐奖励兑换成 USDT，并直接打给用户。
- 入参：
  - `rewardMinUsdtOutAmount: uint256`：后端签名绑定的最低 USDT 到账量；
  - `signatureDeadline: uint256`：后端签名过期时间；
  - `signature: bytes`：`referralClaimSigner` 对本次领取参数的签名；
  - `minUsdtOut: uint256`：实际传给 Router 的最低输出滑点保护。
- 出参：
  - `amountOut: uint256`：实际换出的 USDT 数量。
- 签名绑定内容：
  - 当前 `BettingPool` 地址；
  - `block.chainid`；
  - claimant；
  - 当前全部 `oddAmount`；
  - `rewardMinUsdtOutAmount`；
  - `signatureDeadline`；
  - 当前 `referralClaimNonces[msg.sender]`。
- 关键校验：
  - 合约未暂停；
  - `referralSwapRouter / referralUsdtToken` 已由治理配置；
  - `referralSwapExpectedPool` 已由治理配置，且已在 ODDToken 登记为 `dexRestrictedTarget`；
  - `referralClaimSigner` 已配置；
  - `referralSwapPoolFee` 已配置；
  - 用户推荐奖励余额大于 0；
  - 签名有效且未过期；
  - 用户 USDT 真实到账量不低于 `minUsdtOut`；
  - 用户 USDT 真实到账量不低于签名绑定的 `rewardMinUsdtOutAmount`。
- 状态变化：
  - 消耗 nonce；
  - 清零用户当前推荐奖励；
  - 减少 `accountedBalance`；
  - 通过 `ODDToken.registerBusinessProfitForDexSwap(msg.sender, REFERRAL_REWARD, rawId, oddAmount, router, expectedPool)` 登记一次性 DEX swap 放行；
  - 批准治理配置的 Router 使用 ODD，并执行 ODD -> USDT swap；
  - 以用户 `referralUsdtToken` 余额前后差额作为 `amountOut`。
- 事件：`ReferralClaimedUSDT`。

### 9.2 公共 API

#### `getMarket(bytes32 marketId) returns (MarketConfig)`

- 作用：查询 market 基础配置。
- 入参：
  - `marketId: bytes32`：market ID。
- 出参：
  - `MarketConfig`：见结构体字典。
- 说明：若 market 不存在，返回默认空结构体，`matchId = bytes32(0)`。

#### `getMarketOdds(bytes32 marketId) returns (uint256[] baseOdds, uint256[] quotedOdds, uint64 updatedAt, uint256 quoteVersion)`

- 作用：查询 market 当前赔率状态。
- 入参：
  - `marketId: bytes32`：market ID。
- 出参：
  - `baseOdds: uint256[]`：基础赔率，后端赔率服务输入；
  - `quotedOdds: uint256[]`：结合当前下注暴露和信号灯调整后的实际报价；
  - `updatedAt: uint64`：当前赔率版本生成时间；
  - `quoteVersion: uint256`：当前报价版本。
- 业务用途：
  - 前端下注前把 `quoteVersion` 填入 `QuoteGuardInput.quoteVersion`；
  - 把 `updatedAt` 填入 `QuoteGuardInput.quotedAt`；
  - 若下单前赔率更新、其他下注成交、退款、手动封锁或结算导致 `quoteVersion` 变化，旧 guard 会回滚；
  - 前端 Cash Out 前也把 `quoteVersion` 填入 `cashOut.expectedQuoteVersion`；
  - `updatedAt` 只在开盘和运营更新赔率时写入；下注、退款、手动封锁、结算可能改变 `quoteVersion`，但不一定改变 `updatedAt`。
  - Cash Out 的 `quotedAt` 是前端确认 Cash Out quote 的时间戳，不使用 `updatedAt`。

#### `getMarketExposure(bytes32 marketId) returns (uint256[] totalStakedByOutcome, uint256[] payoutByOutcome, SignalColor signalColor)`

- 作用：查询 market 当前 V2 风险暴露。
- 入参：
  - `marketId: bytes32`：market ID。
- 出参：
  - `totalStakedByOutcome: uint256[]`：每个方向累计有效 stake，即 `S_i`；
  - `payoutByOutcome: uint256[]`：每个方向累计应付赔付额，即 `P_i`，按逐笔 `lockedOdds` 累加；
  - `signalColor: SignalColor`：当前 market 信号灯。
- 业务用途：
  - 后端/运营核对链上 WCL：`L_i = payoutByOutcome[i] - sum(totalStakedByOutcome)`，小于 0 时按 0 进入压缩/信号灯；
  - 验证 Base Odds 更新不会回算历史 `P_i`；
  - 验证退款和 AH push/half refund 已释放对应 `S_i/P_i`。

#### `getBet(bytes32 betId) returns (Bet)`

- 作用：查询注单详情。
- 入参：
  - `betId: bytes32`：注单 ID。
- 出参：
  - `Bet`：见结构体字典。

#### `getClaimStatus(address userAddress, bytes32 betId) returns (bool won, uint256 reward)`

- 作用：通过 `BettingPool` ABI 查询普通单注赛后是否赢和当前净可领取金额。
- 实现：`BettingPool` 使用 `staticcall` 转发到当前 `settlementModule.getClaimStatus(address(this), userAddress, betId)`。
- 入参：
  - `userAddress: address`：要查询的用户地址，调用方可任意传入；
  - `betId: bytes32`：普通单注 ID。
- 出参：
  - `won: bool`：该 `userAddress` 名下注单是否赢；已中奖但已领取仍为 true；
  - `reward: uint256`：当前可领取净额，单位 ODD `1e18`；已领取或无可领取时为 0。
- 关键语义：比赛未到 `matchEndTime` 时 revert；bet 不存在、user 不匹配或未中奖返回 0。

#### `estimateBetValue(address userAddress, bytes32 betId) returns (uint256 estimatedValue, int256 floatingPnL)`

- 作用：通过 `BettingPool` ABI 查询普通单注未结算过程估值和浮动盈亏。
- 实现：`BettingPool` 使用 `staticcall` 转发到当前 `settlementModule.estimateBetValue(address(this), userAddress, betId)`。
- 入参：
  - `userAddress: address`：要查询的用户地址；
  - `betId: bytes32`：普通单注 ID。
- 出参：
  - `estimatedValue: uint256`：按当前赔率估算的当前价值，单位 ODD `1e18`；
  - `floatingPnL: int256`：`estimatedValue - remainingStake`，单位 ODD `1e18`。
- 关键语义：仅允许查询 `Pending` 且比赛未结束的注单；bet 不存在或 user 不匹配返回 `(0,0)`；已结算、已 Cash Out、已退款、market 终态或已到 `matchEndTime` 时 revert。

#### `getParlayClaimStatus(address userAddress, bytes32 parlayId) returns (bool won, uint256 reward)`

- 作用：通过 `BettingPool` ABI 查询串关赛后是否赢和当前净可领取金额。
- 实现：`BettingPool` 使用 `staticcall` 转发到当前 `parlayModule.getParlayClaimStatus(address(this), userAddress, parlayId)`。
- 入参：
  - `userAddress: address`：要查询的用户地址；
  - `parlayId: bytes32`：串关注单 ID。
- 出参：
  - `won: bool`：该 `userAddress` 名下串关是否赢；已中奖但已领取仍为 true；
  - `reward: uint256`：当前可领取净额；`Refundable` 时返回可退本金但 `won=false`。
- 关键语义：任一 leg 底层 market 未到 `matchEndTime` 时 revert；parlay 不存在、user 不匹配或未赢无退款时返回 0。

#### `estimateParlayValue(address userAddress, bytes32 parlayId) returns (ParlayEstimatedValue)`

- 作用：通过 `BettingPool` ABI 查询未结算串关展示估值和浮动盈亏。
- 实现：`BettingPool` 使用 `staticcall` 转发到当前 `parlayModule.estimateParlayValue(address(this), userAddress, parlayId)`。
- 入参：
  - `userAddress: address`：要查询的用户地址；
  - `parlayId: bytes32`：串关注单 ID。
- 出参：`ParlayEstimatedValue`，字段见第 5.14 节。
- 关键语义：仅允许查询 `Pending` 串关；parlay 不存在或 user 不匹配返回完整默认 0；已结算或可退款等非 `Pending` 状态 revert；返回值仅用于展示，不可 claim、不可提现、不是 Cash Out 报价。

#### `getMarketBetIds(bytes32 marketId, uint256 offset, uint256 limit) returns (bytes32[] result)`

- 作用：分页查询某个 market 下的注单 ID。
- 入参：
  - `marketId: bytes32`：目标 market；
  - `offset: uint256`：起始下标；
  - `limit: uint256`：最多返回数量。
- 出参：
  - `result: bytes32[]`：分页 betId 列表；若 `offset >= totalBetCount` 或 `limit == 0`，返回空数组。
- 业务用途：后端或 keeper 分页读取 betIds，再按批调用 `settleMarketBetsByScore`。

#### `getUserRiskLedger(address user) returns (UserRiskLedger)`

- 作用：查询用户下注风险账本。
- 入参：
  - `user: address`：目标用户。
- 出参：
  - `UserRiskLedger`：见结构体字典。
- 业务用途：前端展示当日已用下注额度和未结算注码。

#### `isMatchTerminal(bytes32 matchId) returns (bool)`

- 作用：判断某场比赛下所有已创建 market 是否都已终态。
- 入参：
  - `matchId: bytes32`：比赛 ID。
- 出参：
  - `bool`：所有 market 都是 `Settled / Refunded / Cancelled` 时返回 true；没有 market 时返回 false。
- 业务用途：LiquidityPool 的 Match Pool 解绑前置校验。

#### `taxAllocPlatformBps() returns (uint16)`

- 作用：查询派奖税中平台份额的 BPS。
- 入参：无。
- 出参：
  - `uint16`：平台份额。
- 说明：平台份额不是单独存储字段，而是运行时计算：

```solidity
payoutTaxBps - taxAllocStakingBps - taxAllocTaxBufferBps - taxAllocReferrerBps
```

#### 公共 getter

| Getter | 返回值含义 |
|---|---|
| `platformReserve()` | L4 平台准备金余额 |
| `accountedBalance()` | BettingPool 内部账面 ODD |
| `taxBuffer()` | L3 taxBuffer 余额 |
| `lpLossOffsetRemaining()` | L2 LP 历史亏损中尚未被后续派奖税缓冲份额冲抵的指标余额；不是 LP 应收债务 |
| `lpMarginShareBps()` | 市场 margin 中分给 LP 的比例 |
| `wclYellowThreshold()` | WCL 黄灯阈值 |
| `wclOrangeThreshold()` | WCL 橙灯阈值 |
| `wclRedThreshold()` | WCL 红灯阈值 |
| `referrers(address user)` | 用户绑定的推荐人 |
| `referrerRewardsOdd(address referrer)` | 推荐人可领取 ODD 奖励 |
| `referralClaimSigner()` | USDT 推荐奖励领取签名人 |
| `referralSwapPoolFee()` | Pancake V3 pool fee |
| `referralSwapRouter()` | USDT 推荐奖励兑换使用的 Router |
| `referralUsdtToken()` | USDT 推荐奖励兑换目标 token |
| `referralSwapExpectedPool()` | 推荐 USDT claim 时 ODDToken 一次性 DEX 放行的预期 V3 pool |
| `referralClaimNonces(address user)` | 用户 USDT 领取 nonce |
| `settlementModule()` | 当前结算模块 implementation 地址 |
| `betModule()` | 当前普通下注模块 implementation 地址 |
| `parlayModule()` | 当前串关模块 implementation 地址 |
| `openParlayMaxPayout()` | 未结算串关最大赔付占用合计，用于防止重复复用同一份 Global 容量 |
| `nextParlayNonce()` | 下一个串关 nonce |
| `parlays(bytes32 parlayId)` | 串关主单详情 |
| `parlayLegs(bytes32 parlayId, uint256 index)` | 指定串关 leg 详情 |
| `marketFinalResults(bytes32 marketId)` | 底层 market 终局结果记录，供串关结算和 lens 估值读取 |
| `betTaxBps()` | 下注税率 |
| `payoutTaxBps()` | 派奖税率 |
| `taxAllocStakingBps()` | 派奖税中质押池份额 |
| `taxAllocTaxBufferBps()` | 派奖税中 taxBuffer 份额 |
| `taxAllocReferrerBps()` | 派奖税中推荐奖励份额 |
| `nextBetNonce()` | 下一个注单 nonce |
| `oddToken()` | ODDToken 地址 |
| `platformTreasury()` | 平台金库地址 |
| `stakingPool()` | StakingPool 地址 |
| `liquidityPool()` | LiquidityPool 地址 |

### 9.3 后端 / 治理 API

#### `initialize(address admin, address oddTokenAddress, address stakingPoolAddress, address liquidityPoolAddress)`

- 调用时机：仅 proxy 初始化时调用一次。
- 作用：初始化 BettingPool、角色、依赖合约和默认业务参数。
- 入参：
  - `admin: address`：初始治理地址；
  - `oddTokenAddress: address`：ODDToken proxy 地址；
  - `stakingPoolAddress: address`：StakingPool proxy 地址；
  - `liquidityPoolAddress: address`：LiquidityPool proxy 地址。
- 关键校验：所有地址不能为零地址。
- 默认参数：
  - `betTaxBps = 100`；
  - `payoutTaxBps = 500`；
  - 派奖税默认分配：staking 200、taxBuffer 100、referrer 100、platform 100；
  - `lpMarginShareBps = 8000`；
  - 默认 WCL 阈值来自 `BettingConstants`；
  - `referralSwapPoolFee = 2500`。

#### `initializeV2(address treasuryAddress)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：升级后补齐平台金库地址。
- 入参：
  - `treasuryAddress: address`：平台金库地址，不能为零地址。
- 出参：无。

#### `initializeV3()`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 调用时机：升级到串关版本后通过 `upgradeToAndCall` 补初始化一次。
- 作用：初始化串关 nonce。
- 入参：无。
- 出参：无。
- 状态变化：
  - 若 `nextParlayNonce == 0`，写入 `nextParlayNonce = 1`；
  - 使用 `reinitializer(3)`，同一个 proxy 只能成功执行一次。

#### `setBettingDependencies(address stakingPoolAddress, address liquidityPoolAddress, address oddTokenAddress)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：仅用于 bootstrap / migration 场景一次性补齐 BettingPool 依赖的 StakingPool、LiquidityPool、ODDToken 地址。
- 入参：
  - `stakingPoolAddress: address`：StakingPool 地址；
  - `liquidityPoolAddress: address`：LiquidityPool 地址；
  - `oddTokenAddress: address`：ODDToken 地址。
- 关键校验：所有地址不能为零地址；且当前三项依赖必须均未设置，否则 revert `DependenciesAlreadyConfigured()`。
- 出参：无。
- 风险提示：这些地址是跨合约账本锚点，不是 UUPS implementation 地址；正常 UUPS 升级不应通过本函数切换依赖。

#### `setTaxConfig(uint16 newBetTaxBps, uint16 newPayoutTaxBps, uint16 newAllocStakingBps, uint16 newAllocTaxBufferBps, uint16 newAllocPlatformBps, uint16 newAllocReferrerBps)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新下注税、派奖税和派奖税四项分配。
- 入参：
  - `newBetTaxBps: uint16`：下注税率，最大 `300`；
  - `newPayoutTaxBps: uint16`：派奖税率，最大 `1000`；
  - `newAllocStakingBps: uint16`：派奖税中给 StakingPool 的份额；
  - `newAllocTaxBufferBps: uint16`：派奖税中进入 taxBuffer 的份额；
  - `newAllocPlatformBps: uint16`：派奖税中给平台金库的份额，仅参与闭合校验，不单独存储；
  - `newAllocReferrerBps: uint16`：派奖税中给推荐人的份额。
- 关键校验：
  - `newBetTaxBps <= BET_TAX_BPS_MAX`；
  - `newPayoutTaxBps <= PAYOUT_TAX_BPS_MAX`；
  - 四项分配之和必须等于 `newPayoutTaxBps`。
- 出参：无。

#### `setPlatformTreasury(address treasuryAddress)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新平台金库地址。
- 入参：
  - `treasuryAddress: address`：新金库地址，不能为零地址。
- 出参：无。

#### `setRiskConfig(uint256 yellowThreshold, uint256 orangeThreshold, uint256 redThreshold)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新 WCL 信号灯阈值。
- 入参：
  - `yellowThreshold: uint256`：黄灯阈值；
  - `orangeThreshold: uint256`：橙灯阈值；
  - `redThreshold: uint256`：红灯阈值。
- 关键校验：
  - `yellowThreshold > 0`；
  - `yellowThreshold < orangeThreshold < redThreshold`。
- 出参：无。
- 业务影响：影响 `previewSignal`、下注部分成交、赔率压缩/上浮和红灯停单。

#### `setMarginSplit(uint16 newLpMarginShareBps)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：更新市场结算 margin 中分给 LP 的比例。
- 入参：
  - `newLpMarginShareBps: uint16`：LP 份额，不能超过 `10000`。
- 出参：无。
- 说明：剩余 margin 归平台准备金或平台分成路径。

#### `setReferralClaimConfig(address signer, uint24 poolFee)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：配置 USDT 推荐奖励领取的后端签名人和 Pancake V3 pool fee。
- 入参：
  - `signer: address`：签名人地址，不能为零地址；
  - `poolFee: uint24`：Pancake V3 fee tier，不能为 0。
- 出参：无。

#### `setReferralSwapConfig(address swapRouter, address usdtToken)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：兼容旧入口，配置 USDT 推荐奖励领取固定使用的 Router 与 USDT token。
- 入参：
  - `swapRouter: address`：Pancake V3 Router 地址，不能为零地址；
  - `usdtToken: address`：USDT token 地址，不能为零地址。
- 出参：无。
- 说明：ODDToken MVP 下，推荐 USDT claim 还必须配置 `referralSwapExpectedPool`；仅调用两参版本会让 USDT claim 因 expected pool 缺失而失败。

#### `setReferralSwapConfig(address swapRouter, address usdtToken, address expectedPool)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：配置 USDT 推荐奖励领取固定使用的 Router、USDT token 和预期 ODD/USDT V3 pool。
- 入参：
  - `swapRouter: address`：Pancake V3 Router 地址，不能为零地址；
  - `usdtToken: address`：USDT token 地址，不能为零地址；
  - `expectedPool: address`：Router 拉取 ODD 时必须转入的 V3 pool 地址，不能为零地址。
- 出参：无。
- 说明：`claimUSDTReferralRewards` 不再接收用户传入的 router/token，避免推荐人拿到合法签名后替换兑换路径；`expectedPool` 还必须在 ODDToken 中登记为 `dexRestrictedTarget`，否则 Token 的一次性 swap 放行会回滚。

#### `setSettlementModule(address newSettlementModule)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：切换结算模块 implementation 地址。
- 入参：
  - `newSettlementModule: address`：新模块地址，不能为零地址，且 `code.length > 0`。
- 出参：无。
- 风险提示：模块通过 `delegatecall` 写 BettingPool storage，必须保证 storage layout 兼容。

#### `setBetModule(address newBetModule)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：切换普通下注模块 implementation 地址。
- 入参：
  - `newBetModule: address`：新模块地址，不能为零地址，且 `code.length > 0`。
- 出参：无。
- 事件：`BetModuleUpdated`。
- 风险提示：模块通过 `delegatecall` 写 BettingPool storage，必须保证 storage layout 兼容；正常前后端不应直连 `BettingBetModule` 写入口。

#### `setMarketModule(address newMarketModule)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：切换市场模块 implementation 地址。
- 入参：
  - `newMarketModule: address`：新模块地址，不能为零地址，且 `code.length > 0`。
- 出参：无。
- 事件：`MarketModuleUpdated`。
- 风险提示：`openMarket / updateOdds` 通过 `delegatecall` 写 BettingPool storage；`previewSignal / isMatchTerminal` 通过 `staticcall` 读取 BettingPool proxy 状态。

#### `setReferralModule(address newReferralModule)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：切换推荐模块 implementation 地址。
- 入参：
  - `newReferralModule: address`：新模块地址，不能为零地址，且 `code.length > 0`。
- 出参：无。
- 事件：`ReferralModuleUpdated`。
- 风险提示：模块通过 `delegatecall` 写 BettingPool storage 并执行推荐奖励资产出账，必须保证 storage layout 兼容；正常前后端不应直连 `BettingReferralModule` 写入口。

#### `setParlayModule(address newParlayModule)`

- 权限：`DEFAULT_ADMIN_ROLE`。
- 作用：切换串关模块 implementation 地址。
- 入参：
  - `newParlayModule: address`：新模块地址，不能为零地址，且 `code.length > 0`。
- 出参：无。
- 事件：`ParlayModuleUpdated`。
- 风险提示：模块通过 `delegatecall` 写 BettingPool storage，必须保证 storage layout 兼容；正常前后端不应直连 `BettingParlayModule`。

#### `addPlatformReserve(uint256 amount)`

- 权限：`DEFAULT_ADMIN_ROLE` 或 `ODDToken.fixedSources().houseVault`。
- 作用：手工补入 L4 平台准备金。
- 2026-06-12 起也允许 `ODDToken.fixedSources().houseVault` 调用，供 `HouseVault.fundBettingPlatformReserve` 一键注入 L4。
- 前置操作：管理员直调时需先 `ODDToken.approve(BettingPool, amount)`；通过 `HouseVault.fundBettingPlatformReserve` 调用时由 HouseVault 方法内部完成一次性 approve 并在结束后清零。
- 入参：
  - `amount: uint256`：补入金额，必须大于 0。
- 出参：无。
- 状态变化：
  - 从调用者转入 ODD；
  - 增加 `platformReserve`；
  - 增加 `accountedBalance`。
- 事件：`PlatformReserveUpdated(reason=0)`。

#### `openMarket(bytes32 matchId, uint8 marketType, uint8 line, uint64 matchStartTime, uint64 matchEndTime, uint256[] baseOdds, uint64 updatedAt) returns (bytes32 marketId)`

- 权限：`OPERATOR_ROLE`。
- 作用：创建一个 market，并初始化赔率、下注暴露和同场比赛 Match Pool。
- 入参：
  - `matchId: bytes32`：比赛 ID；同一比赛下多个 market 共享 Match Pool；
  - `marketType: uint8`：市场类型，见第 3.2 节；`0=1X2`，`1=AH`，`2=OU`；
  - `line: uint8`：链上盘口枚举索引，见第 3.2 至 3.6 节；注意它不是盘口小数值；
  - `matchStartTime: uint64`：开赛时间；
  - `matchEndTime: uint64`：比赛结束边界；
  - `baseOdds: uint256[]`：初始基础赔率数组，长度和顺序必须与 market 模板一致；1X2 为 `[home, draw, away]`，AH 为 `[home side, away side]`，OU 为 `[over, under]`；
  - `updatedAt: uint64`：本次赔率版本生成时间，后续作为 `QuoteGuardInput.quotedAt` 的校验值。
- 出参：
  - `marketId: bytes32`：`keccak256(abi.encode(matchId, marketType, line))`。
- market 模板校验：
  - 1X2：`marketType=0,line=0,baseOdds.length=3`，`baseOdds[0/1/2] = home/draw/away`；
  - AH：`marketType=1,line in 0..12,baseOdds.length=2`，`line` 必须按主队视角编码，`baseOdds[0/1] = home side / away side`；
  - OU：`marketType=2,line in 0..10,baseOdds.length=2`，`baseOdds[0/1] = over / under`。
- 赔率校验：
  - 每个 odds 必须 `>= 10100`；
  - 每个 odds 必须是 `100` 的整数倍。
- 关键边界：
  - 不能重复创建同一个 `marketId`；
  - 不再存在开赛前 5 分钟自动锁盘；market 默认可下注到 `matchEndTime`；
  - `matchId != 0`、`matchStartTime > 0`、`matchEndTime > matchStartTime` 由首次创建 Match Pool 时的 `LiquidityPool.openMatchPool` 校验；
  - 后续同一 `matchId` 的其他 market 不会重复调用 `openMatchPool`，运营侧必须保持同一比赛的 `matchStartTime / matchEndTime` 一致。
- 状态变化：
  - 写入 `MarketConfig`；
  - `lockAt = matchEndTime`，若后续手动封锁则更新为实际封锁时间；
  - 初始化 `MarketOdds.baseOdds / quotedOdds / updatedAt / quoteVersion=1`；
  - 初始化 `MarketExposure.totalStakedByOutcome / payoutByOutcome` 和绿灯；
  - 如果这是该 `matchId` 的第一个 market，自动调用 `LiquidityPool.openMatchPool(matchId, matchStartTime, matchEndTime)`；
  - 追加 `matchMarketIds[matchId]`。
- 事件：`MarketOpened`、`OddsUpdated`，LiquidityPool 侧可能出现 `MatchPoolOpened`。

#### `lockMarket(bytes32 marketId)`

- 权限：`OPERATOR_ROLE`；外层 wrapper 带 `nonReentrant`。
- 作用：由后端/运营主动封锁单个 market，封锁后禁止继续下注、预览、更新赔率和 Cash Out。
- 入参：
  - `marketId: bytes32`：目标 market。
- 出参：无。
- 关键校验：
  - market 存在；
  - market 当前必须为 `Open`；
  - 当前时间不能超过 `matchEndTime`；超过比赛结束时间后应走结算。
- 状态变化：
  - `market.status = Locked`；
  - `market.lockAt = uint64(block.timestamp)`；
  - 调用 `LiquidityPool.closeMatchPoolDeposit(matchId)`；
  - `quoteVersion += 1`，使旧 `QuoteGuardInput` 失效。
- 事件：`MarketManuallyLocked`，LiquidityPool 侧可能出现 `MatchPoolDepositClosed`。
- 说明：本接口只封锁单个 market，不按 `matchId` 遍历全部 market。后端如需整场封锁，应逐个 market 调用，避免链上无界循环。

#### `updateOdds(bytes32 marketId, uint256[] baseOdds, uint64 updatedAt)`

- 权限：`OPERATOR_ROLE`。
- 作用：更新 market 基础赔率，并基于当前下注暴露重算 `quotedOdds` 和信号灯。
- 入参：
  - `marketId: bytes32`：目标 market；
  - `baseOdds: uint256[]`：新的基础赔率，长度必须等于 market 的 `outcomeCount`；
  - `updatedAt: uint64`：新赔率版本生成时间。
- 出参：无。
- 关键校验：
  - market 存在；
  - market 未终态；
  - market 未手动封锁；
  - 当前时间未到 `matchEndTime`；
  - `baseOdds.length == outcomeCount`；
  - odds 值合法。
- 状态变化:
  - 更新 `baseOdds`；
  - 更新 `updatedAt`；
  - `quoteVersion += 1`；
  - 重算 `quotedOdds` 和信号灯。
- 事件：`OddsUpdated`。
- 说明：当前代码不强制 `updatedAt` 递增，也不要求它接近 `block.timestamp`；它主要是报价一致性字段。
- V2 说明：`updateOdds` 不回算历史注单 `lockedOdds`，也不改变 `MarketExposure.payoutByOutcome`；它只影响后续新单报价。
- 盘口说明：`updateOdds` 不能改变 `marketType / line / outcomeCount`，只能在既有 market 模板内更新同顺序的 odds。

#### `settleMarketBetsByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] betIds)`

- 权限：`SETTLER_ROLE`；外层 wrapper 带 `nonReentrant`。
- 作用：按最终比分分批物化正常赛果结算的注单状态，用于所有 1X2 / AH / OU market，避免一次性遍历全部注单。
- 入参：
  - `marketId: bytes32`：目标 market；
  - `homeScore: uint16`：主队最终比分，必须是赛后最终确认比分；
  - `awayScore: uint16`：客队最终比分，必须是赛后最终确认比分；
  - `betIds: bytes32[]`：本批要处理的注单 ID，长度不超过 `FINALIZE_BATCH_HARD_CAP`；通常必须 `> 0`，仅当该 market 全部注单都已 Cash Out 时允许传空数组用于记录比分锚点。
- 关键校验：
  - market 存在且未终态；
  - 当前时间必须不早于 `matchEndTime`；
  - `homeScore / awayScore <= MAX_SETTLEMENT_SCORE`；
  - 首批会锁定 `homeScore / awayScore`，后续批次必须使用相同比分；
  - 每个 bet 必须属于该 market 且当前为 `Pending`，重复传入、传错 market 或传入 `CashedOut` 注单都会 revert；
  - 空 `betIds` 仅在 `marketPreClosedBetCount[marketId] == marketBetIds[marketId].length` 且该 market 至少有一笔历史注单时允许。
- 盘口推导：
  - 1X2：按第 3.6 节从比分推导 `home/draw/away`；
  - AH：按第 3.4 节用 `scoreDiff = homeScore - awayScore` 和 `line` 推导 full / half / push；
  - OU：按第 3.5 节用 `homeScore + awayScore` 和 `line` 推导 over / under；
  - 结算时不读取后端传入的 `winningOutcome`，也不存在旧的 `pushRefundMarket` 分支。
- 状态变化：
  - 链上按 `marketType + line + homeScore + awayScore` 推导每笔 bet 的 full win / full loss / full push / half win / half loss；
  - full win：整笔写入 `claimablePayout`，bet 变为 `WonUnclaimed`；
  - full loss：整笔计入 `loserStakes`，bet 变为 `Lost`；
  - full push：整笔本金退回，bet 变为 `Refunded`；
  - half win：一半本金退回，一半本金写入 `claimablePayout`，bet 变为 `WonUnclaimed`；
  - half loss：一半本金退回，一半本金计入 `loserStakes`，bet 变为 `Lost`；
  - full push、half win、half loss 中被退回的本金会同步释放 market 级 `totalStakedByOutcome` 和 `payoutByOutcome`；
  - 按批累计 `processedCount / totalStake / grossPayout / loserStakes` 到 market settlement progress。
- half 拆分：
  - `halfStake = currentStake / 2`；
  - `remainder = currentStake - halfStake * 2`；
  - 余数进入 `refundStake`，不进入 win/loss、margin 或 payout tax。
- 说明：
  - AH full push 是正常赛果结算，market 最终仍为 `Settled`；
  - score settlement 中的退款本金不复用 `_applyRefundRiskRollback`，避免风险账本二次扣减。
- 事件：`MarketSettlementScoreBatchProcessed`。

#### `finalizeMarketSettlement(bytes32 marketId, uint8 resultKindRaw)`

- 权限：`SETTLER_ROLE`；外层 wrapper 带 `nonReentrant`。
- 作用：统一收口 market 终态。正常结算时完成 market 级 margin、瀑布和 `Settled`；退款/取消时只标记终态，逐笔退款仍由 `refundBets` 完成。
- 入参：
  - `marketId: bytes32`：目标 market；
  - `resultKindRaw: uint8`：`0=Settled, 1=Refunded, 2=Cancelled`。
- 关键校验：
  - market 存在且未终态；
  - 当前时间必须不早于 `matchEndTime`；
  - `resultKindRaw` 必须为 `0 / 1 / 2`；
  - `resultKindRaw=0` 且该 market 有 bet 时，必须已经存在 score-based progress，且 `processedCount + marketPreClosedBetCount[marketId] == marketBetIds[marketId].length`；
  - `resultKindRaw=0` 且该 market 没有 bet 时，可直接结算为 `Settled`；
  - `resultKindRaw=1/2` 时，如果 score-based 分批结算已经开始则 revert。
- 状态变化：
  - `resultKindRaw=0`：使用 settlement progress 中累计的 `totalStake / grossPayout / loserStakes` 计算 LP margin、平台 margin 和 net loss；其中 margin 基于 `totalStake`，`netLoss = max(grossPayout - (totalStake - totalMargin), 0)`，`loserStakes` 仅作为结算进度字段和事件/索引用信息，不再作为净缺口扣减基准；
  - `resultKindRaw=0`：分配 LP margin，将平台 margin 记入 `platformReserve`，并按需执行 L2/L3/L4 瀑布；
  - `resultKindRaw=0`：market 状态变为 `Settled`；
  - `resultKindRaw=1`：market 状态变为 `Refunded`，不遍历 bet、不计算 margin、不执行瀑布；
  - `resultKindRaw=2`：market 状态变为 `Cancelled`，不遍历 bet、不计算 margin、不执行瀑布；
  - `quoteVersion += 1`；
  - 正常分批结算收口后必须执行 `delete marketSettlementProgress[marketId]`。
- 说明：
  - 本函数不遍历全部 bet；
  - 零下注正常结算路径不记录比分；若索引侧需要赛事比分，应以赛事结果源为准；
  - 若全部注单都已 Cash Out，后端仍应先用空 `betIds` 调一次 `settleMarketBetsByScore(marketId, homeScore, awayScore, [])` 记录比分，再 finalize。
- 事件：`MarketSettlementFinalized`，正常结算可能触发 LiquidityPool 和 Reserve 相关事件。

#### `refundBets(bytes32 marketId, bytes32[] betIds, uint256[] refundAmounts)`

- 权限：`SETTLER_ROLE`。
- 作用：对已进入 `Refunded` 或 `Cancelled` 的 market 批量退款。
- 入参：
  - `marketId: bytes32`：目标 market；
  - `betIds: bytes32[]`：待退款注单 ID 列表；
  - `refundAmounts: uint256[]`：每笔退款金额，与 `betIds` 一一对应。
- 出参：无。
- 关键校验：
  - `betIds.length == refundAmounts.length`；
  - 批量长度不超过当前固定上限 `20`；
  - market 状态必须是 `Refunded` 或 `Cancelled`；
  - 每笔 bet 必须属于该 market 且状态为 `Pending`；`CashedOut` 注单已经终态关闭，不参与退款；
  - 退款金额不能超过该注单未退款余额；
  - BettingPool 实际 ODD 余额足够。
- 状态变化：
  - 增加 bet 的 `refundedAmount`；
  - 全额退完则注单变为 `Refunded`；
  - 回滚 market 暴露和用户风险账本；
  - 转 ODD 给用户；
  - `quoteVersion += 1` 并重算赔率/信号灯。
- 事件：每笔 `BetRefunded`，以及一次 `OddsUpdated`。

#### `releasePayoutReserve(bytes32 riskId)`

- 权限：`SETTLER_ROLE`；外层 wrapper 带 `nonReentrant`。
- 作用：在运营/keeper 确认普通单注 `matchId` 或串关 `parlayRiskId` 不再需要保留 LP payout reserve 后，释放 `reservedAmount - paidOutAmount`，避免 LP 被未 claim 赔付长期锁定。
- 入参：
  - `riskId: bytes32`：普通单注使用比赛 `matchId`；串关使用 `parlayRiskId`。
- 出参：无；释放金额通过 LiquidityPool 事件或 `getPayoutLiquidityWindow(riskId)` 查询。
- 关键校验：
  - 调用者必须拥有 `SETTLER_ROLE`；
  - `LiquidityPool.releasePayoutReserve(riskId)` 若没有可释放金额会返回 0，不会回滚。
- 状态变化：
  - 通过 `delegatecall` 到 `BettingSettlementModule`；
  - 调用 `LiquidityPool.releasePayoutReserve(riskId)` 释放 unused reserve；
  - 按 `min(releasedAmount, lpLossOffsetRemaining)` 同步减少 `lpLossOffsetRemaining`，避免后续派奖税继续抵扣已释放回 LP 的 booked loss。
- 事件：LiquidityPool 侧 `PayoutReserveReleased`、`PayoutReserveOutstanding(riskId,0)`、`LiquidityAccountingSnapshot(actionKind=11)`。

### 9.4 事件

#### `ReferrerBound(address indexed user, address indexed referrer)`

- 用户绑定推荐人。

#### `ReferralRewardAccumulated(address indexed referrer, uint256 amount, address indexed from, uint8 kind)`

- 推荐奖励增加。
- `kind=0`：下注税推荐奖励；
- `kind=1`：派奖税推荐奖励。

#### `ReferralClaimed(address indexed referrer, uint256 oddAmount)`

- 推荐人领取 ODD 奖励。

#### `ReferralClaimedUSDT(address indexed referrer, uint256 oddAmount, uint256 usdtAmount, uint256 currentPriceX18)`

- 推荐人将 ODD 奖励兑换成 USDT。
- `currentPriceX18`：本次成交价，表示每 1 ODD 对应多少 USDT，并按 `1e18` 缩放。

#### `PayoutClaimed(bytes32 indexed betId, address indexed user, uint256 grossPayout, uint256 taxAmount, uint256 netPayout)`

- 胜单领取完成。
- `grossPayout`：毛赔付；
- `taxAmount`：派彩税；
- `netPayout`：用户实际收到金额。

#### `TaxBufferFunded(uint256 amount, uint256 newTaxBuffer)`

- 派奖税缓冲份额进入 L3 taxBuffer。

#### `LpLossOffsetApplied(uint256 amount, uint256 remainingOffset)`

- 派奖税缓冲份额先冲抵历史 L2 LP loss offset 指标；该事件不表示向 LiquidityPool 转账或恢复 LP 仓位亏损。

#### `ReserveTapped(bytes32 indexed matchId, uint256 tapAmount, uint256 remainingReserve)`

- 瀑布 L4 平台准备金被动用。

#### `ReserveBelowFloor(uint256 remainingReserve)`

- 平台准备金低于紧急地板，合约会 pause。

#### `ReserveStepAlert(uint256 indexed stepIndex, uint256 remainingReserve)`

- 平台准备金跨越预设阶梯告警。

#### `MarketOpened(bytes32 indexed marketId, bytes32 indexed matchId, uint8 marketType, uint8 line, uint64 matchStartTime, uint64 lockAt, uint256 quoteVersion)`

- market 创建成功。
- `marketType / line` 必须按第 3.2 节解释；`line` 是枚举索引，不是盘口小数值。
- AH 事件中的 `line` 永远是主队视角盘口，例如 `line=3` 表示 home `-0.25`，`line=7` 表示 home `+0.25`。
- 当前 `lockAt` 默认等于 `matchEndTime`；若后续手动封锁，实际封锁时间以 `MarketManuallyLocked.lockedAt` 和 `getMarket(marketId).lockAt` 为准。

#### `MarketManuallyLocked(bytes32 indexed marketId, bytes32 indexed matchId, address indexed operator, uint64 lockedAt, uint256 quoteVersion)`

- 后端/运营主动封锁单个 market 时发出；
- `quoteVersion` 为封锁后的新版本。

#### `OddsUpdated(bytes32 indexed marketId, uint64 updatedAt, uint256 quoteVersion, uint8 signal)`

- 赔率版本或信号灯变化。
- 当前触发场景包括开盘、运营更新赔率、下注成交后重算、Cash Out 后重算、`refundBets` 后重算。
- 注意：手动封锁和 `finalizeMarketSettlement` 都会让 `quoteVersion` 变化，但当前代码不会在这些路径上发 `OddsUpdated`；封锁路径会发 `MarketManuallyLocked`，结算路径会发 `MarketSettlementFinalized`。

#### `BetPlaced(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 requestedAmount, uint256 acceptedAmount, uint256 lockedOdds, uint256 quoteVersion, uint8 outcome)`

- 注单成交。
- `requestedAmount`：用户请求下注额；
- `acceptedAmount`：实际成交额；
- `lockedOdds`：锁定赔率；
- `quoteVersion`：成交时赔率版本。

#### `BetRefunded(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 refundAmount, uint8 reason, uint256 quoteVersion)`

- 注单退款。
- `reason` 使用 market status 编码。

#### `BetCashedOut(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 remainingStake, uint256 cashOutAmount, uint256 currentOdds, uint16 feeBps, uint256 quoteVersion)`

- 注单提前 Cash Out。
- `remainingStake`：本次释放的剩余本金；
- `cashOutAmount`：用户实际收到的 ODD；
- `currentOdds`：计算时使用的当前 `quotedOdds`；
- `feeBps`：本次手续费率，`1000` 或 `2000`；
- `quoteVersion`：Cash Out 后的新赔率版本。

#### `MarketSettlementScoreBatchProcessed(bytes32 indexed marketId, uint16 homeScore, uint16 awayScore, uint256 processedCount, uint256 totalBetCount)`

- score-based 分批结算进度事件。
- `homeScore / awayScore` 为该 market 首批锁定的结算比分。
- 后续批次必须使用同一比分。

#### `MarketSettlementFinalized(bytes32 indexed marketId, uint8 resultKind, bool scoreSettled, uint16 homeScore, uint16 awayScore, uint256 grossPayout, uint256 lpMarginShare, uint256 platformMarginShare, uint256 quoteVersion)`

- market 终态汇总。
- `resultKind=0` 表示正常结算，market 进入 `Settled`；
- `resultKind=1/2` 表示退款或取消终态标记，真实逐笔退款后续由 `BetRefunded` 体现；
- `scoreSettled=true` 表示该 market 经过 `settleMarketBetsByScore` 分批结算，`homeScore / awayScore` 为结算比分；
- `scoreSettled=false` 表示零下注正常结算、退款或取消终态标记，事件中的比分字段不作为真实比分解释。

#### `BetClaimed(bytes32 indexed betId, bytes32 indexed marketId, address indexed user, uint256 payout, address executor)`

- 胜单净赔付领取流水。

#### `PlatformReserveUpdated(int256 delta, uint256 newBalance, uint8 reason)`

- 平台准备金变化。
- `delta` 可正可负；
- `reason` 编码：
  - `0`：治理补入；
  - `1`：瀑布消耗；
  - `2`：无 LP 权重时 LP margin 转入准备金；
  - `3`：taxBuffer 超 cap 后溢出转入准备金；
  - `4`：平台 20% margin 留在 BettingPool 并记入准备金；
  - `5`：Cash Out 返还额低于剩余本金时，差额留作平台准备金。

#### `ParlayModuleUpdated(address indexed oldModule, address indexed newModule)`

- 串关模块 implementation 地址切换；
- 仅由 `setParlayModule` 触发。

#### `ParlayPlaced(bytes32 indexed parlayId, address indexed user, uint256 stake, uint256 betTax, uint256 totalDeduct, uint8 legCount, uint256 lockedComboOdds, uint256 maxPayout, bytes32 indexed parlayRiskId)`

- 串关下单成功。
- `stake`：串关注码，不含下注税；
- `betTax`：下注税；
- `totalDeduct = stake + betTax`；
- `legCount`：leg 数量，当前 `2..6`；
- `lockedComboOdds`：锁定组合赔率，最高 `200x`；
- `maxPayout`：单张最大毛赔付，最高 `30,000 ODD`；
- `parlayRiskId`：该串关的 LP payout window / residual reserve riskId；
- 用户串关列表当前通过该事件索引。

#### `ParlayLegExposureReserved(bytes32 indexed parlayId, bytes32 indexed marketId, uint8 outcome, uint256 syntheticPayout)`

- 串关下单时为某个底层 market outcome 预留合成赔付暴露。
- `syntheticPayout` 当前等于整张串关 `maxPayout`；
- 对应 market 的 `payoutByOutcome[outcome]` 和用户 market 潜在赔付会增加，用于 WCL 和单 market 上限校验。

#### `ParlaySettled(bytes32 indexed parlayId, address indexed user, uint8 state, uint256 grossPayout, uint256 marginBase, uint256 lpMarginShare, uint256 platformMarginShare, uint256 lpLossBooked, bytes32 indexed parlayRiskId)`

- 串关结算完成。
- `state` 为结算后的 `ParlayState`；
- `grossPayout` 为中奖毛赔付；全输或全 void 时可能为 0；
- `marginBase` 为参与 margin 分配的本金基数；
- `lpMarginShare / platformMarginShare` 为本次串关 margin 分配；
- `lpLossBooked` 为 Global LP 实际承担亏损；
- `parlayRiskId` 用于后续 claim 拉取 LP payout liquidity 和 residual reserve 释放。

#### `ParlayPayoutClaimed(bytes32 indexed parlayId, address indexed user, uint256 grossPayout, uint256 taxAmount, uint256 netPayout)`

- 串关中奖领取或全 void 退款完成。
- `Refundable` 退款路径中 `taxAmount=0`，`grossPayout=netPayout=stake`；
- `WonUnclaimed` 中奖路径中按派奖税快照计算 `taxAmount`，用户收到 `netPayout`。

#### `MarketFinalResultRecorded(bytes32 indexed marketId, uint8 resultKind, bool scoreSettled, uint16 homeScore, uint16 awayScore)`

- market 最终结果记录，供串关结算和 lens 估值读取；
- 正常结算时 `resultKind=0` 且 `scoreSettled=true` 表示有比分结果；
- 退款或取消时 `resultKind=1/2`，串关对应 leg 视为 `Void`。

---

## 9A. 串关 MVP API

**实现状态：** 已实现并于 2026-06-12 随 ODDToken 锁仓与发售 MVP 全量新部署到 BSC Testnet；2026-06-13 结算缺口 hotfix module 升级后，当前 `BettingPool.parlayModule()` 为 `0xD7AcFb964C01D4be09757207034FD919dA06fE96`，`BettingParlayLens` 为 `0xd139C9C041783D48A3D36aedb8Ea7d99859bD2a2`。
**入口边界：** 写入口都在 `BettingPool` proxy；`BettingParlayModule` 只允许 `delegatecall`，不应直连写入。

### 9A.1 串关支持的 market / line / outcome 速查

串关 leg 不直接传 `marketType / line`，而是通过 `ParlayLegInput.marketId` 引用一个已经开好的底层 market。`BettingParlayModule` 下单时会从 `BettingPool.getMarket(marketId)` 读取该 market 的 `matchId / marketType / line / outcomeCount`，因此串关支持的盘口线等于当前底层 market 支持全集。

关键约束：

- 每张串关支持 `2..6` 个 leg；
- 同一张串关内不允许重复 `marketId`；
- 同一张串关内不允许重复 `matchId`，因此同一场比赛的 1X2 / AH / OU 不能放进同一张串关；
- leg market 必须为 `Open`，未手动 `Locked`，且 `block.timestamp < matchEndTime`；
- AH `line` 永远是主队视角，不能传客队视角盘口；
- OU `outcome=0` 是 Over，`outcome=1` 是 Under；
- 1X2 / AH / OU 的 full push、half win、half loss 均由底层 score-based settlement 物化后被串关继承。

| `marketType` | MarketType enum | 市场 | 支持 `line` | outcome 编码 |
|---:|---|---|---|---|
| `0` | `MarketType.OneXTwo` | 1X2 / 胜平负 | `0` | `0=主胜`，`1=平局`，`2=客胜` |
| `1` | `MarketType.AsianHandicap` | AH / 亚洲让球 | `0..12` | `0=主队方向`，`1=客队方向` |
| `2` | `MarketType.OverUnder` | OU / 大小球 | `0..10` | `0=Over`，`1=Under` |

AH line enum：

| `line` | AhLine enum | 业务含义 |
|---:|---|---|
| `0` | `AhLine.MinusHalf` | home `-0.5` |
| `1` | `AhLine.MinusOne` | home `-1.0` |
| `2` | `AhLine.MinusOnePointFive` | home `-1.5` |
| `3` | `AhLine.MinusQuarter` | home `-0.25` |
| `4` | `AhLine.MinusThreeQuarter` | home `-0.75` |
| `5` | `AhLine.MinusOnePointTwoFive` | home `-1.25` |
| `6` | `AhLine.PlusZero` | home `+0` |
| `7` | `AhLine.PlusQuarter` | home `+0.25` |
| `8` | `AhLine.PlusHalf` | home `+0.5` |
| `9` | `AhLine.PlusThreeQuarter` | home `+0.75` |
| `10` | `AhLine.MinusOnePointSevenFive` | home `-1.75` |
| `11` | `AhLine.MinusTwo` | home `-2.0` |
| `12` | `AhLine.MinusThree` | home `-3.0` |

OU line enum：

| `line` | OuLine enum | 业务含义 |
|---:|---|---|
| `0` | `OuLine.OnePointFive` | `1.5` |
| `1` | `OuLine.TwoPointFive` | `2.5` |
| `2` | `OuLine.ThreePointFive` | `3.5` |
| `3` | `OuLine.Zero` | `0` |
| `4` | `OuLine.ZeroPointFive` | `0.5` |
| `5` | `OuLine.One` | `1` |
| `6` | `OuLine.OnePointSevenFive` | `1.75` |
| `7` | `OuLine.Two` | `2` |
| `8` | `OuLine.TwoPointTwoFive` | `2.25` |
| `9` | `OuLine.TwoPointSevenFive` | `2.75` |
| `10` | `OuLine.Three` | `3` |

串关状态 enum：

| 编码 | ParlayState enum | 含义 |
|---:|---|---|
| `0` | `ParlayState.Pending` | 未结算 |
| `1` | `ParlayState.Lost` | 已判负 |
| `2` | `ParlayState.WonUnclaimed` | 已中奖但未领取 |
| `3` | `ParlayState.WonClaimed` | 中奖且已领取 |
| `4` | `ParlayState.Refundable` | 全部有效 leg 都 void / push，可退本金 |
| `5` | `ParlayState.Refunded` | 本金已退回 |

串关 leg 结果 enum：

| 编码 | ParlayLegResult enum | 组合赔率处理 |
|---:|---|---|
| `0` | `ParlayLegResult.Pending` | 未物化结果 |
| `1` | `ParlayLegResult.FullWin` | 按该 leg `lockedOdds` 进入组合因子 |
| `2` | `ParlayLegResult.FullLoss` | 整张串关判负 |
| `3` | `ParlayLegResult.FullPush` | 不计入组合赔率，退回该 leg 影响 |
| `4` | `ParlayLegResult.HalfWin` | 按 `(lockedOdds + 1.00) / 2` 进入组合因子 |
| `5` | `ParlayLegResult.HalfLoss` | 按 `0.5` 进入组合因子 |
| `6` | `ParlayLegResult.Void` | 底层 market `Refunded / Cancelled`，不计入组合赔率 |

更完整的单关结算条件见第 3.4 至第 3.6 节；串关只继承底层 market 终局结果，不为串关单独定义另一套盘口语义。

### 9A.2 `ParlayLegInput`

```solidity
struct ParlayLegInput {
    bytes32 marketId;
    uint8 outcome;
    uint256 quoteVersion;
    uint64 quotedAt;
    uint256 minOdds;
}
```

- `marketId`：底层盘口 ID；
- `outcome`：该盘口选择项；
- `quoteVersion / quotedAt`：来自 `getMarketOdds(marketId)`；
- `minOdds`：该 leg 最低接受赔率。
- 字段完整含义见第 5.9 节；可选 market / line / outcome 见第 9A.1 节。

### 9A.3 `placeParlay`

```solidity
function placeParlay(
    ParlayLegInput[] calldata legs,
    uint256 stake,
    uint256 minComboOdds,
    uint256 deadline,
    address referrer
) external returns (bytes32 parlayId);
```

- 分类：前端 API。
- 作用：创建一张串关。
- 前置操作：
  - 用户需先 `ODDToken.approve(BettingPool, stake + betTax)`；
  - 前端应逐个 leg 读取 `getMarketOdds(marketId)`，并可先调用 `BettingParlayLens.previewParlay`。
- 入参：
  - `legs: ParlayLegInput[]`：串关 legs，当前支持 `2..6`；
  - `stake: uint256`：串关注码，不含下注税，必须不低于 `MIN_BET_AMOUNT`；
  - `minComboOdds: uint256`：用户可接受的最低组合赔率，精度 `1e4`；
  - `deadline: uint256`：交易截止时间戳，超过后回滚；
  - `referrer: address`：首次下单可顺带绑定推荐人，传 `address(0)` 表示不绑定。
- 出参：
  - `parlayId: bytes32`：新串关 ID。
- 关键校验：
  - 合约未暂停；
  - leg 数为 `2..6`；
  - 每个 leg 的 market 存在、状态为 `Open`、未手动封锁、未到 `matchEndTime`；
  - 每个 leg 的 `quoteVersion / quotedAt` 必须匹配当前 `getMarketOdds`；
  - 每个 leg 锁定赔率必须不低于该 leg 的 `minOdds`；
  - 同一张串关不允许重复 `marketId`，也不允许重复 `matchId`；
  - 锁定组合赔率必须不低于 `minComboOdds`；
  - 用户 VIP dailyLimit、open position limit、每个 leg 对应 market 的用户潜在赔付上限和 WCL 红灯阈值都必须满足；
  - `maxPayout <= availableParlayCapacity`，否则回滚。
- 资金和风控：
  - 从用户扣 `stake + betTax`；
  - `lockedComboOdds` 按 leg 锁定赔率相乘，最高封顶 `200x`；
  - `maxPayout = min(stake * lockedComboOdds / 1e4, 30,000 ODD)`；
  - 若原始 payout 超过 `30,000 ODD`，仍可下注，但 `maxPayout` 被截断；
  - 每个 leg 都以 `syntheticPayout = maxPayout` 写入底层 market 的 `payoutByOutcome[outcome]` 和用户 market 潜在赔付，用于 WCL 和上限校验；
  - `openParlayMaxPayout += maxPayout`，防止多张未结算串关重复复用同一份 Global LP / reserve 容量；
  - 串关不支持部分成交。
- 事件：`ParlayPlaced`、每个 leg 一条 `ParlayLegExposureReserved`，并对受影响 market 发 `OddsUpdated`。
- 明确不支持：当前 ABI 不存在 `cashOutParlay` 或 `quoteParlayCashOut`，串关不可提前 Cash Out。

### 9A.4 `settleParlay / claimParlayPayout`

```solidity
function settleParlay(bytes32 parlayId) external;
function claimParlayPayout(bytes32 parlayId) external;
```

- `settleParlay`：`SETTLER_ROLE` 调用，要求所有 leg 的底层 market 已终局；
- `claimParlayPayout`：用户领取 `WonUnclaimed` 或 `Refundable` 串关；
- `Refundable` 不收派奖税、不拉 LP；
- `WonUnclaimed` 复用现有派奖税、referrer、staking reward、taxBuffer、Global LP 瀑布。

`settleParlay` 结算规则：

- 每个 leg 从 `marketFinalResults(marketId)` 读取底层 market 终局结果；
- 底层 market 退款或取消时，该 leg 记为 `Void`，不计入组合赔率；
- 任一 leg `FullLoss` 时，整张串关 `Lost`；
- `FullWin` 按 `lockedOdds` 进入组合因子；
- `HalfWin` 按 `(lockedOdds + 1.00) / 2` 进入组合因子；
- `HalfLoss` 按 `0.5` 进入组合因子；
- 若全部有效 leg 都为 `Void / FullPush`，整张串关 `Refundable`，`claimablePayout = stake`；
- 否则 `grossPayout = min(stake * factorProduct / 1e18, maxPayout)`，中奖则进入 `WonUnclaimed`。

`settleParlay` 会计规则：

- 结算时释放所有 leg 的合成暴露，减少 `openParlayMaxPayout`；
- 亏损串关以 `stake` 为 marginBase；
- 中奖但 `grossPayout < stake` 时，`stake - grossPayout` 为 marginBase；
- 中奖且 `grossPayout >= stake` 时，`stake` 为 marginBase；结算净缺口按 `netLoss = max(grossPayout - (stake - totalMargin), 0)` 进入 Global L2 -> L3 -> L4 瀑布，不再把整笔 `grossPayout` 或单纯的 `grossPayout - stake` 当作瀑布输入；
- 串关 LP 路径只使用 Global Pool，不使用任何单场 Match Pool。

`claimParlayPayout` 领取规则：

- `msg.sender` 必须是串关 owner；
- `Refundable` 路径把 `claimablePayout` 作为本金退款转给用户，不收派奖税；
- `WonUnclaimed` 路径按结算时快照的派奖税率计算税，必要时通过 `parlayRiskId` 从 LiquidityPool 拉取 payout liquidity，再把净赔付转给用户；
- 若 claim 后该 `parlayRiskId` 仍有 unused LP payout reserve，后端应监听 `PayoutReserveOutstanding`，确认无需保留后调用 `BettingPool.releasePayoutReserve(parlayRiskId)`。
- 事件：`ParlaySettled`、`ParlayPayoutClaimed`，中奖路径可能触发 `TaxBufferFunded / LpLossOffsetApplied / ReferralRewardAccumulated` 和 LiquidityPool 相关事件。

```solidity
function getParlayClaimStatus(address bettingPoolAddress, address userAddress, bytes32 parlayId)
    external
    view
    returns (bool won, uint256 reward);
```

- 直连只读查询，写在 `BettingParlayModule`；也可通过 `BettingPool.getParlayClaimStatus(userAddress,parlayId)` wrapper 查询；任何地址都可以调用，不要求角色，不要求 `msg.sender == userAddress`；
- 调用目标必须是已升级到该 ABI 的 `BettingParlayModule` 地址；当前测试网旧模块地址在升级前不能调用该新增方法；
- `bettingPoolAddress`：真实 `BettingPool` proxy 地址；
- `userAddress`：要查询的用户地址，调用方可任意传入；
- `parlayId`：串关注单 ID；
- 若 parlay 不存在，返回 `(false, 0)`；
- 若 parlay 存在但任一 leg 底层 market 尚未到 `matchEndTime`，revert；
- 若 `userAddress` 不是 parlay owner，返回 `(false, 0)`；
- 若 parlay 为 `WonUnclaimed`，返回 `(true, netReward)`，其中 `netReward = claimablePayout - claimablePayout * payoutTaxRateBps / 10000`；
- 若 parlay 为 `WonClaimed`，返回 `(true, 0)`；
- 若 parlay 为 `Refundable`，返回 `(false, claimablePayout)`，表示未赢但有本金退款可提；
- 其他状态，如 `Pending / Lost / Refunded`，返回 `(false, 0)`。

```solidity
function releasePayoutReserve(bytes32 riskId) external;
```

- 权限：`SETTLER_ROLE`。
- 作用：在运营/keeper 确认普通单注 `matchId` 或串关 `parlayRiskId` 不再需要保留 LP payout reserve 后，释放 `reservedAmount - paidOutAmount`，避免 LP 被未 claim 赔付无限期锁定。
- 返回值：无；释放金额通过 `LiquidityPool.PayoutReserveReleased` / `PayoutReserveOutstanding` 事件或 `getPayoutLiquidityWindow` 查询。
- 状态变化：
  - 调用 `LiquidityPool.releasePayoutReserve(riskId)` 释放 unused reserve；
  - 按 `min(releasedAmount, lpLossOffsetRemaining)` 同步减少 `lpLossOffsetRemaining`，避免后续派奖税继续抵扣已释放回 LP 的 booked loss。
- 说明：该接口也已在第 9.2 节作为 BettingPool 公共只读 wrapper 列出。

### 9A.5 只读查询

```solidity
function parlays(bytes32 parlayId) external view returns (...ParlayBet fields);
function parlayLegs(bytes32 parlayId, uint256 index) external view returns (...ParlayLeg fields);
function marketFinalResults(bytes32 marketId) external view returns (...MarketFinalResult fields);
function openParlayMaxPayout() external view returns (uint256);
function parlayModule() external view returns (address);
```

说明：为保证 `BettingPool` runtime size 低于 EIP-170，本期不暴露 `getParlay / getParlayLegs / getUserParlayIds` 聚合 getter。用户串关列表通过 `ParlayPlaced` 事件索引。

### 9A.6 BettingParlayLens

```solidity
function previewParlay(address bettingPool, ParlayLegInput[] calldata legs, uint256 stake, address user)
    external
    view
    returns (ParlayPreview memory);

function estimateParlayValue(address bettingPool, address userAddress, bytes32 parlayId)
    external
    view
    returns (ParlayEstimatedValue memory);

```

- `previewParlay`：下单前预览组合赔率、`maxPayout`、是否被赔率/赔付上限截断和当前可用串关容量；
- `estimateParlayValue`：直连 `BettingParlayLens` 的只读展示查询；也可通过 `BettingPool.estimateParlayValue(userAddress,parlayId)` wrapper 查询。只允许查询 `userAddress` 名下仍处于 `Pending` 的未结算串关；若 `userAddress` 不是 parlay owner 或 parlay 不存在，返回完整默认 0 值；若 parlay 已进入 `Lost / WonUnclaimed / WonClaimed / Refundable / Refunded` 等非 `Pending` 状态则 revert；返回的 `estimatedValue / floatingPnL` 仅用于展示，不可 claim、不可提现、不是 Cash Out 报价。
- 返回字段完整含义见第 5.13 和第 5.14 节。

---

## 10. BettingSettlementModule

**所属合约：** `BettingSettlementModule`
**测试网地址：** 不作为前后端固定直连地址；通过 `BettingPool.settlementModule()` 或最新部署 / 升级记录读取。

### 10.1 使用方式

- 该合约不是前端 API；
- 该合约也不是后端常规直连接口；
- `lockMarket / cashOut / claimPayout / releasePayoutReserve / settleMarketBetsByScore / finalizeMarketSettlement / refundBets` 应通过 `BettingPool` 同名 wrapper 调用；
- 模块内 `onlyDelegateCall` 会阻止直接调用；
- 模块通过 `delegatecall` 使用 `BettingPool` proxy storage，因此事件和状态变化都属于 BettingPool 上下文；
- 由于继承 `BettingPoolStorage`，ABI 里可能出现 inherited getter / AccessControl / Pausable 方法，但这些读取的是模块自身未初始化存储，不代表真实业务状态。

### 10.2 业务入口 ABI

#### `getClaimStatus(address bettingPoolAddress, address userAddress, bytes32 betId) returns (bool won, uint256 reward)`

- 直连只读查询，写在 `BettingSettlementModule`；也可通过 `BettingPool.getClaimStatus(userAddress,betId)` wrapper 查询；任何地址都可以调用，不要求角色，不要求 `msg.sender == userAddress`；
- 调用目标必须是已升级到该 ABI 的 `BettingSettlementModule` 地址；当前测试网旧模块地址在升级前不能调用该新增方法；
- `bettingPoolAddress`：真实 `BettingPool` proxy 地址；
- `userAddress`：要查询的用户地址，调用方可任意传入；
- `betId`：普通单注 ID；
- 若 bet 不存在，返回 `(false, 0)`；
- 若 bet 存在但底层 market 尚未到 `matchEndTime`，revert；
- 若 `userAddress` 不是 bet owner，返回 `(false, 0)`；
- 若 bet 为 `WonUnclaimed`，返回 `(true, netReward)`，其中 `netReward = claimablePayout - claimablePayout * payoutTaxRateBps / 10000`；
- 若 bet 为 `WonClaimed`，返回 `(true, 0)`；
- 其他状态，如 `Pending / Lost / Refunded / CashedOut`，返回 `(false, 0)`。

#### `estimateBetValue(address bettingPoolAddress, address userAddress, bytes32 betId) returns (uint256 estimatedValue, int256 floatingPnL)`

- 直连只读查询，写在 `BettingSettlementModule`；也可通过 `BettingPool.estimateBetValue(userAddress,betId)` wrapper 查询；任何地址都可以调用，不要求角色，不要求 `msg.sender == userAddress`；
- 调用目标必须是已升级到该 ABI 的 `BettingSettlementModule` 地址；当前测试网旧模块地址在升级前不能调用该新增方法；
- `bettingPoolAddress`：真实 `BettingPool` proxy 地址；
- `userAddress`：要查询的用户地址，调用方可任意传入；
- `betId`：普通单注 ID；
- 若 bet 不存在或 `userAddress` 不是 bet owner，返回 `(0, 0)`；
- 只允许查询仍处于 `Pending` 的未结算注单；若 bet 已经 `Refunded / Lost / WonUnclaimed / WonClaimed / CashedOut`，revert；
- 只允许在 market 未终态且 `block.timestamp < matchEndTime` 时查询；若 market 已终态或比赛已结束，revert；
- `estimatedValue = remainingStake * lockedOdds / currentOdds[outcome]`，使用赔率精度 `1e4` 换算；
- `floatingPnL = estimatedValue - remainingStake`；
- 返回值仅用于过程盈亏展示，不可 claim、不可提现，也不是 Cash Out 报价。

#### `lockMarket(bytes32 marketId)`

- 仅供 `BettingPool.lockMarket` 路由；
- 参数含义同 BettingPool 对外入口。

#### `settleMarketBetsByScore(bytes32 marketId, uint16 homeScore, uint16 awayScore, bytes32[] betIds)`

- 仅供 `BettingPool.settleMarketBetsByScore` 路由；
- 参数含义同 BettingPool 对外入口。

#### `finalizeMarketSettlement(bytes32 marketId, uint8 resultKindRaw)`

- 仅供 `BettingPool.finalizeMarketSettlement` 路由；
- 参数含义同 BettingPool 对外入口。

#### `refundBets(bytes32 marketId, bytes32[] betIds, uint256[] refundAmounts)`

- 仅供 `BettingPool.refundBets` 路由；
- 参数含义同 BettingPool 对外入口。

#### `cashOut(bytes32 betId, uint256 expectedQuoteVersion, uint64 quotedAt, uint256 minAmountOut, uint256 deadline)`

- 仅供 `BettingPool.cashOut` 路由；
- 参数含义同 BettingPool 对外入口。

#### `claimPayout(bytes32 betId)`

- 仅供 `BettingPool.claimPayout` 路由；
- 参数含义同 BettingPool 对外入口。

#### `releasePayoutReserve(bytes32 riskId)`

- 仅供 `BettingPool.releasePayoutReserve` 路由；
- 参数含义同 BettingPool 对外入口。

---

## 11. 前后端调用建议

### 11.1 前端直连主路径

前端主要直连：

- `ODDToken.transfer / approve / transferFrom`
- `StakingPool.stake / unstake / earlyUnstake`
- `LiquidityPool.depositGlobal / depositMatch / requestUnbond / withdraw`
- `BettingPool.bindReferrer / previewSignal / placeBet / cashOut / claimPayout / placeParlay / claimParlayPayout / claimReferralRewards / claimUSDTReferralRewards`
- `BettingParlayLens.previewParlay / estimateParlayValue`
- 各合约只读 getter

### 11.2 后端 / 运营主路径

后端或治理脚本主要直连：

- `openMarket / updateOdds / lockMarket`
- 正常赛果结算：`getMarketBetIds -> settleMarketBetsByScore(marketId, homeScore, awayScore, betIds)` 分批处理 -> `finalizeMarketSettlement(marketId, 0)`
- 退款或取消终态标记：`finalizeMarketSettlement(marketId, 1或2)`，后续 `refundBets` 分批真实退款
- 串关结算：等待所有底层 market 终局后调用 `settleParlay(parlayId)`
- payout reserve 残留释放：监听 `PayoutReserveOutstanding(riskId,outstandingAmount)`，确认无需保留后调用 `releasePayoutReserve(riskId)`
- 所有 `set*` 治理接口
- `addPlatformReserve`
- `pause / unpause`
- `upgradeToAndCall`

### 11.3 不应直连的接口

以下接口通常只应由合约内部或指定合约调用：

- `StakingPool.notifyReward`
- `LiquidityPool.openMatchPool`
- `LiquidityPool.closeMatchPoolDeposit`
- `LiquidityPool.distributeMargin`
- `LiquidityPool.distributeLoss`
- `LiquidityPool.distributeGlobalMargin`
- `LiquidityPool.distributeGlobalLoss`
- `LiquidityPool.requestPayoutLiquidity`
- `BettingSettlementModule` 的全部业务入口
- `BettingBetModule` 的全部业务入口
- `BettingMarketModule` 的全部业务入口
- `BettingReferralModule` 的全部业务入口
- `BettingParlayModule` 的全部业务入口

### 11.4 推荐下注调用顺序

1. `getMarket(marketId)`：确认 market 状态、类型、手动封锁时间或比赛结束边界；
2. `getMarketOdds(marketId)`：读取 `quotedOdds / updatedAt / quoteVersion`；
3. `previewSignal(marketId, outcome, requestedAmount)`：预估实际成交额、赔率和信号灯；
4. `ODDToken.approve(BettingPool, requestedAmount + betTax)`：确保授权足够；
5. 组装 `QuoteGuardInput`：
   - `quoteVersion = getMarketOdds.quoteVersion`
   - `quotedAt = getMarketOdds.updatedAt`
   - `minOdds` 按用户滑点偏好设置
   - `minAcceptedAmount` 按用户是否接受部分成交设置
   - `deadline` 设置较短有效期
6. `placeBet(...)`。

### 11.4A 推荐 Cash Out 调用顺序

1. `getBet(betId)`：确认 owner、marketId、outcome、acceptedAmount、refundedAmount、lockedOdds 与 `settlementState=Pending`；
2. `getMarket(marketId)`：确认 market 为 `Open` 且未到 `matchEndTime`；
3. `getMarketOdds(marketId)`：读取当前 outcome 的 `quotedOdds` 与 `quoteVersion`；
4. 前端按第 9.1 `cashOut` 公式计算 `cashOutAmount`，生成 `quotedAt = latest chain block timestamp`、`minAmountOut` 和短 `deadline`；
5. `cashOut(betId, quoteVersion, quotedAt, minAmountOut, deadline)`。

### 11.4B 推荐串关调用顺序

1. 对每个候选 leg 调 `getMarket(marketId)`：确认 market 为 `Open`、未手动封锁、未到 `matchEndTime`，并记录 `matchId` 用于前端先做同场去重；
2. 对每个 leg 调 `getMarketOdds(marketId)`：读取 `quotedOdds[outcome] / updatedAt / quoteVersion`；
3. 组装 `ParlayLegInput[]`，其中 `quotedAt = getMarketOdds.updatedAt`，`quoteVersion = getMarketOdds.quoteVersion`，`minOdds` 按用户滑点偏好设置；
4. 调 `BettingParlayLens.previewParlay(BettingPool, legs, stake, user)`：展示 `rawComboOdds / lockedComboOdds / maxPayout / availableParlayCapacity / cappedByOdds / cappedByPayout`；
5. `ODDToken.approve(BettingPool, stake + betTax)`：确保授权足够；
6. 调 `placeParlay(legs, stake, minComboOdds, deadline, referrer)`；
7. 前端通过 `ParlayPlaced` 事件索引用户串关列表，通过 `parlays(parlayId)` 和 `parlayLegs(parlayId,index)` 展示详情；
8. 比赛进行中可调 `BettingParlayLens.estimateParlayValue(BettingPool, user, parlayId)` 展示 `estimatedValue / floatingPnL`，但这些值不可 claim、不可提现、不是 Cash Out 报价；串关已结算后该接口会 revert。

### 11.5 推荐开盘调用顺序

1. 后端生成 `matchId`；
2. 选择 `marketType / line`，其中 AH `line` 必须先转换成第 3.2 / 3.4 节定义的主队视角枚举索引；
3. 准备合法长度、精度和顺序的 `baseOdds`，1X2 为 `[home, draw, away]`，AH 为 `[home side, away side]`，OU 为 `[over, under]`；
4. 设置 `matchStartTime / matchEndTime / updatedAt`；
5. 调用 `openMarket(...)`；
6. 若同一 `matchId` 首次开盘，合约会自动创建 Match Pool；
7. 后续同场其他盘口继续调用 `openMarket(...)`，不会重复创建 Match Pool。
