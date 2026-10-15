package integration_test

import (
	"context"
	"testing"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/require"
)

func TestSign_VerifyRecoverable(t *testing.T) {
	ts := startTestServer(t, "test")
	cli := newClient(t, ts)

	// 1. Discover the address for this user.
	addr, err := cli.WalletAddress(context.Background(), "user-XYZ")
	require.NoError(t, err)

	// 2. Construct a digest to sign.
	var digest [32]byte
	copy(digest[:], crypto.Keccak256([]byte("some test payload")))

	// 3. Get signature from the service.
	sig, err := cli.SignDigest(context.Background(), "user-XYZ", digest)
	require.NoError(t, err)

	// 4. Verify: ECDSA recover should produce the same address.
	sigBytes := make([]byte, 65)
	copy(sigBytes, sig[:])
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27 // recover needs parity, not EIP-155 v
	}
	pubKey, err := crypto.SigToPub(digest[:], sigBytes)
	require.NoError(t, err)
	recovered := crypto.PubkeyToAddress(*pubKey)
	require.Equal(t, addr, recovered, "signature must recover to the user's address")
}

func TestSign_DifferentDigestsDifferentSignatures(t *testing.T) {
	ts := startTestServer(t, "test")
	cli := newClient(t, ts)

	var d1, d2 [32]byte
	copy(d1[:], crypto.Keccak256([]byte("payload-1")))
	copy(d2[:], crypto.Keccak256([]byte("payload-2")))

	s1, err := cli.SignDigest(context.Background(), "user-A", d1)
	require.NoError(t, err)
	s2, err := cli.SignDigest(context.Background(), "user-A", d2)
	require.NoError(t, err)
	require.NotEqual(t, s1, s2)
}

func TestSign_VFormatIs27Or28(t *testing.T) {
	ts := startTestServer(t, "test")
	cli := newClient(t, ts)

	var digest [32]byte
	copy(digest[:], crypto.Keccak256([]byte("test")))

	sig, err := cli.SignDigest(context.Background(), "user-vtest", digest)
	require.NoError(t, err)
	require.Contains(t, []byte{27, 28}, sig[64], "v must be 27 or 28, got %d", sig[64])
}
