# CreditDeposit Implementation — Design

**Date:** 2026-05-01
**Status:** Approved (brainstorming complete; ready for plan)
**Module:** `github.com/Crypto-Barrett/contracts-business-layer`
**Parent spec:** `2026-05-01-contracts-business-layer-design.md` (§3.4, §9)

---

## 1. Purpose & Scope

Implement the `CreditDeposit` admin write op from the v1 method scope. The op records an off-chain user deposit on-chain, crediting `amount` USDT to a user's in-contract balance. The contract uses the off-chain tx hash as a one-shot dedup key, so at-most-once semantics are enforced contract-side regardless of our retries.

This is a focused extension following the `LockBet` template already established in `writes/lockbet.go`. No new infrastructure, no new background goroutines, no schema changes.

### Out of scope

- Higher-level resolver-driven wrapper (`SubmitPlaceCreditDeposit` etc.) — not listed in §9 of the parent spec.
- Multi-token expansion — contract is USDT-only at v1; the `Token` field is reserved for future contract upgrades.
- Off-chain tx-hash validation against any chain — the library trusts the caller's `OffchainTxHash` and lets the contract dedup.

---

## 2. File layout

| File | Change |
|---|---|
| `writes/creditdeposit.go` | **new** — mirrors `writes/lockbet.go` structure |
| `writes/creditdeposit_test.go` | **new** — mirrors `writes/lockbet_test.go` structure |
| `methods.go` | **edit** — append three `Service` methods after the LockBet block |
| `service_wire_full.go` | **edit** — add `creditDeposit` field to `internalWiring`; construct in step 10 |

No changes to `service.go`, `config.go`, `coretypes/`, `action/`, `migrations/`, or any goroutine.

---

## 3. Public types

### 3.1 Request

```go
package writes

type CreditDepositReq struct {
    User           common.Address          // already-resolved on-chain address (caller-supplied)
    Amount         decimal.Decimal         // human units; library scales by Tokens[Token].Decimals
    Token          coretypes.TokenSymbol   // must be configured in Config.Tokens
    OffchainTxHash common.Hash             // user's off-chain deposit tx hash; contract uses it as dedup key
    IdempotencyKey string                  // chain_actions.idempotency_key — distinct from OffchainTxHash
}
```

`OffchainTxHash` and `IdempotencyKey` are deliberately separate concerns:
- `OffchainTxHash` is the contract's dedup key (one credit per off-chain tx, ever).
- `IdempotencyKey` is `chain_actions`' dedup key (one row per logical request, retried safely from our side).

### 3.2 Service

```go
type CreditDepositService struct {
    Admin  *sdkadmin.Client
    Deps   SubmitDeps
    Tokens map[coretypes.TokenSymbol]coretypes.TokenInfo
}

func NewCreditDepositService(
    admin *sdkadmin.Client,
    deps SubmitDeps,
    tokens map[coretypes.TokenSymbol]coretypes.TokenInfo,
) *CreditDepositService

func (s *CreditDepositService) Simulate(ctx context.Context, req CreditDepositReq) error
func (s *CreditDepositService) Submit(ctx context.Context, req CreditDepositReq) (coretypes.TxHash, coretypes.ActionID, error)
func (s *CreditDepositService) CreditDeposit(ctx context.Context, req CreditDepositReq, opts ...coretypes.WaitOption) (coretypes.Result, error)
```

### 3.3 `Service` surface (public API)

Added to `methods.go`:

```go
func (s *Service) SimulateCreditDeposit(ctx context.Context, req writes.CreditDepositReq) error
func (s *Service) SubmitCreditDeposit(ctx context.Context, req writes.CreditDepositReq) (TxHash, ActionID, error)
func (s *Service) CreditDeposit(ctx context.Context, req writes.CreditDepositReq, opts ...WaitOption) (Result, error)
```

Each method's first action is the same closed/wired/full nil-check used by the LockBet methods, returning `ErrServiceClosed`.

---

## 4. Internal translation (`sdkArgs`)

```go
func (s *CreditDepositService) sdkArgs(req CreditDepositReq) (sdkadmin.CreditDepositArgs, error) {
    tok, ok := s.Tokens[req.Token]
    if !ok {
        return sdkadmin.CreditDepositArgs{}, &coretypes.ErrUnknownToken{Symbol: req.Token}
    }
    return sdkadmin.CreditDepositArgs{
        User:   req.User,
        Amount: money.ScaleToBase(req.Amount, tok.Decimals),
        TxHash: [32]byte(req.OffchainTxHash),
    }, nil
}
```

