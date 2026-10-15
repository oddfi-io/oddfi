package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// StakingPool exposes read-only staking pool calls. Methods are safe for
// concurrent use and block on RPC until the backend returns or ctx is canceled.
type StakingPool struct {
	adapter *contracts.StakingPoolAdapter
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

// OddToken reads the ODD token address configured on StakingPool.
func (p *StakingPool) OddToken(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "staking pool odd token"); err != nil {
		return common.Address{}, err
	}
	if err := ensureStakingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.OddToken(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("staking pool odd token", err)
	}
	return value, nil
}

// BettingPool reads the betting pool address configured on StakingPool.
func (p *StakingPool) BettingPool(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "staking pool betting pool"); err != nil {
		return common.Address{}, err
	}
	if err := ensureStakingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.BettingPool(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("staking pool betting pool", err)
	}
	return value, nil
}

// PlatformTreasury reads the platform treasury address configured on StakingPool.
func (p *StakingPool) PlatformTreasury(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "staking pool platform treasury"); err != nil {
		return common.Address{}, err
	}
	if err := ensureStakingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.PlatformTreasury(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("staking pool platform treasury", err)
	}
	return value, nil
}

// Paused reads whether staking operations are paused.
func (p *StakingPool) Paused(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "staking pool paused"); err != nil {
		return false, err
	}
	if err := ensureStakingPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.Paused(ctx)
	if err != nil {
		return false, wrapInfraError("staking pool paused", err)
	}
	return value, nil
}

// DefaultAdminRole reads the OpenZeppelin default admin role id.
func (p *StakingPool) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "staking pool default admin role"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureStakingPool(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.DefaultAdminRole(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("staking pool default admin role", err)
	}
	return value, nil
}

// UpgradeInterfaceVersion reads the UUPS interface version string.
func (p *StakingPool) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "staking pool upgrade interface version"); err != nil {
		return "", err
	}
	if err := ensureStakingPool(p); err != nil {
		return "", err
	}
	value, err := p.adapter.UpgradeInterfaceVersion(ctx)
	if err != nil {
		return "", wrapInfraError("staking pool upgrade interface version", err)
	}
	return value, nil
}

// ProxiableUUID reads the UUPS implementation slot UUID.
func (p *StakingPool) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "staking pool proxiable uuid"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureStakingPool(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.ProxiableUUID(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("staking pool proxiable uuid", err)
	}
	return value, nil
}

// SupportsInterface returns true when StakingPool supports interfaceID.
func (p *StakingPool) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	if err := checkContext(ctx, "staking pool supports interface"); err != nil {
		return false, err
	}
	if err := ensureStakingPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SupportsInterface(ctx, interfaceID)
	if err != nil {
		return false, wrapInfraError("staking pool supports interface", err)
	}
	return value, nil
}

// MinStakeAmount reads the minimum stake amount in ODD minimum units.
func (p *StakingPool) MinStakeAmount(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "staking pool min stake amount"); err != nil {
		return nil, err
	}
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.MinStakeAmount(ctx)
	if err != nil {
		return nil, wrapInfraError("staking pool min stake amount", err)
	}
	return value, nil
}

// TotalWeightedShares reads total weighted staking shares.
func (p *StakingPool) TotalWeightedShares(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "staking pool total weighted shares"); err != nil {
		return nil, err
	}
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalWeightedShares(ctx)
	if err != nil {
		return nil, wrapInfraError("staking pool total weighted shares", err)
	}
	return value, nil
}

// AccountedOddBalance reads accounted ODD balance.
func (p *StakingPool) AccountedOddBalance(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "staking pool accounted odd balance"); err != nil {
		return nil, err
	}
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.AccountedOddBalance(ctx)
	if err != nil {
		return nil, wrapInfraError("staking pool accounted odd balance", err)
	}
	return value, nil
}

// AccRewardPerShare reads the reward accumulator with 1e18 precision.
func (p *StakingPool) AccRewardPerShare(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "staking pool acc reward per share"); err != nil {
		return nil, err
	}
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.AccRewardPerShare(ctx)
	if err != nil {
		return nil, wrapInfraError("staking pool acc reward per share", err)
	}
	return value, nil
}

// NextPositionID reads the next staking position id.
func (p *StakingPool) NextPositionID(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "staking pool next position id"); err != nil {
		return nil, err
	}
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.NextPositionID(ctx)
	if err != nil {
		return nil, wrapInfraError("staking pool next position id", err)
	}
	return value, nil
}

// Stake submits a staking transaction using opts supplied by the caller.
func (p *StakingPool) Stake(opts *bind.TransactOpts, amount *big.Int, planID uint16) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Stake(opts, amount, planID)
	if err != nil {
		return nil, wrapInfraError("staking pool stake", err)
	}
	return tx, nil
}

