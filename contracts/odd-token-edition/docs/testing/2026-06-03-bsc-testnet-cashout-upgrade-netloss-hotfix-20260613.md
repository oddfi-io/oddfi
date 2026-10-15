# 2026-06-13 BSC Testnet Settlement NetLoss Hotfix Cash Out Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `113081979`
- suiteFinishedAtBlock: `113083138`
- checks: `33 passed / 0 failed`

## Contracts
- ODDToken: `0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0`
- BettingPool: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`

## Scenarios
- 下注 -> 提前撤 -> 比赛结束 -> 空 betIds 记分结算 -> finalize；提前撤注单保持 `CashedOut`。
- 下注 -> `lockMarket` -> 提前撤 `eth_call` 与真实交易均失败 -> 比赛结束 -> 记分结算 -> 胜方 `claimPayout`。

## Actors
- `admin`: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- `cashoutUser`: `0x21851feCa624db4E1cba2520864b7566d3371A51`
- `lockedWinner`: `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e`
- `lockedLoser`: `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617`

## Checks
- [PASS] `SEED_ODD_cashoutUser_status`: status=1, tx=145e9bfcb929cf250edb15e71c75a0b731a5a789ca202601109588209a9343cf
- [PASS] `APPROVE_cashoutUser_BETTING_status`: status=1, tx=0e70a06e607b2759bb36e249636c56863a447c46bb5ab38eaf62f69bd3a3e82e
- [PASS] `SEED_ODD_lockedWinner_status`: status=1, tx=cc028f234c6889410d182ac93bc15d96e09d5a4ab538e0a20d95e559b2a64b6b
- [PASS] `APPROVE_lockedWinner_BETTING_status`: status=1, tx=1373b2bbe17e06050b6e416581a07cedafc32acda047efd102ef4078c462bfa8
- [PASS] `SEED_ODD_lockedLoser_status`: status=1, tx=6b98782cc441cc6a4027bdf6974d2782dc9286bade97ef264e3365c56e7efb85
- [PASS] `APPROVE_lockedLoser_BETTING_status`: status=1, tx=6f4048858400bdf264a3132680c3f38b51dd4be52ab67bebda94d3e0b10c5790
- [PASS] `CASHOUT_OPEN_MARKET_status`: status=1, tx=cc857d40059cfdbbd149461a1a4b192f6f6bd9fdb9d8a8bdc0a1eabfb271b5fd
- [PASS] `CASHOUT_PLACE_BET_status`: status=1, tx=4a5b86e4df9c83c5158568e4f4d516478d13f73d8f09db9cdd5abbe5d5f8fa67
- [PASS] `CASHOUT_BEFORE_LOCK_status`: status=1, tx=f0b434983410917187a54507eaf6760b4421df63afe1e17775c3755f54384d23
- [PASS] `CASHOUT_event_present`: BetCashedOut emitted
- [PASS] `CASHOUT_amount_positive`: cashOutAmount=80000000000000000000
- [PASS] `CASHOUT_balance_delta`: expected delta=80000000000000000000, got=80000000000000000000
- [PASS] `CASHOUT_bet_state`: state=CashedOut
- [PASS] `LOCKED_OPEN_MARKET_status`: status=1, tx=57008f544f4000402cb361df2809a5cbb6ba8e57a73441a2b2835506da1c26a6
- [PASS] `LOCKED_PLACE_WINNER_BET_status`: status=1, tx=8b705cdd50e719a405c1cd8671f82283bddaa4c62b5ef5a99d3005c467459585
- [PASS] `LOCKED_PLACE_LOSER_BET_status`: status=1, tx=4fa381a9e86ab70c0a43e5dfefdca465f8844dbe40b50e719c7a5021a5767559
- [PASS] `LOCKED_LOCK_MARKET_status`: status=1, tx=8e69ae0fba39bddbc29aef30a8542507db1be81650e57980231f78cda3eb4088
- [PASS] `LOCKED_market_status_after_lock`: status=Locked
- [PASS] `LOCKED_cashout_eth_call_reverts`: ('0x727528426f37b438050574001335a8ef05716b810923119c465f969698804b5ffdd5cce0', '0x727528426f37b438050574001335a8ef05716b810923119c465f969698804b5ffdd5cce0')
- [PASS] `LOCKED_CASHOUT_REVERT_TX_status`: status=0, tx=ab0cc07000603f65346b0fa29b913fbd25d6f75fc9bf5446faca40c99a299739
- [PASS] `LOCKED_winner_state_still_pending`: state=Pending
- [PASS] `CASHOUT_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=846ab4d9d4b54689687c416ccc92ae0cbba19f5c988b1a2e27bc098b95bef06f
- [PASS] `CASHOUT_MARKET_FINALIZE_status`: status=1, tx=9fc1b4df96ef68f7252483c96b1c0147cad9938f700aa1425837a3ef5e6bc8f2
- [PASS] `CASHOUT_market_settled`: status=Settled
- [PASS] `CASHOUT_bet_state_after_settlement`: state=CashedOut
- [PASS] `LOCKED_MARKET_SETTLE_BY_SCORE_status`: status=1, tx=d1fd95ef53a198b30b15e6c89765dbd6fe8e9cc89a7bec1558c2a8d50163fcb0
- [PASS] `LOCKED_MARKET_FINALIZE_status`: status=1, tx=60f75760b08b64bc26474c1f212a3e114c1510d61f05b1f3da2ab3dff1dd6c4c
- [PASS] `LOCKED_market_settled`: status=Settled
- [PASS] `LOCKED_WINNER_CLAIM_PAYOUT_status`: status=1, tx=dd6ab83e4cbc7362fdfe4e63f305d8c7f72b2f3e529f336d573fd03f3a78793d
- [PASS] `LOCKED_claim_status`: dd6ab83e4cbc7362fdfe4e63f305d8c7f72b2f3e529f336d573fd03f3a78793d
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
| 1 | `SEED_ODD_cashoutUser` | `admin` | `145e9bfcb929cf250edb15e71c75a0b731a5a789ca202601109588209a9343cf` | `1` | `63685` |
| 2 | `APPROVE_cashoutUser_BETTING` | `cashoutUser` | `0e70a06e607b2759bb36e249636c56863a447c46bb5ab38eaf62f69bd3a3e82e` | `1` | `51178` |
| 3 | `SEED_ODD_lockedWinner` | `admin` | `cc028f234c6889410d182ac93bc15d96e09d5a4ab538e0a20d95e559b2a64b6b` | `1` | `63685` |
| 4 | `APPROVE_lockedWinner_BETTING` | `lockedWinner` | `1373b2bbe17e06050b6e416581a07cedafc32acda047efd102ef4078c462bfa8` | `1` | `51178` |
| 5 | `SEED_ODD_lockedLoser` | `admin` | `6b98782cc441cc6a4027bdf6974d2782dc9286bade97ef264e3365c56e7efb85` | `1` | `63673` |
| 6 | `APPROVE_lockedLoser_BETTING` | `lockedLoser` | `6f4048858400bdf264a3132680c3f38b51dd4be52ab67bebda94d3e0b10c5790` | `1` | `51178` |
| 7 | `CASHOUT_OPEN_MARKET` | `admin` | `cc857d40059cfdbbd149461a1a4b192f6f6bd9fdb9d8a8bdc0a1eabfb271b5fd` | `1` | `525164` |
| 8 | `CASHOUT_PLACE_BET` | `cashoutUser` | `4a5b86e4df9c83c5158568e4f4d516478d13f73d8f09db9cdd5abbe5d5f8fa67` | `1` | `753466` |
| 9 | `CASHOUT_BEFORE_LOCK` | `cashoutUser` | `f0b434983410917187a54507eaf6760b4421df63afe1e17775c3755f54384d23` | `1` | `317236` |
| 10 | `LOCKED_OPEN_MARKET` | `admin` | `57008f544f4000402cb361df2809a5cbb6ba8e57a73441a2b2835506da1c26a6` | `1` | `525164` |
| 11 | `LOCKED_PLACE_WINNER_BET` | `lockedWinner` | `8b705cdd50e719a405c1cd8671f82283bddaa4c62b5ef5a99d3005c467459585` | `1` | `753454` |
| 12 | `LOCKED_PLACE_LOSER_BET` | `lockedLoser` | `4fa381a9e86ab70c0a43e5dfefdca465f8844dbe40b50e719c7a5021a5767559` | `1` | `749476` |
| 13 | `LOCKED_LOCK_MARKET` | `admin` | `8e69ae0fba39bddbc29aef30a8542507db1be81650e57980231f78cda3eb4088` | `1` | `89068` |
| 14 | `LOCKED_CASHOUT_REVERT_TX` | `lockedWinner` | `ab0cc07000603f65346b0fa29b913fbd25d6f75fc9bf5446faca40c99a299739` | `0` | `53964` |
| 15 | `CASHOUT_MARKET_SETTLE_BY_SCORE` | `admin` | `846ab4d9d4b54689687c416ccc92ae0cbba19f5c988b1a2e27bc098b95bef06f` | `1` | `136001` |
| 16 | `CASHOUT_MARKET_FINALIZE` | `admin` | `9fc1b4df96ef68f7252483c96b1c0147cad9938f700aa1425837a3ef5e6bc8f2` | `1` | `111321` |
| 17 | `LOCKED_MARKET_SETTLE_BY_SCORE` | `admin` | `d1fd95ef53a198b30b15e6c89765dbd6fe8e9cc89a7bec1558c2a8d50163fcb0` | `1` | `384720` |
| 18 | `LOCKED_MARKET_FINALIZE` | `admin` | `60f75760b08b64bc26474c1f212a3e114c1510d61f05b1f3da2ab3dff1dd6c4c` | `1` | `297114` |
| 19 | `LOCKED_WINNER_CLAIM_PAYOUT` | `lockedWinner` | `dd6ab83e4cbc7362fdfe4e63f305d8c7f72b2f3e529f336d573fd03f3a78793d` | `1` | `316040` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `18,966,739.98` | `18,960,746.98` | `4.3207763249555412` | `4.3160380199555412` |
| `cashoutUser` | `0x21851feCa624db4E1cba2520864b7566d3371A51` | `0` | `1,979` | `0.074027513` | `0.072905633` |
| `lockedWinner` | `0x4d59E6C9290130442dFAFD5a9ad83e702D9Ef03e` | `0` | `2,089` | `0.074430198` | `0.073255562` |
| `lockedLoser` | `0x0BE8c5dF7A83dd00cc101F23241D2015A7F25617` | `0` | `1,899` | `0.075983206` | `0.075182552` |
| `BettingPool` | `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3` | `10,999,386.49` | `10,999,392.49` | `0` | `0` |
