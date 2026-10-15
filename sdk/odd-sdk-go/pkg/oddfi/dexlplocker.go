package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// DexLpLocker exposes the DexLpLocker proxy API. Methods are safe for concurrent
// use and RPC reads block until the backend returns or ctx is canceled.
type DexLpLocker struct {
	adapter *contracts.DexLpLockerAdapter
}

// DexLpLockerLockedPosition is the stored lock state for a Uniswap V3 LP NFT.
type DexLpLockerLockedPosition struct {
	Beneficiary common.Address
	LockedAt    uint64
	UnlockAt    uint64
	Released    bool
}

func toPublicDexLpLockerLockedPosition(value contracts.DexLpLockerLockedPosition) DexLpLockerLockedPosition {
	return DexLpLockerLockedPosition{Beneficiary: value.Beneficiary, LockedAt: value.LockedAt, UnlockAt: value.UnlockAt, Released: value.Released}
}

// DefaultAdminRole reads DexLpLocker default admin role.
func (p *DexLpLocker) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "dex lp locker default admin role"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.DefaultAdminRole(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("dex lp locker default admin role", err)
	}
	return value, nil
}

// UpgradeInterfaceVersion reads DexLpLocker upgrade interface version.
func (p *DexLpLocker) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "dex lp locker upgrade interface version"); err != nil {
		return "", err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return "", err
	}
	value, err := p.adapter.UpgradeInterfaceVersion(ctx)
	if err != nil {
		return "", wrapInfraError("dex lp locker upgrade interface version", err)
	}
	return value, nil
}

// GetRoleAdmin reads DexLpLocker get role admin.
func (p *DexLpLocker) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	if err := checkContext(ctx, "dex lp locker get role admin"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.GetRoleAdmin(ctx, role)
	if err != nil {
		return [32]byte{}, wrapInfraError("dex lp locker get role admin", err)
	}
	return value, nil
}

// HasRole reads DexLpLocker has role.
func (p *DexLpLocker) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	if err := checkContext(ctx, "dex lp locker has role"); err != nil {
		return false, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return false, err
	}
	value, err := p.adapter.HasRole(ctx, role, account)
	if err != nil {
		return false, wrapInfraError("dex lp locker has role", err)
	}
	return value, nil
}

// Paused reads DexLpLocker paused.
func (p *DexLpLocker) Paused(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "dex lp locker paused"); err != nil {
		return false, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return false, err
	}
	value, err := p.adapter.Paused(ctx)
	if err != nil {
		return false, wrapInfraError("dex lp locker paused", err)
	}
	return value, nil
}

// ProxiableUUID reads DexLpLocker proxiable uuid.
func (p *DexLpLocker) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "dex lp locker proxiable uuid"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.ProxiableUUID(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("dex lp locker proxiable uuid", err)
	}
	return value, nil
}

// SupportsInterface reads DexLpLocker supports interface.
func (p *DexLpLocker) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	if err := checkContext(ctx, "dex lp locker supports interface"); err != nil {
		return false, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SupportsInterface(ctx, interfaceID)
	if err != nil {
		return false, wrapInfraError("dex lp locker supports interface", err)
	}
	return value, nil
}

// DefaultBeneficiary reads DexLpLocker default beneficiary.
func (p *DexLpLocker) DefaultBeneficiary(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "dex lp locker default beneficiary"); err != nil {
		return common.Address{}, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.DefaultBeneficiary(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("dex lp locker default beneficiary", err)
	}
	return value, nil
}

// PositionManager reads DexLpLocker position manager.
func (p *DexLpLocker) PositionManager(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "dex lp locker position manager"); err != nil {
		return common.Address{}, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.PositionManager(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("dex lp locker position manager", err)
	}
	return value, nil
}

// LockedPosition reads DexLpLocker locked position.
func (p *DexLpLocker) LockedPosition(ctx context.Context, tokenID *big.Int) (DexLpLockerLockedPosition, error) {
	if err := checkContext(ctx, "dex lp locker locked position"); err != nil {
		return DexLpLockerLockedPosition{}, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return DexLpLockerLockedPosition{}, err
	}
	if err := requireBigInts("dex lp locker locked position", tokenID); err != nil {
		return DexLpLockerLockedPosition{}, err
	}
	value, err := p.adapter.LockedPosition(ctx, tokenID)
	if err != nil {
		return DexLpLockerLockedPosition{}, wrapInfraError("dex lp locker locked position", err)
	}
	return toPublicDexLpLockerLockedPosition(value), nil
}

