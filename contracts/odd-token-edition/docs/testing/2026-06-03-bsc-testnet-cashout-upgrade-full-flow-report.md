# 2026-06-03 BSC Testnet Cash Out Upgrade Full Flow Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- matchId: `2daaaca99b681ed841dfddd4eb4983f44470af209b356d170bf1e9a3410f1223`
- marketId: `8bd3e0c94aa40ef62641f10902b01e81b079925ef9db3446389f777c3f473a29`
- betId: `00000000000000000000000000000000000000000000000000000000000001a1`
- lpPositionId: `35`
- expectedGrossPayout: `200 ODD`
- expectedPayoutTax: `10 ODD`
- expectedNetPayout: `190 ODD`

## Checks
- [PASS] `SEED_BNB_bettor_status`: status=1, tx=d610b5d67bb2126443bd332e68b6421c2537c90b732bf2cf51506efce3bdf225
- [PASS] `SEED_BNB_lpUser_status`: status=1, tx=d192f5c1dda246fe7b9f424867acdc772eaf469a3a4ef9736bdda876c2e06410
- [PASS] `SEED_BNB_sink_status`: status=1, tx=b58e2eb04771596fb74e09653b7722117c3c21c31384b2e7345d3a5c6d0ee58d
- [PASS] `SEED_ODD_bettor_status`: status=1, tx=f8f42a8ca54bb91af806661eb59e2b3f40a07190a31ae3098a24a570447fa2b6
- [PASS] `SEED_ODD_lpUser_status`: status=1, tx=aeecd1f42977be60280b14f2ec2c08fc097e62c8ac02ae9dfe50f804d9beac58
- [PASS] `APPROVE_BETTOR_BETTING_status`: status=1, tx=ccfda43fa310b1d93a9ba8b711ffd3ef05065ad7324aefc29b738c934df352dc
- [PASS] `APPROVE_LP_LIQUIDITY_status`: status=1, tx=601ca93d3e45cdc54b164c42b83109fcb4d87d722e6b1c97dc6125d871aa359c
- [PASS] `OPEN_MARKET_status`: status=1, tx=04952f17c2368e25fa19e85caefb570074d65affbb8395678c1749886a0488d0
- [PASS] `DEPOSIT_MATCH_LP_status`: status=1, tx=84372d301af7d1d70ff333a7c25abd9c1477aafa20fb9bce04af9f1e28183509
- [PASS] `PLACE_BET_status`: status=1, tx=24922b138db239227bcf8691e50db0634ef912dd4438471a36453371be856c89
- [PASS] `SETTLE_MARKET_BETS_BY_SCORE_status`: status=1, tx=89222c3ac250973cfbba9e7e008cf42d7a7067881b7293f4cf83d143c564d44d
- [PASS] `FINALIZE_MARKET_SETTLEMENT_status`: status=1, tx=bbde8b6298fe91f232bde0c57f0079dba8df610d00e6a524213141a2a5c333ba
- [PASS] `CLAIM_PAYOUT_status`: status=1, tx=fd750dbf3dd51394b1223241fe4cad2ca41754dfd4960b6406f7d9a6d407c3fa
- [PASS] `CLAIM_NET_DELTA`: expected 190000000000000000000, got 190000000000000000000
- [PASS] `CLAIM_PAYOUT_TX_SUCCESS`: fd750dbf3dd51394b1223241fe4cad2ca41754dfd4960b6406f7d9a6d407c3fa
- [PASS] `REQUEST_UNBOND_MATCH_LP_status`: status=1, tx=34588abc37ef6183c002da5311dbfecbd4096898b49a901bdec1a47c3f0bc701
- [PASS] `WITHDRAW_MATCH_LP_WAIT_10_MIN_RULE_CONFIRMED`: not mature after 10 minutes as expected by epoch rule: ('0xc71a025400000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000073', '0xc71a025400000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000073')
- [PASS] `USER_WITHDRAW_ODD_TO_SINK_status`: status=1, tx=52f074687127a8e1182a094e998f41076d411fbcae4c874863fc41ace9e10705

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,454,071` | `98,450,076` | `9.9840929421555412` | `9.8925805731555412` |
| `bettor` | `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E` | `0` | `2,079` | `0` | `0.02920297` |
| `lpUser` | `0x35802C63636e13892E5949905E198B6C7dE74F26` | `0` | `1,000` | `0` | `0.02949988` |
| `sink` | `0x7c837Dfa25C388fA235a1f28b0438e3aAe0510B2` | `0` | `10` | `0` | `0.03` |
| `StakingPool` | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | `21,954` | `21,958` | `0` | `0` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `108,104` | `110,112` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `53,083` | `52,977` | `0` | `0` |

## Transactions
### TX-01 `SEED_BNB_bettor`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `d610b5d67bb2126443bd332e68b6421c2537c90b732bf2cf51506efce3bdf225`
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
- tx_hash: `d192f5c1dda246fe7b9f424867acdc772eaf469a3a4ef9736bdda876c2e06410`
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
- tx_hash: `b58e2eb04771596fb74e09653b7722117c3c21c31384b2e7345d3a5c6d0ee58d`
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
- tx_hash: `f8f42a8ca54bb91af806661eb59e2b3f40a07190a31ae3098a24a570447fa2b6`
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
  - `to`: `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
  - `value`: `2000000000000000000000`

