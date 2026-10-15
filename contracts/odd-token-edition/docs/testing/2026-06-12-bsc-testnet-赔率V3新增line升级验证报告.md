# 2026-06-12 BSC Testnet 赔率 V3 新增 line 升级验证报告

**结论：** 通过  
**网络：** BNB Smart Chain Testnet, chainId `97`  
**范围：** 赔率 V3 新增 AH `line=10..12`、OU `line=3..10` 的 module 发布、源码验证、开盘边界、单关下注到结算、串关继承 half/push 结果。  
**安全说明：** 本报告仅记录地址、tx hash 与验证结论；私钥、RPC URL、BscScan API key 均不写入文档。

## 当前地址

| 项 | 地址 |
|---|---|
| `BettingPool` proxy | `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3` |
| `BettingOddsLib` | `0x8143fe80565acbc809f1c1fd0d57c758495f7aa6` |
| `BettingSettlementModule` | `0xD05070e92F8981578e27DF3BFA32094549Ec54Dc` |
| `BettingMarketModule` | `0xD786A66a77Ff137A09Aa2fa69BbD8f6AE42f79De` |
| `BettingParlayModule` | `0xeDBC57c205129FDB0501cEa42Fc4bD68C1AAcBaA` |
| `BettingParlayLens` | `0xd139C9C041783D48A3D36aedb8Ea7d99859bD2a2` |
| `BettingBetModule` | `0xe911D8472F53f64E8B06eAb31E8Ec6Cc5B4c8825` |
| `BettingReferralModule` | `0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B` |

链上 getter 复核：

- `BettingPool.settlementModule()` = `0xD05070e92F8981578e27DF3BFA32094549Ec54Dc`
- `BettingPool.marketModule()` = `0xD786A66a77Ff137A09Aa2fa69BbD8f6AE42f79De`
- `BettingPool.parlayModule()` = `0xeDBC57c205129FDB0501cEa42Fc4bD68C1AAcBaA`
- `BettingPool.referralModule()` = `0x6f481A9E772AFDF85741a5FA82985DCcaC79Bb6B`

## 发布与源码验证

| 动作 | tx |
|---|---|
| 部署 `BettingOddsLib` | `0x033622570391f4068f85cfbb2d17728ec89b383b7fbce53956babf313cdb2cc4` |
| 部署 `BettingSettlementModule` | `0x3a94a7ff6cf6e64505cf64619fcadd6d4542dde116cefe35c59669d27d03d871` |
| 部署 `BettingMarketModule` | `0x3edcca638528c0d7aa905e6f0c8f0e989607d5a952ea951afe7a071dd30b563d` |
| 部署 `BettingParlayModule` | `0x4d7feefb6112ad48b4303f6be5d24aa40dae101d1b1b91e2f20442340ff26eb2` |
| 部署 `BettingParlayLens` | `0x0ca95c36e29764b8539eaf23acc2e4c3d3e9e4e3c62221d91b61139dddbe1062` |
| `setSettlementModule` | `0xbf93ffd1b111a0137e504147d51f9128f8e68017a9d8e0c98a41c096132c22e6` |
| `setMarketModule` | `0x3bbb22f85e0b125af7379155dd008b51f5169a64f662e61076db71ac807c68bb` |
| `setParlayModule` | `0x62d2587604b2f21bf1eec5cc5432074d2d9529b4ef983a911ce43ad269f2c51d` |

源码验证结果：

- `BettingOddsLib`：verified
- `BettingSettlementModule`：verified
- `BettingMarketModule`：verified
- `BettingParlayModule`：verified
- `BettingParlayLens`：verified

## line 边界验证

使用 `eth_call` 模拟 `BettingPool.openMarket(...)`，不落链：

| 类型 | line | 结果 |
|---|---:|---|
| AH | `10` | ok |
| AH | `11` | ok |
| AH | `12` | ok |
| OU | `3` | ok |
| OU | `4` | ok |
| OU | `5` | ok |
| OU | `6` | ok |
| OU | `7` | ok |
| OU | `8` | ok |
| OU | `9` | ok |
| OU | `10` | ok |
| AH | `13` | revert as expected |
| OU | `11` | revert as expected |

## 实链下注到结算

验证 salt：`0x3374ab50b41807a1bbabf335a561157c09a035dd1c0bc1b37997682439b676e6`  
`matchStartTime=1781254221`，`matchEndTime=1781254461`

授权：

- `ODD.approve(BettingPool,max)` tx：`0x90debe5e07cf1cc38bb5daff78d4d28f6dd8633e77aa1b4b232c218301f3dd56`

### 单关

| 场景 | marketId | betId | open tx | place tx | 结算比分 | 最终状态 |
|---|---|---|---|---|---|---|
| AH `line=10` 主队 `-1.75` half win | `0xa97875384dd4a8ded65357826e4c574f590ae640c447140e4f3d85745f97fddd` | `0x0000000000000000000000000000000000000000000000000000000000000007` | `0x31f9ab297eaa9d31777865df5d5ab5f4fce3ab7fdcede0f1a297e27858a74472` | `0x671bdf93a1e2195530b175e9bc6314ffb6d9664e195265b0079d4995a7af0bd4` | `2:0` | `WonClaimed`，退半 `50 ODD`，中奖 gross `100 ODD` |
| OU `line=8` `2.25` Over half loss | `0xe27399217ed2ce8e257b3bb90ffb14887f84cf2c4a1884d774e1531065b39e44` | `0x0000000000000000000000000000000000000000000000000000000000000008` | `0x0d333d92116064b4a0cc26e207b82f220e6fbae7b5fb209a30dc1ca07984c8f2` | `0x01740bf7605646415538422116652df7a90cadf393567be91f29b740ab60f1f8` | `2:0` | `Lost`，退半 `50 ODD` |
| OU `line=10` `3` Over full push | `0x489cca92bb8f47d36dc17a3dfe649b31b9a063ca049605301061369a3b811af2` | `0x0000000000000000000000000000000000000000000000000000000000000009` | `0x330d903b59f4ff3cd2467d6c6bffeb059f0d92d2e3fd55ef3d6366683a2bf3f3` | `0xdf0ad2b8b7d9a0e3334966c6a5cf7759afc5b9d0ff65032f757b32336a41de33` | `3:0` | `Refunded`，全退 `100 ODD` |

