//go:build e2e

package e2e

// TestPreflight is a read-only sanity check: derive admin/user addresses from
// the configured private keys, query BNB and USDT balances, and confirm the
// admin signer matches sdk/config/testnet.json. Run before any flow test.
//
// It does NOT send any transaction.
//
// Run:
//
//	E2E_RPC=... E2E_ADMIN_PK=... E2E_USER_PK=... \
//	  go test -tags=e2e -count=1 -v -run TestPreflight ./sdk/e2e/...

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/bindings/erc20"
)

func TestPreflight(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	conn := connectE2E(t)
	adm := loadSigner(t, "E2E_ADMIN_PK")
	usr := loadSigner(t, "E2E_USER_PK")

	expectedAdmin := conn.EnvConfig().ExpectedAdmin()
	t.Logf("RPC:               %s (chain %s)", redactRPC(os.Getenv("E2E_RPC")), conn.ChainID())
	t.Logf("BettingPool:       %s", conn.BettingPoolAddr().Hex())
	t.Logf("USDT:              %s", conn.USDTAddr().Hex())
	t.Logf("Expected admin:    %s", expectedAdmin.Hex())
	t.Logf("Expected multisig: %s", conn.EnvConfig().ExpectedMultisig().Hex())
	t.Logf("Onchain admin:     %s", conn.OnchainAdmin().Hex())
	t.Logf("Onchain multisig:  %s", conn.OnchainMultisig().Hex())
	t.Logf("Admin signer addr: %s", adm.Address().Hex())
	t.Logf("User signer addr:  %s", usr.Address().Hex())

	if adm.Address() != expectedAdmin {
		t.Fatalf("admin signer %s does NOT match expected admin %s in testnet config",
			adm.Address().Hex(), expectedAdmin.Hex())
	}

	usdtCaller, err := erc20.NewERC20Caller(conn.USDTAddr(), conn.EthClient())
	if err != nil {
		t.Fatalf("erc20 caller: %v", err)
	}
	bpCaller, err := bettingpool.NewBettingPoolCaller(conn.BettingPoolAddr(), conn.EthClient())
	if err != nil {
		t.Fatalf("bettingpool caller: %v", err)
	}

	for _, who := range []struct {
		label string
		addr  common.Address
	}{
		{"admin (signer)", adm.Address()},
		{"user (signer)", usr.Address()},
		{"BettingPool", conn.BettingPoolAddr()},
	} {
		bal, err := conn.EthClient().BalanceAt(ctx, who.addr, nil)
		if err != nil {
			t.Errorf("BalanceAt(%s): %v", who.label, err)
			continue
		}
		ub, err := usdtCaller.BalanceOf(nil, who.addr)
		if err != nil {
			t.Errorf("USDT.BalanceOf(%s): %v", who.label, err)
			continue
		}
		t.Logf("%-18s gas=%s  usdt=%s", who.label, bnb(bal), usdtSuffixed(ub))
	}

	if paused, err := bpCaller.Paused(nil); err == nil {
		t.Logf("Contract paused:   %v", paused)
	}
	if locked, err := bpCaller.LockedBalances(nil, usr.Address()); err == nil {
		t.Logf("User locked bal:   %s", usdtSuffixed(locked))
	}
	if spend, err := bpCaller.UserBalances(nil, usr.Address()); err == nil {
		t.Logf("User in-contract:  %s (spendable)", usdtSuffixed(spend))
	}
	if blk, err := conn.EthClient().BlockNumber(ctx); err == nil {
		t.Logf("Latest block:      %d", blk)
	}
}
