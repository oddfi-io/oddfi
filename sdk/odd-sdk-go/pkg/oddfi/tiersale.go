package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// TierSale exposes the TierSale proxy API. Methods are safe for concurrent
// use and RPC reads block until the backend returns or ctx is canceled.
type TierSale struct {
	adapter *contracts.TierSaleAdapter
}

// TierSaleLaunchApproval is the launch approval snapshot.
type TierSaleLaunchApproval struct {
	Approved   bool
	Spender    common.Address
	UsdtAmount *big.Int
	OddAmount  *big.Int
}

// TierSalePurchase is one sale purchase record.
type TierSalePurchase struct {
	User         common.Address
	OddAmount    *big.Int
	UsdtPaid     *big.Int
	RefundedOdd  *big.Int
	RefundedUsdt *big.Int
}

func toPublicTierSaleLaunchApproval(value contracts.TierSaleLaunchApproval) TierSaleLaunchApproval {
	return TierSaleLaunchApproval{Approved: value.Approved, Spender: value.Spender, UsdtAmount: value.UsdtAmount, OddAmount: value.OddAmount}
}

func toPublicTierSalePurchase(value contracts.TierSalePurchase) TierSalePurchase {
	return TierSalePurchase{User: value.User, OddAmount: value.OddAmount, UsdtPaid: value.UsdtPaid, RefundedOdd: value.RefundedOdd, RefundedUsdt: value.RefundedUsdt}
}

// DefaultAdminRole reads TierSale default admin role.
func (p *TierSale) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "tier sale default admin role"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureTierSale(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.DefaultAdminRole(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("tier sale default admin role", err)
	}
	return value, nil
}

// UpgradeInterfaceVersion reads TierSale upgrade interface version.
func (p *TierSale) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "tier sale upgrade interface version"); err != nil {
		return "", err
	}
	if err := ensureTierSale(p); err != nil {
		return "", err
	}
	value, err := p.adapter.UpgradeInterfaceVersion(ctx)
	if err != nil {
		return "", wrapInfraError("tier sale upgrade interface version", err)
	}
	return value, nil
}

// GetRoleAdmin reads TierSale get role admin.
func (p *TierSale) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	if err := checkContext(ctx, "tier sale get role admin"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureTierSale(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.GetRoleAdmin(ctx, role)
	if err != nil {
		return [32]byte{}, wrapInfraError("tier sale get role admin", err)
	}
	return value, nil
}

// HasRole reads TierSale has role.
func (p *TierSale) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	if err := checkContext(ctx, "tier sale has role"); err != nil {
		return false, err
	}
	if err := ensureTierSale(p); err != nil {
		return false, err
	}
	value, err := p.adapter.HasRole(ctx, role, account)
	if err != nil {
		return false, wrapInfraError("tier sale has role", err)
	}
	return value, nil
}

// Paused reads TierSale paused.
func (p *TierSale) Paused(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "tier sale paused"); err != nil {
		return false, err
	}
	if err := ensureTierSale(p); err != nil {
		return false, err
	}
	value, err := p.adapter.Paused(ctx)
	if err != nil {
		return false, wrapInfraError("tier sale paused", err)
	}
	return value, nil
}

// ProxiableUUID reads TierSale proxiable uuid.
func (p *TierSale) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "tier sale proxiable uuid"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureTierSale(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.ProxiableUUID(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("tier sale proxiable uuid", err)
	}
	return value, nil
}

// SupportsInterface reads TierSale supports interface.
func (p *TierSale) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	if err := checkContext(ctx, "tier sale supports interface"); err != nil {
		return false, err
	}
	if err := ensureTierSale(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SupportsInterface(ctx, interfaceID)
	if err != nil {
		return false, wrapInfraError("tier sale supports interface", err)
	}
	return value, nil
}

// ForceFinalizeTime reads TierSale force finalize time.
func (p *TierSale) ForceFinalizeTime(ctx context.Context) (uint64, error) {
	if err := checkContext(ctx, "tier sale force finalize time"); err != nil {
		return 0, err
	}
	if err := ensureTierSale(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.ForceFinalizeTime(ctx)
	if err != nil {
		return 0, wrapInfraError("tier sale force finalize time", err)
	}
	return value, nil
}

// ForceFinalized reads TierSale force finalized.
func (p *TierSale) ForceFinalized(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "tier sale force finalized"); err != nil {
		return false, err
	}
	if err := ensureTierSale(p); err != nil {
		return false, err
	}
	value, err := p.adapter.ForceFinalized(ctx)
	if err != nil {
		return false, wrapInfraError("tier sale force finalized", err)
	}
	return value, nil
}

