# SDK Foundation Implementation Plan

## Background

The repository currently contains raw ABI artifacts and generated internal bindings for `BettingPool`, `LiquidityPool`, `ODDToken`, and `StakingPool`. The public SDK layers required by `AGENTS.md` are not implemented yet. This plan defines the foundation work needed before contract-specific API wrappers can be accepted.

## Scope

- Create business-oriented domain packages under `/internal/domain`, aligned with the four current contract ABIs:
  - `internal/domain/oddtoken`: ODD token business semantics, pause state, ERC-20 operation business errors.
  - `internal/domain/stakingpool`: stake positions, stake plans, VIP tiers, daily limits, rewards, early unstake semantics.
  - `internal/domain/liquiditypool`: global / match liquidity, LP positions, unbond requests, epochs, payout liquidity windows.
  - `internal/domain/bettingpool`: markets, bets, odds / quote guard, settlement state, payout, refund, referral rewards.
- Define SDK-owned types only for oddfi business concepts. Do not define generic wrappers for `common.Address`, `common.Hash`, `*big.Int`, `*types.Transaction`, `bind.TransactOpts`, or `bind.CallOpts`.
- Define structured business errors where contract semantics require them.
- Create application packages only for cross-contract workflows:
  - examples: place bet with quote guard, claim payout, stake / unstake with ODDToken approval, liquidity deposit / unbond.
  - single-contract thin wrappers do not need an application layer until they coordinate multiple operations.
- Create infrastructure adapters under `/internal/infrastructure`:
  - chain RPC adapter that owns `ethclient.Client` lifecycle internally
  - noop telemetry adapters
- Create `/pkg` public API wrappers that expose one business facade per contract while allowing common `go-ethereum` public types in method signatures.
- Add unit tests, e2e test scaffolding, examples, progress updates, and validation notes.

## API Change Surface

This introduces the initial public API surface. All public types must have godoc and examples for key entry points.

Public API may use common `go-ethereum` types directly, including `common.Address`, `common.Hash`, `*big.Int`, `*types.Transaction`, `bind.TransactOpts`, and `bind.CallOpts`.

Public API must not expose `*ethclient.Client`, internal infrastructure concrete types, or generated binding types from `/internal/infrastructure/bindings`.

The initial public API is intentionally narrow but covers all four configured proxy contracts:

- construct a client from proxy addresses and RPC URL
- query basic proxy/contract state for ODDToken, StakingPool, LiquidityPool, and BettingPool
- expose ODDToken ERC-20 read methods and a small first set of write methods such as `transfer` / `approve`
- expose read-only status/configuration/accounting methods for StakingPool, LiquidityPool, and BettingPool
- expose permissioned or upgrade-related methods only when the business API design, godoc, tests, and acceptance notes describe the required role and chain risk clearly
- keep generated binding types and `*ethclient.Client` out of the public API

## Layering

- `internal/domain` is organized by contract business module and must not import infrastructure or generated bindings.
- `internal/domain` may use common go-ethereum public types when they are the natural representation of chain data.
- `internal/application` imports `internal/domain` and standard library / necessary `go-ethereum` public types only.
- `internal/infrastructure` may import `internal/domain`, `internal/application`, go-ethereum, and generated bindings.
- `/pkg` may import internal packages but must not expose concrete infrastructure types, `*ethclient.Client`, or generated binding types.

## Test Plan

- Unit:
  - error category matching with `errors.Is` and `errors.As`
  - ODDToken read/write facade behavior with fake backends
  - domain business type validation where business types exist, e.g. market status, VIP tier, stake plan
  - application behavior only where cross-contract use cases exist
- E2E:
  - gated by `ODDFI_E2E=1`
  - reads RPC URL and proxy addresses from environment variables
  - never stores private keys or RPC secrets in source
  - performs read-only contract calls by default
  - transaction tests must remain opt-in with a separate environment flag
- Regression:
  - `go test ./...`
  - `go vet ./...`
  - `go test -race -count=1 ./...`
  - `go generate ./internal/infrastructure/bindings/...` followed by a clean diff check
  - `golangci-lint run`, `gosec ./...`, `govulncheck ./...` when tools are installed

## E2E Environment

Required for read-only e2e:

```bash
ODDFI_E2E=1
ODDFI_RPC_URL=<rpc-url>
ODDFI_ODD_TOKEN_PROXY=<proxy-address>
ODDFI_STAKING_POOL_PROXY=<proxy-address>
ODDFI_LIQUIDITY_POOL_PROXY=<proxy-address>
ODDFI_BETTING_POOL_PROXY=<proxy-address>
```

Optional write tests must require separate opt-in variables and must not be enabled by default.

## Migration

No prior public API exists, so there is no consumer migration. Future changes to this API must follow SemVer rules and update `CHANGELOG.md`.

## Rollback

Revert the new business-domain packages, `/internal/application` cross-contract use cases, `/internal/infrastructure` adapters, `/pkg` facades, examples, tests, and progress updates. Generated bindings and ABI artifacts remain unaffected.
