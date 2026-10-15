package service

import (
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/hex"
	"everything_finance/org/web-api/internal/config"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/crypto"
)

func TestVerifySignature_ValidSignature(t *testing.T) {
	privKey, address := generateTestKey(t)
	message := "hello world"

	sig := signMessage(t, privKey, message)

	newAuthService := NewAuthService(nil, nil, nil, &config.Config{JWT: config.JWTConfig{Secret: "test"}})
	result := newAuthService.verifySignature(address, message, sig)
	if !result {
		t.Errorf("expected valid signature to return true, got false")
	}
}

func TestVerifySignature_WrongAddress(t *testing.T) {
	privKey, _ := generateTestKey(t)
	_, wrongAddress := generateTestKey(t)
	message := "hello world"

	sig := signMessage(t, privKey, message)

	newAuthService := NewAuthService(nil, nil, nil, &config.Config{JWT: config.JWTConfig{Secret: "test"}})
	result := newAuthService.verifySignature(wrongAddress, message, sig)
	if result {
		t.Errorf("expected signature with wrong address to return false, got true")
	}
}

func TestVerifySignature_WrongMessage(t *testing.T) {
	privKey, address := generateTestKey(t)
	message := "hello world"

	sig := signMessage(t, privKey, message)

	newAuthService := NewAuthService(nil, nil, nil, &config.Config{JWT: config.JWTConfig{Secret: "test"}})
	result := newAuthService.verifySignature(address, "wrong message", sig)
	if result {
		t.Errorf("expected signature with wrong message to return false, got true")
	}
}

func TestVerifySignature_TamperedSignature(t *testing.T) {
	privKey, address := generateTestKey(t)
	message := "hello world"

	sigBytes := signMessageBytes(t, privKey, message)
	sigBytes[10] ^= 0xFF
	tamperedSig := hex.EncodeToString(sigBytes)

	newAuthService := NewAuthService(nil, nil, nil, &config.Config{JWT: config.JWTConfig{Secret: "test"}})
	result := newAuthService.verifySignature(address, message, tamperedSig)
	if result {
		t.Errorf("expected tampered signature to return false, got true")
	}
}

func TestVerifySignature_EmptySignature(t *testing.T) {
	address := "0x1234567890123456789012345678901234567890"
	message := "hello"

	newAuthService := NewAuthService(nil, nil, nil, &config.Config{JWT: config.JWTConfig{Secret: "test"}})
	result := newAuthService.verifySignature(address, message, "")
	if result {
		t.Errorf("expected empty signature to return false, got true")
	}
}

func TestVerifySignature_InvalidHex(t *testing.T) {
	address := "0x1234567890123456789012345678901234567890"
	message := "hello"

	newAuthService := NewAuthService(nil, nil, nil, &config.Config{JWT: config.JWTConfig{Secret: "test"}})
	result := newAuthService.verifySignature(address, message, "not-hex-string")
	if result {
		t.Errorf("expected invalid hex signature to return false, got true")
	}
}

func TestVerifySignature_ShortSignature(t *testing.T) {
	address := "0x1234567890123456789012345678901234567890"
	message := "hello"

	newAuthService := NewAuthService(nil, nil, nil, &config.Config{JWT: config.JWTConfig{Secret: "test"}})
	result := newAuthService.verifySignature(address, message, "0x1abc")
	if result {
		t.Errorf("expected short signature to return false, got true")
	}
}

func TestVerifySignature_With0xPrefix(t *testing.T) {
	privKey, address := generateTestKey(t)
	message := "test message with prefix"

	sigBytes := signMessageBytes(t, privKey, message)
	sig := "0x" + hex.EncodeToString(sigBytes)
	t.Logf("sig: %s", sig)

	newAuthService := NewAuthService(nil, nil, nil, &config.Config{JWT: config.JWTConfig{Secret: "test"}})
	result := newAuthService.verifySignature(address, message, sig)
	if result {
		t.Errorf("expected signature with 0x prefix to return true, got false")
	}
}

func TestVerifySignature_CaseInsensitiveAddress(t *testing.T) {
	privKey, _ := generateTestKey(t)
	lowerAddress := "0x1234567890123456789012345678901234567890"
	message := "test"

	sig := signMessage(t, privKey, message)

	newAuthService := NewAuthService(nil, nil, nil, &config.Config{JWT: config.JWTConfig{Secret: "test"}})
	result := newAuthService.verifySignature("0x1234567890123456789012345678901234567890", message, sig)
	if result {
		t.Errorf("expected lowercase address to return true, got false")
	}

	result = newAuthService.verifySignature(lowerAddress, message, sig)
	if result {
		t.Errorf("expected uppercase address to return true, got false")
	}
}

func generateTestKey(t *testing.T) (*ecdsa.PrivateKey, string) {
	t.Helper()
	privKey, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}
	address := crypto.PubkeyToAddress(privKey.PublicKey).Hex()
	return privKey, address
}

func signMessage(t *testing.T, privKey *ecdsa.PrivateKey, message string) string {
	t.Helper()
	data := []byte(message)
	msgHash := accounts.TextHash(data)
	sig, err := crypto.Sign(msgHash, privKey)
	if err != nil {
		t.Fatalf("failed to sign message: %v", err)
	}
	sig[crypto.RecoveryIDOffset] += 27
	return hex.EncodeToString(sig)
}

func signMessageBytes(t *testing.T, privKey *ecdsa.PrivateKey, message string) []byte {
	t.Helper()
	msgHash := sha256.Sum256([]byte(message))
	sig, err := crypto.Sign(msgHash[:], privKey)
	if err != nil {
		t.Fatalf("failed to sign message: %v", err)
	}
	return sig
}

func TestMessage(t *testing.T) {
	msg := "oddfi wants you to sign in with your account:aa ChainID:bb Nonce:cc Issued At:dd Expiration time:ee"
	result := matchMessage(msg)
	if result == nil {
		t.Errorf("expected match message to return true, got false")
	}
	if result["account"] != "aa" {
		t.Errorf("expected account to be aa, got %s", result["account"])
	}
	if result["chainID"] != "bb" {
		t.Errorf("expected chainID to be bb, got %s", result["chainID"])
	}
	/*
	   (map[string]string) (len=5) {
	    (string) (len=7) "account": (string) (len=2) "aa",
	    (string) (len=7) "chainID": (string) (len=2) "bb",
	    (string) (len=5) "nonce": (string) (len=2) "cc",
	    (string) (len=8) "issuedAt": (string) (len=2) "dd",
	    (string) (len=10) "expireTime": (string) (len=2) "ee"
	   }
	*/
	spew.Dump(result)
}
