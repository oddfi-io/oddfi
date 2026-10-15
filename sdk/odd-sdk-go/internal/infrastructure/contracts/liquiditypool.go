package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/liquiditypool"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// LiquidityPoolAdapter reads liquidity pool state through generated bindings.
type LiquidityPoolAdapter struct {
	caller     *liquiditypool.LiquidityPoolCaller
	transactor *liquiditypool.LiquidityPoolTransactor
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

// NewLiquidityPoolAdapter binds a LiquidityPool adapter to proxyAddress.
func NewLiquidityPoolAdapter(caller bind.ContractCaller, transactor bind.ContractTransactor, proxyAddress common.Address) (*LiquidityPoolAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	pool, err := liquiditypool.NewLiquidityPoolCaller(proxyAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind liquidity pool caller: %w", err)
	}
	var poolTransactor *liquiditypool.LiquidityPoolTransactor
	if transactor != nil {
		poolTransactor, err = liquiditypool.NewLiquidityPoolTransactor(proxyAddress, transactor)
		if err != nil {
			return nil, fmt.Errorf("bind liquidity pool transactor: %w", err)
		}
	}
	return &LiquidityPoolAdapter{caller: pool, transactor: poolTransactor}, nil
}

// OddToken reads the configured ODD token address.
func (a *LiquidityPoolAdapter) OddToken(ctx context.Context) (common.Address, error) {
	return a.caller.OddToken(callOpts(ctx))
}

// BettingPool reads the configured betting pool address.
func (a *LiquidityPoolAdapter) BettingPool(ctx context.Context) (common.Address, error) {
	return a.caller.BettingPool(callOpts(ctx))
}

// Paused reads whether liquidity operations are paused.
func (a *LiquidityPoolAdapter) Paused(ctx context.Context) (bool, error) {
	return a.caller.Paused(callOpts(ctx))
}

// DefaultAdminRole reads the OpenZeppelin default admin role id.
func (a *LiquidityPoolAdapter) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	return a.caller.DEFAULTADMINROLE(callOpts(ctx))
}

// UpgradeInterfaceVersion reads the UUPS interface version string.
func (a *LiquidityPoolAdapter) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	return a.caller.UPGRADEINTERFACEVERSION(callOpts(ctx))
}

// ProxiableUUID reads the UUPS implementation slot UUID.
func (a *LiquidityPoolAdapter) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	return a.caller.ProxiableUUID(callOpts(ctx))
}

// SupportsInterface reads ERC165 support for interfaceID.
func (a *LiquidityPoolAdapter) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	return a.caller.SupportsInterface(callOpts(ctx), interfaceID)
}

