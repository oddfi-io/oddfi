// parlay.go — relay.PlaceParlay + relay.ClaimParlayPayout (each in two forms).
//
// Both are sponsored (EIP-7702) user actions — A signs via Magic, B pays gas —
// so they live in relay alongside PlaceBet / CashOut, not admin.
//
// PlaceParlay mirrors PlaceBet's quote model but per-leg: the frontend supplies
// each leg's quote snapshot (QuoteVersion / QuotedAt / MinOdds) — there is no
// pre-flight read here (unlike PlaceBet's multicall) because the parlay combine
// + cap math lives in the contract / BettingParlayLens; callers who want a quote
// call read.PreviewParlay first. The contract rejects stale quotes, same-match
// legs, and out-of-range leg counts (2..6) with typed reverts.
//
// ClaimParlayPayout mirrors ClaimPayout: no pre-flight; owner-only + payout>0
// are enforced on-chain and surface as typed reverts.

package relay

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// ─── PlaceParlay ─────────────────────────────────────────────────────────

// PlaceParlayRequest is the per-call input. Legs carries 2..6 selections; each
// leg's quote fields are caller-owned (see coretypes.ParlayLegInput). MinComboOdds
// is the floor on the locked combined odds (0 = accept any); the contract caps
// combined odds at 200x and gross payout at the global parlay capacity.
type PlaceParlayRequest struct {
	UserID         string                     // A's Magic user_id; the EOA is resolved from this internally.
	Legs           []coretypes.ParlayLegInput // 2..6 legs, distinct matches
	Stake          *big.Int                   // ODD wei
	MinComboOdds   *big.Int                   // floor on locked combined odds (1e4); nil/0 = no floor
	Deadline       uint64                     // unix seconds
	Referrer       common.Address             // zero = none / already bound
	IdempotencyKey string
}

// PlaceParlayResult is returned by PlaceParlayWithReceipt (B-form), populated
// from the ParlayPlaced event.
type PlaceParlayResult struct {
	ReceiptResult
	ParlayID        coretypes.ParlayID
	MaxPayout       *big.Int
	LockedComboOdds *big.Int
}

// PlaceParlay is the A-form (default): submit on-chain and return immediately.
//
//	res, err := client.PlaceParlay(ctx, req)
//	// res.TxHash is the submitted tx; poll status via read.GetActionStatus(res.ActionID).
func (c *Client) PlaceParlay(ctx context.Context, req PlaceParlayRequest) (AsyncResult, error) {
	if err := validatePlaceParlay(req); err != nil {
		return AsyncResult{}, err
	}
	userAddr, err := c.resolveUserAddr(ctx, "PlaceParlay", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}

	legs := toSDKParlayLegs(req.Legs)
	minComboOdds := req.MinComboOdds
	if minComboOdds == nil {
		minComboOdds = big.NewInt(0)
	}
	deadline := new(big.Int).SetUint64(req.Deadline)

	calldata, err := c.sdk.BettingPool().PlaceParlayCalldata(legs, req.Stake, minComboOdds, deadline, req.Referrer)
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "PlaceParlay", err)
	}

	res, err := c.submit(ctx, submitJob{
		Method:         "PlaceParlay",
		UserID:         req.UserID,
		UserAddr:       userAddr,
		Target:         c.cfg.Addresses.BettingPool,
		Data:           calldata,
		IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{
			"leg_count":       len(req.Legs),
			"stake":           req.Stake.String(),
			"min_combo_odds":  minComboOdds.String(),
			"deadline":        req.Deadline,
			"referrer":        req.Referrer.Hex(),
			"idempotency_key": req.IdempotencyKey,
		},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{
		TxHash:         coretypes.TxHash(res.TxHash.Hex()),
		ActionID:       res.ActionID,
		IdempotencyKey: req.IdempotencyKey,
	}, nil
}

// PlaceParlayWithReceipt is the B-form: submit + wait for `Confirmations` blocks,
// then decode the ParlayPlaced event into PlaceParlayResult.
func (c *Client) PlaceParlayWithReceipt(ctx context.Context, req PlaceParlayRequest) (PlaceParlayResult, error) {
	async, err := c.PlaceParlay(ctx, req)
	if err != nil {
		return PlaceParlayResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return PlaceParlayResult{}, err
	}
	parsed := parseParlayPlaced(receipt, c.cfg.Addresses.BettingPool)
	res := PlaceParlayResult{
		ReceiptResult: ReceiptResult{
			TxHash:      async.TxHash,
			BlockNumber: receipt.BlockNumber.Uint64(),
			GasUsed:     receipt.GasUsed,
		},
	}
	if parsed.Found {
		res.ParlayID = parsed.ParlayID
		res.MaxPayout = parsed.MaxPayout
		res.LockedComboOdds = parsed.LockedComboOdds
	}
	return res, nil
}

// ─── ClaimParlayPayout ───────────────────────────────────────────────────

// ClaimParlayPayoutRequest is the per-call input. Valid once a parlay is in
// WonUnclaimed or Refundable state (claim vs refund is decided on-chain).
type ClaimParlayPayoutRequest struct {
	UserID         string // A's Magic user_id; the EOA is resolved from this internally.
	ParlayID       coretypes.ParlayID
	IdempotencyKey string
}

// ClaimParlayPayoutResult is returned by ClaimParlayPayoutWithReceipt (B-form),
// populated from the ParlayPayoutClaimed event.
type ClaimParlayPayoutResult struct {
	ReceiptResult
	NetPayout *big.Int // ODD wei credited after payout tax
}

// ClaimParlayPayout is the A-form (default): submit on-chain and return immediately.
func (c *Client) ClaimParlayPayout(ctx context.Context, req ClaimParlayPayoutRequest) (AsyncResult, error) {
	if req.UserID == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimParlayPayout", errStr("empty UserID"))
	}
	if req.ParlayID == (coretypes.ParlayID{}) {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimParlayPayout", errStr("zero ParlayID"))
	}
	if req.IdempotencyKey == "" {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimParlayPayout", errStr("IdempotencyKey required"))
	}
	userAddr, err := c.resolveUserAddr(ctx, "ClaimParlayPayout", req.UserID)
	if err != nil {
		return AsyncResult{}, err
	}
	// No pre-flight (mirrors ClaimPayout): owner-only / payout>0 / state reverts
	// surface as typed errors via revert decoding.
	calldata, err := c.sdk.BettingPool().ClaimParlayPayoutCalldata([32]byte(req.ParlayID))
	if err != nil {
		return AsyncResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, "ClaimParlayPayout", err)
	}
	res, err := c.submit(ctx, submitJob{
		Method:         "ClaimParlayPayout",
		UserID:         req.UserID,
		UserAddr:       userAddr,
		Target:         c.cfg.Addresses.BettingPool,
		Data:           calldata,
		IdempotencyKey: req.IdempotencyKey,
		ArgsJSON: map[string]any{
			"parlay_id":       common.Hash(req.ParlayID).Hex(),
			"idempotency_key": req.IdempotencyKey,
		},
	})
	if err != nil {
		return AsyncResult{}, err
	}
	return AsyncResult{
		TxHash:         coretypes.TxHash(res.TxHash.Hex()),
		ActionID:       res.ActionID,
		IdempotencyKey: req.IdempotencyKey,
	}, nil
}

