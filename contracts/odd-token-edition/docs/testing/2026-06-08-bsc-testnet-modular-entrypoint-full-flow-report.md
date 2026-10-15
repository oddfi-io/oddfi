# 2026-06-07 BSC Testnet Parlay Upgrade Full Flow Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- matchId: `6ae8b95c0d15074427f6224554104335f510f1576f2658f43b100363dfc61e10`
- marketId: `c505ecbb7f3fdfbfbcdc4e6ff5edc94d4e5f5c975fd60e17b0833937a8217511`
- betId: `00000000000000000000000000000000000000000000000000000000000002b5`
- lpPositionId: `59`
- expectedGrossPayout: `200 ODD`
- expectedPayoutTax: `10 ODD`
- expectedNetPayout: `190 ODD`

## Checks
- [PASS] `SEED_BNB_bettor_status`: status=1, tx=01538052a4a0f8b65a8813c718be49e1f4e7f94d74856ad023742bc4f49e6af9
- [PASS] `SEED_BNB_lpUser_status`: status=1, tx=69e6e4bbb32c40b65cc1fc31c5e2d4291a9aa11e730b6b2fe34c7f175a02477f
- [PASS] `SEED_BNB_sink_status`: status=1, tx=4436a3da97bbd699662d0f70447b4fd71a51a25fc0c7b42d9a1558bfc87e82c2
- [PASS] `SEED_ODD_bettor_status`: status=1, tx=432148c0663d06f686c48fa1ae389a3a1cf8335e9aaaca43b2d3e7635de4a793
- [PASS] `SEED_ODD_lpUser_status`: status=1, tx=08c6396445bf53a2e325e1a1f5208868048f97c7bed88c6fccc76c872571d313
- [PASS] `APPROVE_BETTOR_BETTING_status`: status=1, tx=6efba2664cbaf3fb527fc839ead5df219f7899577bb424e1aa1dda02b7f09b6c
- [PASS] `APPROVE_LP_LIQUIDITY_status`: status=1, tx=0e2ca678fe83bd4ed5c73e12cbb4ee437a198167d9e4a2ddc9fb6503c1c8df84
- [PASS] `OPEN_MARKET_status`: status=1, tx=352bcd848aa61c07622be2f6c6074a17e38cc9b0313d2c91781c1343bb32d60e
- [PASS] `DEPOSIT_MATCH_LP_status`: status=1, tx=26850f700b6f9177ac4f738c17bba37d33d81b3cbb09f2dace781f8a360d0d8a
- [PASS] `PLACE_BET_status`: status=1, tx=818209a91942f9b2c69d82412794a68ef875925cc83710db33c1509bb58d38b1
- [PASS] `SETTLE_MARKET_BETS_BY_SCORE_status`: status=1, tx=99e50fddc011a61e87e460f3059c02022f0850f880aaa35b43634d72c33763b4
- [PASS] `FINALIZE_MARKET_SETTLEMENT_status`: status=1, tx=b8ad90fc814a00d726ed3a46569b6bc6fb1cc3187380a29abc57ac18a5ceb46c
- [PASS] `CLAIM_PAYOUT_status`: status=1, tx=ef4a7c5f6560ba8083d780cd8efb7f954f15837d13afbeb2958a690b377ff498
- [PASS] `CLAIM_NET_DELTA`: expected 190000000000000000000, got 190000000000000000000
- [PASS] `CLAIM_PAYOUT_TX_SUCCESS`: ef4a7c5f6560ba8083d780cd8efb7f954f15837d13afbeb2958a690b377ff498
- [PASS] `REQUEST_UNBOND_MATCH_LP_status`: status=1, tx=4278e0e4df4980d5f13a03e7105cbe1e00d417d151b259bbb89e972eb60cd284
- [PASS] `WITHDRAW_MATCH_LP_WAIT_10_MIN_RULE_CONFIRMED`: not mature after 10 minutes as expected by epoch rule: ('0xc71a025400000000000000000000000000000000000000000000000000000000000000a900000000000000000000000000000000000000000000000000000000000000ac', '0xc71a025400000000000000000000000000000000000000000000000000000000000000a900000000000000000000000000000000000000000000000000000000000000ac')
- [PASS] `USER_WITHDRAW_ODD_TO_SINK_status`: status=1, tx=db93017f973dddee96431a9449797c5ac0660d3aa39f354548d8e4f6447fea83

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,375,835.534883720930231999` | `98,371,849.534883720930231999` | `8.0644615653555412` | `7.9593113783555412` |
| `bettor` | `0xcd70eA7FE1aD7711F101656832Cc76F25573992f` | `0` | `2,079` | `0` | `0.029200162` |
| `lpUser` | `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07` | `0` | `1,000` | `0` | `0.029483333` |
| `sink` | `0x0bbb7Cd5aD8310f98Ef5832807B48a1768610a07` | `0` | `10` | `0` | `0.03` |
| `StakingPool` | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | `29,358.12` | `29,366.12` | `0` | `0` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `151,750.379463482746921` | `152,782.379463482746921` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `80,810.020000000000000001` | `80,902.020000000000000001` | `0` | `0` |

## Transactions
### TX-01 `SEED_BNB_bettor`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `01538052a4a0f8b65a8813c718be49e1f4e7f94d74856ad023742bc4f49e6af9`
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
- tx_hash: `69e6e4bbb32c40b65cc1fc31c5e2d4291a9aa11e730b6b2fe34c7f175a02477f`
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
- tx_hash: `4436a3da97bbd699662d0f70447b4fd71a51a25fc0c7b42d9a1558bfc87e82c2`
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
- tx_hash: `432148c0663d06f686c48fa1ae389a3a1cf8335e9aaaca43b2d3e7635de4a793`
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
  - `to`: `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
  - `value`: `2000000000000000000000`

