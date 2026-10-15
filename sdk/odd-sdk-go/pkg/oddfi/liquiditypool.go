package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	liquiditydomain "github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/domain/liquiditypool"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// LiquidityPool exposes read-only liquidity pool calls. Methods are safe for
// concurrent use and block on RPC until the backend returns or ctx is canceled.
type LiquidityPool struct {
	adapter *contracts.LiquidityPoolAdapter
}

// LiquidityPositionState is the effective lifecycle state of a liquidity position.
type LiquidityPositionState = liquiditydomain.LpPositionState

const (
	// LiquidityPositionStateActive indicates an active LP position.
	LiquidityPositionStateActive = liquiditydomain.LpPositionStateActive
	// LiquidityPositionStateUnbonding indicates an LP position waiting for unbond epochs.
	LiquidityPositionStateUnbonding = liquiditydomain.LpPositionStateUnbonding
	// LiquidityPositionStateReady indicates an active LP position that has reached unlock time.
	LiquidityPositionStateReady = liquiditydomain.LpPositionStateReady
	// LiquidityPositionStateWithdrawn indicates an LP position has been withdrawn.
	LiquidityPositionStateWithdrawn = liquiditydomain.LpPositionStateWithdrawn
	// LiquidityPositionStateLiquidated indicates losses covered the LP principal.
	LiquidityPositionStateLiquidated = liquiditydomain.LpPositionStateLiquidated
	// LiquidityPositionStateWithdrawable indicates an unbonded LP position can withdraw now.
	LiquidityPositionStateWithdrawable = liquiditydomain.LpPositionStateWithdrawable
)

// PayoutLiquidityWindow is the LP payout window reserved for a settled match.
// Amounts use ODD base units. ReservedAmount is the total LP liquidity reserved
// for payouts, PaidOutAmount is the amount already transferred to BettingPool,
// and SettledAt is the settlement timestamp recorded by LiquidityPool.
type PayoutLiquidityWindow struct {
	// ReservedAmount is the total LP liquidity reserved for match payouts.
	ReservedAmount *big.Int
	// PaidOutAmount is the reserved liquidity already transferred to BettingPool.
	PaidOutAmount *big.Int
	// SettledAt is the settlement timestamp recorded by LiquidityPool.
	SettledAt *big.Int
}

// LiquidityPoolWeights contains active Global and Match pool weights.
type LiquidityPoolWeights struct {
	GlobalWeight *big.Int
	MatchWeight  *big.Int
}

// LiquidityPoolInfo is the raw pool accounting state.
type LiquidityPoolInfo struct {
	PoolType         uint8
	MatchID          [32]byte
	Exists           bool
	DepositOpen      bool
	DepositCloseAt   uint64
	UnlockAt         uint64
	TotalDeposited   *big.Int
	TotalWeight      *big.Int
	RewardPerWeight  *big.Int
	LossPerPrincipal *big.Int
}

// LiquidityPosition is the raw LP position state.
type LiquidityPosition struct {
	Owner                  common.Address
	PoolID                 *big.Int
	Principal              *big.Int
	Weight                 *big.Int
	UnlockAt               uint64
	RewardDebt             *big.Int
	LossDebt               *big.Int
	UnbondingEpoch         uint32
	FrozenRewardPerWeight  *big.Int
	FrozenLossPerPrincipal *big.Int
	PlanID                 uint16
	State                  uint8
}

// LiquidityWithdrawPreview is the read-only withdrawal preview for an LP position.
// Amounts use ODD base units. NetPnL may be negative when losses reduce principal.
type LiquidityWithdrawPreview struct {
	// WithdrawAmount is the amount that withdraw would transfer for the position.
	WithdrawAmount *big.Int
	// NetPnL is the frozen net profit or loss applied to the position.
	NetPnL *big.Int
	// EffectiveState is the display-friendly state used to interpret the preview.
	EffectiveState LiquidityPositionState
}