### TX-05 `SEED_ODD_lpUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `aeecd1f42977be60280b14f2ec2c08fc097e62c8ac02ae9dfe50f804d9beac58`
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
  - `to`: `0x35802C63636e13892E5949905E198B6C7dE74F26`
  - `value`: `2000000000000000000000`

### TX-06 `APPROVE_BETTOR_BETTING`
- sender: `bettor` / `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
- tx_hash: `ccfda43fa310b1d93a9ba8b711ffd3ef05065ad7324aefc29b738c934df352dc`
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
  - `owner`: `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
  - `spender`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-07 `APPROVE_LP_LIQUIDITY`
- sender: `lpUser` / `0x35802C63636e13892E5949905E198B6C7dE74F26`
- tx_hash: `601ca93d3e45cdc54b164c42b83109fcb4d87d722e6b1c97dc6125d871aa359c`
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
  - `owner`: `0x35802C63636e13892E5949905E198B6C7dE74F26`
  - `spender`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-08 `OPEN_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `04952f17c2368e25fa19e85caefb570074d65affbb8395678c1749886a0488d0`
- status: `1`
- gas_used: `470728`
- effective_gas_price: `1000000000` wei
- tx_fee: `470728000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000470728` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `MatchPoolOpened`
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `poolId`: `20655633860228185430985567285122789308170777486922391573381419273899413017123`
  - `matchEndTime`: `1780721060`
  - `depositCloseAt`: `1780720880`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `poolId`: `20655633860228185430985567285122789308170777486922391573381419273899413017123`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `92056986741363211952000`
  - `totalActiveDepositedAfter`: `102000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `12100000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` `MarketOpened`
  - `marketId`: `b'\x8b\xd3\xe0\xc9J\xa4\x0e\xf6&A\xf1\t\x02\xb0\x1e\x81\xb0y\x92^\xf9\xdb4F8\x9fw|?G:)'`
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `marketType`: `1`
  - `line`: `0`
  - `matchStartTime`: `1780720880`
  - `lockAt`: `1780721060`
  - `quoteVersion`: `1`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\x8b\xd3\xe0\xc9J\xa4\x0e\xf6&A\xf1\t\x02\xb0\x1e\x81\xb0y\x92^\xf9\xdb4F8\x9fw|?G:)'`
  - `updatedAt`: `1780720470`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-09 `DEPOSIT_MATCH_LP`
