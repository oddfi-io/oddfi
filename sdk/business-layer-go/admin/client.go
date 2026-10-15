// Package admin exposes platform-operator write operations: open / update
// odds / settle / refund markets, grant roles, add reserves. Calls are signed
// with a single admin private key configured at construction; there is no
// per-call key.
//
// Two surfaces per method:
//
//   - admin.X(ctx, req)             — submit and return tx hash immediately.
//   - admin.XWithReceipt(ctx, req)  — submit and block until receipt mined.
//
// See docs/usage-examples.md for end-to-end examples.
package admin

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/Crypto-Barrett/contracts-business-layer/action"
	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/contracts-business-layer/multicall"
	"github.com/Crypto-Barrett/contracts-business-layer/watcher"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// Config wires the admin client.
type Config struct {
	// AdminPrivateKey is the operator key used for all admin txs.
	AdminPrivateKey *ecdsa.PrivateKey

	// ChainID, Confirmations, MulticallAddress — mirror relay.Config.
	ChainID          *big.Int
	Confirmations    int
	MulticallAddress common.Address

	// Addresses are the 4 deployed proxies. Mirror oddfi.Config.
	Addresses Addresses
}

// Addresses holds the 4 deployed proxies (same shape as relay.Addresses).
type Addresses struct {
	ODDToken      common.Address
	BettingPool   common.Address
	StakingPool   common.Address
	LiquidityPool common.Address
}

// Client is the admin handle. Methods are safe for concurrent use.
type Client struct {
	cfg     Config
	eth     *ethclient.Client
	sdk     *oddfi.Client
	mc      *multicall.Client
	actions *action.Repo
	watcher *watcher.Watcher
	adminAt common.Address
}

// New constructs an admin.Client.
func New(eth *ethclient.Client, sdk *oddfi.Client, actions *action.Repo, w *watcher.Watcher, cfg Config) (*Client, error) {
	if eth == nil {
		return nil, errors.New("admin: nil ethclient")
	}
	if sdk == nil {
		return nil, errors.New("admin: nil sdk")
	}
	if actions == nil {
		return nil, errors.New("admin: nil action repo")
	}
	if cfg.AdminPrivateKey == nil {
		return nil, errors.New("admin: missing AdminPrivateKey")
	}
	if cfg.ChainID == nil || cfg.ChainID.Sign() == 0 {
		return nil, errors.New("admin: missing ChainID")
	}
	if cfg.Confirmations == 0 {
		cfg.Confirmations = 2
	}
	mc, err := multicall.New(eth, cfg.MulticallAddress)
	if err != nil {
		return nil, err
	}
	return &Client{
		cfg:     cfg,
		eth:     eth,
		sdk:     sdk,
		mc:      mc,
		actions: actions,
		watcher: w,
		adminAt: crypto.PubkeyToAddress(cfg.AdminPrivateKey.PublicKey),
	}, nil
}

// AdminAddress returns the operator address that signs all admin txs.
func (c *Client) AdminAddress() common.Address { return c.adminAt }

// waitReceipt polls until the tx is mined and Confirmations blocks have been
// stacked on top. Mirrors relay.Client.waitReceipt.
func (c *Client) waitReceipt(ctx context.Context, txHash common.Hash) (*types.Receipt, error) {
	pollInterval := 1 * time.Second
	deadline := time.Now().Add(2 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			return nil, coretypes.WrapRetryable(coretypes.ErrInfraReceiptTimeout, "waitReceipt", ctx.Err())
		default:
		}
		if time.Now().After(deadline) {
			return nil, coretypes.WrapRetryable(coretypes.ErrInfraReceiptTimeout, "waitReceipt", errors.New("internal 2-min deadline"))
		}
		receipt, err := c.eth.TransactionReceipt(ctx, txHash)
		if err == nil && receipt != nil {
			head, herr := c.eth.HeaderByNumber(ctx, nil)
			if herr != nil {
				return nil, coretypes.WrapRetryable(coretypes.ErrInfraRPC, "waitReceipt.HeaderByNumber", herr)
			}
			needed := receipt.BlockNumber.Uint64() + uint64(c.cfg.Confirmations)
			if head.Number.Uint64() >= needed {
				// Gate on Status: a reverted tx still has a receipt but Status==0.
				if receipt.Status != 1 {
					return receipt, coretypes.WrapFatal(coretypes.ErrChainTxReverted, "waitReceipt", fmt.Errorf("tx %s reverted on-chain (status=0, block=%d, gas_used=%d)", txHash.Hex(), receipt.BlockNumber.Uint64(), receipt.GasUsed))
				}
				return receipt, nil
			}
		}
		time.Sleep(pollInterval)
	}
}

