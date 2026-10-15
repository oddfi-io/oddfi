# BettingPool New Methods E2E Results

Date: 2026-05-17

> Historical report: this result was captured before the 2026-05-25 score-based settlement ABI. Current SDK code no longer exposes `PushRefundMarket` or `SettleMarket`; use `FinalizeMarketSettlement` plus `RefundBets` for refund/cancel flows, and `GetMarketBetIds -> SettleMarketBetsByScore -> FinalizeMarketSettlement` for normal score settlement.

## Purpose

This document records the latest BNB testnet E2E result for the newly exposed public SDK methods:

- `BettingPool.UpdateOdds`
- `BettingPool.RefundBets`
- `BettingPool.PushRefundMarket`

Primary test file:

- `pkg/oddfi/refund_methods_e2e_test.go`

## Environment

Command shape:

```bash
ODDFI_FULL_E2E=1 \
ODDFI_RPC_URL=<redacted> \
ODDFI_PRIVATE_KEY=<redacted> \
ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C \
ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 \
ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f \
ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F \
go test ./pkg/oddfi -run TestE2ENewBettingPoolWriteMethods -count=1 -v -timeout 25m
```

Result:

- Test: `TestE2ENewBettingPoolWriteMethods`
- Result: `PASS`
- Duration: `578.99s`
- Chain ID: `97`
- Admin: `0x7501bCBFAAa99e6390577277D051A32ec2e64064`
- Generated bettor: `0x39D4787104162609Bf6271ABfCf24DC06E48e218`

## Detailed Test Procedure

### Shared Setup

1. Build a public SDK client with the four proxy addresses.
2. Derive the admin signer from runtime-only `ODDFI_PRIVATE_KEY`.
3. Generate a new bettor key in memory for this run.
4. Read `chainID` from RPC and create `bind.TransactOpts` with that chain ID.
5. Confirm the admin has both roles required by the three new methods:
   - `OPERATOR_ROLE` for `UpdateOdds`
   - `SETTLER_ROLE` for `RefundBets` and `PushRefundMarket`
6. If either role is missing, grant it from the same admin account and wait for the receipt.
7. Transfer BNB to the generated bettor so it can pay gas.
8. Transfer ODD to the generated bettor so it can approve and place bets.

Expected setup output:

- generated bettor address;
- role grant tx hash and gas when a role is missing;
- BNB funding tx hash and gas;
- ODD funding tx hash, gas, and ODD amount.

### Market Setup

Two separate markets are required because `RefundBets` and `PushRefundMarket` have different state preconditions.

1. Open a normal 1x2 market for `RefundBets`.
   - `marketType=0`
   - `line=0`
   - `outcomeCount=3`
   - base odds example: `[20000, 30000, 20000]`
2. Open a handicap market for `PushRefundMarket`.
   - `marketType=1`
   - `line=1`
   - `outcomeCount=2`
   - base odds example: `[20000, 20000]`
3. Use distinct `matchId` values so both markets can coexist in one test run.
4. Record the computed `marketId` values before broadcasting transactions.

Expected market setup output:

- `OpenMarket` tx hash, block, and gas for each market;
- admin BNB delta;
- BettingPool ODD balance and `accountedBalance` before and after.

### UpdateOdds Flow

`UpdateOdds` only needs an open market and an `OPERATOR_ROLE` caller.

1. Read BettingPool balances and accounting values before the transaction.
2. Call `BettingPool.UpdateOdds` on the 1x2 market.
   - `marketId`: 1x2 refund market ID
   - `baseOdds`: `[21000, 29000, 21000]`
   - `updatedAt`: current unix timestamp
3. Wait for the receipt.
4. Read `GetMarketOdds` for the same market.
5. Assert:
   - transaction succeeds;
   - `baseOdds` and `quotedOdds` match the updated values;
   - `quoteVersion` increments;
   - BettingPool ODD balance does not change;
   - `accountedBalance` does not change.

Expected output:

- `UpdateOdds` tx hash;
- block number;
- gas used;
- BNB delta;
- ODD deltas;
- `quoteVersion`;
- `baseOdds`;
- `quotedOdds`;
- `updatedAt`.

### RefundBets Flow

`RefundBets` requires the target market to already be terminal with status `Refunded` or `Cancelled`.