// OddToken reads the ODD token address configured on LiquidityPool.
func (p *LiquidityPool) OddToken(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "liquidity pool odd token"); err != nil {
		return common.Address{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.OddToken(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("liquidity pool odd token", err)
	}
	return value, nil
}

// BettingPool reads the betting pool address configured on LiquidityPool.
func (p *LiquidityPool) BettingPool(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "liquidity pool betting pool"); err != nil {
		return common.Address{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.BettingPool(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("liquidity pool betting pool", err)
	}
	return value, nil
}

// Paused reads whether liquidity operations are paused.
func (p *LiquidityPool) Paused(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "liquidity pool paused"); err != nil {
		return false, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.Paused(ctx)
	if err != nil {
		return false, wrapInfraError("liquidity pool paused", err)
	}
	return value, nil
}

// DefaultAdminRole reads the OpenZeppelin default admin role id.
func (p *LiquidityPool) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "liquidity pool default admin role"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.DefaultAdminRole(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("liquidity pool default admin role", err)
	}
	return value, nil
}

// UpgradeInterfaceVersion reads the UUPS interface version string.
func (p *LiquidityPool) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "liquidity pool upgrade interface version"); err != nil {
		return "", err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return "", err
	}
	value, err := p.adapter.UpgradeInterfaceVersion(ctx)
	if err != nil {
		return "", wrapInfraError("liquidity pool upgrade interface version", err)
	}
	return value, nil
}

// ProxiableUUID reads the UUPS implementation slot UUID.
func (p *LiquidityPool) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "liquidity pool proxiable uuid"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.ProxiableUUID(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("liquidity pool proxiable uuid", err)
	}
	return value, nil
}

// SupportsInterface returns true when LiquidityPool supports interfaceID.
func (p *LiquidityPool) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	if err := checkContext(ctx, "liquidity pool supports interface"); err != nil {
		return false, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SupportsInterface(ctx, interfaceID)
	if err != nil {
		return false, wrapInfraError("liquidity pool supports interface", err)
	}
	return value, nil
}

// MinDeposit reads the minimum liquidity deposit amount.
func (p *LiquidityPool) MinDeposit(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "liquidity pool min deposit"); err != nil {
		return nil, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.MinDeposit(ctx)
	if err != nil {
		return nil, wrapInfraError("liquidity pool min deposit", err)
	}
	return value, nil
}

