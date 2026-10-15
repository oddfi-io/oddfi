# 2026-06-03 BSC Testnet Cash Out Upgrade Report (ttl30-run2)

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `111149823`
- suiteFinishedAtBlock: `111150742`
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
- [PASS] `CASHOUT_OPEN_MARKET_status`: status=1, tx=c0ea9a82997305adbecb0d35030a01834d589045b578ddda9baad41f1c62293d
- [PASS] `CASHOUT_PLACE_BET_status`: status=1, tx=d8c6ed657e6ce087bfdde0580ce43983832b71c7fe28433a44965d668c2c72a9
- [PASS] `CASHOUT_BEFORE_LOCK_status`: status=1, tx=68a0400a9e4fa62675050b52a370cf2c18ccd91719b9d4f3ce033ecd575c37df
- [PASS] `CASHOUT_event_present`: BetCashedOut emitted
- [PASS] `CASHOUT_amount_positive`: cashOutAmount=80000000000000000000
- [PASS] `CASHOUT_balance_delta`: expected delta=80000000000000000000, got=80000000000000000000
- [PASS] `CASHOUT_bet_state`: state=CashedOut
- [PASS] `LOCKED_OPEN_MARKET_status`: status=1, tx=50cffcdfc791ca7d4fa07a4af299873b6f46abdf2b261b1ba0a417cc018ced73
- [PASS] `LOCKED_PLACE_WINNER_BET_status`: status=1, tx=3c540ea12c26f22870e2c50b87556aaab509dac7e9e3176f51093934e669840c
- [PASS] `LOCKED_PLACE_LOSER_BET_status`: status=1, tx=fcae576e5188a5edd338186cf8228b9cace5944cbb392fd65cfaff6062d34b42
- [PASS] `LOCKED_LOCK_MARKET_status`: status=1, tx=df24940fba6e38ba65dc2aa6f1699db2c46b002ccadcf9e38388c1e43bb5fbe4
- [PASS] `LOCKED_market_status_after_lock`: status=Locked
- [PASS] `LOCKED_cashout_eth_call_reverts`: ('0x7275284238e645ff3ef26461d04342106b483f1fb7fe3555cc348b8caa9564a259fde209', '0x7275284238e645ff3ef26461d04342106b483f1fb7fe3555cc348b8caa9564a259fde209')
- [PASS] `LOCKED_CASHOUT_REVERT_TX_status`: status=0, tx=44e884e3a5d3899af56e7e4bd8f97bafa2b6ddfca9b9f64551af01973699a61c
- [PASS] `LOCKED_winner_state_still_pending`: state=Pending
- [PASS] `CASHOUT_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=351730d0b1991186cfb6668881a57085e26f5d54974bcc40fcc9d509a397d340
- [PASS] `CASHOUT_MARKET_FINALIZE_status`: status=1, tx=3e519a050ae6e4f82bcaa6379bfc4a312f49dab7e74179f385fa7d1fe103d056
- [PASS] `CASHOUT_market_settled`: status=Settled
- [PASS] `CASHOUT_bet_state_after_settlement`: state=CashedOut
- [PASS] `LOCKED_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=6e8997d0e7b371be7d28443ecfbeba7ad69678b41e4fc0f46e6a01ad557076a3
- [PASS] `LOCKED_MARKET_FINALIZE_status`: status=1, tx=32e3e14c1595e99ab9c62b096f7c4f761f315e635cbbfe4e4e85f4fd7f23c80f
- [PASS] `LOCKED_market_settled`: status=Settled
- [PASS] `LOCKED_WINNER_CLAIM_PAYOUT_status`: status=1, tx=d4ef3fc969a219e63490836ae17b189d062e5d43551f16a345aa6dcd5ad6b5c0
- [PASS] `LOCKED_claim_status`: d4ef3fc969a219e63490836ae17b189d062e5d43551f16a345aa6dcd5ad6b5c0
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
| 1 | `CASHOUT_OPEN_MARKET` | `admin` | `c0ea9a82997305adbecb0d35030a01834d589045b578ddda9baad41f1c62293d` | `1` | `520187` |
| 2 | `CASHOUT_PLACE_BET` | `cashoutUser` | `d8c6ed657e6ce087bfdde0580ce43983832b71c7fe28433a44965d668c2c72a9` | `1` | `491600` |
| 3 | `CASHOUT_BEFORE_LOCK` | `cashoutUser` | `68a0400a9e4fa62675050b52a370cf2c18ccd91719b9d4f3ce033ecd575c37df` | `1` | `193777` |
| 4 | `LOCKED_OPEN_MARKET` | `admin` | `50cffcdfc791ca7d4fa07a4af299873b6f46abdf2b261b1ba0a417cc018ced73` | `1` | `520187` |
| 5 | `LOCKED_PLACE_WINNER_BET` | `lockedWinner` | `3c540ea12c26f22870e2c50b87556aaab509dac7e9e3176f51093934e669840c` | `1` | `491600` |
| 6 | `LOCKED_PLACE_LOSER_BET` | `lockedLoser` | `fcae576e5188a5edd338186cf8228b9cace5944cbb392fd65cfaff6062d34b42` | `1` | `487622` |
| 7 | `LOCKED_LOCK_MARKET` | `admin` | `df24940fba6e38ba65dc2aa6f1699db2c46b002ccadcf9e38388c1e43bb5fbe4` | `1` | `88557` |
| 8 | `LOCKED_CASHOUT_REVERT_TX` | `lockedWinner` | `44e884e3a5d3899af56e7e4bd8f97bafa2b6ddfca9b9f64551af01973699a61c` | `0` | `53026` |
| 9 | `CASHOUT_MARKET_SETTLE_BY_SCORE` | `admin` | `351730d0b1991186cfb6668881a57085e26f5d54974bcc40fcc9d509a397d340` | `1` | `135644` |
| 10 | `CASHOUT_MARKET_FINALIZE` | `admin` | `3e519a050ae6e4f82bcaa6379bfc4a312f49dab7e74179f385fa7d1fe103d056` | `1` | `85414` |
| 11 | `LOCKED_MARKET_SETTLE_BY_SCORE` | `admin` | `6e8997d0e7b371be7d28443ecfbeba7ad69678b41e4fc0f46e6a01ad557076a3` | `1` | `312948` |
| 12 | `LOCKED_MARKET_FINALIZE` | `admin` | `32e3e14c1595e99ab9c62b096f7c4f761f315e635cbbfe4e4e85f4fd7f23c80f` | `1` | `238671` |
| 13 | `LOCKED_WINNER_CLAIM_PAYOUT` | `lockedWinner` | `d4ef3fc969a219e63490836ae17b189d062e5d43551f16a345aa6dcd5ad6b5c0` | `1` | `156372` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,485,073` | `98,485,080` | `10.1459002687555412` | `10.1439986607555412` |
| `cashoutUser` | `0x21851feCa624db4E1cba2520864b7566d3371A51` | `1,866` | `1,845` | `0.077462639` | `0.076777262` |
| `lockedWinner` | `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e` | `2,077` | `2,166` | `0.07794446` | `0.077243462` |
| `lockedLoser` | `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617` | `1,697` | `1,596` | `0.078428204` | `0.077940582` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `52,858` | `52,864` | `0` | `0` |