1. Approve BettingPool from the bettor for the bet amount plus bet tax.
2. Read `GetMarketOdds` and build `QuoteGuardInput` from the current quote.
3. Place a 100 ODD bet on the 1x2 refund market.
4. Record the `BetPlaced` bet ID from the transaction receipt.
5. Wait until `matchEndTime + 2`.
6. Call `SettleMarket` on the 1x2 refund market:
   - `resultKindRaw=1`
   - `winningOutcome=0`
7. Read `GetMarket` and confirm status is `3` (`Refunded`).
8. Call `RefundBets`:
   - `marketId`: 1x2 refund market ID
   - `betIds`: the recorded bet ID
   - `refundAmounts`: accepted bet amount
9. Read `GetBet` for the refunded bet.
10. Assert:
    - transaction succeeds;
    - bet state becomes `1` (`Refunded`);
    - `refundedAmount` equals the requested refund amount;
    - bettor ODD increases by the refund amount;
    - BettingPool ODD decreases by the refund amount;
    - BettingPool `accountedBalance` decreases by the refund amount.

Expected output:

- approve tx hash and gas;
- place bet tx hash, block, gas, bet ID, ODD deltas;
- settle tx hash, block, gas, market status;
- `RefundBets` tx hash, block, gas;
- bettor ODD before / after / delta;
- BettingPool ODD before / after / delta;
- `accountedBalance` before / after / delta;
- final bet settlement state and refunded amount.

### PushRefundMarket Flow

`PushRefundMarket` is not a post-`SettleMarket` refund path. It is the settlement/refund entrypoint for handicap push refund markets.

Correct preconditions:

- caller has `SETTLER_ROLE`;
- market exists;
- market is not terminal;
- market is handicap `marketType=1`;
- market line is `1`;
- each bet ID belongs to this market;
- each bet is still `Pending`;
- batch size is within the contract cap.

Correct execution order:

1. Open a handicap market with `marketType=1,line=1`.
2. Do not call `SettleMarket` on this market.
3. Approve BettingPool from the bettor for the bet amount plus bet tax.
4. Read `GetMarketOdds` and build `QuoteGuardInput` from the current quote.
5. Place a 100 ODD bet on the handicap market.
6. Record the `BetPlaced` bet ID from the transaction receipt.
7. Wait until `matchEndTime + 2`.
8. Call `PushRefundMarket` directly:
   - `marketId`: handicap push-refund market ID
   - `betIds`: the recorded pending bet ID
9. Read `GetBet` and `GetMarket`.
10. Assert:
    - transaction succeeds;
    - bet state becomes `1` (`Refunded`);
    - `refundedAmount` equals the bet accepted amount;
    - market status becomes `3` (`Refunded`);
    - bettor ODD increases by the refund amount;
    - BettingPool ODD decreases by the refund amount;
    - BettingPool `accountedBalance` decreases by the refund amount.

Incorrect order to avoid:

1. Open `marketType=1,line=1`.
2. Place pending bets.
3. Call `SettleMarket` first.
4. Call `PushRefundMarket`.

This order fails because `SettleMarket` makes the market terminal. The observed revert selector was `0x10d4bf30`, which decodes to `SettlementCannotClose(bytes32)`.

Expected output:

- approve tx hash and gas;
- place bet tx hash, block, gas, bet ID, ODD deltas;
- `PushRefundMarket` tx hash, block, gas;
- bettor ODD before / after / delta;
- BettingPool ODD before / after / delta;
- `accountedBalance` before / after / delta;
- final bet settlement state;
- final market status.

## Latest Executed Scenario

1. Ensure admin has `OPERATOR_ROLE` and `SETTLER_ROLE`.
2. Generate a bettor address and fund it with BNB and ODD.
3. Open one 1x2 market for `RefundBets`.
4. Open one handicap `marketType=1,line=1` market for `PushRefundMarket`.
5. Call `UpdateOdds` on the 1x2 market.
6. Place one 100 ODD bet on each market.
7. Wait until `matchEndTime + 2`.
8. Settle only the 1x2 market as `Refunded`, then call `RefundBets`.
9. Call `PushRefundMarket` directly on the still non-terminal handicap market.

Important precondition: `PushRefundMarket` expects a non-terminal handicap `marketType=1,line=1` market and marks it `Refunded` itself. Calling `SettleMarket` first makes the market terminal and causes `SettlementCannotClose(bytes32)`.

