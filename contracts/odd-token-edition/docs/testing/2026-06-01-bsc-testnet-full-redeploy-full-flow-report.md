# 2026-06-01 BSC Testnet Full Redeploy Full Flow Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- matchId: `6e8c9e1156470c87ef5cd4e4d6caaf60924dff8f696a9d898375e550f0f58d3b`
- marketId: `f29410e1c03d6e8fde20fa4b18f7b3c24f633efb7533a12d22860785adc574a1`
- betId: `0000000000000000000000000000000000000000000000000000000000000005`
- lpPositionId: `3`
- expectedGrossPayout: `200 ODD`
- expectedPayoutTax: `10 ODD`
- expectedNetPayout: `190 ODD`

## Checks
- [PASS] `SEED_BNB_bettor_status`: status=1, tx=10b4fc470ca9fee112f7ae0987c253c64e76799666d0a9e3488c9df2e50819a0
- [PASS] `SEED_BNB_lpUser_status`: status=1, tx=b23dc925c392086c1b2dd168a0006b78e38e58f10476b102814ebee906212949
- [PASS] `SEED_BNB_sink_status`: status=1, tx=0a7f98b8cd15996d4c7b5165dfe4cc882023eeb96ed21c240d3063ce50db2ea1
- [PASS] `SEED_ODD_bettor_status`: status=1, tx=de5366a8912222b7d1d691dec69b0ef32ddd2b4742bc54b9c261a9d42944ce36
- [PASS] `SEED_ODD_lpUser_status`: status=1, tx=8a44ea5fd93842e5845249a09b7385cdbe576782de82ce994b2d376643b2f96f
- [PASS] `APPROVE_BETTOR_BETTING_status`: status=1, tx=3329eee0064238ad16ee3edbc6819c57ebc495c66fa0c133fdf96bcdfe7266c8
- [PASS] `APPROVE_LP_LIQUIDITY_status`: status=1, tx=6ce73af22243bdf7cb0610a40a069e0752a738dff87f8c7b1ff5e29e97f8ed8f
- [PASS] `OPEN_MARKET_status`: status=1, tx=119d12ebb3380f523ee1dfdf1bb3c7a37ff7717c7866f996199f14e53accdf4e
- [PASS] `DEPOSIT_MATCH_LP_status`: status=1, tx=bb0f3482955c27bf7cb3ed35fd5b502a330ec4a8cba212cfa815ad259c198af5
- [PASS] `PLACE_BET_status`: status=1, tx=252ba896b16ee4d2a784f0289803778d8018d84db7a794f382a1cf30b90db3ae
- [PASS] `SETTLE_MARKET_BETS_BY_SCORE_status`: status=1, tx=a2f9ad7c054f027eacc5dd5e8f13949e2dd3b363e8fe1f8fc0051a68712aca8a
- [PASS] `FINALIZE_MARKET_SETTLEMENT_status`: status=1, tx=67d1fdce2e9e78b6a63d773aa4813cd6db2f1b7085426ff884a1f2b20f4a6d46
- [PASS] `CLAIM_PAYOUT_status`: status=1, tx=df5af61e751be64f8a37ed2e623dfa2b57ac43672db835200397d292bab04e84
- [PASS] `CLAIM_NET_DELTA`: expected 190000000000000000000, got 190000000000000000000
- [PASS] `CLAIM_PAYOUT_TX_SUCCESS`: df5af61e751be64f8a37ed2e623dfa2b57ac43672db835200397d292bab04e84
- [PASS] `REQUEST_UNBOND_MATCH_LP_status`: status=1, tx=f5e7230a689121bcc29e51f32de62e9e2dd9c558405ac3c367fd2874931c2540
- [PASS] `WITHDRAW_MATCH_LP_WAIT_10_MIN_RULE_CONFIRMED`: not mature after 10 minutes as expected by epoch rule: ('0xc71a025400000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000004', '0xc71a025400000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000004')
- [PASS] `USER_WITHDRAW_ODD_TO_SINK_status`: status=1, tx=e13c2494caa2de3bd5ff1d11c99819aeafa5ed72153e7e63f3034e6e6d6c2e03

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `99,947,035` | `99,943,040` | `14.6498405024555412` | `14.5586047194555412` |
| `bettor` | `0x2B4063e07f5499699CD583e6108696a5989A2FFB` | `0` | `2,079` | `0` | `0.029207189` |
| `lpUser` | `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908` | `0` | `1,000` | `0` | `0.029499878` |
| `sink` | `0xD80Cd64FC49b328fa5b1eD3fc35A741605891948` | `0` | `10` | `0` | `0.03` |
| `StakingPool` | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | `1,040` | `1,044` | `0` | `0` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `6,160` | `7,168` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `4,961` | `4,855` | `0` | `0` |

