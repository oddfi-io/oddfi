# Validation Notes

Date: 2026-05-08

## Scope

This report covers the four-contract public SDK foundation, ODDToken / StakingPool / LiquidityPool / BettingPool read and write API paths, import-direction enforcement, gated BNB testnet e2e validation, and the saved pure-contract scenario test-case matrix in `docs/testing/contract-scenario-test-cases.md`. It does not claim SDK-managed signing because callers provide `*bind.TransactOpts`; it also does not claim fuzz or adversarial reorg / nonce / gas behavior.

## Commands

```bash
go test ./tools/importcheck
go run ./tools/importcheck
go test ./...
ODDFI_E2E=1 ODDFI_RPC_URL=<redacted> ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F go test ./pkg/oddfi -run TestReadOnlyE2EAllConfiguredContracts -count=1
ODDFI_WRITE_E2E=1 ODDFI_RPC_URL=<redacted> ODDFI_PRIVATE_KEY=<redacted> ODDFI_ODD_TOKEN_PROXY=0x5530dA4357803bD0ed806a999a1f1fcc3c45Dc8C ODDFI_STAKING_POOL_PROXY=0x65fd4A2529010693BA474d1993631e305a42E061 ODDFI_LIQUIDITY_POOL_PROXY=0xdf0c59B387DfDf9f18969880DDCF1216BFEe318f ODDFI_BETTING_POOL_PROXY=0xbbc6ef3F665Bf65Cb531172e5f2252155E80cE1F go test ./pkg/oddfi -run 'TestWriteScenario.*ViaPublicSDK' -count=1 -v
go vet ./...
go test -race -count=1 ./...
go generate ./internal/infrastructure/bindings/...
git diff --exit-code -- internal/infrastructure/bindings
golangci-lint run
govulncheck ./...
go run github.com/securego/gosec/v2/cmd/gosec@latest ./...
```

## Result

- `go test ./tools/importcheck`: passed.
- `go run ./tools/importcheck`: passed.
- `go test ./...`: passed.
- Read-only BNB testnet e2e for all four configured proxy contracts: passed.
- Public `pkg/oddfi` BNB testnet write scenario for ODDToken / StakingPool / LiquidityPool / BettingPool: passed. Tx hashes and balance deltas are stored in `docs/testing/write-scenario-results.md`.
- Pure-contract scenario test-case matrix saved to `docs/testing/contract-scenario-test-cases.md`; full Foundry execution remains in the contract repository.
- `go vet ./...`: passed.
- `go test -race -count=1 ./...`: passed.
- `go generate ./internal/infrastructure/bindings/...`: passed.
- `git diff --exit-code -- internal/infrastructure/bindings`: passed.
- `golangci-lint run`: not run; `golangci-lint` is not installed in the local shell.
- `govulncheck ./...`: failed because the local Go toolchain is `go1.26.1`; reachable findings are in the Go standard library and are fixed in `go1.26.2` / `go1.26.3`.
- `go run github.com/securego/gosec/v2/cmd/gosec@latest ./...`: passed with 0 issues.

## Expected Future Result

- Full CI should run `golangci-lint` with the pinned GitHub Actions version.

## 2026-05-13 Binding Regeneration Note

Scope: regenerated Go bindings after adding `contracts/abi/BettingSettlementModule.abi.json`.

Commands:

```bash
go generate ./internal/infrastructure/bindings/...
go test ./...
go test ./pkg/oddfi -run TestE2EFullMatchScenario -count=1 -v
```

Results:

- `go generate ./internal/infrastructure/bindings/...`: passed after adding `internal/infrastructure/bindings/bettingsettlementmodule/`.
- `go test ./...`: passed.
- `go test ./pkg/oddfi -run TestE2EFullMatchScenario -count=1 -v`: passed with SKIP because `ODDFI_FULL_E2E=1` and private runtime variables were not set in the shell.
- Real BSC Testnet broadcast was not executed in this note. Private keys and private RPC URLs must be injected by the local environment and must not be written into source, docs, or command history.

## 2026-05-25 Score Settlement ABI Adapter Note

