package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
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

func toPublicODDTokenSourceBreakdown(value contracts.ODDTokenSourceBreakdown) ODDTokenSourceBreakdown {
	return ODDTokenSourceBreakdown{SaleLocked: value.SaleLocked, RewardLocked: value.RewardLocked, BusinessLocked: value.BusinessLocked, Transferable: value.Transferable}
}

func toPublicODDTokenFixedSources(value contracts.ODDTokenFixedSources) ODDTokenFixedSources {
	return ODDTokenFixedSources{TierSale: value.TierSale, HouseVault: value.HouseVault, DexLaunchController: value.DexLaunchController, EcosystemRewards: value.EcosystemRewards, OpsTreasury: value.OpsTreasury}
}

func toContractsODDTokenFixedSources(value ODDTokenFixedSources) contracts.ODDTokenFixedSources {
	return contracts.ODDTokenFixedSources{TierSale: value.TierSale, HouseVault: value.HouseVault, DexLaunchController: value.DexLaunchController, EcosystemRewards: value.EcosystemRewards, OpsTreasury: value.OpsTreasury}
}

func toPublicODDTokenBusinessSnapshot(value contracts.ODDTokenBusinessSnapshot) ODDTokenBusinessSnapshot {
	return ODDTokenBusinessSnapshot{User: value.User, BusinessContract: value.BusinessContract, BusinessType: value.BusinessType, RawID: value.RawID, CreatedAt: value.CreatedAt, FinalizedAt: value.FinalizedAt, BusinessIn: value.BusinessIn, TotalBusinessOut: value.TotalBusinessOut, PrincipalReturned: value.PrincipalReturned, ProfitRecognized: value.ProfitRecognized, LossRecognized: value.LossRecognized, Finalized: value.Finalized, SourceIn: toPublicODDTokenSourceBreakdown(value.SourceIn)}
}

func toPublicODDTokenUnlockPreview(value contracts.ODDTokenUnlockPreview) ODDTokenUnlockPreview {
	return ODDTokenUnlockPreview{UnlockedAmount: value.UnlockedAmount, LockedAmount: value.LockedAmount}
}

// BusinessLossOf reads ODDToken business loss.
func (t *ODDToken) BusinessLossOf(ctx context.Context, businessID [32]byte) (*big.Int, error) {
	if err := checkContext(ctx, "odd token business loss of"); err != nil {
		return nil, err
	}
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	value, err := t.adapter.BusinessLossOf(ctx, businessID)
	if err != nil {
		return nil, wrapInfraError("odd token business loss of", err)
	}
	return value, nil
}

// BusinessProfitSwapAllowance reads ODDToken business profit swap allowance.
func (t *ODDToken) BusinessProfitSwapAllowance(ctx context.Context, account common.Address, routerOrSpender common.Address, expectedPoolOrTarget common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "odd token business profit swap allowance"); err != nil {
		return nil, err
	}
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	value, err := t.adapter.BusinessProfitSwapAllowance(ctx, account, routerOrSpender, expectedPoolOrTarget)
	if err != nil {
		return nil, wrapInfraError("odd token business profit swap allowance", err)
	}
	return value, nil
}

