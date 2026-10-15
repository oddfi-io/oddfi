package oddfi

import (
	"context"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// ReferralSwapExpectedPool reads the expected ODD/USDT referral swap pool.
func (p *BettingPool) ReferralSwapExpectedPool(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool referral swap expected pool"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.ReferralSwapExpectedPool(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool referral swap expected pool", err)
	}
	return value, nil
}

// Initialize submits a BettingPool initializer transaction using caller-supplied opts.
func (p *BettingPool) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, stakingPoolAddress common.Address, liquidityPoolAddress common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Initialize(opts, admin, oddTokenAddress, stakingPoolAddress, liquidityPoolAddress)
	if err != nil {
		return nil, wrapInfraError("betting pool initialize", err)
	}
	return tx, nil
}

// InitializeV2 submits a BettingPool V2 initializer transaction using caller-supplied opts.
func (p *BettingPool) InitializeV2(opts *bind.TransactOpts, treasuryAddress common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.InitializeV2(opts, treasuryAddress)
	if err != nil {
		return nil, wrapInfraError("betting pool initialize v2", err)
	}
	return tx, nil
}

// InitializeV3 submits a BettingPool V3 initializer transaction using caller-supplied opts.
func (p *BettingPool) InitializeV3(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.InitializeV3(opts)
	if err != nil {
		return nil, wrapInfraError("betting pool initialize v3", err)
	}
	return tx, nil
}
