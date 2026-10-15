# Contract Scenario Test Cases

Date: 2026-05-08

## Purpose

This document stores the test method and latest result for the pure-contract acceptance scenarios supplied by the product rules matrix. It is intentionally limited to chain-observable behavior: permissions, state transitions, accounting, parameters, events, time boundaries, and cross-contract linkage.

The full product-rule scenarios are contract acceptance tests. They should be implemented in the contract repository with Foundry, using the product documents as the source of truth. This SDK repository records the acceptance plan and runs the SDK-level read-only chain probe that can be executed from the public SDK.

## Scope

- In scope: ODDToken, BettingPool, StakingPool, LiquidityPool, referral/tax accounting, payout waterfall, pause/permission boundaries, read-only proxy configuration checks.
- Out of scope: Redis, WebSocket, Telegram, PagerDuty, frontend UI, backend queue/cache, external odds fetch, operational review queue, multisig wallet implementation, multisig approval workflow.
- SDK-executable in this repository: read-only proxy calls for all four configured contracts, public `pkg/oddfi` write scenarios for ODDToken / StakingPool / LiquidityPool / BettingPool, plus supplemental adapter/binding write scenarios.
- Contract-executable in `odd-contract_odd`: all state-changing acceptance cases such as `placeBet`, `settle`, `claimPayout`, `stake`, `deposit`, `requestUnbond`, waterfall settlement, tax allocation, and permission reverts.

## Environment

### SDK Read-Only E2E

Command shape:

```bash
ODDFI_E2E=1 \
ODDFI_RPC_URL=<redacted> \
ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C \
ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 \
ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f \
ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F \
go test ./pkg/oddfi -run TestReadOnlyE2EAllConfiguredContracts -count=1
```

Latest result:

| Test | Result | Notes |
| --- | --- | --- |
| `TestReadOnlyE2EAllConfiguredContracts` | PASS | Completed in 10.897s. RPC URL redacted. No private key used. No transaction broadcast. |

### SDK Write E2E

Primary public SDK command shape:

```bash
ODDFI_WRITE_E2E=1 \
ODDFI_RPC_URL=<redacted> \
ODDFI_PRIVATE_KEY=<redacted> \
ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C \
ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 \
ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f \
ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F \
go test ./pkg/oddfi -run 'TestWriteScenario.*ViaPublicSDK' -count=1 -v
```

Latest result:

| Test | Result | Notes |
| --- | --- | --- |
| `TestWriteScenario.*ViaPublicSDK` | PASS | Each contract scenario is now an independent test. The latest recorded combined run before the split completed in 75.49s. Tx hashes and balance deltas are stored in `docs/testing/write-scenario-results.md`. |

### Contract Foundry Acceptance

Command shape for the contract repository:

```bash
cd /Users/hawkwu/Desktop/odd-contract_odd
MAINNET_FORK_RPC_URL=<redacted> forge test --match-path 'test/acceptance/**/*.t.sol' -vvv
```

Recommended implementation layout:

| Test file | Scenario group |
| --- | --- |
| `test/acceptance/ODDTokenAcceptance.t.sol` | `DEP-*` |
| `test/acceptance/ReferralTaxAcceptance.t.sol` | `REF-*`, `TAX-*` |
| `test/acceptance/BettingPoolAcceptance.t.sol` | `BET-*`, `SPC-*`, selected `SEC-*` |
| `test/acceptance/StakingPoolAcceptance.t.sol` | `STK-*` |
| `test/acceptance/LiquidityPoolAcceptance.t.sol` | `LP-*` |
| `test/acceptance/WaterfallAcceptance.t.sol` | `WFL-*` |
| `test/acceptance/SecurityPauseAcceptance.t.sol` | `SEC-*` |

Latest result:

| Test suite | Result | Notes |
| --- | --- | --- |
| Foundry acceptance suite | NOT RUN in this SDK repository | Requires implementation in `/Users/hawkwu/Desktop/odd-contract_odd` and fork/test fixtures. |

## Scenario Test Case Matrix

Result values:

- `PASS`: executed and passed in the latest recorded run.
- `NOT RUN`: not executed in this repository.
- `BLOCKED`: cannot execute until a scope decision or fixture exists.
- `OUT OF SCOPE`: intentionally not part of pure contract tests.