## Transactions
### TX-01 `SEED_BNB_bettor`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `10b4fc470ca9fee112f7ae0987c253c64e76799666d0a9e3488c9df2e50819a0`
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
- tx_hash: `b23dc925c392086c1b2dd168a0006b78e38e58f10476b102814ebee906212949`
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
- tx_hash: `0a7f98b8cd15996d4c7b5165dfe4cc882023eeb96ed21c240d3063ce50db2ea1`
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
- tx_hash: `de5366a8912222b7d1d691dec69b0ef32ddd2b4742bc54b9c261a9d42944ce36`
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
  - `to`: `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
  - `value`: `2000000000000000000000`

### TX-05 `SEED_ODD_lpUser`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `8a44ea5fd93842e5845249a09b7385cdbe576782de82ce994b2d376643b2f96f`
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
  - `to`: `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908`
  - `value`: `2000000000000000000000`

### TX-06 `APPROVE_BETTOR_BETTING`
- sender: `bettor` / `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
- tx_hash: `3329eee0064238ad16ee3edbc6819c57ebc495c66fa0c133fdf96bcdfe7266c8`
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
  - `owner`: `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
  - `spender`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-07 `APPROVE_LP_LIQUIDITY`
- sender: `lpUser` / `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908`
- tx_hash: `6ce73af22243bdf7cb0610a40a069e0752a738dff87f8c7b1ff5e29e97f8ed8f`
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
  - `owner`: `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908`
  - `spender`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### TX-08 `OPEN_MARKET`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `119d12ebb3380f523ee1dfdf1bb3c7a37ff7717c7866f996199f14e53accdf4e`
- status: `1`
- gas_used: `471392`
- effective_gas_price: `1000000000` wei
- tx_fee: `471392000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000471392` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `MatchPoolOpened`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `poolId`: `50002862876556247703769399770841117394940677418689117001421134747225759780155`
  - `matchEndTime`: `1780319531`
  - `depositCloseAt`: `1780319351`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `poolId`: `50002862876556247703769399770841117394940677418689117001421134747225759780155`
  - `positionId`: `0`
  - `actionKind`: `2`
  - `requestableLiquidityAfter`: `5160000000000000000000`
  - `totalActiveDepositedAfter`: `6000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1000000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`
- `BettingPool` `MarketOpened`
  - `marketId`: `b'\xf2\x94\x10\xe1\xc0=n\x8f\xde \xfaK\x18\xf7\xb3\xc2Oc>\xfbu3\xa1-"\x86\x07\x85\xad\xc5t\xa1'`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `marketType`: `1`
  - `line`: `0`
  - `matchStartTime`: `1780319351`
  - `lockAt`: `1780319051`
  - `quoteVersion`: `1`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\xf2\x94\x10\xe1\xc0=n\x8f\xde \xfaK\x18\xf7\xb3\xc2Oc>\xfbu3\xa1-"\x86\x07\x85\xad\xc5t\xa1'`
  - `updatedAt`: `1780318943`
  - `quoteVersion`: `1`
  - `signal`: `0`

### TX-09 `DEPOSIT_MATCH_LP`
- sender: `lpUser` / `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908`
- tx_hash: `bb0f3482955c27bf7cb3ed35fd5b502a330ec4a8cba212cfa815ad259c198af5`
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
  - `from`: `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908`
  - `to`: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
  - `value`: `1000000000000000000000`
- `LiquidityPool` `LiquidityDeposited`
  - `positionId`: `3`
  - `poolId`: `50002862876556247703769399770841117394940677418689117001421134747225759780155`
  - `user`: `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908`
  - `amount`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
  - `planId`: `0`
  - `unlockAt`: `1780319531`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `poolId`: `50002862876556247703769399770841117394940677418689117001421134747225759780155`
  - `positionId`: `3`
  - `actionKind`: `1`
  - `requestableLiquidityAfter`: `6160000000000000000000`
  - `totalActiveDepositedAfter`: `7000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1000000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`

### TX-10 `PLACE_BET`
- sender: `bettor` / `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
- tx_hash: `252ba896b16ee4d2a784f0289803778d8018d84db7a794f382a1cf30b90db3ae`
- status: `1`
- gas_used: `531773`
- effective_gas_price: `1000000000` wei
- tx_fee: `531773000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `1` | `0` |
| `bettor` | `-101` | `-0.000531773` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `100` | `0` |

