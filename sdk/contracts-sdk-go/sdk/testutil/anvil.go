// Package testutil provides helpers for SDK tests:
//
//   - ForkTestnet / ForkMainnet: spin up `anvil --fork-url` against pinned
//     blocks (see sdk/testdata/pinned-blocks.json).
//
// The anvil binary must be on PATH — install via Foundry
// (https://getfoundry.sh).
package testutil

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/fixtures"
)

// ForkEnv is a running anvil fork, returned by ForkTestnet / ForkMainnet.
// The Cleanup is automatically registered with t.Cleanup; callers don't
// need to call it manually.
type ForkEnv struct {
	RPC         string  // http URL pointing at anvil
	Port        int
	BlockPinned uint64  // 0 = "latest" (anvil default; less reproducible)
	Cmd         *exec.Cmd
}

// ForkTestnet starts an anvil fork of BNB Smart Chain Testnet at the
// pinned block (or latest if pinned=0). Skips the test if anvil isn't on
// PATH or the upstream RPC env var is missing.
//
// Required env: BSC_TESTNET_RPC.
func ForkTestnet(t *testing.T) *ForkEnv {
	t.Helper()
	rpc := os.Getenv("BSC_TESTNET_RPC")
	if rpc == "" {
		t.Skip("BSC_TESTNET_RPC env not set; skipping fork test")
	}
	pb, err := fixtures.LoadPinnedBlocks()
	if err != nil {
		t.Fatalf("load pinned blocks: %v", err)
	}
	return startAnvil(t, "testnet", rpc, pb.Testnet)
}

// ForkMainnet starts an anvil fork of BNB Smart Chain Mainnet at the
// pinned block. Required env: BSC_MAINNET_RPC.
func ForkMainnet(t *testing.T) *ForkEnv {
	t.Helper()
	rpc := os.Getenv("BSC_MAINNET_RPC")
	if rpc == "" {
		t.Skip("BSC_MAINNET_RPC env not set; skipping fork test")
	}
	pb, err := fixtures.LoadPinnedBlocks()
	if err != nil {
		t.Fatalf("load pinned blocks: %v", err)
	}
	return startAnvil(t, "mainnet", rpc, pb.Mainnet)
}

// startAnvil launches `anvil --fork-url X --fork-block-number N --port P
// --silent`, waits for it to accept JSON-RPC, and returns a *ForkEnv. The
// process is killed automatically via t.Cleanup.
func startAnvil(t *testing.T, label, forkURL string, blockPinned uint64) *ForkEnv {
	t.Helper()
	if _, err := exec.LookPath("anvil"); err != nil {
		t.Skipf("anvil not on PATH; skipping %s fork test (install via Foundry)", label)
	}

	port, err := pickPort()
	if err != nil {
		t.Fatalf("pick port: %v", err)
	}

	args := []string{
		"--fork-url", forkURL,
		"--port", strconv.Itoa(port),
		"--silent",
	}
	if blockPinned > 0 {
		args = append(args, "--fork-block-number", strconv.FormatUint(blockPinned, 10))
	}
	cmd := exec.Command("anvil", args...)
	// Pipe child output to test logs only on failure (anvil's --silent
	// already suppresses normal startup spam).
	cmd.Stdout = nil
	cmd.Stderr = nil
	if err := cmd.Start(); err != nil {
		t.Fatalf("start anvil: %v", err)
	}

	rpc := fmt.Sprintf("http://127.0.0.1:%d", port)
	env := &ForkEnv{RPC: rpc, Port: port, BlockPinned: blockPinned, Cmd: cmd}

	// Healthcheck: poll JSON-RPC until web3_clientVersion returns or timeout.
	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		if anvilReady(rpc) {
			t.Cleanup(func() { _ = killProcess(cmd) })
			return env
		}
		time.Sleep(150 * time.Millisecond)
	}
	_ = killProcess(cmd)
	t.Fatalf("anvil did not become ready on %s within 30s", rpc)
	return nil // unreachable
}

// pickPort grabs a free TCP port from the OS. Caller binds it within a
// small window after the call returns.
func pickPort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	addr := l.Addr().(*net.TCPAddr)
	return addr.Port, nil
}

// anvilReady probes JSON-RPC. We POST a minimal web3_clientVersion request
// and consider any non-error 200 a success.
func anvilReady(rpc string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	body := strings.NewReader(`{"jsonrpc":"2.0","method":"web3_clientVersion","id":1,"params":[]}`)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rpc, body)
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

// killProcess kills cmd's process tree and waits for it. Tolerates
// already-exited processes.
func killProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	if err := cmd.Process.Kill(); err != nil {
		// If the process is already gone, Kill returns "process already
		// finished" — treat as success.
		if errors.Is(err, os.ErrProcessDone) {
			return nil
		}
	}
	_ = cmd.Wait()
	return nil
}