### ODD / Basic Permission

| ID | Priority | Test method | Latest result |
| --- | --- | --- | --- |
| DEP-001 | P0 | Foundry: assert total supply, initial recipient balance, no product-excluded mint path. SDK: `ODDToken.TotalSupply` probe. | SDK probe PASS; Foundry NOT RUN |
| DEP-002 | P0 | Foundry: ERC20/BEP20 method behavior and removed v1 tax/whitelist/referral interfaces. | NOT RUN |
| DEP-003 | P0 | Foundry: transfer exact amount and assert no tax-side balance changes. | NOT RUN |
| DEP-004 | P0 | Foundry: non-owner/non-settler permission reverts for pause/config/settlement. | NOT RUN |
| DEP-005 | P0 | Foundry: ODD pause blocks transfer-dependent paths and unpause restores them. | NOT RUN |

### Referral / Bet Tax / Payout Tax

| ID range | Priority | Test method | Latest result |
| --- | --- | --- | --- |
| REF-001 to REF-005 | P0 | Foundry: explicit/auto referrer binding, immutable binding, invalid binding reverts, no staking prerequisite. | NOT RUN |
| TAX-001 to TAX-005 | P0/P1 | Foundry: bet tax accounting, min bet boundary, balance/allowance failure, floor rounding. | NOT RUN |
| TAX-006 to TAX-011 | P1 | Foundry: late binding snapshot rules, payout tax split, no-referrer fallback, settle-time tax snapshot, floor remainder. | NOT RUN |
| TAX-012 to TAX-014 | P1 | Foundry: referral claim idempotency, owner tax/config changes, no payout tax on loss/refund/principal-only cases. | NOT RUN |
| TAX-015 to TAX-017 | P2 | Foundry: defensive payout edge cases and non-contract blacklist scope confirmation. | BLOCKED pending scope freeze |

### Betting Pool

| ID range | Priority | Test method | Latest result |
| --- | --- | --- | --- |
| BET-001 to BET-003 | P0/P1 | Foundry: market open/lock checks, successful `placeBet` ledger changes, settlement state transitions. SDK: read-only `BettingPool.PlatformReserve`. | SDK probe PASS; Foundry NOT RUN |
| BET-004 to BET-006 | P0/P1 | Foundry: `claimPayout` state guards, successful terminal state, no claim deadline. | NOT RUN |
| BET-007 to BET-009 | P0/P1 | Foundry: insufficient payout balance, settlement pause behavior, pause blocks bet/claim/referral claim. | NOT RUN |

### Staking Pool

| ID range | Priority | Test method | Latest result |
| --- | --- | --- | --- |
| STK-001 to STK-004 | P0/P1 | Foundry: stake plans, min stake, stake ledger, reward-per-share distribution, payout-tax reward injection. SDK: read-only `StakingPool.MinStakeAmount`. | SDK probe PASS; Foundry NOT RUN |
| STK-005 to STK-008 | P0/P1 | Foundry: normal unstake, early unstake principal/positive-reward penalty, penalty redistribution, all-users-unstake edge. | NOT RUN |
| STK-009 | P2 | Foundry: zero total-weight reward behavior. | BLOCKED pending M4 scope freeze |
| STK-010 to STK-017 | P0/P1/P2 | Foundry: VIP boundaries, pause coupling, query accuracy, multi-position accounting, insufficient balance, no v1 `stakeFor`. | NOT RUN / BLOCKED where scope-dependent |

### Liquidity Pool / LP

