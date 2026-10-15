package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// DexLaunchController exposes the DexLaunchController proxy API. Methods are safe for concurrent
// use and RPC reads block until the backend returns or ctx is canceled.
type DexLaunchController struct {
	adapter *contracts.DexLaunchControllerAdapter
}

// DefaultAdminRole reads DexLaunchController default admin role.
func (p *DexLaunchController) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "dex launch controller default admin role"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.DefaultAdminRole(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("dex launch controller default admin role", err)
	}
	return value, nil
}

// UpgradeInterfaceVersion reads DexLaunchController upgrade interface version.
func (p *DexLaunchController) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "dex launch controller upgrade interface version"); err != nil {
		return "", err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return "", err
	}
	value, err := p.adapter.UpgradeInterfaceVersion(ctx)
	if err != nil {
		return "", wrapInfraError("dex launch controller upgrade interface version", err)
	}
	return value, nil
}

// GetRoleAdmin reads DexLaunchController get role admin.
func (p *DexLaunchController) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	if err := checkContext(ctx, "dex launch controller get role admin"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.GetRoleAdmin(ctx, role)
	if err != nil {
		return [32]byte{}, wrapInfraError("dex launch controller get role admin", err)
	}
	return value, nil
}

// HasRole reads DexLaunchController has role.
func (p *DexLaunchController) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	if err := checkContext(ctx, "dex launch controller has role"); err != nil {
		return false, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return false, err
	}
	value, err := p.adapter.HasRole(ctx, role, account)
	if err != nil {
		return false, wrapInfraError("dex launch controller has role", err)
	}
	return value, nil
}

// Paused reads DexLaunchController paused.
func (p *DexLaunchController) Paused(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "dex launch controller paused"); err != nil {
		return false, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return false, err
	}
	value, err := p.adapter.Paused(ctx)
	if err != nil {
		return false, wrapInfraError("dex launch controller paused", err)
	}
	return value, nil
}

// ProxiableUUID reads DexLaunchController proxiable uuid.
func (p *DexLaunchController) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "dex launch controller proxiable uuid"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.ProxiableUUID(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("dex launch controller proxiable uuid", err)
	}
	return value, nil
}

// SupportsInterface reads DexLaunchController supports interface.
func (p *DexLaunchController) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	if err := checkContext(ctx, "dex launch controller supports interface"); err != nil {
		return false, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SupportsInterface(ctx, interfaceID)
	if err != nil {
		return false, wrapInfraError("dex launch controller supports interface", err)
	}
	return value, nil
}

// LaunchTime reads DexLaunchController launch time.
func (p *DexLaunchController) LaunchTime(ctx context.Context) (uint64, error) {
	if err := checkContext(ctx, "dex launch controller launch time"); err != nil {
		return 0, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.LaunchTime(ctx)
	if err != nil {
		return 0, wrapInfraError("dex launch controller launch time", err)
	}
	return value, nil
}

// Launched reads DexLaunchController launched.
func (p *DexLaunchController) Launched(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "dex launch controller launched"); err != nil {
		return false, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return false, err
	}
	value, err := p.adapter.Launched(ctx)
	if err != nil {
		return false, wrapInfraError("dex launch controller launched", err)
	}
	return value, nil
}

// LpLiquidity reads DexLaunchController lp liquidity.
func (p *DexLaunchController) LpLiquidity(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "dex launch controller lp liquidity"); err != nil {
		return nil, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.LpLiquidity(ctx)
	if err != nil {
		return nil, wrapInfraError("dex launch controller lp liquidity", err)
	}
	return value, nil
}

// LpLockDuration reads DexLaunchController lp lock duration.
func (p *DexLaunchController) LpLockDuration(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "dex launch controller lp lock duration"); err != nil {
		return nil, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.LpLockDuration(ctx)
	if err != nil {
		return nil, wrapInfraError("dex launch controller lp lock duration", err)
	}
	return value, nil
}

