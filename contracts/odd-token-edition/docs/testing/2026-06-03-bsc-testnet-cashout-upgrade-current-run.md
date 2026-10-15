# 2026-06-03 BSC Testnet Cash Out Upgrade Report (current-run)

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `111170007`
- suiteFinishedAtBlock: `111170919`
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
- [PASS] `CASHOUT_OPEN_MARKET_status`: status=1, tx=8da3c711058ed1b2e86613ecd1c735e2e1cac6cd30c9063819c3a37e30959ada
- [PASS] `CASHOUT_PLACE_BET_status`: status=1, tx=0e4a890c7be7a35924be9bd22c7ccdd1cb6181f99ca9a25893f7970691b7fc1f
- [PASS] `CASHOUT_BEFORE_LOCK_status`: status=1, tx=47fe39d76fce5e86c3c8c086f6bc1162d49f8c2192f890ea75878132654b36b9
- [PASS] `CASHOUT_event_present`: BetCashedOut emitted
- [PASS] `CASHOUT_amount_positive`: cashOutAmount=80000000000000000000
- [PASS] `CASHOUT_balance_delta`: expected delta=80000000000000000000, got=80000000000000000000
- [PASS] `CASHOUT_bet_state`: state=CashedOut
- [PASS] `LOCKED_OPEN_MARKET_status`: status=1, tx=4cc2c50b1e7f2f5fa835032843b42988ce13ae975635e3190bb4ce638a805fa1
- [PASS] `LOCKED_PLACE_WINNER_BET_status`: status=1, tx=eb5d1f9a44ec96ab5388aa5064f8ea838fbe1cbcd226ee4e82c32cf61b0baa09
- [PASS] `LOCKED_PLACE_LOSER_BET_status`: status=1, tx=d2279073d675eab1d73de8f0a9f6ccbbc0100cc767aeb5a64dce5bd3840f624d
- [PASS] `LOCKED_LOCK_MARKET_status`: status=1, tx=a120dbe0e4209c4464b1d23566e92a0db65b48a7733d04325437f3b32780036c
- [PASS] `LOCKED_market_status_after_lock`: status=Locked
- [PASS] `LOCKED_cashout_eth_call_reverts`: ('0x7275284289f6602aca76df404087fc475a517c63b9f14a72336a431ba13321363ac5f220', '0x7275284289f6602aca76df404087fc475a517c63b9f14a72336a431ba13321363ac5f220')
- [PASS] `LOCKED_CASHOUT_REVERT_TX_status`: status=0, tx=a8d3967f34b8bf658f1cfb1c3fc13595242191ac0bad846ef2038d0ed3efe207
- [PASS] `LOCKED_winner_state_still_pending`: state=Pending
- [PASS] `CASHOUT_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=ed42248d0b3bd21a7370654cbd378ee073ec14e7944131ad61a46d82204cd35c
- [PASS] `CASHOUT_MARKET_FINALIZE_status`: status=1, tx=16b5a7c98f6d2dc21de09442853983e744877b82e4e32fa1745c669bfc58278e
- [PASS] `CASHOUT_market_settled`: status=Settled
- [PASS] `CASHOUT_bet_state_after_settlement`: state=CashedOut
- [PASS] `LOCKED_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=2a2a8fd1ea6be476c9c3fda99174e99d027cc8828d6fcf522f6ae0f9323cf145
- [PASS] `LOCKED_MARKET_FINALIZE_status`: status=1, tx=b4588061c2eb06d2a16001e2285c5b7cccb7c70722c4c7a03adf0f7e3a7c84b4
- [PASS] `LOCKED_market_settled`: status=Settled
- [PASS] `LOCKED_WINNER_CLAIM_PAYOUT_status`: status=1, tx=74dda5e5b607f880416dbfedb00da9ad3b3d27dc891eed1311321227492ddbff
- [PASS] `LOCKED_claim_status`: 74dda5e5b607f880416dbfedb00da9ad3b3d27dc891eed1311321227492ddbff
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
| 1 | `CASHOUT_OPEN_MARKET` | `admin` | `8da3c711058ed1b2e86613ecd1c735e2e1cac6cd30c9063819c3a37e30959ada` | `1` | `520187` |
| 2 | `CASHOUT_PLACE_BET` | `cashoutUser` | `0e4a890c7be7a35924be9bd22c7ccdd1cb6181f99ca9a25893f7970691b7fc1f` | `1` | `494837` |
| 3 | `CASHOUT_BEFORE_LOCK` | `cashoutUser` | `47fe39d76fce5e86c3c8c086f6bc1162d49f8c2192f890ea75878132654b36b9` | `1` | `193777` |
| 4 | `LOCKED_OPEN_MARKET` | `admin` | `4cc2c50b1e7f2f5fa835032843b42988ce13ae975635e3190bb4ce638a805fa1` | `1` | `520187` |
| 5 | `LOCKED_PLACE_WINNER_BET` | `lockedWinner` | `eb5d1f9a44ec96ab5388aa5064f8ea838fbe1cbcd226ee4e82c32cf61b0baa09` | `1` | `494837` |
| 6 | `LOCKED_PLACE_LOSER_BET` | `lockedLoser` | `d2279073d675eab1d73de8f0a9f6ccbbc0100cc767aeb5a64dce5bd3840f624d` | `1` | `490859` |
| 7 | `LOCKED_LOCK_MARKET` | `admin` | `a120dbe0e4209c4464b1d23566e92a0db65b48a7733d04325437f3b32780036c` | `1` | `88557` |
| 8 | `LOCKED_CASHOUT_REVERT_TX` | `lockedWinner` | `a8d3967f34b8bf658f1cfb1c3fc13595242191ac0bad846ef2038d0ed3efe207` | `0` | `53026` |
| 9 | `CASHOUT_MARKET_SETTLE_BY_SCORE` | `admin` | `ed42248d0b3bd21a7370654cbd378ee073ec14e7944131ad61a46d82204cd35c` | `1` | `135644` |
| 10 | `CASHOUT_MARKET_FINALIZE` | `admin` | `16b5a7c98f6d2dc21de09442853983e744877b82e4e32fa1745c669bfc58278e` | `1` | `85414` |
| 11 | `LOCKED_MARKET_SETTLE_BY_SCORE` | `admin` | `2a2a8fd1ea6be476c9c3fda99174e99d027cc8828d6fcf522f6ae0f9323cf145` | `1` | `312948` |
| 12 | `LOCKED_MARKET_FINALIZE` | `admin` | `b4588061c2eb06d2a16001e2285c5b7cccb7c70722c4c7a03adf0f7e3a7c84b4` | `1` | `238671` |
| 13 | `LOCKED_WINNER_CLAIM_PAYOUT` | `lockedWinner` | `74dda5e5b607f880416dbfedb00da9ad3b3d27dc891eed1311321227492ddbff` | `1` | `156372` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,461,119` | `98,461,126` | `10.0307254681555412` | `10.0288238601555412` |
| `cashoutUser` | `0x21851feCa624db4E1cba2520864b7566d3371A51` | `1,845` | `1,824` | `0.076777262` | `0.076088648` |
| `lockedWinner` | `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e` | `2,166` | `2,255` | `0.077243462` | `0.076539227` |
| `lockedLoser` | `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617` | `1,596` | `1,495` | `0.077940582` | `0.077449723` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `52,791` | `52,797` | `0` | `0` |