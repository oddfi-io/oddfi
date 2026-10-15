# LiquidityPool preview withdraw read API

**Date:** 2026-05-29
**Scope:** `contracts/abi`, `internal/infrastructure/bindings`, `internal/domain/liquiditypool`, `internal/infrastructure/contracts`, `pkg/oddfi`

## Background

The updated `LiquidityPool` ABI adds a read-only LP withdrawal preview endpoint:

- `previewWithdraw(uint256) returns (uint256 withdrawAmount, int256 netPnl, LpPositionState effectiveState)`

The contract API document records that this endpoint previews the amount a liquidity position can withdraw using the same frozen accounting basis as `withdraw`, without requiring the caller to own the position and without submitting a transaction.

## API Change Surface

Public SDK additions:

- Add `pkg/oddfi.LiquidityWithdrawPreview`.
- Add `pkg/oddfi.LiquidityPositionState` and constants for the documented LP states.
- Add `LiquidityPool.PreviewWithdraw(ctx, positionID)`.

No transaction or calldata API is added because the ABI method is `view`.

## Layering

Generated bindings remain internal under `internal/infrastructure/bindings`. The domain layer owns the LP position state enum. The public facade exposes SDK-owned read model types, the domain-backed state type, and standard go-ethereum value types only.

## Test Plan

- Regenerate bindings with `go generate ./internal/infrastructure/bindings/...`.
- Add adapter fake-call coverage for `PreviewWithdraw`, including signed `netPnl`.
- Add public facade nil context, missing configuration, and nil `positionID` validation coverage.
- Add an example for the public read method.
- Run `go test ./...`, `go vet ./...`, and import-direction checks.

## Migration

No existing caller migration is required. Callers can use the new read method before deciding whether to submit `Withdraw`:

```go
preview, err := client.LiquidityPool().PreviewWithdraw(ctx, positionID)
if err != nil {
	return err
}
if preview.EffectiveState == oddfi.LiquidityPositionStateWithdrawable {
	// Show preview.WithdrawAmount as the currently withdrawable ODD base-unit amount.
}
```

## Rollback

Restore the previous `LiquidityPool` ABI artifact and generated binding, then remove the adapter and public facade methods and the LP position state additions.
