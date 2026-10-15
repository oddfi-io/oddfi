# 2026-06-13 BSC Testnet Settlement NetLoss Hotfix Full Flow Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- matchId: `7c8c9bd4ab8b9707574c2291557d887b7eaa7ae10ea9653b1b8376d36306be93`
- marketId: `102a4b7b09ff55c1eef7e9faeb7483ccb6224de87c035b5426a7ae8975afc635`
- betId: `0000000000000000000000000000000000000000000000000000000000000011`
- lpPositionId: `11`
- expectedGrossPayout: `200 ODD`
- expectedPayoutTax: `10 ODD`
- expectedNetPayout: `190 ODD`

## Checks
- [PASS] `SEED_BNB_bettor_status`: status=1, tx=02b4b2f8dd031a0d68b4424e1f794ea82c1fb0b499e6354bbeeaba14154d3031
- [PASS] `SEED_BNB_lpUser_status`: status=1, tx=e96e985694bca6c4297ce7ea30c6414606e85938d4f6c9b49c632896e89a02de
- [PASS] `SEED_BNB_sink_status`: status=1, tx=9960ff96e610c59269c65644687605a7d8eee3f76b46889762363e8680aa5aa5
- [PASS] `SEED_ODD_bettor_status`: status=1, tx=9071ad9199d586e474738f73f1e740ee7924383aafe9f5dbbcf3bd8f97d54316
- [PASS] `SEED_ODD_lpUser_status`: status=1, tx=ea4ed9086572f0f4bf61db6bdfc0fb7a73d65685293b88ca4c8237cdcb612522
- [PASS] `APPROVE_BETTOR_BETTING_status`: status=1, tx=10809657aa5c493d37dfb8b919dc4da7eb21b0259c5f37d7c5621d4be3b97c9f
- [PASS] `APPROVE_LP_LIQUIDITY_status`: status=1, tx=54340561d23bc522c775a532efaddb414c343bacf30069558f53cf6ae9cc7ae0
- [PASS] `OPEN_MARKET_status`: status=1, tx=1ce5ae23448b442149e8062b907263f90d9b1d36f98e40e129882e014631048b
- [PASS] `DEPOSIT_MATCH_LP_status`: status=1, tx=02602c878c408ddf20437787378fff934f9c9e5b4299a2e747fb1f6b0a5be9cf
- [PASS] `PLACE_BET_status`: status=1, tx=8ba64ac6b8865cabb4df78fb97e239f1afb5a30de1ec749a51014968ffe238ed
- [PASS] `SETTLE_MARKET_BETS_BY_SCORE_status`: status=1, tx=7b1a565ad3f6a49ec07699daa262252a3f6f511da65ac4d9184fd79222835eda
- [PASS] `FINALIZE_MARKET_SETTLEMENT_status`: status=1, tx=189a6d4632169651f5970b30f169b030bdddc0311413e28fb171dbe2855be0b0
- [PASS] `CLAIM_PAYOUT_status`: status=1, tx=d5074ca1bd18e833a8db5b13901cbaf171cc344ce250bf26a91b6d40ca418492
- [PASS] `CLAIM_NET_DELTA`: expected 190000000000000000000, got 190000000000000000000
- [PASS] `CLAIM_PAYOUT_TX_SUCCESS`: d5074ca1bd18e833a8db5b13901cbaf171cc344ce250bf26a91b6d40ca418492
- [PASS] `REQUEST_UNBOND_MATCH_LP_status`: status=1, tx=d1ca45b3138c594dc5514224b3ce4531cf9748f1f12bd0449a7c37e67c50ba98
- [PASS] `WITHDRAW_MATCH_LP_WAIT_10_MIN_RULE_CONFIRMED`: not mature after 10 minutes as expected by epoch rule: ('0xc71a0254000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001c', '0xc71a0254000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001c')
- [PASS] `USER_WITHDRAW_ODD_TO_SINK_status`: status=1, tx=f9dfad9ecd1a34d972023d131c3d0a821a5b5be49921b98bfd08905b0f22ed6c

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `18,970,734.98` | `18,957,746.98` | `4.4210424539555412` | `4.3149240069555412` |
| `bettor` | `0xC2806b669E387F5345A42972538EAdbE22ab6d99` | `0` | `2,079` | `0` | `0.028810138` |
| `lpUser` | `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616` | `0` | `1,000` | `0` | `0.029301801` |
| `sink` | `0xF501118cf744DeF9B1464c024E6DfB4dA5A285e3` | `0` | `10` | `0` | `0.03` |
| `StakingPool` | `0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F` | `2,424.98` | `2,432.98` | `0` | `0` |
| `LiquidityPool` | `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50` | `10,088` | `11,112` | `0` | `0` |
| `BettingPool` | `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3` | `10,999,492.49` | `10,999,392.49` | `0` | `0` |

