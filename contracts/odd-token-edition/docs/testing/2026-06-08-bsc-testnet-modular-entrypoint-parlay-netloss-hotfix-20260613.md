# 2026-06-13 BSC Testnet Settlement NetLoss Hotfix Parlay Report

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `113083159`
- suiteFinishedAtBlock: `113083901`
- checks: `38 passed / 0 failed`

## Contracts
- ODDToken: `0x9D3cfd96C447D45FBf3e10bf0D233C51DEb58Ad0`
- LiquidityPool: `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50`
- BettingPool: `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3`
- BettingParlayLens: `0xd139C9C041783D48A3D36aedb8Ea7d99859bD2a2`

## Scenario
- 开两个不同 match 的 1X2 市场，串关用户下注两个主胜 leg。
- 比赛结束后两个市场均按 `1:0` 结算，串关结算为 `WonUnclaimed`，用户领取净派奖。
- 验证 ABI 不存在串关提前 cashout selector；`estimatedValue` 仅作为只读展示估值。

## Parlay
- marketA: `fa7cdcc5ad3645f57b746ad54759dfc250d891ae552d84faaa496fa04c526edf`
- marketB: `bc3b537f8efbebf0bb98537bc9a3fea4c9b80aaa4d8466acf164df7e4a0ae9ff`
- parlayId: `7384338955d6437822a26f39f98f611890a53480103a3d189718495da4e753d6`
- parlayRiskId: `2692f3686e005db6c0e7f5d019669f124a79390bd9a1da5de97612b28393d392`
- stake: `100` ODD
- lockedComboOdds: `40000`
- maxPayout / grossPayout: `400` ODD
- taxAmount: `20` ODD
- netPayout: `380` ODD
- payoutWindow before claim: reserved `310`, paid `0`
- payoutWindow after claim: reserved `310`, paid `0`
- residual released: `310` ODD

## Checks
- [PASS] `PARLAY_no_cashout_selectors`: forbidden=[]
- [PASS] `SEED_ODD_parlayUser_status`: status=1, tx=6b7f81541ba61b108b79b5cdacb9b2d47d10f3cf6cc6f17b2698aa990a99d11f
- [PASS] `APPROVE_PARLAY_USER_BETTING_status`: status=1, tx=468687a05d67178c229e58e7a1cb6b6a968a22ff2674b0c4abcdac73cb85a7c3
- [PASS] `PARLAY_OPEN_MARKET_A_status`: status=1, tx=7a4c45d4021107b5c391076c2f753a9d94f151dc177c53ab2d797459b945c362
- [PASS] `PARLAY_OPEN_MARKET_B_status`: status=1, tx=f3782acb587d5de1f6dd2fc2b6d885d02caeb2e8dd213121adc5d8c63cdcadc9
- [PASS] `PARLAY_preview_combo_odds`: lockedComboOdds=40000
- [PASS] `PARLAY_preview_max_payout`: maxPayout=400000000000000000000
- [PASS] `PARLAY_preview_capacity`: available=11005546464285714285714284, required=400000000000000000000
- [PASS] `PARLAY_PLACE_status`: status=1, tx=d9e020a9428586d111644f4ce72d32717505f65bb2177becd5b39018670f21cc
- [PASS] `PARLAY_state_after_place`: state=Pending
- [PASS] `PARLAY_leg_count`: legCount=2
- [PASS] `PARLAY_open_max_after_place`: open parlay exposure increased
- [PASS] `PARLAY_place_balance_delta`: expected=101000000000000000000, actual=101000000000000000000
- [PASS] `PARLAY_estimate_pending_state`: state=0
- [PASS] `PARLAY_estimate_pending_unresolved`: unresolved=2
- [PASS] `PARLAY_estimate_pending_positive`: estimatedValue=100000000000000000000
- [PASS] `PARLAY_MARKET_A_SETTLE_BY_SCORE_status`: status=1, tx=3d196a44f597406bb4253147e6bdf048886dd1f32276869b79f17c97b21be1b3
- [PASS] `PARLAY_MARKET_A_FINALIZE_status`: status=1, tx=7f066fbaf905da6112ffacfb1adf0cd9bfc1cb3a391bfd1dbe728f983d36841e
- [PASS] `PARLAY_MARKET_B_SETTLE_BY_SCORE_status`: status=1, tx=4bfb532a1ff5d3b749308e2592096fc83285fc441f57f6c0e61fe7a7647e9628
- [PASS] `PARLAY_MARKET_B_FINALIZE_status`: status=1, tx=e89cb6f1b26c13abb5782c17d82f8a77175943283b0ab5d10ef197bf9f88fc47
- [PASS] `PARLAY_market_a_settled`: status=Settled
- [PASS] `PARLAY_market_b_settled`: status=Settled
- [PASS] `PARLAY_estimate_final_before_settle`: isFinal=True
- [PASS] `PARLAY_estimated_value_matches_gross`: estimatedValue=400000000000000000000, maxPayout=400000000000000000000
- [PASS] `PARLAY_SETTLE_status`: status=1, tx=3693e28a921d6b6da489d5c0de2ab6439a28cfbcc9b18cc448130402b96be009
- [PASS] `PARLAY_settled_event`: ParlaySettled emitted
- [PASS] `PARLAY_state_after_settle`: state=WonUnclaimed
- [PASS] `PARLAY_claimable_after_settle`: claimable=400000000000000000000
- [PASS] `PARLAY_open_max_after_settle`: open parlay exposure released
- [PASS] `PARLAY_CLAIM_status`: status=1, tx=7531bc951f4247b76d6cddbeabe39f14ca12b554264144086c441c24bca7fcfa
- [PASS] `PARLAY_claim_event`: ParlayPayoutClaimed emitted
- [PASS] `PARLAY_state_after_claim`: state=WonClaimed
- [PASS] `PARLAY_claim_gross`: gross=400000000000000000000, expected=400000000000000000000
- [PASS] `PARLAY_claim_balance_delta`: delta=380000000000000000000, net=380000000000000000000
- [PASS] `PARLAY_RELEASE_RESIDUAL_RESERVE_status`: status=1, tx=0e163ff7917a56e4733249cb7d9adcf981068ac0772de87b550fbd81f5634467
- [PASS] `PARLAY_reserve_paid_after_claim_not_overdrawn`: paid=0, gross=400000000000000000000
- [PASS] `PARLAY_residual_release`: reserved=0, paid=0
- [PASS] `PARLAY_estimate_after_claim_reverts`: settled parlay estimate should revert

