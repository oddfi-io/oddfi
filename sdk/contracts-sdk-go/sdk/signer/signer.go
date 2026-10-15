// Package signer abstracts transaction signing for the SDK.
//
// Phase 1 implementations: NewFromHex, NewFromSecretFile, NewFromKeystoreFile,
// and NewAuto (env→file fallback with mainnet-safety guards).
//
// Phase 2 (sub-package signer/awskms): KMS-backed signing for production.
package signer

import (
	"context"
	"errors"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// Signer wraps everything the SDK needs from a signing identity.
//
// Implementations must be safe for concurrent use.
type Signer interface {
	// Address returns the public address corresponding to the underlying key.
	Address() common.Address

	// SignTx returns a signed copy of tx valid on the given chain id (EIP-155).
	SignTx(ctx context.Context, tx *types.Transaction, chainID *big.Int) (*types.Transaction, error)

	// SignHash signs an arbitrary 32-byte digest, used for multisig
	// proposals (Safe safeTxHash, EIP-712 etc.). Returns a 65-byte
	// (r||s||v) signature with v in {27, 28} as Ethereum expects.
	SignHash(ctx context.Context, hash [32]byte) ([]byte, error)
}

// ErrEmptyKeyMaterial is returned when a signer constructor receives an empty
// hex string or empty file.
var ErrEmptyKeyMaterial = errors.New("signer: empty key material")
