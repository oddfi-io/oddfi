package eip7702

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// selector returns the 4-byte function selector for an ABI signature.
func selector(sig string) []byte {
	return crypto.Keccak256([]byte(sig))[:4]
}

// abiCall is the form abi.Pack expects for SponsoredDelegator.Call.
// Field types must be concrete (not interface{}); field order MUST match
// SponsoredDelegator.sol's Call struct: (target, value, data).
type abiCall struct {
	Target common.Address
	Value  *big.Int
	Data   []byte
}

// EncodeBatchExecute packs calldata for
//
//	SponsoredDelegator.executeBatch(
//	    Call[] calldata calls,
//	    uint256 nonce,
//	    uint256 deadline,
//	    bytes calldata signature,
//	)
func EncodeBatchExecute(calls []Call, nonce *big.Int, deadline *big.Int, signature []byte) ([]byte, error) {
	tupleTy, err := abi.NewType("tuple[]", "Call[]", []abi.ArgumentMarshaling{
		{Name: "target", Type: "address"},
		{Name: "value", Type: "uint256"},
		{Name: "data", Type: "bytes"},
	})
	if err != nil {
		return nil, err
	}
	uint256Ty, _ := abi.NewType("uint256", "", nil)
	bytesTy, _ := abi.NewType("bytes", "", nil)

	args := abi.Arguments{
		{Type: tupleTy},   // calls
		{Type: uint256Ty}, // nonce
		{Type: uint256Ty}, // deadline
		{Type: bytesTy},   // signature
	}

	abiCalls := make([]abiCall, len(calls))
	for i, c := range calls {
		abiCalls[i] = abiCall{Target: c.Target, Value: c.Value, Data: c.Data}
	}

	packed, err := args.Pack(abiCalls, nonce, deadline, signature)
	if err != nil {
		return nil, fmt.Errorf("pack executeBatch: %w", err)
	}

	out := make([]byte, 0, 4+len(packed))
	out = append(out, selector("executeBatch((address,uint256,bytes)[],uint256,uint256,bytes)")...)
	out = append(out, packed...)
	return out, nil
}
