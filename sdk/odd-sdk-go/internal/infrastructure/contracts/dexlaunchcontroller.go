package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/dexlaunchcontroller"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// DexLaunchControllerAdapter reads and writes DexLaunchController state through generated bindings.
type DexLaunchControllerAdapter struct {
	caller     *dexlaunchcontroller.DexLaunchControllerCaller
	transactor *dexlaunchcontroller.DexLaunchControllerTransactor
}

// NewDexLaunchControllerAdapter binds a DexLaunchController adapter to proxyAddress.
func NewDexLaunchControllerAdapter(caller bind.ContractCaller, transactor bind.ContractTransactor, proxyAddress common.Address) (*DexLaunchControllerAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	boundCaller, err := dexlaunchcontroller.NewDexLaunchControllerCaller(proxyAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind dex launch controller caller: %w", err)
	}
	var boundTransactor *dexlaunchcontroller.DexLaunchControllerTransactor
	if transactor != nil {
		boundTransactor, err = dexlaunchcontroller.NewDexLaunchControllerTransactor(proxyAddress, transactor)
		if err != nil {
			return nil, fmt.Errorf("bind dex launch controller transactor: %w", err)
		}
	}
	return &DexLaunchControllerAdapter{caller: boundCaller, transactor: boundTransactor}, nil
}

// DefaultAdminRole reads DexLaunchController default admin role.
func (a *DexLaunchControllerAdapter) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.DEFAULTADMINROLE(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// UpgradeInterfaceVersion reads DexLaunchController upgrade interface version.
func (a *DexLaunchControllerAdapter) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	value, err := a.caller.UPGRADEINTERFACEVERSION(callOpts(ctx))
	if err != nil {
		return "", err
	}
	return value, nil
}

