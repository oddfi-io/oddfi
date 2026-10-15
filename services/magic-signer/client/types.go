package client

import (
	"context"

	"github.com/ethereum/go-ethereum/common"
)

// Signature is r(32) || s(32) || v(1), with v ∈ {27, 28}.
type Signature [65]byte

// Signer is the minimal capability that callers depend on.
//
// *Client implements this. Tests may provide their own implementations
// (e.g. an in-memory signer that uses crypto.Sign with a known key).
type Signer interface {
	WalletAddress(ctx context.Context, userID string) (common.Address, error)
	SignDigest(ctx context.Context, userID string, digest [32]byte) (Signature, error)
}

// Compile-time check that *Client implements Signer.
var _ Signer = (*Client)(nil)
