# 2026-06-13 BSC Testnet Settlement NetLoss Hotfix Query Interfaces Live Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- startBlock: `113086547`
- endBlock: `113089432`
- BettingSettlementModule: `0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39`
- BettingParlayModule: `0xD7AcFb964C01D4be09757207034FD919dA06fE96`
- BettingParlayLens: `0xd139C9C041783D48A3D36aedb8Ea7d99859bD2a2`
- singleBetId: `000000000000000000000000000000000000000000000000000000000000003e`
- cashoutBetId: `000000000000000000000000000000000000000000000000000000000000003f`
- parlayId: `621368a947cb572e3bbe78acfb317b9df6de21754a65de0268869c9b9dd5592f`
- lpPositionId: `13`
- stakePositionId: `11`

## Checks
- [PASS] `BETTING_SETTLEMENT_MODULE_CONFIGURED`: 0xC29ebbdd68d7718f0fe1B8E187d84ae8F34bfA39
- [PASS] `BETTING_PARLAY_MODULE_CONFIGURED`: 0xD7AcFb964C01D4be09757207034FD919dA06fE96
- [PASS] `SEED_ODD_bettor_status`: status=1, tx=ef4be662290e7a59bb6193647e706759510d70e04f568fc127486f5a2b81e125
- [PASS] `SEED_ODD_cashoutUser_status`: status=1, tx=ca6d0267d50dc7eeac0cd67520cc728efc65e8b3e008cc305e47ec5e3994379f
- [PASS] `SEED_ODD_parlayUser_status`: status=1, tx=0f07943af4b475d262b11a623887f043fd6af4cccc452905b43c8bf7fe937ab1
- [PASS] `SEED_ODD_lpUser_status`: status=1, tx=ab2ad7a960908ef1266ac1e6a04adebafcb4d27ee7ff793db984c3c0ffb0a098
- [PASS] `SEED_ODD_staker_status`: status=1, tx=2e5ce1ae1d49c9f96d8dce9af7a5d24b26ec1d287a34f74860c7c083c56cc4da
- [PASS] `APPROVE_BETTOR_status`: status=1, tx=b1405300b953806e62a478954f26a72a6b2203b4daf53689cd2d49917ef73664
- [PASS] `APPROVE_CASHOUT_USER_status`: status=1, tx=c38324130de2c6b238e485150e6432b2525228639d18ba1f237ccacfc2986d15
- [PASS] `APPROVE_PARLAY_USER_status`: status=1, tx=4f7219eafb8e9b7295eda8a25049fe682ffd3310d3465aa2bc39ad2db4f6122d
- [PASS] `APPROVE_LP_USER_status`: status=1, tx=71de67946b82b94bbeb1d009c30c31931311eeb287c7dac3383a197acadda103
- [PASS] `APPROVE_STAKER_status`: status=1, tx=5103d03eb4cbcef14859fd3b82d02ae9f12b64815d604c07bde7efd755831610
- [PASS] `STAKE_CREATE_status`: status=1, tx=a596caa344d3246716baf480508b173e78d293197d00bed3fae1eac1c0786cd3
- [PASS] `STAKER_ACTIVE_AFTER_STAKE`: 11
- [PASS] `STAKE_EARLY_UNSTAKE_status`: status=1, tx=d1c67f9fee71a8325c61b9b14db7681b88f32013f6e691ec99c48d4899cae5b7
- [PASS] `STAKER_INACTIVE_AFTER_EARLY_UNSTAKE`: 11
- [PASS] `OPEN_SINGLE_MARKET_status`: status=1, tx=c153945ae3c039563329aafab58463d4ea6bbe7fd4168d838c1b5131deccaca5
- [PASS] `LP_DEPOSIT_MATCH_status`: status=1, tx=c8e31811f92eda50cd8fd6b843fe54a86421a1a3d7af07fd5e9df01547b048e2
- [PASS] `PLACE_SINGLE_BET_status`: status=1, tx=112629e030665f00e5f424b9867a4b1452e30ad86babe0646dae3192a2d7da41
- [PASS] `ESTIMATE_BET_VALUE_PENDING`: estimated=100000000000000000000, pnl=0
- [PASS] `ESTIMATE_BET_VALUE_WRONG_USER_ZERO`: estimated=0, pnl=0
- [PASS] `GET_CLAIM_STATUS_BEFORE_MATCH_END_REVERTS`: ContractCustomError
- [PASS] `OPEN_CASHOUT_MARKET_status`: status=1, tx=d55041314b4ee43d1cf0fe938c34ceddad88a97d100efc9074a89192cd780520
- [PASS] `PLACE_CASHOUT_BET_status`: status=1, tx=ea485f8a80088fea69c9097f247c22ff0a8c1caadd27910030c5b11ca2ae15f7
- [PASS] `CASH_OUT_status`: status=1, tx=bbe5fdaa468578e2e43a3dfd694df56f253f5f87fc3e3e2aa42434c761f4fb69
- [PASS] `CASHOUT_BET_STATE`: 5
- [PASS] `OPEN_PARLAY_MARKET_A_status`: status=1, tx=5ab47843f0c3a6fb30cf973f1056ad14505566fce73e62493f61e4eac1d0a23b
- [PASS] `OPEN_PARLAY_MARKET_B_status`: status=1, tx=ee7cf5bfc87ebf388e3fc2acbacd5d61c55945d28efa54084953d0a5ca31e190
- [PASS] `PLACE_PARLAY_status`: status=1, tx=7ad2e9b22a7ee1106d15b784017cf8b4b7e1ff50d4c3628157c8519c09693c80
- [PASS] `ESTIMATE_PARLAY_VALUE_PENDING`: estimated=100000000000000000000, pnl=0
- [PASS] `ESTIMATE_PARLAY_VALUE_WRONG_USER_ZERO`: (0, 0, 0, 0, 0, 0, 0, 0, 0, False, False)
- [PASS] `GET_PARLAY_CLAIM_STATUS_BEFORE_MATCH_END_REVERTS`: ContractCustomError
- [PASS] `SINGLE_SETTLE_BETS_status`: status=1, tx=8e09a930531d342ce4f7f99067f01ff2b6e91dc5b2fedd8cfa61fcbe2eac395f
- [PASS] `SINGLE_FINALIZE_status`: status=1, tx=473b42452a438b89b69c7acee26ed96001d49d5aed6596a8a7ef55bcb0add22c
- [PASS] `GET_CLAIM_STATUS_WON_UNCLAIMED`: won=True, reward=190000000000000000000
- [PASS] `ESTIMATE_BET_VALUE_AFTER_SETTLE_REVERTS`: ContractCustomError
- [PASS] `CLAIM_SINGLE_PAYOUT_status`: status=1, tx=3c381f38555ec99937d06a0e68802a5ec9e2d05a24ddc88c56704b9db0700706
- [PASS] `GET_CLAIM_STATUS_AFTER_CLAIM_ZERO`: won=True, reward=0
- [PASS] `LP_REQUEST_UNBOND_MATCH_status`: status=1, tx=83e41e9f269559049162b70198150e843ef5327f5e4c7c2843ed6e5ed99c8d65
- [PASS] `LP_POSITION_UNBONDING`: 1
- [PASS] `PARLAY_A_SETTLE_BETS_status`: status=1, tx=702838b231c0da2d05c23c5f6afafec1af5d89efc8da761202209b41d25533e9
- [PASS] `PARLAY_A_FINALIZE_status`: status=1, tx=edcc1ef92ecbf0b49fe368b65a1278d317965847ec75b1d1adff35b550163b95
- [PASS] `PARLAY_B_SETTLE_BETS_status`: status=1, tx=63eab4be60f48c159308175a75bd03e877b6840a52d232f5aa7f826a70152d9c
- [PASS] `PARLAY_B_FINALIZE_status`: status=1, tx=3c51d9ca0e066ded141b27be7f89e05db6c9f1de3ec1d1d44a8d347ce23fdba8
- [PASS] `ESTIMATE_PARLAY_VALUE_AFTER_LEGS_FINAL_BEFORE_SETTLE`: (0, 100000000000000000000, 40000, 400000000000000000000, 400000000000000000000, 300000000000000000000, 4000000000000000000, 2, 0, False, True)
- [PASS] `GET_PARLAY_CLAIM_STATUS_PENDING_ZERO`: won=False, reward=0
- [PASS] `SETTLE_PARLAY_status`: status=1, tx=e03fe8ca234783055b0ead5d50cc2ccffabb21f35cc4f21d6fe98ac783b6384e
- [PASS] `GET_PARLAY_CLAIM_STATUS_WON_UNCLAIMED`: won=True, reward=380000000000000000000
- [PASS] `ESTIMATE_PARLAY_VALUE_AFTER_SETTLE_REVERTS`: ContractCustomError
- [PASS] `CLAIM_PARLAY_PAYOUT_status`: status=1, tx=46b0d978d7aa7626f2734aacd2908802e0d0bae69b8149213b38f44ec55eb9a8
- [PASS] `GET_PARLAY_CLAIM_STATUS_AFTER_CLAIM_ZERO`: won=True, reward=0

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `18,925,796.98` | `18,910,811.98` | `4.2966710349555412` | `4.2863704525555412` |
| `bettor` | `0xf947cE92b29AAd005fDF16948B3273Fb0A5Da96C` | `0` | `3,089` | `0.03549625` | `0.034375566` |
| `cashoutUser` | `0xB91C7B77514862e3C0F3116EC3949EdAb2bfbba5` | `0` | `2,979` | `0.035269782` | `0.03414783` |
| `parlayUser` | `0xcF7E784333d63D084C74577558e0563A831A2D0e` | `0` | `3,279` | `0.034761843` | `0.033306967` |
| `lpUser` | `0x79C8A5cDA3ec53D62a8f7452B2c7BCC482606A78` | `0` | `2,000` | `0.036908067` | `0.036209868` |
| `staker` | `0x0D76a8bF347c4F30D8478fa4925681d43cA42b9b` | `0` | `3,000` | `0.037344508` | `0.03667941` |
| `BettingPool` | `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3` | `11,003,100.49` | `11,002,710.49` | `0` | `0` |
| `LiquidityPool` | `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50` | `16,208` | `17,224` | `0` | `0` |
| `StakingPool` | `0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F` | `2,440.98` | `2,452.98` | `0` | `0` |

