# Flow1 / Flow2 E2E parity — design

Date: 2026-05-06
Author: niall (paired)
Status: pending review

## Goal

Mirror the SDK's `sdk/e2e/flow1_test.go` and `flow2_test.go` end-to-end flows
inside this project, driven by `business.Service` calls. Wrap every contract
method those two SDK tests use as a Service-level method here, so the same
flows can run through this library against BSC testnet.

Out of scope for this design: Flow 3 (credit bet), Flow 1 resume, Flow 2
mainnet Safe propose path (testnet-only here).

## Confirmed decisions

1. **User-private-key actions (USDT.transfer, BettingPool.withdraw): test
   helpers, NOT exported package.** Code lives next to the e2e tests, never
   reachable from `business.Service`. Rationale: production servers should not
   be in the business of holding user PKs; an exported `userops/` API would
   invite misuse.

2. **Settle: testnet-direct path only for now.** Testnet has admin EOA ==
   multisig EOA, so admin signer calls `bp.Settle` via the abigen binding.
   Mainnet's Safe-propose path is deferred to a separate effort (would live
   under `multisig/` next to ELW/RLW).

3. **New admin writes go through the full chain_actions pipeline.** Same
   shape as the existing `LockBet` / `CreditDeposit`: insert pending row →
   simulate → lease nonce → broadcast → mark submitted → Watcher tracks to
   confirmed. Each op exposes `Simulate{Op}` / `Submit{Op}` / `{Op}AndWait`.

## Architecture

### A. New admin writes (`writes/`)

Four new files, each ~80 LOC, sibling to `lockbet.go` / `creditdeposit.go`:

| File | Req struct | SDK call wrapped |
|---|---|---|
| `writes/openmarket.go` | `OpenMarketReq{MatchID, Market, Line, IdempotencyKey}` | `Admin.OpenMarket` |
| `writes/closemarket.go` | `CloseMarketReq{MatchID, Market, Line, IdempotencyKey}` | `Admin.CloseMarket` |
| `writes/lockparlay.go` | `LockParlayReq{ParlayID, User, Stake, Token, MatchIDs[], Markets[], Outcomes[], Lines[], LegOdds[], LegBetIDs[], IdempotencyKey}` | `Admin.LockParlay` |
| `writes/settle.go` | `SettleReq{MatchID, Market, Line, WinningOutcome, BetIDs[], IdempotencyKey}` | `bp.Settle` (binding direct) |

Each service exposes:
- `Simulate(ctx, req) error`
- `Submit(ctx, req) (TxHash, ActionID, error)`
- `{Op}AndWait(ctx, req, opts...) (Result, error)`