### TX-05 `SEED_ODD_lpUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `08c6396445bf53a2e325e1a1f5208868048f97c7bed88c6fccc76c872571d313`
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
  - `to`: `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07`
  - `value`: `2000000000000000000000`

### TX-06 `APPROVE_BETTOR_BETTING`
- sender: `bettor` / `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
- tx_hash: `6efba2664cbaf3fb527fc839ead5df219f7899577bb424e1aa1dda02b7f09b6c`
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
  - `owner`: `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
  - `spender`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-07 `APPROVE_LP_LIQUIDITY`
- sender: `lpUser` / `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07`
- tx_hash: `0e2ca678fe83bd4ed5c73e12cbb4ee437a198167d9e4a2ddc9fb6503c1c8df84`
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
  - `owner`: `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07`
  - `spender`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-08 `OPEN_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `352bcd848aa61c07622be2f6c6074a17e38cc9b0313d2c91781c1343bb32d60e`
- status: `1`
- gas_used: `475626`
- effective_gas_price: `1000000000` wei
- tx_fee: `475626000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000475626` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `MatchPoolOpened`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `poolId`: `48356349773621782331201482276227481763726193842893791254056895030168088092176`
  - `matchEndTime`: `1780923593`
  - `depositCloseAt`: `1780923413`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `poolId`: `48356349773621782331201482276227481763726193842893791254056895030168088092176`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `119541427429335754791000`
  - `totalActiveDepositedAfter`: `140776000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `25275000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` `MarketOpened`
  - `marketId`: `b'\xc5\x05\xec\xbb\x7f?\xdf\xbf\xbc\xdcNo\xf5\xed\xc9MN_\\\x97_\xd6\x0e\x17\xb0\x8397\xa8!u\x11'`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `marketType`: `1`
  - `line`: `0`
  - `matchStartTime`: `1780923413`
  - `lockAt`: `1780923593`
  - `quoteVersion`: `1`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\xc5\x05\xec\xbb\x7f?\xdf\xbf\xbc\xdcNo\xf5\xed\xc9MN_\\\x97_\xd6\x0e\x17\xb0\x8397\xa8!u\x11'`
  - `updatedAt`: `1780923004`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-09 `DEPOSIT_MATCH_LP`