## Transactions
### TX-01 `SEED_ODD_bettor`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `ef4be662290e7a59bb6193647e706759510d70e04f568fc127486f5a2b81e125`
- status: `1`
- gas_used: `63673`
- tx_fee: `63673000000000` wei
- events: `ODDToken.Transfer`

### TX-02 `SEED_ODD_cashoutUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `ca6d0267d50dc7eeac0cd67520cc728efc65e8b3e008cc305e47ec5e3994379f`
- status: `1`
- gas_used: `63685`
- tx_fee: `63685000000000` wei
- events: `ODDToken.Transfer`

### TX-03 `SEED_ODD_parlayUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `0f07943af4b475d262b11a623887f043fd6af4cccc452905b43c8bf7fe937ab1`
- status: `1`
- gas_used: `63685`
- tx_fee: `63685000000000` wei
- events: `ODDToken.Transfer`

### TX-04 `SEED_ODD_lpUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `ab2ad7a960908ef1266ac1e6a04adebafcb4d27ee7ff793db984c3c0ffb0a098`
- status: `1`
- gas_used: `63685`
- tx_fee: `63685000000000` wei
- events: `ODDToken.Transfer`

### TX-05 `SEED_ODD_staker`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `2e5ce1ae1d49c9f96d8dce9af7a5d24b26ec1d287a34f74860c7c083c56cc4da`
- status: `1`
- gas_used: `63685`
- tx_fee: `63685000000000` wei
- events: `ODDToken.Transfer`

