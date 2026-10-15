package signer

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// generateKey returns a fresh test private key + its hex string + address.
func generateKey(t *testing.T) (*ecdsa.PrivateKey, string, common.Address) {
	t.Helper()
	k, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	hex := common.Bytes2Hex(crypto.FromECDSA(k))
	addr := crypto.PubkeyToAddress(k.PublicKey)
	return k, hex, addr
}

func TestNewFromHex_OK(t *testing.T) {
	_, hex, addr := generateKey(t)
	for _, in := range []string{hex, "0x" + hex, "0X" + hex, "  " + hex + "\n"} {
		s, err := NewFromHex(in)
		if err != nil {
			t.Fatalf("NewFromHex(%q): %v", in, err)
		}
		if s.Address() != addr {
			t.Errorf("Address() = %s, want %s", s.Address().Hex(), addr.Hex())
		}
	}
}

func TestNewFromHex_Empty(t *testing.T) {
	for _, in := range []string{"", "0x", "  ", "\n"} {
		if _, err := NewFromHex(in); !errors.Is(err, ErrEmptyKeyMaterial) {
			t.Errorf("NewFromHex(%q): want ErrEmptyKeyMaterial, got %v", in, err)
		}
	}
}

func TestNewFromHex_Invalid(t *testing.T) {
	if _, err := NewFromHex("not-hex"); err == nil {
		t.Error("expected error for non-hex input")
	}
}

func TestNewFromSecretFile_OK(t *testing.T) {
	_, hex, addr := generateKey(t)
	tmp := filepath.Join(t.TempDir(), "secret_pk")
	if err := os.WriteFile(tmp, []byte(hex+"\n"), 0o400); err != nil {
		t.Fatalf("write tmp: %v", err)
	}
	s, err := NewFromSecretFile(tmp)
	if err != nil {
		t.Fatalf("NewFromSecretFile: %v", err)
	}
	if s.Address() != addr {
		t.Errorf("Address mismatch")
	}
}

func TestNewFromSecretFile_Empty(t *testing.T) {
	tmp := filepath.Join(t.TempDir(), "empty")
	if err := os.WriteFile(tmp, []byte("   \n"), 0o400); err != nil {
		t.Fatalf("write tmp: %v", err)
	}
	if _, err := NewFromSecretFile(tmp); err == nil {
		t.Error("expected error for empty secret file")
	}
}

func TestNewFromSecretFile_NotExist(t *testing.T) {
	_, err := NewFromSecretFile(filepath.Join(t.TempDir(), "nope"))
	if err == nil {
		t.Error("expected error for missing file")
	}
}

func TestSignTx(t *testing.T) {
	_, hex, addr := generateKey(t)
	s, err := NewFromHex(hex)
	if err != nil {
		t.Fatalf("NewFromHex: %v", err)
	}
	chainID := big.NewInt(97)
	tx := types.NewTransaction(0, common.HexToAddress("0x1"), big.NewInt(1), 21000, big.NewInt(1e9), nil)
	signed, err := s.SignTx(context.Background(), tx, chainID)
	if err != nil {
		t.Fatalf("SignTx: %v", err)
	}
	signer := types.LatestSignerForChainID(chainID)
	from, err := types.Sender(signer, signed)
	if err != nil {
		t.Fatalf("recover sender: %v", err)
	}
	if from != addr {
		t.Errorf("recovered sender %s != signer addr %s", from.Hex(), addr.Hex())
	}
}

func TestSignTx_NoChainID(t *testing.T) {
	_, hex, _ := generateKey(t)
	s, _ := NewFromHex(hex)
	tx := types.NewTransaction(0, common.Address{}, big.NewInt(0), 0, big.NewInt(0), nil)
	if _, err := s.SignTx(context.Background(), tx, nil); err == nil {
		t.Error("expected error for nil chainID")
	}
	if _, err := s.SignTx(context.Background(), tx, big.NewInt(0)); err == nil {
		t.Error("expected error for zero chainID")
	}
}

func TestSignHash(t *testing.T) {
	_, hex, addr := generateKey(t)
	s, _ := NewFromHex(hex)
	var h [32]byte
	copy(h[:], []byte("test-hash-padded-to-32-bytes-yes"))
	sig, err := s.SignHash(context.Background(), h)
	if err != nil {
		t.Fatalf("SignHash: %v", err)
	}
	if len(sig) != 65 {
		t.Fatalf("sig len = %d, want 65", len(sig))
	}
	if sig[64] != 27 && sig[64] != 28 {
		t.Errorf("v = %d, want 27 or 28", sig[64])
	}
	// Recover and check.
	v := sig[64] - 27
	recoverable := append([]byte{}, sig[:64]...)
	recoverable = append(recoverable, v)
	pub, err := crypto.SigToPub(h[:], recoverable)
	if err != nil {
		t.Fatalf("SigToPub: %v", err)
	}
	if got := crypto.PubkeyToAddress(*pub); got != addr {
		t.Errorf("recovered %s, want %s", got.Hex(), addr.Hex())
	}
}

