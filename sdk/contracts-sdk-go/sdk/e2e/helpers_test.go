//go:build e2e

// Package e2e holds end-to-end tests against a real RPC. Build-tagged so
// `go test ./...` in normal CI does not run them.
//
// Required env vars (shared by every flow):
//
//	E2E_RPC        — full RPC URL (BSC testnet)
//	E2E_ADMIN_PK   — admin/multisig private key (must match the address in
//	                 sdk/config/testnet.json → expectedRoles.admin)
//	E2E_USER_PK    — any user-side EOA, needs a little BNB for gas + USDT
//	                 for whichever flow is being tested.
//
// Per-flow tests may require additional env (e.g. resume tests need
// E2E_RESUME_MATCH_ID / _BET_ID); see each flow file.
//
// All shared helpers (connection, signers, tx plumbing, formatting) live in
// this file so each flow file can stay focused on its own choreography.
package e2e

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/client"
	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/signer"
)

// ── env / connection / signer ────────────────────────────────────────────────

// envOrSkip reads a required env var; t.Skip if missing so partial setups
// don't fail noisily.
func envOrSkip(t *testing.T, key string) string {
	v := os.Getenv(key)
	if v == "" {
		t.Skipf("env %s not set; skipping e2e", key)
	}
	return v
}

// connectE2E builds a *client.Connection bound to BSC testnet.
func connectE2E(t *testing.T) *client.Connection {
	t.Helper()
	rpc := envOrSkip(t, "E2E_RPC")
	conn, err := client.NewConnection(client.ConnectionConfig{
		Env:         client.Testnet,
		RPC:         rpc,
		HTTPTimeout: 30 * time.Second,
	})
	if err != nil {
		t.Fatalf("NewConnection: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

// loadSigner builds a signer from a hex private key env var.
func loadSigner(t *testing.T, envKey string) signer.Signer {
	t.Helper()
	hexKey := envOrSkip(t, envKey)
	s, err := signer.NewFromHex(hexKey)
	if err != nil {
		t.Fatalf("signer.NewFromHex(%s): %v", envKey, err)
	}
	return s
}

// ── tx plumbing ──────────────────────────────────────────────────────────────

// txOpts builds a bind.TransactOpts driven by the provided Signer. ctx flows
// through into the signer callback so any RPC timeout cancels signing too.
func txOpts(ctx context.Context, conn *client.Connection, s signer.Signer) (*bind.TransactOpts, error) {
	from := s.Address()
	chainID := conn.ChainID()
	nonce, err := conn.EthClient().PendingNonceAt(ctx, from)
	if err != nil {
		return nil, fmt.Errorf("pending nonce: %w", err)
	}
	return &bind.TransactOpts{
		From:    from,
		Nonce:   new(big.Int).SetUint64(nonce),
		Context: ctx,
		Signer: func(addr common.Address, tx *types.Transaction) (*types.Transaction, error) {
			return s.SignTx(ctx, tx, chainID)
		},
	}, nil
}

// waitMined blocks until tx is mined and asserts receipt.Status == 1.
// Returns the receipt for further inspection.
func waitMined(t *testing.T, ctx context.Context, conn *client.Connection, tx *types.Transaction, label string) *types.Receipt {
	t.Helper()
	t.Logf("  ↳ %s tx=%s", label, tx.Hash().Hex())
	t.Logf("    bscscan: https://testnet.bscscan.com/tx/%s", tx.Hash().Hex())
	rcpt, err := bind.WaitMined(ctx, conn.EthClient(), tx)
	if err != nil {
		t.Fatalf("%s WaitMined: %v", label, err)
	}
	if rcpt.Status != types.ReceiptStatusSuccessful {
		t.Fatalf("%s tx reverted (status=0); see bscscan for revert reason", label)
	}
	t.Logf("    mined block=%d gasUsed=%d", rcpt.BlockNumber.Uint64(), rcpt.GasUsed)
	return rcpt
}

// ── ID generation / parsing ──────────────────────────────────────────────────

// rand32 returns a random 32-byte id (suitable for matchID/betID).
func rand32(t *testing.T) [32]byte {
	t.Helper()
	var out [32]byte
	if _, err := rand.Read(out[:]); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return out
}

// parseHex32 reads a 0x-prefixed 32-byte hex string from the given env var.
// Used by resume-style tests that need to point at an existing on-chain id.
func parseHex32(t *testing.T, key string) [32]byte {
	t.Helper()
	v := envOrSkip(t, key)
	v = strings.TrimPrefix(v, "0x")
	if len(v) != 64 {
		t.Fatalf("%s must be 32-byte hex (got %d chars)", key, len(v))
	}
	raw, err := hex.DecodeString(v)
	if err != nil {
		t.Fatalf("%s: %v", key, err)
	}
	var out [32]byte
	copy(out[:], raw)
	return out
}

// ── formatting ───────────────────────────────────────────────────────────────

// usdtSuffixed prints a USDT raw amount (6 decimals) with a trailing " USDT"
// for human-readable diagnostics (used by preflight reports).
func usdtSuffixed(raw *big.Int) string {
	if raw == nil {
		return "<nil>"
	}
	s := raw.String()
	switch {
	case raw.Sign() == 0:
		return "0 USDT"
	case len(s) <= 6:
		return fmt.Sprintf("0.%s USDT", strings.Repeat("0", 6-len(s))+s)
	default:
		return fmt.Sprintf("%s.%s USDT", s[:len(s)-6], s[len(s)-6:])
	}
}

// usdt6 formats a *big.Int as USDT 6 decimals — bare number, no " USDT" suffix.
// Used inside flow assertions/logs where the unit is implied.
func usdt6(v *big.Int) string {
	if v == nil {
		return "<nil>"
	}
	abs := new(big.Int).Abs(v)
	whole, frac := new(big.Int).QuoRem(abs, big.NewInt(1_000_000), new(big.Int))
	sign := ""
	if v.Sign() < 0 {
		sign = "-"
	}
	return fmt.Sprintf("%s%s.%06d", sign, whole.String(), frac.Int64())
}

// signed wraps usdt6 and prefixes positives with '+' (negatives already get
// '-' from usdt6). Useful for delta lines.
func signed(v *big.Int) string {
	s := usdt6(v)
	if v.Sign() > 0 {
		return "+" + s
	}
	return s
}

// bnb formats a wei amount (18 decimals) as "x.xxxxxx BNB".
func bnb(raw *big.Int) string {
	if raw == nil {
		return "<nil>"
	}
	f := new(big.Float).Quo(new(big.Float).SetInt(raw), big.NewFloat(1e18))
	return fmt.Sprintf("%.6f BNB", f)
}

// redactRPC keeps just scheme://host so an Alchemy/Infura key isn't echoed.
func redactRPC(u string) string {
	if i := strings.Index(u, "://"); i >= 0 {
		rest := u[i+3:]
		if j := strings.Index(rest, "/"); j >= 0 {
			return u[:i+3] + rest[:j] + "/<redacted>"
		}
		return u
	}
	return "<bad-url>"
}
