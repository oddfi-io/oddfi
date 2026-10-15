# 2026-06-01 BSC Testnet Full Redeploy Full Flow Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- matchId: `4dab5977c7a06904c0e2a5a24dacabeaaa3a12fe0497b9163a64ae2f98b4a8c4`
- marketId: `444bf439dc06648147896981202e743c9fde8bc861b64120d4528f1c0bd2d945`
- betId: `00000000000000000000000000000000000000000000000000000000000000ee`
- lpPositionId: `21`
- expectedGrossPayout: `200 ODD`
- expectedPayoutTax: `10 ODD`
- expectedNetPayout: `190 ODD`

## Checks
- [PASS] `SEED_BNB_bettor_status`: status=1, tx=c479ca0c13ecb263b5d511e4e21462a7f1e6df62a614eb892be9d6ec485dba09
- [PASS] `SEED_BNB_lpUser_status`: status=1, tx=0dc9a85091c03786b7d14db003365c488f615488e8fe869cfa56f515eb22b09f
- [PASS] `SEED_BNB_sink_status`: status=1, tx=b64fef27f098f8f32014e182929fc9214d452476da004f15d40cefb9ae84d7d9
- [PASS] `SEED_ODD_bettor_status`: status=1, tx=a3237c608864b57d97339f3bc30981970eea0a14c09df402e8e8067c262e5481
- [PASS] `SEED_ODD_lpUser_status`: status=1, tx=773b297d221430f0fbfdd4748ee6c857a44bf37f44e179f993f57dfc06872feb
- [PASS] `APPROVE_BETTOR_BETTING_status`: status=1, tx=4313767e9dd9d63d6833318f9e820c00db842eee20f2c201fa128d2364ccf839
- [PASS] `APPROVE_LP_LIQUIDITY_status`: status=1, tx=8421027fc3c0f31372c0fc7e56b495f6e12ca9578cf7827a0278d7dddb4a0167
- [PASS] `OPEN_MARKET_status`: status=1, tx=9a4d6bf6529d537cbc79a709b01a8561abc921a762de73bc97e080ef3a2fc62f
- [PASS] `DEPOSIT_MATCH_LP_status`: status=1, tx=cfcee08b97437c7a57e60f8e54f511d819854aaffc6e24547b38ee32ef7d4dd5
- [PASS] `PLACE_BET_status`: status=1, tx=48e728e6244af2788396f7b2673d0afb195c687f745cba3deca9e9114d422ba1
- [PASS] `SETTLE_MARKET_BETS_BY_SCORE_status`: status=1, tx=a24bb2df6b72b9c0d1f570585f94da55c9b96b708251d5902a31a8392775e05c
- [PASS] `FINALIZE_MARKET_SETTLEMENT_status`: status=1, tx=4478e05a0454d5d7e035006d2fb80528d440996a82bde28c5cc4fd62cd50bc95
- [PASS] `CLAIM_PAYOUT_status`: status=1, tx=56f270cc1d23a6f352c74c7be4a82758cdf1fb2cf5f7d1125c426b455c631caf
- [PASS] `CLAIM_NET_DELTA`: expected 190000000000000000000, got 190000000000000000000
- [PASS] `CLAIM_PAYOUT_TX_SUCCESS`: 56f270cc1d23a6f352c74c7be4a82758cdf1fb2cf5f7d1125c426b455c631caf
- [PASS] `REQUEST_UNBOND_MATCH_LP_status`: status=1, tx=002b4f2f627da07a1305937f741d27b93b632db317cbc04ef1bc0ca6e5a5fd0e
- [PASS] `WITHDRAW_MATCH_LP_WAIT_10_MIN_RULE_CONFIRMED`: not mature after 10 minutes as expected by epoch rule: ('0xc71a02540000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000000000001c', '0xc71a02540000000000000000000000000000000000000000000000000000000000000019000000000000000000000000000000000000000000000000000000000000001c')
- [PASS] `USER_WITHDRAW_ODD_TO_SINK_status`: status=1, tx=d473a17e96cd8f9c1dfbd565e032f30f1152a49ffd946b55ebc34d09e4fca777

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `99,592,984` | `99,588,989` | `11.5385965219555412` | `11.4474060569555412` |
| `bettor` | `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc` | `0` | `2,079` | `0` | `0.029207979` |
| `lpUser` | `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26` | `0` | `1,000` | `0` | `0.029499856` |
| `sink` | `0x9197503b103AE45c6ED6B8a61db0B8d7621236eF` | `0` | `10` | `0` | `0.03` |
| `StakingPool` | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | `6,726` | `6,730` | `0` | `0` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `68,912` | `69,920` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `47,361` | `47,255` | `0` | `0` |

