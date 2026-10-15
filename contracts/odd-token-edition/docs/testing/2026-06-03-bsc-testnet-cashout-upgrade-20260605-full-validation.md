# 2026-06-03 BSC Testnet Cash Out Upgrade Report (20260605-full-validation)

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `111726110`
- suiteFinishedAtBlock: `111727025`
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
- [PASS] `CASHOUT_OPEN_MARKET_status`: status=1, tx=0f3622b9cbcd77d1d7fe1b0197727533a84e3272ea4de53ffdadf294e05f3438
- [PASS] `CASHOUT_PLACE_BET_status`: status=1, tx=74a367e78905e226b8fa95b919cf61ccf25307717ee29f1c902be828e5335744
- [PASS] `CASHOUT_BEFORE_LOCK_status`: status=1, tx=5aea51fbd60db843966c194e77e2a68201ea26cdc9ea7c71e1d694540f1c6740
- [PASS] `CASHOUT_event_present`: BetCashedOut emitted
- [PASS] `CASHOUT_amount_positive`: cashOutAmount=80000000000000000000
- [PASS] `CASHOUT_balance_delta`: expected delta=80000000000000000000, got=80000000000000000000
- [PASS] `CASHOUT_bet_state`: state=CashedOut
- [PASS] `LOCKED_OPEN_MARKET_status`: status=1, tx=eef951dbd6e23e9623b0d339afb1db744aacefce3d0f8f39cabfb6920e9658dc
- [PASS] `LOCKED_PLACE_WINNER_BET_status`: status=1, tx=c9ee6626fed589efe728838541523d0f270babda4f7220f71229f6482cf927d0
- [PASS] `LOCKED_PLACE_LOSER_BET_status`: status=1, tx=45844c1ae859e70936cb4c2831def7dc849ebd18ee17ecfb6ed8501663c54f67
- [PASS] `LOCKED_LOCK_MARKET_status`: status=1, tx=cb58d5c02f95fc39c2a5e80ea81921ccd2b9290a06e8a9ccef47373c26313024
- [PASS] `LOCKED_market_status_after_lock`: status=Locked
- [PASS] `LOCKED_cashout_eth_call_reverts`: ('0x72752842252a35b7c3f2b398ef286452ef21d7c8746046a91b4a4aa1382e21e7ff6abd5f', '0x72752842252a35b7c3f2b398ef286452ef21d7c8746046a91b4a4aa1382e21e7ff6abd5f')
- [PASS] `LOCKED_CASHOUT_REVERT_TX_status`: status=0, tx=f20d41e7f98c3dc42d7a2d5ef5b3fe627f9352f3eea16604c0b1188244f2e20e
- [PASS] `LOCKED_winner_state_still_pending`: state=Pending
- [PASS] `CASHOUT_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=bedf90908d9ffdb73cfc205c11fdcfb9553dfd5785fcb36234ffb05af60cab66
- [PASS] `CASHOUT_MARKET_FINALIZE_status`: status=1, tx=9da4965e425e5224ae354df80b3450e747e7ad0702ce13b5bccfb215295a112f
- [PASS] `CASHOUT_market_settled`: status=Settled
- [PASS] `CASHOUT_bet_state_after_settlement`: state=CashedOut
- [PASS] `LOCKED_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=b9f12e40b41663450b7acbdd8e3706ce74b7dfa4ff6cffd8c1601f70aedb82f2
- [PASS] `LOCKED_MARKET_FINALIZE_status`: status=1, tx=30f724c9019cb86bb7ad2d0a0e7b7e7c57d7a9761a7e1b0555af8e3800b8cd22
- [PASS] `LOCKED_market_settled`: status=Settled
- [PASS] `LOCKED_WINNER_CLAIM_PAYOUT_status`: status=1, tx=7cf0f2f2405367574fcc3f83257323321ed949ddae6298f881df4887fc84a436
- [PASS] `LOCKED_claim_status`: 7cf0f2f2405367574fcc3f83257323321ed949ddae6298f881df4887fc84a436
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
| 1 | `CASHOUT_OPEN_MARKET` | `admin` | `0f3622b9cbcd77d1d7fe1b0197727533a84e3272ea4de53ffdadf294e05f3438` | `1` | `520187` |
| 2 | `CASHOUT_PLACE_BET` | `cashoutUser` | `74a367e78905e226b8fa95b919cf61ccf25307717ee29f1c902be828e5335744` | `1` | `492037` |
| 3 | `CASHOUT_BEFORE_LOCK` | `cashoutUser` | `5aea51fbd60db843966c194e77e2a68201ea26cdc9ea7c71e1d694540f1c6740` | `1` | `193777` |
| 4 | `LOCKED_OPEN_MARKET` | `admin` | `eef951dbd6e23e9623b0d339afb1db744aacefce3d0f8f39cabfb6920e9658dc` | `1` | `520187` |
| 5 | `LOCKED_PLACE_WINNER_BET` | `lockedWinner` | `c9ee6626fed589efe728838541523d0f270babda4f7220f71229f6482cf927d0` | `1` | `492037` |
| 6 | `LOCKED_PLACE_LOSER_BET` | `lockedLoser` | `45844c1ae859e70936cb4c2831def7dc849ebd18ee17ecfb6ed8501663c54f67` | `1` | `488059` |
| 7 | `LOCKED_LOCK_MARKET` | `admin` | `cb58d5c02f95fc39c2a5e80ea81921ccd2b9290a06e8a9ccef47373c26313024` | `1` | `88557` |
| 8 | `LOCKED_CASHOUT_REVERT_TX` | `lockedWinner` | `f20d41e7f98c3dc42d7a2d5ef5b3fe627f9352f3eea16604c0b1188244f2e20e` | `0` | `53026` |
| 9 | `CASHOUT_MARKET_SETTLE_BY_SCORE` | `admin` | `bedf90908d9ffdb73cfc205c11fdcfb9553dfd5785fcb36234ffb05af60cab66` | `1` | `135644` |
| 10 | `CASHOUT_MARKET_FINALIZE` | `admin` | `9da4965e425e5224ae354df80b3450e747e7ad0702ce13b5bccfb215295a112f` | `1` | `85414` |
| 11 | `LOCKED_MARKET_SETTLE_BY_SCORE` | `admin` | `b9f12e40b41663450b7acbdd8e3706ce74b7dfa4ff6cffd8c1601f70aedb82f2` | `1` | `312948` |
| 12 | `LOCKED_MARKET_FINALIZE` | `admin` | `30f724c9019cb86bb7ad2d0a0e7b7e7c57d7a9761a7e1b0555af8e3800b8cd22` | `1` | `238671` |
| 13 | `LOCKED_WINNER_CLAIM_PAYOUT` | `lockedWinner` | `7cf0f2f2405367574fcc3f83257323321ed949ddae6298f881df4887fc84a436` | `1` | `156372` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,454,064` | `98,454,071` | `9.9860709041555412` | `9.9840929421555412` |
| `cashoutUser` | `0x21851feCa624db4E1cba2520864b7566d3371A51` | `1,824` | `1,803` | `0.076088648` | `0.075402834` |
| `lockedWinner` | `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e` | `2,255` | `2,344` | `0.076539227` | `0.075837792` |
| `lockedLoser` | `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617` | `1,495` | `1,394` | `0.077449723` | `0.076961664` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `53,077` | `53,083` | `0` | `0` |