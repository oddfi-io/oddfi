package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/bettingparlaylens"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// BettingParlayLensAdapter reads parlay preview data through generated bindings.
type BettingParlayLensAdapter struct {
	caller *bettingparlaylens.BettingParlayLensCaller
}

// BettingParlayLensParlayPreview is the preview output for a parlay order.
type BettingParlayLensParlayPreview struct {
	RawComboOdds            *big.Int
	LockedComboOdds         *big.Int
	MaxPayout               *big.Int
	MaxRequiredPayout       *big.Int
	AvailableParlayCapacity *big.Int
	CappedByOdds            bool
	CappedByPayout          bool
}

// BettingParlayLensEstimatedValue is the display estimate for an existing parlay.
type BettingParlayLensEstimatedValue struct {
	State              uint8
	Stake              *big.Int
	LockedComboOdds    *big.Int
	MaxPayout          *big.Int
	EstimatedValue     *big.Int
	FloatingPnL        *big.Int
	FactorProduct      *big.Int
	FinalizedLegCount  uint8
	UnresolvedLegCount uint8
	HasFullLoss        bool
	IsFinal            bool
}

// NewBettingParlayLensAdapter binds a BettingParlayLens adapter to lensAddress.
func NewBettingParlayLensAdapter(caller bind.ContractCaller, lensAddress common.Address) (*BettingParlayLensAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	lens, err := bettingparlaylens.NewBettingParlayLensCaller(lensAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind betting parlay lens caller: %w", err)
	}
	return &BettingParlayLensAdapter{caller: lens}, nil
}

// PreviewParlay reads parlay odds, payout cap, and capacity before order submission.
func (a *BettingParlayLensAdapter) PreviewParlay(ctx context.Context, bettingPool common.Address, legs []BettingPoolParlayLegInput, stake *big.Int, user common.Address) (BettingParlayLensParlayPreview, error) {
	value, err := a.caller.PreviewParlay(callOpts(ctx), bettingPool, toBettingParlayLensBindingLegs(legs), stake, user)
	if err != nil {
		return BettingParlayLensParlayPreview{}, err
	}
	return BettingParlayLensParlayPreview{
		RawComboOdds:            cloneBigInt(value.RawComboOdds),
		LockedComboOdds:         cloneBigInt(value.LockedComboOdds),
		MaxPayout:               cloneBigInt(value.MaxPayout),
		MaxRequiredPayout:       cloneBigInt(value.MaxRequiredPayout),
		AvailableParlayCapacity: cloneBigInt(value.AvailableParlayCapacity),
		CappedByOdds:            value.CappedByOdds,
		CappedByPayout:          value.CappedByPayout,
	}, nil
}

// EstimateParlayValue reads the current non-claimable display estimate for a parlay.
func (a *BettingParlayLensAdapter) EstimateParlayValue(ctx context.Context, bettingPool common.Address, user common.Address, parlayID [32]byte) (BettingParlayLensEstimatedValue, error) {
	value, err := a.caller.EstimateParlayValue(callOpts(ctx), bettingPool, user, parlayID)
	if err != nil {
		return BettingParlayLensEstimatedValue{}, err
	}
	return BettingParlayLensEstimatedValue{
		State:              value.State,
		Stake:              cloneBigInt(value.Stake),
		LockedComboOdds:    cloneBigInt(value.LockedComboOdds),
		MaxPayout:          cloneBigInt(value.MaxPayout),
		EstimatedValue:     cloneBigInt(value.EstimatedValue),
		FloatingPnL:        cloneBigInt(value.FloatingPnL),
		FactorProduct:      cloneBigInt(value.FactorProduct),
		FinalizedLegCount:  value.FinalizedLegCount,
		UnresolvedLegCount: value.UnresolvedLegCount,
		HasFullLoss:        value.HasFullLoss,
		IsFinal:            value.IsFinal,
	}, nil
}

func toBettingParlayLensBindingLegs(legs []BettingPoolParlayLegInput) []bettingparlaylens.ParlayLegInput {
	if legs == nil {
		return nil
	}
	converted := make([]bettingparlaylens.ParlayLegInput, len(legs))
	for i, leg := range legs {
		converted[i] = bettingparlaylens.ParlayLegInput{
			MarketId:     leg.MarketID,
			Outcome:      leg.Outcome,
			QuoteVersion: leg.QuoteVersion,
			QuotedAt:     leg.QuotedAt,
			MinOdds:      leg.MinOdds,
		}
	}
	return converted
}
