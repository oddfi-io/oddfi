# 2026-06-07 BSC Testnet Parlay Upgrade Report (current-run)

- RPC: `https://bnb-testnet.g.alchemy.com/v2/<redacted>`
- chainId: `97`
- suiteStartedAtBlock: `111888665`
- suiteFinishedAtBlock: `111889373`
- checks: `37 passed / 0 failed`

## Contracts
- ODDToken: `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0`
- LiquidityPool: `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa`
- BettingPool: `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291`
- BettingParlayLens: `0x8DF283608C37c387513810CdF9E3de171B09F6fC`

## Scenario
- 开两个不同 match 的 1X2 市场，串关用户下注两个主胜 leg。
- 比赛结束后两个市场均按 `1:0` 结算，串关结算为 `WonUnclaimed`，用户领取净派奖。
- 验证 ABI 不存在串关提前 cashout selector；`estimatedValue` 仅作为只读展示估值。

## Parlay
- marketA: `493a4532492ce838a5321b9b872d310b1a2fccfed7b47d9ed1554395e63a7901`
- marketB: `f90a58460c18b634f599cb4d9d4e3cf93b2befe401c07d12df5dc37f67103158`
- parlayId: `b3a8eac2dcd28820b90d32aa674706ffb5dde44ba69b97a2652fe696e0d49a0a`
- parlayRiskId: `d72c75713f9dc249f2522e49bc30c65eeb6396d4945f67f30f1ec1fba0b30a61`
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
- [PASS] `PARLAY_OPEN_MARKET_A_status`: status=1, tx=bcd02354ee21485c8c9ca4b5a4145f3460bf969bfc0ec9394a1fbbb208811baf
- [PASS] `PARLAY_OPEN_MARKET_B_status`: status=1, tx=951d03d79631abc8183eeb8880cc14c5fc6ea3444a9fa9b83d18efb80622f623
- [PASS] `PARLAY_preview_combo_odds`: lockedComboOdds=40000
- [PASS] `PARLAY_preview_max_payout`: maxPayout=400000000000000000000
- [PASS] `PARLAY_preview_capacity`: available=44607041239594518978384, required=400000000000000000000
- [PASS] `PARLAY_PLACE_status`: status=1, tx=551653d98166461ed91bad4fae58ac0c2f9a1886f41de936fde2bc57027838a5
- [PASS] `PARLAY_state_after_place`: state=Pending
- [PASS] `PARLAY_leg_count`: legCount=2
- [PASS] `PARLAY_open_max_after_place`: open parlay exposure increased
- [PASS] `PARLAY_place_balance_delta`: expected=101000000000000000000, actual=101000000000000000000
- [PASS] `PARLAY_estimate_pending_state`: state=0
- [PASS] `PARLAY_estimate_pending_unresolved`: unresolved=2
- [PASS] `PARLAY_estimate_pending_positive`: estimatedValue=100000000000000000000
- [PASS] `PARLAY_MARKET_A_SETTLE_BY_SCORE_status`: status=1, tx=9636bb9376a34c4c6d4aba20aaaaeec328c0a313f0603472e74fabe9715b1df1
- [PASS] `PARLAY_MARKET_A_FINALIZE_status`: status=1, tx=9228f4dd8e0c9154286716ceb0e3bba0fedca93c8cb7be1dce0ebd5996a03b0a
- [PASS] `PARLAY_MARKET_B_SETTLE_BY_SCORE_status`: status=1, tx=48055396962795b45cf8420af608d5afbd5794d6b2aa64a9c142c0e76773e5db
- [PASS] `PARLAY_MARKET_B_FINALIZE_status`: status=1, tx=08b33318368e43eb72c80c6e0a0b5844ab8d7763d27bb25d7d88c3f6df1fa328
- [PASS] `PARLAY_market_a_settled`: status=Settled
- [PASS] `PARLAY_market_b_settled`: status=Settled
- [PASS] `PARLAY_estimate_final_before_settle`: isFinal=True
- [PASS] `PARLAY_estimated_value_matches_gross`: estimatedValue=400000000000000000000, maxPayout=400000000000000000000
- [PASS] `PARLAY_SETTLE_status`: status=1, tx=836bd91775005f8ac1eaaf2371ccf3c063e60596b2fc945129bdab546ccc1788
- [PASS] `PARLAY_settled_event`: ParlaySettled emitted
- [PASS] `PARLAY_state_after_settle`: state=WonUnclaimed
- [PASS] `PARLAY_claimable_after_settle`: claimable=400000000000000000000
- [PASS] `PARLAY_open_max_after_settle`: open parlay exposure released
- [PASS] `PARLAY_CLAIM_status`: status=1, tx=56742d275a826bbeb4da45c2ace37a276342bd37b9ca358eb033eebb3ffe20c7
- [PASS] `PARLAY_claim_event`: ParlayPayoutClaimed emitted
- [PASS] `PARLAY_state_after_claim`: state=WonClaimed
- [PASS] `PARLAY_claim_gross`: gross=400000000000000000000, expected=400000000000000000000
- [PASS] `PARLAY_claim_balance_delta`: delta=380000000000000000000, net=380000000000000000000
- [PASS] `PARLAY_RELEASE_RESIDUAL_RESERVE_status`: status=1, tx=4e7fce07d0ad80a24775302117db9cdf13d201a06ca7859c7fa30db1282aa08b
- [PASS] `PARLAY_reserve_paid_after_claim_not_overdrawn`: paid=0, gross=400000000000000000000
- [PASS] `PARLAY_residual_release`: reserved=0, paid=0
- [PASS] `PARLAY_estimate_after_claim_final`: isFinal=True
- [PASS] `PARLAY_estimate_after_claim_zero`: estimatedValue=0

