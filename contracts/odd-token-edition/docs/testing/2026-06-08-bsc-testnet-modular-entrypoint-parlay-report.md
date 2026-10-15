# 2026-06-08 BSC Testnet Modular Entrypoint Parlay Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `112180468`
- suiteFinishedAtBlock: `112181113`
- checks: `36 passed / 0 failed`

## Contracts
- ODDToken: `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0`
- LiquidityPool: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
- BettingPool: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
- BettingParlayLens: `0x54A40Ac7806904048Cf5F972C017aC2e33fDD15e`

## Scenario
- 开两个不同 match 的 1X2 市场，串关用户下注两个主胜 leg。
- 比赛结束后两个市场均按 `1:0` 结算，串关结算为 `WonUnclaimed`，用户领取净派奖。
- 验证 ABI 不存在串关提前 cashout selector；`estimatedValue` 仅作为只读展示估值。

## Parlay
- marketA: `5d45c9863e491656624f9e8894dbd25171f983a490a4638ad6edc24c53cdaeee`
- marketB: `c2ee7c7081a2477972be4544c7d75a9f7258a423d73379e164ddad5d1dcbe9fd`
- parlayId: `cad4f19f02c4e3fb06968debdade95bdec7bba3347b655730027793c4ede88a3`
- parlayRiskId: `127f3a18651ff457ad12157c3c5cfff39ded251970c2d6f898a6747f59d09ef3`
- stake: `100` ODD
- lockedComboOdds: `40000`
- maxPayout / grossPayout: `400` ODD
- taxAmount: `20` ODD
- netPayout: `380` ODD
- payoutWindow before claim: reserved `400`, paid `0`
- payoutWindow after claim: reserved `400`, paid `0`
- residual released: `400` ODD

## Checks
- [PASS] `PARLAY_no_cashout_selectors`: forbidden=[]
- [PASS] `PARLAY_OPEN_MARKET_A_status`: status=1, tx=2d6353fa6fda6460b9f4ef3c97ff4af0bd3a88759bb1bf1dec4c6f71f973c19c
- [PASS] `PARLAY_OPEN_MARKET_B_status`: status=1, tx=b43e4150e77e1a05a97758774425bf2d8c99ee0f6f6fae8739328c7b0ea07727
- [PASS] `PARLAY_preview_combo_odds`: lockedComboOdds=40000
- [PASS] `PARLAY_preview_max_payout`: maxPayout=400000000000000000000
- [PASS] `PARLAY_preview_capacity`: available=41836267077013905324562, required=400000000000000000000
- [PASS] `PARLAY_PLACE_status`: status=1, tx=466e292d6f92bdb96e067fc91a1811e72a6e637d193e50b919fe27396d47ca80
- [PASS] `PARLAY_state_after_place`: state=Pending
- [PASS] `PARLAY_leg_count`: legCount=2
- [PASS] `PARLAY_open_max_after_place`: open parlay exposure increased
- [PASS] `PARLAY_place_balance_delta`: expected=101000000000000000000, actual=101000000000000000000
- [PASS] `PARLAY_estimate_pending_state`: state=0
- [PASS] `PARLAY_estimate_pending_unresolved`: unresolved=2
- [PASS] `PARLAY_estimate_pending_positive`: estimatedValue=100000000000000000000
- [PASS] `PARLAY_MARKET_A_SETTLE_BY_SCORE_status`: status=1, tx=847d22cc7ff6f7d455ca7700dad0d11182e44a4d2895d4de6293ce823ba129aa
- [PASS] `PARLAY_MARKET_A_FINALIZE_status`: status=1, tx=d410b1c6bb6bfa176cee6d6fb91133a181ccb3745a268b2c2138b9637e135e46
- [PASS] `PARLAY_MARKET_B_SETTLE_BY_SCORE_status`: status=1, tx=e120abeb7dec63290ee4ef71b366f908d78be94714da742867656e515fc3fa08
- [PASS] `PARLAY_MARKET_B_FINALIZE_status`: status=1, tx=70ad7dde44dc5affbd8a653efc525c03200746ec0fbc405ed3de37855780c54c
- [PASS] `PARLAY_market_a_settled`: status=Settled
- [PASS] `PARLAY_market_b_settled`: status=Settled
- [PASS] `PARLAY_estimate_final_before_settle`: isFinal=True
- [PASS] `PARLAY_estimated_value_matches_gross`: estimatedValue=400000000000000000000, maxPayout=400000000000000000000
- [PASS] `PARLAY_SETTLE_status`: status=1, tx=fdc05032480c1a8bdd77e70d8e2ad71bb4d0d865ed331102b536d896b3699a0e
- [PASS] `PARLAY_settled_event`: ParlaySettled emitted
- [PASS] `PARLAY_state_after_settle`: state=WonUnclaimed
- [PASS] `PARLAY_claimable_after_settle`: claimable=400000000000000000000
- [PASS] `PARLAY_open_max_after_settle`: open parlay exposure released
- [PASS] `PARLAY_CLAIM_status`: status=1, tx=7a613c1e5841b552ae44fcac990caf71b456d249db4fe5117b005ce8286f93a2
- [PASS] `PARLAY_claim_event`: ParlayPayoutClaimed emitted
- [PASS] `PARLAY_state_after_claim`: state=WonClaimed
- [PASS] `PARLAY_claim_gross`: gross=400000000000000000000, expected=400000000000000000000
- [PASS] `PARLAY_claim_balance_delta`: delta=380000000000000000000, net=380000000000000000000
- [PASS] `PARLAY_RELEASE_RESIDUAL_RESERVE_status`: status=1, tx=a08ef132acd89a7f367eb8d062742a1c5a4f8581d39d3428c6166c5145edc1ee
- [PASS] `PARLAY_reserve_paid_after_claim_not_overdrawn`: paid=0, gross=400000000000000000000
- [PASS] `PARLAY_residual_release`: reserved=0, paid=0
- [PASS] `PARLAY_estimate_after_claim_reverts`: settled parlay estimate should revert