### TX-06 `APPROVE_BETTOR`
- sender: `bettor` / `0xf947cE92b29AAd005fDF16948B3273Fb0A5Da96C`
- tx_hash: `b1405300b953806e62a478954f26a72a6b2203b4daf53689cd2d49917ef73664`
- status: `1`
- gas_used: `51178`
- tx_fee: `51178000000000` wei
- events: `ODDToken.Approval`

### TX-07 `APPROVE_CASHOUT_USER`
- sender: `cashoutUser` / `0xB91C7B77514862e3C0F3116EC3949EdAb2bfbba5`
- tx_hash: `c38324130de2c6b238e485150e6432b2525228639d18ba1f237ccacfc2986d15`
- status: `1`
- gas_used: `51178`
- tx_fee: `51178000000000` wei
- events: `ODDToken.Approval`

### TX-08 `APPROVE_PARLAY_USER`
- sender: `parlayUser` / `0xcF7E784333d63D084C74577558e0563A831A2D0e`
- tx_hash: `4f7219eafb8e9b7295eda8a25049fe682ffd3310d3465aa2bc39ad2db4f6122d`
- status: `1`
- gas_used: `51178`
- tx_fee: `51178000000000` wei
- events: `ODDToken.Approval`

### TX-09 `APPROVE_LP_USER`
- sender: `lpUser` / `0x79C8A5cDA3ec53D62a8f7452B2c7BCC482606A78`
- tx_hash: `71de67946b82b94bbeb1d009c30c31931311eeb287c7dac3383a197acadda103`
- status: `1`
- gas_used: `51178`
- tx_fee: `51178000000000` wei
- events: `ODDToken.Approval`

