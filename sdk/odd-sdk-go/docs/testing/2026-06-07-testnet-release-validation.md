# Testnet Release Validation Report

**Date:** 2026-06-07  
**Network:** BSC Testnet (`chain_id=97`)  
**SDK commit under test:** `3cc1aa5` (`v0.0.11`)  
**Result:** PASS. All requested frontend/backend contract paths were validated on testnet, including final LP withdrawal after the on-chain epoch gate elapsed.

## Scope

This report records the testnet validation for the current deployed contract set after exposing the API surface documented in `docs/architecture/contract_api.md`.

Validated paths:

- Contract source verification status.
- ODD token transfer and approve.
- Staking.
- Global LP deposit.
- Platform reserve funding.
- Single-match LP deposit, request unbond, and final withdraw.
- Normal single bet placement.
- Score settlement and payout claim.
- Cash out.
- Parlay preview, placement, settlement, and payout claim.

Secrets used for this run were provided only as process environment values and were not written to the repository:

- `ODDFI_PRIVATE_KEY=<redacted>`
- `ODDFI_RPC_URL=<redacted>`
- `BSCSCAN_API_KEY=<redacted>`

## Deployed Addresses

| Contract | Address | Verification |
|---|---|---|
| `ODDToken` proxy | `0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0` | Verified (`ERC1967Proxy`) |
| `StakingPool` proxy | `0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A` | Verified (`ERC1967Proxy`) |
| `LiquidityPool` proxy | `0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa` | Verified (`ERC1967Proxy`) |
| `BettingPool` proxy | `0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291` | Verified (`ERC1967Proxy`) |
| `BettingSettlementModule` | `0xf2dAA51f6432be46852604A8DED5F042cE4576eD` | Verified (`BettingSettlementModule`) |
| `BettingParlayModule` | `0x3CEBdFB4F753F448F5C2872321144878b29a69DD` | Verified (`BettingParlayModule`) |
| `BettingParlayLens` | `0x8DF283608C37c387513810CdF9E3de171B09F6fC` | Verified (`BettingParlayLens`) |

Compiler version reported by Etherscan V2 for all verified contracts: `v0.8.28+commit.7893614a`.

## Commands

Base environment shape:

```bash
ODDFI_PRIVATE_KEY=<redacted>
ODDFI_RPC_URL=<redacted>
ODDFI_ODD_TOKEN_PROXY=0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0
ODDFI_STAKING_POOL_PROXY=0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A
ODDFI_LIQUIDITY_POOL_PROXY=0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa
ODDFI_BETTING_POOL_PROXY=0x7baa77cFf4Ea502f7FFF554Ad422dFBd957bF291
ODDFI_BETTING_PARLAY_LENS=0x8DF283608C37c387513810CdF9E3de171B09F6fC
```

Executed:

```bash
go test ./...
ODDFI_WRITE_E2E=1 go test ./pkg/oddfi -run 'TestWriteScenario.*ViaPublicSDK' -count=1 -v -timeout 15m
ODDFI_FULL_E2E=1 ODDFI_FULL_E2E_TOP_UP_RESERVE=1 ODDFI_FULL_E2E_WAIT_WITHDRAW=20m go test ./pkg/oddfi -run '^TestE2EFullMatchScenario$' -count=1 -v -timeout 45m
ODDFI_FULL_E2E=1 go test ./pkg/oddfi -run '^TestE2EWithdrawOnly$' -count=1 -v -timeout 10m
```

Cash out and parlay validation used a temporary local E2E test file that was removed after the run. It did not contain secrets and was not committed.

## Validation Matrix