- sender: `lpUser` / `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07`
- tx_hash: `26850f700b6f9177ac4f738c17bba37d33d81b3cbb09f2dace781f8a360d0d8a`
- status: `1`
- gas_used: `263724`
- effective_gas_price: `1000000000` wei
- tx_fee: `263724000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.002478722` |
| `bettor` | `0` | `0` |
| `lpUser` | `-1,000` | `-0.000263724` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `1,000` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `1000000000000000000000`
- `LiquidityPool` `LiquidityDeposited`
  - `positionId`: `59`
  - `poolId`: `48356349773621782331201482276227481763726193842893791254056895030168088092176`
  - `user`: `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07`
  - `amount`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
  - `planId`: `0`
  - `unlockAt`: `1780923593`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `poolId`: `48356349773621782331201482276227481763726193842893791254056895030168088092176`
  - `positionId`: `59`
  - `actionKind`: `1`
  - `requestableLiquidityAfter`: `120541427429335754791000`
  - `totalActiveDepositedAfter`: `141776000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `25275000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`

### TX-10 `PLACE_BET`
- sender: `bettor` / `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
- tx_hash: `818209a91942f9b2c69d82412794a68ef875925cc83710db33c1509bb58d38b1`
- status: `1`
- gas_used: `533178`
- effective_gas_price: `1000000000` wei
- tx_fee: `533178000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `1` | `0` |
| `bettor` | `-101` | `-0.000533178` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `100` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
  - `to`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `101000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `1000000000000000000`
- `BettingPool` `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\xb5'`
  - `marketId`: `b'\xc5\x05\xec\xbb\x7f?\xdf\xbf\xbc\xdcNo\xf5\xed\xc9MN_\\\x97_\xd6\x0e\x17\xb0\x8397\xa8!u\x11'`
  - `user`: `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
  - `requestedAmount`: `100000000000000000000`
  - `acceptedAmount`: `100000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\xc5\x05\xec\xbb\x7f?\xdf\xbf\xbc\xdcNo\xf5\xed\xc9MN_\\\x97_\xd6\x0e\x17\xb0\x8397\xa8!u\x11'`
  - `updatedAt`: `1780923004`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-11 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `99e50fddc011a61e87e460f3059c02022f0850f880aaa35b43634d72c33763b4`
- status: `1`
- gas_used: `256289`
- effective_gas_price: `1000000000` wei
- tx_fee: `256289000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000256289` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `BettingPool` `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'\xc5\x05\xec\xbb\x7f?\xdf\xbf\xbc\xdcNo\xf5\xed\xc9MN_\\\x97_\xd6\x0e\x17\xb0\x8397\xa8!u\x11'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `1`
  - `totalBetCount`: `1`

### TX-12 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `b8ad90fc814a00d726ed3a46569b6bc6fb1cc3187380a29abc57ac18a5ceb46c`
- status: `1`
- gas_used: `318760`
- effective_gas_price: `1000000000` wei
- tx_fee: `318760000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.003241183` |
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
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `lpMarginShare`: `8000000000000000000`
  - `globalShare`: `7836734693877551020`
  - `matchShare`: `163265306122448980`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `poolId`: `48356349773621782331201482276227481763726193842893791254056895030168088092176`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `120549427429335754791000`
  - `totalActiveDepositedAfter`: `141776000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `25275000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `PlatformReserveUpdated`
  - `delta`: `2000000000000000000`
  - `newBalance`: `31087760000000000000001`
  - `reason`: `4`
- `LiquidityPool` `PayoutLiquidityReserved`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `reservedAmount`: `200000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1780923636`
- `LiquidityPool` `PayoutReserveOutstanding`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `outstandingAmount`: `200000000000000000000`
- `LiquidityPool` `LossDistributed`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `lpLossBooked`: `200000000000000000000`
  - `globalLossShare`: `195918367346938775510`
  - `matchLossShare`: `4081632653061224490`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `poolId`: `48356349773621782331201482276227481763726193842893791254056895030168088092176`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `120349427429335754791000`
  - `totalActiveDepositedAfter`: `141776000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `25475000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `MarketFinalResultRecorded`
  - `marketId`: `b'\xc5\x05\xec\xbb\x7f?\xdf\xbf\xbc\xdcNo\xf5\xed\xc9MN_\\\x97_\xd6\x0e\x17\xb0\x8397\xa8!u\x11'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
