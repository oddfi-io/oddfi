package eip7702

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/holiman/uint256"
)

// TestAuthorizationDigestMatchesSignSetCode proves that signing the digest from
// AuthorizationDigest with a known key (and the {0,1}→{27,28} v shift the Magic
// Signer applies) reassembles, via AssembleAuthorization, into exactly the same
// SetCodeAuthorization that go-ethereum's types.SignSetCode produces.
func TestAuthorizationDigestMatchesSignSetCode(t *testing.T) {
	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	chainID := big.NewInt(97)
	impl := common.HexToAddress("0x00000000000000000000000000000000000000Aa")
	var nonce uint64 = 42

	// Reference: what go-ethereum signs/produces natively.
	want, err := types.SignSetCode(key, types.SetCodeAuthorization{
		ChainID: *uint256.MustFromBig(chainID),
		Address: impl,
		Nonce:   nonce,
	})
	if err != nil {
		t.Fatalf("SignSetCode: %v", err)
	}

	// Our path: digest → external sign (crypto.Sign here stands in for Magic) →
	// shift v to {27,28} → AssembleAuthorization.
	digest, err := AuthorizationDigest(chainID, impl, nonce)
	if err != nil {
		t.Fatalf("AuthorizationDigest: %v", err)
	}

	// Sanity: the digest must equal go-ethereum's SigHash for the same auth.
	if got := want.SigHash(); got != common.Hash(digest) {
		t.Fatalf("digest mismatch:\n got  %x\n want %x", digest, got)
	}

	raw, err := crypto.Sign(digest[:], key) // v ∈ {0,1}
	if err != nil {
		t.Fatalf("crypto.Sign: %v", err)
	}
	raw[64] += 27 // emulate Magic returning v ∈ {27,28}

	var sig [65]byte
	copy(sig[:], raw)

	got, err := AssembleAuthorization(chainID, impl, nonce, sig)
	if err != nil {
		t.Fatalf("AssembleAuthorization: %v", err)
	}

	if got.V != want.V {
		t.Errorf("V mismatch: got %d want %d", got.V, want.V)
	}
	if got.R.Cmp(&want.R) != 0 {
		t.Errorf("R mismatch: got %s want %s", got.R.String(), want.R.String())
	}
	if got.S.Cmp(&want.S) != 0 {
		t.Errorf("S mismatch: got %s want %s", got.S.String(), want.S.String())
	}
	if got.ChainID.Cmp(&want.ChainID) != 0 || got.Address != want.Address || got.Nonce != want.Nonce {
		t.Errorf("header mismatch: got %+v want %+v", got, want)
	}

	// The assembled authorization must recover to the signing key's address.
	authority, err := got.Authority()
	if err != nil {
		t.Fatalf("Authority: %v", err)
	}
	if authority != crypto.PubkeyToAddress(key.PublicKey) {
		t.Errorf("authority mismatch: got %s want %s", authority, crypto.PubkeyToAddress(key.PublicKey))
	}
}

func TestAssembleAuthorizationRejectsBadV(t *testing.T) {
	var sig [65]byte
	sig[64] = 0 // y-parity, not the {27,28} the Magic Signer must return
	if _, err := AssembleAuthorization(big.NewInt(1), common.Address{}, 0, sig); err == nil {
		t.Fatal("expected error for v=0, got nil")
	}
}