// OnERC721Received reads DexLpLocker on erc721 received.
func (p *DexLpLocker) OnERC721Received(ctx context.Context, operator common.Address, from common.Address, tokenID *big.Int, data []byte) ([4]byte, error) {
	if err := checkContext(ctx, "dex lp locker on erc721 received"); err != nil {
		return [4]byte{}, err
	}
	if err := ensureDexLpLocker(p); err != nil {
		return [4]byte{}, err
	}
	if err := requireBigInts("dex lp locker on erc721 received", tokenID); err != nil {
		return [4]byte{}, err
	}
	value, err := p.adapter.OnERC721Received(ctx, operator, from, tokenID, data)
	if err != nil {
		return [4]byte{}, wrapInfraError("dex lp locker on erc721 received", err)
	}
	return value, nil
}

// GrantRole submits a DexLpLocker grant role transaction using caller-supplied opts.
func (p *DexLpLocker) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.GrantRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("dex lp locker grant role", err)
	}
	return tx, nil
}

// RenounceRole submits a DexLpLocker renounce role transaction using caller-supplied opts.
func (p *DexLpLocker) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, wrapInfraError("dex lp locker renounce role", err)
	}
	return tx, nil
}

// RevokeRole submits a DexLpLocker revoke role transaction using caller-supplied opts.
func (p *DexLpLocker) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RevokeRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("dex lp locker revoke role", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits a DexLpLocker upgrade to and call transaction using caller-supplied opts.
func (p *DexLpLocker) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, wrapInfraError("dex lp locker upgrade to and call", err)
	}
	return tx, nil
}

// Pause submits a DexLpLocker pause transaction using caller-supplied opts.
func (p *DexLpLocker) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Pause(opts)
	if err != nil {
		return nil, wrapInfraError("dex lp locker pause", err)
	}
	return tx, nil
}

// Unpause submits a DexLpLocker unpause transaction using caller-supplied opts.
func (p *DexLpLocker) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Unpause(opts)
	if err != nil {
		return nil, wrapInfraError("dex lp locker unpause", err)
	}
	return tx, nil
}

// Initialize submits a DexLpLocker initialize transaction using caller-supplied opts.
func (p *DexLpLocker) Initialize(opts *bind.TransactOpts, admin common.Address, positionManagerAddress common.Address, beneficiary common.Address) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Initialize(opts, admin, positionManagerAddress, beneficiary)
	if err != nil {
		return nil, wrapInfraError("dex lp locker initialize", err)
	}
	return tx, nil
}

// LockPosition submits a DexLpLocker lock position transaction using caller-supplied opts.
func (p *DexLpLocker) LockPosition(opts *bind.TransactOpts, tokenID *big.Int, unlockAt uint64) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("dex lp locker lock position", tokenID); err != nil {
		return nil, err
	}
	tx, err := p.adapter.LockPosition(opts, tokenID, unlockAt)
	if err != nil {
		return nil, wrapInfraError("dex lp locker lock position", err)
	}
	return tx, nil
}

// ReleasePosition submits a DexLpLocker release position transaction using caller-supplied opts.
func (p *DexLpLocker) ReleasePosition(opts *bind.TransactOpts, tokenID *big.Int, to common.Address) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("dex lp locker release position", tokenID); err != nil {
		return nil, err
	}
	tx, err := p.adapter.ReleasePosition(opts, tokenID, to)
	if err != nil {
		return nil, wrapInfraError("dex lp locker release position", err)
	}
	return tx, nil
}

// SetDefaultBeneficiary submits a DexLpLocker set default beneficiary transaction using caller-supplied opts.
func (p *DexLpLocker) SetDefaultBeneficiary(opts *bind.TransactOpts, beneficiary common.Address) (*types.Transaction, error) {
	if err := ensureDexLpLocker(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetDefaultBeneficiary(opts, beneficiary)
	if err != nil {
		return nil, wrapInfraError("dex lp locker set default beneficiary", err)
	}
	return tx, nil
}
