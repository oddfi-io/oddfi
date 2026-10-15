# Proxy Public API Surface

**Date:** 2026-06-12
**Scope:** `contracts/abi`, `internal/infrastructure/bindings`, `internal/infrastructure/contracts`, `pkg/oddfi`

## Background

The 2026-06-12 contract ABI refresh adds ODDToken launch/vesting support and five additional proxy contracts: `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards`. `docs/architecture/contract_api.md` has already been updated to describe the target proxy API surface. The SDK must regenerate bindings and expose public proxy methods through `pkg/oddfi` without leaking generated binding types.

## API Change Surface

Public SDK additions are additive:

- Regenerate internal bindings for every ABI artifact under `contracts/abi`.
- Add public facades and `Client` accessors for `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards`.
- Extend existing `ODDToken`, `StakingPool`, `LiquidityPool`, and `BettingPool` facades where the refreshed proxy ABI contains public methods not yet exposed.
- Add Solidity-spelling alias methods in `pkg/oddfi` for public proxy getters whose primary SDK method uses Go/domain naming, such as `Positions`, `Pools`, `MarketFinalResults`, `Referrers`, `Purchases`, `LockedPositions`, and `Claimables`.
- Keep write methods as direct passthroughs that accept caller-provided `*bind.TransactOpts` and return `*types.Transaction`.
- Keep generated binding packages under `internal/infrastructure/bindings`; `/pkg` and `/examples` must not import them directly.

## Layering

`pkg/oddfi` owns the external facade shape and only exposes SDK-owned structs plus common go-ethereum public types. Infrastructure adapters wrap generated bindings and provide the implementation. Domain and application layers remain unchanged unless a method needs new business-domain modeling.

## Test Plan

- Run `go generate ./internal/infrastructure/bindings/...`.
- Run `go test ./pkg/oddfi ./internal/infrastructure/contracts`.
- Run `go test ./...`.
- Run `go vet ./...`.
- Run `go run ./tools/importcheck`.
- Run `go test -race -count=1 ./...`.
- Run `golangci-lint run`, `gosec ./...`, `govulncheck ./...`, and API diff before release when local tooling permits.

## Migration

No existing public SDK method is removed. Consumers can opt into the new proxy facades by setting the corresponding proxy address in `Config` and calling the new `Client` accessor. Consumers that prefer Solidity ABI getter names can call the additive alias methods; existing idiomatic SDK methods remain supported.

## Rollback

Restore the previous ABI artifacts and generated bindings, remove the newly added public facade methods/adapters, and revert `docs/progress/contracts.md` to the previous integration matrix.
