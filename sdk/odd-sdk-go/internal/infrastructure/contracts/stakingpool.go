package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/stakingpool"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// StakingPoolAdapter reads staking pool state through generated bindings.
type StakingPoolAdapter struct {
	caller     *stakingpool.StakingPoolCaller
	transactor *stakingpool.StakingPoolTransactor
}

// StakingPosition is the raw staking position state.
type StakingPosition struct {
	Owner      common.Address
	Principal  *big.Int
	Weight     *big.Int
	UnlockAt   uint64
	RewardDebt *big.Int
	PlanID     uint16
	SourceType uint8
	Active     bool
}

// NewStakingPoolAdapter binds a StakingPool adapter to proxyAddress.
func NewStakingPoolAdapter(caller bind.ContractCaller, transactor bind.ContractTransactor, proxyAddress common.Address) (*StakingPoolAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	pool, err := stakingpool.NewStakingPoolCaller(proxyAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind staking pool caller: %w", err)
	}
	var poolTransactor *stakingpool.StakingPoolTransactor
	if transactor != nil {
		poolTransactor, err = stakingpool.NewStakingPoolTransactor(proxyAddress, transactor)
		if err != nil {
			return nil, fmt.Errorf("bind staking pool transactor: %w", err)
		}
	}
	return &StakingPoolAdapter{caller: pool, transactor: poolTransactor}, nil
}

// OddToken reads the configured ODD token address.
func (a *StakingPoolAdapter) OddToken(ctx context.Context) (common.Address, error) {
	return a.caller.OddToken(callOpts(ctx))
}

// BettingPool reads the configured betting pool address.
func (a *StakingPoolAdapter) BettingPool(ctx context.Context) (common.Address, error) {
	return a.caller.BettingPool(callOpts(ctx))
}

// PlatformTreasury reads the configured platform treasury address.
func (a *StakingPoolAdapter) PlatformTreasury(ctx context.Context) (common.Address, error) {
	return a.caller.PlatformTreasury(callOpts(ctx))
}

// Paused reads whether staking operations are paused.
func (a *StakingPoolAdapter) Paused(ctx context.Context) (bool, error) {
	return a.caller.Paused(callOpts(ctx))
}

// DefaultAdminRole reads the OpenZeppelin default admin role id.
func (a *StakingPoolAdapter) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	return a.caller.DEFAULTADMINROLE(callOpts(ctx))
}

// UpgradeInterfaceVersion reads the UUPS interface version string.
func (a *StakingPoolAdapter) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	return a.caller.UPGRADEINTERFACEVERSION(callOpts(ctx))
}

// ProxiableUUID reads the UUPS implementation slot UUID.
func (a *StakingPoolAdapter) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	return a.caller.ProxiableUUID(callOpts(ctx))
}

// SupportsInterface reads ERC165 support for interfaceID.
func (a *StakingPoolAdapter) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	return a.caller.SupportsInterface(callOpts(ctx), interfaceID)
}

