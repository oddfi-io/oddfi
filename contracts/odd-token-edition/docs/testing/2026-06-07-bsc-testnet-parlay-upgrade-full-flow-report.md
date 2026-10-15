# 2026-06-07 BSC Testnet Parlay Upgrade Full Flow Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- matchId: `1c49f40ecdb686d4f03d33dd77914e773a5dedf9b6f01a0db561660f80dd1af8`
- marketId: `5b7f53eba1c1417f1d8ffc9e254372c5cc7ad5850b908a0e35d00c1919347bd0`
- betId: `00000000000000000000000000000000000000000000000000000000000001cf`
- lpPositionId: `42`
- expectedGrossPayout: `200 ODD`
- expectedPayoutTax: `10 ODD`
- expectedNetPayout: `190 ODD`

## Checks
- [PASS] `SEED_BNB_bettor_status`: status=1, tx=54c6a5e9946af5ae364b22a43a8bb44bd59c8a48abbeecab7cc19d7b1ec93749
- [PASS] `SEED_BNB_lpUser_status`: status=1, tx=0cb337d9af22956fbfa1d7275422333a21afdd698a713d2c454367d70dccc118
- [PASS] `SEED_BNB_sink_status`: status=1, tx=0833e44128982696fb93e98325f54649bac784001d1b3117b1d6a58fac4deb3e
- [PASS] `SEED_ODD_bettor_status`: status=1, tx=0431f04c457a0db5bed87f446603d659475e7dcfe41fc22d9d3566f1d4a6af31
- [PASS] `SEED_ODD_lpUser_status`: status=1, tx=c812a05c166fe942ddee3eec60b1b547fbf0655bb2a0daedba51c13e5af5591c
- [PASS] `APPROVE_BETTOR_BETTING_status`: status=1, tx=38a32f0be98aa285d2a2816efbdd14c359555b1f271f2384ca2c830d2db5dd5d
- [PASS] `APPROVE_LP_LIQUIDITY_status`: status=1, tx=370292be0bf888bab567a63b8410af4ef1c9896345d7f12db3cc8699101c0950
- [PASS] `OPEN_MARKET_status`: status=1, tx=2577377677034db76d49933c9d5e576b4b68c1e6035644b9eb6d924ad0ea478b
- [PASS] `DEPOSIT_MATCH_LP_status`: status=1, tx=7e801bace7c3dd0fe7ab25d7c9288d75bcb5657f52d6b0fd080c79135917fa79
- [PASS] `PLACE_BET_status`: status=1, tx=b94a0b2d7cc38d7020cd39bbeb615b9a65e46016dd0b41beaa4ff76a87d9a633
- [PASS] `SETTLE_MARKET_BETS_BY_SCORE_status`: status=1, tx=f3ff65e36aaf1f2833d7a972af051ff53f9719d5894bb0daf9953eeda013c3db
- [PASS] `FINALIZE_MARKET_SETTLEMENT_status`: status=1, tx=6f64d12e6464fac25147ce035491483dbe622af1448940340d8c927c098e4305
- [PASS] `CLAIM_PAYOUT_status`: status=1, tx=4cd26751250b07b8f9b98f85943748ef809049ff451412fcd200d6018f68ddf6
- [PASS] `CLAIM_NET_DELTA`: expected 190000000000000000000, got 190000000000000000000
- [PASS] `CLAIM_PAYOUT_TX_SUCCESS`: 4cd26751250b07b8f9b98f85943748ef809049ff451412fcd200d6018f68ddf6
- [PASS] `REQUEST_UNBOND_MATCH_LP_status`: status=1, tx=f7824135c7a7201afec79c056a4538c58b58cd73d49b1622a048cdc1212ae7bc
- [PASS] `WITHDRAW_MATCH_LP_WAIT_10_MIN_RULE_CONFIRMED`: not mature after 10 minutes as expected by epoch rule: ('0xc71a025400000000000000000000000000000000000000000000000000000000000000830000000000000000000000000000000000000000000000000000000000000086', '0xc71a025400000000000000000000000000000000000000000000000000000000000000830000000000000000000000000000000000000000000000000000000000000086')
- [PASS] `USER_WITHDRAW_ODD_TO_SINK_status`: status=1, tx=676ffe3de1c3ace5e069b2e1c1f90b2c179968aea4ca9403bdcf8122e3401ec3

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,429,177` | `98,425,182` | `9.8497903215555412` | `9.7585646465555412` |
| `bettor` | `0x18FEa31B9E029281EB41a1924F953725815B9E54` | `0` | `2,079` | `0` | `0.02920244` |
| `lpUser` | `0x4F078A0574921BbA386e09a3159EE6740b191232` | `0` | `1,000` | `0` | `0.029499322` |
| `sink` | `0x3273E431779477cE01B6845ce3187E43A5c41044` | `0` | `10` | `0` | `0.03` |
| `StakingPool` | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | `22,016` | `22,020` | `0` | `0` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `119,368` | `120,376` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `63,350` | `63,244` | `0` | `0` |

## Transactions
### TX-01 `SEED_BNB_bettor`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `54c6a5e9946af5ae364b22a43a8bb44bd59c8a48abbeecab7cc19d7b1ec93749`
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
- tx_hash: `0cb337d9af22956fbfa1d7275422333a21afdd698a713d2c454367d70dccc118`
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
- tx_hash: `0833e44128982696fb93e98325f54649bac784001d1b3117b1d6a58fac4deb3e`
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
- tx_hash: `0431f04c457a0db5bed87f446603d659475e7dcfe41fc22d9d3566f1d4a6af31`
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
  - `to`: `0x18FEa31B9E029281EB41a1924F953725815B9E54`
  - `value`: `2000000000000000000000`

### TX-05 `SEED_ODD_lpUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `c812a05c166fe942ddee3eec60b1b547fbf0655bb2a0daedba51c13e5af5591c`
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
  - `to`: `0x4F078A0574921BbA386e09a3159EE6740b191232`
  - `value`: `2000000000000000000000`

