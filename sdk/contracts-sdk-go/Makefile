# oddfi-contracts-sdk Makefile

CONTRACTS_REPO := Crypto-Barrett/oddfi-contracts
CONTRACTS_VERSION := $(shell cat .contracts-version 2>/dev/null || echo "main")

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "Targets:"
	@echo "  pull-abi          下载 oddfi-contracts release 的 abi.tar.gz 解压到 sdk/abi/"
	@echo "  sdk-sync          go generate ./bindings/... 重生 abigen binding"
	@echo "  sdk-verify        sdk-sync 后检查 git 无 diff（CI 用）"
	@echo "  test              L1 unit tests"
	@echo "  test-fork         L1 anvil fork tests (需要 foundry + RPC env)"
	@echo "  test-dryrun       L1 mainnet dry-run (需要 BSC_MAINNET_RPC env)"
	@echo "  test-e2e          E2E smoke (anvil)"
	@echo "  build             编译 sdk"
	@echo "  clean             清理 build 产物"

.PHONY: pull-abi
pull-abi:
	@echo "Pulling ABI from $(CONTRACTS_REPO)@$(CONTRACTS_VERSION)..."
	@command -v gh >/dev/null 2>&1 || { echo "gh CLI required: https://cli.github.com"; exit 1; }
	@mkdir -p sdk/abi
	gh release download $(CONTRACTS_VERSION) \
		--repo $(CONTRACTS_REPO) \
		--pattern 'abi.tar.gz' \
		--clobber
	tar -xzf abi.tar.gz -C sdk/abi/
	rm -f abi.tar.gz
	@echo "ABI synced to sdk/abi/ from $(CONTRACTS_VERSION)"

.PHONY: sdk-sync
sdk-sync:
	cd sdk && go generate ./bindings/...
	cd sdk && go build ./...

.PHONY: sdk-verify
sdk-verify: sdk-sync
	@git diff --exit-code sdk/abi sdk/bindings || \
		(echo "SDK out of sync, run 'make pull-abi && make sdk-sync' and commit"; exit 1)

.PHONY: build
build:
	cd sdk && go build ./...

.PHONY: test
test:
	cd sdk && go test ./...

.PHONY: test-fork
test-fork:
	cd sdk && go test -tags=fork ./...

.PHONY: test-dryrun
test-dryrun:
	cd sdk && go test -tags=dryrun ./...

.PHONY: test-e2e
test-e2e:
	cd sdk && go test -tags=e2e -timeout=20m ./...

.PHONY: clean
clean:
	rm -f abi.tar.gz coverage.out coverage.html
	cd sdk && go clean ./...
