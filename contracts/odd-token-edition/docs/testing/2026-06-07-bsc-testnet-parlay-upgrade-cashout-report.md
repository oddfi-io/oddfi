# 2026-06-07 BSC Testnet Parlay Upgrade Cash Out Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `111876798`
- suiteFinishedAtBlock: `111877665`
- checks: `27 passed / 0 failed`

## Contracts
- ODDToken: `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0`
- BettingPool: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`

## Scenarios
- 下注 -> 提前撤 -> 比赛结束 -> 空 betIds 记分结算 -> finalize；提前撤注单保持 `CashedOut`。
- 下注 -> `lockMarket` -> 提前撤 `eth_call` 与真实交易均失败 -> 比赛结束 -> 记分结算 -> 胜方 `claimPayout`。

## Actors
- `admin`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- `cashoutUser`: `0x21851feCa624db4E1cba2520864b7566d3371A51`
- `lockedWinner`: `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e`
- `lockedLoser`: `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617`

## Checks
- [PASS] `CASHOUT_OPEN_MARKET_status`: status=1, tx=efe21b879d6f6e4edfd9cc1574f282f68b3447ab03e8b75c3060252cbec429d4
- [PASS] `CASHOUT_PLACE_BET_status`: status=1, tx=28a092d1621fb88158bc6c4486136147c72c8fff68ab94c188f9e5f77504ae04
- [PASS] `CASHOUT_BEFORE_LOCK_status`: status=1, tx=f0e7781b491392914207d56c26c6921d67aae49e9ae96f09ee74184a57ac129d
- [PASS] `CASHOUT_event_present`: BetCashedOut emitted
- [PASS] `CASHOUT_amount_positive`: cashOutAmount=80000000000000000000
- [PASS] `CASHOUT_balance_delta`: expected delta=80000000000000000000, got=80000000000000000000
- [PASS] `CASHOUT_bet_state`: state=CashedOut
- [PASS] `LOCKED_OPEN_MARKET_status`: status=1, tx=80b9b09681508f1a40fcdd48400c99d8af3b339d6e7dde324fff17f66264b444
- [PASS] `LOCKED_PLACE_WINNER_BET_status`: status=1, tx=f0ee9ef61687a019907c37b552197d7da2a2cc631c4f6d018d8e1c717d1be2b7
- [PASS] `LOCKED_PLACE_LOSER_BET_status`: status=1, tx=800211f47a1458baaaf5641e4ed5c53053dcac16f10e9c24ff523ec1dfe847fd
- [PASS] `LOCKED_LOCK_MARKET_status`: status=1, tx=a42d1b751724909dac41885d0eb0da5a8c0f35dd50a473031baae242b2fe4ca1
- [PASS] `LOCKED_market_status_after_lock`: status=Locked
- [PASS] `LOCKED_cashout_eth_call_reverts`: ('0x72752842d034011ac4132934d13b2c3ad5d6fc45c3e1b90b2540c335876f0799ebf1abaa', '0x72752842d034011ac4132934d13b2c3ad5d6fc45c3e1b90b2540c335876f0799ebf1abaa')
- [PASS] `LOCKED_CASHOUT_REVERT_TX_status`: status=0, tx=6f5a55ff433bc2cc43603cfc05c3b7b3040a8b98560bad128172d0a0deb0325a
- [PASS] `LOCKED_winner_state_still_pending`: state=Pending
- [PASS] `CASHOUT_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=597d87c6955fed2c33050a41077c6e4e2f95b9acb1c1a538d656b16c412fae09
- [PASS] `CASHOUT_MARKET_FINALIZE_status`: status=1, tx=3c06401c78f1ee7d748d69afd4b4009f03bbfc17237376180e0cff3cca95536a
- [PASS] `CASHOUT_market_settled`: status=Settled
- [PASS] `CASHOUT_bet_state_after_settlement`: state=CashedOut
- [PASS] `LOCKED_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=79fdc21bd6b8af70dfa0a997197c9cf3019f45f9fb9423ba4e85b8c3771b2e05
- [PASS] `LOCKED_MARKET_FINALIZE_status`: status=1, tx=51fcbd5b91ad93d6fc4c4b4543edbda5137c856d9f8b98bb3c7a5a15971ce06a
- [PASS] `LOCKED_market_settled`: status=Settled
- [PASS] `LOCKED_WINNER_CLAIM_PAYOUT_status`: status=1, tx=f673e0989e58efc5e7a64df2b756b11101d6e65324af47c1d2ee4a517419a91c
- [PASS] `LOCKED_claim_status`: f673e0989e58efc5e7a64df2b756b11101d6e65324af47c1d2ee4a517419a91c
- [PASS] `LOCKED_claim_delta_positive`: delta=190000000000000000000
- [PASS] `LOCKED_winner_state_claimed`: state=WonClaimed
- [PASS] `LOCKED_loser_state_lost`: state=Lost

## Live Finding
- Pre-lock Cash Out succeeded on BSC Testnet in this run.

## Issues
- No Cash Out functional issues found in this run.

## Transactions
| # | label | actor | tx | status | gas |
|---:|---|---|---|---:|---:|
| 1 | `CASHOUT_OPEN_MARKET` | `admin` | `efe21b879d6f6e4edfd9cc1574f282f68b3447ab03e8b75c3060252cbec429d4` | `1` | `520234` |
| 2 | `CASHOUT_PLACE_BET` | `cashoutUser` | `28a092d1621fb88158bc6c4486136147c72c8fff68ab94c188f9e5f77504ae04` | `1` | `492171` |
| 3 | `CASHOUT_BEFORE_LOCK` | `cashoutUser` | `f0e7781b491392914207d56c26c6921d67aae49e9ae96f09ee74184a57ac129d` | `1` | `194261` |
| 4 | `LOCKED_OPEN_MARKET` | `admin` | `80b9b09681508f1a40fcdd48400c99d8af3b339d6e7dde324fff17f66264b444` | `1` | `520234` |
| 5 | `LOCKED_PLACE_WINNER_BET` | `lockedWinner` | `f0ee9ef61687a019907c37b552197d7da2a2cc631c4f6d018d8e1c717d1be2b7` | `1` | `492171` |
| 6 | `LOCKED_PLACE_LOSER_BET` | `lockedLoser` | `800211f47a1458baaaf5641e4ed5c53053dcac16f10e9c24ff523ec1dfe847fd` | `1` | `488193` |
| 7 | `LOCKED_LOCK_MARKET` | `admin` | `a42d1b751724909dac41885d0eb0da5a8c0f35dd50a473031baae242b2fe4ca1` | `1` | `88910` |
| 8 | `LOCKED_CASHOUT_REVERT_TX` | `lockedWinner` | `6f5a55ff433bc2cc43603cfc05c3b7b3040a8b98560bad128172d0a0deb0325a` | `0` | `53558` |
| 9 | `CASHOUT_MARKET_SETTLE_BY_SCORE` | `admin` | `597d87c6955fed2c33050a41077c6e4e2f95b9acb1c1a538d656b16c412fae09` | `1` | `135792` |
| 10 | `CASHOUT_MARKET_FINALIZE` | `admin` | `3c06401c78f1ee7d748d69afd4b4009f03bbfc17237376180e0cff3cca95536a` | `1` | `111098` |
| 11 | `LOCKED_MARKET_SETTLE_BY_SCORE` | `admin` | `79fdc21bd6b8af70dfa0a997197c9cf3019f45f9fb9423ba4e85b8c3771b2e05` | `1` | `313347` |
| 12 | `LOCKED_MARKET_FINALIZE` | `admin` | `51fcbd5b91ad93d6fc4c4b4543edbda5137c856d9f8b98bb3c7a5a15971ce06a` | `1` | `271288` |
| 13 | `LOCKED_WINNER_CLAIM_PAYOUT` | `lockedWinner` | `f673e0989e58efc5e7a64df2b756b11101d6e65324af47c1d2ee4a517419a91c` | `1` | `156768` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,425,182` | `98,425,189` | `9.7585646465555412` | `9.7566037435555412` |
| `cashoutUser` | `0x21851feCa624db4E1cba2520864b7566d3371A51` | `1,803` | `1,782` | `0.075402834` | `0.074716402` |
| `lockedWinner` | `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e` | `2,344` | `2,433` | `0.075837792` | `0.075135295` |
| `lockedLoser` | `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617` | `1,394` | `1,293` | `0.076961664` | `0.076473471` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `63,244` | `63,250` | `0` | `0` |