## Transactions
### TX-01 `SEED_BNB_bettor`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `c479ca0c13ecb263b5d511e4e21462a7f1e6df62a614eb892be9d6ec485dba09`
- status: `1`
- gas_used: `21000`
- effective_gas_price: `1000000000` wei
- tx_fee: `21000000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.030021` |
| `bettor` | `0` | `0.03` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

### TX-02 `SEED_BNB_lpUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `0dc9a85091c03786b7d14db003365c488f615488e8fe869cfa56f515eb22b09f`
- status: `1`
- gas_used: `21000`
- effective_gas_price: `1000000000` wei
- tx_fee: `21000000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.030021` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0.03` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

### TX-03 `SEED_BNB_sink`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `b64fef27f098f8f32014e182929fc9214d452476da004f15d40cefb9ae84d7d9`
- status: `1`
- gas_used: `21000`
- effective_gas_price: `1000000000` wei
- tx_fee: `21000000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.030021` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0.03` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

### TX-04 `SEED_ODD_bettor`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `a3237c608864b57d97339f3bc30981970eea0a14c09df402e8e8067c262e5481`
- status: `1`
- gas_used: `58572`
- effective_gas_price: `1000000000` wei
- tx_fee: `58572000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `-2,000` | `-0.000058572` |
| `bettor` | `2,000` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `to`: `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
  - `value`: `2000000000000000000000`

### TX-05 `SEED_ODD_lpUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `773b297d221430f0fbfdd4748ee6c857a44bf37f44e179f993f57dfc06872feb`
- status: `1`
- gas_used: `58572`
- effective_gas_price: `1000000000` wei
- tx_fee: `58572000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `-2,000` | `-0.000058572` |
| `bettor` | `0` | `0` |
| `lpUser` | `2,000` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `to`: `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26`
  - `value`: `2000000000000000000000`

### TX-06 `APPROVE_BETTOR_BETTING`
- sender: `bettor` / `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
- tx_hash: `4313767e9dd9d63d6833318f9e820c00db842eee20f2c201fa128d2364ccf839`
- status: `1`
- gas_used: `51156`
- effective_gas_price: `1000000000` wei
- tx_fee: `51156000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `-0.000051156` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Approval`
  - `owner`: `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
  - `spender`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-07 `APPROVE_LP_LIQUIDITY`
- sender: `lpUser` / `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26`
- tx_hash: `8421027fc3c0f31372c0fc7e56b495f6e12ca9578cf7827a0278d7dddb4a0167`
- status: `1`
- gas_used: `51156`
- effective_gas_price: `1000000000` wei
- tx_fee: `51156000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `-0.000051156` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Approval`
  - `owner`: `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26`
  - `spender`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-08 `OPEN_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `9a4d6bf6529d537cbc79a709b01a8561abc921a762de73bc97e080ef3a2fc62f`
- status: `1`
- gas_used: `470752`
- effective_gas_price: `1000000000` wei
- tx_fee: `470752000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000470752` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `MatchPoolOpened`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `poolId`: `35130837673670268358876238768106138450042256990226581341134803856239841552580`
  - `matchEndTime`: `1780405560`
  - `depositCloseAt`: `1780405380`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `poolId`: `35130837673670268358876238768106138450042256990226581341134803856239841552580`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `61402228571428571429000`
  - `totalActiveDepositedAfter`: `66000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `5550000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` `MarketOpened`
  - `marketId`: `b'DK\xf49\xdc\x06d\x81G\x89i\x81 .t<\x9f\xde\x8b\xc8a\xb6A \xd4R\x8f\x1c\x0b\xd2\xd9E'`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `marketType`: `1`
  - `line`: `0`
  - `matchStartTime`: `1780405380`
  - `lockAt`: `1780405560`
  - `quoteVersion`: `1`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'DK\xf49\xdc\x06d\x81G\x89i\x81 .t<\x9f\xde\x8b\xc8a\xb6A \xd4R\x8f\x1c\x0b\xd2\xd9E'`
  - `updatedAt`: `1780404973`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-09 `DEPOSIT_MATCH_LP`