// EpochStart reads the current epoch start timestamp.
func (p *LiquidityPool) EpochStart(ctx context.Context) (uint64, error) {
	if err := checkContext(ctx, "liquidity pool epoch start"); err != nil {
		return 0, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.EpochStart(ctx)
	if err != nil {
		return 0, wrapInfraError("liquidity pool epoch start", err)
	}
	return value, nil
}

// RequestableLiquidity reads currently requestable liquidity.
func (p *LiquidityPool) RequestableLiquidity(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "liquidity pool requestable liquidity"); err != nil {
		return nil, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.RequestableLiquidity(ctx)
	if err != nil {
		return nil, wrapInfraError("liquidity pool requestable liquidity", err)
	}
	return value, nil
}

// GetRequestableLiquidity reads requestable liquidity through the explicit contract getter.
func (p *LiquidityPool) GetRequestableLiquidity(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "liquidity pool get requestable liquidity"); err != nil {
		return nil, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.GetRequestableLiquidity(ctx)
	if err != nil {
		return nil, wrapInfraError("liquidity pool get requestable liquidity", err)
	}
	return value, nil
}

// GlobalRequestableLiquidity reads currently requestable global liquidity.
func (p *LiquidityPool) GlobalRequestableLiquidity(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "liquidity pool global requestable liquidity"); err != nil {
		return nil, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.GlobalRequestableLiquidity(ctx)
	if err != nil {
		return nil, wrapInfraError("liquidity pool global requestable liquidity", err)
	}
	return value, nil
}

// GlobalRequestableLiquidityInitialized reads whether global requestable liquidity has been initialized.
func (p *LiquidityPool) GlobalRequestableLiquidityInitialized(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "liquidity pool global requestable liquidity initialized"); err != nil {
		return false, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.GlobalRequestableLiquidityInitialized(ctx)
	if err != nil {
		return false, wrapInfraError("liquidity pool global requestable liquidity initialized", err)
	}
	return value, nil
}

// TotalActiveDeposited reads total active deposited liquidity.
func (p *LiquidityPool) TotalActiveDeposited(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "liquidity pool total active deposited"); err != nil {
		return nil, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalActiveDeposited(ctx)
	if err != nil {
		return nil, wrapInfraError("liquidity pool total active deposited", err)
	}
	return value, nil
}

// TotalOutstandingPayoutReserved reads outstanding payout reserve.
func (p *LiquidityPool) TotalOutstandingPayoutReserved(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "liquidity pool total outstanding payout reserved"); err != nil {
		return nil, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalOutstandingPayoutReserved(ctx)
	if err != nil {
		return nil, wrapInfraError("liquidity pool total outstanding payout reserved", err)
	}
	return value, nil
}

// PayoutLiquidityWindow reads the payout liquidity reserved for a match.
func (p *LiquidityPool) PayoutLiquidityWindow(ctx context.Context, matchID [32]byte) (PayoutLiquidityWindow, error) {
	if err := checkContext(ctx, "liquidity pool payout liquidity window"); err != nil {
		return PayoutLiquidityWindow{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return PayoutLiquidityWindow{}, err
	}
	reservedAmount, paidOutAmount, settledAt, err := p.adapter.PayoutLiquidityWindow(ctx, matchID)
	if err != nil {
		return PayoutLiquidityWindow{}, wrapInfraError("liquidity pool payout liquidity window", err)
	}
	return PayoutLiquidityWindow{
		ReservedAmount: reservedAmount,
		PaidOutAmount:  paidOutAmount,
		SettledAt:      settledAt,
	}, nil
}

// GetPoolWeights reads active Global and Match pool weights.
func (p *LiquidityPool) GetPoolWeights(ctx context.Context, matchID [32]byte) (LiquidityPoolWeights, error) {
	if err := checkContext(ctx, "liquidity pool get pool weights"); err != nil {
		return LiquidityPoolWeights{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return LiquidityPoolWeights{}, err
	}
	value, err := p.adapter.GetPoolWeights(ctx, matchID)
	if err != nil {
		return LiquidityPoolWeights{}, wrapInfraError("liquidity pool get pool weights", err)
	}
	return LiquidityPoolWeights{
		GlobalWeight: value.GlobalWeight,
		MatchWeight:  value.MatchWeight,
	}, nil
}

// Pool reads raw pool accounting state.
func (p *LiquidityPool) Pool(ctx context.Context, poolID *big.Int) (LiquidityPoolInfo, error) {
	if err := checkContext(ctx, "liquidity pool pool"); err != nil {
		return LiquidityPoolInfo{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return LiquidityPoolInfo{}, err
	}
	if poolID == nil {
		return LiquidityPoolInfo{}, wrapUserError("liquidity pool pool", ErrNilBigIntParam)
	}
	value, err := p.adapter.Pool(ctx, poolID)
	if err != nil {
		return LiquidityPoolInfo{}, wrapInfraError("liquidity pool pool", err)
	}
	return LiquidityPoolInfo{
		PoolType:         value.PoolType,
		MatchID:          value.MatchID,
		Exists:           value.Exists,
		DepositOpen:      value.DepositOpen,
		DepositCloseAt:   value.DepositCloseAt,
		UnlockAt:         value.UnlockAt,
		TotalDeposited:   value.TotalDeposited,
		TotalWeight:      value.TotalWeight,
		RewardPerWeight:  value.RewardPerWeight,
		LossPerPrincipal: value.LossPerPrincipal,
	}, nil
}

// Position reads raw LP position state.
func (p *LiquidityPool) Position(ctx context.Context, positionID *big.Int) (LiquidityPosition, error) {
	if err := checkContext(ctx, "liquidity pool position"); err != nil {
		return LiquidityPosition{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return LiquidityPosition{}, err
	}
	if positionID == nil {
		return LiquidityPosition{}, wrapUserError("liquidity pool position", ErrNilBigIntParam)
	}
	value, err := p.adapter.Position(ctx, positionID)
	if err != nil {
		return LiquidityPosition{}, wrapInfraError("liquidity pool position", err)
	}
	return LiquidityPosition{
		Owner:                  value.Owner,
		PoolID:                 value.PoolID,
		Principal:              value.Principal,
		Weight:                 value.Weight,
		UnlockAt:               value.UnlockAt,
		RewardDebt:             value.RewardDebt,
		LossDebt:               value.LossDebt,
		UnbondingEpoch:         value.UnbondingEpoch,
		FrozenRewardPerWeight:  value.FrozenRewardPerWeight,
		FrozenLossPerPrincipal: value.FrozenLossPerPrincipal,
		PlanID:                 value.PlanID,
		State:                  value.State,
	}, nil
}

// PreviewWithdraw previews the withdrawal amount for a liquidity position without submitting a transaction.
func (p *LiquidityPool) PreviewWithdraw(ctx context.Context, positionID *big.Int) (LiquidityWithdrawPreview, error) {
	if err := checkContext(ctx, "liquidity pool preview withdraw"); err != nil {
		return LiquidityWithdrawPreview{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return LiquidityWithdrawPreview{}, err
	}
	if positionID == nil {
		return LiquidityWithdrawPreview{}, wrapUserError("liquidity pool preview withdraw", ErrNilBigIntParam)
	}
	withdrawAmount, netPnL, effectiveState, err := p.adapter.PreviewWithdraw(ctx, positionID)
	if err != nil {
		return LiquidityWithdrawPreview{}, wrapInfraError("liquidity pool preview withdraw", err)
	}
	return LiquidityWithdrawPreview{
		WithdrawAmount: withdrawAmount,
		NetPnL:         netPnL,
		EffectiveState: LiquidityPositionState(effectiveState),
	}, nil
}

// UnbondEpochs reads the number of unbonding epochs.
func (p *LiquidityPool) UnbondEpochs(ctx context.Context) (uint32, error) {
	if err := checkContext(ctx, "liquidity pool unbond epochs"); err != nil {
		return 0, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.UnbondEpochs(ctx)
	if err != nil {
		return 0, wrapInfraError("liquidity pool unbond epochs", err)
	}
	return value, nil
}

// HasRole returns true when account holds role on LiquidityPool.
func (p *LiquidityPool) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	if err := checkContext(ctx, "liquidity pool has role"); err != nil {
		return false, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.HasRole(ctx, role, account)
	if err != nil {
		return false, wrapInfraError("liquidity pool has role", err)
	}
	return value, nil
}

// GetRoleAdmin reads the admin role for role on LiquidityPool.
func (p *LiquidityPool) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	if err := checkContext(ctx, "liquidity pool get role admin"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.GetRoleAdmin(ctx, role)
	if err != nil {
		return [32]byte{}, wrapInfraError("liquidity pool get role admin", err)
	}
	return value, nil
}

// DepositGlobal submits a global liquidity deposit transaction using opts supplied by the caller.
func (p *LiquidityPool) DepositGlobal(opts *bind.TransactOpts, amount *big.Int, planID uint16) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.DepositGlobal(opts, amount, planID)
	if err != nil {
		return nil, wrapInfraError("liquidity pool deposit global", err)
	}
	return tx, nil
}

// DepositMatch submits a match pool liquidity deposit. The match pool must exist
// (created automatically on first openMarket call for the matchID) and deposits must still be open.
// Caller must approve LiquidityPool for amount before calling.
func (p *LiquidityPool) DepositMatch(opts *bind.TransactOpts, matchID [32]byte, amount *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.DepositMatch(opts, matchID, amount)
	if err != nil {
		return nil, wrapInfraError("liquidity pool deposit match", err)
	}
	return tx, nil
}

// OpenMatchPool opens a match-specific liquidity pool. Caller must be the configured BettingPool.
func (p *LiquidityPool) OpenMatchPool(opts *bind.TransactOpts, matchID [32]byte, matchStartTime uint64, matchEndTime uint64) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.OpenMatchPool(opts, matchID, matchStartTime, matchEndTime)
	if err != nil {
		return nil, wrapInfraError("liquidity pool open match pool", err)
	}
	return tx, nil
}

// CloseMatchPoolDeposit closes deposits for a match pool. Caller must be the configured BettingPool.
func (p *LiquidityPool) CloseMatchPoolDeposit(opts *bind.TransactOpts, matchID [32]byte) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.CloseMatchPoolDeposit(opts, matchID)
	if err != nil {
		return nil, wrapInfraError("liquidity pool close match pool deposit", err)
	}
	return tx, nil
}

// RequestUnbond initiates the unbonding process for an LP position.
// Caller must be the position owner. For match pools, the match must be in terminal state.
func (p *LiquidityPool) RequestUnbond(opts *bind.TransactOpts, positionID *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RequestUnbond(opts, positionID)
	if err != nil {
		return nil, wrapInfraError("liquidity pool request unbond", err)
	}
	return tx, nil
}

// Withdraw finalises withdrawal of an unbonded LP position. The unbonding epoch
// must have elapsed. Caller must be the position owner.
func (p *LiquidityPool) Withdraw(opts *bind.TransactOpts, positionID *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Withdraw(opts, positionID)
	if err != nil {
		return nil, wrapInfraError("liquidity pool withdraw", err)
	}
	return tx, nil
}

// SetBettingPool updates the BettingPool address. Caller must hold DEFAULT_ADMIN_ROLE.
func (p *LiquidityPool) SetBettingPool(opts *bind.TransactOpts, newBettingPool common.Address) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetBettingPool(opts, newBettingPool)
	if err != nil {
		return nil, wrapInfraError("liquidity pool set betting pool", err)
	}
	return tx, nil
}

// SetMinDeposit updates the minimum LP deposit. Caller must hold DEFAULT_ADMIN_ROLE.
func (p *LiquidityPool) SetMinDeposit(opts *bind.TransactOpts, newMinDeposit *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if newMinDeposit == nil {
		return nil, wrapUserError("liquidity pool set min deposit", ErrNilBigIntParam)
	}
	tx, err := p.adapter.SetMinDeposit(opts, newMinDeposit)
	if err != nil {
		return nil, wrapInfraError("liquidity pool set min deposit", err)
	}
	return tx, nil
}

// SetUnbondEpochs updates unbond waiting epochs. Caller must hold DEFAULT_ADMIN_ROLE.
func (p *LiquidityPool) SetUnbondEpochs(opts *bind.TransactOpts, newUnbondEpochs uint32) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetUnbondEpochs(opts, newUnbondEpochs)
	if err != nil {
		return nil, wrapInfraError("liquidity pool set unbond epochs", err)
	}
	return tx, nil
}

// GrantRole grants a role to an account. Caller must hold the admin role for the target role.
func (p *LiquidityPool) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.GrantRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("liquidity pool grant role", err)
	}
	return tx, nil
}