### TX-06 `APPROVE_BETTOR_BETTING`
- sender: `bettor` / `0x18FEa31B9E029281EB41a1924F953725815B9E54`
- tx_hash: `38a32f0be98aa285d2a2816efbdd14c359555b1f271f2384ca2c830d2db5dd5d`
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
  - `owner`: `0x18FEa31B9E029281EB41a1924F953725815B9E54`
  - `spender`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-07 `APPROVE_LP_LIQUIDITY`
- sender: `lpUser` / `0x4F078A0574921BbA386e09a3159EE6740b191232`
- tx_hash: `370292be0bf888bab567a63b8410af4ef1c9896345d7f12db3cc8699101c0950`
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
  - `owner`: `0x4F078A0574921BbA386e09a3159EE6740b191232`
  - `spender`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-08 `OPEN_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `2577377677034db76d49933c9d5e576b4b68c1e6035644b9eb6d924ad0ea478b`
- status: `1`
- gas_used: `470775`
- effective_gas_price: `1000000000` wei
- tx_fee: `470775000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000470775` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `MatchPoolOpened`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `poolId`: `12795424021272258083932230084526984719536467799280593704021014592456811682552`
  - `matchEndTime`: `1780786829`
  - `depositCloseAt`: `1780786649`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `poolId`: `12795424021272258083932230084526984719536467799280593704021014592456811682552`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `100004046883765878215000`
  - `totalActiveDepositedAfter`: `111000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `13450000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` `MarketOpened`
  - `marketId`: `b'[\x7fS\xeb\xa1\xc1A\x7f\x1d\x8f\xfc\x9e%Cr\xc5\xccz\xd5\x85\x0b\x90\x8a\x0e5\xd0\x0c\x19\x194{\xd0'`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `marketType`: `1`
  - `line`: `0`
  - `matchStartTime`: `1780786649`
  - `lockAt`: `1780786829`
  - `quoteVersion`: `1`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'[\x7fS\xeb\xa1\xc1A\x7f\x1d\x8f\xfc\x9e%Cr\xc5\xccz\xd5\x85\x0b\x90\x8a\x0e5\xd0\x0c\x19\x194{\xd0'`
  - `updatedAt`: `1780786239`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-09 `DEPOSIT_MATCH_LP`
- sender: `lpUser` / `0x4F078A0574921BbA386e09a3159EE6740b191232`
- tx_hash: `7e801bace7c3dd0fe7ab25d7c9288d75bcb5657f52d6b0fd080c79135917fa79`
- status: `1`
- gas_used: `263724`
- effective_gas_price: `1000000000` wei
- tx_fee: `263724000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `-1,000` | `-0.000263724` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `1,000` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x4F078A0574921BbA386e09a3159EE6740b191232`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `1000000000000000000000`
- `LiquidityPool` `LiquidityDeposited`
  - `positionId`: `42`
  - `poolId`: `12795424021272258083932230084526984719536467799280593704021014592456811682552`
  - `user`: `0x4F078A0574921BbA386e09a3159EE6740b191232`
  - `amount`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
  - `planId`: `0`
  - `unlockAt`: `1780786829`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `poolId`: `12795424021272258083932230084526984719536467799280593704021014592456811682552`
  - `positionId`: `42`
  - `actionKind`: `1`
  - `requestableLiquidityAfter`: `101004046883765878215000`
  - `totalActiveDepositedAfter`: `112000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `13450000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`

