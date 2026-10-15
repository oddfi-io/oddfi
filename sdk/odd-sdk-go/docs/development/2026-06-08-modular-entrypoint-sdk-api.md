# BettingPool Modular Entrypoint SDK API

**Date:** 2026-06-08
**Scope:** `contracts/abi`, `internal/infrastructure/bindings`, `internal/infrastructure/contracts`, `pkg/oddfi`

## Background

The updated ABI artifacts add BettingPool proxy wrapper methods for the modular entrypoint architecture and split module ABI artifacts for compile-time coverage. BettingPool remains the public write entrypoint for SDK users; module implementations are internal delegatecall details. LiquidityPool also exposes BettingPool-only match-pool and payout-liquidity operations that are useful for operator tooling and full scenario tests.

## API Change Surface

Public SDK additions:

- `BettingPool.BetModule(ctx)`, `BettingPool.MarketModule(ctx)`, and `BettingPool.ReferralModule(ctx)`.
- `BettingPool.GetMatchMarketIds(ctx, matchID)`.
- `BettingPool.GetClaimStatus(ctx, user, betID)` and `BettingPool.EstimateBetValue(ctx, user, betID)`.
- `BettingPool.GetParlayClaimStatus(ctx, user, parlayID)` and `BettingPool.EstimateParlayValue(ctx, user, parlayID)`.
- `BettingPool.SetBetModule(opts, address)`, `SetMarketModule(opts, address)`, `SetReferralModule(opts, address)`, plus matching calldata helpers.
- `BettingParlayLens.EstimateParlayValue(ctx, bettingPool, user, parlayID)` now matches the ABI user-scoped signature and includes `FloatingPnL`.
- `LiquidityPool.OpenMatchPool`, `CloseMatchPoolDeposit`, `DistributeLoss`, `DistributeMargin`, `RequestPayoutLiquidity`, plus matching calldata helpers.

Generated internal binding additions:

- `internal/infrastructure/bindings/bettingbetmodule`
- `internal/infrastructure/bindings/bettingmarketmodule`
- `internal/infrastructure/bindings/bettingreferralmodule`

## Layering

Generated bindings remain internal. Public methods expose only SDK-owned structs and common go-ethereum public types. No `/pkg` code imports `internal/infrastructure/bindings` directly.

## Test Plan

- Run `go generate ./internal/infrastructure/bindings/...`.
- Add selector tests for newly exposed calldata helpers.
- Run `go test ./pkg/oddfi ./internal/infrastructure/contracts`.
- Run `go test ./...`.
- Run `go vet ./...`.
- Run `go run ./tools/importcheck`.
- Run `go test -race -count=1 ./...`, `golangci-lint run`, `gosec ./...`, `govulncheck ./...`, and API diff before release when local tooling permits.

## Migration

Existing SDK methods remain. Callers using `BettingParlayLens.EstimateParlayValue` must now pass the user address required by the current ABI. New BettingPool estimate methods can be used directly through the proxy facade when callers do not need the standalone lens address.

## Rollback

Restore the previous ABI artifacts and generated bindings, remove the added public facade methods/calldata helpers/tests, and revert `docs/progress/contracts.md` to the previous contract integration state.