| Area | Result | Evidence |
|---|---|---|
| Compile/unit package tests | PASS | `go test ./...` |
| ODD transfer | PASS | `0x74a072b2543a3e66a231fd767fafc4f549629482f33f5d64d0e2116a67a7465b` |
| ODD approve | PASS | `0x05d90b35d38d39074ebf712178938597d3c869c45d112f7d8a8f0ccd34dbd1eb` |
| Staking | PASS | `0xdb350fe804010cad51c6b06feb783352fa12a9c76b4b5d643bbc1edddc0f9e7c` |
| Global LP deposit | PASS | `0x2d39b71d3c1a2db64e7e1a7ba85e8e83bbf938739ca9e9def783bc02ea7cd9dc` |
| Add platform reserve | PASS | `0x4c3b9740a8456938d6d03af0a4b519cb60625d9f5110532b07817cabbbce7821` |
| Open market | PASS | `0x2a35e776c92bad9c4cb68f26d95f7a11262b9f8db4d33f8279525339dec00686` |
| Deposit match LP | PASS | `0x0418f71b385804a25d1c2cd147603cebca642b5e5975e45cd0eb378bbc49aff3` |
| Place normal bet | PASS | `0xb5c5737d5bfbc03fffb87d6081b0315896276f9808302c95fc5535a09b02eaf0` |
| Score settlement | PASS | `0x4b0a4a59c0440c06381a08f8268c2a5d8b26e9815520d6aff4785817e96e8a9d` |
| Finalize market settlement | PASS | `0x3f1ae8de92ce353c292d9f50621e4c0f5c326adfe05cb0597f8f135a0e17b025` |
| Claim normal payout | PASS | `0xf445c349746e8ec828dcfaeb2333cce1b14644abace3e718ab8b9fb62f32f24f` |
| Request LP unbond | PASS | `0x8d31fa1f7cadfe0a6d8d6bc9aba2504a47cba6e69bd4fbf052efcaa01b80678d` |
| Final LP withdraw | PASS | `0xd4f389083662daca91711017000b48a216eda60317a235e2ff85164681e3c110` |
| Cash out | PASS | `0xaacc8c4735e3ed27ba83bcba322ed9af9e6c4ccd3b7c31859877dc9ddca2072e` |
| Parlay preview | PASS | `raw_combo_odds=40000`, `locked_combo_odds=40000`, `max_payout=400 ODD` |
| Place parlay | PASS | `0x23e5a70912fb2c72f118854e15d428b8c4233559fee940ed631277b92ac39617` |
| Settle parlay | PASS | `0x7b70c5f497c408217feb3bfedbe9af38f6821296e0cec60ce0d0781d63c0d7e6` |
| Claim parlay payout | PASS | `0x66713f63f93c8748aa7085f1ccdf6e1d880f24375b29ff5bb7fbdbbe1a06ee89` |

## Normal Bet Scenario

Identifiers:

| Item | Value |
|---|---|
| Admin | `0x7501bCBFAAa99e6390577277D051A32ec2e64064` |
| Generated bettor | `0x96f9275120346B2726ae3CB2e744Db86063d7928` |
| match_id | `0xb185eefddfc29da074e836f2d065c1cd9bc001393288550946be6fcac1f8099e` |
| market_id | `0xbca95a08dcf5b422130a0914ad03c80467965ab4c63b5ad1a2f43327a2af671d` |
| bet_id | `0x0000000000000000000000000000000000000000000000000000000000000231` |
| LP position ID | `47` |

Outcome:

- `placeBet` accepted `100 ODD`, plus `1 ODD` bet tax.
- Score settlement used final score `2-1`, making outcome `0` a full win.
- `GetBet` after settlement returned `settlement_state=3` (`WonUnclaimed`) and `claimable_payout=200 ODD`.
- `claimPayout` succeeded and moved the bet to `settlement_state=4` (`WonClaimed`).
- Bettor net payout delta was `+190 ODD`, matching a 5% payout tax on `200 ODD`.

## Cash Out Scenario

Identifiers:

| Item | Value |
|---|---|
| Generated bettor | `0xCFf3b31E447B8C72a030D41b2439Cf26c63FcB2E` |
| cashout bet_id | `0x0000000000000000000000000000000000000000000000000000000000000232` |