## Issues
- No parlay functional issues found in this run.

## Transactions
| # | label | actor | tx | status | gas |
|---:|---|---|---|---:|---:|
| 1 | `PARLAY_OPEN_MARKET_A` | `admin` | `bcd02354ee21485c8c9ca4b5a4145f3460bf969bfc0ec9394a1fbbb208811baf` | `1` | `520234` |
| 2 | `PARLAY_OPEN_MARKET_B` | `admin` | `951d03d79631abc8183eeb8880cc14c5fc6ea3444a9fa9b83d18efb80622f623` | `1` | `520234` |
| 3 | `PARLAY_PLACE` | `parlayUser` | `551653d98166461ed91bad4fae58ac0c2f9a1886f41de936fde2bc57027838a5` | `1` | `837050` |
| 4 | `PARLAY_MARKET_A_SETTLE_BY_SCORE` | `admin` | `9636bb9376a34c4c6d4aba20aaaaeec328c0a313f0603472e74fabe9715b1df1` | `1` | `136982` |
| 5 | `PARLAY_MARKET_A_FINALIZE` | `admin` | `9228f4dd8e0c9154286716ceb0e3bba0fedca93c8cb7be1dce0ebd5996a03b0a` | `1` | `111221` |
| 6 | `PARLAY_MARKET_B_SETTLE_BY_SCORE` | `admin` | `48055396962795b45cf8420af608d5afbd5794d6b2aa64a9c142c0e76773e5db` | `1` | `136982` |
| 7 | `PARLAY_MARKET_B_FINALIZE` | `admin` | `08b33318368e43eb72c80c6e0a0b5844ab8d7763d27bb25d7d88c3f6df1fa328` | `1` | `111221` |
| 8 | `PARLAY_SETTLE` | `admin` | `836bd91775005f8ac1eaaf2371ccf3c063e60596b2fc945129bdab546ccc1788` | `1` | `461404` |
| 9 | `PARLAY_CLAIM` | `parlayUser` | `56742d275a826bbeb4da45c2ace37a276342bd37b9ca358eb033eebb3ffe20c7` | `1` | `147754` |
| 10 | `PARLAY_RELEASE_RESIDUAL_RESERVE` | `admin` | `4e7fce07d0ad80a24775302117db9cdf13d201a06ca7859c7fa30db1282aa08b` | `1` | `102456` |

## Suite Snapshot
| label | address | ODD before | ODD after | BNB before | BNB after |
|---|---|---:|---:|---:|---:|
| `admin` | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` | `98,398,350` | `98,398,359` | `9.4785102765555412` | `9.4764095425555412` |
| `parlayUser` | `0x65875E198902A9cA956C0Ce4ec9d853F100Be397` | `3,279` | `3,558` | `0.07890994` | `0.077925136` |
| `LiquidityPool` | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | `135,656` | `135,664` | `0` | `0` |
| `BettingPool` | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | `68,319` | `68,015` | `0` | `0` |