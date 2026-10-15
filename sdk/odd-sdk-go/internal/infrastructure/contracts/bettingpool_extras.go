package contracts

import (
	"context"
	"fmt"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// ReferralSwapExpectedPool reads the expected ODD/USDT referral swap pool.
func (a *BettingPoolAdapter) ReferralSwapExpectedPool(ctx context.Context) (common.Address, error) {
	return a.caller.ReferralSwapExpectedPool(callOpts(ctx))
}

// Initialize submits the BettingPool initializer transaction.
func (a *BettingPoolAdapter) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, stakingPoolAddress common.Address, liquidityPoolAddress common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Initialize(opts, admin, oddTokenAddress, stakingPoolAddress, liquidityPoolAddress)
	if err != nil {
		return nil, fmt.Errorf("betting pool initialize: %w", err)
	}
	return tx, nil
}

// InitializeV2 submits the BettingPool V2 initializer transaction.
func (a *BettingPoolAdapter) InitializeV2(opts *bind.TransactOpts, treasuryAddress common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.InitializeV2(opts, treasuryAddress)
	if err != nil {
		return nil, fmt.Errorf("betting pool initialize v2: %w", err)
	}
	return tx, nil
}

// InitializeV3 submits the BettingPool V3 initializer transaction.
func (a *BettingPoolAdapter) InitializeV3(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.InitializeV3(opts)
	if err != nil {
		return nil, fmt.Errorf("betting pool initialize v3: %w", err)
	}
	return tx, nil
}