Outcome:

- `placeBet` accepted `100 ODD`, plus `1 ODD` bet tax.
- `cashOut` succeeded before market terminal state.
- Bettor ODD delta: `+80 ODD`.
- BettingPool ODD delta: `-80 ODD`.
- Platform reserve increased by `20 ODD`.
- Final bet state: `5` (`CashedOut`).

## Parlay Scenario

Identifiers:

| Item | Value |
|---|---|
| Generated bettor | `0xCFf3b31E447B8C72a030D41b2439Cf26c63FcB2E` |
| parlay_id | `0xc4a0a5dd6a48844431d0c4b053340346319df80ea42c153f79c1c76c3d339b9b` |
| market 1 | `0x099dfca2fab4112b10d794edc1c90fd12e7657318ffacd9c8f799c2a8455a07f` |
| market 2 | `0xc48e2a07a0e33418edd48e3a2ef8d4b81b34bf6afc592546b988ae19a48eec7d` |

Outcome:

- `BettingParlayLens.previewParlay` returned:
  - `raw_combo_odds=40000`
  - `locked_combo_odds=40000`
  - `max_payout=400 ODD`
  - `capped_by_odds=false`
  - `capped_by_payout=false`
- `placeParlay` accepted `100 ODD`, plus `1 ODD` bet tax.
- Both underlying markets were score-settled and finalized with score `2-1`.
- `settleParlay` succeeded and set `claimable_payout=400 ODD`.
- `claimParlayPayout` succeeded.
- Bettor ODD delta on claim: `+380 ODD`, matching a 5% payout tax on `400 ODD`.
- Final parlay state: `3` (claimed terminal state).

## Liquidity Unbond And Withdraw

Position `47` was created by the normal single-match flow with `DepositMatch`.

`RequestUnbond` succeeded:

- tx: `0x8d31fa1f7cadfe0a6d8d6bc9aba2504a47cba6e69bd4fbf052efcaa01b80678d`
- position state after request: `1` (`Unbonding`)
- `total_active_deposited` delta: `-1000 ODD`
- `requestable_liquidity` delta: `-995.534883720930232 ODD`

The initial 20 minute wait did not reach the required epoch. On-chain state and revert data showed:

- `unbonding_epoch=134`
- `unbond_epochs=2`
- required epoch: `137`
- observed `EpochNotReady(currentEpoch=134, requiredEpoch=137)`, later `135 -> 137`, then `136 -> 137`

Epoch timing was calculated from chain reads:

- `epochStart = 1780315200` (`2026-06-01T12:00:00Z`)
- epoch duration inferred from contract epoch progression: `3600s`
- epoch `137` start: `1780808400` (`2026-06-07T05:00:00Z`)

After epoch `137` became active, `TestE2EWithdrawOnly` succeeded:

- tx: `0xd4f389083662daca91711017000b48a216eda60317a235e2ff85164681e3c110`
- block: `111922968`
- gas used: `107191`
- user ODD delta: `+995.534883720930232 ODD`
- LiquidityPool ODD delta: `-995.534883720930232 ODD`

## Notes

- One RPC retry returned `503 Service Unavailable`; the subsequent retry continued normally. This was treated as a transient infrastructure response, not a contract failure.
- `BettingPool.settlementModule()` returned `0xf2dAA51f6432be46852604A8DED5F042cE4576eD`.
- `BettingPool.parlayModule()` returned `0x3CEBdFB4F753F448F5C2872321144878b29a69DD`.
- No private key, private RPC URL, or explorer API key was written to repository files.
- Temporary local E2E code used for cash out and parlay validation was removed after the run.

## Conclusion

The current BSC testnet deployment passed the requested release validation. Normal betting, cash out, score settlement, payout claim, parlay placement/settlement/claim, staking, adding liquidity, requesting unbond, and final liquidity withdrawal all completed successfully on-chain.
