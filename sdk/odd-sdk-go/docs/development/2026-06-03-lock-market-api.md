# BettingPool lockMarket API

**Date:** 2026-06-03
**Scope:** `contracts/abi`, `internal/infrastructure/bindings`, `internal/infrastructure/contracts`, `pkg/oddfi`

## Background

The updated BettingPool ABI adds `lockMarket(bytes32)` and emits `MarketManuallyLocked`. This gives operators an explicit manual lock path before settlement, instead of relying only on the configured `lockAt` time.

## API Change Surface

Public SDK additions:

- `BettingPool.LockMarket(opts, marketID)`
- `BettingPool.LockMarketCalldata(marketID)`

The method follows existing write passthrough rules: callers provide `*bind.TransactOpts`, keep control of signing, nonce, gas, and broadcasting behavior, and receive the submitted `*types.Transaction`.

## Layering

Generated bindings remain internal under `internal/infrastructure/bindings`. The public facade exposes only go-ethereum common public types and SDK-owned facade methods. `BettingSettlementModule` remains an internal delegatecall implementation detail; callers use the BettingPool proxy facade.

## Test Plan

- Regenerate bindings with `go generate ./internal/infrastructure/bindings/...`.
- Add selector coverage for `LockMarketCalldata`.
- Add missing-transactor coverage for the adapter write method.
- Run `go test ./pkg/oddfi ./internal/infrastructure/contracts`.
- Run broader `go test ./...` when local time permits.

## Migration

No existing public SDK method is removed. Callers can continue relying on automatic market lock timing. Operators that need to lock a market manually can call:

```go
tx, err := client.BettingPool().LockMarket(opts, marketID)
```

## Rollback

Restore the previous ABI artifacts and generated bindings, then remove `LockMarket`, `LockMarketCalldata`, and their tests from the public SDK facade and adapter.