### TX-10 `PLACE_BET`
- sender: `bettor` / `0x18FEa31B9E029281EB41a1924F953725815B9E54`
- tx_hash: `b94a0b2d7cc38d7020cd39bbeb615b9a65e46016dd0b41beaa4ff76a87d9a633`
- status: `1`
- gas_used: `531076`
- effective_gas_price: `1000000000` wei
- tx_fee: `531076000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `1` | `0` |
| `bettor` | `-101` | `-0.000531076` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `100` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x18FEa31B9E029281EB41a1924F953725815B9E54`
  - `to`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `101000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `1000000000000000000`
- `BettingPool` `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\xcf'`
  - `marketId`: `b'[\x7fS\xeb\xa1\xc1A\x7f\x1d\x8f\xfc\x9e%Cr\xc5\xccz\xd5\x85\x0b\x90\x8a\x0e5\xd0\x0c\x19\x194{\xd0'`
  - `user`: `0x18FEa31B9E029281EB41a1924F953725815B9E54`
  - `requestedAmount`: `100000000000000000000`
  - `acceptedAmount`: `100000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'[\x7fS\xeb\xa1\xc1A\x7f\x1d\x8f\xfc\x9e%Cr\xc5\xccz\xd5\x85\x0b\x90\x8a\x0e5\xd0\x0c\x19\x194{\xd0'`
  - `updatedAt`: `1780786239`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-11 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `f3ff65e36aaf1f2833d7a972af051ff53f9719d5894bb0daf9953eeda013c3db`
- status: `1`
- gas_used: `256106`
- effective_gas_price: `1000000000` wei
- tx_fee: `256106000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000256106` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `BettingPool` `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'[\x7fS\xeb\xa1\xc1A\x7f\x1d\x8f\xfc\x9e%Cr\xc5\xccz\xd5\x85\x0b\x90\x8a\x0e5\xd0\x0c\x19\x194{\xd0'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `1`
  - `totalBetCount`: `1`

### TX-12 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `6f64d12e6464fac25147ce035491483dbe622af1448940340d8c927c098e4305`
- status: `1`
- gas_used: `318650`
- effective_gas_price: `1000000000` wei
- tx_fee: `318650000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.00031865` |
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
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `lpMarginShare`: `8000000000000000000`
  - `globalShare`: `7809523809523809523`
  - `matchShare`: `190476190476190477`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `poolId`: `12795424021272258083932230084526984719536467799280593704021014592456811682552`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `101012046883765878215000`
  - `totalActiveDepositedAfter`: `112000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `13450000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `PlatformReserveUpdated`
  - `delta`: `2000000000000000000`
  - `newBalance`: `30652000000000000000000`
  - `reason`: `4`
- `LiquidityPool` `PayoutLiquidityReserved`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `reservedAmount`: `200000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1780786868`
- `LiquidityPool` `PayoutReserveOutstanding`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `outstandingAmount`: `200000000000000000000`
- `LiquidityPool` `LossDistributed`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `lpLossBooked`: `200000000000000000000`
  - `globalLossShare`: `195238095238095238095`
  - `matchLossShare`: `4761904761904761905`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `poolId`: `12795424021272258083932230084526984719536467799280593704021014592456811682552`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `100812046883765878215000`
  - `totalActiveDepositedAfter`: `112000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `13650000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `MarketFinalResultRecorded`
  - `marketId`: `b'[\x7fS\xeb\xa1\xc1A\x7f\x1d\x8f\xfc\x9e%Cr\xc5\xccz\xd5\x85\x0b\x90\x8a\x0e5\xd0\x0c\x19\x194{\xd0'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