// AsyncResult — return type of admin's A-form methods.
type AsyncResult struct {
	TxHash         coretypes.TxHash
	ActionID       coretypes.ActionID
	IdempotencyKey string
}

// ReceiptResult — return type of admin's B-form methods.
type ReceiptResult struct {
	TxHash      coretypes.TxHash
	BlockNumber uint64
	GasUsed     uint64
}

// submit is the shared admin write path. Admin signs and sends directly — no
// EIP-7702, no sponsor wrapping. Idempotency via chain_actions table.
func (c *Client) submit(ctx context.Context, method string, target common.Address, calldata []byte, idempotencyKey string, args map[string]any) (common.Hash, coretypes.ActionID, error) {
	if idempotencyKey == "" {
		return common.Hash{}, 0, coretypes.WrapBusiness(coretypes.ErrParamInvalid, method, errors.New("missing idempotency key"))
	}
	if target == (common.Address{}) {
		return common.Hash{}, 0, coretypes.WrapBusiness(coretypes.ErrParamInvalid, method, errors.New("zero Target"))
	}

	// 1. chain_actions row (pending; short-circuit on existing tx_hash).
	argsBytes, _ := json.Marshal(args)
	rowID, existed, err := c.actions.InsertOrLoad(ctx, &action.Row{
		IdempotencyKey: idempotencyKey,
		Op:             method,
		ArgsJSON:       string(argsBytes),
		Status:         coretypes.StatusPending,
		SignerAddress:  c.adminAt.Hex(),
	})
	if err != nil {
		return common.Hash{}, 0, coretypes.WrapRetryable(coretypes.ErrInfraRPC, method+".InsertOrLoad", err)
	}
	actionID := coretypes.ActionID(rowID)
	if existed {
		if row, gerr := c.actions.Get(ctx, rowID); gerr == nil && row.TxHash.Valid && row.TxHash.String != "" {
			return common.HexToHash(row.TxHash.String), actionID, nil
		}
	}

	// 2. build EIP-1559 DynamicFeeTx.
	chainID, err := c.eth.ChainID(ctx)
	if err != nil {
		return common.Hash{}, actionID, coretypes.WrapRetryable(coretypes.ErrInfraRPC, method+".ChainID", err)
	}
	nonce, err := c.eth.PendingNonceAt(ctx, c.adminAt)
	if err != nil {
		return common.Hash{}, actionID, coretypes.WrapRetryable(coretypes.ErrInfraRPC, method+".PendingNonceAt", err)
	}
	tipCap, err := c.eth.SuggestGasTipCap(ctx)
	if err != nil {
		return common.Hash{}, actionID, coretypes.WrapRetryable(coretypes.ErrInfraRPC, method+".SuggestGasTipCap", err)
	}
	feeCapBase, err := c.eth.SuggestGasPrice(ctx)
	if err != nil {
		return common.Hash{}, actionID, coretypes.WrapRetryable(coretypes.ErrInfraRPC, method+".SuggestGasPrice", err)
	}
	feeCap := new(big.Int).Add(feeCapBase, tipCap)

	// Estimate gas (best-effort; falls back to a safe constant on error).
	gasLimit := uint64(500_000)
	if est, eerr := c.eth.EstimateGas(ctx, ethereum.CallMsg{From: c.adminAt, To: &target, Data: calldata}); eerr == nil {
		gasLimit = est + est/5 // 20% buffer
	}

	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     nonce,
		GasTipCap: tipCap,
		GasFeeCap: feeCap,
		Gas:       gasLimit,
		To:        &target,
		Value:     big.NewInt(0),
		Data:      calldata,
	})

	signed, err := types.SignTx(tx, types.NewLondonSigner(chainID), c.cfg.AdminPrivateKey)
	if err != nil {
		return common.Hash{}, actionID, coretypes.WrapInternal(coretypes.ErrInternalInvariant, method+".SignTx", err)
	}
	if err := c.eth.SendTransaction(ctx, signed); err != nil {
		_ = c.actions.MarkFailed(ctx, rowID, "send", err)
		return common.Hash{}, actionID, coretypes.WrapRetryable(coretypes.ErrInfraRPC, method+".SendTransaction", err)
	}

	hash := signed.Hash()
	if uerr := c.actions.MarkSubmitted(ctx, rowID, hash.Hex(), nonce); uerr != nil {
		return hash, actionID, coretypes.WrapInternal(coretypes.ErrInternalInvariant, method+".MarkSubmitted", uerr)
	}
	return hash, actionID, nil
}

