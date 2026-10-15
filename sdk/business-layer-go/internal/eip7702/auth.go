package eip7702

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/holiman/uint256"
)

// AuthNonce semantics (unchanged from the previous SignAuthorization):
//
// AuthNonce MUST equal A's current EOA tx counter (ethclient.NonceAt(ctx, A, nil));
// this is mandated by the 7702 protocol and is unrelated to any contract-level nonce.
//
// Self-sponsored (A sends its own tx): A's tx itself consumes NonceAt(A) → use NonceAt(A) + 1.
// B-sponsored (A doesn't send a tx):    use NonceAt(A) directly.

// AuthorizationDigest returns the 32-byte digest of an EIP-7702
// SetCodeAuthorization, i.e. keccak256(0x05 || rlp([chainId, address, nonce])).
//
// The digest is signed externally (by the Magic Signer); the resulting 65-byte
// signature is fed back into AssembleAuthorization.
//
// go-ethereum v1.17.2 exports (*types.SetCodeAuthorization).SigHash(), so we
// reuse it instead of hand-rolling the RLP/keccak — this guarantees the digest
// is byte-for-byte identical to what types.SignSetCode would sign.
func AuthorizationDigest(chainID *big.Int, impl common.Address, nonce uint64) ([32]byte, error) {
	cid, overflow := uint256.FromBig(chainID)
	if overflow {
		return [32]byte{}, fmt.Errorf("chainID overflows uint256")
	}
	auth := types.SetCodeAuthorization{
		ChainID: *cid,
		Address: impl,
		Nonce:   nonce,
	}
	return auth.SigHash(), nil // common.Hash is [32]byte
}

// AssembleAuthorization consumes the 65-byte signature produced by the external
// Signer over AuthorizationDigest(...) and assembles go-ethereum's
// SetCodeAuthorization (V/R/S filled in).
//
// Key conversion: the Magic Signer returns r(32) || s(32) || v(1) with
// v ∈ {27, 28} (EIP-155 style). go-ethereum's SetCodeAuthorization.V is the
// y-parity ∈ {0, 1} (SignSetCode stores crypto.Sign's raw v directly), so we
// subtract 27.
func AssembleAuthorization(chainID *big.Int, impl common.Address, nonce uint64, sig [65]byte) (types.SetCodeAuthorization, error) {
	cid, overflow := uint256.FromBig(chainID)
	if overflow {
		return types.SetCodeAuthorization{}, fmt.Errorf("chainID overflows uint256")
	}
	if sig[64] != 27 && sig[64] != 28 {
		return types.SetCodeAuthorization{}, fmt.Errorf("invalid v byte in signature: %d (want 27 or 28)", sig[64])
	}
	var r, s uint256.Int
	r.SetBytes(sig[0:32])
	s.SetBytes(sig[32:64])
	return types.SetCodeAuthorization{
		ChainID: *cid,
		Address: impl,
		Nonce:   nonce,
		V:       sig[64] - 27, // EIP-155 v {27,28} → y-parity {0,1}
		R:       r,
		S:       s,
	}, nil
}
