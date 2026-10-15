# BettingPool market exposure read API

**Date:** 2026-05-28
**Scope:** `contracts/abi`, `internal/infrastructure/bindings`, `internal/infrastructure/contracts`, `pkg/oddfi`

## Background

The updated `BettingPool` ABI adds a read-only market exposure endpoint:

- `getMarketExposure(bytes32) returns (uint256[] totalStakedByOutcome, uint256[] payoutByOutcome, uint8 signalColor)`

This endpoint lets SDK callers inspect per-outcome market stake and payout exposure without importing generated bindings.

## API Change Surface

Public SDK additions:

- Add `pkg/oddfi.MarketExposure`.
- Add `BettingPool.GetMarketExposure(ctx, marketID)`.

No transaction or calldata API is added because the ABI method is `view`.

## Layering

Generated bindings remain internal under `internal/infrastructure/bindings`. The public facade exposes only SDK-owned read model types and standard go-ethereum value types.

## Test Plan

- Regenerate bindings with `go generate ./internal/infrastructure/bindings/...`.
- Add adapter fake-call coverage for `GetMarketExposure`.
- Add public facade nil/config validation coverage.
- Run `go test ./...`, `go vet ./...`, and import-direction checks.

## Migration

No existing caller migration is required. Callers may use the new read method for UI and risk dashboards:

```go
exposure, err := client.BettingPool().GetMarketExposure(ctx, marketID)
```

## Rollback

Restore the previous `BettingPool` ABI artifact and generated binding, then remove the adapter and public facade methods.