## Issues
- No parlay functional issues found in this run.

## Transactions
| # | label | actor | tx | status | gas |
|---:|---|---|---|---:|---:|
| 1 | `SEED_ODD_parlayUser` | `admin` | `6b7f81541ba61b108b79b5cdacb9b2d47d10f3cf6cc6f17b2698aa990a99d11f` | `1` | `63685` |
| 2 | `APPROVE_PARLAY_USER_BETTING` | `parlayUser` | `468687a05d67178c229e58e7a1cb6b6a968a22ff2674b0c4abcdac73cb85a7c3` | `1` | `51178` |
| 3 | `PARLAY_OPEN_MARKET_A` | `admin` | `7a4c45d4021107b5c391076c2f753a9d94f151dc177c53ab2d797459b945c362` | `1` | `525164` |
| 4 | `PARLAY_OPEN_MARKET_B` | `admin` | `f3782acb587d5de1f6dd2fc2b6d885d02caeb2e8dd213121adc5d8c63cdcadc9` | `1` | `525164` |
| 5 | `PARLAY_PLACE` | `parlayUser` | `d9e020a9428586d111644f4ce72d32717505f65bb2177becd5b39018670f21cc` | `1` | `1096682` |
| 6 | `PARLAY_MARKET_A_SETTLE_BY_SCORE` | `admin` | `3d196a44f597406bb4253147e6bdf048886dd1f32276869b79f17c97b21be1b3` | `1` | `137191` |
| 7 | `PARLAY_MARKET_A_FINALIZE` | `admin` | `7f066fbaf905da6112ffacfb1adf0cd9bfc1cb3a391bfd1dbe728f983d36841e` | `1` | `111444` |
| 8 | `PARLAY_MARKET_B_SETTLE_BY_SCORE` | `admin` | `4bfb532a1ff5d3b749308e2592096fc83285fc441f57f6c0e61fe7a7647e9628` | `1` | `137191` |
| 9 | `PARLAY_MARKET_B_FINALIZE` | `admin` | `e89cb6f1b26c13abb5782c17d82f8a77175943283b0ab5d10ef197bf9f88fc47` | `1` | `111444` |
| 10 | `PARLAY_SETTLE` | `admin` | `3693e28a921d6b6da489d5c0de2ab6439a28cfbcc9b18cc448130402b96be009` | `1` | `487511` |
| 11 | `PARLAY_CLAIM` | `parlayUser` | `7531bc951f4247b76d6cddbeabe39f14ca12b554264144086c441c24bca7fcfa` | `1` | `307016` |
| 12 | `PARLAY_RELEASE_RESIDUAL_RESERVE` | `admin` | `0e163ff7917a56e4733249cb7d9adcf981068ac0772de87b550fbd81f5634467` | `1` | `102781` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `18,960,746.98` | `18,957,755.98` | `4.3160380199555412` | `4.3138364449555412` |
| `parlayUser` | `0x65875E198902A9cA956C0Ce4ec9d853F100Be397` | `0` | `3,279` | `0.076957005` | `0.075502129` |
| `LiquidityPool` | `0x2de40A5AE2eF4a3fb8168ccd357b37A9fFC04b50` | `11,112` | `11,120` | `0` | `0` |
| `BettingPool` | `0x0Ce84e205EF5a131b8677F348e7d613BB1a630E3` | `10,999,392.49` | `10,999,088.49` | `0` | `0` |