// Unstake withdraws a matured staking position (principal + accrued reward).
// The position must have reached its unlockAt time. Caller must be the position owner.
func (p *StakingPool) Unstake(opts *bind.TransactOpts, positionID *big.Int) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Unstake(opts, positionID)
	if err != nil {
		return nil, wrapInfraError("staking pool unstake", err)
	}
	return tx, nil
}

// EarlyUnstake withdraws an active staking position before its unlockAt time.
// Caller receives principal only and forfeits accrued reward; the unclaimed
// reward is redistributed to remaining stakers or, if none, to the platform
// treasury. Caller must be the position owner.
func (p *StakingPool) EarlyUnstake(opts *bind.TransactOpts, positionID *big.Int) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.EarlyUnstake(opts, positionID)
	if err != nil {
		return nil, wrapInfraError("staking pool early unstake", err)
	}
	return tx, nil
}

// GetActiveStakeAmount reads the active staked principal for a user in ODD wei.
func (p *StakingPool) GetActiveStakeAmount(ctx context.Context, user common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "staking pool get active stake amount"); err != nil {
		return nil, err
	}
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.GetActiveStakeAmount(ctx, user)
	if err != nil {
		return nil, wrapInfraError("staking pool get active stake amount", err)
	}
	return value, nil
}

// ActiveStakeAmount reads the active stake amount mapping for a user.
func (p *StakingPool) ActiveStakeAmount(ctx context.Context, user common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "staking pool active stake amount"); err != nil {
		return nil, err
	}
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.ActiveStakeAmount(ctx, user)
	if err != nil {
		return nil, wrapInfraError("staking pool active stake amount", err)
	}
	return value, nil
}

// GetUserTier reads the user's current VIP tier.
func (p *StakingPool) GetUserTier(ctx context.Context, user common.Address) (uint8, error) {
	if err := checkContext(ctx, "staking pool get user tier"); err != nil {
		return 0, err
	}
	if err := ensureStakingPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.GetUserTier(ctx, user)
	if err != nil {
		return 0, wrapInfraError("staking pool get user tier", err)
	}
	return value, nil
}

// GetUserDailyLimit reads the user's current betting daily limit.
func (p *StakingPool) GetUserDailyLimit(ctx context.Context, user common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "staking pool get user daily limit"); err != nil {
		return nil, err
	}
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.GetUserDailyLimit(ctx, user)
	if err != nil {
		return nil, wrapInfraError("staking pool get user daily limit", err)
	}
	return value, nil
}

// IsActiveStaker returns true when the user has active stake.
func (p *StakingPool) IsActiveStaker(ctx context.Context, user common.Address) (bool, error) {
	if err := checkContext(ctx, "staking pool is active staker"); err != nil {
		return false, err
	}
	if err := ensureStakingPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.IsActiveStaker(ctx, user)
	if err != nil {
		return false, wrapInfraError("staking pool is active staker", err)
	}
	return value, nil
}

// Position reads one staking position by id.
func (p *StakingPool) Position(ctx context.Context, positionID *big.Int) (StakingPosition, error) {
	if err := checkContext(ctx, "staking pool position"); err != nil {
		return StakingPosition{}, err
	}
	if err := ensureStakingPool(p); err != nil {
		return StakingPosition{}, err
	}
	if positionID == nil {
		return StakingPosition{}, wrapUserError("staking pool position", ErrNilBigIntParam)
	}
	value, err := p.adapter.Position(ctx, positionID)
	if err != nil {
		return StakingPosition{}, wrapInfraError("staking pool position", err)
	}
	return StakingPosition{
		Owner:      value.Owner,
		Principal:  value.Principal,
		Weight:     value.Weight,
		UnlockAt:   value.UnlockAt,
		RewardDebt: value.RewardDebt,
		PlanID:     value.PlanID,
		SourceType: value.SourceType,
		Active:     value.Active,
	}, nil
}

// HasRole returns true when account holds role on StakingPool.
func (p *StakingPool) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	if err := checkContext(ctx, "staking pool has role"); err != nil {
		return false, err
	}
	if err := ensureStakingPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.HasRole(ctx, role, account)
	if err != nil {
		return false, wrapInfraError("staking pool has role", err)
	}
	return value, nil
}