// RevokeRole revokes a role from an account. Caller must hold the admin role for the target role.
func (p *LiquidityPool) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RevokeRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("liquidity pool revoke role", err)
	}
	return tx, nil
}

// RenounceRole renounces a role held by the caller.
func (p *LiquidityPool) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, wrapInfraError("liquidity pool renounce role", err)
	}
	return tx, nil
}

// Pause pauses liquidity operations. Caller must hold PAUSER_ROLE.
func (p *LiquidityPool) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Pause(opts)
	if err != nil {
		return nil, wrapInfraError("liquidity pool pause", err)
	}
	return tx, nil
}

// Unpause unpauses liquidity operations. Caller must hold PAUSER_ROLE.
func (p *LiquidityPool) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Unpause(opts)
	if err != nil {
		return nil, wrapInfraError("liquidity pool unpause", err)
	}
	return tx, nil
}

// UpgradeToAndCall upgrades the LiquidityPool proxy and optionally executes initialization calldata.
func (p *LiquidityPool) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, wrapInfraError("liquidity pool upgrade to and call", err)
	}
	return tx, nil
}

// InitializeGlobalRequestableLiquidity initializes global requestable liquidity. Caller must hold the required on-chain role.
func (p *LiquidityPool) InitializeGlobalRequestableLiquidity(opts *bind.TransactOpts, value *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if value == nil {
		return nil, wrapUserError("liquidity pool initialize global requestable liquidity", ErrNilBigIntParam)
	}
	tx, err := p.adapter.InitializeGlobalRequestableLiquidity(opts, value)
	if err != nil {
		return nil, wrapInfraError("liquidity pool initialize global requestable liquidity", err)
	}
	return tx, nil
}