// LpLocker reads DexLaunchController lp locker.
func (p *DexLaunchController) LpLocker(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "dex launch controller lp locker"); err != nil {
		return common.Address{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.LpLocker(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("dex launch controller lp locker", err)
	}
	return value, nil
}

// LpTokenID reads DexLaunchController lp token id.
func (p *DexLaunchController) LpTokenID(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "dex launch controller lp token id"); err != nil {
		return nil, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.LpTokenID(ctx)
	if err != nil {
		return nil, wrapInfraError("dex launch controller lp token id", err)
	}
	return value, nil
}

// OddToken reads DexLaunchController odd token.
func (p *DexLaunchController) OddToken(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "dex launch controller odd token"); err != nil {
		return common.Address{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.OddToken(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("dex launch controller odd token", err)
	}
	return value, nil
}

// OddUsed reads DexLaunchController odd used.
func (p *DexLaunchController) OddUsed(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "dex launch controller odd used"); err != nil {
		return nil, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.OddUsed(ctx)
	if err != nil {
		return nil, wrapInfraError("dex launch controller odd used", err)
	}
	return value, nil
}

// Pool reads DexLaunchController pool.
func (p *DexLaunchController) Pool(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "dex launch controller pool"); err != nil {
		return common.Address{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.Pool(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("dex launch controller pool", err)
	}
	return value, nil
}

// PoolFee reads DexLaunchController pool fee.
func (p *DexLaunchController) PoolFee(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "dex launch controller pool fee"); err != nil {
		return nil, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.PoolFee(ctx)
	if err != nil {
		return nil, wrapInfraError("dex launch controller pool fee", err)
	}
	return value, nil
}

// PositionManager reads DexLaunchController position manager.
func (p *DexLaunchController) PositionManager(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "dex launch controller position manager"); err != nil {
		return common.Address{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.PositionManager(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("dex launch controller position manager", err)
	}
	return value, nil
}

// SqrtPriceX96 reads DexLaunchController sqrt price x96.
func (p *DexLaunchController) SqrtPriceX96(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "dex launch controller sqrt price x96"); err != nil {
		return nil, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.SqrtPriceX96(ctx)
	if err != nil {
		return nil, wrapInfraError("dex launch controller sqrt price x96", err)
	}
	return value, nil
}

// TickLower reads DexLaunchController tick lower.
func (p *DexLaunchController) TickLower(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "dex launch controller tick lower"); err != nil {
		return nil, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TickLower(ctx)
	if err != nil {
		return nil, wrapInfraError("dex launch controller tick lower", err)
	}
	return value, nil
}

// TickUpper reads DexLaunchController tick upper.
func (p *DexLaunchController) TickUpper(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "dex launch controller tick upper"); err != nil {
		return nil, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TickUpper(ctx)
	if err != nil {
		return nil, wrapInfraError("dex launch controller tick upper", err)
	}
	return value, nil
}

// TierSale reads DexLaunchController tier sale.
func (p *DexLaunchController) TierSale(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "dex launch controller tier sale"); err != nil {
		return common.Address{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.TierSale(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("dex launch controller tier sale", err)
	}
	return value, nil
}

// TreasurySink reads DexLaunchController treasury sink.
func (p *DexLaunchController) TreasurySink(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "dex launch controller treasury sink"); err != nil {
		return common.Address{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.TreasurySink(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("dex launch controller treasury sink", err)
	}
	return value, nil
}

// Usdt reads DexLaunchController usdt.
func (p *DexLaunchController) Usdt(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "dex launch controller usdt"); err != nil {
		return common.Address{}, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.Usdt(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("dex launch controller usdt", err)
	}
	return value, nil
}

// UsdtUsed reads DexLaunchController usdt used.
func (p *DexLaunchController) UsdtUsed(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "dex launch controller usdt used"); err != nil {
		return nil, err
	}
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.UsdtUsed(ctx)
	if err != nil {
		return nil, wrapInfraError("dex launch controller usdt used", err)
	}
	return value, nil
}

// GrantRole submits a DexLaunchController grant role transaction using caller-supplied opts.
func (p *DexLaunchController) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.GrantRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("dex launch controller grant role", err)
	}
	return tx, nil
}

// RenounceRole submits a DexLaunchController renounce role transaction using caller-supplied opts.
func (p *DexLaunchController) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, wrapInfraError("dex launch controller renounce role", err)
	}
	return tx, nil
}

// RevokeRole submits a DexLaunchController revoke role transaction using caller-supplied opts.
func (p *DexLaunchController) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RevokeRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("dex launch controller revoke role", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits a DexLaunchController upgrade to and call transaction using caller-supplied opts.
func (p *DexLaunchController) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, wrapInfraError("dex launch controller upgrade to and call", err)
	}
	return tx, nil
}