- sender: `lpUser` / `0x35802C63636e13892E5949905E198B6C7dE74F26`
- tx_hash: `84372d301af7d1d70ff333a7c25abd9c1477aafa20fb9bce04af9f1e28183509`
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
  - `from`: `0x35802C63636e13892E5949905E198B6C7dE74F26`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `1000000000000000000000`
- `LiquidityPool` `LiquidityDeposited`
  - `positionId`: `35`
  - `poolId`: `20655633860228185430985567285122789308170777486922391573381419273899413017123`
  - `user`: `0x35802C63636e13892E5949905E198B6C7dE74F26`
  - `amount`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
  - `planId`: `0`
  - `unlockAt`: `1780721060`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `poolId`: `20655633860228185430985567285122789308170777486922391573381419273899413017123`
  - `positionId`: `35`
  - `actionKind`: `1`
  - `requestableLiquidityAfter`: `93056986741363211952000`
  - `totalActiveDepositedAfter`: `103000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `12100000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`

### TX-10 `PLACE_BET`
- sender: `bettor` / `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
- tx_hash: `24922b138db239227bcf8691e50db0634ef912dd4438471a36453371be856c89`
- status: `1`
- gas_used: `530942`
- effective_gas_price: `1000000000` wei
- tx_fee: `530942000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `1` | `0` |
| `bettor` | `-101` | `-0.000530942` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `100` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
  - `to`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `101000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `1000000000000000000`
- `BettingPool` `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\xa1'`
  - `marketId`: `b'\x8b\xd3\xe0\xc9J\xa4\x0e\xf6&A\xf1\t\x02\xb0\x1e\x81\xb0y\x92^\xf9\xdb4F8\x9fw|?G:)'`
  - `user`: `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
  - `requestedAmount`: `100000000000000000000`
  - `acceptedAmount`: `100000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\x8b\xd3\xe0\xc9J\xa4\x0e\xf6&A\xf1\t\x02\xb0\x1e\x81\xb0y\x92^\xf9\xdb4F8\x9fw|?G:)'`
  - `updatedAt`: `1780720470`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-11 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `89222c3ac250973cfbba9e7e008cf42d7a7067881b7293f4cf83d143c564d44d`
- status: `1`
- gas_used: `255841`
- effective_gas_price: `1000000000` wei
- tx_fee: `255841000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000255841` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `BettingPool` `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'\x8b\xd3\xe0\xc9J\xa4\x0e\xf6&A\xf1\t\x02\xb0\x1e\x81\xb0y\x92^\xf9\xdb4F8\x9fw|?G:)'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `1`
  - `totalBetCount`: `1`

### TX-12 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `bbde8b6298fe91f232bde0c57f0079dba8df610d00e6a524213141a2a5c333ba`
- status: `1`
- gas_used: `285972`
- effective_gas_price: `1000000000` wei
- tx_fee: `285972000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000285972` |
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
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `lpMarginShare`: `8000000000000000000`
  - `globalShare`: `7809523809523809523`
  - `matchShare`: `190476190476190477`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `poolId`: `20655633860228185430985567285122789308170777486922391573381419273899413017123`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `93064986741363211952000`
  - `totalActiveDepositedAfter`: `103000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `12100000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `PlatformReserveUpdated`
  - `delta`: `2000000000000000000`
  - `newBalance`: `30586000000000000000000`
  - `reason`: `4`
- `LiquidityPool` `PayoutLiquidityReserved`
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `reservedAmount`: `200000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1780721095`
- `LiquidityPool` `LossDistributed`
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `lpLossBooked`: `200000000000000000000`
  - `globalLossShare`: `195238095238095238095`
  - `matchLossShare`: `4761904761904761905`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `poolId`: `20655633860228185430985567285122789308170777486922391573381419273899413017123`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `92864986741363211952000`
  - `totalActiveDepositedAfter`: `103000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `12300000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `MarketSettlementFinalized`
  - `marketId`: `b'\x8b\xd3\xe0\xc9J\xa4\x0e\xf6&A\xf1\t\x02\xb0\x1e\x81\xb0y\x92^\xf9\xdb4F8\x9fw|?G:)'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `200000000000000000000`
  - `lpMarginShare`: `8000000000000000000`
  - `platformMarginShare`: `2000000000000000000`
  - `quoteVersion`: `3`