Events:
- `ODDToken` `Transfer`
  - `from`: `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
  - `to`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `value`: `101000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `1000000000000000000`
- `BettingPool` `BetPlaced`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x05'`
  - `marketId`: `b'\xf2\x94\x10\xe1\xc0=n\x8f\xde \xfaK\x18\xf7\xb3\xc2Oc>\xfbu3\xa1-"\x86\x07\x85\xad\xc5t\xa1'`
  - `user`: `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
  - `requestedAmount`: `100000000000000000000`
  - `acceptedAmount`: `100000000000000000000`
  - `lockedOdds`: `20000`
  - `quoteVersion`: `2`
  - `outcome`: `0`
- `BettingPool` `OddsUpdated`
  - `marketId`: `b'\xf2\x94\x10\xe1\xc0=n\x8f\xde \xfaK\x18\xf7\xb3\xc2Oc>\xfbu3\xa1-"\x86\x07\x85\xad\xc5t\xa1'`
  - `updatedAt`: `1780318943`
  - `quoteVersion`: `2`
  - `signal`: `0`

### TX-11 `SETTLE_MARKET_BETS_BY_SCORE`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `a2f9ad7c054f027eacc5dd5e8f13949e2dd3b363e8fe1f8fc0051a68712aca8a`
- status: `1`
- gas_used: `300082`
- effective_gas_price: `1000000000` wei
- tx_fee: `300082000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000300082` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `0` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `MatchPoolDepositClosed`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `poolId`: `50002862876556247703769399770841117394940677418689117001421134747225759780155`
  - `reason`: `0`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `poolId`: `50002862876556247703769399770841117394940677418689117001421134747225759780155`
  - `positionId`: `0`
  - `actionKind`: `3`
  - `requestableLiquidityAfter`: `6160000000000000000000`
  - `totalActiveDepositedAfter`: `7000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1000000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `MarketSettlementScoreBatchProcessed`
  - `marketId`: `b'\xf2\x94\x10\xe1\xc0=n\x8f\xde \xfaK\x18\xf7\xb3\xc2Oc>\xfbu3\xa1-"\x86\x07\x85\xad\xc5t\xa1'`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `processedCount`: `1`
  - `totalBetCount`: `1`

### TX-12 `FINALIZE_MARKET_SETTLEMENT`
- sender: `admin` / `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- tx_hash: `67d1fdce2e9e78b6a63d773aa4813cd6db2f1b7085426ff884a1f2b20f4a6d46`
- status: `1`
- gas_used: `284165`
- effective_gas_price: `1000000000` wei
- tx_fee: `284165000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `-0.000284165` |
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
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `lpMarginShare`: `8000000000000000000`
  - `globalShare`: `6857142857142857142`
  - `matchShare`: `1142857142857142858`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `poolId`: `50002862876556247703769399770841117394940677418689117001421134747225759780155`
  - `positionId`: `0`
  - `actionKind`: `4`
  - `requestableLiquidityAfter`: `6168000000000000000000`
  - `totalActiveDepositedAfter`: `7000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1000000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `PlatformReserveUpdated`
  - `delta`: `2000000000000000000`
  - `newBalance`: `5042000000000000000000`
  - `reason`: `4`
- `LiquidityPool` `PayoutLiquidityReserved`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `reservedAmount`: `200000000000000000000`
  - `paidOutAmount`: `0`
  - `settledAt`: `1780319574`
- `LiquidityPool` `LossDistributed`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `lpLossBooked`: `200000000000000000000`
  - `globalLossShare`: `171428571428571428571`
  - `matchLossShare`: `28571428571428571429`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `poolId`: `50002862876556247703769399770841117394940677418689117001421134747225759780155`
  - `positionId`: `0`
  - `actionKind`: `5`
  - `requestableLiquidityAfter`: `5968000000000000000000`
  - `totalActiveDepositedAfter`: `7000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1200000000000000000000`
  - `poolTotalDepositedAfter`: `1000000000000000000000`
  - `poolTotalWeightAfter`: `1000000000000000000000`
- `BettingPool` `MarketSettlementFinalized`
  - `marketId`: `b'\xf2\x94\x10\xe1\xc0=n\x8f\xde \xfaK\x18\xf7\xb3\xc2Oc>\xfbu3\xa1-"\x86\x07\x85\xad\xc5t\xa1'`
  - `resultKind`: `0`
  - `scoreSettled`: `True`
  - `homeScore`: `1`
  - `awayScore`: `0`
  - `grossPayout`: `200000000000000000000`
  - `lpMarginShare`: `8000000000000000000`
  - `platformMarginShare`: `2000000000000000000`
  - `quoteVersion`: `4`

### TX-13 `CLAIM_PAYOUT`
- sender: `bettor` / `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
- tx_hash: `df5af61e751be64f8a37ed2e623dfa2b57ac43672db835200397d292bab04e84`
- status: `1`
- gas_used: `151322`
- effective_gas_price: `1000000000` wei
- tx_fee: `151322000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `4` | `0` |
| `bettor` | `190` | `-0.000151322` |
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
  - `newAccRewardPerShare`: `44000000000000000`
- `StakingPool` `StakeAccountingSnapshot`
  - `positionId`: `0`
  - `user`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `actionKind`: `2`
  - `activeStakeAfter`: `0`
  - `totalWeightedSharesAfter`: `1000000000000000000000`
  - `accountedOddBalanceAfter`: `1044000000000000000000`
  - `accRewardPerShareAfter`: `44000000000000000`
- `BettingPool` `LpLossOffsetApplied`
  - `amount`: `2000000000000000000`
  - `remainingOffset`: `1178000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
  - `value`: `4000000000000000000`