The `[32]byte(req.OffchainTxHash)` conversion is zero-cost because `common.Hash` is itself defined as `[32]byte`.

The token-decimals lookup is done through `Config.Tokens` rather than hardcoding 6, matching the LockBet path. The contract today rejects non-USDT, but that constraint lives in the contract; the library stays decimals-agnostic.

---

## 5. Submit pipeline reuse

The full `Submit` body is a one-liner that funnels into `writes.SubmitPipeline`, identical in shape to `LockBetService.Submit`:

```go
func (s *CreditDepositService) Submit(ctx context.Context, req CreditDepositReq) (coretypes.TxHash, coretypes.ActionID, error) {
    args, err := s.sdkArgs(req)
    if err != nil {
        return "", 0, err
    }
    return SubmitPipeline(ctx, s.Deps, SubmitInput{
        Op:             "creditDeposit",
        IdempotencyKey: req.IdempotencyKey,
        Args:           req,
        Simulate:       func(ctx context.Context) error { return s.Admin.SimulateCreditDeposit(ctx, args) },
        Broadcast:      func(ctx context.Context, _ uint64) (*types.Transaction, error) { return s.Admin.CreditDeposit(ctx, args) },
    })
}
```

This means we inherit all of: `chain_actions` insert with idempotency-key short-circuit, simulation-failure → `MarkFailed("sim_failed")`, signer-lease lock + nonce broadcast, `MarkSubmittedTx`. There is no new state machine logic, no new RPC orchestration.

`CreditDeposit` (the sync wrapper) is a two-line `Submit + WaitTerminal`, identical to `LockBetService.LockBet`.

---

## 6. Wiring

`internalWiring` gets one new field:

```go
creditDeposit *writes.CreditDepositService
```

Construction inserted in step 10, immediately after the LockBet line:

```go
w.creditDeposit = writes.NewCreditDepositService(admCli, subDeps, s.cfg.Tokens)
```

No changes to step ordering, no new dependencies pulled into the wiring closure, nothing in `close()` to add.

---

## 7. Errors

All paths funnel into existing error types:

| Failure | Error returned |
|---|---|
| `req.Token` not in `Config.Tokens` | `*coretypes.ErrUnknownToken{Symbol}` |
| Simulate revert (incl. duplicate `OffchainTxHash`) | `*coretypes.ErrSimulationFailed{Method: "creditDeposit", Cause}` |
| RPC error during broadcast | `*coretypes.ErrRPC` (wrapped by `SubmitPipeline`) |
| Confirmed-but-reverted | `*coretypes.ErrReverted{Method: "creditDeposit", TxHash, Revert}` |
| Mempool drop / ctx timeout | `coretypes.ErrDropped` / `coretypes.ErrTimeout` |
| Service closed | `ErrServiceClosed` |

No new sentinels, no new typed errors.

---

## 8. Testing

Mirror the scope of `writes/lockbet_test.go`, which by intent stays narrow at the unit-test layer (decimal scaling, error formatting) and delegates pipeline / DB / RPC integration to `e2e/`. So `writes/creditdeposit_test.go` covers:

1. **Decimals scaling** — `Amount=decimal.NewFromString("1.234567")` with `Decimals=6` → `money.ScaleToBase` returns `"1234567"`. Confirms USDT-style 6-decimal scaling matches the contract's `*big.Int` units.
2. **Unknown-token error** — `&coretypes.ErrUnknownToken{Symbol:"WETH"}` formats the symbol and `Config.Tokens` reference (mirrors the existing assertion).

End-to-end coverage of Submit → SDK broadcast → `chain_actions` lifecycle (happy path, sim revert, idempotency short-circuit) belongs in `e2e/` against anvil and is not introduced in this change.

Coverage target inherits the parent spec's "≥80% on core packages."

---

## 9. Acceptance checklist

- [ ] `writes/creditdeposit.go` exists with the public types and three methods listed in §3.
- [ ] `writes/creditdeposit_test.go` covers the cases in §8 and passes.
- [ ] `service_wire_full.go` constructs `creditDeposit` in step 10; no other steps changed.
- [ ] `methods.go` exposes `SimulateCreditDeposit`, `SubmitCreditDeposit`, `CreditDeposit` with the same closed/nil guard the LockBet methods use.
- [ ] `go vet ./...` and `go build ./...` clean.
- [ ] No changes to `migrations/`, `coretypes/`, `action/`, `service.go`, `config.go`.

---

**End of design document.** Implementation plan is generated separately via the writing-plans skill.