// MinDeposit reads the minimum liquidity deposit amount.
func (a *LiquidityPoolAdapter) MinDeposit(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.MinDeposit(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// EpochStart reads the current epoch start timestamp.
func (a *LiquidityPoolAdapter) EpochStart(ctx context.Context) (uint64, error) {
	return a.caller.EpochStart(callOpts(ctx))
}

// RequestableLiquidity reads currently requestable liquidity.
func (a *LiquidityPoolAdapter) RequestableLiquidity(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.RequestableLiquidity(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// GetRequestableLiquidity reads currently requestable liquidity through the explicit getter.
func (a *LiquidityPoolAdapter) GetRequestableLiquidity(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.GetRequestableLiquidity(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// GlobalRequestableLiquidity reads currently requestable global liquidity.
func (a *LiquidityPoolAdapter) GlobalRequestableLiquidity(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.GetGlobalRequestableLiquidity(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// GlobalRequestableLiquidityInitialized reads whether global requestable liquidity was initialized.
func (a *LiquidityPoolAdapter) GlobalRequestableLiquidityInitialized(ctx context.Context) (bool, error) {
	return a.caller.GlobalRequestableLiquidityInitialized(callOpts(ctx))
}

// TotalActiveDeposited reads total active deposited liquidity.
func (a *LiquidityPoolAdapter) TotalActiveDeposited(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalActiveDeposited(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// TotalOutstandingPayoutReserved reads outstanding payout reserve.
func (a *LiquidityPoolAdapter) TotalOutstandingPayoutReserved(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalOutstandingPayoutReserved(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// PayoutLiquidityWindow reads the reserved and paid payout liquidity for a match.
func (a *LiquidityPoolAdapter) PayoutLiquidityWindow(ctx context.Context, matchID [32]byte) (reservedAmount *big.Int, paidOutAmount *big.Int, settledAt *big.Int, err error) {
	value, err := a.caller.GetPayoutLiquidityWindow(callOpts(ctx), matchID)
	if err != nil {
		return nil, nil, nil, err
	}
	return new(big.Int).Set(value.ReservedAmount), new(big.Int).Set(value.PaidOutAmount), new(big.Int).Set(value.SettledAt), nil
}

// GetPoolWeights reads active Global and Match weights.
func (a *LiquidityPoolAdapter) GetPoolWeights(ctx context.Context, matchID [32]byte) (LiquidityPoolWeights, error) {
	value, err := a.caller.GetPoolWeights(callOpts(ctx), matchID)
	if err != nil {
		return LiquidityPoolWeights{}, err
	}
	return LiquidityPoolWeights{
		GlobalWeight: cloneBigInt(value.GlobalWeight),
		MatchWeight:  cloneBigInt(value.MatchWeight),
	}, nil
}

// Pool reads raw pool accounting state.
func (a *LiquidityPoolAdapter) Pool(ctx context.Context, poolID *big.Int) (LiquidityPoolInfo, error) {
	value, err := a.caller.Pools(callOpts(ctx), poolID)
	if err != nil {
		return LiquidityPoolInfo{}, err
	}
	return LiquidityPoolInfo{
		PoolType:         value.PoolType,
		MatchID:          value.MatchId,
		Exists:           value.Exists,
		DepositOpen:      value.DepositOpen,
		DepositCloseAt:   value.DepositCloseAt,
		UnlockAt:         value.UnlockAt,
		TotalDeposited:   cloneBigInt(value.TotalDeposited),
		TotalWeight:      cloneBigInt(value.TotalWeight),
		RewardPerWeight:  cloneBigInt(value.RewardPerWeight),
		LossPerPrincipal: cloneBigInt(value.LossPerPrincipal),
	}, nil
}

// Position reads raw LP position state.
func (a *LiquidityPoolAdapter) Position(ctx context.Context, positionID *big.Int) (LiquidityPosition, error) {
	value, err := a.caller.Positions(callOpts(ctx), positionID)
	if err != nil {
		return LiquidityPosition{}, err
	}
	return LiquidityPosition{
		Owner:                  value.Owner,
		PoolID:                 cloneBigInt(value.PoolId),
		Principal:              cloneBigInt(value.Principal),
		Weight:                 cloneBigInt(value.Weight),
		UnlockAt:               value.UnlockAt,
		RewardDebt:             cloneBigInt(value.RewardDebt),
		LossDebt:               cloneBigInt(value.LossDebt),
		UnbondingEpoch:         value.UnbondingEpoch,
		FrozenRewardPerWeight:  cloneBigInt(value.FrozenRewardPerWeight),
		FrozenLossPerPrincipal: cloneBigInt(value.FrozenLossPerPrincipal),
		PlanID:                 value.PlanId,
		State:                  value.State,
	}, nil
}

// PreviewWithdraw reads the withdrawal amount, net PnL, and effective state for a liquidity position.
func (a *LiquidityPoolAdapter) PreviewWithdraw(ctx context.Context, positionID *big.Int) (withdrawAmount *big.Int, netPnL *big.Int, effectiveState uint8, err error) {
	value, err := a.caller.PreviewWithdraw(callOpts(ctx), positionID)
	if err != nil {
		return nil, nil, 0, err
	}
	return new(big.Int).Set(value.WithdrawAmount), new(big.Int).Set(value.NetPnl), value.EffectiveState, nil
}

// UnbondEpochs reads the number of unbonding epochs.
func (a *LiquidityPoolAdapter) UnbondEpochs(ctx context.Context) (uint32, error) {
	return a.caller.UnbondEpochs(callOpts(ctx))
}

// HasRole returns true when account holds role on LiquidityPool.
func (a *LiquidityPoolAdapter) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	return a.caller.HasRole(callOpts(ctx), role, account)
}

// GetRoleAdmin reads the admin role for role on LiquidityPool.
func (a *LiquidityPoolAdapter) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	return a.caller.GetRoleAdmin(callOpts(ctx), role)
}

// DepositGlobal submits a global liquidity deposit transaction.
func (a *LiquidityPoolAdapter) DepositGlobal(opts *bind.TransactOpts, amount *big.Int, planID uint16) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.DepositGlobal(opts, amount, planID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool deposit global: %w", err)
	}
	return tx, nil
}

// DepositMatch submits a match pool liquidity deposit transaction.
func (a *LiquidityPoolAdapter) DepositMatch(opts *bind.TransactOpts, matchID [32]byte, amount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.DepositMatch(opts, matchID, amount)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool deposit match: %w", err)
	}
	return tx, nil
}

// OpenMatchPool opens a match-specific liquidity pool.
func (a *LiquidityPoolAdapter) OpenMatchPool(opts *bind.TransactOpts, matchID [32]byte, matchStartTime uint64, matchEndTime uint64) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.OpenMatchPool(opts, matchID, matchStartTime, matchEndTime)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool open match pool: %w", err)
	}
	return tx, nil
}

// CloseMatchPoolDeposit closes deposits for a match pool.
func (a *LiquidityPoolAdapter) CloseMatchPoolDeposit(opts *bind.TransactOpts, matchID [32]byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.CloseMatchPoolDeposit(opts, matchID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool close match pool deposit: %w", err)
	}
	return tx, nil
}

// RequestUnbond submits a request to unbond a liquidity position.
func (a *LiquidityPoolAdapter) RequestUnbond(opts *bind.TransactOpts, positionID *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RequestUnbond(opts, positionID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool request unbond: %w", err)
	}
	return tx, nil
}

// Withdraw submits a withdrawal transaction for an unbonded position.
func (a *LiquidityPoolAdapter) Withdraw(opts *bind.TransactOpts, positionID *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Withdraw(opts, positionID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool withdraw: %w", err)
	}
	return tx, nil
}

// SetBettingPool updates the BettingPool address.
func (a *LiquidityPoolAdapter) SetBettingPool(opts *bind.TransactOpts, newBettingPool common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetBettingPool(opts, newBettingPool)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool set betting pool: %w", err)
	}
	return tx, nil
}

// SetMinDeposit updates the minimum LP deposit.
func (a *LiquidityPoolAdapter) SetMinDeposit(opts *bind.TransactOpts, newMinDeposit *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetMinDeposit(opts, newMinDeposit)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool set min deposit: %w", err)
	}
	return tx, nil
}

// SetUnbondEpochs updates unbond waiting epochs.
func (a *LiquidityPoolAdapter) SetUnbondEpochs(opts *bind.TransactOpts, newUnbondEpochs uint32) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetUnbondEpochs(opts, newUnbondEpochs)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool set unbond epochs: %w", err)
	}
	return tx, nil
}

// GrantRole grants a role to an account.
func (a *LiquidityPoolAdapter) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.GrantRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool grant role: %w", err)
	}
	return tx, nil
}

