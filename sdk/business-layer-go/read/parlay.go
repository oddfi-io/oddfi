// parlay.go — read-only parlay data: on-chain parlay/leg state (BettingPool),
// per-market final result (BettingPool), and the BettingParlayLens preview /
// estimate calls. Follows client.go conventions: forward to SDK, wrap *big.Int
// amounts into decimal.Decimal, divide odds-type fields by 1e4, wrap uint8
// enums into typed Go enums.
//
// PreviewParlay / EstimateParlayValue require the BettingParlayLens contract to
// be wired into the SDK (Config.BettingParlayLens / oddfi.BettingParlayLensContract).
// When it is not configured the SDK returns a typed error, surfaced here as
// ErrInfraRPC.

package read

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

// ─── enums ───────────────────────────────────────────────────────────────

// ParlayState decodes BettingPool parlay state (ParlayInfo.State).
type ParlayState uint8

const (
	ParlayPending      ParlayState = 0
	ParlayLost         ParlayState = 1
	ParlayWonUnclaimed ParlayState = 2
	ParlayWonClaimed   ParlayState = 3
	ParlayRefundable   ParlayState = 4
	ParlayRefunded     ParlayState = 5
)

func (s ParlayState) String() string {
	switch s {
	case ParlayPending:
		return "Pending"
	case ParlayLost:
		return "Lost"
	case ParlayWonUnclaimed:
		return "WonUnclaimed"
	case ParlayWonClaimed:
		return "WonClaimed"
	case ParlayRefundable:
		return "Refundable"
	case ParlayRefunded:
		return "Refunded"
	default:
		return "Unknown"
	}
}

// ParlayLegResult decodes a parlay leg's settlement result (ParlayLegInfo.Result).
type ParlayLegResult uint8

const (
	ParlayLegPending  ParlayLegResult = 0
	ParlayLegFullWin  ParlayLegResult = 1
	ParlayLegFullLoss ParlayLegResult = 2
	ParlayLegFullPush ParlayLegResult = 3
	ParlayLegHalfWin  ParlayLegResult = 4
	ParlayLegHalfLoss ParlayLegResult = 5
	ParlayLegVoid     ParlayLegResult = 6
)

// ─── DTOs ────────────────────────────────────────────────────────────────

// Parlay is the wrapped form of oddfi.ParlayInfo. LockedComboOdds is divided by
// 1e4; Stake / MaxPayout / ClaimablePayout are ODD wei amounts (not scaled).
type Parlay struct {
	Owner           common.Address
	Stake           decimal.Decimal
	LockedComboOdds decimal.Decimal // pre-divided by 1e4
	MaxPayout       decimal.Decimal
	ClaimablePayout decimal.Decimal
	ParlayRiskID    [32]byte
	LegCount        uint8
	State           ParlayState
}

// ParlayLeg is the wrapped form of oddfi.ParlayLegInfo.
type ParlayLeg struct {
	MarketID        coretypes.MarketID
	MatchID         coretypes.MatchID
	MarketType      uint8
	Line            uint8
	Outcome         uint8
	LockedOdds      decimal.Decimal // pre-divided by 1e4
	SyntheticPayout decimal.Decimal
	Result          ParlayLegResult
}

// ParlayPreview is the wrapped form of oddfi.ParlayPreview (BettingParlayLens).
// Combo-odds fields are divided by 1e4; payout/capacity fields are ODD wei.
type ParlayPreview struct {
	RawComboOdds            decimal.Decimal // pre-divided by 1e4
	LockedComboOdds         decimal.Decimal // pre-divided by 1e4 (after 200x cap)
	MaxPayout               decimal.Decimal
	MaxRequiredPayout       decimal.Decimal
	AvailableParlayCapacity decimal.Decimal
	CappedByOdds            bool
	CappedByPayout          bool
}