// BusinessSnapshotOf reads ODDToken business snapshot.
func (t *ODDToken) BusinessSnapshotOf(ctx context.Context, businessID [32]byte) (ODDTokenBusinessSnapshot, error) {
	if err := checkContext(ctx, "odd token business snapshot of"); err != nil {
		return ODDTokenBusinessSnapshot{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return ODDTokenBusinessSnapshot{}, err
	}
	value, err := t.adapter.BusinessSnapshotOf(ctx, businessID)
	if err != nil {
		return ODDTokenBusinessSnapshot{}, wrapInfraError("odd token business snapshot of", err)
	}
	return toPublicODDTokenBusinessSnapshot(value), nil
}

// DexLaunchPool reads ODDToken DEX launch pool.
func (t *ODDToken) DexLaunchPool(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "odd token dex launch pool"); err != nil {
		return common.Address{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return common.Address{}, err
	}
	value, err := t.adapter.DexLaunchPool(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("odd token dex launch pool", err)
	}
	return value, nil
}

// DexLaunchSpender reads ODDToken DEX launch spender.
func (t *ODDToken) DexLaunchSpender(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "odd token dex launch spender"); err != nil {
		return common.Address{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return common.Address{}, err
	}
	value, err := t.adapter.DexLaunchSpender(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("odd token dex launch spender", err)
	}
	return value, nil
}

// DexLiquidityTransferableAllocation reads ODDToken DEX liquidity transferable allocation.
func (t *ODDToken) DexLiquidityTransferableAllocation(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "odd token dex liquidity transferable allocation"); err != nil {
		return nil, err
	}
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	value, err := t.adapter.DexLiquidityTransferableAllocation(ctx)
	if err != nil {
		return nil, wrapInfraError("odd token dex liquidity transferable allocation", err)
	}
	return value, nil
}