// RevokeRole revokes a role from an account.
func (a *LiquidityPoolAdapter) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RevokeRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool revoke role: %w", err)
	}
	return tx, nil
}

// RenounceRole renounces a role held by the caller.
func (a *LiquidityPoolAdapter) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool renounce role: %w", err)
	}
	return tx, nil
}

// Pause pauses liquidity operations.
func (a *LiquidityPoolAdapter) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Pause(opts)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool pause: %w", err)
	}
	return tx, nil
}

// Unpause unpauses liquidity operations.
func (a *LiquidityPoolAdapter) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Unpause(opts)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool unpause: %w", err)
	}
	return tx, nil
}

// UpgradeToAndCall upgrades the LiquidityPool proxy and optionally calls initialization data.
func (a *LiquidityPoolAdapter) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool upgrade to and call: %w", err)
	}
	return tx, nil
}

// InitializeGlobalRequestableLiquidity initializes the global requestable liquidity floor.
func (a *LiquidityPoolAdapter) InitializeGlobalRequestableLiquidity(opts *bind.TransactOpts, value *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.InitializeGlobalRequestableLiquidity(opts, value)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool initialize global requestable liquidity: %w", err)
	}
	return tx, nil
}

// DistributeGlobalLoss distributes global LP loss for a risk id.
func (a *LiquidityPoolAdapter) DistributeGlobalLoss(opts *bind.TransactOpts, riskID [32]byte, netLoss *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.DistributeGlobalLoss(opts, riskID, netLoss)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool distribute global loss: %w", err)
	}
	return tx, nil
}

