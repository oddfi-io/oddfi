package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/tiersale"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// TierSaleAdapter reads and writes TierSale state through generated bindings.
type TierSaleAdapter struct {
	caller     *tiersale.TierSaleCaller
	transactor *tiersale.TierSaleTransactor
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

// NewTierSaleAdapter binds a TierSale adapter to proxyAddress.
func NewTierSaleAdapter(caller bind.ContractCaller, transactor bind.ContractTransactor, proxyAddress common.Address) (*TierSaleAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	boundCaller, err := tiersale.NewTierSaleCaller(proxyAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind tier sale caller: %w", err)
	}
	var boundTransactor *tiersale.TierSaleTransactor
	if transactor != nil {
		boundTransactor, err = tiersale.NewTierSaleTransactor(proxyAddress, transactor)
		if err != nil {
			return nil, fmt.Errorf("bind tier sale transactor: %w", err)
		}
	}
	return &TierSaleAdapter{caller: boundCaller, transactor: boundTransactor}, nil
}

func toTierSaleLaunchApproval(value struct {
	Approved   bool
	Spender    common.Address
	UsdtAmount *big.Int
	OddAmount  *big.Int
}) TierSaleLaunchApproval {
	return TierSaleLaunchApproval{Approved: value.Approved, Spender: value.Spender, UsdtAmount: cloneBigInt(value.UsdtAmount), OddAmount: cloneBigInt(value.OddAmount)}
}

func toTierSalePurchase(value struct {
	User         common.Address
	OddAmount    *big.Int
	UsdtPaid     *big.Int
	RefundedOdd  *big.Int
	RefundedUsdt *big.Int
}) TierSalePurchase {
	return TierSalePurchase{User: value.User, OddAmount: cloneBigInt(value.OddAmount), UsdtPaid: cloneBigInt(value.UsdtPaid), RefundedOdd: cloneBigInt(value.RefundedOdd), RefundedUsdt: cloneBigInt(value.RefundedUsdt)}
}

// DefaultAdminRole reads TierSale default admin role.
func (a *TierSaleAdapter) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.DEFAULTADMINROLE(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// UpgradeInterfaceVersion reads TierSale upgrade interface version.
func (a *TierSaleAdapter) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	value, err := a.caller.UPGRADEINTERFACEVERSION(callOpts(ctx))
	if err != nil {
		return "", err
	}
	return value, nil
}

// GetRoleAdmin reads TierSale get role admin.
func (a *TierSaleAdapter) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	value, err := a.caller.GetRoleAdmin(callOpts(ctx), role)
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// HasRole reads TierSale has role.
func (a *TierSaleAdapter) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	value, err := a.caller.HasRole(callOpts(ctx), role, account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// Paused reads TierSale paused.
func (a *TierSaleAdapter) Paused(ctx context.Context) (bool, error) {
	value, err := a.caller.Paused(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// ProxiableUUID reads TierSale proxiable uuid.
func (a *TierSaleAdapter) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.ProxiableUUID(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// SupportsInterface reads TierSale supports interface.
func (a *TierSaleAdapter) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	value, err := a.caller.SupportsInterface(callOpts(ctx), interfaceID)
	if err != nil {
		return false, err
	}
	return value, nil
}

// ForceFinalizeTime reads TierSale force finalize time.
func (a *TierSaleAdapter) ForceFinalizeTime(ctx context.Context) (uint64, error) {
	value, err := a.caller.ForceFinalizeTime(callOpts(ctx))
	if err != nil {
		return 0, err
	}
	return value, nil
}

// ForceFinalized reads TierSale force finalized.
func (a *TierSaleAdapter) ForceFinalized(ctx context.Context) (bool, error) {
	value, err := a.caller.ForceFinalized(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// GetCurrentTier reads TierSale get current tier.
func (a *TierSaleAdapter) GetCurrentTier(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.GetCurrentTier(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// GetRemainingByTier reads TierSale get remaining by tier.
func (a *TierSaleAdapter) GetRemainingByTier(ctx context.Context, tier *big.Int) (*big.Int, error) {
	value, err := a.caller.GetRemainingByTier(callOpts(ctx), tier)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// LaunchApproval reads TierSale launch approval.
func (a *TierSaleAdapter) LaunchApproval(ctx context.Context) (TierSaleLaunchApproval, error) {
	value, err := a.caller.LaunchApproval(callOpts(ctx))
	if err != nil {
		return TierSaleLaunchApproval{}, err
	}
	return toTierSaleLaunchApproval(value), nil
}

// LaunchApproved reads TierSale launch approved.
func (a *TierSaleAdapter) LaunchApproved(ctx context.Context) (bool, error) {
	value, err := a.caller.LaunchApproved(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// LaunchOddAmount reads TierSale launch odd amount.
func (a *TierSaleAdapter) LaunchOddAmount(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.LaunchOddAmount(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// LaunchSpender reads TierSale launch spender.
func (a *TierSaleAdapter) LaunchSpender(ctx context.Context) (common.Address, error) {
	value, err := a.caller.LaunchSpender(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// LaunchUsdtAmount reads TierSale launch usdt amount.
func (a *TierSaleAdapter) LaunchUsdtAmount(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.LaunchUsdtAmount(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// NextPurchaseID reads TierSale next purchase id.
func (a *TierSaleAdapter) NextPurchaseID(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.NextPurchaseId(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// OddToken reads TierSale odd token.
func (a *TierSaleAdapter) OddToken(ctx context.Context) (common.Address, error) {
	value, err := a.caller.OddToken(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// PerAddressCap reads TierSale per address cap.
func (a *TierSaleAdapter) PerAddressCap(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.PerAddressCap(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// PreviewBuy reads TierSale preview buy.
func (a *TierSaleAdapter) PreviewBuy(ctx context.Context, oddAmount *big.Int) (*big.Int, error) {
	value, err := a.caller.PreviewBuy(callOpts(ctx), oddAmount)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// PurchasedOddByUser reads TierSale purchased odd by user.
func (a *TierSaleAdapter) PurchasedOddByUser(ctx context.Context, user common.Address) (*big.Int, error) {
	value, err := a.caller.PurchasedOddByUser(callOpts(ctx), user)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// Purchase reads TierSale purchase.
func (a *TierSaleAdapter) Purchase(ctx context.Context, purchaseID *big.Int) (TierSalePurchase, error) {
	value, err := a.caller.Purchases(callOpts(ctx), purchaseID)
	if err != nil {
		return TierSalePurchase{}, err
	}
	return toTierSalePurchase(value), nil
}

// SaleCancelled reads TierSale sale cancelled.
func (a *TierSaleAdapter) SaleCancelled(ctx context.Context) (bool, error) {
	value, err := a.caller.SaleCancelled(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// SaleClosed reads TierSale sale closed.
func (a *TierSaleAdapter) SaleClosed(ctx context.Context) (bool, error) {
	value, err := a.caller.SaleClosed(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// SaleStartTime reads TierSale sale start time.
func (a *TierSaleAdapter) SaleStartTime(ctx context.Context) (uint64, error) {
	value, err := a.caller.SaleStartTime(callOpts(ctx))
	if err != nil {
		return 0, err
	}
	return value, nil
}

// SoldOut reads TierSale sold out.
func (a *TierSaleAdapter) SoldOut(ctx context.Context) (bool, error) {
	value, err := a.caller.SoldOut(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// SoldOutTime reads TierSale sold out time.
func (a *TierSaleAdapter) SoldOutTime(ctx context.Context) (uint64, error) {
	value, err := a.caller.SoldOutTime(callOpts(ctx))
	if err != nil {
		return 0, err
	}
	return value, nil
}

// TotalOddRefunded reads TierSale total odd refunded.
func (a *TierSaleAdapter) TotalOddRefunded(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalOddRefunded(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TotalSold reads TierSale total sold.
func (a *TierSaleAdapter) TotalSold(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalSold(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TotalUsdtRaised reads TierSale total usdt raised.
func (a *TierSaleAdapter) TotalUsdtRaised(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalUsdtRaised(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TotalUsdtRefunded reads TierSale total usdt refunded.
func (a *TierSaleAdapter) TotalUsdtRefunded(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalUsdtRefunded(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// Usdt reads TierSale usdt.
func (a *TierSaleAdapter) Usdt(ctx context.Context) (common.Address, error) {
	value, err := a.caller.Usdt(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// UsdtDecimals reads TierSale usdt decimals.
func (a *TierSaleAdapter) UsdtDecimals(ctx context.Context) (uint8, error) {
	value, err := a.caller.UsdtDecimals(callOpts(ctx))
	if err != nil {
		return 0, err
	}
	return value, nil
}

// GrantRole submits the TierSale grant role transaction.
func (a *TierSaleAdapter) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.GrantRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("tier sale grant role: %w", err)
	}
	return tx, nil
}

// RenounceRole submits the TierSale renounce role transaction.
func (a *TierSaleAdapter) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("tier sale renounce role: %w", err)
	}
	return tx, nil
}

// RevokeRole submits the TierSale revoke role transaction.
func (a *TierSaleAdapter) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RevokeRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("tier sale revoke role: %w", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits the TierSale upgrade to and call transaction.
func (a *TierSaleAdapter) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, fmt.Errorf("tier sale upgrade to and call: %w", err)
	}
	return tx, nil
}

// Initialize submits the TierSale initialize transaction.
func (a *TierSaleAdapter) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, usdtAddress common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Initialize(opts, admin, oddTokenAddress, usdtAddress)
	if err != nil {
		return nil, fmt.Errorf("tier sale initialize: %w", err)
	}
	return tx, nil
}

// ApproveLaunch submits the TierSale approve launch transaction.
func (a *TierSaleAdapter) ApproveLaunch(opts *bind.TransactOpts, spender common.Address, usdtAmount *big.Int, oddAmount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ApproveLaunch(opts, spender, usdtAmount, oddAmount)
	if err != nil {
		return nil, fmt.Errorf("tier sale approve launch: %w", err)
	}
	return tx, nil
}

// Buy submits the TierSale buy transaction.
func (a *TierSaleAdapter) Buy(opts *bind.TransactOpts, oddAmount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Buy(opts, oddAmount)
	if err != nil {
		return nil, fmt.Errorf("tier sale buy: %w", err)
	}
	return tx, nil
}

// CancelSale submits the TierSale cancel sale transaction.
func (a *TierSaleAdapter) CancelSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.CancelSale(opts)
	if err != nil {
		return nil, fmt.Errorf("tier sale cancel sale: %w", err)
	}
	return tx, nil
}

// CloseSale submits the TierSale close sale transaction.
func (a *TierSaleAdapter) CloseSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.CloseSale(opts)
	if err != nil {
		return nil, fmt.Errorf("tier sale close sale: %w", err)
	}
	return tx, nil
}

// ForceFinalize submits the TierSale force finalize transaction.
func (a *TierSaleAdapter) ForceFinalize(opts *bind.TransactOpts, usdtAmount *big.Int, oddAmount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ForceFinalize(opts, usdtAmount, oddAmount)
	if err != nil {
		return nil, fmt.Errorf("tier sale force finalize: %w", err)
	}
	return tx, nil
}

// PauseSale submits the TierSale pause sale transaction.
func (a *TierSaleAdapter) PauseSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.PauseSale(opts)
	if err != nil {
		return nil, fmt.Errorf("tier sale pause sale: %w", err)
	}
	return tx, nil
}

// RefundPurchase submits the TierSale refund purchase transaction.
func (a *TierSaleAdapter) RefundPurchase(opts *bind.TransactOpts, purchaseID *big.Int, oddAmount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RefundPurchase(opts, purchaseID, oddAmount)
	if err != nil {
		return nil, fmt.Errorf("tier sale refund purchase: %w", err)
	}
	return tx, nil
}

// ResumeSale submits the TierSale resume sale transaction.
func (a *TierSaleAdapter) ResumeSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ResumeSale(opts)
	if err != nil {
		return nil, fmt.Errorf("tier sale resume sale: %w", err)
	}
	return tx, nil
}

// SetPerAddressCap submits the TierSale set per address cap transaction.
func (a *TierSaleAdapter) SetPerAddressCap(opts *bind.TransactOpts, newCap *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetPerAddressCap(opts, newCap)
	if err != nil {
		return nil, fmt.Errorf("tier sale set per address cap: %w", err)
	}
	return tx, nil
}

// StartSale submits the TierSale start sale transaction.
func (a *TierSaleAdapter) StartSale(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.StartSale(opts)
	if err != nil {
		return nil, fmt.Errorf("tier sale start sale: %w", err)
	}
	return tx, nil
}

var tierSaleABI = mustLoadTierSaleABI()

func mustLoadTierSaleABI() abi.ABI {
	parsed, err := tiersale.TierSaleMetaData.GetAbi()
	if err != nil {
		panic("bind tier sale abi: " + err.Error())
	}
	if parsed == nil {
		panic("bind tier sale abi: nil abi")
	}
	return *parsed
}

// BuyCalldata returns ABI-encoded calldata for TierSale.buy(uint256).
func (a *TierSaleAdapter) BuyCalldata(oddAmount *big.Int) ([]byte, error) {
	data, err := tierSaleABI.Pack("buy", oddAmount)
	if err != nil {
		return nil, fmt.Errorf("tier sale buy abi pack: %w", err)
	}
	return data, nil
}

// RefundPurchaseCalldata returns ABI-encoded calldata for TierSale.refundPurchase(uint256,uint256).
func (a *TierSaleAdapter) RefundPurchaseCalldata(purchaseID *big.Int, oddAmount *big.Int) ([]byte, error) {
	data, err := tierSaleABI.Pack("refundPurchase", purchaseID, oddAmount)
	if err != nil {
		return nil, fmt.Errorf("tier sale refund purchase abi pack: %w", err)
	}
	return data, nil
}