- `BettingPool` `MarketSettlementFinalized`
  - `marketId`: `b'\xc5\x05\xec\xbb\x7f?\xdf\xbf\xbc\xdcNo\xf5\xed\xc9MN_\\\x97_\xd6\x0e\x17\xb0\x8397\xa8!u\x11'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `200000000000000000000`
  - `lpMarginShare`: `8000000000000000000`
  - `platformMarginShare`: `2000000000000000000`
  - `quoteVersion`: `3`

### TX-13 `CLAIM_PAYOUT`
- sender: `bettor` / `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
- tx_hash: `ef4a7c5f6560ba8083d780cd8efb7f954f15837d13afbeb2958a690b377ff498`
- status: `1`
- gas_used: `156944`
- effective_gas_price: `1000000000` wei
- tx_fee: `156944000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `4` | `0` |
| `bettor` | `190` | `-0.000156944` |
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
  - `newAccRewardPerShare`: `143975302041148017`
- `StakingPool` `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `20850000000000000000000`
  - `accountedOddBalanceAfter`: `29362120000000000000000`
  - `accRewardPerShareAfter`: `143975302041148017`
- `BettingPool` `LpLossOffsetApplied`
  - `amount`: `2000000000000000000`
  - `remainingOffset`: `25093940000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `4000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
  - `value`: `190000000000000000000`
- `BettingPool` `BetClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\xb5'`
  - `marketId`: `b'\xc5\x05\xec\xbb\x7f?\xdf\xbf\xbc\xdcNo\xf5\xed\xc9MN_\\\x97_\xd6\x0e\x17\xb0\x8397\xa8!u\x11'`
  - `user`: `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
  - `payout`: `190000000000000000000`
  - `executor`: `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
- `BettingPool` `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\xb5'`
  - `user`: `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
  - `grossPayout`: `200000000000000000000`
  - `taxAmount`: `10000000000000000000`
  - `netPayout`: `190000000000000000000`

### TX-14 `REQUEST_UNBOND_MATCH_LP`
- sender: `lpUser` / `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07`
- tx_hash: `4278e0e4df4980d5f13a03e7105cbe1e00d417d151b259bbb89e972eb60cd284`
- status: `1`
- gas_used: `201787`
- effective_gas_price: `1000000000` wei
- tx_fee: `201787000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000397192` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `-0.000201787` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `UnbondRequested`
  - `positionId`: `59`
  - `user`: `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07`
  - `unbondingEpoch`: `169`
  - `frozenRewardPerWeight`: `163265306122448`
  - `frozenLossPerPrincipal`: `4081632653061224`
- `LiquidityPool` `LiquidityPositionStateChanged`
  - `positionId`: `59`
  - `user`: `0x360C843339b6F9C6BffAAA34dfe98BEaCd28eD07`
  - `previousState`: `0`
  - `newState`: `1`
  - `principal`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'j\xe8\xb9\\\r\x15\x07D\'\xf6"ET\x10C5\xf5\x10\xf1Wo&X\xf4;\x10\x03c\xdf\xc6\x1e\x10'`
  - `poolId`: `48356349773621782331201482276227481763726193842893791254056895030168088092176`
  - `positionId`: `59`
  - `actionKind`: `6`
  - `requestableLiquidityAfter`: `119361345796682693567000`
  - `totalActiveDepositedAfter`: `140776000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `25475000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`

### TX-15 `USER_WITHDRAW_ODD_TO_SINK`
- sender: `bettor` / `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
- tx_hash: `db93017f973dddee96431a9449797c5ac0660d3aa39f354548d8e4f6447fea83`
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
  - `from`: `0xcd70eA7FE1aD7711F101656832Cc76F25573992f`
  - `to`: `0x0bbb7Cd5aD8310f98Ef5832807B48a1768610a07`
  - `value`: `10000000000000000000`