// DistributeGlobalLoss books global LP loss for a risk id. Caller must hold the required on-chain role.
func (p *LiquidityPool) DistributeGlobalLoss(opts *bind.TransactOpts, riskID [32]byte, netLoss *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if netLoss == nil {
		return nil, wrapUserError("liquidity pool distribute global loss", ErrNilBigIntParam)
	}
	tx, err := p.adapter.DistributeGlobalLoss(opts, riskID, netLoss)
	if err != nil {
		return nil, wrapInfraError("liquidity pool distribute global loss", err)
	}
	return tx, nil
}

// DistributeGlobalMargin distributes global LP margin for a risk id. Caller must hold the required on-chain role.
func (p *LiquidityPool) DistributeGlobalMargin(opts *bind.TransactOpts, riskID [32]byte, lpMarginShare *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if lpMarginShare == nil {
		return nil, wrapUserError("liquidity pool distribute global margin", ErrNilBigIntParam)
	}
	tx, err := p.adapter.DistributeGlobalMargin(opts, riskID, lpMarginShare)
	if err != nil {
		return nil, wrapInfraError("liquidity pool distribute global margin", err)
	}
	return tx, nil
}

// DistributeLoss books match LP loss for a match. Caller must be the configured BettingPool.
func (p *LiquidityPool) DistributeLoss(opts *bind.TransactOpts, matchID [32]byte, netLoss *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if netLoss == nil {
		return nil, wrapUserError("liquidity pool distribute loss", ErrNilBigIntParam)
	}
	tx, err := p.adapter.DistributeLoss(opts, matchID, netLoss)
	if err != nil {
		return nil, wrapInfraError("liquidity pool distribute loss", err)
	}
	return tx, nil
}

