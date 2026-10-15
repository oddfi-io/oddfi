package multisig

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/errs"
)

// Handle is the builder returned by every Client method (Settle, Pause, etc.).
// It captures the ABI method name + args once, then dispatches to whichever
// of Calldata / Execute / Propose / Simulate the caller picks.
//
// Handles are cheap to allocate; reuse is fine but not necessary.
type Handle struct {
	c          *Client
	methodName string
	callArgs   []interface{}
}

// Calldata returns {to, value, data, operation} suitable for pasting into the
// Safe UI or feeding to a custom relayer. Always available (Calldata mode is
// the safest fallback and requires no signer or RPC).
func (h *Handle) Calldata(_ context.Context) (CalldataPacket, error) {
	data, err := h.packCalldata()
	if err != nil {
		return CalldataPacket{}, err
	}
	return CalldataPacket{
		To:        h.c.conn.BettingPoolAddr(),
		Value:     big.NewInt(0),
		Data:      data,
		Operation: 0, // Call
	}, nil
}

// Simulate performs an eth_call dry-run as if the multisig itself were the
// caller, parsing any revert into a typed *errs.ContractError.
//
// "from" is the Safe address — the contract enforces onlyMultisig by checking
// msg.sender, so simulating from any other address would always revert.
func (h *Handle) Simulate(ctx context.Context) error {
	data, err := h.packCalldata()
	if err != nil {
		return err
	}
	to := h.c.conn.BettingPoolAddr()
	from := h.c.SafeAddress()

	if _, hasDeadline := ctx.Deadline(); !hasDeadline && h.c.txTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, h.c.txTimeout)
		defer cancel()
	}

	if _, err := h.c.conn.EthClient().CallContract(ctx, ethereum.CallMsg{
		From: from,
		To:   &to,
		Data: data,
	}, nil); err != nil {
		return errs.Wrap(err, h.methodName, h.c.parser)
	}
	return nil
}

// Execute wraps the inner BettingPool calldata as a Safe execTransaction(...)
// invocation, signs the safeTxHash with the configured Safe-owner key, and
// broadcasts. Available only when WithSafeOwner + WithDirectExecute(true)
// were set at New on a Testnet Connection.
//
// Intended for 1-of-1 Safes only (testnet/devnet). For multi-owner Safes
// use Propose mode.
func (h *Handle) Execute(ctx context.Context) (*types.Transaction, error) {
	if h.c.calldataOnly || !h.c.directExecute || h.c.safeOwner == nil {
		return nil, &ErrModeNotConfigured{Mode: "execute"}
	}
	innerData, err := h.packCalldata()
	if err != nil {
		return nil, err
	}
	return h.c.executeViaSafe(ctx, h.c.conn.BettingPoolAddr(), big.NewInt(0), innerData, 0, h.methodName)
}

// Propose computes safeTxHash, signs it with the proposer key, and POSTs the
// resulting SafeTx to the configured Safe Transaction Service. Returns a
// Proposal with the SafeTxHash + UI link.
//
// Wire flow (matches Safe v1.x convention):
//
//  1. Read safe.nonce() to get the next SafeTx nonce.
//  2. Build SafeTx with our innerData (BettingPool calldata).
//  3. Compute safeTxHash via EIP-712 (see execute.go).
//  4. Sign safeTxHash with the proposer's key (returns 65-byte ECDSA sig).
//  5. POST {safeTx + sender + signature} to /api/v1/safes/{safe}/multisig-transactions/.
//  6. Return Proposal with the safeTxHash + a Safe UI deep link.
//
// To poll status, call c.TxService().Get(ctx, prop.SafeTxHash) or use
// the convenience GetProposal on the parent Client.
func (h *Handle) Propose(ctx context.Context) (*Proposal, error) {
	if h.c.calldataOnly || h.c.proposer == nil || h.c.safeTxURL == "" {
		return nil, &ErrModeNotConfigured{Mode: "propose"}
	}
	innerData, err := h.packCalldata()
	if err != nil {
		return nil, err
	}
	return h.c.proposeViaSafe(ctx, h.c.conn.BettingPoolAddr(), big.NewInt(0), innerData, 0, h.methodName)
}

// packCalldata is the shared ABI-pack step used by all four modes. It looks
// up the method by name in the parsed BettingPool ABI, packs h.callArgs,
// and prepends the 4-byte selector.
func (h *Handle) packCalldata() ([]byte, error) {
	method, ok := h.c.parsed.Methods[h.methodName]
	if !ok {
		return nil, fmt.Errorf("multisig: method %q not in BettingPool ABI", h.methodName)
	}
	tail, err := method.Inputs.Pack(h.callArgs...)
	if err != nil {
		return nil, fmt.Errorf("multisig: pack %s args: %w", h.methodName, err)
	}
	return append(append([]byte{}, method.ID...), tail...), nil
}

// MethodName returns the underlying ABI method name; useful in logs.
func (h *Handle) MethodName() string { return h.methodName }

// Args exposes the captured arguments (for logging / serialisation).
// Returned slice is a defensive copy.
func (h *Handle) Args() []interface{} {
	out := make([]interface{}, len(h.callArgs))
	copy(out, h.callArgs)
	return out
}

// suppress unused import lint for common/big when no method body uses them
var _ = common.Address{}