// DexRestrictedTarget reads ODDToken DEX restricted target flag.
func (t *ODDToken) DexRestrictedTarget(ctx context.Context, account common.Address) (bool, error) {
	if err := checkContext(ctx, "odd token dex restricted target"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.DexRestrictedTarget(ctx, account)
	if err != nil {
		return false, wrapInfraError("odd token dex restricted target", err)
	}
	return value, nil
}

// FixedSources reads ODDToken fixed source contracts.
func (t *ODDToken) FixedSources(ctx context.Context) (ODDTokenFixedSources, error) {
	if err := checkContext(ctx, "odd token fixed sources"); err != nil {
		return ODDTokenFixedSources{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return ODDTokenFixedSources{}, err
	}
	value, err := t.adapter.FixedSources(ctx)
	if err != nil {
		return ODDTokenFixedSources{}, wrapInfraError("odd token fixed sources", err)
	}
	return toPublicODDTokenFixedSources(value), nil
}

// FixedSourcesConfigured reads ODDToken fixed source configuration flag.
func (t *ODDToken) FixedSourcesConfigured(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "odd token fixed sources configured"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.FixedSourcesConfigured(ctx)
	if err != nil {
		return false, wrapInfraError("odd token fixed sources configured", err)
	}
	return value, nil
}

// InitialSupplyAllocated reads ODDToken initial supply allocation flag.
func (t *ODDToken) InitialSupplyAllocated(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "odd token initial supply allocated"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.InitialSupplyAllocated(ctx)
	if err != nil {
		return false, wrapInfraError("odd token initial supply allocated", err)
	}
	return value, nil
}

// IsDexRestrictedTarget reads ODDToken DEX restricted target status.
func (t *ODDToken) IsDexRestrictedTarget(ctx context.Context, account common.Address) (bool, error) {
	if err := checkContext(ctx, "odd token is dex restricted target"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.IsDexRestrictedTarget(ctx, account)
	if err != nil {
		return false, wrapInfraError("odd token is dex restricted target", err)
	}
	return value, nil
}

// IsTreasurySink reads ODDToken treasury sink status.
func (t *ODDToken) IsTreasurySink(ctx context.Context, account common.Address) (bool, error) {
	if err := checkContext(ctx, "odd token is treasury sink"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.IsTreasurySink(ctx, account)
	if err != nil {
		return false, wrapInfraError("odd token is treasury sink", err)
	}
	return value, nil
}

// IsWhitelist reads ODDToken whitelist status.
func (t *ODDToken) IsWhitelist(ctx context.Context, account common.Address) (bool, error) {
	if err := checkContext(ctx, "odd token is whitelist"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.IsWhitelist(ctx, account)
	if err != nil {
		return false, wrapInfraError("odd token is whitelist", err)
	}
	return value, nil
}

// LockedBalanceOf reads ODDToken locked balance.
func (t *ODDToken) LockedBalanceOf(ctx context.Context, account common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "odd token locked balance of"); err != nil {
		return nil, err
	}
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	value, err := t.adapter.LockedBalanceOf(ctx, account)
	if err != nil {
		return nil, wrapInfraError("odd token locked balance of", err)
	}
	return value, nil
}

// PoolLaunchTime reads ODDToken pool launch time.
func (t *ODDToken) PoolLaunchTime(ctx context.Context) (uint64, error) {
	if err := checkContext(ctx, "odd token pool launch time"); err != nil {
		return 0, err
	}
	if err := ensureODDToken(t); err != nil {
		return 0, err
	}
	value, err := t.adapter.PoolLaunchTime(ctx)
	if err != nil {
		return 0, wrapInfraError("odd token pool launch time", err)
	}
	return value, nil
}

// PreviewRewardUnlock reads ODDToken reward unlock preview.
func (t *ODDToken) PreviewRewardUnlock(ctx context.Context, account common.Address) (ODDTokenUnlockPreview, error) {
	if err := checkContext(ctx, "odd token preview reward unlock"); err != nil {
		return ODDTokenUnlockPreview{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return ODDTokenUnlockPreview{}, err
	}
	value, err := t.adapter.PreviewRewardUnlock(ctx, account)
	if err != nil {
		return ODDTokenUnlockPreview{}, wrapInfraError("odd token preview reward unlock", err)
	}
	return toPublicODDTokenUnlockPreview(value), nil
}

// PreviewSaleUnlock reads ODDToken sale unlock preview.
func (t *ODDToken) PreviewSaleUnlock(ctx context.Context, account common.Address) (ODDTokenUnlockPreview, error) {
	if err := checkContext(ctx, "odd token preview sale unlock"); err != nil {
		return ODDTokenUnlockPreview{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return ODDTokenUnlockPreview{}, err
	}
	value, err := t.adapter.PreviewSaleUnlock(ctx, account)
	if err != nil {
		return ODDTokenUnlockPreview{}, wrapInfraError("odd token preview sale unlock", err)
	}
	return toPublicODDTokenUnlockPreview(value), nil
}

// SourceBalanceOf reads ODDToken source balance.
func (t *ODDToken) SourceBalanceOf(ctx context.Context, account common.Address) (ODDTokenSourceBreakdown, error) {
	if err := checkContext(ctx, "odd token source balance of"); err != nil {
		return ODDTokenSourceBreakdown{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return ODDTokenSourceBreakdown{}, err
	}
	value, err := t.adapter.SourceBalanceOf(ctx, account)
	if err != nil {
		return ODDTokenSourceBreakdown{}, wrapInfraError("odd token source balance of", err)
	}
	return toPublicODDTokenSourceBreakdown(value), nil
}

// TransferableBalanceOf reads ODDToken transferable balance.
func (t *ODDToken) TransferableBalanceOf(ctx context.Context, account common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "odd token transferable balance of"); err != nil {
		return nil, err
	}
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	value, err := t.adapter.TransferableBalanceOf(ctx, account)
	if err != nil {
		return nil, wrapInfraError("odd token transferable balance of", err)
	}
	return value, nil
}

// TreasurySink reads ODDToken treasury sink mapping flag.
func (t *ODDToken) TreasurySink(ctx context.Context, account common.Address) (bool, error) {
	if err := checkContext(ctx, "odd token treasury sink"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.TreasurySink(ctx, account)
	if err != nil {
		return false, wrapInfraError("odd token treasury sink", err)
	}
	return value, nil
}

// Whitelist reads ODDToken whitelist mapping flag.
func (t *ODDToken) Whitelist(ctx context.Context, account common.Address) (bool, error) {
	if err := checkContext(ctx, "odd token whitelist"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.Whitelist(ctx, account)
	if err != nil {
		return false, wrapInfraError("odd token whitelist", err)
	}
	return value, nil
}

// Initialize submits an ODDToken initialize transaction using caller-supplied opts.
func (t *ODDToken) Initialize(opts *bind.TransactOpts, adminTimelock common.Address, pauser common.Address) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.Initialize(opts, adminTimelock, pauser)
	if err != nil {
		return nil, wrapInfraError("odd token initialize", err)
	}
	return tx, nil
}

// AllocateInitialSupply submits an ODDToken allocate initial supply transaction using caller-supplied opts.
func (t *ODDToken) AllocateInitialSupply(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.AllocateInitialSupply(opts)
	if err != nil {
		return nil, wrapInfraError("odd token allocate initial supply", err)
	}
	return tx, nil
}

// Burn submits an ODDToken burn transaction using caller-supplied opts.
func (t *ODDToken) Burn(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if err := requireBigInts("odd token burn", amount); err != nil {
		return nil, err
	}
	tx, err := t.adapter.Burn(opts, amount)
	if err != nil {
		return nil, wrapInfraError("odd token burn", err)
	}
	return tx, nil
}

// ClearBusinessProfitSwapAllowance submits an ODDToken clear business profit swap allowance transaction using caller-supplied opts.
func (t *ODDToken) ClearBusinessProfitSwapAllowance(opts *bind.TransactOpts, routerOrSpender common.Address, expectedPoolOrTarget common.Address) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.ClearBusinessProfitSwapAllowance(opts, routerOrSpender, expectedPoolOrTarget)
	if err != nil {
		return nil, wrapInfraError("odd token clear business profit swap allowance", err)
	}
	return tx, nil
}

// ConsumeBusinessInflow submits an ODDToken consume business inflow transaction using caller-supplied opts.
func (t *ODDToken) ConsumeBusinessInflow(opts *bind.TransactOpts, user common.Address, businessType uint16, rawID [32]byte, amount *big.Int) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if err := requireBigInts("odd token consume business inflow", amount); err != nil {
		return nil, err
	}
	tx, err := t.adapter.ConsumeBusinessInflow(opts, user, businessType, rawID, amount)
	if err != nil {
		return nil, wrapInfraError("odd token consume business inflow", err)
	}
	return tx, nil
}

// DistributeRewardClaim submits an ODDToken distribute reward claim transaction using caller-supplied opts.
func (t *ODDToken) DistributeRewardClaim(opts *bind.TransactOpts, user common.Address, amount *big.Int) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if err := requireBigInts("odd token distribute reward claim", amount); err != nil {
		return nil, err
	}
	tx, err := t.adapter.DistributeRewardClaim(opts, user, amount)
	if err != nil {
		return nil, wrapInfraError("odd token distribute reward claim", err)
	}
	return tx, nil
}

// DistributeSalePurchase submits an ODDToken distribute sale purchase transaction using caller-supplied opts.
func (t *ODDToken) DistributeSalePurchase(opts *bind.TransactOpts, user common.Address, amount *big.Int) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if err := requireBigInts("odd token distribute sale purchase", amount); err != nil {
		return nil, err
	}
	tx, err := t.adapter.DistributeSalePurchase(opts, user, amount)
	if err != nil {
		return nil, wrapInfraError("odd token distribute sale purchase", err)
	}
	return tx, nil
}

// MarkDexPoolLaunched submits an ODDToken mark DEX pool launched transaction using caller-supplied opts.
func (t *ODDToken) MarkDexPoolLaunched(opts *bind.TransactOpts, launchTime uint64) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.MarkDexPoolLaunched(opts, launchTime)
	if err != nil {
		return nil, wrapInfraError("odd token mark dex pool launched", err)
	}
	return tx, nil
}

// ReclaimSalePurchase submits an ODDToken reclaim sale purchase transaction using caller-supplied opts.
func (t *ODDToken) ReclaimSalePurchase(opts *bind.TransactOpts, user common.Address, amount *big.Int) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if err := requireBigInts("odd token reclaim sale purchase", amount); err != nil {
		return nil, err
	}
	tx, err := t.adapter.ReclaimSalePurchase(opts, user, amount)
	if err != nil {
		return nil, wrapInfraError("odd token reclaim sale purchase", err)
	}
	return tx, nil
}

// RegisterBusinessOutcomeDelta submits an ODDToken register business outcome delta transaction using caller-supplied opts.
func (t *ODDToken) RegisterBusinessOutcomeDelta(opts *bind.TransactOpts, user common.Address, businessID [32]byte, businessOutDelta *big.Int, finalized bool) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if err := requireBigInts("odd token register business outcome delta", businessOutDelta); err != nil {
		return nil, err
	}
	tx, err := t.adapter.RegisterBusinessOutcomeDelta(opts, user, businessID, businessOutDelta, finalized)
	if err != nil {
		return nil, wrapInfraError("odd token register business outcome delta", err)
	}
	return tx, nil
}