`Settle` differs from the others in one detail: the SDK admin client doesn't
expose `Settle` (it's gated `onlyMultisig`), so `writes/settle.go` calls the
abigen binding `bettingpool.NewBettingPool(...)` directly using the admin
signer's `bind.TransactOpts`. Same chain_actions pipeline either way.

### B. User-side test helpers

Live in the e2e test files themselves (build-tagged `e2e`), not exported:

```go
// in flow1_e2e_test.go (or a shared e2e_helpers_test.go)
func userTransferUSDT(t *testing.T, conn *client.Connection, userPK string,
    to common.Address, amount *big.Int) common.Hash

func userWithdraw(t *testing.T, conn *client.Connection, userPK string,
    bpAddr common.Address, amount *big.Int) common.Hash
```

Both: load signer from PK → `bind.TransactOpts` → call binding → `bind.WaitMined`
→ return tx hash. No DB, no idempotency, no Watcher.

### C. Service-level surface (`methods.go` additions)

```go
func (s *Service) SimulateOpenMarket(ctx, req) error
func (s *Service) SubmitOpenMarket(ctx, req) (TxHash, ActionID, error)
func (s *Service) OpenMarketAndWait(ctx, req, opts...) (Result, error)
// ...same triple for CloseMarket, LockParlay, Settle
```

No user-side methods exposed (per decision 1).

### D. Wiring (`service_wire_full.go`)

Extend `internalWiring` with four new fields:
```go
openMarket  *writes.OpenMarketService
closeMarket *writes.CloseMarketService
lockParlay  *writes.LockParlayService
settle      *writes.SettleService
```

Construct alongside existing `lockBet` / `creditDeposit` in `wireFull`. The
`Settle` service additionally needs `eth *ethclient.Client` + the BettingPool
address from the SDK connection — both already in scope.

### E. E2E test files

Three new files, build tag `//go:build e2e`:

| File | Purpose |
|---|---|
| `e2e_helpers_test.go` (project root, package `business_test`) | `rand32`, `usdt6`, `signed`, `userTransferUSDT`, `userWithdraw`, env loading |
| `flow1_e2e_test.go` | `TestFlow1_E2E` — 7 steps, mirroring SDK `flow1_test.go` |
| `flow2_e2e_test.go` | `TestFlow2_E2E` — 10 steps, mirroring SDK `flow2_test.go` |

Test setup follows `sponsored/withdraw_e2e_test.go`:
- `testdb.NewMySQL(t)` → MySQL container with migrations applied
- `business.New(business.Config{...})` with admin PK from `E2E_ADMIN_PK`
- User PK from `E2E_USER_PK`, used only via the test helpers above
- Env vars: `E2E_RPC`, `E2E_ADMIN_PK`, `E2E_USER_PK`, with sane testnet
  defaults baked in (matching `sponsored/withdraw_e2e_test.go` style)
- Tokens map populated with USDT address from SDK connection
  (`conn.USDTAddr()`)

Each step in the flow:
1. Call `svc.Simulate{Op}(ctx, req)` if it's an admin write — assert no error
2. Call `svc.{Op}AndWait(ctx, req)` — assert `Status == StatusConfirmed`
3. Read post-state via SDK bindings (`bp.UserBalances`, `bp.LockedBalances`,
   `bp.Parlays`, `usdt.BalanceOf`) — assert per the SDK e2e expectations

### F. Constants

Verbatim from SDK README:
```go
// flow1
const (
    f1Stake      int64 = 1_000_000  // 1 USDT
    f1Odds       int64 = 1818       // 1.818x
    f1Market     uint8 = 0          // X12
    f1Line       uint8 = 0
    f1BetOutcome uint8 = 1
    f1Winning    uint8 = 1
)
// flow2
const (
    f2Stake     int64 = 1_000_000   // 1 USDT
    f2LegOdds   int64 = 1500        // combined 2 legs = 2250
    f2Market    uint8 = 0
    f2Line      uint8 = 0
    f2Outcome   uint8 = 1
    f2Winning   uint8 = 1
    f2NumLegs         = 2
)
```

## Data flow (Flow 1, 7 steps)

```
Step 0   admin    SubmitOpenMarket          → confirmed
Step 1   user     userTransferUSDT          → tx hash (becomes step 2 dedup key)
Step 2   admin    SubmitCreditDeposit       → confirmed (OffchainTxHash = step 1 hash)
Step 3   admin    SubmitLockBet             → confirmed
Step 3.5 admin    SubmitCloseMarket         → confirmed
Step 4   admin    SubmitSettle              → confirmed (admin-direct binding)
Step 5   user     userWithdraw              → tx hash, drain BettingPool credit
```

Flow 2 expands to 10 steps (2× OpenMarket, 1× LockParlay instead of LockBet,
2× CloseMarket, 2× Settle, ...).

## Error handling

Inherited from existing pipeline:
- Sim revert → `ErrSimulationFailed`, no broadcast
- RPC error during broadcast → `ErrRPC`, nonce released without bump
- On-chain revert (receipt status=0) → row marked `failed`, `WaitTerminal`
  returns `ErrReverted`
- Test-side: `t.Fatalf` on any error after first; flows are sequential and
  not designed to recover. Resume tests are out of scope.

## Testing approach

- Tests are build-tagged `e2e`, won't run in normal `go test ./...`
- Run manually: `go test -tags=e2e -count=1 -v -timeout=15m -run TestFlow1_E2E`
- Pre-flight check: assert admin signer matches `conn.EnvConfig().ExpectedAdmin()`
- USDT balance check on user wallet before kicking off (≥ stake)
- Each step logs to `t.Log` with bscscan link, mirroring SDK e2e style

Repeated runs: every test generates fresh `matchID` / `betID` / `parlayID`
via `rand32` and uses a fresh USDT.Transfer hash for the `creditDeposit`
dedup key, so re-running doesn't collide with prior on-chain state.

## Open items / risks

1. **MySQL container availability**: tests skip if testcontainers can't start
   docker (per `internal/testdb/testdb.go` recover). On a CI/dev box without
   docker, tests are silently skipped. Acceptable.

2. **Watcher polling cost**: `{Op}AndWait` polls the chain_actions row at
   `WaitPollInterval` (default 1s). For a 7-step flow, this means ~7 polling
   cycles each waiting for confirmation. Total runtime ~50-90s on testnet,
   matching SDK e2e timings (47s, 58s reported in README).

3. **Settle as admin-direct**: testnet only. If the contract on testnet ever
   gets re-deployed with a real Safe as multisig, this path breaks. Mitigation:
   check `bp.Multisig() == admin.Address()` at test start and skip if not.

4. **Tokens config**: tests need the project's `Config.Tokens` USDT entry to
   carry the deployed USDT address. The SDK `Connection.USDTAddr()` returns
   it — tests build the map at setup time. Real callers of the library still
   pass it in via `Config.Tokens`.

## Acceptance criteria

- `go test -tags=e2e -count=1 -v -timeout=10m -run TestFlow1_E2E ./...` PASS
  with all 7 admin/user txs mined on BSC testnet
- `go test -tags=e2e -count=1 -v -timeout=15m -run TestFlow2_E2E ./...` PASS
  with all 10 txs mined and combinedOdds = 2250 verified
- `go vet ./...` and `go test ./...` (no `-tags=e2e`) still pass — no
  regression in non-e2e tests
- New service methods follow existing naming and idempotency conventions
