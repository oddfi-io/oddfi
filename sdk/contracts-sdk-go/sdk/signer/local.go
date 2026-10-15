package signer

import (
	"context"
	"crypto/ecdsa"
	"crypto/subtle"
	"errors"
	"fmt"
	"math/big"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// localSigner holds an unencrypted private key in process memory and signs
// using go-ethereum primitives. The raw bytes from which the key was parsed
// are zeroed immediately after parse; the *ecdsa.PrivateKey itself is what
// remains in memory.
type localSigner struct {
	key  *ecdsa.PrivateKey
	addr common.Address
}

// NewFromHex parses a 0x-prefixed (or bare) hex private key string.
//
// The input string is treated as one-shot: callers that read from env vars
// should clear the env var (os.Unsetenv) immediately after this returns to
// shrink the in-memory window.
func NewFromHex(hexKey string) (Signer, error) {
	hexKey = strings.TrimSpace(hexKey)
	hexKey = strings.TrimPrefix(hexKey, "0x")
	hexKey = strings.TrimPrefix(hexKey, "0X")
	if hexKey == "" {
		return nil, ErrEmptyKeyMaterial
	}
	key, err := crypto.HexToECDSA(hexKey)
	if err != nil {
		return nil, fmt.Errorf("signer: parse hex key: %w", err)
	}
	return &localSigner{
		key:  key,
		addr: crypto.PubkeyToAddress(key.PublicKey),
	}, nil
}

// NewFromSecretFile reads a raw hex private key from path. Intended for
// k8s/Docker tmpfs secret mounts (e.g. /run/secrets/admin_pk).
//
// The file's bytes are zeroed in memory after parsing succeeds. The file
// itself is not removed — k8s/Docker secret mounts are read-only tmpfs and
// removing them would fail anyway; the OS-level ephemerality is what
// protects the secret at rest.
func NewFromSecretFile(path string) (Signer, error) {
	if path == "" {
		return nil, errors.New("signer: NewFromSecretFile: empty path")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("signer: read secret file %q: %w", path, err)
	}
	defer zero(raw)
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return nil, fmt.Errorf("signer: secret file %q is empty: %w", path, ErrEmptyKeyMaterial)
	}
	return NewFromHex(trimmed)
}

// SignTx implements Signer.
func (s *localSigner) SignTx(_ context.Context, tx *types.Transaction, chainID *big.Int) (*types.Transaction, error) {
	if chainID == nil || chainID.Sign() == 0 {
		return nil, errors.New("signer: SignTx: chainID required and non-zero")
	}
	signer := types.LatestSignerForChainID(chainID)
	signed, err := types.SignTx(tx, signer, s.key)
	if err != nil {
		return nil, fmt.Errorf("signer: SignTx: %w", err)
	}
	return signed, nil
}

// SignHash implements Signer. Returns 65 bytes (r||s||v) with v in {27,28}.
func (s *localSigner) SignHash(_ context.Context, hash [32]byte) ([]byte, error) {
	sig, err := crypto.Sign(hash[:], s.key)
	if err != nil {
		return nil, fmt.Errorf("signer: SignHash: %w", err)
	}
	if len(sig) != 65 {
		return nil, fmt.Errorf("signer: SignHash: unexpected sig length %d", len(sig))
	}
	// crypto.Sign returns v as 0/1 (recovery id); Ethereum convention is 27/28.
	sig[64] += 27
	return sig, nil
}

// Address implements Signer.
func (s *localSigner) Address() common.Address { return s.addr }

// zero overwrites a byte slice with zeros in constant time.
func zero(b []byte) {
	z := make([]byte, len(b))
	subtle.ConstantTimeCopy(1, b, z)
}