// GetRoleAdmin reads DexLaunchController get role admin.
func (a *DexLaunchControllerAdapter) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	value, err := a.caller.GetRoleAdmin(callOpts(ctx), role)
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// HasRole reads DexLaunchController has role.
func (a *DexLaunchControllerAdapter) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	value, err := a.caller.HasRole(callOpts(ctx), role, account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// Paused reads DexLaunchController paused.
func (a *DexLaunchControllerAdapter) Paused(ctx context.Context) (bool, error) {
	value, err := a.caller.Paused(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// ProxiableUUID reads DexLaunchController proxiable uuid.
func (a *DexLaunchControllerAdapter) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.ProxiableUUID(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// SupportsInterface reads DexLaunchController supports interface.
func (a *DexLaunchControllerAdapter) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	value, err := a.caller.SupportsInterface(callOpts(ctx), interfaceID)
	if err != nil {
		return false, err
	}
	return value, nil
}

// LaunchTime reads DexLaunchController launch time.
func (a *DexLaunchControllerAdapter) LaunchTime(ctx context.Context) (uint64, error) {
	value, err := a.caller.LaunchTime(callOpts(ctx))
	if err != nil {
		return 0, err
	}
	return value, nil
}

// Launched reads DexLaunchController launched.
func (a *DexLaunchControllerAdapter) Launched(ctx context.Context) (bool, error) {
	value, err := a.caller.Launched(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// LpLiquidity reads DexLaunchController lp liquidity.
func (a *DexLaunchControllerAdapter) LpLiquidity(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.LpLiquidity(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// LpLockDuration reads DexLaunchController lp lock duration.
func (a *DexLaunchControllerAdapter) LpLockDuration(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.LpLockDuration(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// LpLocker reads DexLaunchController lp locker.
func (a *DexLaunchControllerAdapter) LpLocker(ctx context.Context) (common.Address, error) {
	value, err := a.caller.LpLocker(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// LpTokenID reads DexLaunchController lp token id.
func (a *DexLaunchControllerAdapter) LpTokenID(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.LpTokenId(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// OddToken reads DexLaunchController odd token.
func (a *DexLaunchControllerAdapter) OddToken(ctx context.Context) (common.Address, error) {
	value, err := a.caller.OddToken(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// OddUsed reads DexLaunchController odd used.
func (a *DexLaunchControllerAdapter) OddUsed(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.OddUsed(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// Pool reads DexLaunchController pool.
func (a *DexLaunchControllerAdapter) Pool(ctx context.Context) (common.Address, error) {
	value, err := a.caller.Pool(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// PoolFee reads DexLaunchController pool fee.
func (a *DexLaunchControllerAdapter) PoolFee(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.PoolFee(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// PositionManager reads DexLaunchController position manager.
func (a *DexLaunchControllerAdapter) PositionManager(ctx context.Context) (common.Address, error) {
	value, err := a.caller.PositionManager(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// SqrtPriceX96 reads DexLaunchController sqrt price x96.
func (a *DexLaunchControllerAdapter) SqrtPriceX96(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.SqrtPriceX96(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TickLower reads DexLaunchController tick lower.
func (a *DexLaunchControllerAdapter) TickLower(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TickLower(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TickUpper reads DexLaunchController tick upper.
func (a *DexLaunchControllerAdapter) TickUpper(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TickUpper(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TierSale reads DexLaunchController tier sale.
func (a *DexLaunchControllerAdapter) TierSale(ctx context.Context) (common.Address, error) {
	value, err := a.caller.TierSale(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// TreasurySink reads DexLaunchController treasury sink.
func (a *DexLaunchControllerAdapter) TreasurySink(ctx context.Context) (common.Address, error) {
	value, err := a.caller.TreasurySink(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// Usdt reads DexLaunchController usdt.
func (a *DexLaunchControllerAdapter) Usdt(ctx context.Context) (common.Address, error) {
	value, err := a.caller.Usdt(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// UsdtUsed reads DexLaunchController usdt used.
func (a *DexLaunchControllerAdapter) UsdtUsed(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.UsdtUsed(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// GrantRole submits the DexLaunchController grant role transaction.
func (a *DexLaunchControllerAdapter) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.GrantRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller grant role: %w", err)
	}
	return tx, nil
}

// RenounceRole submits the DexLaunchController renounce role transaction.
func (a *DexLaunchControllerAdapter) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller renounce role: %w", err)
	}
	return tx, nil
}

// RevokeRole submits the DexLaunchController revoke role transaction.
func (a *DexLaunchControllerAdapter) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RevokeRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller revoke role: %w", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits the DexLaunchController upgrade to and call transaction.
func (a *DexLaunchControllerAdapter) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller upgrade to and call: %w", err)
	}
	return tx, nil
}

// Pause submits the DexLaunchController pause transaction.
func (a *DexLaunchControllerAdapter) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Pause(opts)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller pause: %w", err)
	}
	return tx, nil
}

// Unpause submits the DexLaunchController unpause transaction.
func (a *DexLaunchControllerAdapter) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Unpause(opts)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller unpause: %w", err)
	}
	return tx, nil
}

// Initialize submits the DexLaunchController initialize transaction.
func (a *DexLaunchControllerAdapter) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address, usdtAddress common.Address, tierSaleAddress common.Address, positionManagerAddress common.Address, lpLockerAddress common.Address, treasurySinkAddress common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Initialize(opts, admin, oddTokenAddress, usdtAddress, tierSaleAddress, positionManagerAddress, lpLockerAddress, treasurySinkAddress)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller initialize: %w", err)
	}
	return tx, nil
}

// Launch submits the DexLaunchController launch transaction.
func (a *DexLaunchControllerAdapter) Launch(opts *bind.TransactOpts, oddAmountDesired *big.Int, usdtAmountDesired *big.Int, oddAmountMin *big.Int, usdtAmountMin *big.Int, deadline *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Launch(opts, oddAmountDesired, usdtAmountDesired, oddAmountMin, usdtAmountMin, deadline)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller launch: %w", err)
	}
	return tx, nil
}

// SetLaunchConfig submits the DexLaunchController set launch config transaction.
func (a *DexLaunchControllerAdapter) SetLaunchConfig(opts *bind.TransactOpts, newPoolFee *big.Int, newTickLower *big.Int, newTickUpper *big.Int, newSqrtPriceX96 *big.Int, newLpLockDuration *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetLaunchConfig(opts, newPoolFee, newTickLower, newTickUpper, newSqrtPriceX96, newLpLockDuration)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller set launch config: %w", err)
	}
	return tx, nil
}

// SweepRemainder submits the DexLaunchController sweep remainder transaction.
func (a *DexLaunchControllerAdapter) SweepRemainder(opts *bind.TransactOpts, token common.Address, to common.Address, amount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SweepRemainder(opts, token, to, amount)
	if err != nil {
		return nil, fmt.Errorf("dex launch controller sweep remainder: %w", err)
	}
	return tx, nil
}
