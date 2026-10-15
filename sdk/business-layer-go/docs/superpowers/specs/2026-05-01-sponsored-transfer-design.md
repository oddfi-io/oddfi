# Sponsored ERC20 Transfer (EIP-7702) — Design

**Date:** 2026-05-01
**Status:** Approved (chat brainstorming complete)
**Module:** `github.com/Crypto-Barrett/contracts-business-layer`
**Reference impl:** `D:/everything_finance/eip_7702_go/cmd/sponsored-abigen/main.go`

---

## 1. Purpose

Add a user-level operation: **A authorizes (EIP-7702), B pays gas, ERC20 token moves from A to C**. Caller hands in A's private key per call; B is the library's already-configured admin signer; C and the token are call-time parameters.

Unlike `LockBet` / `CreditDeposit`, this op is not a BettingPool admin write. It rides EIP-7702 + the `BatchCallAndSponsor` v2 implementation contract, with the ERC20 `transfer` packed via the abigen-generated `IERC20` binding from `eip_7702_go/bindings/erc20`.

---

## 2. Scope

### In scope (v1)

- One ERC20 `transfer` per sponsored call (single-leg)
- Decimals auto-fetched from the token's `decimals()`; caller passes human-readable `decimal.Decimal`
- Idempotent via `chain_actions` (same pipeline as `LockBet` / `CreditDeposit`)
- Two public forms:
  - `SubmitSponsoredTransfer` — broadcast, return `(TxHash, ActionID)`
  - `SponsoredTransferAndWait` — broadcast + block until terminal
- Pre-broadcast balance check (via abigen `balanceOf(A)`)

### Out of scope (v1)

- Multi-call batches (the underlying contract supports `Call[]`, but caller-facing v1 is one transfer)
- A public `Simulate*` form (EIP-7702 simulation is RPC-inconsistent; we do an internal balance precheck instead)
- ERC20 approval flows (transfer only)
- Decimals caching (one extra `decimals()` eth_call per Submit, ~50ms; v2 may add a cache)

---

## 3. File layout

| File | Change |
|---|---|
| `sponsored/transfer.go` | **new** — request struct + service + Submit/SponsoredTransferAndWait |
| `sponsored/transfer_test.go` | **new** — narrow unit tests (decimals scaling, hex key parsing) |
| `methods.go` | **edit** — append two `Service` methods |
| `service_wire_full.go` | **edit** — conditionally wire `sponsoredTransfer` |
| `config.go` | **edit** — add `SponsoredImplAddress` + `SponsoredDeadline` |
| `errors.go` | **edit** — add `ErrSponsoredNotConfigured` sentinel |
| `go.mod` / `go.sum` | **edit** — `require github.com/oddfi/eip7702-go-demo` + `replace ../../eip_7702_go` |

No schema changes — `chain_actions.op = "sponsoredTransfer"` slots into the existing table.

---

## 4. Public types

### 4.1 Request

```go
package sponsored

type SponsoredTransferReq struct {
    SenderPrivateKey string          // A's hex key, with or without 0x prefix
    TokenAddress     common.Address  // ERC20 contract
    To               common.Address  // recipient (= "C" in the 7702 demo)
    Amount           decimal.Decimal // human-readable, e.g. "1.5"
    IdempotencyKey   string          // chain_actions row idempotency
}
```

### 4.2 Service

```go
type SponsoredTransferService struct {
    Eth      *ethclient.Client
    Signer   sdksigner.Signer       // = B (admin signer, gas payer)
    Deps     writes.SubmitDeps
    ImplAddr common.Address         // BatchCallAndSponsor v2 contract
    Deadline time.Duration          // EIP-712 sig validity; default 10min
}

func NewSponsoredTransferService(eth, signer, deps, implAddr, deadline) *SponsoredTransferService

func (s *SponsoredTransferService) Submit(ctx, req) (coretypes.TxHash, coretypes.ActionID, error)
func (s *SponsoredTransferService) SubmitAndWait(ctx, req, opts ...coretypes.WaitOption) (coretypes.Result, error)
```

### 4.3 `Service` surface

```go
func (s *Service) SubmitSponsoredTransfer(ctx, req sponsored.SponsoredTransferReq) (TxHash, ActionID, error)
func (s *Service) SponsoredTransferAndWait(ctx, req sponsored.SponsoredTransferReq, opts ...WaitOption) (Result, error)
```

Both methods return `ErrSponsoredNotConfigured` if `Config.SponsoredImplAddress == (common.Address{})`.

---

## 5. Config additions

```go
// In Config
SponsoredImplAddress common.Address  // optional; zero ⇒ feature disabled
SponsoredDeadline    time.Duration   // optional; default 10min in validate()
```

`validate()` defaults `SponsoredDeadline` to `10 * time.Minute` when ≤ 0. `SponsoredImplAddress` stays zero-by-default to mark the feature as disabled.

---

## 6. Submit pipeline

The work splits into **outside-lease** (heavy crypto + RPC reads) and **inside-lease** (just the SetCodeTx broadcast). Holds B's nonce lock for the minimum window.

### 6.1 Outside the lease (in `Submit` body, before `SubmitPipeline`)