### TX-10 `APPROVE_STAKER`
- sender: `staker` / `0x0D76a8bF347c4F30D8478fa4925681d43cA42b9b`
- tx_hash: `5103d03eb4cbcef14859fd3b82d02ae9f12b64815d604c07bde7efd755831610`
- status: `1`
- gas_used: `51178`
- tx_fee: `51178000000000` wei
- events: `ODDToken.Approval`

### TX-11 `STAKE_CREATE`
- sender: `staker` / `0x0D76a8bF347c4F30D8478fa4925681d43cA42b9b`
- tx_hash: `a596caa344d3246716baf480508b173e78d293197d00bed3fae1eac1c0786cd3`
- status: `1`
- gas_used: `420748`
- tx_fee: `420748000000000` wei
- events: `StakingPool.StakeCreated, ODDToken.Transfer, ODDToken.BusinessInflowConsumed, StakingPool.StakeAccountingSnapshot`

### TX-12 `STAKE_EARLY_UNSTAKE`
- sender: `staker` / `0x0D76a8bF347c4F30D8478fa4925681d43cA42b9b`
- tx_hash: `d1c67f9fee71a8325c61b9b14db7681b88f32013f6e691ec99c48d4899cae5b7`
- status: `1`
- gas_used: `193172`
- tx_fee: `193172000000000` wei
- events: `ODDToken.Transfer, ODDToken.BusinessOutcomeRegistered, StakingPool.StakeWithdrawn, StakingPool.StakeAccountingSnapshot`

### TX-13 `OPEN_SINGLE_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `c153945ae3c039563329aafab58463d4ea6bbe7fd4168d838c1b5131deccaca5`
- status: `1`
- gas_used: `525164`
- tx_fee: `525164000000000` wei
- events: `LiquidityPool.MatchPoolOpened, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketOpened, BettingParlayModule.OddsUpdated`

### TX-14 `LP_DEPOSIT_MATCH`
- sender: `lpUser` / `0x79C8A5cDA3ec53D62a8f7452B2c7BCC482606A78`
- tx_hash: `c8e31811f92eda50cd8fd6b843fe54a86421a1a3d7af07fd5e9df01547b048e2`
- status: `1`
- gas_used: `445041`
- tx_fee: `445041000000000` wei
- events: `ODDToken.Transfer, ODDToken.BusinessInflowConsumed, LiquidityPool.LiquidityDeposited, LiquidityPool.LiquidityAccountingSnapshot`

### TX-15 `PLACE_SINGLE_BET`
- sender: `bettor` / `0xf947cE92b29AAd005fDF16948B3273Fb0A5Da96C`
- tx_hash: `112629e030665f00e5f424b9867a4b1452e30ad86babe0646dae3192a2d7da41`
- status: `1`
- gas_used: `753466`
- tx_fee: `753466000000000` wei
- events: `ODDToken.Transfer, ODDToken.BusinessInflowConsumed, ODDToken.Transfer, BettingParlayModule.BetPlaced, BettingParlayModule.OddsUpdated`