Scope: regenerated bindings from updated ABI artifacts and adapted BettingPool public SDK settlement methods to the score-based API.

Commands:

```bash
go generate ./internal/infrastructure/bindings/...
go test ./...
go vet ./...
go run ./tools/importcheck
go test -race -count=1 ./...
go test ./pkg/oddfi -run 'TestE2EFullMatchScenario|TestE2ENewBettingPoolWriteMethods' -count=1 -v
go run github.com/securego/gosec/v2/cmd/gosec@latest ./...
govulncheck ./...
go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run
go run golang.org/x/exp/cmd/gorelease@latest
```

Results:

- `go generate ./internal/infrastructure/bindings/...`: passed.
- `go test ./...`: passed.
- `go vet ./...`: passed.
- `go run ./tools/importcheck`: passed after removing direct generated-binding imports from `pkg/oddfi`.
- `go test -race -count=1 ./...`: passed.
- `go test ./pkg/oddfi -run 'TestE2EFullMatchScenario|TestE2ENewBettingPoolWriteMethods' -count=1 -v`: passed with SKIP because `ODDFI_FULL_E2E=1` was not set.
- `go run github.com/securego/gosec/v2/cmd/gosec@latest ./...`: passed with 0 issues.
- `govulncheck ./...`: failed because the local Go toolchain is `go1.26.1`; reachable findings are in the Go standard library and are fixed in `go1.26.2` / `go1.26.3`.
- `go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run`: failed before linting because fetching `github.com/tdakkota/asciicheck@v0.4.1` from GitHub over HTTPS required terminal credentials, and prompts are disabled.
- `go run golang.org/x/exp/cmd/gorelease@latest`: not completed; gorelease refused to run with uncommitted changes in the repository.
- Real BSC Testnet broadcast was not executed in this note. The gated E2E files were updated to the new call sequence but still require private runtime variables supplied by the local environment.

## 2026-06-12 Proxy Public API Surface Note

Scope: regenerated bindings from refreshed ABI artifacts, added proxy facades for `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, and `EcosystemRewards`, and exposed every public function in the current proxy ABI files through `pkg/oddfi`.

Environment:

- Go version: `go1.26.1 darwin/arm64`.
- Network/RPC: no live RPC broadcast was run; all validation was local compile/static/test coverage.

Commands:

```bash
go generate ./internal/infrastructure/bindings/...
go test ./pkg/oddfi ./internal/infrastructure/contracts
go test ./...
go vet ./...
go run ./tools/importcheck
go test -race -count=1 ./...
go mod tidy -diff
go run github.com/securego/gosec/v2/cmd/gosec@latest ./...
govulncheck ./...
golangci-lint run
go run golang.org/x/exp/cmd/gorelease@latest
```

Additional local check:

- A mechanical ABI-vs-pkg method check compared the nine proxy ABI files (`ODDToken`, `StakingPool`, `LiquidityPool`, `BettingPool`, `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, `EcosystemRewards`) against `pkg/oddfi` facade methods and reported `missing 0` for each proxy.
- Binding generation idempotency was checked by comparing the SHA-256 of `git diff -- internal/infrastructure/bindings` before and after a second `go generate`; both hashes were `934d17cff8bfe631fb143ecb864c4200a757ed0a9607676b8447efff43b705c2`.

Results:

- `go generate ./internal/infrastructure/bindings/...`: passed.
- `go test ./pkg/oddfi ./internal/infrastructure/contracts`: passed.
- `go test ./...`: passed.
- `go vet ./...`: passed.
- `go run ./tools/importcheck`: passed.
- `go test -race -count=1 ./...`: passed.
- `go mod tidy -diff`: passed.
- `go run github.com/securego/gosec/v2/cmd/gosec@latest ./...`: passed with 0 issues.
- `govulncheck ./...`: failed due reachable Go standard library findings in local toolchain `go1.26.1`; reported fixed versions require up to `go1.26.4`. No private RPC URL or secret was used.
- `golangci-lint run`: not run because `golangci-lint` is not installed in the local shell.
- `go run golang.org/x/exp/cmd/gorelease@latest`: not completed because `gorelease` refused to run with uncommitted changes in the repository.

Gaps:

- Live BSC Testnet read/write coverage for the five newly exposed optional proxies still requires maintainer-supplied RPC and signer environment variables.
- API diff should be rerun after this change is committed or in a clean release-candidate worktree.
- `govulncheck` should be rerun after upgrading the local Go toolchain to at least `go1.26.4`.

## 2026-06-12 Same-Day ABI Binding Refresh Note

Scope: regenerated internal bindings after an additional same-day ABI method refresh and rechecked that the current proxy ABI public function surface is still exposed through `pkg/oddfi`.

Environment:

- Go version: `go1.26.1 darwin/arm64`.
- Network/RPC: no live RPC broadcast was run; no private RPC URL or signer was used.

Commands:

```bash
go generate ./internal/infrastructure/bindings/...
go test ./pkg/oddfi ./internal/infrastructure/contracts
go test ./...
go vet ./...
go run ./tools/importcheck
go mod tidy -diff
go test -race -count=1 ./...
go run github.com/securego/gosec/v2/cmd/gosec@latest ./...
govulncheck ./...
golangci-lint run
go run golang.org/x/exp/cmd/gorelease@latest
```

Additional local check:

- A mechanical ABI-vs-pkg method check compared the nine proxy ABI files (`ODDToken`, `StakingPool`, `LiquidityPool`, `BettingPool`, `TierSale`, `HouseVault`, `DexLaunchController`, `DexLpLocker`, `EcosystemRewards`) against `pkg/oddfi` facade methods and reported `missing 0` for each proxy. Current counts were: `ODDToken` 60, `StakingPool` 37, `LiquidityPool` 50, `BettingPool` 95, `TierSale` 48, `HouseVault` 17, `DexLaunchController` 35, `DexLpLocker` 21, `EcosystemRewards` 30 unique ABI function names.

Results:

- `go generate ./internal/infrastructure/bindings/...`: passed.
- `go test ./pkg/oddfi ./internal/infrastructure/contracts`: passed.
- `go test ./...`: passed.
- `go vet ./...`: passed.
- `go run ./tools/importcheck`: passed.
- `go mod tidy -diff`: passed.
- `go test -race -count=1 ./...`: passed.
- `go run github.com/securego/gosec/v2/cmd/gosec@latest ./...`: passed with 0 issues.
- `govulncheck ./...`: failed due reachable Go standard library findings in local toolchain `go1.26.1`; reported fixed versions require up to `go1.26.4`.
- `golangci-lint run`: not run because `golangci-lint` is not installed in the local shell.
- `go run golang.org/x/exp/cmd/gorelease@latest`: not completed because `gorelease` refused to run with uncommitted changes in the repository.

## 2026-06-12 Proxy Solidity Alias Coverage Note

Scope: added `pkg/oddfi` Solidity-spelling alias methods for public proxy getters that already had idiomatic SDK methods, then rechecked ABI function-name coverage.

Environment:

- Go version: `go1.26.1 darwin/arm64`.
- Network/RPC: no live RPC broadcast was run; no private RPC URL or signer was used.

Commands:

```bash
go test ./pkg/oddfi ./internal/infrastructure/contracts
go test ./...
go vet ./...
go run ./tools/importcheck
go mod tidy -diff
go test -race -count=1 ./...
go run github.com/securego/gosec/v2/cmd/gosec@latest ./...
govulncheck ./...
golangci-lint run
go run golang.org/x/exp/cmd/gorelease@latest
```

Additional local checks:

- A naive Solidity function-name check now reports `missing 0` for all nine proxy facades without alias exceptions. Counts: `ODDToken` 60, `StakingPool` 37, `LiquidityPool` 50, `BettingPool` 95 unique names / 97 function signatures, `TierSale` 48, `HouseVault` 17, `DexLaunchController` 35, `DexLpLocker` 21, `EcosystemRewards` 30.
- The only proxy overloads remain `BettingPool.placeBet` and `BettingPool.setReferralSwapConfig`; they are exposed as `PlaceBet` / `PlaceBetWithReferrer` and `SetReferralSwapConfig` / `SetReferralSwapConfigWithExpectedPool`.

Results:

- `go test ./pkg/oddfi ./internal/infrastructure/contracts`: passed.
- `go test ./...`: passed.
- `go vet ./...`: passed.
- `go run ./tools/importcheck`: passed.
- `go mod tidy -diff`: passed.
- `go test -race -count=1 ./...`: passed.
- `go run github.com/securego/gosec/v2/cmd/gosec@latest ./...`: passed with 0 issues.
- `govulncheck ./...`: failed due reachable Go standard library findings in local toolchain `go1.26.1`; reported fixed versions require up to `go1.26.4`.
- `golangci-lint run`: not run because `golangci-lint` is not installed in the local shell.
- `go run golang.org/x/exp/cmd/gorelease@latest`: not completed because `gorelease` refused to run with uncommitted changes in the repository.

## 2026-06-13 ABI Binding Refresh Note

Scope: regenerated internal bindings after the 2026-06-13 ABI refresh and rechecked proxy public facade coverage.

Environment:

- Go version: `go1.26.1 darwin/arm64`.
- Network/RPC: no live RPC broadcast was run; no private RPC URL or signer was used.

Commands:

```bash
go generate ./internal/infrastructure/bindings/...
go test ./pkg/oddfi ./internal/infrastructure/contracts
go test ./...
go vet ./...
go run ./tools/importcheck
go mod tidy -diff
go test -race -count=1 ./...
go run github.com/securego/gosec/v2/cmd/gosec@latest ./...
govulncheck ./...
golangci-lint run
go run golang.org/x/exp/cmd/gorelease@latest
```

Additional local checks:

- A naive Solidity function-name check reports `missing 0` for all nine proxy facades. Counts: `ODDToken` 60, `StakingPool` 37, `LiquidityPool` 50, `BettingPool` 95 unique names / 97 function signatures, `TierSale` 48, `HouseVault` 17, `DexLaunchController` 35, `DexLpLocker` 21, `EcosystemRewards` 30.
- The only proxy overloads remain `BettingPool.placeBet` and `BettingPool.setReferralSwapConfig`; they are exposed as `PlaceBet` / `PlaceBetWithReferrer` and `SetReferralSwapConfig` / `SetReferralSwapConfigWithExpectedPool`.

Results:

- `go generate ./internal/infrastructure/bindings/...`: passed.
- `go test ./pkg/oddfi ./internal/infrastructure/contracts`: passed.
- `go test ./...`: passed.
- `go vet ./...`: passed.
- `go run ./tools/importcheck`: passed.
- `go mod tidy -diff`: passed.
- `go test -race -count=1 ./...`: passed.
- `go run github.com/securego/gosec/v2/cmd/gosec@latest ./...`: passed with 0 issues.
- `govulncheck ./...`: failed due reachable Go standard library findings in local toolchain `go1.26.1`; reported fixed versions require up to `go1.26.4`.
- `golangci-lint run`: not run because `golangci-lint` is not installed in the local shell.
- `go run golang.org/x/exp/cmd/gorelease@latest`: not completed because `gorelease` refused to run with uncommitted changes in the repository.

## Not Covered Yet

- `golangci-lint run`.
- Passing `govulncheck ./...` after the Go toolchain is updated to at least `go1.26.4`.
- API diff against a released public package.
- Fuzz tests for ABI decoding, string address parsing, EIP-712 encoding, and event topic parsing.
- Adversarial tests for reorgs, nonce conflicts, gas estimation failure, chain ID mismatch, malformed ABI responses, and ctx cancellation races.

## Template For Future Reports

```markdown
# Validation Notes

Date: YYYY-MM-DD

## Scope

Describe the exact code path or release candidate validated.

## Environment

- Go version:
- OS/arch:
- Network/RPC: redacted; do not record private RPC URLs or secrets.
- Feature flags:

## Commands

List exact commands and whether each passed, failed, or was skipped with reason.

## Inputs

Record non-secret inputs such as public proxy addresses, test fixtures, and fuzz corpus names.

## Results

Summarize observed output and link to artifacts stored under `docs/testing/` when applicable.

## Gaps And Follow-Up

List skipped gates, flaky cases, and required maintainer decisions.
```