## Transaction Results

All ODD values are raw smallest-unit values.

| Step | Tx hash | Block | Gas used | User ODD delta | BettingPool ODD delta | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `Setup.FundBettorBNB` | `0x11851a462d987bd130e72d0cd321005035546c59d0a39cb6fbd5b4675467bbfe` | n/a | 21000 | 0 | 0 | Funded generated bettor with BNB for gas. |
| `Setup.FundBettorODD` | `0xfcfde29fac0387fd355c6aa76eb7f12a861c983e0902436b6743dd218a10acae` | n/a | 58572 | +250000000000000000000 | 0 | Funded generated bettor with 250 ODD. |
| `OpenRefundMarket` | `0x3ca8364a69cc3e01969e5abf0ecf08fd9fb4fac35cb2e585aa5d9b29b3e45a8c` | 107872346 | 491357 | 0 | 0 | Opened 1x2 refund market. |
| `OpenPushRefundMarket` | `0xe96ea6b441d1da51f0fabdc8a52507e299bd175705633223ea1af79b0448cd32` | 107872363 | 444186 | 0 | 0 | Opened handicap push-refund market. |
| `UpdateOdds` | `0x9ca53197243762d52e4238b1eb1e074f3638a8066b4d615dbb279e2bed90ca71` | 107872382 | 114865 | 0 | 0 | `quoteVersion=2`, base/quoted odds became `[21000 29000 21000]`. |
| `ApproveRefundBet` | `0x5d68b0cb32fdd42eeb22f254a4648ed6b5850fa44202b82dc0e838d82bbbe004` | n/a | 50856 | 0 | 0 | Approved 101 ODD for first bet. |
| `PlaceRefundBet` | `0x2501d0499ffb9845158ff9fec485e2ca034b57098689195e50f0b1e064ea71db` | 107872416 | 510929 | -101000000000000000000 | +100000000000000000000 | Bet ID `0x0000000000000000000000000000000000000000000000000000000000000017`. |
| `ApprovePushBet` | `0xa54a82c2af905f61f9b131b07714cfcae1905f08917be162e8e86757b473e493` | n/a | 50856 | 0 | 0 | Approved 101 ODD for second bet. |
| `PlacePushBet` | `0xb8cf01444c034a8a3791f420787a6819a3bcb8e71df6a4a429899eee9e25e052` | 107872443 | 443685 | -101000000000000000000 | +100000000000000000000 | Bet ID `0x0000000000000000000000000000000000000000000000000000000000000018`. |
| `SettleRefundBetsMarket` | `0xcf28fef0585d78da66bfdccc5d6748081d50b837ee68efc9ada93691e8958a5f` | 107873552 | 103661 | 0 | 0 | Market status became `3` (`Refunded`). |
| `RefundBets` | `0x1b44f38146316a15523dde7effc03877e4c91e8697fccbd23ff17d4e6e08e3ca` | 107873570 | 188722 | +100000000000000000000 | -100000000000000000000 | Bet state became `1` (`Refunded`), refunded amount 100 ODD. |
| `PushRefundMarket` | `0xe698beb0771060413c840ce476f8a745dbb6e2055285ac635b43d58b1fb2a3f1` | 107873590 | 213345 | +100000000000000000000 | -100000000000000000000 | Bet state became `1` (`Refunded`), market status became `3` (`Refunded`). |

## Accounted Balance Checks

| Step | BettingPool `accountedBalance` before | BettingPool `accountedBalance` after | Delta |
| --- | ---: | ---: | ---: |
| `PlaceRefundBet` | 1181976600000000000000 | 1281976600000000000000 | +100000000000000000000 |
| `PlacePushBet` | 1281976600000000000000 | 1381976600000000000000 | +100000000000000000000 |
| `SettleRefundBetsMarket` | 1381976600000000000000 | 1381976600000000000000 | 0 |
| `RefundBets` | 1381976600000000000000 | 1281976600000000000000 | -100000000000000000000 |
| `PushRefundMarket` | 1281976600000000000000 | 1181976600000000000000 | -100000000000000000000 |

## Verification

- `go test ./...`: PASS
- `go test ./pkg/oddfi -run TestE2ENewBettingPoolWriteMethods -count=1 -v -timeout 25m`: PASS
