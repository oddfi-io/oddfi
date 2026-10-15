package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/oddtoken"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// ODDTokenSourceBreakdown is the ODDToken per-source balance split.
type ODDTokenSourceBreakdown struct {
	SaleLocked     *big.Int
	RewardLocked   *big.Int
	BusinessLocked *big.Int
	Transferable   *big.Int
}

// ODDTokenFixedSources is the configured fixed source contract set.
type ODDTokenFixedSources struct {
	TierSale            common.Address
	HouseVault          common.Address
	DexLaunchController common.Address
	EcosystemRewards    common.Address
	OpsTreasury         common.Address
}

// ODDTokenBusinessSnapshot is one business source ledger snapshot.
type ODDTokenBusinessSnapshot struct {
	User              common.Address
	BusinessContract  common.Address
	BusinessType      uint16
	RawID             [32]byte
	CreatedAt         uint64
	FinalizedAt       uint64
	BusinessIn        *big.Int
	TotalBusinessOut  *big.Int
	PrincipalReturned *big.Int
	ProfitRecognized  *big.Int
	LossRecognized    *big.Int
	Finalized         bool
	SourceIn          ODDTokenSourceBreakdown
}

// ODDTokenUnlockPreview is a sale or reward unlock preview.
type ODDTokenUnlockPreview struct {
	UnlockedAmount *big.Int
	LockedAmount   *big.Int
}

func toODDTokenSourceBreakdown(value oddtoken.IODDTokenBusinessSourceBreakdown) ODDTokenSourceBreakdown {
	return ODDTokenSourceBreakdown{SaleLocked: cloneBigInt(value.SaleLocked), RewardLocked: cloneBigInt(value.RewardLocked), BusinessLocked: cloneBigInt(value.BusinessLocked), Transferable: cloneBigInt(value.Transferable)}
}

func toODDTokenFixedSources(value oddtoken.IODDTokenBusinessFixedSources) ODDTokenFixedSources {
	return ODDTokenFixedSources{TierSale: value.TierSale, HouseVault: value.HouseVault, DexLaunchController: value.DexLaunchController, EcosystemRewards: value.EcosystemRewards, OpsTreasury: value.OpsTreasury}
}

func toBindingODDTokenFixedSources(value ODDTokenFixedSources) oddtoken.IODDTokenBusinessFixedSources {
	return oddtoken.IODDTokenBusinessFixedSources{TierSale: value.TierSale, HouseVault: value.HouseVault, DexLaunchController: value.DexLaunchController, EcosystemRewards: value.EcosystemRewards, OpsTreasury: value.OpsTreasury}
}

func toODDTokenBusinessSnapshot(value oddtoken.IODDTokenBusinessBusinessSnapshot) ODDTokenBusinessSnapshot {
	return ODDTokenBusinessSnapshot{User: value.User, BusinessContract: value.BusinessContract, BusinessType: value.BusinessType, RawID: value.RawId, CreatedAt: value.CreatedAt, FinalizedAt: value.FinalizedAt, BusinessIn: cloneBigInt(value.BusinessIn), TotalBusinessOut: cloneBigInt(value.TotalBusinessOut), PrincipalReturned: cloneBigInt(value.PrincipalReturned), ProfitRecognized: cloneBigInt(value.ProfitRecognized), LossRecognized: cloneBigInt(value.LossRecognized), Finalized: value.Finalized, SourceIn: toODDTokenSourceBreakdown(value.SourceIn)}
}

func toODDTokenUnlockPreview(value struct {
	UnlockedAmount *big.Int
	LockedAmount   *big.Int
}) ODDTokenUnlockPreview {
	return ODDTokenUnlockPreview{UnlockedAmount: cloneBigInt(value.UnlockedAmount), LockedAmount: cloneBigInt(value.LockedAmount)}
}

