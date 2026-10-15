// parlay.go — admin-side parlay operations, each in two forms (A: hash-only,
// B: WithReceipt). All use the shared c.submit path (SDK *Calldata helper +
// direct admin signing), mirroring SettleMarketBetsByScore / FinalizeMarketSettlement.
//
//   - SettleParlay        (SETTLER_ROLE)  — resolve a Pending parlay once all
//                                           its legs' markets are finalized.
//   - ReleasePayoutReserve (SETTLER_ROLE) — release a settled-but-unclaimed
//                                           parlay's payout reserve back to the
//                                           global LP (keyed by parlayRiskId).
//   - SetParlayModule     (DEFAULT_ADMIN) — point BettingPool at a new parlay
//                                           delegatecall module (upgrade wiring).
//
// All three reach the contract via BettingPool; reserve release and settle are
// SETTLER-gated, module-set is admin-gated. Contract reverts (wrong state, wrong
// role, unknown id) surface as ErrChainTxReverted via the WithReceipt variants.

package admin

import (
	"context"
	"errors"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// ─── SettleParlay (SETTLER_ROLE) ─────────────────────────────────────────

type SettleParlayRequest struct {
	ParlayID       coretypes.ParlayID
	IdempotencyKey string
}

func (c *Client) SettleParlay(ctx context.Context, req SettleParlayRequest) (AsyncResult, error) {
	if req.ParlayID == (coretypes.ParlayID{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SettleParlay", errors.New("zero ParlayID"))
	}
	calldata, err := c.sdk.BettingPool().SettleParlayCalldata([32]byte(req.ParlayID))
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SettleParlay", err)
	}
	hash, aid, err := c.submit(ctx, "SettleParlay", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"parlay_id": common.Hash(req.ParlayID).Hex(),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) SettleParlayWithReceipt(ctx context.Context, req SettleParlayRequest) (ReceiptResult, error) {
	async, err := c.SettleParlay(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── ReleasePayoutReserve (SETTLER_ROLE) ─────────────────────────────────
//
// Releases the payout reserve still locked against a settled parlay back to the
// global LP. Keyed by the parlay's parlayRiskId (read from read.GetParlay or the
// ParlaySettled event), NOT the parlayId.

type ReleasePayoutReserveRequest struct {
	RiskID         [32]byte // parlayRiskId from the parlay / ParlaySettled event
	IdempotencyKey string
}

func (c *Client) ReleasePayoutReserve(ctx context.Context, req ReleasePayoutReserveRequest) (AsyncResult, error) {
	if req.RiskID == ([32]byte{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ReleasePayoutReserve", errors.New("zero RiskID"))
	}
	calldata, err := c.sdk.BettingPool().ReleasePayoutReserveCalldata(req.RiskID)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ReleasePayoutReserve", err)
	}
	hash, aid, err := c.submit(ctx, "ReleasePayoutReserve", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"risk_id": common.Hash(req.RiskID).Hex(),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) ReleasePayoutReserveWithReceipt(ctx context.Context, req ReleasePayoutReserveRequest) (ReceiptResult, error) {
	async, err := c.ReleasePayoutReserve(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}

// ─── SetParlayModule (DEFAULT_ADMIN_ROLE) ────────────────────────────────

type SetParlayModuleRequest struct {
	Module         common.Address // new BettingParlayModule implementation
	IdempotencyKey string
}

func (c *Client) SetParlayModule(ctx context.Context, req SetParlayModuleRequest) (AsyncResult, error) {
	if req.Module == (common.Address{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SetParlayModule", errors.New("zero Module"))
	}
	calldata, err := c.sdk.BettingPool().SetParlayModuleCalldata(req.Module)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "SetParlayModule", err)
	}
	hash, aid, err := c.submit(ctx, "SetParlayModule", c.cfg.Addresses.BettingPool, calldata, req.IdempotencyKey, map[string]any{
		"module": req.Module.Hex(),
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{TxHash: coretypes.TxHash(hash.Hex()), ActionID: aid, IdempotencyKey: req.IdempotencyKey}, nil
}

func (c *Client) SetParlayModuleWithReceipt(ctx context.Context, req SetParlayModuleRequest) (ReceiptResult, error) {
	async, err := c.SetParlayModule(ctx, req)
	if err != nil {
		return ReceiptResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, common.HexToHash(string(async.TxHash)))
	if err != nil {
		return ReceiptResult{}, err
	}
	return ReceiptResult{TxHash: async.TxHash, BlockNumber: receipt.BlockNumber.Uint64(), GasUsed: receipt.GasUsed}, nil
}