- sender: `lpUser` / `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26`
- tx_hash: `cfcee08b97437c7a57e60f8e54f511d819854aaffc6e24547b38ee32ef7d4dd5`
- status: `1`
- gas_used: `263570`
- effective_gas_price: `1000000000` wei
- tx_fee: `263570000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `-1,000` | `-0.00026357` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `1,000` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `1000000000000000000000`
- `LiquidityPool` `LiquidityDeposited`
  - `positionId`: `21`
  - `poolId`: `35130837673670268358876238768106138450042256990226581341134803856239841552580`
  - `user`: `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26`
  - `amount`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
  - `planId`: `0`
  - `unlockAt`: `1780405560`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `poolId`: `35130837673670268358876238768106138450042256990226581341134803856239841552580`
  - `positionId`: `21`
  - `actionKind`: `1`
  - `requestableLiquidityAfter`: `62402228571428571429000`
  - `totalActiveDepositedAfter`: `67000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `5550000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`

### TX-10 `PLACE_BET`
- sender: `bettor` / `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
- tx_hash: `48e728e6244af2788396f7b2673d0afb195c687f745cba3deca9e9114d422ba1`
- status: `1`
- gas_used: `530961`
- effective_gas_price: `1000000000` wei
- tx_fee: `530961000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `1` | `0` |
| `bettor` | `-101` | `-0.000530961` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `100` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
  - `to`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `101000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `1000000000000000000`
- `BettingPool` `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xee'`
  - `marketId`: `b'DK\xf49\xdc\x06d\x81G\x89i\x81 .t<\x9f\xde\x8b\xc8a\xb6A \xd4R\x8f\x1c\x0b\xd2\xd9E'`
  - `user`: `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
  - `requestedAmount`: `100000000000000000000`
  - `acceptedAmount`: `100000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'DK\xf49\xdc\x06d\x81G\x89i\x81 .t<\x9f\xde\x8b\xc8a\xb6A \xd4R\x8f\x1c\x0b\xd2\xd9E'`
  - `updatedAt`: `1780404973`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-11 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `a24bb2df6b72b9c0d1f570585f94da55c9b96b708251d5902a31a8392775e05c`
- status: `1`
- gas_used: `255853`
- effective_gas_price: `1000000000` wei
- tx_fee: `255853000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000255853` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `BettingPool` `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'DK\xf49\xdc\x06d\x81G\x89i\x81 .t<\x9f\xde\x8b\xc8a\xb6A \xd4R\x8f\x1c\x0b\xd2\xd9E'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `1`
  - `totalBetCount`: `1`

### TX-12 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `4478e05a0454d5d7e035006d2fb80528d440996a82bde28c5cc4fd62cd50bc95`
- status: `1`
- gas_used: `283716`
- effective_gas_price: `1000000000` wei
- tx_fee: `283716000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000283716` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `8` | `0` |
| `BettingPool` | `-8` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `8000000000000000000`
- `LiquidityPool` `MarginDistributed`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `lpMarginShare`: `8000000000000000000`
  - `globalShare`: `7703703703703703703`
  - `matchShare`: `296296296296296297`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `poolId`: `35130837673670268358876238768106138450042256990226581341134803856239841552580`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `62410228571428571429000`
  - `totalActiveDepositedAfter`: `67000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `5550000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `PlatformReserveUpdated`
  - `delta`: `2000000000000000000`
  - `newBalance`: `30188000000000000000000`
  - `reason`: `4`