// BusinessLossOf reads ODDToken business loss.
func (r *ODDTokenAdapter) BusinessLossOf(ctx context.Context, businessID [32]byte) (*big.Int, error) {
	value, err := r.caller.BusinessLossOf(callOpts(ctx), businessID)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// BusinessProfitSwapAllowance reads ODDToken business profit swap allowance.
func (r *ODDTokenAdapter) BusinessProfitSwapAllowance(ctx context.Context, account common.Address, routerOrSpender common.Address, expectedPoolOrTarget common.Address) (*big.Int, error) {
	value, err := r.caller.BusinessProfitSwapAllowance(callOpts(ctx), account, routerOrSpender, expectedPoolOrTarget)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// BusinessSnapshotOf reads ODDToken business snapshot.
func (r *ODDTokenAdapter) BusinessSnapshotOf(ctx context.Context, businessID [32]byte) (ODDTokenBusinessSnapshot, error) {
	value, err := r.caller.BusinessSnapshotOf(callOpts(ctx), businessID)
	if err != nil {
		return ODDTokenBusinessSnapshot{}, err
	}
	return toODDTokenBusinessSnapshot(value), nil
}

// DexLaunchPool reads ODDToken DEX launch pool.
func (r *ODDTokenAdapter) DexLaunchPool(ctx context.Context) (common.Address, error) {
	value, err := r.caller.DexLaunchPool(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// DexLaunchSpender reads ODDToken DEX launch spender.
func (r *ODDTokenAdapter) DexLaunchSpender(ctx context.Context) (common.Address, error) {
	value, err := r.caller.DexLaunchSpender(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// DexLiquidityTransferableAllocation reads ODDToken DEX liquidity transferable allocation.
func (r *ODDTokenAdapter) DexLiquidityTransferableAllocation(ctx context.Context) (*big.Int, error) {
	value, err := r.caller.DexLiquidityTransferableAllocation(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// DexRestrictedTarget reads ODDToken DEX restricted target flag.
func (r *ODDTokenAdapter) DexRestrictedTarget(ctx context.Context, account common.Address) (bool, error) {
	value, err := r.caller.DexRestrictedTarget(callOpts(ctx), account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// FixedSources reads ODDToken fixed source contracts.
func (r *ODDTokenAdapter) FixedSources(ctx context.Context) (ODDTokenFixedSources, error) {
	value, err := r.caller.FixedSources(callOpts(ctx))
	if err != nil {
		return ODDTokenFixedSources{}, err
	}
	return toODDTokenFixedSources(value), nil
}

// FixedSourcesConfigured reads ODDToken fixed source configuration flag.
func (r *ODDTokenAdapter) FixedSourcesConfigured(ctx context.Context) (bool, error) {
	value, err := r.caller.FixedSourcesConfigured(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// InitialSupplyAllocated reads ODDToken initial supply allocation flag.
func (r *ODDTokenAdapter) InitialSupplyAllocated(ctx context.Context) (bool, error) {
	value, err := r.caller.InitialSupplyAllocated(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// IsDexRestrictedTarget reads ODDToken DEX restricted target status.
func (r *ODDTokenAdapter) IsDexRestrictedTarget(ctx context.Context, account common.Address) (bool, error) {
	value, err := r.caller.IsDexRestrictedTarget(callOpts(ctx), account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// IsTreasurySink reads ODDToken treasury sink status.
func (r *ODDTokenAdapter) IsTreasurySink(ctx context.Context, account common.Address) (bool, error) {
	value, err := r.caller.IsTreasurySink(callOpts(ctx), account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// IsWhitelist reads ODDToken whitelist status.
func (r *ODDTokenAdapter) IsWhitelist(ctx context.Context, account common.Address) (bool, error) {
	value, err := r.caller.IsWhitelist(callOpts(ctx), account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// LockedBalanceOf reads ODDToken locked balance.
func (r *ODDTokenAdapter) LockedBalanceOf(ctx context.Context, account common.Address) (*big.Int, error) {
	value, err := r.caller.LockedBalanceOf(callOpts(ctx), account)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// PoolLaunchTime reads ODDToken pool launch time.
func (r *ODDTokenAdapter) PoolLaunchTime(ctx context.Context) (uint64, error) {
	value, err := r.caller.PoolLaunchTime(callOpts(ctx))
	if err != nil {
		return 0, err
	}
	return value, nil
}

// PreviewRewardUnlock reads ODDToken reward unlock preview.
func (r *ODDTokenAdapter) PreviewRewardUnlock(ctx context.Context, account common.Address) (ODDTokenUnlockPreview, error) {
	value, err := r.caller.PreviewRewardUnlock(callOpts(ctx), account)
	if err != nil {
		return ODDTokenUnlockPreview{}, err
	}
	return toODDTokenUnlockPreview(value), nil
}

// PreviewSaleUnlock reads ODDToken sale unlock preview.
func (r *ODDTokenAdapter) PreviewSaleUnlock(ctx context.Context, account common.Address) (ODDTokenUnlockPreview, error) {
	value, err := r.caller.PreviewSaleUnlock(callOpts(ctx), account)
	if err != nil {
		return ODDTokenUnlockPreview{}, err
	}
	return toODDTokenUnlockPreview(value), nil
}

// SourceBalanceOf reads ODDToken source balance.
func (r *ODDTokenAdapter) SourceBalanceOf(ctx context.Context, account common.Address) (ODDTokenSourceBreakdown, error) {
	value, err := r.caller.SourceBalanceOf(callOpts(ctx), account)
	if err != nil {
		return ODDTokenSourceBreakdown{}, err
	}
	return toODDTokenSourceBreakdown(value), nil
}

// TransferableBalanceOf reads ODDToken transferable balance.
func (r *ODDTokenAdapter) TransferableBalanceOf(ctx context.Context, account common.Address) (*big.Int, error) {
	value, err := r.caller.TransferableBalanceOf(callOpts(ctx), account)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TreasurySink reads ODDToken treasury sink mapping flag.
func (r *ODDTokenAdapter) TreasurySink(ctx context.Context, account common.Address) (bool, error) {
	value, err := r.caller.TreasurySink(callOpts(ctx), account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// Whitelist reads ODDToken whitelist mapping flag.
func (r *ODDTokenAdapter) Whitelist(ctx context.Context, account common.Address) (bool, error) {
	value, err := r.caller.Whitelist(callOpts(ctx), account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// Initialize submits the ODDToken initialize transaction.
func (r *ODDTokenAdapter) Initialize(opts *bind.TransactOpts, adminTimelock common.Address, pauser common.Address) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.Initialize(opts, adminTimelock, pauser)
	if err != nil {
		return nil, fmt.Errorf("odd token initialize: %w", err)
	}
	return tx, nil
}

// AllocateInitialSupply submits the ODDToken allocate initial supply transaction.
func (r *ODDTokenAdapter) AllocateInitialSupply(opts *bind.TransactOpts) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.AllocateInitialSupply(opts)
	if err != nil {
		return nil, fmt.Errorf("odd token allocate initial supply: %w", err)
	}
	return tx, nil
}

// Burn submits the ODDToken burn transaction.
func (r *ODDTokenAdapter) Burn(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.Burn(opts, amount)
	if err != nil {
		return nil, fmt.Errorf("odd token burn: %w", err)
	}
	return tx, nil
}

// ClearBusinessProfitSwapAllowance submits the ODDToken clear business profit swap allowance transaction.
func (r *ODDTokenAdapter) ClearBusinessProfitSwapAllowance(opts *bind.TransactOpts, routerOrSpender common.Address, expectedPoolOrTarget common.Address) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.ClearBusinessProfitSwapAllowance(opts, routerOrSpender, expectedPoolOrTarget)
	if err != nil {
		return nil, fmt.Errorf("odd token clear business profit swap allowance: %w", err)
	}
	return tx, nil
}

// ConsumeBusinessInflow submits the ODDToken consume business inflow transaction.
func (r *ODDTokenAdapter) ConsumeBusinessInflow(opts *bind.TransactOpts, user common.Address, businessType uint16, rawID [32]byte, amount *big.Int) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.ConsumeBusinessInflow(opts, user, businessType, rawID, amount)
	if err != nil {
		return nil, fmt.Errorf("odd token consume business inflow: %w", err)
	}
	return tx, nil
}

// DistributeRewardClaim submits the ODDToken distribute reward claim transaction.
func (r *ODDTokenAdapter) DistributeRewardClaim(opts *bind.TransactOpts, user common.Address, amount *big.Int) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.DistributeRewardClaim(opts, user, amount)
	if err != nil {
		return nil, fmt.Errorf("odd token distribute reward claim: %w", err)
	}
	return tx, nil
}

// DistributeSalePurchase submits the ODDToken distribute sale purchase transaction.
func (r *ODDTokenAdapter) DistributeSalePurchase(opts *bind.TransactOpts, user common.Address, amount *big.Int) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.DistributeSalePurchase(opts, user, amount)
	if err != nil {
		return nil, fmt.Errorf("odd token distribute sale purchase: %w", err)
	}
	return tx, nil
}

// MarkDexPoolLaunched submits the ODDToken mark DEX pool launched transaction.
func (r *ODDTokenAdapter) MarkDexPoolLaunched(opts *bind.TransactOpts, launchTime uint64) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.MarkDexPoolLaunched(opts, launchTime)
	if err != nil {
		return nil, fmt.Errorf("odd token mark dex pool launched: %w", err)
	}
	return tx, nil
}

// ReclaimSalePurchase submits the ODDToken reclaim sale purchase transaction.
func (r *ODDTokenAdapter) ReclaimSalePurchase(opts *bind.TransactOpts, user common.Address, amount *big.Int) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.ReclaimSalePurchase(opts, user, amount)
	if err != nil {
		return nil, fmt.Errorf("odd token reclaim sale purchase: %w", err)
	}
	return tx, nil
}

// RegisterBusinessOutcomeDelta submits the ODDToken register business outcome delta transaction.
func (r *ODDTokenAdapter) RegisterBusinessOutcomeDelta(opts *bind.TransactOpts, user common.Address, businessID [32]byte, businessOutDelta *big.Int, finalized bool) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.RegisterBusinessOutcomeDelta(opts, user, businessID, businessOutDelta, finalized)
	if err != nil {
		return nil, fmt.Errorf("odd token register business outcome delta: %w", err)
	}
	return tx, nil
}

// RegisterBusinessProfitAndTransfer submits the ODDToken register business profit and transfer transaction.
func (r *ODDTokenAdapter) RegisterBusinessProfitAndTransfer(opts *bind.TransactOpts, user common.Address, businessType uint16, rawID [32]byte, amount *big.Int) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.RegisterBusinessProfitAndTransfer(opts, user, businessType, rawID, amount)
	if err != nil {
		return nil, fmt.Errorf("odd token register business profit and transfer: %w", err)
	}
	return tx, nil
}

// RegisterBusinessProfitForDexSwap submits the ODDToken register business profit for DEX swap transaction.
func (r *ODDTokenAdapter) RegisterBusinessProfitForDexSwap(opts *bind.TransactOpts, user common.Address, businessType uint16, rawID [32]byte, amount *big.Int, routerOrSpender common.Address, expectedPoolOrTarget common.Address) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.RegisterBusinessProfitForDexSwap(opts, user, businessType, rawID, amount, routerOrSpender, expectedPoolOrTarget)
	if err != nil {
		return nil, fmt.Errorf("odd token register business profit for dex swap: %w", err)
	}
	return tx, nil
}

// SetDexLaunchTransferTarget submits the ODDToken set DEX launch transfer target transaction.
func (r *ODDTokenAdapter) SetDexLaunchTransferTarget(opts *bind.TransactOpts, spender common.Address, pool common.Address) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.SetDexLaunchTransferTarget(opts, spender, pool)
	if err != nil {
		return nil, fmt.Errorf("odd token set dex launch transfer target: %w", err)
	}
	return tx, nil
}

// SetDexRestrictedTarget submits the ODDToken set DEX restricted target transaction.
func (r *ODDTokenAdapter) SetDexRestrictedTarget(opts *bind.TransactOpts, account common.Address, restricted bool) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.SetDexRestrictedTarget(opts, account, restricted)
	if err != nil {
		return nil, fmt.Errorf("odd token set dex restricted target: %w", err)
	}
	return tx, nil
}

// SetFixedSourceContracts submits the ODDToken set fixed source contracts transaction.
func (r *ODDTokenAdapter) SetFixedSourceContracts(opts *bind.TransactOpts, sources ODDTokenFixedSources) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.SetFixedSourceContracts(opts, toBindingODDTokenFixedSources(sources))
	if err != nil {
		return nil, fmt.Errorf("odd token set fixed source contracts: %w", err)
	}
	return tx, nil
}

// SetTreasurySink submits the ODDToken set treasury sink transaction.
func (r *ODDTokenAdapter) SetTreasurySink(opts *bind.TransactOpts, account common.Address, allowed bool) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.SetTreasurySink(opts, account, allowed)
	if err != nil {
		return nil, fmt.Errorf("odd token set treasury sink: %w", err)
	}
	return tx, nil
}

// SetWhitelist submits the ODDToken set whitelist transaction.
func (r *ODDTokenAdapter) SetWhitelist(opts *bind.TransactOpts, account common.Address, allowed bool) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.SetWhitelist(opts, account, allowed)
	if err != nil {
		return nil, fmt.Errorf("odd token set whitelist: %w", err)
	}
	return tx, nil
}
