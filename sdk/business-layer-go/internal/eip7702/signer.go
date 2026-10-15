// Package eip7702 holds the off-chain crypto primitives for the
// EIP-7702 + SponsoredDelegator sponsorship pattern.
//
// Contract source of truth:
//   D:/everything_finance/eip7702-contract-deployment/src/SponsoredDelegator.sol
//
// The implementation contract's EIP-712 schema:
//
//   Domain:  name="SponsoredDelegator", version="1", chainId, verifyingContract=A
//   Call:    Call(address target,uint256 value,bytes data)
//   Execute: Execute(Call[] calls,uint256 nonce,uint256 deadline)Call(...)
//
// Replay protection: nonce is a 256-bit bitmap entry — any uint256 value is
// one-shot. The caller generates a fresh nonce per operation (we use
// time.Now().UnixNano() — high enough cardinality to never collide in practice).
package eip7702

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

// Call mirrors SponsoredDelegator.Call (target / value / data).
type Call struct {
	Target common.Address
	Value  *big.Int
	Data   []byte
}

// ExecuteDigestInput is the pure data needed to compute the Execute typed-data
// digest. It carries no private key — signing is performed externally by the
// injected Signer (Magic).
//
// VerifyingContract MUST equal A's EOA address. Under EIP-7702 delegation,
// address(this) inside the implementation contract == A, and OZ EIP712's
// _domainSeparatorV4() recomputes the domain separator using A.
//
// Nonce can be any uint256 — the contract tracks consumption via bitmap, so
// nothing increments. Callers should pass a globally-unique value (e.g.
// time.Now().UnixNano()).
type ExecuteDigestInput struct {
	ChainID           *big.Int
	VerifyingContract common.Address // = A's EOA address
	Calls             []Call
	Nonce             *big.Int // SponsoredDelegator nonce — any unused uint256
	Deadline          *big.Int // unix seconds
}

// EIP-712 domain values must match SponsoredDelegator.sol's
//   constructor() EIP712("SponsoredDelegator", "1") {}
const (
	domainName    = "SponsoredDelegator"
	domainVersion = "1"
)

// BuildExecuteTypedData constructs the EIP-712 typed data for Execute.
//
// Must agree byte-for-byte with the contract typehashes:
//   CALL_TYPEHASH    = keccak256("Call(address target,uint256 value,bytes data)")
//   EXECUTE_TYPEHASH = keccak256(
//       "Execute(Call[] calls,uint256 nonce,uint256 deadline)Call(address target,uint256 value,bytes data)"
//   )
func BuildExecuteTypedData(in ExecuteDigestInput) apitypes.TypedData {
	callsMessage := make([]map[string]interface{}, len(in.Calls))
	for i, c := range in.Calls {
		callsMessage[i] = map[string]interface{}{
			"target": c.Target.Hex(),
			"value":  (*math.HexOrDecimal256)(c.Value),
			"data":   hexutil.Bytes(c.Data),
		}
	}

	return apitypes.TypedData{
		Types: apitypes.Types{
			"EIP712Domain": []apitypes.Type{
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
			"Call": []apitypes.Type{
				{Name: "target", Type: "address"},
				{Name: "value", Type: "uint256"},
				{Name: "data", Type: "bytes"},
			},
			"Execute": []apitypes.Type{
				{Name: "calls", Type: "Call[]"},
				{Name: "nonce", Type: "uint256"},
				{Name: "deadline", Type: "uint256"},
			},
		},
		PrimaryType: "Execute",
		Domain: apitypes.TypedDataDomain{
			Name:              domainName,
			Version:           domainVersion,
			ChainId:           (*math.HexOrDecimal256)(in.ChainID),
			VerifyingContract: in.VerifyingContract.Hex(),
		},
		Message: apitypes.TypedDataMessage{
			"calls":    callsMessage,
			"nonce":    (*math.HexOrDecimal256)(in.Nonce),
			"deadline": (*math.HexOrDecimal256)(in.Deadline),
		},
	}
}

// ExecuteRequestDigest computes the EIP-712 digest (32-byte final hash with
// the 0x19 0x01 prefix). Equivalent to SponsoredDelegator.hashAction(...).
//
// Returns [32]byte (not []byte) so it can be passed straight into the Magic
// Signer's SignDigest(ctx, userID, [32]byte). Signing itself is external.
func ExecuteRequestDigest(in ExecuteDigestInput) ([32]byte, error) {
	td := BuildExecuteTypedData(in)
	digest, _, err := apitypes.TypedDataAndHash(td)
	if err != nil {
		return [32]byte{}, fmt.Errorf("typed data hash: %w", err)
	}
	var out [32]byte
	copy(out[:], digest) // TypedDataAndHash returns exactly 32 bytes
	return out, nil
}