| ID range | Priority | Test method | Latest result |
| --- | --- | --- | --- |
| LP-001 to LP-002 | P0 | Foundry: global/match pool deposit plans, minimum deposit, match-pool close after start. SDK: read-only `LiquidityPool.MinDeposit`. | SDK probe PASS; Foundry NOT RUN |
| LP-003 | P2 | Foundry: independent match pool multiplier fixed at 1.0x. | BLOCKED pending H3 scope freeze |
| LP-004 to LP-007 | P1 | Foundry: margin split, no-LP reserve path, L2 loss split, liquidated principal floor. | NOT RUN |
| LP-008 to LP-014 | P0/P1 | Foundry: requestUnbond state guards, P&L freeze, 2-epoch withdraw, withdrawal amounts, no early exit, multi-position and state machine. | NOT RUN / BLOCKED where M3 scope-dependent |
| LP-015 to LP-024 | P1/P2 | Foundry: one-sided pool margin/loss, post-end deposit rejection, unbond irreversibility, pause, epoch edge, display multiplier exclusion. | NOT RUN / BLOCKED where scope-dependent |

### Reserve Waterfall

| ID range | Priority | Test method | Latest result |
| --- | --- | --- | --- |
| WFL-001 to WFL-005 | P0/P1 | Foundry: L1-only settlement, L2 loss, skip zero L2, L3 taxBuffer, L4 reserve and `ReserveTapped`. | NOT RUN |
| WFL-006 to WFL-008 | P0/P1 | Foundry: reserve threshold events, emergency floor pause, reserve refill and manual recovery. | NOT RUN |
| WFL-009 to WFL-014 | P0/P1 | Foundry: refill priority, taxBuffer cap overflow, illegal external transfer isolation, all-layer exhaustion, invariant guards, direct L4 when L3 zero. | NOT RUN |
| WFL-015 to WFL-018 | P1 | Foundry: threshold de-dup/re-trigger, reserve above initial constant, empty initial reserve, no retroactive refill to withdrawn LP. | NOT RUN |

### Special Market Rules

| ID | Priority | Test method | Latest result |
| --- | --- | --- | --- |
| SPC-001 | P1 | Foundry: handicap `-1` push refunds both sides. | BLOCKED pending Push delivery scope |
| SPC-002 | P1 | Foundry: half-ball lines do not push. | NOT RUN |
| SPC-003 | P2 | Foundry if parlay contract exists: same-match restriction, max 6 legs, max x200 total odds, max payout. | BLOCKED pending parlay contract scope |
| SPC-004 | P1 | Foundry: push affects only target market, not other same-match markets. | BLOCKED pending Push delivery scope |

### Pause / Security / Regression

| ID | Priority | Test method | Latest result |
| --- | --- | --- | --- |
| SEC-001 | P1 | Foundry: BettingPool pause does not mutate existing order states. | NOT RUN |
| SEC-002 | P1 | Foundry: emergency pause blocks new bets but preserves existing settlement flow. | NOT RUN |
| SEC-003 | P0 | Foundry: `claimPayout` replay protection. | NOT RUN |
| SEC-004 | P0 | Foundry: referral claim replay protection. | NOT RUN |
| SEC-005 | P0 | Foundry: tax/config upper-bound reverts. | NOT RUN |
| SEC-006 | P1 | Foundry: min/max/cap/floor boundary regression. | NOT RUN |

## Current Executed SDK Scenario Details

| Probe | Expected | Result |
| --- | --- | --- |
| `ODDToken.Name` | Contract call succeeds through proxy. | PASS |
| `ODDToken.TotalSupply` | Contract call succeeds and returns `*big.Int`. | PASS |
| `StakingPool.MinStakeAmount` | Contract call succeeds through proxy. | PASS |
| `LiquidityPool.MinDeposit` | Contract call succeeds through proxy. | PASS |
| `BettingPool.PlatformReserve` | Contract call succeeds through proxy. | PASS |

## Required Next Step For Full Contract Acceptance

Create the Foundry acceptance suite in `/Users/hawkwu/Desktop/odd-contract_odd/test/acceptance/` with one test function per scenario ID. The test names should preserve the scenario ID, for example:

```solidity
function test_DEP_001_fixedTotalSupplyAndNoMintPath() public {}
function test_TAX_008_defaultPayoutTaxSplit() public {}
function test_WFL_009_refillPriorityLpDeficitTaxBufferReserve() public {}
```

Each Foundry test should record:

- scenario ID;
- pre-state balances and internal ledgers;
- action transaction;
- expected events;
- post-state balances and ledgers;
- exact revert selector when failure is expected;
- whether the scenario blocks mainnet/audit if failing.