// ClaimParlayPayoutWithReceipt is the B-form: submit + wait, then decode the
// ParlayPayoutClaimed event into ClaimParlayPayoutResult.
func (c *Client) ClaimParlayPayoutWithReceipt(ctx context.Context, req ClaimParlayPayoutRequest) (ClaimParlayPayoutResult, error) {
	async, err := c.ClaimParlayPayout(ctx, req)
	if err != nil {
		return ClaimParlayPayoutResult{}, err
	}
	receipt, err := c.waitReceipt(ctx, hashFromString(async.TxHash))
	if err != nil {
		return ClaimParlayPayoutResult{}, err
	}
	parsed := parseParlayPayoutClaimed(receipt, c.cfg.Addresses.BettingPool)
	res := ClaimParlayPayoutResult{
		ReceiptResult: ReceiptResult{
			TxHash:      async.TxHash,
			BlockNumber: receipt.BlockNumber.Uint64(),
			GasUsed:     receipt.GasUsed,
		},
	}
	if parsed.Found {
		res.NetPayout = parsed.NetPayout
	}
	return res, nil
}

// ─── internal helpers ────────────────────────────────────────────────────

// toSDKParlayLegs converts business-layer legs into the SDK input, deriving each
// leg's 32-byte marketID from its MarketKey.
func toSDKParlayLegs(legs []coretypes.ParlayLegInput) []oddfi.ParlayLegInput {
	out := make([]oddfi.ParlayLegInput, len(legs))
	for i, l := range legs {
		out[i] = oddfi.ParlayLegInput{
			MarketID:     [32]byte(l.Market.MarketID()),
			Outcome:      l.Outcome,
			QuoteVersion: l.QuoteVersion,
			QuotedAt:     l.QuotedAt,
			MinOdds:      l.MinOdds,
		}
	}
	return out
}

func validatePlaceParlay(req PlaceParlayRequest) error {
	op := "PlaceParlay"
	if req.UserID == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("empty UserID"))
	}
	// Leg-count bounds mirror the contract (PARLAY_MIN_LEGS=2, PARLAY_MAX_LEGS=6);
	// fail fast before signing rather than on revert.
	if n := len(req.Legs); n < 2 || n > 6 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("Legs count must be in [2,6]"))
	}
	for i, l := range req.Legs {
		if l.Market.MatchID == (coretypes.MatchID{}) {
			return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("zero MatchID in leg"))
		}
		if l.QuoteVersion == nil {
			return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("nil QuoteVersion in leg"))
		}
		if l.QuotedAt == 0 {
			return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("zero QuotedAt in leg"))
		}
		if l.MinOdds == nil || l.MinOdds.Sign() < 0 {
			return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("MinOdds must be non-negative in leg"))
		}
		_ = i
	}
	if req.Stake == nil || req.Stake.Sign() <= 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("Stake must be positive"))
	}
	if req.Deadline == 0 {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("Deadline must be set"))
	}
	if req.IdempotencyKey == "" {
		return coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("IdempotencyKey required"))
	}
	return nil
}