// DistributeMargin distributes match LP margin for a match. Caller must be the configured BettingPool.
func (p *LiquidityPool) DistributeMargin(opts *bind.TransactOpts, matchID [32]byte, lpMarginShare *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if lpMarginShare == nil {
		return nil, wrapUserError("liquidity pool distribute margin", ErrNilBigIntParam)
	}
	tx, err := p.adapter.DistributeMargin(opts, matchID, lpMarginShare)
	if err != nil {
		return nil, wrapInfraError("liquidity pool distribute margin", err)
	}
	return tx, nil
}

// RequestPayoutLiquidity transfers reserved payout liquidity to BettingPool. Caller must be the configured BettingPool.
func (p *LiquidityPool) RequestPayoutLiquidity(opts *bind.TransactOpts, matchID [32]byte, amount *big.Int) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if amount == nil {
		return nil, wrapUserError("liquidity pool request payout liquidity", ErrNilBigIntParam)
	}
	tx, err := p.adapter.RequestPayoutLiquidity(opts, matchID, amount)
	if err != nil {
		return nil, wrapInfraError("liquidity pool request payout liquidity", err)
	}
	return tx, nil
}

// ReleasePayoutReserve releases reserved payout liquidity for a match. Caller must hold the required on-chain role.
func (p *LiquidityPool) ReleasePayoutReserve(opts *bind.TransactOpts, matchID [32]byte) (*types.Transaction, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.ReleasePayoutReserve(opts, matchID)
	if err != nil {
		return nil, wrapInfraError("liquidity pool release payout reserve", err)
	}
	return tx, nil
}

