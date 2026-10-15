package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// BettingParlayLens exposes read-only parlay preview calls. Methods are safe
// for concurrent use and block on RPC until the backend returns or ctx is canceled.
type BettingParlayLens struct {
	adapter *contracts.BettingParlayLensAdapter
}

// ParlayPreview is the read-only preview for a proposed parlay order.
type ParlayPreview struct {
	// RawComboOdds is the uncapped combined odds using precision 1e4.
	RawComboOdds *big.Int
	// LockedComboOdds is the actual combined odds after the 200x cap.
	LockedComboOdds *big.Int
	// MaxPayout is the capped gross payout for the proposed stake.
	MaxPayout *big.Int
	// MaxRequiredPayout is the capacity required by the parlay.
	MaxRequiredPayout *big.Int
	// AvailableParlayCapacity is the remaining global parlay capacity.
	AvailableParlayCapacity *big.Int
	// CappedByOdds indicates the odds cap changed the quote.
	CappedByOdds bool
	// CappedByPayout indicates the payout cap changed the gross payout.
	CappedByPayout bool
}

// ParlayEstimatedValue is a display-only estimate for an existing parlay.
type ParlayEstimatedValue struct {
	// State encodes ParlayState from the contract ABI.
	State uint8
	Stake *big.Int
	// LockedComboOdds is the parlay's locked combined odds.
	LockedComboOdds *big.Int
	MaxPayout       *big.Int
	// EstimatedValue is display-only; it is not claimable and not a cash-out quote.
	EstimatedValue *big.Int
	// FloatingPnL is the estimated floating profit or loss in ODD wei.
	FloatingPnL        *big.Int
	FactorProduct      *big.Int
	FinalizedLegCount  uint8
	UnresolvedLegCount uint8
	HasFullLoss        bool
	IsFinal            bool
}

// PreviewParlay reads combined odds, payout caps, and available capacity for a proposed parlay.
func (l *BettingParlayLens) PreviewParlay(ctx context.Context, bettingPool common.Address, legs []ParlayLegInput, stake *big.Int, user common.Address) (ParlayPreview, error) {
	if err := checkContext(ctx, "betting parlay lens preview parlay"); err != nil {
		return ParlayPreview{}, err
	}
	if err := ensureBettingParlayLens(l); err != nil {
		return ParlayPreview{}, err
	}
	adapterLegs, err := toAdapterParlayLegs("betting parlay lens preview parlay", legs)
	if err != nil {
		return ParlayPreview{}, err
	}
	if stake == nil {
		return ParlayPreview{}, wrapUserError("betting parlay lens preview parlay", ErrNilBigIntParam)
	}
	value, err := l.adapter.PreviewParlay(ctx, bettingPool, adapterLegs, stake, user)
	if err != nil {
		return ParlayPreview{}, wrapInfraError("betting parlay lens preview parlay", err)
	}
	return ParlayPreview{
		RawComboOdds:            value.RawComboOdds,
		LockedComboOdds:         value.LockedComboOdds,
		MaxPayout:               value.MaxPayout,
		MaxRequiredPayout:       value.MaxRequiredPayout,
		AvailableParlayCapacity: value.AvailableParlayCapacity,
		CappedByOdds:            value.CappedByOdds,
		CappedByPayout:          value.CappedByPayout,
	}, nil
}

// EstimateParlayValue reads the current display-only estimated value for a user's parlay.
func (l *BettingParlayLens) EstimateParlayValue(ctx context.Context, bettingPool common.Address, user common.Address, parlayID [32]byte) (ParlayEstimatedValue, error) {
	if err := checkContext(ctx, "betting parlay lens estimate parlay value"); err != nil {
		return ParlayEstimatedValue{}, err
	}
	if err := ensureBettingParlayLens(l); err != nil {
		return ParlayEstimatedValue{}, err
	}
	value, err := l.adapter.EstimateParlayValue(ctx, bettingPool, user, parlayID)
	if err != nil {
		return ParlayEstimatedValue{}, wrapInfraError("betting parlay lens estimate parlay value", err)
	}
	return ParlayEstimatedValue{
		State:              value.State,
		Stake:              value.Stake,
		LockedComboOdds:    value.LockedComboOdds,
		MaxPayout:          value.MaxPayout,
		EstimatedValue:     value.EstimatedValue,
		FloatingPnL:        value.FloatingPnL,
		FactorProduct:      value.FactorProduct,
		FinalizedLegCount:  value.FinalizedLegCount,
		UnresolvedLegCount: value.UnresolvedLegCount,
		HasFullLoss:        value.HasFullLoss,
		IsFinal:            value.IsFinal,
	}, nil
}