- `BettingPool` `MarketSettlementFinalized`
  - `marketId`: `b'[\x7fS\xeb\xa1\xc1A\x7f\x1d\x8f\xfc\x9e%Cr\xc5\xccz\xd5\x85\x0b\x90\x8a\x0e5\xd0\x0c\x19\x194{\xd0'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `200000000000000000000`
  - `lpMarginShare`: `8000000000000000000`
  - `platformMarginShare`: `2000000000000000000`
  - `quoteVersion`: `3`

### TX-13 `CLAIM_PAYOUT`
- sender: `bettor` / `0x18FEa31B9E029281EB41a1924F953725815B9E54`
- tx_hash: `4cd26751250b07b8f9b98f85943748ef809049ff451412fcd200d6018f68ddf6`
- status: `1`
- gas_used: `156768`
- effective_gas_price: `1000000000` wei
- tx_fee: `156768000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `4` | `0` |
| `bettor` | `190` | `-0.000156768` |
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
  - `newAccRewardPerShare`: `129894995864350683`
- `StakingPool` `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `16000000000000000000000`
  - `accountedOddBalanceAfter`: `22020000000000000000000`
  - `accRewardPerShareAfter`: `129894995864350683`
- `BettingPool` `LpLossOffsetApplied`
  - `amount`: `2000000000000000000`
  - `remainingOffset`: `13390000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `4000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x18FEa31B9E029281EB41a1924F953725815B9E54`
  - `value`: `190000000000000000000`
- `BettingPool` `BetClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\xcf'`
  - `marketId`: `b'[\x7fS\xeb\xa1\xc1A\x7f\x1d\x8f\xfc\x9e%Cr\xc5\xccz\xd5\x85\x0b\x90\x8a\x0e5\xd0\x0c\x19\x194{\xd0'`
  - `user`: `0x18FEa31B9E029281EB41a1924F953725815B9E54`
  - `payout`: `190000000000000000000`
  - `executor`: `0x18FEa31B9E029281EB41a1924F953725815B9E54`
- `BettingPool` `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\xcf'`
  - `user`: `0x18FEa31B9E029281EB41a1924F953725815B9E54`
  - `grossPayout`: `200000000000000000000`
  - `taxAmount`: `10000000000000000000`
  - `netPayout`: `190000000000000000000`

### TX-14 `REQUEST_UNBOND_MATCH_LP`
- sender: `lpUser` / `0x4F078A0574921BbA386e09a3159EE6740b191232`
- tx_hash: `f7824135c7a7201afec79c056a4538c58b58cd73d49b1622a048cdc1212ae7bc`
- status: `1`
- gas_used: `185798`
- effective_gas_price: `1000000000` wei
- tx_fee: `185798000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `-0.000185798` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `UnbondRequested`
  - `positionId`: `42`
  - `user`: `0x4F078A0574921BbA386e09a3159EE6740b191232`
  - `unbondingEpoch`: `131`
  - `frozenRewardPerWeight`: `190476190476190`
  - `frozenLossPerPrincipal`: `4761904761904761`
- `LiquidityPool` `LiquidityPositionStateChanged`
  - `positionId`: `42`
  - `user`: `0x4F078A0574921BbA386e09a3159EE6740b191232`
  - `previousState`: `0`
  - `newState`: `1`
  - `principal`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'\x1cI\xf4\x0e\xcd\xb6\x86\xd4\xf0=3\xddw\x91Nw:]\xed\xf9\xb6\xf0\x1a\r\xb5af\x0f\x80\xdd\x1a\xf8'`
  - `poolId`: `12795424021272258083932230084526984719536467799280593704021014592456811682552`
  - `positionId`: `42`
  - `actionKind`: `6`
  - `requestableLiquidityAfter`: `99816618312337306786000`
  - `totalActiveDepositedAfter`: `111000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `13650000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`

### TX-15 `USER_WITHDRAW_ODD_TO_SINK`
- sender: `bettor` / `0x18FEa31B9E029281EB41a1924F953725815B9E54`
- tx_hash: `676ffe3de1c3ace5e069b2e1c1f90b2c179968aea4ca9403bdcf8122e3401ec3`
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
  - `from`: `0x18FEa31B9E029281EB41a1924F953725815B9E54`
  - `to`: `0x3273E431779477cE01B6845ce3187E43A5c41044`
  - `value`: `10000000000000000000`
