# 2026-06-07 BSC Testnet Parlay Upgrade Cash Out Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `112179286`
- suiteFinishedAtBlock: `112180119`
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
- [PASS] `CASHOUT_OPEN_MARKET_status`: status=1, tx=8177bdc0fd3002f20e5545d322cdef2e1a8d775eef10b6d4858e560ce899d464
- [PASS] `CASHOUT_PLACE_BET_status`: status=1, tx=a72b942a7e0aca0698e7de3a07d84360ed17b53b096e3d7cda454486f9229ef4
- [PASS] `CASHOUT_BEFORE_LOCK_status`: status=1, tx=66c3f747871ec3871ac1625bec35f5beb9af913e4d3b993febcf769f37ef77aa
- [PASS] `CASHOUT_event_present`: BetCashedOut emitted
- [PASS] `CASHOUT_amount_positive`: cashOutAmount=80000000000000000000
- [PASS] `CASHOUT_balance_delta`: expected delta=80000000000000000000, got=80000000000000000000
- [PASS] `CASHOUT_bet_state`: state=CashedOut
- [PASS] `LOCKED_OPEN_MARKET_status`: status=1, tx=981ae892a5e63b6bc2061c6c8d3fbcea074b749110cf019c8bbb81e5871f608e
- [PASS] `LOCKED_PLACE_WINNER_BET_status`: status=1, tx=acddbb9c6d7099f48dd89ac2467d3afdf2bc290da73c89d0fc802c9a244581db
- [PASS] `LOCKED_PLACE_LOSER_BET_status`: status=1, tx=e647afa19ea95900690826899d427a8f5cfbb0bc06383042ffcaebf95c0d7738
- [PASS] `LOCKED_LOCK_MARKET_status`: status=1, tx=7e3b9841ac00d89557932e21026e073df8252def5241e335bbf9b4ae7dd91432
- [PASS] `LOCKED_market_status_after_lock`: status=Locked
- [PASS] `LOCKED_cashout_eth_call_reverts`: ('0x727528428d33a8053811c0ed27aba8f18b423d290e2185aa7538dfd1ffc0ab17c1c0b684', '0x727528428d33a8053811c0ed27aba8f18b423d290e2185aa7538dfd1ffc0ab17c1c0b684')
- [PASS] `LOCKED_CASHOUT_REVERT_TX_status`: status=0, tx=5d404ac7d48c8ed2a25b797aafdd1710d410aa96df5e1a5546e7ad50d2aa2c56
- [PASS] `LOCKED_winner_state_still_pending`: state=Pending
- [PASS] `CASHOUT_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=cba0c035ccf4a2f771d8357ab7884d2e2bf13255b0d386ab9a3fe5598e06515a
- [PASS] `CASHOUT_MARKET_FINALIZE_status`: status=1, tx=c25f6a46e2c0c9fe38db129dafd12c167eb1a25029efe950cc07a6f73d55d9f0
- [PASS] `CASHOUT_market_settled`: status=Settled
- [PASS] `CASHOUT_bet_state_after_settlement`: state=CashedOut
- [PASS] `LOCKED_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=34b31a0ba3e8e725b112f90171ab1a02d65b750636b8712d02724620427dc457
- [PASS] `LOCKED_MARKET_FINALIZE_status`: status=1, tx=e2000bf2d7edcff1a1f97d02155cbbd0305b60774f590cdff9580fad5a80ca0b
- [PASS] `LOCKED_market_settled`: status=Settled
- [PASS] `LOCKED_WINNER_CLAIM_PAYOUT_status`: status=1, tx=87519f3cc26a9123d7333dd3b77a17488b13f60301b19c950bf2eb51c22ca80d
- [PASS] `LOCKED_claim_status`: 87519f3cc26a9123d7333dd3b77a17488b13f60301b19c950bf2eb51c22ca80d
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
| 1 | `CASHOUT_OPEN_MARKET` | `admin` | `8177bdc0fd3002f20e5545d322cdef2e1a8d775eef10b6d4858e560ce899d464` | `1` | `525091` |
| 2 | `CASHOUT_PLACE_BET` | `cashoutUser` | `a72b942a7e0aca0698e7de3a07d84360ed17b53b096e3d7cda454486f9229ef4` | `1` | `494243` |
| 3 | `CASHOUT_BEFORE_LOCK` | `cashoutUser` | `66c3f747871ec3871ac1625bec35f5beb9af913e4d3b993febcf769f37ef77aa` | `1` | `194646` |
| 4 | `LOCKED_OPEN_MARKET` | `admin` | `981ae892a5e63b6bc2061c6c8d3fbcea074b749110cf019c8bbb81e5871f608e` | `1` | `525091` |
| 5 | `LOCKED_PLACE_WINNER_BET` | `lockedWinner` | `acddbb9c6d7099f48dd89ac2467d3afdf2bc290da73c89d0fc802c9a244581db` | `1` | `494243` |
| 6 | `LOCKED_PLACE_LOSER_BET` | `lockedLoser` | `e647afa19ea95900690826899d427a8f5cfbb0bc06383042ffcaebf95c0d7738` | `1` | `490265` |
| 7 | `LOCKED_LOCK_MARKET` | `admin` | `7e3b9841ac00d89557932e21026e073df8252def5241e335bbf9b4ae7dd91432` | `1` | `89020` |
| 8 | `LOCKED_CASHOUT_REVERT_TX` | `lockedWinner` | `5d404ac7d48c8ed2a25b797aafdd1710d410aa96df5e1a5546e7ad50d2aa2c56` | `0` | `53910` |
| 9 | `CASHOUT_MARKET_SETTLE_BY_SCORE` | `admin` | `cba0c035ccf4a2f771d8357ab7884d2e2bf13255b0d386ab9a3fe5598e06515a` | `1` | `135957` |
| 10 | `CASHOUT_MARKET_FINALIZE` | `admin` | `c25f6a46e2c0c9fe38db129dafd12c167eb1a25029efe950cc07a6f73d55d9f0` | `1` | `111208` |
| 11 | `LOCKED_MARKET_SETTLE_BY_SCORE` | `admin` | `34b31a0ba3e8e725b112f90171ab1a02d65b750636b8712d02724620427dc457` | `1` | `313498` |
| 12 | `LOCKED_MARKET_FINALIZE` | `admin` | `e2000bf2d7edcff1a1f97d02155cbbd0305b60774f590cdff9580fad5a80ca0b` | `1` | `271398` |
| 13 | `LOCKED_WINNER_CLAIM_PAYOUT` | `lockedWinner` | `87519f3cc26a9123d7333dd3b77a17488b13f60301b19c950bf2eb51c22ca80d` | `1` | `156944` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,371,841.534883720930231999` | `98,371,848.534883720930231999` | `7.9660013583555412` | `7.9640300953555412` |
| `cashoutUser` | `0x21851feCa624db4E1cba2520864b7566d3371A51` | `1,782` | `1,761` | `0.074716402` | `0.074027513` |
| `lockedWinner` | `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e` | `2,433` | `2,522` | `0.075135295` | `0.074430198` |
| `lockedLoser` | `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617` | `1,293` | `1,192` | `0.076473471` | `0.075983206` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `80,796.020000000000000001` | `80,802.020000000000000001` | `0` | `0` |