## Transactions
### TX-01 `SEED_BNB_bettor`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `02b4b2f8dd031a0d68b4424e1f794ea82c1fb0b499e6354bbeeaba14154d3031`
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
- tx_hash: `e96e985694bca6c4297ce7ea30c6414606e85938d4f6c9b49c632896e89a02de`
- status: `1`
- gas_used: `21000`
- effective_gas_price: `1000000000` wei
- tx_fee: `21000000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.032634317` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0.03` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

### TX-03 `SEED_BNB_sink`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `9960ff96e610c59269c65644687605a7d8eee3f76b46889762363e8680aa5aa5`
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
- tx_hash: `9071ad9199d586e474738f73f1e740ee7924383aafe9f5dbbcf3bd8f97d54316`
- status: `1`
- gas_used: `63685`
- effective_gas_price: `1000000000` wei
- tx_fee: `63685000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `-2,000` | `-0.000063685` |
| `bettor` | `2,000` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `to`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `value`: `2000000000000000000000`

### TX-05 `SEED_ODD_lpUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `ea4ed9086572f0f4bf61db6bdfc0fb7a73d65685293b88ca4c8237cdcb612522`
- status: `1`
- gas_used: `63685`
- effective_gas_price: `1000000000` wei
- tx_fee: `63685000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `-2,000` | `-0.000063685` |
| `bettor` | `0` | `0` |
| `lpUser` | `2,000` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `to`: `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
  - `value`: `2000000000000000000000`

### TX-06 `APPROVE_BETTOR_BETTING`
- sender: `bettor` / `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
- tx_hash: `10809657aa5c493d37dfb8b919dc4da7eb21b0259c5f37d7c5621d4be3b97c9f`
- status: `1`
- gas_used: `51178`
- effective_gas_price: `1000000000` wei
- tx_fee: `51178000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `-0.000051178` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Approval`
  - `owner`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `spender`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-07 `APPROVE_LP_LIQUIDITY`
- sender: `lpUser` / `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
- tx_hash: `54340561d23bc522c775a532efaddb414c343bacf30069558f53cf6ae9cc7ae0`
- status: `1`
- gas_used: `51178`
- effective_gas_price: `1000000000` wei
- tx_fee: `51178000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.001953655` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `-0.000051178` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Approval`
  - `owner`: `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
  - `spender`: `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-08 `OPEN_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `1ce5ae23448b442149e8062b907263f90d9b1d36f98e40e129882e014631048b`
