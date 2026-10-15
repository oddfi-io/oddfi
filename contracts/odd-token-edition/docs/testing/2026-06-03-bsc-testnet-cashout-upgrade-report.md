# 2026-06-03 BSC Testnet Cash Out Upgrade Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `111142642`
- suiteFinishedAtBlock: `111143636`
- checks: `21 passed / 4 failed`

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
- [PASS] `CASHOUT_OPEN_MARKET_status`: status=1, tx=49b8f71bb472bf8eb94a740ac8444b233a458c0c93516ccf5afc6d386c3b985b
- [PASS] `CASHOUT_PLACE_BET_status`: status=1, tx=33a929ab25982391d5b4d57031e59da81bcf63f08fc07c851291e3003a7b4dc8
- [FAIL] `CASHOUT_BEFORE_LOCK_status`: status=0, tx=18fe62a40df7e62d064a4fede434fb94fe9ed1cbbdb17539683641979291f2b8
- [FAIL] `CASHOUT_event_present`: BetCashedOut emitted
- [FAIL] `CASHOUT_bet_state`: state=Pending
- [PASS] `LOCKED_OPEN_MARKET_status`: status=1, tx=3deb4b165a6de5b87d4e55f373b2f4ad68f95a79ca581964d96ddd36ba85f232
- [PASS] `LOCKED_PLACE_WINNER_BET_status`: status=1, tx=52007a0f3bb29c3014504545382c19a318cf4444b5f224b7891f1bee5775211d
- [PASS] `LOCKED_PLACE_LOSER_BET_status`: status=1, tx=eaadaba431308ff14e2248a80f6c821b2cdc49ab68857cfa0349b68e51ec01d9
- [PASS] `LOCKED_LOCK_MARKET_status`: status=1, tx=fb099d060687c82d8c319ccdfc23d2d490ba06b9e5df9c6237c4fc73b3140aca
- [PASS] `LOCKED_market_status_after_lock`: status=Locked
- [PASS] `LOCKED_cashout_eth_call_reverts`: ('0x727528423a9033330969f4b26593d1a9c4e15d52dfa3951bc7c6ba2b1c683d5be3403f55', '0x727528423a9033330969f4b26593d1a9c4e15d52dfa3951bc7c6ba2b1c683d5be3403f55')
- [PASS] `LOCKED_CASHOUT_REVERT_TX_status`: status=0, tx=a46ec57c585b4082821a45525eda3e39c4cf1c516140aac983e724c3a14c44b5
- [PASS] `LOCKED_winner_state_still_pending`: state=Pending
- [PASS] `CASHOUT_MARKET_FALLBACK_SETTLE_BY_SCORE_status`: status=1, tx=645676d0abb1d943f8bd501fb9a1994fc9f85db7548b1d012d8151e6dcb821fb
- [PASS] `CASHOUT_MARKET_FALLBACK_FINALIZE_status`: status=1, tx=046f74cbaf0acae63ec31cde55b7e49c4fec01254d3fd637030f417f68f37f84
- [FAIL] `CASHOUT_success_path_skipped_after_failed_tx`: cashOut tx failed before settlement; fallback settled the pending betIds for cleanup/report continuity
- [PASS] `CASHOUT_FALLBACK_CLAIM_PAYOUT_status`: status=1, tx=ed0bcbceb3304288b05f853c9b1fda675eaee555f47750b3d76309e262077cf1
- [PASS] `LOCKED_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=2a4b01ddb4fe51b826771643c90f36885f19d361b63fbc99404c25bc38955b0f
- [PASS] `LOCKED_MARKET_FINALIZE_status`: status=1, tx=21b2fc093f1cb3b5ce97094a9cb0289bc433dd52fb56cd0403828dfffa8949f2
- [PASS] `LOCKED_market_settled`: status=Settled
- [PASS] `LOCKED_WINNER_CLAIM_PAYOUT_status`: status=1, tx=f5461c4bc33b1363e150b592afeb52afd2ece2c42b556ccccfec55c812ab5cca
- [PASS] `LOCKED_claim_status`: f5461c4bc33b1363e150b592afeb52afd2ece2c42b556ccccfec55c812ab5cca
- [PASS] `LOCKED_claim_delta_positive`: delta=190000000000000000000
- [PASS] `LOCKED_winner_state_claimed`: state=WonClaimed
- [PASS] `LOCKED_loser_state_lost`: state=Lost

## Live Finding
- Pre-lock Cash Out failed on BSC Testnet before settlement. The script uses latest chain block timestamp and manual gas to avoid local clock/estimate delays, so the remaining likely blocker is the current 5 second `CASH_OUT_QUOTE_TTL` being too tight for real RPC submission and block inclusion.

## Issues
- CASHOUT_BEFORE_LOCK_status: status=0, tx=18fe62a40df7e62d064a4fede434fb94fe9ed1cbbdb17539683641979291f2b8
- CASHOUT_event_present: BetCashedOut emitted
- CASHOUT_bet_state: state=Pending
- CASHOUT_success_path_skipped_after_failed_tx: cashOut tx failed before settlement; fallback settled the pending betIds for cleanup/report continuity

## Transactions
| # | label | actor | tx | status | gas |
|---:|---|---|---|---:|---:|
| 1 | `CASHOUT_OPEN_MARKET` | `admin` | `49b8f71bb472bf8eb94a740ac8444b233a458c0c93516ccf5afc6d386c3b985b` | `1` | `520187` |
| 2 | `CASHOUT_PLACE_BET` | `cashoutUser` | `33a929ab25982391d5b4d57031e59da81bcf63f08fc07c851291e3003a7b4dc8` | `1` | `491600` |
| 3 | `CASHOUT_BEFORE_LOCK` | `cashoutUser` | `18fe62a40df7e62d064a4fede434fb94fe9ed1cbbdb17539683641979291f2b8` | `0` | `55941` |
| 4 | `LOCKED_OPEN_MARKET` | `admin` | `3deb4b165a6de5b87d4e55f373b2f4ad68f95a79ca581964d96ddd36ba85f232` | `1` | `520187` |
| 5 | `LOCKED_PLACE_WINNER_BET` | `lockedWinner` | `52007a0f3bb29c3014504545382c19a318cf4444b5f224b7891f1bee5775211d` | `1` | `491600` |
| 6 | `LOCKED_PLACE_LOSER_BET` | `lockedLoser` | `eaadaba431308ff14e2248a80f6c821b2cdc49ab68857cfa0349b68e51ec01d9` | `1` | `487622` |
| 7 | `LOCKED_LOCK_MARKET` | `admin` | `fb099d060687c82d8c319ccdfc23d2d490ba06b9e5df9c6237c4fc73b3140aca` | `1` | `88557` |
| 8 | `LOCKED_CASHOUT_REVERT_TX` | `lockedWinner` | `a46ec57c585b4082821a45525eda3e39c4cf1c516140aac983e724c3a14c44b5` | `0` | `53014` |
| 9 | `CASHOUT_MARKET_FALLBACK_SETTLE_BY_SCORE` | `admin` | `645676d0abb1d943f8bd501fb9a1994fc9f85db7548b1d012d8151e6dcb821fb` | `1` | `271316` |
| 10 | `CASHOUT_MARKET_FALLBACK_FINALIZE` | `admin` | `046f74cbaf0acae63ec31cde55b7e49c4fec01254d3fd637030f417f68f37f84` | `1` | `240671` |
| 11 | `CASHOUT_FALLBACK_CLAIM_PAYOUT` | `cashoutUser` | `ed0bcbceb3304288b05f853c9b1fda675eaee555f47750b3d76309e262077cf1` | `1` | `156372` |
| 12 | `LOCKED_MARKET_SETTLE_BY_SCORE` | `admin` | `2a4b01ddb4fe51b826771643c90f36885f19d361b63fbc99404c25bc38955b0f` | `1` | `312948` |
| 13 | `LOCKED_MARKET_FINALIZE` | `admin` | `21b2fc093f1cb3b5ce97094a9cb0289bc433dd52fb56cd0403828dfffa8949f2` | `1` | `238671` |
| 14 | `LOCKED_WINNER_CLAIM_PAYOUT` | `lockedWinner` | `f5461c4bc33b1363e150b592afeb52afd2ece2c42b556ccccfec55c812ab5cca` | `1` | `156372` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,485,055` | `98,485,066` | `10.1537711437555412` | `10.1515786067555412` |
| `cashoutUser` | `0x21851feCa624db4E1cba2520864b7566d3371A51` | `1,798` | `1,887` | `0.078855166` | `0.078151253` |
| `lockedWinner` | `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e` | `1,899` | `1,988` | `0.079349681` | `0.078648695` |
| `lockedLoser` | `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617` | `1,899` | `1,798` | `0.079406685` | `0.078919063` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `52,972` | `52,852` | `0` | `0` |