- `LiquidityPool` `PayoutLiquidityReserved`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `reservedAmount`: `200000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1780405610`
- `LiquidityPool` `LossDistributed`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `lpLossBooked`: `200000000000000000000`
  - `globalLossShare`: `192592592592592592592`
  - `matchLossShare`: `7407407407407407408`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `poolId`: `35130837673670268358876238768106138450042256990226581341134803856239841552580`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `62210228571428571429000`
  - `totalActiveDepositedAfter`: `67000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `5750000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `MarketSettlementFinalized`
  - `marketId`: `b'DK\xf49\xdc\x06d\x81G\x89i\x81 .t<\x9f\xde\x8b\xc8a\xb6A \xd4R\x8f\x1c\x0b\xd2\xd9E'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `200000000000000000000`
  - `lpMarginShare`: `8000000000000000000`
  - `platformMarginShare`: `2000000000000000000`
  - `quoteVersion`: `3`

### TX-13 `CLAIM_PAYOUT`
- sender: `bettor` / `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
- tx_hash: `56f270cc1d23a6f352c74c7be4a82758cdf1fb2cf5f7d1125c426b455c631caf`
- status: `1`
- gas_used: `151344`
- effective_gas_price: `1000000000` wei
- tx_fee: `151344000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `4` | `0` |
| `bettor` | `190` | `-0.000151344` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `4` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `-198` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A`
  - `value`: `4000000000000000000`
- `StakingPool` `RewardNotified`
  - `caller`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `amount`: `4000000000000000000`
  - `newAccRewardPerShare`: `99658119658119656`
- `StakingPool` `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `6500000000000000000000`
  - `accountedOddBalanceAfter`: `6730000000000000000000`
  - `accRewardPerShareAfter`: `99658119658119656`
- `BettingPool` `LpLossOffsetApplied`
  - `amount`: `2000000000000000000`
  - `remainingOffset`: `5635000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `4000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
  - `value`: `190000000000000000000`
- `BettingPool` `BetClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xee'`
  - `marketId`: `b'DK\xf49\xdc\x06d\x81G\x89i\x81 .t<\x9f\xde\x8b\xc8a\xb6A \xd4R\x8f\x1c\x0b\xd2\xd9E'`
  - `user`: `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
  - `payout`: `190000000000000000000`
  - `executor`: `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
- `BettingPool` `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xee'`
  - `user`: `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
  - `grossPayout`: `200000000000000000000`
  - `taxAmount`: `10000000000000000000`
  - `netPayout`: `190000000000000000000`

### TX-14 `REQUEST_UNBOND_MATCH_LP`
- sender: `lpUser` / `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26`
- tx_hash: `002b4f2f627da07a1305937f741d27b93b632db317cbc04ef1bc0ca6e5a5fd0e`
- status: `1`
- gas_used: `185418`
- effective_gas_price: `1000000000` wei
- tx_fee: `185418000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `-0.000185418` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `UnbondRequested`
  - `positionId`: `21`
  - `user`: `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26`
  - `unbondingEpoch`: `25`
  - `frozenRewardPerWeight`: `296296296296296`
  - `frozenLossPerPrincipal`: `7407407407407407`
- `LiquidityPool` `LiquidityPositionStateChanged`
  - `positionId`: `21`
  - `user`: `0xf41195A17b1CbCB4da22BB59D41cadc12383BB26`
  - `previousState`: `0`
  - `newState`: `1`
  - `principal`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'M\xabYw\xc7\xa0i\x04\xc0\xe2\xa5\xa2M\xac\xab\xea\xaa:\x12\xfe\x04\x97\xb9\x16:d\xae/\x98\xb4\xa8\xc4'`
  - `poolId`: `35130837673670268358876238768106138450042256990226581341134803856239841552580`
  - `positionId`: `21`
  - `actionKind`: `6`
  - `requestableLiquidityAfter`: `61217339682539682540000`
  - `totalActiveDepositedAfter`: `66000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `5750000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`

### TX-15 `USER_WITHDRAW_ODD_TO_SINK`
- sender: `bettor` / `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
- tx_hash: `d473a17e96cd8f9c1dfbd565e032f30f1152a49ffd946b55ebc34d09e4fca777`
- status: `1`
- gas_used: `58560`
- effective_gas_price: `1000000000` wei
- tx_fee: `58560000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `-10` | `-0.00005856` |
| `lpUser` | `0` | `0` |
| `sink` | `10` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x0299e82FBb8bD3a80E5dc7AE5B80f49a29c593Cc`
  - `to`: `0x9197503b103AE45c6ED6B8a61db0B8d7621236eF`
  - `value`: `10000000000000000000`