// ParlayEstimate is the wrapped form of oddfi.ParlayEstimatedValue.
// EstimatedValue and FloatingPnL are display-only — NOT claimable and NOT a
// cash-out quote. FloatingPnL (estimatedValue minus stake) may be negative.
type ParlayEstimate struct {
	State              ParlayState
	Stake              decimal.Decimal
	LockedComboOdds    decimal.Decimal // pre-divided by 1e4
	MaxPayout          decimal.Decimal
	EstimatedValue     decimal.Decimal
	FloatingPnL        decimal.Decimal // estimatedValue - stake; display-only, may be negative
	FinalizedLegCount  uint8
	UnresolvedLegCount uint8
	HasFullLoss        bool
	IsFinal            bool
}

// MarketFinalResult is the wrapped form of oddfi.MarketFinalResult — the per-
// market terminal outcome a parlay leg resolves against.
type MarketFinalResult struct {
	Finalized    bool
	ResultKind   uint8
	ScoreSettled bool
	HomeScore    uint16
	AwayScore    uint16
}

// ─── reads ───────────────────────────────────────────────────────────────

// GetParlay fetches a parlay's on-chain state by its 32-byte ID.
func (c *Client) GetParlay(ctx context.Context, parlayID coretypes.ParlayID) (Parlay, error) {
	raw, err := c.sdk.BettingPool().GetParlay(ctx, [32]byte(parlayID))
	if err != nil {
		return Parlay{}, wrapInfraRPC("GetParlay", err)
	}
	scale := decimal.New(1, 4)
	return Parlay{
		Owner:           raw.Owner,
		Stake:           wrapBigInt(raw.Stake),
		LockedComboOdds: wrapBigInt(raw.LockedComboOdds).Div(scale),
		MaxPayout:       wrapBigInt(raw.MaxPayout),
		ClaimablePayout: wrapBigInt(raw.ClaimablePayout),
		ParlayRiskID:    raw.ParlayRiskID,
		LegCount:        raw.LegCount,
		State:           ParlayState(raw.State),
	}, nil
}

// GetParlayLeg fetches one leg of a parlay by index (0-based).
func (c *Client) GetParlayLeg(ctx context.Context, parlayID coretypes.ParlayID, legIndex *big.Int) (ParlayLeg, error) {
	raw, err := c.sdk.BettingPool().GetParlayLeg(ctx, [32]byte(parlayID), legIndex)
	if err != nil {
		return ParlayLeg{}, wrapInfraRPC("GetParlayLeg", err)
	}
	scale := decimal.New(1, 4)
	return ParlayLeg{
		MarketID:        coretypes.MarketID(raw.MarketID),
		MatchID:         coretypes.MatchID(raw.MatchID),
		MarketType:      raw.MarketType,
		Line:            raw.Line,
		Outcome:         raw.Outcome,
		LockedOdds:      wrapBigInt(raw.LockedOdds).Div(scale),
		SyntheticPayout: wrapBigInt(raw.SyntheticPayout),
		Result:          ParlayLegResult(raw.Result),
	}, nil
}

// OpenParlayMaxPayout returns the aggregate max payout reserved across all open
// (Pending) parlays — the global parlay exposure currently locked against LP.
func (c *Client) OpenParlayMaxPayout(ctx context.Context) (decimal.Decimal, error) {
	v, err := c.sdk.BettingPool().OpenParlayMaxPayout(ctx)
	if err != nil {
		return decimal.Zero, wrapInfraRPC("OpenParlayMaxPayout", err)
	}
	return wrapBigInt(v), nil
}

