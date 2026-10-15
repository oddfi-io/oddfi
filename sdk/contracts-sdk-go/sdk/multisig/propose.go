package multisig

import (
	"context"
	"errors"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"

	"github.com/Crypto-Barrett/oddfi-contracts-sdk/sdk/multisig/safetx"
)

// proposeViaSafe is the shared Phase 3b implementation backing Handle.Propose.
//
// It mirrors executeViaSafe (in execute.go) up to step 4 (compute and sign
// safeTxHash), then submits to the Safe Transaction Service rather than
// broadcasting on chain.
func (c *Client) proposeViaSafe(
	ctx context.Context,
	to common.Address,
	value *big.Int,
	innerData []byte,
	operation uint8,
	logMethodName string,
) (*Proposal, error) {
	if c.txService == nil {
		return nil, &ErrModeNotConfigured{Mode: "propose"}
	}
	if c.proposer == nil {
		return nil, &ErrModeNotConfigured{Mode: "propose"}
	}
	safeAddr := c.SafeAddress()
	if safeAddr == (common.Address{}) {
		return nil, errors.New("multisig: Safe address is zero (Connection didn't load it)")
	}

	if _, hasDeadline := ctx.Deadline(); !hasDeadline && c.txTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, c.txTimeout)
		defer cancel()
	}

	// 1. Read Safe nonce.
	nonce, err := c.readSafeNonce(ctx, safeAddr)
	if err != nil {
		return nil, fmt.Errorf("multisig: read safe nonce: %w", err)
	}

	// 2. Build SafeTx.
	stx := &SafeTx{
		To:             to,
		Value:          value,
		Data:           innerData,
		Operation:      operation,
		SafeTxGas:      big.NewInt(0),
		BaseGas:        big.NewInt(0),
		GasPrice:       big.NewInt(0),
		GasToken:       common.Address{},
		RefundReceiver: common.Address{},
		Nonce:          new(big.Int).SetUint64(nonce),
	}

	// 3. Compute safeTxHash and sign with proposer.
	safeTxHash := stx.SafeTxHash(c.conn.ChainID(), safeAddr)
	var hashArr [32]byte
	copy(hashArr[:], safeTxHash[:])
	sig, err := c.proposer.SignHash(ctx, hashArr)
	if err != nil {
		return nil, fmt.Errorf("multisig: sign safeTxHash: %w", err)
	}
	if len(sig) != 65 {
		return nil, fmt.Errorf("multisig: signature length %d != 65", len(sig))
	}

	// 4. POST to Safe Tx Service.
	req := &safetx.ProposeRequest{
		To:                      stx.To,
		Value:                   stx.Value.String(),
		Data:                    hexutil.Encode(stx.Data),
		Operation:               stx.Operation,
		SafeTxGas:               stx.SafeTxGas.String(),
		BaseGas:                 stx.BaseGas.String(),
		GasPrice:                stx.GasPrice.String(),
		GasToken:                stx.GasToken,
		RefundReceiver:          stx.RefundReceiver,
		Nonce:                   nonce,
		ContractTransactionHash: safeTxHash,
		Sender:                  c.proposer.Address(),
		Signature:               hexutil.Encode(sig),
		Origin:                  fmt.Sprintf("oddfi-contracts-sdk/multisig/%s", logMethodName),
	}
	if _, err := c.txService.Propose(ctx, safeAddr, req); err != nil {
		return nil, fmt.Errorf("multisig: %s propose: %w", logMethodName, err)
	}

	return &Proposal{
		SafeTxHash:            safeTxHash,
		SafeUIURL:             buildSafeUIURL(safeAddr, c.conn.ChainID()),
		Nonce:                 nonce,
		ConfirmationsRequired: 0, // unknown until Get; left zero so caller polls
		ConfirmationsCount:    1, // we attached our (proposer's) sig
		Status:                "proposed",
	}, nil
}

// GetProposal polls Safe Tx Service for current status of safeTxHash.
//
// Returns nil + error wrapping safetx.ErrProposalNotFound if the service
// has no record (yet — propagation can take a few seconds after POST).
func (c *Client) GetProposal(ctx context.Context, safeTxHash common.Hash) (*Proposal, error) {
	if c.txService == nil {
		return nil, &ErrModeNotConfigured{Mode: "propose"}
	}
	resp, err := c.txService.Get(ctx, safeTxHash)
	if err != nil {
		return nil, err
	}
	out := &Proposal{
		SafeTxHash:         safeTxHash,
		SafeUIURL:          buildSafeUIURL(resp.Safe, c.conn.ChainID()),
		Nonce:              resp.Nonce,
		ConfirmationsCount: uint(len(resp.Confirmations)),
	}
	if resp.ConfirmationsRequired != nil {
		out.ConfirmationsRequired = *resp.ConfirmationsRequired
	}
	if resp.IsExecuted {
		if resp.IsSuccessful != nil && *resp.IsSuccessful {
			out.Status = "executed"
		} else {
			out.Status = "executed_failed"
		}
		if resp.TransactionHash != nil {
			h := *resp.TransactionHash
			out.OnChainTxHash = &h
		}
	} else {
		out.Status = "proposed"
	}
	return out, nil
}

// buildSafeUIURL constructs an app.safe.global deep link to the Safe's
// queue. Mainnet (chainId 56) → bnb:0xSAFE; Testnet (97) → bnb-testnet:0xSAFE.
func buildSafeUIURL(safe common.Address, chainID *big.Int) string {
	prefix := "bnb"
	if chainID != nil && chainID.Int64() == 97 {
		prefix = "bnb-testnet"
	}
	return fmt.Sprintf("https://app.safe.global/transactions/queue?safe=%s:%s", prefix, safe.Hex())
}
