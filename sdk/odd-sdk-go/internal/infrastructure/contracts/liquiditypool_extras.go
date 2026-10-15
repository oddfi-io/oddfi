package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// LiquidityPayoutWindow is the raw payout window mapping value.
type LiquidityPayoutWindow struct {
	MatchID        [32]byte
	ReservedAmount *big.Int
	PaidOutAmount  *big.Int
	SettledAt      uint64
}

// PayoutWindow reads the payoutWindows mapping for a match.
func (a *LiquidityPoolAdapter) PayoutWindow(ctx context.Context, matchID [32]byte) (LiquidityPayoutWindow, error) {
	value, err := a.caller.PayoutWindows(callOpts(ctx), matchID)
	if err != nil {
		return LiquidityPayoutWindow{}, err
	}
	return LiquidityPayoutWindow{
		MatchID:        value.MatchId,
		ReservedAmount: cloneBigInt(value.ReservedAmount),
		PaidOutAmount:  cloneBigInt(value.PaidOutAmount),
		SettledAt:      value.SettledAt,
	}, nil
}

// Initialize submits the LiquidityPool initializer transaction.
func (a *LiquidityPoolAdapter) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, initialBettingPool common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Initialize(opts, admin, oddTokenAddress, initialBettingPool)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool initialize: %w", err)
	}
	return tx, nil
}