// RegisterBusinessProfitAndTransfer submits an ODDToken register business profit and transfer transaction using caller-supplied opts.
func (t *ODDToken) RegisterBusinessProfitAndTransfer(opts *bind.TransactOpts, user common.Address, businessType uint16, rawID [32]byte, amount *big.Int) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if err := requireBigInts("odd token register business profit and transfer", amount); err != nil {
		return nil, err
	}
	tx, err := t.adapter.RegisterBusinessProfitAndTransfer(opts, user, businessType, rawID, amount)
	if err != nil {
		return nil, wrapInfraError("odd token register business profit and transfer", err)
	}
	return tx, nil
}

// RegisterBusinessProfitForDexSwap submits an ODDToken register business profit for DEX swap transaction using caller-supplied opts.
func (t *ODDToken) RegisterBusinessProfitForDexSwap(opts *bind.TransactOpts, user common.Address, businessType uint16, rawID [32]byte, amount *big.Int, routerOrSpender common.Address, expectedPoolOrTarget common.Address) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if err := requireBigInts("odd token register business profit for dex swap", amount); err != nil {
		return nil, err
	}
	tx, err := t.adapter.RegisterBusinessProfitForDexSwap(opts, user, businessType, rawID, amount, routerOrSpender, expectedPoolOrTarget)
	if err != nil {
		return nil, wrapInfraError("odd token register business profit for dex swap", err)
	}
	return tx, nil
}