// NextLpPositionID reads the next LP position id that will be assigned.
func (p *LiquidityPool) NextLpPositionID(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "liquidity pool next lp position id"); err != nil {
		return nil, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.NextLpPositionID(ctx)
	if err != nil {
		return nil, wrapInfraError("liquidity pool next lp position id", err)
	}
	return value, nil
}

// GetPositionState returns the display-friendly effective state of an LP position.
// 0=Active, 1=Unbonding, 2=Ready (Active but past unlockAt), 3=Withdrawn, 4=Liquidated, 5=Withdrawable.
func (p *LiquidityPool) GetPositionState(ctx context.Context, positionID *big.Int) (uint8, error) {
	if err := checkContext(ctx, "liquidity pool get position state"); err != nil {
		return 0, err
	}
	if err := ensureLiquidityPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.GetPositionState(ctx, positionID)
	if err != nil {
		return 0, wrapInfraError("liquidity pool get position state", err)
	}
	return value, nil
}

// DepositGlobalCalldata returns ABI-encoded calldata for LiquidityPool.depositGlobal; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) DepositGlobalCalldata(amount *big.Int, planID uint16) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if amount == nil {
		return nil, wrapUserError("liquidity pool deposit global calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.DepositGlobalCalldata(amount, planID)
	if err != nil {
		return nil, wrapUserError("liquidity pool deposit global calldata", err)
	}
	return data, nil
}

// DepositMatchCalldata returns ABI-encoded calldata for LiquidityPool.depositMatch; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) DepositMatchCalldata(matchID [32]byte, amount *big.Int) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if amount == nil {
		return nil, wrapUserError("liquidity pool deposit match calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.DepositMatchCalldata(matchID, amount)
	if err != nil {
		return nil, wrapUserError("liquidity pool deposit match calldata", err)
	}
	return data, nil
}

// OpenMatchPoolCalldata returns ABI-encoded calldata for LiquidityPool.openMatchPool; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) OpenMatchPoolCalldata(matchID [32]byte, matchStartTime uint64, matchEndTime uint64) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.OpenMatchPoolCalldata(matchID, matchStartTime, matchEndTime)
	if err != nil {
		return nil, wrapUserError("liquidity pool open match pool calldata", err)
	}
	return data, nil
}

// CloseMatchPoolDepositCalldata returns ABI-encoded calldata for LiquidityPool.closeMatchPoolDeposit; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) CloseMatchPoolDepositCalldata(matchID [32]byte) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.CloseMatchPoolDepositCalldata(matchID)
	if err != nil {
		return nil, wrapUserError("liquidity pool close match pool deposit calldata", err)
	}
	return data, nil
}

// RequestUnbondCalldata returns ABI-encoded calldata for LiquidityPool.requestUnbond; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) RequestUnbondCalldata(positionID *big.Int) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if positionID == nil {
		return nil, wrapUserError("liquidity pool request unbond calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.RequestUnbondCalldata(positionID)
	if err != nil {
		return nil, wrapUserError("liquidity pool request unbond calldata", err)
	}
	return data, nil
}