// GetCurrentTier reads TierSale get current tier.
func (p *TierSale) GetCurrentTier(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale get current tier"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.GetCurrentTier(ctx)
	if err != nil {
		return nil, wrapInfraError("tier sale get current tier", err)
	}
	return value, nil
}

// GetRemainingByTier reads TierSale get remaining by tier.
func (p *TierSale) GetRemainingByTier(ctx context.Context, tier *big.Int) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale get remaining by tier"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("tier sale get remaining by tier", tier); err != nil {
		return nil, err
	}
	value, err := p.adapter.GetRemainingByTier(ctx, tier)
	if err != nil {
		return nil, wrapInfraError("tier sale get remaining by tier", err)
	}
	return value, nil
}

// LaunchApproval reads TierSale launch approval.
func (p *TierSale) LaunchApproval(ctx context.Context) (TierSaleLaunchApproval, error) {
	if err := checkContext(ctx, "tier sale launch approval"); err != nil {
		return TierSaleLaunchApproval{}, err
	}
	if err := ensureTierSale(p); err != nil {
		return TierSaleLaunchApproval{}, err
	}
	value, err := p.adapter.LaunchApproval(ctx)
	if err != nil {
		return TierSaleLaunchApproval{}, wrapInfraError("tier sale launch approval", err)
	}
	return toPublicTierSaleLaunchApproval(value), nil
}

// LaunchApproved reads TierSale launch approved.
func (p *TierSale) LaunchApproved(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "tier sale launch approved"); err != nil {
		return false, err
	}
	if err := ensureTierSale(p); err != nil {
		return false, err
	}
	value, err := p.adapter.LaunchApproved(ctx)
	if err != nil {
		return false, wrapInfraError("tier sale launch approved", err)
	}
	return value, nil
}

// LaunchOddAmount reads TierSale launch odd amount.
func (p *TierSale) LaunchOddAmount(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale launch odd amount"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.LaunchOddAmount(ctx)
	if err != nil {
		return nil, wrapInfraError("tier sale launch odd amount", err)
	}
	return value, nil
}

// LaunchSpender reads TierSale launch spender.
func (p *TierSale) LaunchSpender(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "tier sale launch spender"); err != nil {
		return common.Address{}, err
	}
	if err := ensureTierSale(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.LaunchSpender(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("tier sale launch spender", err)
	}
	return value, nil
}

// LaunchUsdtAmount reads TierSale launch usdt amount.
func (p *TierSale) LaunchUsdtAmount(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale launch usdt amount"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.LaunchUsdtAmount(ctx)
	if err != nil {
		return nil, wrapInfraError("tier sale launch usdt amount", err)
	}
	return value, nil
}

// NextPurchaseID reads TierSale next purchase id.
func (p *TierSale) NextPurchaseID(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale next purchase id"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.NextPurchaseID(ctx)
	if err != nil {
		return nil, wrapInfraError("tier sale next purchase id", err)
	}
	return value, nil
}

// OddToken reads TierSale odd token.
func (p *TierSale) OddToken(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "tier sale odd token"); err != nil {
		return common.Address{}, err
	}
	if err := ensureTierSale(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.OddToken(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("tier sale odd token", err)
	}
	return value, nil
}

// PerAddressCap reads TierSale per address cap.
func (p *TierSale) PerAddressCap(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale per address cap"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.PerAddressCap(ctx)
	if err != nil {
		return nil, wrapInfraError("tier sale per address cap", err)
	}
	return value, nil
}

// PreviewBuy reads TierSale preview buy.
func (p *TierSale) PreviewBuy(ctx context.Context, oddAmount *big.Int) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale preview buy"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("tier sale preview buy", oddAmount); err != nil {
		return nil, err
	}
	value, err := p.adapter.PreviewBuy(ctx, oddAmount)
	if err != nil {
		return nil, wrapInfraError("tier sale preview buy", err)
	}
	return value, nil
}

// PurchasedOddByUser reads TierSale purchased odd by user.
func (p *TierSale) PurchasedOddByUser(ctx context.Context, user common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale purchased odd by user"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.PurchasedOddByUser(ctx, user)
	if err != nil {
		return nil, wrapInfraError("tier sale purchased odd by user", err)
	}
	return value, nil
}

// Purchase reads TierSale purchase.
func (p *TierSale) Purchase(ctx context.Context, purchaseID *big.Int) (TierSalePurchase, error) {
	if err := checkContext(ctx, "tier sale purchase"); err != nil {
		return TierSalePurchase{}, err
	}
	if err := ensureTierSale(p); err != nil {
		return TierSalePurchase{}, err
	}
	if err := requireBigInts("tier sale purchase", purchaseID); err != nil {
		return TierSalePurchase{}, err
	}
	value, err := p.adapter.Purchase(ctx, purchaseID)
	if err != nil {
		return TierSalePurchase{}, wrapInfraError("tier sale purchase", err)
	}
	return toPublicTierSalePurchase(value), nil
}