// fakeEnv implements IsMainnetCheck for NewAuto tests.
type fakeEnv struct{ mainnet bool }

func (f fakeEnv) IsMainnet() bool { return f.mainnet }

func TestNewAuto_Testnet_EnvWins(t *testing.T) {
	_, hex, addr := generateKey(t)
	t.Setenv("TEST_PK", hex)
	tmp := writeTempPK(t, "ignored-because-env-is-set")
	s, err := NewAuto(fakeEnv{mainnet: false}, AutoOpts{EnvVar: "TEST_PK", FilePath: tmp})
	if err != nil {
		t.Fatalf("NewAuto: %v", err)
	}
	if s.Address() != addr {
		t.Errorf("addr mismatch")
	}
	// Env var should be cleared after read.
	if v := os.Getenv("TEST_PK"); v != "" {
		t.Errorf("TEST_PK not unset after auto-read: %q", v)
	}
}

func TestNewAuto_Testnet_FileFallback(t *testing.T) {
	os.Unsetenv("TEST_PK_NONE")
	_, hex, addr := generateKey(t)
	tmp := writeTempPK(t, hex)
	s, err := NewAuto(fakeEnv{mainnet: false}, AutoOpts{EnvVar: "TEST_PK_NONE", FilePath: tmp})
	if err != nil {
		t.Fatalf("NewAuto: %v", err)
	}
	if s.Address() != addr {
		t.Errorf("addr mismatch")
	}
}

func TestNewAuto_Mainnet_EnvForbidden(t *testing.T) {
	t.Setenv("MN_PK", "0xdead")
	tmp := writeTempPK(t, "irrelevant")
	_, err := NewAuto(fakeEnv{mainnet: true}, AutoOpts{EnvVar: "MN_PK", FilePath: tmp})
	if err == nil || !strings.Contains(err.Error(), "forbidden") {
		t.Errorf("want mainnet env-forbidden error, got %v", err)
	}
}

func TestNewAuto_Mainnet_FileOK(t *testing.T) {
	os.Unsetenv("MN_PK_NONE")
	_, hex, addr := generateKey(t)
	tmp := writeTempPK(t, hex)
	s, err := NewAuto(fakeEnv{mainnet: true}, AutoOpts{EnvVar: "MN_PK_NONE", FilePath: tmp})
	if err != nil {
		t.Fatalf("NewAuto: %v", err)
	}
	if s.Address() != addr {
		t.Errorf("addr mismatch")
	}
}

func TestNewAuto_NilEnv(t *testing.T) {
	if _, err := NewAuto(nil, AutoOpts{EnvVar: "X", FilePath: "y"}); err == nil {
		t.Error("expected error for nil env")
	}
}

func TestNewAuto_MissingOpts(t *testing.T) {
	if _, err := NewAuto(fakeEnv{}, AutoOpts{}); err == nil {
		t.Error("expected error for empty opts")
	}
}

func TestRedactAddr(t *testing.T) {
	if got := redactAddr("0x1234567890abcdef1234567890abcdef12345678"); got != "0x1234…5678" {
		t.Errorf("redactAddr = %q", got)
	}
	if got := redactAddr("short"); got != "short" {
		t.Errorf("short passthrough failed: %q", got)
	}
}

func writeTempPK(t *testing.T, content string) string {
	t.Helper()
	tmp := filepath.Join(t.TempDir(), "pk")
	if err := os.WriteFile(tmp, []byte(content), 0o400); err != nil {
		t.Fatalf("write: %v", err)
	}
	return tmp
}

func TestNewFromKeystoreFile_BadInput(t *testing.T) {
	if _, err := NewFromKeystoreFile("", "x"); err == nil {
		t.Error("expected error for empty path")
	}
	if _, err := NewFromKeystoreFile(filepath.Join(t.TempDir(), "no-such"), "x"); err == nil {
		t.Error("expected error for missing keystore")
	}
	tmp := writeTempPK(t, "{}") // valid JSON but not a keystore
	if _, err := NewFromKeystoreFile(tmp, "wrong"); err == nil {
		t.Error("expected error for malformed keystore")
	}
}
