# Quality Scaffolding Progress

Last updated: 2026-05-08

## Actual State

- GitHub Actions CI is configured in `.github/workflows/ci.yml`.
- Import-direction enforcement is implemented by `tools/importcheck`.
- The import checker is dependency-free and reads Go imports directly from source files.
- Import checker coverage includes:
  - `internal/domain` rejecting infrastructure, application, generated bindings, and concrete RPC / file / DB dependencies.
  - `internal/application` rejecting infrastructure and generated bindings.
  - `pkg` rejecting direct generated binding imports.
  - `examples` rejecting direct generated binding imports.
  - generated bindings remaining allowed to import go-ethereum packages.
  - domain and application may use common go-ethereum public types where they are part of the business API.

## Known Gaps

- CI invokes API diff, but there is not yet a released public API baseline. First public release preparation must record the selected baseline and a reproducible API diff result.
- No coverage, fuzz, integration, or adversarial test report has been produced for SDK runtime behavior in `docs/testing/`.
- `golangci-lint`, `gosec`, and `govulncheck` depend on tool installation/network availability in CI or the local environment.

## Validation Notes

- Use `go test ./tools/importcheck` for the import checker unit suite.
- Use `go run ./tools/importcheck` for repository-wide import-direction validation.
- Full release validation still requires the complete command set from `AGENTS.md` once SDK runtime code exists.