## Issues
- No parlay functional issues found in this run.

## Transactions
| # | label | actor | tx | status | gas |
|---:|---|---|---|---:|---:|
| 1 | `PARLAY_OPEN_MARKET_A` | `admin` | `2d6353fa6fda6460b9f4ef3c97ff4af0bd3a88759bb1bf1dec4c6f71f973c19c` | `1` | `525091` |
| 2 | `PARLAY_OPEN_MARKET_B` | `admin` | `b43e4150e77e1a05a97758774425bf2d8c99ee0f6f6fae8739328c7b0ea07727` | `1` | `525091` |
| 3 | `PARLAY_PLACE` | `parlayUser` | `466e292d6f92bdb96e067fc91a1811e72a6e637d193e50b919fe27396d47ca80` | `1` | `820235` |
| 4 | `PARLAY_MARKET_A_SETTLE_BY_SCORE` | `admin` | `847d22cc7ff6f7d455ca7700dad0d11182e44a4d2895d4de6293ce823ba129aa` | `1` | `137147` |
| 5 | `PARLAY_MARKET_A_FINALIZE` | `admin` | `d410b1c6bb6bfa176cee6d6fb91133a181ccb3745a268b2c2138b9637e135e46` | `1` | `111331` |
| 6 | `PARLAY_MARKET_B_SETTLE_BY_SCORE` | `admin` | `e120abeb7dec63290ee4ef71b366f908d78be94714da742867656e515fc3fa08` | `1` | `137147` |
| 7 | `PARLAY_MARKET_B_FINALIZE` | `admin` | `70ad7dde44dc5affbd8a653efc525c03200746ec0fbc405ed3de37855780c54c` | `1` | `111331` |
| 8 | `PARLAY_SETTLE` | `admin` | `fdc05032480c1a8bdd77e70d8e2ad71bb4d0d865ed331102b536d896b3699a0e` | `1` | `466354` |
| 9 | `PARLAY_CLAIM` | `parlayUser` | `7a613c1e5841b552ae44fcac990caf71b456d249db4fe5117b005ce8286f93a2` | `1` | `147896` |
| 10 | `PARLAY_RELEASE_RESIDUAL_RESERVE` | `admin` | `a08ef132acd89a7f367eb8d062742a1c5a4f8581d39d3428c6166c5145edc1ee` | `1` | `102720` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,371,848.534883720930231999` | `98,371,857.534883720930231999` | `7.9603615603555412` | `7.9582453483555412` |
| `parlayUser` | `0x65875E198902A9cA956C0Ce4ec9d853F100Be397` | `3,558` | `3,837` | `0.077925136` | `0.076957005` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `152,782.379463482746921` | `152,790.379463482746921` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `80,802.020000000000000001` | `80,498.020000000000000001` | `0` | `0` |