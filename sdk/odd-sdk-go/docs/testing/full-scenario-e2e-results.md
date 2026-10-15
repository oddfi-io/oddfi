# Full Match Scenario E2E Test Results

**Network:** BSC Testnet (`chain_id=97`)  
**Date:** 2026-05-13  
**Test function:** `TestE2EFullMatchScenario` in `pkg/oddfi/full_scenario_e2e_test.go`  
**Result:** PASS, with final `Withdraw` deferred because the LP position was still `Unbonding` after the configured 10 minute wait.

## Flow

1. Admin opens a 1x2 match market with `OpenMarket`.
2. Admin deposits `1000 ODD` into the single-match LP pool with `DepositMatch`.
3. A generated bettor address receives gas and ODD, approves BettingPool, and places a `100 ODD` bet.
4. Admin waits until `matchEndTime` and settles the market with bettor outcome `0` as winner.
5. Bettor claims the winning payout with `ClaimPayout`.
6. Admin requests LP unbonding with `RequestUnbond`.
7. Test polls for withdrawable state for 10 minutes. The position remained `Unbonding`, so final `Withdraw` should be run later with `TestE2EWithdrawOnly`.

## Addresses & IDs

| Item | Value |
|---|---|
| Admin address | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` |
| Bettor address (generated) | `0x2A4425D8b8D7Cb527fFfCaff4cb97070d72BAD55` |
| ODDToken proxy | `0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C` |
| StakingPool proxy | `0x65fd4A2529010693BA474d1993631e305a42E061` |
| LiquidityPool proxy | `0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f` |
| BettingPool proxy | `0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F` |
| match_id | `0x3ee8070e6e81b3a9f3971eeb634d4e232f1d83e0a9e9492bf38e39b6d6078e4c` |
| market_id | `0xda2cb732c548c2468c863d551fac210582b48a35f9512687c230904eaacf3cbd` |
| LP position ID | `29` |
| bet_id | `0x0000000000000000000000000000000000000000000000000000000000000005` |

## Transaction Results

| Step | Operation | tx_hash | gas_used | Result |
|---|---|---|---:|---|
| Setup | FundBettorBNB | `0xcad21e0959eb64ac8305fcc7f44d2cf20daa850bfe34cc0ab25b2e6a1aebd1c2` | 21,000 | PASS |
| Setup | FundBettorODD | `0x9c9a5ef0b37eb6d2573517d9d8939e9497ae7dec9c18760d0b388aa82e16c029` | 58,572 | PASS |
| Step 1 | OpenMarket | `0xd6bcb9f16dc18a3da51f4bc796ef0f2c5a01222d4b3d3474d0d7a419ee27b30d` | 491,357 | PASS |
| Step 2 | Approve LP | `0x4be533b25987b2c2757c3a2939c7b09f56fdba62df237fc11e1dda8450094f55` | 50,856 | PASS |
| Step 2 | DepositMatch | `0x8b47ff0b798a04a06b6e4a22231598b0ae4c3985c9ae0fe447518a8ad924b04d` | 261,949 | PASS |
| Step 3 | BettorApprove | `0x1acddd9cb56e95187acff34dba976ebe3803f62200d0c33515989ed825765a02` | 50,856 | PASS |
| Step 3 | PlaceBet | `0x75387003a76daa8fdaa39803fc255bff21ceff849632be531ac8197c3fa0be7c` | 510,929 | PASS |
| Step 4 | SettleMarket | `0x024db2c9208d4fa0fe370f2aa716a1410b2160886a112ccf539f9999b601d9e6` | 351,355 | PASS |
| Step 5 | ClaimPayout | `0x825d41279925a6c50b7ff255c7c59f68c1ac5c957379a22c4b6aa4a31d29709d` | 224,711 | PASS |
| Step 6 | RequestUnbond | `0x12e8baf1a4467af419b586dfe4b7cfd004050be1dfa040c3437ff1faa1c98005` | 185,308 | PASS |
| Step 7 | Withdraw | — | — | Deferred; position still `Unbonding` after 10 minutes |

## Token & Accounting Changes

| Step | Change |
|---|---|
| FundBettorODD | Bettor received `200 ODD`. |
| DepositMatch | Admin ODD `-1000 ODD`; LiquidityPool ODD `+1000 ODD`; `totalActiveDeposited +1000 ODD`; `requestableLiquidity +1000 ODD`. |
| PlaceBet | Bettor ODD `-101 ODD`; BettingPool ODD `+100 ODD`; `accountedBalance +100 ODD`. |
| SettleMarket | BettingPool ODD `-8 ODD`; `accountedBalance` moved from about `101.9766 ODD` to `93.9766 ODD`. |
| ClaimPayout | Bettor ODD `+190 ODD`; BettingPool ODD `-92 ODD`; `accountedBalance` returned to about `1.9766 ODD`. |
| RequestUnbond | `totalActiveDeposited -1000 ODD`; `requestableLiquidity -993.670260112748491 ODD`. |

## Payout Window

After settlement:

- `reservedAmount = 200 ODD`
- `paidOutAmount = 0`
- `settledAt = 1778657145`

After claim:

- `reservedAmount = 200 ODD`
- `paidOutAmount = 106 ODD`
- `settledAt = 1778657145`

## Follow-Up Withdrawal

The LP position was still `Unbonding` after the configured 10 minute wait. To finish the final withdrawal later, run:

```bash
ODDFI_FULL_E2E=1 ODDFI_LP_POSITION_ID=29 go test ./pkg/oddfi -run TestE2EWithdrawOnly -count=1 -v -timeout 10m
```

## Conclusion

The deployed contract set passed the full match lifecycle through `ClaimPayout` and `RequestUnbond`. `ClaimPayout` paid the bettor successfully and no longer reverts on the LP payout-liquidity path. Final LP withdrawal remains time-gated by the contract's unbond epoch rules.
