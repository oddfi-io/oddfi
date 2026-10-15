package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// LiquidityPayoutWindow is the raw payoutWindows mapping value.
type LiquidityPayoutWindow struct {
	MatchID        [32]byte
	ReservedAmount *big.Int
	PaidOutAmount  *big.Int
	SettledAt      uint64
}

// PayoutWindow reads the LiquidityPool payoutWindows mapping for a match.
func (p *LiquidityPool) PayoutWindow(ctx context.Context, matchID [32]byte) (LiquidityPayoutWindow, error) {
	if err := checkContext(ctx, "liquidity pool payout window"); err != nil {
		return LiquidityPayoutWindow{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return LiquidityPayoutWindow{}, err
	}
	value, err := p.adapter.PayoutWindow(ctx, matchID)
	if err != nil {
		return LiquidityPayoutWindow{}, wrapInfraError("liquidity pool payout window", err)
	}
	return LiquidityPayoutWindow{
		MatchID:        value.MatchID,
		ReservedAmount: value.ReservedAmount,
		PaidOutAmount:  value.PaidOutAmount,
		SettledAt:      value.SettledAt,
	}, nil
}

// Initialize submits a LiquidityPool initializer transaction using caller-supplied opts.
func (p *LiquidityPool) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, initialBettingPool common.Address) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Initialize(opts, admin, oddTokenAddress, initialBettingPool)
	if err != nil {
		return nil, wrapInfraError("liquidity pool initialize", err)
	}
	return tx, nil
}
