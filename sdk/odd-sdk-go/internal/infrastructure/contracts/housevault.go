package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/housevault"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// HouseVaultAdapter reads and writes HouseVault state through generated bindings.
type HouseVaultAdapter struct {
	caller     *housevault.HouseVaultCaller
	transactor *housevault.HouseVaultTransactor
}

// NewHouseVaultAdapter binds a HouseVault adapter to proxyAddress.
func NewHouseVaultAdapter(caller bind.ContractCaller, transactor bind.ContractTransactor, proxyAddress common.Address) (*HouseVaultAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	boundCaller, err := housevault.NewHouseVaultCaller(proxyAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind house vault caller: %w", err)
	}
	var boundTransactor *housevault.HouseVaultTransactor
	if transactor != nil {
		boundTransactor, err = housevault.NewHouseVaultTransactor(proxyAddress, transactor)
		if err != nil {
			return nil, fmt.Errorf("bind house vault transactor: %w", err)
		}
	}
	return &HouseVaultAdapter{caller: boundCaller, transactor: boundTransactor}, nil
}

// DefaultAdminRole reads HouseVault default admin role.
func (a *HouseVaultAdapter) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.DEFAULTADMINROLE(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// UpgradeInterfaceVersion reads HouseVault upgrade interface version.
func (a *HouseVaultAdapter) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	value, err := a.caller.UPGRADEINTERFACEVERSION(callOpts(ctx))
	if err != nil {
		return "", err
	}
	return value, nil
}

// GetRoleAdmin reads HouseVault get role admin.
func (a *HouseVaultAdapter) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	value, err := a.caller.GetRoleAdmin(callOpts(ctx), role)
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// HasRole reads HouseVault has role.
func (a *HouseVaultAdapter) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	value, err := a.caller.HasRole(callOpts(ctx), role, account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// Paused reads HouseVault paused.
func (a *HouseVaultAdapter) Paused(ctx context.Context) (bool, error) {
	value, err := a.caller.Paused(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// ProxiableUUID reads HouseVault proxiable uuid.
func (a *HouseVaultAdapter) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.ProxiableUUID(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// SupportsInterface reads HouseVault supports interface.
func (a *HouseVaultAdapter) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	value, err := a.caller.SupportsInterface(callOpts(ctx), interfaceID)
	if err != nil {
		return false, err
	}
	return value, nil
}

// OddToken reads HouseVault odd token.
func (a *HouseVaultAdapter) OddToken(ctx context.Context) (common.Address, error) {
	value, err := a.caller.OddToken(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// GrantRole submits the HouseVault grant role transaction.
func (a *HouseVaultAdapter) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.GrantRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("house vault grant role: %w", err)
	}
	return tx, nil
}

// RenounceRole submits the HouseVault renounce role transaction.
func (a *HouseVaultAdapter) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("house vault renounce role: %w", err)
	}
	return tx, nil
}

// RevokeRole submits the HouseVault revoke role transaction.
func (a *HouseVaultAdapter) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RevokeRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("house vault revoke role: %w", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits the HouseVault upgrade to and call transaction.
func (a *HouseVaultAdapter) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, fmt.Errorf("house vault upgrade to and call: %w", err)
	}
	return tx, nil
}

// Pause submits the HouseVault pause transaction.
func (a *HouseVaultAdapter) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Pause(opts)
	if err != nil {
		return nil, fmt.Errorf("house vault pause: %w", err)
	}
	return tx, nil
}

// Unpause submits the HouseVault unpause transaction.
func (a *HouseVaultAdapter) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Unpause(opts)
	if err != nil {
		return nil, fmt.Errorf("house vault unpause: %w", err)
	}
	return tx, nil
}

// Initialize submits the HouseVault initialize transaction.
func (a *HouseVaultAdapter) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Initialize(opts, admin, oddTokenAddress)
	if err != nil {
		return nil, fmt.Errorf("house vault initialize: %w", err)
	}
	return tx, nil
}

// FundBettingPlatformReserve submits the HouseVault fund betting platform reserve transaction.
func (a *HouseVaultAdapter) FundBettingPlatformReserve(opts *bind.TransactOpts, bettingPool common.Address, amount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.FundBettingPlatformReserve(opts, bettingPool, amount)
	if err != nil {
		return nil, fmt.Errorf("house vault fund betting platform reserve: %w", err)
	}
	return tx, nil
}

// TransferOdd submits the HouseVault transfer odd transaction.
func (a *HouseVaultAdapter) TransferOdd(opts *bind.TransactOpts, to common.Address, amount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.TransferOdd(opts, to, amount)
	if err != nil {
		return nil, fmt.Errorf("house vault transfer odd: %w", err)
	}
	return tx, nil
}
