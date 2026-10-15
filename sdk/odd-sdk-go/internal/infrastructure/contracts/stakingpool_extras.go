package contracts

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// Initialize submits the StakingPool initializer transaction.
func (a *StakingPoolAdapter) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, initialPlatformTreasury common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Initialize(opts, admin, oddTokenAddress, initialPlatformTreasury)
	if err != nil {
		return nil, fmt.Errorf("staking pool initialize: %w", err)
	}
	return tx, nil
}

// InitializeV2 submits the StakingPool V2 initializer transaction.
func (a *StakingPoolAdapter) InitializeV2(opts *bind.TransactOpts, initialBettingPool common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.InitializeV2(opts, initialBettingPool)
	if err != nil {
		return nil, fmt.Errorf("staking pool initialize v2: %w", err)
	}
	return tx, nil
}

// NotifyReward submits a reward notification transaction.
func (a *StakingPoolAdapter) NotifyReward(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.NotifyReward(opts, amount)
	if err != nil {
		return nil, fmt.Errorf("staking pool notify reward: %w", err)
	}
	return tx, nil
}