单关结算 tx：

| 动作 | tx |
|---|---|
| AH10 settle | `0xfe33252ad10549474951b9dae37947bcb78f3b3813979c49723dcb5696e79b08` |
| AH10 finalize | `0xb81c3e73db7d328ccd5c71df1f6c68fd452a2d511d45a575cc3d9102a085379e` |
| AH10 claim | `0x2cba7c487e9cacb66e57dfdaaaf12f874b178eeab8803bf0befc33eee011789e` |
| OU8 settle | `0xb7e572b3cc31f651c7907aed11d0fb664e95fe22d70c322042df7bcdd0b7bb54` |
| OU8 finalize | `0x155e94124b9e22529739c86d288df701069b3da6dacbabbdd17d6c162583ffc8` |
| OU10 settle | `0x35be51298c582e0628f0de4a2b63766c31161f954403e7b98d01c7c753237919` |
| OU10 finalize | `0xae4faf0858c43bfc0146481be564d0df50e8d906abfed3fada5bfa2f10d5194c` |

### 串关

parlayId：`0xd94acecd0ca4b50fa6ea43022f61a624481f516f1a656b79603b087fa97a15f9`

| leg | marketId | line | score | 结果 |
|---:|---|---|---|---|
| 0 | `0x72e4ce850e268f9a6c816ec5a8fb4f39fb90a9c182cc4f07dd796dac9065d841` | AH `10` | `2:0` | `HalfWin` |
| 1 | `0x84255acb46fdc441fbbce4bcd14549ac8152a8e71a7c43f31e4bf903b8ed1e18` | OU `8` | `2:0` | `HalfLoss` |
| 2 | `0x0f05602241b6300abdf730ad15d7daa8ca2d8afe5423b3ffcb7c84ae8ec20207` | OU `10` | `3:0` | `FullPush` |
| 3 | `0xda0a8f73906547852acac28184183a56b52f3c2569443cd80cdab66f10180f48` | 1X2 `0` | `1:0` | `FullWin` |

串关 open/place tx：

| 动作 | tx |
|---|---|
| open AH10 leg | `0xea93b94eb66b5468e6f3fdc9cb4b7eba058c47c843fcacb7dfc8af8f78ae8eae` |
| open OU8 leg | `0xb25f1d75bdb5e43c96f745f89162d0cea5b4ffd9dd47b7a12e4dbe961175f63d` |
| open OU10 leg | `0xa29c48d3077dd9302731119d0d5dec8517ca1c96da019945b0534536e3e1e1e0` |
| open 1X2 leg | `0x291b67bdf88f5c7ec44d1ec67905cbbb2ca18d162261eadd13a2bb31fc7761b1` |
| placeParlay | `0xea914acae9a78721e073ca03639c0ca44bf169d8ee6325587d6cc1ed6a417a89` |

串关结算 tx：

| 动作 | tx |
|---|---|
| AH10 leg settle | `0x0636c8e7805103737d3147f9ce02552df0afddb2dacfdebe148c6a2d82ed86c4` |
| AH10 leg finalize | `0x09db1ea0dd7b518baed3c388cf41f2b38f50e3d1193e733e6d78906d0d6ea26c` |
| OU8 leg settle | `0x97cf86870f9e86fdf4c72798cef069ca4a8b89449434b659af12c4048e0257a5` |
| OU8 leg finalize | `0xbf67fe65f05f9592ef43de84404c4827bc5282d6bc355a313173db5b303d495c` |
| OU10 leg settle | `0x5732464476a2a613ab9c8da12c3593032989b1703e0dbbdc07fbf85a764f1eb3` |
| OU10 leg finalize | `0x434b0c34ad1570bcc31fd1e61fa207e5439faa4157fd99ce39b84abbd18e39d1` |
| 1X2 leg settle | `0xfdfe9c21966e0b9b8a361209bebfbd8da1bf2589dbce68dc8dbe8f1e42af5fb4` |
| 1X2 leg finalize | `0x9cf7452ccfb7e811a38841cdce2f01ee27bbd5fabe9064647d80d1b40119435d` |
| settleParlay | `0x93cb3551f71ba3c1b1c7f429d5ef9ae51add0a88cdd0b48686533f8948a1a0a1` |
| claimParlayPayout | `0x238cafbe81c8360038217375ee3d7da26327fc6be415e0565e8f2c08f478b359` |

最终只读复核：

- 7 个验证 market 均为 `MarketStatus.Settled`
- 单关 AH10 bet 为 `WonClaimed`
- 单关 OU8 bet 为 `Lost`
- 单关 OU10 bet 为 `Refunded`
- 串关为 `WonClaimed`
- 串关 leg result 为 `[HalfWin, HalfLoss, FullPush, FullWin]`

## 本地与工具验证

- `forge fmt script/BscTestnetOddsV3LineValidation.s.sol`
- `forge build --offline --skip test`
- module getter `cast call` 复核通过
- 新增合法 line `cast call openMarket(...)` 复核通过
- 非法边界 `AH line=13`、`OU line=11` 复核为 revert

Foundry build 仍输出仓库既有 lint/AST 提示，本次新增脚本与 V3 line 发布验证未引入新的业务合约源码改动。