// MinStakeAmount reads the minimum stake amount in ODD minimum units.
func (a *StakingPoolAdapter) MinStakeAmount(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.MinStakeAmount(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// TotalWeightedShares reads total weighted staking shares.
func (a *StakingPoolAdapter) TotalWeightedShares(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalWeightedShares(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// AccountedOddBalance reads accounted ODD balance.
func (a *StakingPoolAdapter) AccountedOddBalance(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.AccountedOddBalance(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// AccRewardPerShare reads the reward accumulator.
func (a *StakingPoolAdapter) AccRewardPerShare(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.AccRewardPerShare(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// NextPositionID reads the next staking position id.
func (a *StakingPoolAdapter) NextPositionID(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.NextPositionId(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// Stake submits a staking transaction using caller-supplied transaction options.
func (a *StakingPoolAdapter) Stake(opts *bind.TransactOpts, amount *big.Int, planID uint16) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Stake(opts, amount, planID)
	if err != nil {
		return nil, fmt.Errorf("staking pool stake: %w", err)
	}
	return tx, nil
}

// Unstake submits an unstake transaction for a matured position.
func (a *StakingPoolAdapter) Unstake(opts *bind.TransactOpts, positionID *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Unstake(opts, positionID)
	if err != nil {
		return nil, fmt.Errorf("staking pool unstake: %w", err)
	}
	return tx, nil
}

// EarlyUnstake submits an early-unstake transaction for an active position
// before its unlockAt; caller receives principal only and forfeits accrued reward.
func (a *StakingPoolAdapter) EarlyUnstake(opts *bind.TransactOpts, positionID *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.EarlyUnstake(opts, positionID)
	if err != nil {
		return nil, fmt.Errorf("staking pool early unstake: %w", err)
	}
	return tx, nil
}

// GetActiveStakeAmount reads the active stake amount for a user.
func (a *StakingPoolAdapter) GetActiveStakeAmount(ctx context.Context, user common.Address) (*big.Int, error) {
	value, err := a.caller.GetActiveStakeAmount(callOpts(ctx), user)
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// ActiveStakeAmount reads the activeStakeAmount mapping for a user.
func (a *StakingPoolAdapter) ActiveStakeAmount(ctx context.Context, user common.Address) (*big.Int, error) {
	value, err := a.caller.ActiveStakeAmount(callOpts(ctx), user)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// GetUserTier reads the user's current VIP tier.
func (a *StakingPoolAdapter) GetUserTier(ctx context.Context, user common.Address) (uint8, error) {
	return a.caller.GetUserTier(callOpts(ctx), user)
}

// GetUserDailyLimit reads the user's current daily betting limit.
func (a *StakingPoolAdapter) GetUserDailyLimit(ctx context.Context, user common.Address) (*big.Int, error) {
	value, err := a.caller.GetUserDailyLimit(callOpts(ctx), user)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// IsActiveStaker returns true when the user has active stake.
func (a *StakingPoolAdapter) IsActiveStaker(ctx context.Context, user common.Address) (bool, error) {
	return a.caller.IsActiveStaker(callOpts(ctx), user)
}

// Position reads one staking position.
func (a *StakingPoolAdapter) Position(ctx context.Context, positionID *big.Int) (StakingPosition, error) {
	value, err := a.caller.Positions(callOpts(ctx), positionID)
	if err != nil {
		return StakingPosition{}, err
	}
	return StakingPosition{
		Owner:      value.Owner,
		Principal:  cloneBigInt(value.Principal),
		Weight:     cloneBigInt(value.Weight),
		UnlockAt:   value.UnlockAt,
		RewardDebt: cloneBigInt(value.RewardDebt),
		PlanID:     value.PlanId,
		SourceType: value.SourceType,
		Active:     value.Active,
	}, nil
}

// HasRole returns true when account holds role on StakingPool.
func (a *StakingPoolAdapter) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	return a.caller.HasRole(callOpts(ctx), role, account)
}

// GetRoleAdmin reads the admin role for role on StakingPool.
func (a *StakingPoolAdapter) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	return a.caller.GetRoleAdmin(callOpts(ctx), role)
}

// SetBettingPool updates the BettingPool address.
func (a *StakingPoolAdapter) SetBettingPool(opts *bind.TransactOpts, newBettingPool common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetBettingPool(opts, newBettingPool)
	if err != nil {
		return nil, fmt.Errorf("staking pool set betting pool: %w", err)
	}
	return tx, nil
}

// SetMinStakeAmount updates the minimum stake amount.
func (a *StakingPoolAdapter) SetMinStakeAmount(opts *bind.TransactOpts, newMinStakeAmount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetMinStakeAmount(opts, newMinStakeAmount)
	if err != nil {
		return nil, fmt.Errorf("staking pool set min stake amount: %w", err)
	}
	return tx, nil
}

// SetPlatformTreasury updates the platform treasury.
func (a *StakingPoolAdapter) SetPlatformTreasury(opts *bind.TransactOpts, newPlatformTreasury common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetPlatformTreasury(opts, newPlatformTreasury)
	if err != nil {
		return nil, fmt.Errorf("staking pool set platform treasury: %w", err)
	}
	return tx, nil
}

// SetVipTierConfig updates a VIP tier threshold and daily limit.
func (a *StakingPoolAdapter) SetVipTierConfig(opts *bind.TransactOpts, tier uint8, threshold *big.Int, dailyLimit *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetVipTierConfig(opts, tier, threshold, dailyLimit)
	if err != nil {
		return nil, fmt.Errorf("staking pool set vip tier config: %w", err)
	}
	return tx, nil
}

// GrantRole grants a role to an account.
func (a *StakingPoolAdapter) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.GrantRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("staking pool grant role: %w", err)
	}
	return tx, nil
}

// RevokeRole revokes a role from an account.
func (a *StakingPoolAdapter) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RevokeRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("staking pool revoke role: %w", err)
	}
	return tx, nil
}

// RenounceRole renounces a role held by the caller.
func (a *StakingPoolAdapter) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("staking pool renounce role: %w", err)
	}
	return tx, nil
}

// Pause pauses staking operations.
func (a *StakingPoolAdapter) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Pause(opts)
	if err != nil {
		return nil, fmt.Errorf("staking pool pause: %w", err)
	}
	return tx, nil
}

// Unpause unpauses staking operations.
func (a *StakingPoolAdapter) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Unpause(opts)
	if err != nil {
		return nil, fmt.Errorf("staking pool unpause: %w", err)
	}
	return tx, nil
}

// UpgradeToAndCall upgrades the StakingPool proxy and optionally calls initialization data.
func (a *StakingPoolAdapter) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, fmt.Errorf("staking pool upgrade to and call: %w", err)
	}
	return tx, nil
}

var stakingPoolABI = mustLoadStakingPoolABI()

func mustLoadStakingPoolABI() abi.ABI {
	parsed, err := stakingpool.StakingPoolMetaData.GetAbi()
	if err != nil {
		panic("bind staking pool abi: " + err.Error())
	}
	if parsed == nil {
		panic("bind staking pool abi: nil abi")
	}
	return *parsed
}

// StakeCalldata returns ABI-encoded calldata for StakingPool.stake(uint256,uint16).
func (a *StakingPoolAdapter) StakeCalldata(amount *big.Int, planID uint16) ([]byte, error) {
	data, err := stakingPoolABI.Pack("stake", amount, planID)
	if err != nil {
		return nil, fmt.Errorf("staking pool stake abi pack: %w", err)
	}
	return data, nil
}

// UnstakeCalldata returns ABI-encoded calldata for StakingPool.unstake(uint256).
func (a *StakingPoolAdapter) UnstakeCalldata(positionID *big.Int) ([]byte, error) {
	data, err := stakingPoolABI.Pack("unstake", positionID)
	if err != nil {
		return nil, fmt.Errorf("staking pool unstake abi pack: %w", err)
	}
	return data, nil
}

// EarlyUnstakeCalldata returns ABI-encoded calldata for StakingPool.earlyUnstake(uint256).
func (a *StakingPoolAdapter) EarlyUnstakeCalldata(positionID *big.Int) ([]byte, error) {
	data, err := stakingPoolABI.Pack("earlyUnstake", positionID)
	if err != nil {
		return nil, fmt.Errorf("staking pool early unstake abi pack: %w", err)
	}
	return data, nil
}
