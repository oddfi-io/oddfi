// modules.go — admin-side module-routing setters for the BettingPool modular
// entrypoint (SDK v0.0.12 / the 2026-06-08 modularization).
//
// The 2026-06-08 upgrade split BettingPool's heavy logic into delegatecall
// modules. Each module address is swappable by DEFAULT_ADMIN_ROLE so an upgrade
// can re-point the proxy without redeploying it. SetParlayModule (parlay.go)
// already covered the parlay module; these add the other three:
//
//   - SetBetModule       — ordinary placeBet logic module.
//   - SetMarketModule     — openMarket / updateOdds / preview module.
//   - SetReferralModule   — bindReferrer / claim referral rewards module.
//
// All three mirror SetParlayModule exactly: zero-address guard, BettingPool
// *Calldata helper, shared c.submit path, A (hash-only) + B (WithReceipt) forms.
// Contract reverts (wrong role, zero/no-code address) surface as
// ErrChainTxReverted via the WithReceipt variants.

package admin

import (
	"context"
	"errors"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// ─── SetBetModule (DEFAULT_ADMIN_ROLE) ───────────────────────────────────

type SetBetModuleRequest struct {
	Module         common.Address // new BettingBetModule implementation
	IdempotencyKey string
}

func (c *Client) SetBetModule(ctx context.Context, req SetBetModuleRequest) (AsyncResult, error) {
	if req.Module == (common.Address{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SetBetModule", errors.New("zero Module"))
	}
	calldata, err := c.sdk.BettingPool().SetBetModuleCalldata(req.Module)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SetBetModule", err)
	}
	hash, aid, err := c.submit(ctx, "SetBetModule", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"module": req.Module.Hex(),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) SetBetModuleWithReceipt(ctx context.Context, req SetBetModuleRequest) (ReceiptResult, error) {
	async, err := c.SetBetModule(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── SetMarketModule (DEFAULT_ADMIN_ROLE) ─────────────────────────────────

type SetMarketModuleRequest struct {
	Module         common.Address // new BettingMarketModule implementation
	IdempotencyKey string
}

func (c *Client) SetMarketModule(ctx context.Context, req SetMarketModuleRequest) (AsyncResult, error) {
	if req.Module == (common.Address{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SetMarketModule", errors.New("zero Module"))
	}
	calldata, err := c.sdk.BettingPool().SetMarketModuleCalldata(req.Module)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SetMarketModule", err)
	}
	hash, aid, err := c.submit(ctx, "SetMarketModule", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"module": req.Module.Hex(),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) SetMarketModuleWithReceipt(ctx context.Context, req SetMarketModuleRequest) (ReceiptResult, error) {
	async, err := c.SetMarketModule(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── SetReferralModule (DEFAULT_ADMIN_ROLE) ───────────────────────────────

type SetReferralModuleRequest struct {
	Module         common.Address // new BettingReferralModule implementation
	IdempotencyKey string
}

func (c *Client) SetReferralModule(ctx context.Context, req SetReferralModuleRequest) (AsyncResult, error) {
	if req.Module == (common.Address{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SetReferralModule", errors.New("zero Module"))
	}
	calldata, err := c.sdk.BettingPool().SetReferralModuleCalldata(req.Module)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SetReferralModule", err)
	}
	hash, aid, err := c.submit(ctx, "SetReferralModule", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"module": req.Module.Hex(),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) SetReferralModuleWithReceipt(ctx context.Context, req SetReferralModuleRequest) (ReceiptResult, error) {
	async, err := c.SetReferralModule(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}
