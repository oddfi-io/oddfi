# 2026-06-03 BSC Testnet Cash Out Upgrade Report (ttl30-run1)

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `111148871`
- suiteFinishedAtBlock: `111149770`
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
- [PASS] `CASHOUT_OPEN_MARKET_status`: status=1, tx=8199e00d675350b10f4a34f7f893addb77af7a9bf8cafcf10f039c4f14816ec2
- [PASS] `CASHOUT_PLACE_BET_status`: status=1, tx=799a41ed2b51955734d2a0f0fdbfe75d6e3c414e7f4e7ad23985580c1204c85e
- [PASS] `CASHOUT_BEFORE_LOCK_status`: status=1, tx=1c8bcf0a4547b9f27e8c0b80176090b761f07ec9e98146cef08e3c5b96c6a786
- [PASS] `CASHOUT_event_present`: BetCashedOut emitted
- [PASS] `CASHOUT_amount_positive`: cashOutAmount=80000000000000000000
- [PASS] `CASHOUT_balance_delta`: expected delta=80000000000000000000, got=80000000000000000000
- [PASS] `CASHOUT_bet_state`: state=CashedOut
- [PASS] `LOCKED_OPEN_MARKET_status`: status=1, tx=01a1ff05b733163d536246db4b5079c0396c44c452036fbc46d1cbcbd85d1a58
- [PASS] `LOCKED_PLACE_WINNER_BET_status`: status=1, tx=b013639c4aa833a31c4e24f155171d7b1d39d25318d7e519cd43ddefd75b7582
- [PASS] `LOCKED_PLACE_LOSER_BET_status`: status=1, tx=ee6e4826541180b5057398340a393f49b444b3df286db314235e70146c3c20bf
- [PASS] `LOCKED_LOCK_MARKET_status`: status=1, tx=4b464b3ba4b8a9326bbf26524a43114c1d3b30655f89179ce5d28c64cf19be0d
- [PASS] `LOCKED_market_status_after_lock`: status=Locked
- [PASS] `LOCKED_cashout_eth_call_reverts`: ('0x72752842d2905a9e86357ae0dff713884dc308153b2c224f4c3eeaff145f1e67d9efd775', '0x72752842d2905a9e86357ae0dff713884dc308153b2c224f4c3eeaff145f1e67d9efd775')
- [PASS] `LOCKED_CASHOUT_REVERT_TX_status`: status=0, tx=e93c0f941757ab985d3fda4502c64cb98521078d5e309cd7aab20b337b2f06d8
- [PASS] `LOCKED_winner_state_still_pending`: state=Pending
- [PASS] `CASHOUT_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=ffbb26dc96e9ae2a2340208ceea961c79a60e973a42ef63fba1a14293c779eba
- [PASS] `CASHOUT_MARKET_FINALIZE_status`: status=1, tx=56edf84f69cd7f7b12f90bf6b862751da2d7f0c7b5b6103b6a426689522b960c
- [PASS] `CASHOUT_market_settled`: status=Settled
- [PASS] `CASHOUT_bet_state_after_settlement`: state=CashedOut
- [PASS] `LOCKED_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=9b10d463ca468065bb4a74a7537a2c46dc50167a06bfd25b0297af48481aafe7
- [PASS] `LOCKED_MARKET_FINALIZE_status`: status=1, tx=c898391a095b0f77abf160faf4028ea11730eb5c1dcb479392b44b1adf331139
- [PASS] `LOCKED_market_settled`: status=Settled
- [PASS] `LOCKED_WINNER_CLAIM_PAYOUT_status`: status=1, tx=cc248d4a0fb4656e75a226cdd358d57b5ba186fa8bda54893335fecbab4afdc3
- [PASS] `LOCKED_claim_status`: cc248d4a0fb4656e75a226cdd358d57b5ba186fa8bda54893335fecbab4afdc3
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
| 1 | `CASHOUT_OPEN_MARKET` | `admin` | `8199e00d675350b10f4a34f7f893addb77af7a9bf8cafcf10f039c4f14816ec2` | `1` | `520187` |
| 2 | `CASHOUT_PLACE_BET` | `cashoutUser` | `799a41ed2b51955734d2a0f0fdbfe75d6e3c414e7f4e7ad23985580c1204c85e` | `1` | `494837` |
| 3 | `CASHOUT_BEFORE_LOCK` | `cashoutUser` | `1c8bcf0a4547b9f27e8c0b80176090b761f07ec9e98146cef08e3c5b96c6a786` | `1` | `193777` |
| 4 | `LOCKED_OPEN_MARKET` | `admin` | `01a1ff05b733163d536246db4b5079c0396c44c452036fbc46d1cbcbd85d1a58` | `1` | `520187` |
| 5 | `LOCKED_PLACE_WINNER_BET` | `lockedWinner` | `b013639c4aa833a31c4e24f155171d7b1d39d25318d7e519cd43ddefd75b7582` | `1` | `494837` |
| 6 | `LOCKED_PLACE_LOSER_BET` | `lockedLoser` | `ee6e4826541180b5057398340a393f49b444b3df286db314235e70146c3c20bf` | `1` | `490859` |
| 7 | `LOCKED_LOCK_MARKET` | `admin` | `4b464b3ba4b8a9326bbf26524a43114c1d3b30655f89179ce5d28c64cf19be0d` | `1` | `88557` |
| 8 | `LOCKED_CASHOUT_REVERT_TX` | `lockedWinner` | `e93c0f941757ab985d3fda4502c64cb98521078d5e309cd7aab20b337b2f06d8` | `0` | `53026` |
| 9 | `CASHOUT_MARKET_SETTLE_BY_SCORE` | `admin` | `ffbb26dc96e9ae2a2340208ceea961c79a60e973a42ef63fba1a14293c779eba` | `1` | `135644` |
| 10 | `CASHOUT_MARKET_FINALIZE` | `admin` | `56edf84f69cd7f7b12f90bf6b862751da2d7f0c7b5b6103b6a426689522b960c` | `1` | `85414` |
| 11 | `LOCKED_MARKET_SETTLE_BY_SCORE` | `admin` | `9b10d463ca468065bb4a74a7537a2c46dc50167a06bfd25b0297af48481aafe7` | `1` | `312948` |
| 12 | `LOCKED_MARKET_FINALIZE` | `admin` | `c898391a095b0f77abf160faf4028ea11730eb5c1dcb479392b44b1adf331139` | `1` | `238671` |
| 13 | `LOCKED_WINNER_CLAIM_PAYOUT` | `lockedWinner` | `cc248d4a0fb4656e75a226cdd358d57b5ba186fa8bda54893335fecbab4afdc3` | `1` | `156372` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,485,066` | `98,485,073` | `10.1478018767555412` | `10.1459002687555412` |
| `cashoutUser` | `0x21851feCa624db4E1cba2520864b7566d3371A51` | `1,887` | `1,866` | `0.078151253` | `0.077462639` |
| `lockedWinner` | `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e` | `1,988` | `2,077` | `0.078648695` | `0.07794446` |
| `lockedLoser` | `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617` | `1,798` | `1,697` | `0.078919063` | `0.078428204` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `52,852` | `52,858` | `0` | `0` |