### TX-13 `CLAIM_PAYOUT`
- sender: `bettor` / `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
- tx_hash: `fd750dbf3dd51394b1223241fe4cad2ca41754dfd4960b6406f7d9a6d407c3fa`
- status: `1`
- gas_used: `156372`
- effective_gas_price: `1000000000` wei
- tx_fee: `156372000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `4` | `0` |
| `bettor` | `190` | `-0.000156372` |
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
  - `newAccRewardPerShare`: `125572952853597995`
- `StakingPool` `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `16000000000000000000000`
  - `accountedOddBalanceAfter`: `21958000000000000000000`
  - `accRewardPerShareAfter`: `125572952853597995`
- `BettingPool` `LpLossOffsetApplied`
  - `amount`: `2000000000000000000`
  - `remainingOffset`: `12071000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `4000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
  - `value`: `190000000000000000000`
- `BettingPool` `BetClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\xa1'`
  - `marketId`: `b'\x8b\xd3\xe0\xc9J\xa4\x0e\xf6&A\xf1\t\x02\xb0\x1e\x81\xb0y\x92^\xf9\xdb4F8\x9fw|?G:)'`
  - `user`: `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
  - `payout`: `190000000000000000000`
  - `executor`: `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
- `BettingPool` `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\xa1'`
  - `user`: `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
  - `grossPayout`: `200000000000000000000`
  - `taxAmount`: `10000000000000000000`
  - `netPayout`: `190000000000000000000`

### TX-14 `REQUEST_UNBOND_MATCH_LP`
- sender: `lpUser` / `0x35802C63636e13892E5949905E198B6C7dE74F26`
- tx_hash: `34588abc37ef6183c002da5311dbfecbd4096898b49a901bdec1a47c3f0bc701`
- status: `1`
- gas_used: `185394`
- effective_gas_price: `1000000000` wei
- tx_fee: `185394000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `-0.000185394` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `UnbondRequested`
  - `positionId`: `35`
  - `user`: `0x35802C63636e13892E5949905E198B6C7dE74F26`
  - `unbondingEpoch`: `112`
  - `frozenRewardPerWeight`: `190476190476190`
  - `frozenLossPerPrincipal`: `4761904761904761`
- `LiquidityPool` `LiquidityPositionStateChanged`
  - `positionId`: `35`
  - `user`: `0x35802C63636e13892E5949905E198B6C7dE74F26`
  - `previousState`: `0`
  - `newState`: `1`
  - `principal`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'-\xaa\xac\xa9\x9bh\x1e\xd8A\xdf\xdd\xd4\xebI\x83\xf4Dp\xaf \x9b5m\x17\x0b\xf1\xe9\xa3A\x0f\x12#'`
  - `poolId`: `20655633860228185430985567285122789308170777486922391573381419273899413017123`
  - `positionId`: `35`
  - `actionKind`: `6`
  - `requestableLiquidityAfter`: `91869558169934640523000`
  - `totalActiveDepositedAfter`: `102000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `12300000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`

### TX-15 `USER_WITHDRAW_ODD_TO_SINK`
- sender: `bettor` / `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
- tx_hash: `52f074687127a8e1182a094e998f41076d411fbcae4c874863fc41ace9e10705`
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
  - `from`: `0x78a3016f07F6F83d4f3B30819dB5fb6cAeaEA69E`
  - `to`: `0x7c837Dfa25C388fA235a1f28b0438e3aAe0510B2`
  - `value`: `10000000000000000000`