// MarketFinalResult returns a market's recorded terminal result (used to resolve
// parlay legs). Takes a MarketKey for consistency; library hashes internally.
func (c *Client) MarketFinalResult(ctx context.Context, key coretypes.MarketKey) (MarketFinalResult, error) {
	raw, err := c.sdk.BettingPool().MarketFinalResult(ctx, [32]byte(key.MarketID()))
	if err != nil {
		return MarketFinalResult{}, wrapInfraRPC("MarketFinalResult", err)
	}
	return MarketFinalResult{
		Finalized:    raw.Finalized,
		ResultKind:   raw.ResultKind,
		ScoreSettled: raw.ScoreSettled,
		HomeScore:    raw.HomeScore,
		AwayScore:    raw.AwayScore,
	}, nil
}

// PreviewParlay quotes a proposed parlay (combined odds, payout caps, available
// capacity) without submitting. Legs carry the same caller-owned quote snapshot
// as relay.PlaceParlay; user is the prospective bettor (affects risk capacity).
// Requires the BettingParlayLens to be wired into the SDK.
func (c *Client) PreviewParlay(ctx context.Context, legs []coretypes.ParlayLegInput, stake decimal.Decimal, user common.Address) (ParlayPreview, error) {
	raw, err := c.sdk.BettingParlayLens().PreviewParlay(ctx, c.bettingPool, toSDKParlayLegs(legs), stake.BigInt(), user)
	if err != nil {
		return ParlayPreview{}, wrapInfraRPC("PreviewParlay", err)
	}
	scale := decimal.New(1, 4)
	return ParlayPreview{
		RawComboOdds:            wrapBigInt(raw.RawComboOdds).Div(scale),
		LockedComboOdds:         wrapBigInt(raw.LockedComboOdds).Div(scale),
		MaxPayout:               wrapBigInt(raw.MaxPayout),
		MaxRequiredPayout:       wrapBigInt(raw.MaxRequiredPayout),
		AvailableParlayCapacity: wrapBigInt(raw.AvailableParlayCapacity),
		CappedByOdds:            raw.CappedByOdds,
		CappedByPayout:          raw.CappedByPayout,
	}, nil
}

// EstimateParlayValue returns the display-only estimated value and floating PnL
// for a user's Pending parlay. NOT a claimable amount or cash-out quote.
//
// As of SDK v0.0.12 / the 2026-06-08 modular-entrypoint upgrade this is queried
// through the BettingPool proxy wrapper (staticcall to the parlay module), so it
// no longer depends on the BettingParlayLens being separately wired. The query is
// user-scoped: only the owning user's Pending parlay returns a value; an unknown
// parlay or owner mismatch returns the all-zero default, and a non-Pending parlay
// reverts on-chain.
func (c *Client) EstimateParlayValue(ctx context.Context, user common.Address, parlayID coretypes.ParlayID) (ParlayEstimate, error) {
	raw, err := c.sdk.BettingPool().EstimateParlayValue(ctx, user, [32]byte(parlayID))
	if err != nil {
		return ParlayEstimate{}, wrapInfraRPC("EstimateParlayValue", err)
	}
	return toParlayEstimate(raw), nil
}

// toParlayEstimate maps the SDK estimated-value struct into the read DTO. Pure
// (no RPC): odds are pre-divided by 1e4, amounts pass through as ODD wei, and the
// signed FloatingPnL is preserved. Unit-tested without a chain.
func toParlayEstimate(raw oddfi.ParlayEstimatedValue) ParlayEstimate {
	scale := decimal.New(1, 4)
	return ParlayEstimate{
		State:              ParlayState(raw.State),
		Stake:              wrapBigInt(raw.Stake),
		LockedComboOdds:    wrapBigInt(raw.LockedComboOdds).Div(scale),
		MaxPayout:          wrapBigInt(raw.MaxPayout),
		EstimatedValue:     wrapBigInt(raw.EstimatedValue),
		FloatingPnL:        wrapBigInt(raw.FloatingPnL),
		FinalizedLegCount:  raw.FinalizedLegCount,
		UnresolvedLegCount: raw.UnresolvedLegCount,
		HasFullLoss:        raw.HasFullLoss,
		IsFinal:            raw.IsFinal,
	}
}

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