// SaleCancelled reads TierSale sale cancelled.
func (p *TierSale) SaleCancelled(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "tier sale sale cancelled"); err != nil {
		return false, err
	}
	if err := ensureTierSale(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SaleCancelled(ctx)
	if err != nil {
		return false, wrapInfraError("tier sale sale cancelled", err)
	}
	return value, nil
}

// SaleClosed reads TierSale sale closed.
func (p *TierSale) SaleClosed(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "tier sale sale closed"); err != nil {
		return false, err
	}
	if err := ensureTierSale(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SaleClosed(ctx)
	if err != nil {
		return false, wrapInfraError("tier sale sale closed", err)
	}
	return value, nil
}

// SaleStartTime reads TierSale sale start time.
func (p *TierSale) SaleStartTime(ctx context.Context) (uint64, error) {
	if err := checkContext(ctx, "tier sale sale start time"); err != nil {
		return 0, err
	}
	if err := ensureTierSale(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.SaleStartTime(ctx)
	if err != nil {
		return 0, wrapInfraError("tier sale sale start time", err)
	}
	return value, nil
}

// SoldOut reads TierSale sold out.
func (p *TierSale) SoldOut(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "tier sale sold out"); err != nil {
		return false, err
	}
	if err := ensureTierSale(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SoldOut(ctx)
	if err != nil {
		return false, wrapInfraError("tier sale sold out", err)
	}
	return value, nil
}

// SoldOutTime reads TierSale sold out time.
func (p *TierSale) SoldOutTime(ctx context.Context) (uint64, error) {
	if err := checkContext(ctx, "tier sale sold out time"); err != nil {
		return 0, err
	}
	if err := ensureTierSale(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.SoldOutTime(ctx)
	if err != nil {
		return 0, wrapInfraError("tier sale sold out time", err)
	}
	return value, nil
}

// TotalOddRefunded reads TierSale total odd refunded.
func (p *TierSale) TotalOddRefunded(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale total odd refunded"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalOddRefunded(ctx)
	if err != nil {
		return nil, wrapInfraError("tier sale total odd refunded", err)
	}
	return value, nil
}

// TotalSold reads TierSale total sold.
func (p *TierSale) TotalSold(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale total sold"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalSold(ctx)
	if err != nil {
		return nil, wrapInfraError("tier sale total sold", err)
	}
	return value, nil
}

// TotalUsdtRaised reads TierSale total usdt raised.
func (p *TierSale) TotalUsdtRaised(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale total usdt raised"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalUsdtRaised(ctx)
	if err != nil {
		return nil, wrapInfraError("tier sale total usdt raised", err)
	}
	return value, nil
}

// TotalUsdtRefunded reads TierSale total usdt refunded.
func (p *TierSale) TotalUsdtRefunded(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "tier sale total usdt refunded"); err != nil {
		return nil, err
	}
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalUsdtRefunded(ctx)
	if err != nil {
		return nil, wrapInfraError("tier sale total usdt refunded", err)
	}
	return value, nil
}

// Usdt reads TierSale usdt.
func (p *TierSale) Usdt(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "tier sale usdt"); err != nil {
		return common.Address{}, err
	}
	if err := ensureTierSale(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.Usdt(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("tier sale usdt", err)
	}
	return value, nil
}

// UsdtDecimals reads TierSale usdt decimals.
func (p *TierSale) UsdtDecimals(ctx context.Context) (uint8, error) {
	if err := checkContext(ctx, "tier sale usdt decimals"); err != nil {
		return 0, err
	}
	if err := ensureTierSale(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.UsdtDecimals(ctx)
	if err != nil {
		return 0, wrapInfraError("tier sale usdt decimals", err)
	}
	return value, nil
}

// GrantRole submits a TierSale grant role transaction using caller-supplied opts.
func (p *TierSale) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.GrantRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("tier sale grant role", err)
	}
	return tx, nil
}

// RenounceRole submits a TierSale renounce role transaction using caller-supplied opts.
func (p *TierSale) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, wrapInfraError("tier sale renounce role", err)
	}
	return tx, nil
}

// RevokeRole submits a TierSale revoke role transaction using caller-supplied opts.
func (p *TierSale) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RevokeRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("tier sale revoke role", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits a TierSale upgrade to and call transaction using caller-supplied opts.
func (p *TierSale) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, wrapInfraError("tier sale upgrade to and call", err)
	}
	return tx, nil
}