// DistributeGlobalMargin distributes global LP margin for a risk id.
func (a *LiquidityPoolAdapter) DistributeGlobalMargin(opts *bind.TransactOpts, riskID [32]byte, lpMarginShare *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.DistributeGlobalMargin(opts, riskID, lpMarginShare)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool distribute global margin: %w", err)
	}
	return tx, nil
}

// DistributeLoss distributes match LP loss for a match.
func (a *LiquidityPoolAdapter) DistributeLoss(opts *bind.TransactOpts, matchID [32]byte, netLoss *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.DistributeLoss(opts, matchID, netLoss)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool distribute loss: %w", err)
	}
	return tx, nil
}

// DistributeMargin distributes match LP margin for a match.
func (a *LiquidityPoolAdapter) DistributeMargin(opts *bind.TransactOpts, matchID [32]byte, lpMarginShare *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.DistributeMargin(opts, matchID, lpMarginShare)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool distribute margin: %w", err)
	}
	return tx, nil
}

// RequestPayoutLiquidity transfers reserved payout liquidity to BettingPool.
func (a *LiquidityPoolAdapter) RequestPayoutLiquidity(opts *bind.TransactOpts, matchID [32]byte, amount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RequestPayoutLiquidity(opts, matchID, amount)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool request payout liquidity: %w", err)
	}
	return tx, nil
}

// ReleasePayoutReserve releases reserved payout liquidity for a match.
func (a *LiquidityPoolAdapter) ReleasePayoutReserve(opts *bind.TransactOpts, matchID [32]byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ReleasePayoutReserve(opts, matchID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool release payout reserve: %w", err)
	}
	return tx, nil
}

// NextLpPositionID reads the next LP position id.
func (a *LiquidityPoolAdapter) NextLpPositionID(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.NextLpPositionId(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// GetPositionState reads the display-friendly state of a position.
func (a *LiquidityPoolAdapter) GetPositionState(ctx context.Context, positionID *big.Int) (uint8, error) {
	return a.caller.GetPositionState(callOpts(ctx), positionID)
}

var liquidityPoolABI = mustLoadLiquidityPoolABI()

func mustLoadLiquidityPoolABI() abi.ABI {
	parsed, err := liquiditypool.LiquidityPoolMetaData.GetAbi()
	if err != nil {
		panic("bind liquidity pool abi: " + err.Error())
	}
	if parsed == nil {
		panic("bind liquidity pool abi: nil abi")
	}
	return *parsed
}

// DepositGlobalCalldata returns ABI-encoded calldata for LiquidityPool.depositGlobal(uint256,uint16).
func (a *LiquidityPoolAdapter) DepositGlobalCalldata(amount *big.Int, planID uint16) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("depositGlobal", amount, planID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool deposit global abi pack: %w", err)
	}
	return data, nil
}

// DepositMatchCalldata returns ABI-encoded calldata for LiquidityPool.depositMatch(bytes32,uint256).
func (a *LiquidityPoolAdapter) DepositMatchCalldata(matchID [32]byte, amount *big.Int) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("depositMatch", matchID, amount)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool deposit match abi pack: %w", err)
	}
	return data, nil
}

// OpenMatchPoolCalldata returns ABI-encoded calldata for LiquidityPool.openMatchPool(bytes32,uint64,uint64).
func (a *LiquidityPoolAdapter) OpenMatchPoolCalldata(matchID [32]byte, matchStartTime uint64, matchEndTime uint64) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("openMatchPool", matchID, matchStartTime, matchEndTime)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool open match pool abi pack: %w", err)
	}
	return data, nil
}