1. Parse A's hex key → `*ecdsa.PrivateKey`, derive `aAddr`.
2. `decimals := readDecimals(ctx, TokenAddress)` — manual eth_call with selector `0x313ce567`, parse `out[31]` as `uint8`.
3. `amount := money.ScaleToBase(req.Amount, decimals)` — `*big.Int` for the transfer.
4. `transferCalldata := erc20.NewIERC20().TryPackTransfer(req.To, amount)` — abigen v2 binding.
5. Read `chainID := s.Eth.ChainID(ctx)`.
6. Read `aTxNonce := s.Eth.NonceAt(ctx, aAddr, nil)` — for 7702 auth.
7. Read `contractNonce := eip7702demo.ReadContractNonce(ctx, s.Eth, aAddr)` — for Execute sig.
8. Compute `deadline := time.Now().Unix() + s.Deadline.Seconds()`.
9. `auth := eip7702demo.SignAuthorization(...)` — signed with A's key.
10. `executeSig := eip7702demo.SignExecute(...)` — signed with A's key.
11. `outerCalldata := eip7702demo.EncodeBatchExecute(calls, deadline, B.Address(), executeSig)`.

### 6.2 Inside `SubmitPipeline`

`Simulate` closure (cheap, runs once before lease):
- `balanceData := IERC20.PackBalanceOf(aAddr)`; eth_call → unpack → `*big.Int`
- If `balance < amount` → return `*coretypes.ErrSimulationFailed{Method: "sponsoredTransfer", Cause: ErrInsufficientBalance}`. The pipeline marks the row `failed("sim_failed")`.

`Broadcast` closure (runs inside `Lease.WithLockedNonce(ctx, fn(tx, bNonce))`):
1. Read `tipCap := SuggestGasTipCap`, `feeCap := SuggestGasPrice + tipCap`.
2. Build unsigned `*types.Transaction` from `&types.SetCodeTx{ChainID, Nonce: bNonce, GasTipCap, GasFeeCap, Gas: 500_000, To: aAddr, Data: outerCalldata, AuthList: [auth]}`.
3. `signed := s.Signer.SignTx(ctx, unsigned, chainID)` — uses the admin signer (B) without exposing its private key.
4. `s.Eth.SendTransaction(ctx, signed)`.
5. Return `signed`. The pipeline calls `repo.MarkSubmittedTx(tx, id, hash, bNonce)`.

The reason we don't reuse `eip7702demo.SignSetCodeTx` directly: it takes `*ecdsa.PrivateKey`, which the SDK `Signer` interface deliberately doesn't expose. We replicate the ~10 lines of SetCodeTx construction so signing stays inside `Signer.SignTx`.

---

## 7. Errors

| Failure | Error |
|---|---|
| Feature not configured (zero `SponsoredImplAddress`) | `ErrSponsoredNotConfigured` (new sentinel) |
| Bad hex key | wrapped error from `crypto.HexToECDSA`, surfaced as plain `error` (not typed) |
| `decimals()` reverts / RPC fails | `*coretypes.ErrRPC{Op: "decimals", Cause}` |
| `balanceOf(A) < amount` | `*coretypes.ErrSimulationFailed{Method: "sponsoredTransfer", Cause: ErrInsufficientBalance}` |
| Broadcast fails | `*coretypes.ErrRPC` (via SubmitPipeline) |
| Confirmed-but-reverted | `*coretypes.ErrReverted{Method: "sponsoredTransfer"}` |
| `ctx` timeout / mempool drop | `coretypes.ErrTimeout` / `coretypes.ErrDropped` |

`ErrInsufficientBalance` is a new package-level sentinel in `sponsored/`.

---

## 8. Wiring (service_wire_full.go)

`internalWiring` gains:

```go
sponsoredTransfer *sponsored.SponsoredTransferService
```

In step 10, after `creditDeposit`:

```go
if s.cfg.SponsoredImplAddress != (common.Address{}) {
    w.sponsoredTransfer = sponsored.NewSponsoredTransferService(
        w.eth, signer, subDeps,
        s.cfg.SponsoredImplAddress, s.cfg.SponsoredDeadline,
    )
}
```

Method handlers in `methods.go` first-line guard:

```go
if s.closed || s.wired == nil || s.wired.full == nil || s.wired.full.sponsoredTransfer == nil {
    return ..., ErrSponsoredNotConfigured  // distinguishes "service closed" from "feature off"
}
```

---

## 9. Testing

Mirror the narrow scope of `writes/lockbet_test.go` and `writes/creditdeposit_test.go`:

1. **Decimals scaling** — `Amount=1.5` with decimals=18 → `1.5e18` big.Int.
2. **Hex key parsing** — accepts `"0xabc..."`, `"abc..."`, rejects empty / non-hex.

Full pipeline + 7702 round-trip → `e2e/` against an anvil with the `BatchCallAndSponsor` deployed (out of v1 unit tests, like the rest).

---

## 10. Acceptance checklist

- [ ] `sponsored/transfer.go` exists with the public types and methods listed in §4.
- [ ] `sponsored/transfer_test.go` covers §9 cases and passes.
- [ ] `methods.go` exposes `SubmitSponsoredTransfer` and `SponsoredTransferAndWait` with the configured-or-`ErrSponsoredNotConfigured` guard.
- [ ] `service_wire_full.go` constructs `sponsoredTransfer` only when `SponsoredImplAddress != zero`.
- [ ] `config.go` declares `SponsoredImplAddress` + `SponsoredDeadline` and `validate()` defaults the deadline.
- [ ] `errors.go` exports `ErrSponsoredNotConfigured`.
- [ ] `go.mod` requires `github.com/oddfi/eip7702-go-demo` with the relative replace directive.
- [ ] `go build ./...` and `go vet ./...` clean.

---

**End of design document.**
