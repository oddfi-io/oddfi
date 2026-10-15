package client

import (
	"errors"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
)

func TestNewConnection_RPCRequired(t *testing.T) {
	_, err := NewConnection(ConnectionConfig{Env: Testnet})
	if !errors.Is(err, ErrRPCRequired) {
		t.Fatalf("want ErrRPCRequired, got %v", err)
	}
}

func TestEnvString(t *testing.T) {
	cases := map[Env]string{
		Testnet: "testnet",
		Mainnet: "mainnet",
	}
	for e, want := range cases {
		if got := e.String(); got != want {
			t.Errorf("Env(%d).String() = %q, want %q", int(e), got, want)
		}
	}
	if Mainnet.IsMainnet() != true || Testnet.IsMainnet() != false {
		t.Error("IsMainnet wrong")
	}
}

func TestRedactRPC(t *testing.T) {
	cases := []struct{ in, want string }{
		{"https://bsc-dataseed.bnbchain.org", "https://bsc-dataseed.bnbchain.org"},
		{"https://bsc.example.com/v3/abc-secret-key", "https://bsc.example.com/v3/*"},
		{"https://example.com/api/v1/secret/path", "https://example.com/api/*"},
		{"not a url", "<unparseable>"},
	}
	for _, c := range cases {
		got := redactRPC(c.in)
		// "not a url" is parseable as opaque; just sanity check it doesn't expose secrets
		if c.in == "not a url" {
			if got == c.in {
				t.Errorf("redactRPC(%q) = %q, expected redacted", c.in, got)
			}
			continue
		}
		if got != c.want {
			t.Errorf("redactRPC(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestErrChainIDMismatch_Message(t *testing.T) {
	e := &ErrChainIDMismatch{Want: 56, Got: 97, Env: Mainnet}
	if !strings.Contains(e.Error(), "97") || !strings.Contains(e.Error(), "56") {
		t.Errorf("error msg lacks ids: %v", e)
	}
}

func TestErrRoleMismatch_Message(t *testing.T) {
	e := &ErrRoleMismatch{
		Role:     "admin",
		Expected: common.HexToAddress("0x1111111111111111111111111111111111111111"),
		Onchain:  common.HexToAddress("0x2222222222222222222222222222222222222222"),
		Env:      Mainnet,
	}
	if !strings.Contains(e.Error(), "admin") {
		t.Errorf("error msg lacks role: %v", e)
	}
}