- `ODDToken` `Transfer`
  - `from`: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
  - `to`: `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
  - `value`: `190000000000000000000`
- `BettingPool` `BetClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x05'`
  - `marketId`: `b'\xf2\x94\x10\xe1\xc0=n\x8f\xde \xfaK\x18\xf7\xb3\xc2Oc>\xfbu3\xa1-"\x86\x07\x85\xad\xc5t\xa1'`
  - `user`: `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
  - `payout`: `190000000000000000000`
  - `executor`: `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
- `BettingPool` `PayoutClaimed`
  - `betId`: `b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x05'`
  - `user`: `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
  - `grossPayout`: `200000000000000000000`
  - `taxAmount`: `10000000000000000000`
  - `netPayout`: `190000000000000000000`

### TX-14 `REQUEST_UNBOND_MATCH_LP`
- sender: `lpUser` / `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908`
- tx_hash: `f5e7230a689121bcc29e51f32de62e9e2dd9c558405ac3c367fd2874931c2540`
- status: `1`
- gas_used: `185396`
- effective_gas_price: `1000000000` wei
- tx_fee: `185396000000000` wei

| label | Δ ODD | Δ BNB |
|---|---:|---:|
| `admin` | `0` | `0` |
| `bettor` | `0` | `0` |
| `lpUser` | `0` | `-0.000185396` |
| `sink` | `0` | `0` |
| `StakingPool` | `0` | `0` |
| `LiquidityPool` | `0` | `0` |
| `BettingPool` | `0` | `0` |

Events:
- `LiquidityPool` `UnbondRequested`
  - `positionId`: `3`
  - `user`: `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908`
  - `unbondingEpoch`: `1`
  - `frozenRewardPerWeight`: `1142857142857142`
  - `frozenLossPerPrincipal`: `28571428571428571`
- `LiquidityPool` `LiquidityPositionStateChanged`
  - `positionId`: `3`
  - `user`: `0x2c7c86f3cA092650e00365a874Bbf6a0817eC908`
  - `previousState`: `0`
  - `newState`: `1`
  - `principal`: `1000000000000000000000`
  - `weight`: `1000000000000000000000`
- `LiquidityPool` `LiquidityAccountingSnapshot`
  - `matchId`: `b'n\x8c\x9e\x11VG\x0c\x87\xef\\\xd4\xe4\xd6\xca\xaf`\x92M\xff\x8fij\x9d\x89\x83u\xe5P\xf0\xf5\x8d;'`
  - `poolId`: `50002862876556247703769399770841117394940677418689117001421134747225759780155`
  - `positionId`: `3`
  - `actionKind`: `6`
  - `requestableLiquidityAfter`: `4995428571428571429000`
  - `totalActiveDepositedAfter`: `6000000000000000000000`
  - `totalOutstandingPayoutReservedAfter`: `1200000000000000000000`
  - `poolTotalDepositedAfter`: `0`
  - `poolTotalWeightAfter`: `0`

### TX-15 `USER_WITHDRAW_ODD_TO_SINK`
- sender: `bettor` / `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
- tx_hash: `e13c2494caa2de3bd5ff1d11c99819aeafa5ed72153e7e63f3034e6e6d6c2e03`
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
  - `from`: `0x2B4063e07f5499699CD583e6108696a5989A2FFB`
  - `to`: `0xD80Cd64FC49b328fa5b1eD3fc35A741605891948`
  - `value`: `10000000000000000000`
