# BettingPool cashOut API

**Date:** 2026-06-03
**Scope:** `contracts/abi`, `internal/infrastructure/bindings`, `internal/infrastructure/contracts`, `pkg/oddfi`

## Background

The updated BettingPool ABI adds `cashOut(bytes32,uint256,uint64,uint256,uint256)` and emits `BetCashedOut`. This lets a bet owner exit a pending bet before final market settlement, guarded by quote version, quote timestamp, minimum output, and deadline values supplied by the caller.

## API Change Surface

Public SDK additions:

- `BettingPool.CashOut(opts, betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)`
- `BettingPool.CashOutCalldata(betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)`

The write method follows existing passthrough rules: callers provide `*bind.TransactOpts`, keep control of signing, nonce, gas, and broadcasting behavior, and receive the submitted `*types.Transaction`.

`CashOutCalldata` is a pure local ABI encoder. It does not sign, broadcast, or query RPC, and rejects nil `*big.Int` quote/output/deadline parameters with `ErrNilBigIntParam`.

## Layering

Generated bindings remain internal under `internal/infrastructure/bindings`. The public facade exposes only go-ethereum common public types and SDK-owned facade methods. `BettingSettlementModule` remains an internal delegatecall implementation detail; callers use the BettingPool proxy facade.

## Test Plan

- Regenerate bindings with `go generate ./internal/infrastructure/bindings/...`.
- Add selector coverage for `CashOutCalldata`.
- Add nil `*big.Int` calldata validation coverage.
- Add missing-transactor coverage for the adapter write method.
- Run `go test ./pkg/oddfi ./internal/infrastructure/contracts`.
- Run broader `go test ./...` when local time permits.

## Migration

No existing public SDK method is removed. Bet owners that need to exit before settlement can call:

```go
tx, err := client.BettingPool().CashOut(opts, betID, quoteVersion, quotedAt, minAmountOut, deadline)
```

## Rollback

Restore the previous ABI artifacts and generated bindings, then remove `CashOut`, `CashOutCalldata`, and their tests from the public SDK facade and adapter.