// SetDexLaunchTransferTarget submits an ODDToken set DEX launch transfer target transaction using caller-supplied opts.
func (t *ODDToken) SetDexLaunchTransferTarget(opts *bind.TransactOpts, spender common.Address, pool common.Address) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.SetDexLaunchTransferTarget(opts, spender, pool)
	if err != nil {
		return nil, wrapInfraError("odd token set dex launch transfer target", err)
	}
	return tx, nil
}

// SetDexRestrictedTarget submits an ODDToken set DEX restricted target transaction using caller-supplied opts.
func (t *ODDToken) SetDexRestrictedTarget(opts *bind.TransactOpts, account common.Address, restricted bool) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.SetDexRestrictedTarget(opts, account, restricted)
	if err != nil {
		return nil, wrapInfraError("odd token set dex restricted target", err)
	}
	return tx, nil
}

// SetFixedSourceContracts submits an ODDToken set fixed source contracts transaction using caller-supplied opts.
func (t *ODDToken) SetFixedSourceContracts(opts *bind.TransactOpts, sources ODDTokenFixedSources) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.SetFixedSourceContracts(opts, toContractsODDTokenFixedSources(sources))
	if err != nil {
		return nil, wrapInfraError("odd token set fixed source contracts", err)
	}
	return tx, nil
}

// SetTreasurySink submits an ODDToken set treasury sink transaction using caller-supplied opts.
func (t *ODDToken) SetTreasurySink(opts *bind.TransactOpts, account common.Address, allowed bool) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.SetTreasurySink(opts, account, allowed)
	if err != nil {
		return nil, wrapInfraError("odd token set treasury sink", err)
	}
	return tx, nil
}

// SetWhitelist submits an ODDToken set whitelist transaction using caller-supplied opts.
func (t *ODDToken) SetWhitelist(opts *bind.TransactOpts, account common.Address, allowed bool) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.SetWhitelist(opts, account, allowed)
	if err != nil {
		return nil, wrapInfraError("odd token set whitelist", err)
	}
	return tx, nil
}