### TX-16 `OPEN_CASHOUT_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `d55041314b4ee43d1cf0fe938c34ceddad88a97d100efc9074a89192cd780520`
- status: `1`
- gas_used: `525164`
- tx_fee: `525164000000000` wei
- events: `LiquidityPool.MatchPoolOpened, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketOpened, BettingParlayModule.OddsUpdated`

### TX-17 `PLACE_CASHOUT_BET`
- sender: `cashoutUser` / `0xB91C7B77514862e3C0F3116EC3949EdAb2bfbba5`
- tx_hash: `ea485f8a80088fea69c9097f247c22ff0a8c1caadd27910030c5b11ca2ae15f7`
- status: `1`
- gas_used: `753466`
- tx_fee: `753466000000000` wei
- events: `ODDToken.Transfer, ODDToken.BusinessInflowConsumed, ODDToken.Transfer, BettingParlayModule.BetPlaced, BettingParlayModule.OddsUpdated`

### TX-18 `CASH_OUT`
- sender: `cashoutUser` / `0xB91C7B77514862e3C0F3116EC3949EdAb2bfbba5`
- tx_hash: `bbe5fdaa468578e2e43a3dfd694df56f253f5f87fc3e3e2aa42434c761f4fb69`
- status: `1`
- gas_used: `317308`
- tx_fee: `317308000000000` wei
- events: `BettingParlayModule.BetCashedOut, BettingParlayModule.OddsUpdated, BettingParlayModule.PlatformReserveUpdated, ODDToken.Transfer, ODDToken.BusinessOutcomeRegistered`

### TX-19 `OPEN_PARLAY_MARKET_A`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `5ab47843f0c3a6fb30cf973f1056ad14505566fce73e62493f61e4eac1d0a23b`
- status: `1`
- gas_used: `525164`
- tx_fee: `525164000000000` wei
- events: `LiquidityPool.MatchPoolOpened, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketOpened, BettingParlayModule.OddsUpdated`

### TX-20 `OPEN_PARLAY_MARKET_B`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `ee7cf5bfc87ebf388e3fc2acbacd5d61c55945d28efa54084953d0a5ca31e190`
- status: `1`
- gas_used: `525164`
- tx_fee: `525164000000000` wei
- events: `LiquidityPool.MatchPoolOpened, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketOpened, BettingParlayModule.OddsUpdated`

### TX-21 `PLACE_PARLAY`
- sender: `parlayUser` / `0xcF7E784333d63D084C74577558e0563A831A2D0e`
- tx_hash: `7ad2e9b22a7ee1106d15b784017cf8b4b7e1ff50d4c3628157c8519c09693c80`
- status: `1`
- gas_used: `1096682`
- tx_fee: `1096682000000000` wei
- events: `ODDToken.Transfer, ODDToken.BusinessInflowConsumed, BettingParlayModule.ParlayLegExposureReserved, BettingParlayModule.OddsUpdated, BettingParlayModule.ParlayLegExposureReserved, BettingParlayModule.OddsUpdated, ODDToken.Transfer, BettingParlayModule.ParlayPlaced`

### TX-22 `SINGLE_SETTLE_BETS`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `8e09a930531d342ce4f7f99067f01ff2b6e91dc5b2fedd8cfa61fcbe2eac395f`
- status: `1`
- gas_used: `267042`
- tx_fee: `267042000000000` wei
- events: `BettingParlayModule.MarketSettlementScoreBatchProcessed`

### TX-23 `SINGLE_FINALIZE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `473b42452a438b89b69c7acee26ed96001d49d5aed6596a8a7ef55bcb0add22c`
- status: `1`
- gas_used: `344488`
- tx_fee: `344488000000000` wei
- events: `ODDToken.Transfer, LiquidityPool.MarginDistributed, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.PlatformReserveUpdated, LiquidityPool.PayoutLiquidityReserved, LiquidityPool.PayoutReserveOutstanding, LiquidityPool.LossDistributed, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.MarketFinalResultRecorded, BettingParlayModule.MarketSettlementFinalized`

