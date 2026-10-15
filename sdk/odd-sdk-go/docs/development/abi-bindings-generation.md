# ABI Bindings Generation

## Background

The repository contains raw ABI artifacts for core proxy contracts and internal/delegatecall support contracts under `contracts/abi/`. Architecture rules require generated Go bindings to live only under `internal/infrastructure/bindings/<contract>/`, with generation commands centralized in `internal/infrastructure/bindings/gen.go`.

## Scope

- Add the `go generate` entrypoint for all current ABI artifacts.
- Generate one internal Go package per contract:
  - `bettingpool`
  - `bettingparlaylens`
  - `bettingparlaymodule`
  - `bettingsettlementmodule`
  - `liquiditypool`
  - `oddtoken`
  - `stakingpool`
- Update implementation progress to reflect generated bindings.

## API Change Surface

No public API is added or changed. Generated bindings are internal infrastructure code and must not be imported by `/pkg` or examples.

## Layering

Generated packages remain below `internal/infrastructure/bindings`. Domain and application layers must not import these packages directly. Contract business facades in `/pkg` should be implemented by infrastructure adapters that wrap generated bindings.

## Test Plan

- Run `go generate ./internal/infrastructure/bindings/...`.
- Run `go test ./...`.
- Run `go vet ./...`.
- Run `go test -race -count=1 ./...`.
- Run `govulncheck ./...`.

Full lint, race, vulnerability, and API-diff gates remain required before release once CI tooling exists in the repository.

## Validation Notes

- `go generate ./internal/infrastructure/bindings/...` passes with `github.com/ethereum/go-ethereum/cmd/abigen@v1.17.0`.
- `go test ./...`, `go vet ./...`, and `go test -race -count=1 ./...` pass.
- `govulncheck ./...` still reports Go standard library vulnerabilities in local toolchain `go1.26.1`; reported fixed version is `go1.26.2`. No reachable `go-ethereum` vulnerability remains after upgrading to `github.com/ethereum/go-ethereum v1.17.0`.
- `golangci-lint` and `gosec` were not present in `PATH` during local validation.

## Migration

No consumer migration is required because there is no public API surface.

## Rollback

Remove `internal/infrastructure/bindings/` generated files and restore `docs/progress/contracts.md` binding status to incomplete.