// CloseMatchPoolDepositCalldata returns ABI-encoded calldata for LiquidityPool.closeMatchPoolDeposit(bytes32).
func (a *LiquidityPoolAdapter) CloseMatchPoolDepositCalldata(matchID [32]byte) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("closeMatchPoolDeposit", matchID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool close match pool deposit abi pack: %w", err)
	}
	return data, nil
}

// RequestUnbondCalldata returns ABI-encoded calldata for LiquidityPool.requestUnbond(uint256).
func (a *LiquidityPoolAdapter) RequestUnbondCalldata(positionID *big.Int) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("requestUnbond", positionID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool request unbond abi pack: %w", err)
	}
	return data, nil
}

// WithdrawCalldata returns ABI-encoded calldata for LiquidityPool.withdraw(uint256).
func (a *LiquidityPoolAdapter) WithdrawCalldata(positionID *big.Int) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("withdraw", positionID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool withdraw abi pack: %w", err)
	}
	return data, nil
}

// InitializeGlobalRequestableLiquidityCalldata returns ABI-encoded calldata for LiquidityPool.initializeGlobalRequestableLiquidity(uint256).
func (a *LiquidityPoolAdapter) InitializeGlobalRequestableLiquidityCalldata(value *big.Int) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("initializeGlobalRequestableLiquidity", value)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool initialize global requestable liquidity abi pack: %w", err)
	}
	return data, nil
}

// DistributeGlobalLossCalldata returns ABI-encoded calldata for LiquidityPool.distributeGlobalLoss(bytes32,uint256).
func (a *LiquidityPoolAdapter) DistributeGlobalLossCalldata(riskID [32]byte, netLoss *big.Int) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("distributeGlobalLoss", riskID, netLoss)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool distribute global loss abi pack: %w", err)
	}
	return data, nil
}

// DistributeGlobalMarginCalldata returns ABI-encoded calldata for LiquidityPool.distributeGlobalMargin(bytes32,uint256).
func (a *LiquidityPoolAdapter) DistributeGlobalMarginCalldata(riskID [32]byte, lpMarginShare *big.Int) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("distributeGlobalMargin", riskID, lpMarginShare)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool distribute global margin abi pack: %w", err)
	}
	return data, nil
}

// DistributeLossCalldata returns ABI-encoded calldata for LiquidityPool.distributeLoss(bytes32,uint256).
func (a *LiquidityPoolAdapter) DistributeLossCalldata(matchID [32]byte, netLoss *big.Int) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("distributeLoss", matchID, netLoss)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool distribute loss abi pack: %w", err)
	}
	return data, nil
}

// DistributeMarginCalldata returns ABI-encoded calldata for LiquidityPool.distributeMargin(bytes32,uint256).
func (a *LiquidityPoolAdapter) DistributeMarginCalldata(matchID [32]byte, lpMarginShare *big.Int) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("distributeMargin", matchID, lpMarginShare)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool distribute margin abi pack: %w", err)
	}
	return data, nil
}

// RequestPayoutLiquidityCalldata returns ABI-encoded calldata for LiquidityPool.requestPayoutLiquidity(bytes32,uint256).
func (a *LiquidityPoolAdapter) RequestPayoutLiquidityCalldata(matchID [32]byte, amount *big.Int) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("requestPayoutLiquidity", matchID, amount)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool request payout liquidity abi pack: %w", err)
	}
	return data, nil
}

// ReleasePayoutReserveCalldata returns ABI-encoded calldata for LiquidityPool.releasePayoutReserve(bytes32).
func (a *LiquidityPoolAdapter) ReleasePayoutReserveCalldata(matchID [32]byte) ([]byte, error) {
	data, err := liquidityPoolABI.Pack("releasePayoutReserve", matchID)
	if err != nil {
		return nil, fmt.Errorf("liquidity pool release payout reserve abi pack: %w", err)
	}
	return data, nil
}
