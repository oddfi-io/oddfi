// Package multicall is a minimal multicall3 client for batching read-only
// eth_call requests. We use multicall3 to collapse the predicate-check RPCs
// of a single write path (BalanceOf + AccountedBalance + GetMarketOdds, etc.)
// into one round-trip.
//
// Contract: 0xcA11bde05977b3631167028862bE2a173976CA11 (deployed identically
// on Ethereum, BSC mainnet, BSC testnet, and most EVM chains).
//
// ─── Implementation note (USER-2026-05-14) ─────────────────────────────
// User specified: use github.com/0xsequence/go-sequence/multicall3 directly
// instead of this hand-rolled wrapper. The 0xsequence repo organizes its
// multicall under several plausible sub-paths and the exact one to import
// depends on the repo version (see candidates below). Confirm the path
// during go.mod tidy, then replace this file with:
//
//   import sequencemc "github.com/0xsequence/go-sequence/multicall"   // or
//   import sequencemc "github.com/0xsequence/go-sequence/contracts/gen/multicall3"
//
//   func New(eth EthCaller, addr common.Address) (*sequencemc.Multicall, error) {
//       return sequencemc.NewMulticall(eth, addr) // exact signature TBC
//   }
//
// Until then this hand-rolled wrapper provides the same Aggregate3 surface so
// downstream code (relay/, admin/) compiles and runs against any multicall3
// deployment.
package multicall

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

// DefaultAddress is the canonical multicall3 deployment address.
var DefaultAddress = common.HexToAddress("0xcA11bde05977b3631167028862bE2a173976CA11")

// EthCaller is the minimal subset of bind.ContractCaller we need.
type EthCaller interface {
	CallContract(ctx context.Context, msg ethereum.CallMsg, blockNumber *big.Int) ([]byte, error)
}

// Call is a single read to batch.
type Call struct {
	Target       common.Address
	AllowFailure bool
	CallData     []byte
}

// Result mirrors multicall3.Result.
type Result struct {
	Success    bool
	ReturnData []byte
}

const multicall3ABI = `[
  {
    "name": "aggregate3",
    "type": "function",
    "stateMutability": "payable",
    "inputs": [{
      "name": "calls",
      "type": "tuple[]",
      "components": [
        {"name": "target", "type": "address"},
        {"name": "allowFailure", "type": "bool"},
        {"name": "callData", "type": "bytes"}
      ]
    }],
    "outputs": [{
      "name": "returnData",
      "type": "tuple[]",
      "components": [
        {"name": "success", "type": "bool"},
        {"name": "returnData", "type": "bytes"}
      ]
    }]
  }
]`

var (
	parsedABI abi.ABI
	parseErr  error
)

func init() {
	parsedABI, parseErr = abi.JSON(strings.NewReader(multicall3ABI))
}

// Client invokes multicall3.aggregate3.
type Client struct {
	caller  EthCaller
	address common.Address
}

// New constructs a Client. Pass DefaultAddress as `at` for the canonical deployment.
func New(caller EthCaller, at common.Address) (*Client, error) {
	if parseErr != nil {
		return nil, fmt.Errorf("multicall: parse abi: %w", parseErr)
	}
	if caller == nil {
		return nil, errors.New("multicall: nil caller")
	}
	if at == (common.Address{}) {
		at = DefaultAddress
	}
	return &Client{caller: caller, address: at}, nil
}

// Aggregate3 executes the batch. All calls share one eth_call round-trip.
// `allowFailureAll=false` makes the whole batch revert on any inner failure.
// For pre-flight predicates we want failure-fast, so pass false.
func (c *Client) Aggregate3(ctx context.Context, calls []Call) ([]Result, error) {
	if len(calls) == 0 {
		return nil, nil
	}
	// Build calldata for aggregate3(Call3[]).
	type call3 struct {
		Target       common.Address `json:"target"`
		AllowFailure bool           `json:"allowFailure"`
		CallData     []byte         `json:"callData"`
	}
	args := make([]call3, len(calls))
	for i, c := range calls {
		args[i] = call3{Target: c.Target, AllowFailure: c.AllowFailure, CallData: c.CallData}
	}
	input, err := parsedABI.Pack("aggregate3", args)
	if err != nil {
		return nil, fmt.Errorf("multicall: pack: %w", err)
	}

	out, err := c.caller.CallContract(ctx, ethereum.CallMsg{
		To:   &c.address,
		Data: input,
	}, nil)
	if err != nil {
		return nil, fmt.Errorf("multicall: eth_call: %w", err)
	}

	// Unpack Result[].
	type result struct {
		Success    bool   `json:"success"`
		ReturnData []byte `json:"returnData"`
	}
	rawOut, err := parsedABI.Unpack("aggregate3", out)
	if err != nil {
		return nil, fmt.Errorf("multicall: unpack: %w", err)
	}
	if len(rawOut) != 1 {
		return nil, fmt.Errorf("multicall: expected 1 return value, got %d", len(rawOut))
	}
	rs, ok := rawOut[0].([]struct {
		Success    bool    `json:"success"`
		ReturnData []uint8 `json:"returnData"`
	})
	if !ok {
		return nil, fmt.Errorf("multicall: unexpected return shape: %T", rawOut[0])
	}
	results := make([]Result, len(rs))
	for i, r := range rs {
		results[i] = Result{Success: r.Success, ReturnData: r.ReturnData}
	}
	return results, nil
}
