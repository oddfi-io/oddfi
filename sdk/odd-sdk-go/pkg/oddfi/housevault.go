package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// HouseVault exposes the HouseVault proxy API. Methods are safe for concurrent
// use and RPC reads block until the backend returns or ctx is canceled.
type HouseVault struct {
	adapter *contracts.HouseVaultAdapter
}

// DefaultAdminRole reads HouseVault default admin role.
func (p *HouseVault) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "house vault default admin role"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureHouseVault(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.DefaultAdminRole(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("house vault default admin role", err)
	}
	return value, nil
}

// UpgradeInterfaceVersion reads HouseVault upgrade interface version.
func (p *HouseVault) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "house vault upgrade interface version"); err != nil {
		return "", err
	}
	if err := ensureHouseVault(p); err != nil {
		return "", err
	}
	value, err := p.adapter.UpgradeInterfaceVersion(ctx)
	if err != nil {
		return "", wrapInfraError("house vault upgrade interface version", err)
	}
	return value, nil
}

// GetRoleAdmin reads HouseVault get role admin.
func (p *HouseVault) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	if err := checkContext(ctx, "house vault get role admin"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureHouseVault(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.GetRoleAdmin(ctx, role)
	if err != nil {
		return [32]byte{}, wrapInfraError("house vault get role admin", err)
	}
	return value, nil
}

// HasRole reads HouseVault has role.
func (p *HouseVault) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	if err := checkContext(ctx, "house vault has role"); err != nil {
		return false, err
	}
	if err := ensureHouseVault(p); err != nil {
		return false, err
	}
	value, err := p.adapter.HasRole(ctx, role, account)
	if err != nil {
		return false, wrapInfraError("house vault has role", err)
	}
	return value, nil
}

// Paused reads HouseVault paused.
func (p *HouseVault) Paused(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "house vault paused"); err != nil {
		return false, err
	}
	if err := ensureHouseVault(p); err != nil {
		return false, err
	}
	value, err := p.adapter.Paused(ctx)
	if err != nil {
		return false, wrapInfraError("house vault paused", err)
	}
	return value, nil
}

// ProxiableUUID reads HouseVault proxiable uuid.
func (p *HouseVault) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "house vault proxiable uuid"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureHouseVault(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.ProxiableUUID(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("house vault proxiable uuid", err)
	}
	return value, nil
}

// SupportsInterface reads HouseVault supports interface.
func (p *HouseVault) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	if err := checkContext(ctx, "house vault supports interface"); err != nil {
		return false, err
	}
	if err := ensureHouseVault(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SupportsInterface(ctx, interfaceID)
	if err != nil {
		return false, wrapInfraError("house vault supports interface", err)
	}
	return value, nil
}

// OddToken reads HouseVault odd token.
func (p *HouseVault) OddToken(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "house vault odd token"); err != nil {
		return common.Address{}, err
	}
	if err := ensureHouseVault(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.OddToken(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("house vault odd token", err)
	}
	return value, nil
}

// GrantRole submits a HouseVault grant role transaction using caller-supplied opts.
func (p *HouseVault) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureHouseVault(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.GrantRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("house vault grant role", err)
	}
	return tx, nil
}

// RenounceRole submits a HouseVault renounce role transaction using caller-supplied opts.
func (p *HouseVault) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if err := ensureHouseVault(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, wrapInfraError("house vault renounce role", err)
	}
	return tx, nil
}

// RevokeRole submits a HouseVault revoke role transaction using caller-supplied opts.
func (p *HouseVault) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureHouseVault(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RevokeRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("house vault revoke role", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits a HouseVault upgrade to and call transaction using caller-supplied opts.
func (p *HouseVault) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if err := ensureHouseVault(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, wrapInfraError("house vault upgrade to and call", err)
	}
	return tx, nil
}

// Pause submits a HouseVault pause transaction using caller-supplied opts.
func (p *HouseVault) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureHouseVault(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Pause(opts)
	if err != nil {
		return nil, wrapInfraError("house vault pause", err)
	}
	return tx, nil
}

// Unpause submits a HouseVault unpause transaction using caller-supplied opts.
func (p *HouseVault) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureHouseVault(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Unpause(opts)
	if err != nil {
		return nil, wrapInfraError("house vault unpause", err)
	}
	return tx, nil
}

// Initialize submits a HouseVault initialize transaction using caller-supplied opts.
func (p *HouseVault) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address) (*types.Transaction, error) {
	if err := ensureHouseVault(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Initialize(opts, admin, oddTokenAddress)
	if err != nil {
		return nil, wrapInfraError("house vault initialize", err)
	}
	return tx, nil
}

// FundBettingPlatformReserve submits a HouseVault fund betting platform reserve transaction using caller-supplied opts.
func (p *HouseVault) FundBettingPlatformReserve(opts *bind.TransactOpts, bettingPool common.Address, amount *big.Int) (*types.Transaction, error) {
	if err := ensureHouseVault(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("house vault fund betting platform reserve", amount); err != nil {
		return nil, err
	}
	tx, err := p.adapter.FundBettingPlatformReserve(opts, bettingPool, amount)
	if err != nil {
		return nil, wrapInfraError("house vault fund betting platform reserve", err)
	}
	return tx, nil
}

// TransferOdd submits a HouseVault transfer odd transaction using caller-supplied opts.
func (p *HouseVault) TransferOdd(opts *bind.TransactOpts, to common.Address, amount *big.Int) (*types.Transaction, error) {
	if err := ensureHouseVault(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("house vault transfer odd", amount); err != nil {
		return nil, err
	}
	tx, err := p.adapter.TransferOdd(opts, to, amount)
	if err != nil {
		return nil, wrapInfraError("house vault transfer odd", err)
	}
	return tx, nil
}
