package main

import (
	"os"
	"path/filepath"
	"slices"
	"testing"
)

const testModule = "github.com/Crypto-Barrett/oddfi-ODD-SDK"

func TestCheckAllowsGeneratedBindingsToUseGoEthereum(t *testing.T) {
	root := newRepo(t)
	writeFile(t, root, "internal/infrastructure/bindings/oddtoken/oddtoken.go", `package oddtoken

import "github.com/ethereum/go-ethereum/common"
`)

	violations, err := Check(root)
	if err != nil {
		t.Fatalf("Check returned error: %v", err)
	}
	if len(violations) != 0 {
		t.Fatalf("Check returned violations: %#v", violations)
	}
}

func TestCheckAllowsDomainGoEthereumPublicTypes(t *testing.T) {
	root := newRepo(t)
	writeFile(t, root, "internal/domain/oddtoken/token.go", `package oddtoken

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

type Snapshot struct {
	Account common.Address
	Hash common.Hash
	Amount *big.Int
}
`)

	violations, err := Check(root)
	if err != nil {
		t.Fatalf("Check returned error: %v", err)
	}
	if len(violations) != 0 {
		t.Fatalf("Check returned violations: %#v", violations)
	}
}

func TestCheckRejectsDomainInfrastructureImports(t *testing.T) {
	root := newRepo(t)
	writeFile(t, root, "internal/domain/value.go", `package domain

import (
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
	"github.com/ethereum/go-ethereum/ethclient"
	"net/http"
)
`)

	violations, err := Check(root)
	if err != nil {
		t.Fatalf("Check returned error: %v", err)
	}
	assertImports(t, violations,
		"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain",
		"github.com/ethereum/go-ethereum/ethclient",
		"net/http",
	)
}

func TestCheckAllowsApplicationGoEthereumPublicTypes(t *testing.T) {
	root := newRepo(t)
	writeFile(t, root, "internal/application/tx.go", `package application

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

type Submitted struct {
	Hash common.Hash
	Tx *types.Transaction
}
`)

	violations, err := Check(root)
	if err != nil {
		t.Fatalf("Check returned error: %v", err)
	}
	if len(violations) != 0 {
		t.Fatalf("Check returned violations: %#v", violations)
	}
}

func TestCheckRejectsApplicationInfrastructureImports(t *testing.T) {
	root := newRepo(t)
	writeFile(t, root, "internal/application/pipeline.go", `package application

import (
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
	"github.com/ethereum/go-ethereum/ethclient"
)
`)

	violations, err := Check(root)
	if err != nil {
		t.Fatalf("Check returned error: %v", err)
	}
	assertImports(t, violations,
		"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain",
		"github.com/ethereum/go-ethereum/ethclient",
	)
}

func TestCheckRejectsPublicAndExampleBindingImports(t *testing.T) {
	root := newRepo(t)
	writeFile(t, root, "pkg/oddfi/client.go", `package oddfi

import "github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/oddtoken"
`)
	writeFile(t, root, "examples/basic/main.go", `package main

import "github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/stakingpool"
`)

	violations, err := Check(root)
	if err != nil {
		t.Fatalf("Check returned error: %v", err)
	}
	assertImports(t, violations,
		"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/oddtoken",
		"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/stakingpool",
	)
}

func newRepo(t *testing.T) string {
	t.Helper()

	root := t.TempDir()
	writeFile(t, root, "go.mod", "module "+testModule+"\n\ngo 1.25.0\n")
	return root
}

func writeFile(t *testing.T, root, relPath, content string) {
	t.Helper()

	path := filepath.Join(root, relPath)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll(%s): %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("WriteFile(%s): %v", path, err)
	}
}

func assertImports(t *testing.T, violations []violation, want ...string) {
	t.Helper()

	got := make([]string, 0, len(violations))
	for _, v := range violations {
		got = append(got, v.importPath)
	}
	slices.Sort(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Fatalf("violation imports mismatch\ngot:  %v\nwant: %v", got, want)
	}
}
