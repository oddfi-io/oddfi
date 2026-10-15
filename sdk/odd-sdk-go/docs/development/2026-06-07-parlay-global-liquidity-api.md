# BettingPool Parlay and LiquidityPool Global Liquidity API

**Date:** 2026-06-07
**Scope:** `contracts/abi`, `internal/infrastructure/bindings`, `internal/infrastructure/contracts`, `pkg/oddfi`

## Background

The updated ABI artifacts add BettingPool parlay support and LiquidityPool global liquidity accounting methods. Two new internal ABI artifacts, `BettingParlayModule` and `BettingParlayLens`, are generated for compile-time coverage and future adapter work, but they are not public SDK entrypoints in this change.

## API Change Surface

Public SDK additions:

- `BettingPool.ParlayModule(ctx)`
- `BettingPool.NextParlayNonce(ctx)`
- `BettingPool.OpenParlayMaxPayout(ctx)`
- `BettingPool.MarketFinalResult(ctx, marketID)`
- `BettingPool.GetParlay(ctx, parlayID)`
- `BettingPool.GetParlayLeg(ctx, parlayID, legIndex)`
- `BettingPool.PlaceParlay(opts, legs, stake, minComboOdds, deadline, referrer)`
- `BettingPool.SettleParlay(opts, parlayID)`
- `BettingPool.ClaimParlayPayout(opts, parlayID)`
- `BettingPool.ReleasePayoutReserve(opts, riskID)`
- Matching BettingPool `XxxCalldata` methods for the new mutating methods.
- `LiquidityPool.GlobalRequestableLiquidity(ctx)`
- `LiquidityPool.GlobalRequestableLiquidityInitialized(ctx)`
- `LiquidityPool.InitializeGlobalRequestableLiquidity(opts, value)`
- `LiquidityPool.DistributeGlobalLoss(opts, riskID, netLoss)`
- `LiquidityPool.DistributeGlobalMargin(opts, riskID, lpMarginShare)`
- `LiquidityPool.ReleasePayoutReserve(opts, matchID)`
- Matching LiquidityPool `XxxCalldata` methods for the new mutating methods.

The write methods follow existing passthrough rules: callers provide `*bind.TransactOpts`, keep control of signing, nonce, gas, and broadcasting behavior, and receive the submitted `*types.Transaction`.

## Layering

Generated bindings remain internal under `internal/infrastructure/bindings`. Public facade methods expose only go-ethereum public types and SDK-owned structs. `BettingParlayModule` and `BettingParlayLens` remain internal implementation/support artifacts; callers continue to use the BettingPool and LiquidityPool proxy facades.

## Test Plan

- Regenerate bindings with `go generate ./internal/infrastructure/bindings/...`.
- Add selector coverage for new calldata methods.
- Add nil `*big.Int` validation coverage for new calldata/write inputs.
- Add missing-transactor coverage for new adapter write methods.
- Run `go test ./pkg/oddfi ./internal/infrastructure/contracts`.
- Run `go run ./tools/importcheck`.
- Run broader `go test ./...`, `go vet ./...`, and `go test -race -count=1 ./...` when local toolchain permits.

## Migration

No existing public SDK method is removed. Consumers can opt into parlay flows through `BettingPool.PlaceParlay` and related read/settlement/claim helpers. Liquidity operators can inspect and initialize global requestable liquidity through the new LiquidityPool facade methods.

## Rollback

Restore the previous ABI artifacts and generated bindings, then remove the new parlay/global-liquidity facade methods, calldata helpers, and tests.