// submitViaSDK mirrors submit's idempotency + chain_actions semantics but
// delegates tx assembly + signing + sending to the SDK's typed wrapper
// (`sdk.BettingPool().XxxMethod(opts, …) → *types.Transaction`).
//
// Used by UpdateOdds / RefundBets, which keep using the SDK's typed wrapper
// for continuity (SDK v0.0.5 added matching *Calldata helpers too). The caller
// supplies a `send` closure that invokes the SDK wrapper with the provided
// bind.TransactOpts and returns the resulting tx; this function handles
// chain_actions row lifecycle around it.
func (c *Client) submitViaSDK(
	ctx context.Context,
	method, idempotencyKey string,
	args map[string]any,
	send func(opts *bind.TransactOpts) (*types.Transaction, error),
) (common.Hash, coretypes.ActionID, error) {
	if idempotencyKey == "" {
		return common.Hash{}, 0, coretypes.WrapBusiness(coretypes.ErrParamInvalid, method, errors.New("missing idempotency key"))
	}

	argsBytes, _ := json.Marshal(args)
	rowID, existed, err := c.actions.InsertOrLoad(ctx, &action.Row{
		IdempotencyKey: idempotencyKey,
		Op:             method,
		ArgsJSON:       string(argsBytes),
		Status:         coretypes.StatusPending,
		SignerAddress:  c.adminAt.Hex(),
	})
	if err != nil {
		return common.Hash{}, 0, coretypes.WrapRetryable(coretypes.ErrInfraRPC, method+".InsertOrLoad", err)
	}
	actionID := coretypes.ActionID(rowID)
	if existed {
		if row, gerr := c.actions.Get(ctx, rowID); gerr == nil && row.TxHash.Valid && row.TxHash.String != "" {
			return common.HexToHash(row.TxHash.String), actionID, nil
		}
	}

	chainID, err := c.eth.ChainID(ctx)
	if err != nil {
		return common.Hash{}, actionID, coretypes.WrapRetryable(coretypes.ErrInfraRPC, method+".ChainID", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(c.cfg.AdminPrivateKey, chainID)
	if err != nil {
		return common.Hash{}, actionID, coretypes.WrapInternal(coretypes.ErrInternalInvariant, method+".NewKeyedTransactor", err)
	}
	opts.Context = ctx

	tx, err := send(opts)
	if err != nil {
		_ = c.actions.MarkFailed(ctx, rowID, "send", err)
		return common.Hash{}, actionID, coretypes.WrapRetryable(coretypes.ErrInfraRPC, method+".send", err)
	}

	hash := tx.Hash()
	if uerr := c.actions.MarkSubmitted(ctx, rowID, hash.Hex(), tx.Nonce()); uerr != nil {
		return hash, actionID, coretypes.WrapInternal(coretypes.ErrInternalInvariant, method+".MarkSubmitted", uerr)
	}
	return hash, actionID, nil
}