// Pause submits a DexLaunchController pause transaction using caller-supplied opts.
func (p *DexLaunchController) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Pause(opts)
	if err != nil {
		return nil, wrapInfraError("dex launch controller pause", err)
	}
	return tx, nil
}

// Unpause submits a DexLaunchController unpause transaction using caller-supplied opts.
func (p *DexLaunchController) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Unpause(opts)
	if err != nil {
		return nil, wrapInfraError("dex launch controller unpause", err)
	}
	return tx, nil
}

// Initialize submits a DexLaunchController initialize transaction using caller-supplied opts.
func (p *DexLaunchController) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, usdtAddress common.Address, tierSaleAddress common.Address, positionManagerAddress common.Address, lpLockerAddress common.Address, treasurySinkAddress common.Address) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Initialize(opts, admin, oddTokenAddress, usdtAddress, tierSaleAddress, positionManagerAddress, lpLockerAddress, treasurySinkAddress)
	if err != nil {
		return nil, wrapInfraError("dex launch controller initialize", err)
	}
	return tx, nil
}

// Launch submits a DexLaunchController launch transaction using caller-supplied opts.
func (p *DexLaunchController) Launch(opts *bind.TransactOpts, oddAmountDesired *big.Int, usdtAmountDesired *big.Int, oddAmountMin *big.Int, usdtAmountMin *big.Int, deadline *big.Int) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("dex launch controller launch", oddAmountDesired, usdtAmountDesired, oddAmountMin, usdtAmountMin, deadline); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Launch(opts, oddAmountDesired, usdtAmountDesired, oddAmountMin, usdtAmountMin, deadline)
	if err != nil {
		return nil, wrapInfraError("dex launch controller launch", err)
	}
	return tx, nil
}

// SetLaunchConfig submits a DexLaunchController set launch config transaction using caller-supplied opts.
func (p *DexLaunchController) SetLaunchConfig(opts *bind.TransactOpts, newPoolFee *big.Int, newTickLower *big.Int, newTickUpper *big.Int, newSqrtPriceX96 *big.Int, newLpLockDuration *big.Int) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("dex launch controller set launch config", newPoolFee, newTickLower, newTickUpper, newSqrtPriceX96, newLpLockDuration); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetLaunchConfig(opts, newPoolFee, newTickLower, newTickUpper, newSqrtPriceX96, newLpLockDuration)
	if err != nil {
		return nil, wrapInfraError("dex launch controller set launch config", err)
	}
	return tx, nil
}

// SweepRemainder submits a DexLaunchController sweep remainder transaction using caller-supplied opts.
func (p *DexLaunchController) SweepRemainder(opts *bind.TransactOpts, token common.Address, to common.Address, amount *big.Int) (*types.Transaction, error) {
	if err := ensureDexLaunchController(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("dex launch controller sweep remainder", amount); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SweepRemainder(opts, token, to, amount)
	if err != nil {
		return nil, wrapInfraError("dex launch controller sweep remainder", err)
	}
	return tx, nil
}