// WithdrawCalldata returns ABI-encoded calldata for LiquidityPool.withdraw; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) WithdrawCalldata(positionID *big.Int) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if positionID == nil {
		return nil, wrapUserError("liquidity pool withdraw calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.WithdrawCalldata(positionID)
	if err != nil {
		return nil, wrapUserError("liquidity pool withdraw calldata", err)
	}
	return data, nil
}

// InitializeGlobalRequestableLiquidityCalldata returns ABI-encoded calldata for LiquidityPool.initializeGlobalRequestableLiquidity; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) InitializeGlobalRequestableLiquidityCalldata(value *big.Int) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if value == nil {
		return nil, wrapUserError("liquidity pool initialize global requestable liquidity calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.InitializeGlobalRequestableLiquidityCalldata(value)
	if err != nil {
		return nil, wrapUserError("liquidity pool initialize global requestable liquidity calldata", err)
	}
	return data, nil
}

// DistributeGlobalLossCalldata returns ABI-encoded calldata for LiquidityPool.distributeGlobalLoss; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) DistributeGlobalLossCalldata(riskID [32]byte, netLoss *big.Int) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if netLoss == nil {
		return nil, wrapUserError("liquidity pool distribute global loss calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.DistributeGlobalLossCalldata(riskID, netLoss)
	if err != nil {
		return nil, wrapUserError("liquidity pool distribute global loss calldata", err)
	}
	return data, nil
}

// DistributeGlobalMarginCalldata returns ABI-encoded calldata for LiquidityPool.distributeGlobalMargin; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) DistributeGlobalMarginCalldata(riskID [32]byte, lpMarginShare *big.Int) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if lpMarginShare == nil {
		return nil, wrapUserError("liquidity pool distribute global margin calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.DistributeGlobalMarginCalldata(riskID, lpMarginShare)
	if err != nil {
		return nil, wrapUserError("liquidity pool distribute global margin calldata", err)
	}
	return data, nil
}

// DistributeLossCalldata returns ABI-encoded calldata for LiquidityPool.distributeLoss; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) DistributeLossCalldata(matchID [32]byte, netLoss *big.Int) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if netLoss == nil {
		return nil, wrapUserError("liquidity pool distribute loss calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.DistributeLossCalldata(matchID, netLoss)
	if err != nil {
		return nil, wrapUserError("liquidity pool distribute loss calldata", err)
	}
	return data, nil
}

// DistributeMarginCalldata returns ABI-encoded calldata for LiquidityPool.distributeMargin; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) DistributeMarginCalldata(matchID [32]byte, lpMarginShare *big.Int) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if lpMarginShare == nil {
		return nil, wrapUserError("liquidity pool distribute margin calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.DistributeMarginCalldata(matchID, lpMarginShare)
	if err != nil {
		return nil, wrapUserError("liquidity pool distribute margin calldata", err)
	}
	return data, nil
}

// RequestPayoutLiquidityCalldata returns ABI-encoded calldata for LiquidityPool.requestPayoutLiquidity; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) RequestPayoutLiquidityCalldata(matchID [32]byte, amount *big.Int) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	if amount == nil {
		return nil, wrapUserError("liquidity pool request payout liquidity calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.RequestPayoutLiquidityCalldata(matchID, amount)
	if err != nil {
		return nil, wrapUserError("liquidity pool request payout liquidity calldata", err)
	}
	return data, nil
}

// ReleasePayoutReserveCalldata returns ABI-encoded calldata for LiquidityPool.releasePayoutReserve; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *LiquidityPool) ReleasePayoutReserveCalldata(matchID [32]byte) ([]byte, error) {
	if err := ensureLiquidityPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.ReleasePayoutReserveCalldata(matchID)
	if err != nil {
		return nil, wrapUserError("liquidity pool release payout reserve calldata", err)
	}
	return data, nil
}
