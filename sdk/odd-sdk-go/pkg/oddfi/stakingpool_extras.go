package oddfi

import (
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// Initialize submits a StakingPool initializer transaction using caller-supplied opts.
func (p *StakingPool) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, initialPlatformTreasury common.Address) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Initialize(opts, admin, oddTokenAddress, initialPlatformTreasury)
	if err != nil {
		return nil, wrapInfraError("staking pool initialize", err)
	}
	return tx, nil
}

// InitializeV2 submits a StakingPool V2 initializer transaction using caller-supplied opts.
func (p *StakingPool) InitializeV2(opts *bind.TransactOpts, initialBettingPool common.Address) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.InitializeV2(opts, initialBettingPool)
	if err != nil {
		return nil, wrapInfraError("staking pool initialize v2", err)
	}
	return tx, nil
}

// NotifyReward submits a StakingPool reward notification transaction using caller-supplied opts.
func (p *StakingPool) NotifyReward(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("staking pool notify reward", amount); err != nil {
		return nil, err
	}
	tx, err := p.adapter.NotifyReward(opts, amount)
	if err != nil {
		return nil, wrapInfraError("staking pool notify reward", err)
	}
	return tx, nil
}
