//go:build e2e

// magic_test_helpers.go — a local in-memory stand-in for the Magic Signer,
// used by the e2e scenario tests. It holds user private keys in memory and
// signs digests with crypto.Sign, emulating the real service's r||s||v output
// with v ∈ {27,28}.

package business_test

import (
	"context"
	"crypto/ecdsa"
	"fmt"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"
)

// fakeMagicSigner implements magicclient.Signer for tests.
type fakeMagicSigner struct {
	keys map[string]*ecdsa.PrivateKey
}

func newFakeMagicSigner(keys map[string]*ecdsa.PrivateKey) *fakeMagicSigner {
	return &fakeMagicSigner{keys: keys}
}

// Compile-time check.
var _ magicclient.Signer = (*fakeMagicSigner)(nil)

func (f *fakeMagicSigner) WalletAddress(_ context.Context, userID string) (common.Address, error) {
	k, ok := f.keys[userID]
	if !ok {
		return common.Address{}, fmt.Errorf("fakeMagicSigner: unknown user %q", userID)
	}
	return crypto.PubkeyToAddress(k.PublicKey), nil
}

func (f *fakeMagicSigner) SignDigest(_ context.Context, userID string, digest [32]byte) (magicclient.Signature, error) {
	k, ok := f.keys[userID]
	if !ok {
		return magicclient.Signature{}, fmt.Errorf("fakeMagicSigner: unknown user %q", userID)
	}
	sig, err := crypto.Sign(digest[:], k) // v ∈ {0,1}
	if err != nil {
		return magicclient.Signature{}, err
	}
	sig[64] += 27 // align with the real Magic service: v ∈ {27,28}
	var out magicclient.Signature
	copy(out[:], sig)
	return out, nil
}