// Initialize submits a TierSale initialize transaction using caller-supplied opts.
func (p *TierSale) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, usdtAddress common.Address) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Initialize(opts, admin, oddTokenAddress, usdtAddress)
	if err != nil {
		return nil, wrapInfraError("tier sale initialize", err)
	}
	return tx, nil
}

// ApproveLaunch submits a TierSale approve launch transaction using caller-supplied opts.
func (p *TierSale) ApproveLaunch(opts *bind.TransactOpts, spender common.Address, usdtAmount *big.Int, oddAmount *big.Int) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("tier sale approve launch", usdtAmount, oddAmount); err != nil {
		return nil, err
	}
	tx, err := p.adapter.ApproveLaunch(opts, spender, usdtAmount, oddAmount)
	if err != nil {
		return nil, wrapInfraError("tier sale approve launch", err)
	}
	return tx, nil
}

// Buy submits a TierSale buy transaction using caller-supplied opts.
func (p *TierSale) Buy(opts *bind.TransactOpts, oddAmount *big.Int) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("tier sale buy", oddAmount); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Buy(opts, oddAmount)
	if err != nil {
		return nil, wrapInfraError("tier sale buy", err)
	}
	return tx, nil
}

// CancelSale submits a TierSale cancel sale transaction using caller-supplied opts.
func (p *TierSale) CancelSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.CancelSale(opts)
	if err != nil {
		return nil, wrapInfraError("tier sale cancel sale", err)
	}
	return tx, nil
}

// CloseSale submits a TierSale close sale transaction using caller-supplied opts.
func (p *TierSale) CloseSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.CloseSale(opts)
	if err != nil {
		return nil, wrapInfraError("tier sale close sale", err)
	}
	return tx, nil
}

// ForceFinalize submits a TierSale force finalize transaction using caller-supplied opts.
func (p *TierSale) ForceFinalize(opts *bind.TransactOpts, usdtAmount *big.Int, oddAmount *big.Int) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("tier sale force finalize", usdtAmount, oddAmount); err != nil {
		return nil, err
	}
	tx, err := p.adapter.ForceFinalize(opts, usdtAmount, oddAmount)
	if err != nil {
		return nil, wrapInfraError("tier sale force finalize", err)
	}
	return tx, nil
}

// PauseSale submits a TierSale pause sale transaction using caller-supplied opts.
func (p *TierSale) PauseSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.PauseSale(opts)
	if err != nil {
		return nil, wrapInfraError("tier sale pause sale", err)
	}
	return tx, nil
}

// RefundPurchase submits a TierSale refund purchase transaction using caller-supplied opts.
func (p *TierSale) RefundPurchase(opts *bind.TransactOpts, purchaseID *big.Int, oddAmount *big.Int) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("tier sale refund purchase", purchaseID, oddAmount); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RefundPurchase(opts, purchaseID, oddAmount)
	if err != nil {
		return nil, wrapInfraError("tier sale refund purchase", err)
	}
	return tx, nil
}

// ResumeSale submits a TierSale resume sale transaction using caller-supplied opts.
func (p *TierSale) ResumeSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.ResumeSale(opts)
	if err != nil {
		return nil, wrapInfraError("tier sale resume sale", err)
	}
	return tx, nil
}

// SetPerAddressCap submits a TierSale set per address cap transaction using caller-supplied opts.
func (p *TierSale) SetPerAddressCap(opts *bind.TransactOpts, newCap *big.Int) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("tier sale set per address cap", newCap); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetPerAddressCap(opts, newCap)
	if err != nil {
		return nil, wrapInfraError("tier sale set per address cap", err)
	}
	return tx, nil
}

// StartSale submits a TierSale start sale transaction using caller-supplied opts.
func (p *TierSale) StartSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.StartSale(opts)
	if err != nil {
		return nil, wrapInfraError("tier sale start sale", err)
	}
	return tx, nil
}

// BuyCalldata returns ABI-encoded calldata for TierSale.buy; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *TierSale) BuyCalldata(oddAmount *big.Int) ([]byte, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("tier sale buy calldata", oddAmount); err != nil {
		return nil, err
	}
	data, err := p.adapter.BuyCalldata(oddAmount)
	if err != nil {
		return nil, wrapUserError("tier sale buy calldata", err)
	}
	return data, nil
}

// RefundPurchaseCalldata returns ABI-encoded calldata for TierSale.refundPurchase; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *TierSale) RefundPurchaseCalldata(purchaseID *big.Int, oddAmount *big.Int) ([]byte, error) {
	if err := ensureTierSale(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("tier sale refund purchase calldata", purchaseID, oddAmount); err != nil {
		return nil, err
	}
	data, err := p.adapter.RefundPurchaseCalldata(purchaseID, oddAmount)
	if err != nil {
		return nil, wrapUserError("tier sale refund purchase calldata", err)
	}
	return data, nil
}