### TX-24 `CLAIM_SINGLE_PAYOUT`
- sender: `bettor` / `0xf947cE92b29AAd005fDF16948B3273Fb0A5Da96C`
- tx_hash: `3c381f38555ec99937d06a0e68802a5ec9e2d05a24ddc88c56704b9db0700706`
- status: `1`
- gas_used: `316040`
- tx_fee: `316040000000000` wei
- events: `ODDToken.Transfer, StakingPool.RewardNotified, StakingPool.StakeAccountingSnapshot, BettingParlayModule.LpLossOffsetApplied, ODDToken.Transfer, ODDToken.Transfer, ODDToken.BusinessOutcomeRegistered, BettingParlayModule.BetClaimed, BettingParlayModule.PayoutClaimed`

### TX-25 `LP_REQUEST_UNBOND_MATCH`
- sender: `lpUser` / `0x79C8A5cDA3ec53D62a8f7452B2c7BCC482606A78`
- tx_hash: `83e41e9f269559049162b70198150e843ef5327f5e4c7c2843ed6e5ed99c8d65`
- status: `1`
- gas_used: `201980`
- tx_fee: `201980000000000` wei
- events: `LiquidityPool.UnbondRequested, LiquidityPool.LiquidityPositionStateChanged, LiquidityPool.LiquidityAccountingSnapshot`

### TX-26 `PARLAY_A_SETTLE_BETS`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `702838b231c0da2d05c23c5f6afafec1af5d89efc8da761202209b41d25533e9`
- status: `1`
- gas_used: `137203`
- tx_fee: `137203000000000` wei
- events: `BettingParlayModule.MarketSettlementScoreBatchProcessed`

### TX-27 `PARLAY_A_FINALIZE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `edcc1ef92ecbf0b49fe368b65a1278d317965847ec75b1d1adff35b550163b95`
- status: `1`
- gas_used: `111444`
- tx_fee: `111444000000000` wei
- events: `BettingParlayModule.MarketFinalResultRecorded, BettingParlayModule.MarketSettlementFinalized`

### TX-28 `PARLAY_B_SETTLE_BETS`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `63eab4be60f48c159308175a75bd03e877b6840a52d232f5aa7f826a70152d9c`
- status: `1`
- gas_used: `137191`
- tx_fee: `137191000000000` wei
- events: `BettingParlayModule.MarketSettlementScoreBatchProcessed`

### TX-29 `PARLAY_B_FINALIZE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `3c51d9ca0e066ded141b27be7f89e05db6c9f1de3ec1d1d44a8d347ce23fdba8`
- status: `1`
- gas_used: `111444`
- tx_fee: `111444000000000` wei
- events: `BettingParlayModule.MarketFinalResultRecorded, BettingParlayModule.MarketSettlementFinalized`

### TX-30 `SETTLE_PARLAY`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `e03fe8ca234783055b0ead5d50cc2ccffabb21f35cc4f21d6fe98ac783b6384e`
- status: `1`
- gas_used: `487511`
- tx_fee: `487511000000000` wei
- events: `BettingParlayModule.OddsUpdated, BettingParlayModule.OddsUpdated, ODDToken.Transfer, LiquidityPool.GlobalMarginDistributed, LiquidityPool.MarginDistributed, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.PlatformReserveUpdated, LiquidityPool.PayoutLiquidityReserved, LiquidityPool.PayoutReserveOutstanding, LiquidityPool.GlobalLossDistributed, LiquidityPool.LossDistributed, LiquidityPool.LiquidityAccountingSnapshot, BettingParlayModule.ParlaySettled`

### TX-31 `CLAIM_PARLAY_PAYOUT`
- sender: `parlayUser` / `0xcF7E784333d63D084C74577558e0563A831A2D0e`
- tx_hash: `46b0d978d7aa7626f2734aacd2908802e0d0bae69b8149213b38f44ec55eb9a8`
- status: `1`
- gas_used: `307016`
- tx_fee: `307016000000000` wei
- events: `ODDToken.Transfer, StakingPool.RewardNotified, StakingPool.StakeAccountingSnapshot, BettingParlayModule.LpLossOffsetApplied, ODDToken.Transfer, ODDToken.Transfer, ODDToken.BusinessOutcomeRegistered, BettingParlayModule.ParlayPayoutClaimed`