- status: `1`
- gas_used: `475699`
- effective_gas_price: `1000000000` wei
- tx_fee: `475699000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000475699` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `MatchPoolOpened`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `poolId`: `56335227317652277790171658540820788143914083478453855307856522285774088355475`
  - `matchEndTime`: `1781329834`
  - `depositCloseAt`: `1781329654`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `poolId`: `56335227317652277790171658540820788143914083478453855307856522285774088355475`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `5580714285714285716000`
  - `totalActiveDepositedAfter`: `7000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1505000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` `MarketOpened`
  - `marketId`: `b'\x10*K{\t\xffU\xc1\xee\xf7\xe9\xfa\xebt\x83\xcc\xb6"M\xe8|\x03[T&\xa7\xae\x89u\xaf\xc65'`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `marketType`: `1`
  - `line`: `0`
  - `matchStartTime`: `1781329654`
  - `lockAt`: `1781329834`
  - `quoteVersion`: `1`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\x10*K{\t\xffU\xc1\xee\xf7\xe9\xfa\xebt\x83\xcc\xb6"M\xe8|\x03[T&\xa7\xae\x89u\xaf\xc65'`
  - `updatedAt`: `1781329246`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-09 `DEPOSIT_MATCH_LP`
- sender: `lpUser` / `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
- tx_hash: `02602c878c408ddf20437787378fff934f9c9e5b4299a2e747fb1f6b0a5be9cf`
- status: `1`
- gas_used: `445041`
- effective_gas_price: `1000000000` wei
- tx_fee: `445041000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `-1,000` | `-0.000445041` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `1,000` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
  - `to`: `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50`
  - `value`: `1000000000000000000000`
- `ODDToken` `BusinessInflowConsumed`
  - `businessId`: `b'JE\xfcc\xfa*\xd6\x04 w\x1e&v\xa3\x9b\xeac\x8e\x1e\x1f\x9c\xd62)\xf6>\x875\x08\xee\xcdU'`
  - `user`: `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
  - `businessContract`: `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50`
  - `businessType`: `4`
  - `rawId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x0b'`
  - `amount`: `1000000000000000000000`
  - `sourceIn`: `AttributeDict({'saleLocked': 0, 'rewardLocked': 0, 'businessLocked': 0, 'transferable': 1000000000000000000000})`
- `LiquidityPool` `LiquidityDeposited`
  - `positionId`: `11`
  - `poolId`: `56335227317652277790171658540820788143914083478453855307856522285774088355475`
  - `user`: `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
  - `amount`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
  - `planId`: `0`
  - `unlockAt`: `1781329834`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `poolId`: `56335227317652277790171658540820788143914083478453855307856522285774088355475`
  - `positionId`: `11`
  - `actionKind`: `1`
  - `requestableLiquidityAfter`: `6580714285714285716000`
  - `totalActiveDepositedAfter`: `8000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1505000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`

### TX-10 `PLACE_BET`
- sender: `bettor` / `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
- tx_hash: `8ba64ac6b8865cabb4df78fb97e239f1afb5a30de1ec749a51014968ffe238ed`
- status: `1`
- gas_used: `738302`
- effective_gas_price: `1000000000` wei
- tx_fee: `738302000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `1` | `0` |
| `bettor` | `-101` | `-0.000738302` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `100` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `to`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `value`: `101000000000000000000`
- `ODDToken` `BusinessInflowConsumed`
  - `businessId`: `b'\xdf\x97\xf8\x1e\xe3\x9e1\xed_\xf2Q\x1f\xa4U\x03\xc5zF\rDs{\xbf\xd2\x05\xee\x02#\xdeZ\xaa\xec'`
  - `user`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `businessContract`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `businessType`: `1`
  - `rawId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x11'`
  - `amount`: `101000000000000000000`
  - `sourceIn`: `AttributeDict({'saleLocked': 0, 'rewardLocked': 0, 'businessLocked': 0, 'transferable': 101000000000000000000})`
- `ODDToken` `Transfer`
  - `from`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `1000000000000000000`
- `BettingPool` `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x11'`
  - `marketId`: `b'\x10*K{\t\xffU\xc1\xee\xf7\xe9\xfa\xebt\x83\xcc\xb6"M\xe8|\x03[T&\xa7\xae\x89u\xaf\xc65'`
  - `user`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `requestedAmount`: `100000000000000000000`
  - `acceptedAmount`: `100000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\x10*K{\t\xffU\xc1\xee\xf7\xe9\xfa\xebt\x83\xcc\xb6"M\xe8|\x03[T&\xa7\xae\x89u\xaf\xc65'`
  - `updatedAt`: `1781329246`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-11 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `7b1a565ad3f6a49ec07699daa262252a3f6f511da65ac4d9184fd79222835eda`
- status: `1`
- gas_used: `256351`
- effective_gas_price: `1000000000` wei
- tx_fee: `256351000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000256351` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `BettingPool` `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'\x10*K{\t\xffU\xc1\xee\xf7\xe9\xfa\xebt\x83\xcc\xb6"M\xe8|\x03[T&\xa7\xae\x89u\xaf\xc65'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `1`
  - `totalBetCount`: `1`

### TX-12 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `189a6d4632169651f5970b30f169b030bdddc0311413e28fb171dbe2855be0b0`
- status: `1`
- gas_used: `344488`
- effective_gas_price: `1000000000` wei
- tx_fee: `344488000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000344488` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `8` | `0` |
| `BettingPool` | `-8` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `to`: `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50`
  - `value`: `8000000000000000000`
- `LiquidityPool` `MarginDistributed`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `lpMarginShare`: `8000000000000000000`
  - `globalShare`: `7000000000000000000`
  - `matchShare`: `1000000000000000000`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `poolId`: `56335227317652277790171658540820788143914083478453855307856522285774088355475`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `6588714285714285716000`
  - `totalActiveDepositedAfter`: `8000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1505000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `PlatformReserveUpdated`
  - `delta`: `2000000000000000000`
  - `newBalance`: `11000035000000000000000000`
  - `reason`: `4`
- `LiquidityPool` `PayoutLiquidityReserved`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `reservedAmount`: `110000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1781329872`
- `LiquidityPool` `PayoutReserveOutstanding`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `outstandingAmount`: `110000000000000000000`
- `LiquidityPool` `LossDistributed`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `lpLossBooked`: `110000000000000000000`
  - `globalLossShare`: `96250000000000000000`
  - `matchLossShare`: `13750000000000000000`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `poolId`: `56335227317652277790171658540820788143914083478453855307856522285774088355475`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `6478714285714285716000`
  - `totalActiveDepositedAfter`: `8000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1615000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `MarketFinalResultRecorded`
  - `marketId`: `b'\x10*K{\t\xffU\xc1\xee\xf7\xe9\xfa\xebt\x83\xcc\xb6"M\xe8|\x03[T&\xa7\xae\x89u\xaf\xc65'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
- `BettingPool` `MarketSettlementFinalized`
  - `marketId`: `b'\x10*K{\t\xffU\xc1\xee\xf7\xe9\xfa\xebt\x83\xcc\xb6"M\xe8|\x03[T&\xa7\xae\x89u\xaf\xc65'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `200000000000000000000`
  - `lpMarginShare`: `8000000000000000000`
  - `platformMarginShare`: `2000000000000000000`
  - `quoteVersion`: `3`

### TX-13 `CLAIM_PAYOUT`
- sender: `bettor` / `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
- tx_hash: `d5074ca1bd18e833a8db5b13901cbaf171cc344ce250bf26a91b6d40ca418492`
- status: `1`
- gas_used: `316040`
- effective_gas_price: `1000000000` wei
- tx_fee: `316040000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `4` | `0` |
| `bettor` | `190` | `-0.00031604` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `4` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `-198` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `to`: `0x9378fd8E53c3904e972bf633Dbb96aA3EF46E32F`
  - `value`: `4000000000000000000`
- `StakingPool` `RewardNotified`
  - `caller`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `amount`: `4000000000000000000`
  - `newAccRewardPerShare`: `21442207792207789`
- `StakingPool` `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `2200000000000000000000`
  - `accountedOddBalanceAfter`: `2428980000000000000000`
  - `accRewardPerShareAfter`: `21442207792207789`
- `BettingPool` `LpLossOffsetApplied`
  - `amount`: `2000000000000000000`
  - `remainingOffset`: `1594510000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `4000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `to`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `value`: `190000000000000000000`
- `ODDToken` `BusinessOutcomeRegistered`
  - `businessId`: `b'\xdf\x97\xf8\x1e\xe3\x9e1\xed_\xf2Q\x1f\xa4U\x03\xc5zF\rDs{\xbf\xd2\x05\xee\x02#\xdeZ\xaa\xec'`
  - `user`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `businessContract`: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
  - `businessOutDelta`: `190000000000000000000`
  - `principalReturnedDelta`: `101000000000000000000`
  - `lossDelta`: `0`
  - `profitDelta`: `89000000000000000000`
  - `totalBusinessOut`: `190000000000000000000`
  - `finalized`: `True`
- `BettingPool` `BetClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x11'`
  - `marketId`: `b'\x10*K{\t\xffU\xc1\xee\xf7\xe9\xfa\xebt\x83\xcc\xb6"M\xe8|\x03[T&\xa7\xae\x89u\xaf\xc65'`
  - `user`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `payout`: `190000000000000000000`
  - `executor`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
- `BettingPool` `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x11'`
  - `user`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `grossPayout`: `200000000000000000000`
  - `taxAmount`: `10000000000000000000`
  - `netPayout`: `190000000000000000000`

### TX-14 `REQUEST_UNBOND_MATCH_LP`
- sender: `lpUser` / `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
- tx_hash: `d1ca45b3138c594dc5514224b3ce4531cf9748f1f12bd0449a7c37e67c50ba98`
- status: `1`
- gas_used: `201980`
- effective_gas_price: `1000000000` wei
- tx_fee: `201980000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `-0.00020198` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `UnbondRequested`
  - `positionId`: `11`
  - `user`: `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
  - `unbondingEpoch`: `25`
  - `frozenRewardPerWeight`: `1000000000000000`
  - `frozenLossPerPrincipal`: `13750000000000000`
- `LiquidityPool` `LiquidityPositionStateChanged`
  - `positionId`: `11`
  - `user`: `0x2CF7E7094d41d16DcfC7E00af9D197acC1CD1616`
  - `previousState`: `0`
  - `newState`: `1`
  - `principal`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'|\x8c\x9b\xd4\xab\x8b\x97\x07WL"\x91U}\x88{~\xaaz\xe1\x0e\xa9e;\x1b\x83v\xd3c\x06\xbe\x93'`
  - `poolId`: `56335227317652277790171658540820788143914083478453855307856522285774088355475`
  - `positionId`: `11`
  - `actionKind`: `6`
  - `requestableLiquidityAfter`: `5491464285714285716000`
  - `totalActiveDepositedAfter`: `7000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1615000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`

### TX-15 `USER_WITHDRAW_ODD_TO_SINK`
- sender: `bettor` / `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
- tx_hash: `f9dfad9ecd1a34d972023d131c3d0a821a5b5be49921b98bfd08905b0f22ed6c`
- status: `1`
- gas_used: `84342`
- effective_gas_price: `1000000000` wei
- tx_fee: `84342000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000525164` |
| `bettor` | `-10` | `-0.000084342` |
| `lpUser` | `0` | `0` |
| `sink` | `10` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0xC2806b669E387F5345A42972538EAdbE22ab6d99`
  - `to`: `0xF501118cf744DeF9B1464c024E6DfB4dA5A285e3`
  - `value`: `10000000000000000000`