// GetRoleAdmin reads the admin role for role on StakingPool.
func (p *StakingPool) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	if err := checkContext(ctx, "staking pool get role admin"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureStakingPool(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.GetRoleAdmin(ctx, role)
	if err != nil {
		return [32]byte{}, wrapInfraError("staking pool get role admin", err)
	}
	return value, nil
}

// SetBettingPool updates the BettingPool address. Caller must hold DEFAULT_ADMIN_ROLE.
func (p *StakingPool) SetBettingPool(opts *bind.TransactOpts, newBettingPool common.Address) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetBettingPool(opts, newBettingPool)
	if err != nil {
		return nil, wrapInfraError("staking pool set betting pool", err)
	}
	return tx, nil
}

// SetMinStakeAmount updates the minimum stake amount. Caller must hold DEFAULT_ADMIN_ROLE.
func (p *StakingPool) SetMinStakeAmount(opts *bind.TransactOpts, newMinStakeAmount *big.Int) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	if newMinStakeAmount == nil {
		return nil, wrapUserError("staking pool set min stake amount", ErrNilBigIntParam)
	}
	tx, err := p.adapter.SetMinStakeAmount(opts, newMinStakeAmount)
	if err != nil {
		return nil, wrapInfraError("staking pool set min stake amount", err)
	}
	return tx, nil
}

// SetPlatformTreasury updates the platform treasury. Caller must hold DEFAULT_ADMIN_ROLE.
func (p *StakingPool) SetPlatformTreasury(opts *bind.TransactOpts, newPlatformTreasury common.Address) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetPlatformTreasury(opts, newPlatformTreasury)
	if err != nil {
		return nil, wrapInfraError("staking pool set platform treasury", err)
	}
	return tx, nil
}

// SetVipTierConfig updates a VIP tier threshold and daily limit. Caller must hold DEFAULT_ADMIN_ROLE.
func (p *StakingPool) SetVipTierConfig(opts *bind.TransactOpts, tier uint8, threshold *big.Int, dailyLimit *big.Int) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	if threshold == nil || dailyLimit == nil {
		return nil, wrapUserError("staking pool set vip tier config", ErrNilBigIntParam)
	}
	tx, err := p.adapter.SetVipTierConfig(opts, tier, threshold, dailyLimit)
	if err != nil {
		return nil, wrapInfraError("staking pool set vip tier config", err)
	}
	return tx, nil
}

// GrantRole grants a role to an account. Caller must hold the admin role for the target role.
func (p *StakingPool) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.GrantRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("staking pool grant role", err)
	}
	return tx, nil
}

// RevokeRole revokes a role from an account. Caller must hold the admin role for the target role.
func (p *StakingPool) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RevokeRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("staking pool revoke role", err)
	}
	return tx, nil
}

// RenounceRole renounces a role held by the caller.
func (p *StakingPool) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, wrapInfraError("staking pool renounce role", err)
	}
	return tx, nil
}

// Pause pauses staking operations. Caller must hold PAUSER_ROLE.
func (p *StakingPool) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Pause(opts)
	if err != nil {
		return nil, wrapInfraError("staking pool pause", err)
	}
	return tx, nil
}

// Unpause unpauses staking operations. Caller must hold PAUSER_ROLE.
func (p *StakingPool) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Unpause(opts)
	if err != nil {
		return nil, wrapInfraError("staking pool unpause", err)
	}
	return tx, nil
}

// UpgradeToAndCall upgrades the StakingPool proxy and optionally executes initialization calldata.
func (p *StakingPool) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, wrapInfraError("staking pool upgrade to and call", err)
	}
	return tx, nil
}

// StakeCalldata returns ABI-encoded calldata for StakingPool.stake; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *StakingPool) StakeCalldata(amount *big.Int, planID uint16) ([]byte, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	if amount == nil {
		return nil, wrapUserError("staking pool stake calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.StakeCalldata(amount, planID)
	if err != nil {
		return nil, wrapUserError("staking pool stake calldata", err)
	}
	return data, nil
}

// UnstakeCalldata returns ABI-encoded calldata for StakingPool.unstake; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *StakingPool) UnstakeCalldata(positionID *big.Int) ([]byte, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	if positionID == nil {
		return nil, wrapUserError("staking pool unstake calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.UnstakeCalldata(positionID)
	if err != nil {
		return nil, wrapUserError("staking pool unstake calldata", err)
	}
	return data, nil
}

// EarlyUnstakeCalldata returns ABI-encoded calldata for StakingPool.earlyUnstake; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *StakingPool) EarlyUnstakeCalldata(positionID *big.Int) ([]byte, error) {
	if err := ensureStakingPool(p); err != nil {
		return nil, err
	}
	if positionID == nil {
		return nil, wrapUserError("staking pool early unstake calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.EarlyUnstakeCalldata(positionID)
	if err != nil {
		return nil, wrapUserError("staking pool early unstake calldata", err)
	}
	return data, nil
}
