package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/dexlplocker"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// DexLpLockerAdapter reads and writes DexLpLocker state through generated bindings.
type DexLpLockerAdapter struct {
	caller     *dexlplocker.DexLpLockerCaller
	transactor *dexlplocker.DexLpLockerTransactor
}

// DexLpLockerLockedPosition is the stored lock state for a Uniswap V3 LP NFT.
type DexLpLockerLockedPosition struct {
	Beneficiary common.Address
	LockedAt    uint64
	UnlockAt    uint64
	Released    bool
}

// NewDexLpLockerAdapter binds a DexLpLocker adapter to proxyAddress.
func NewDexLpLockerAdapter(caller bind.ContractCaller, transactor bind.ContractTransactor, proxyAddress common.Address) (*DexLpLockerAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	boundCaller, err := dexlplocker.NewDexLpLockerCaller(proxyAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind dex lp locker caller: %w", err)
	}
	var boundTransactor *dexlplocker.DexLpLockerTransactor
	if transactor != nil {
		boundTransactor, err = dexlplocker.NewDexLpLockerTransactor(proxyAddress, transactor)
		if err != nil {
			return nil, fmt.Errorf("bind dex lp locker transactor: %w", err)
		}
	}
	return &DexLpLockerAdapter{caller: boundCaller, transactor: boundTransactor}, nil
}

func toDexLpLockerLockedPosition(value struct {
	Beneficiary common.Address
	LockedAt    uint64
	UnlockAt    uint64
	Released    bool
}) DexLpLockerLockedPosition {
	return DexLpLockerLockedPosition{Beneficiary: value.Beneficiary, LockedAt: value.LockedAt, UnlockAt: value.UnlockAt, Released: value.Released}
}

// DefaultAdminRole reads DexLpLocker default admin role.
func (a *DexLpLockerAdapter) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.DEFAULTADMINROLE(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// UpgradeInterfaceVersion reads DexLpLocker upgrade interface version.
func (a *DexLpLockerAdapter) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	value, err := a.caller.UPGRADEINTERFACEVERSION(callOpts(ctx))
	if err != nil {
		return "", err
	}
	return value, nil
}

// GetRoleAdmin reads DexLpLocker get role admin.
func (a *DexLpLockerAdapter) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	value, err := a.caller.GetRoleAdmin(callOpts(ctx), role)
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// HasRole reads DexLpLocker has role.
func (a *DexLpLockerAdapter) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	value, err := a.caller.HasRole(callOpts(ctx), role, account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// Paused reads DexLpLocker paused.
func (a *DexLpLockerAdapter) Paused(ctx context.Context) (bool, error) {
	value, err := a.caller.Paused(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// ProxiableUUID reads DexLpLocker proxiable uuid.
func (a *DexLpLockerAdapter) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.ProxiableUUID(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// SupportsInterface reads DexLpLocker supports interface.
func (a *DexLpLockerAdapter) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	value, err := a.caller.SupportsInterface(callOpts(ctx), interfaceID)
	if err != nil {
		return false, err
	}
	return value, nil
}

// DefaultBeneficiary reads DexLpLocker default beneficiary.
func (a *DexLpLockerAdapter) DefaultBeneficiary(ctx context.Context) (common.Address, error) {
	value, err := a.caller.DefaultBeneficiary(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// PositionManager reads DexLpLocker position manager.
func (a *DexLpLockerAdapter) PositionManager(ctx context.Context) (common.Address, error) {
	value, err := a.caller.PositionManager(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// LockedPosition reads DexLpLocker locked position.
func (a *DexLpLockerAdapter) LockedPosition(ctx context.Context, tokenID *big.Int) (DexLpLockerLockedPosition, error) {
	value, err := a.caller.LockedPositions(callOpts(ctx), tokenID)
	if err != nil {
		return DexLpLockerLockedPosition{}, err
	}
	return toDexLpLockerLockedPosition(value), nil
}

// OnERC721Received reads DexLpLocker on erc721 received.
func (a *DexLpLockerAdapter) OnERC721Received(ctx context.Context, operator common.Address, from common.Address, tokenID *big.Int, data []byte) ([4]byte, error) {
	value, err := a.caller.OnERC721Received(callOpts(ctx), operator, from, tokenID, data)
	if err != nil {
		return [4]byte{}, err
	}
	return value, nil
}

// GrantRole submits the DexLpLocker grant role transaction.
func (a *DexLpLockerAdapter) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.GrantRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker grant role: %w", err)
	}
	return tx, nil
}

// RenounceRole submits the DexLpLocker renounce role transaction.
func (a *DexLpLockerAdapter) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker renounce role: %w", err)
	}
	return tx, nil
}

// RevokeRole submits the DexLpLocker revoke role transaction.
func (a *DexLpLockerAdapter) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RevokeRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker revoke role: %w", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits the DexLpLocker upgrade to and call transaction.
func (a *DexLpLockerAdapter) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker upgrade to and call: %w", err)
	}
	return tx, nil
}

// Pause submits the DexLpLocker pause transaction.
func (a *DexLpLockerAdapter) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Pause(opts)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker pause: %w", err)
	}
	return tx, nil
}

// Unpause submits the DexLpLocker unpause transaction.
func (a *DexLpLockerAdapter) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Unpause(opts)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker unpause: %w", err)
	}
	return tx, nil
}

// Initialize submits the DexLpLocker initialize transaction.
func (a *DexLpLockerAdapter) Initialize(opts *bind.TransactOpts, admin common.Address, positionManagerAddress common.Address, beneficiary common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Initialize(opts, admin, positionManagerAddress, beneficiary)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker initialize: %w", err)
	}
	return tx, nil
}

// LockPosition submits the DexLpLocker lock position transaction.
func (a *DexLpLockerAdapter) LockPosition(opts *bind.TransactOpts, tokenID *big.Int, unlockAt uint64) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.LockPosition(opts, tokenID, unlockAt)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker lock position: %w", err)
	}
	return tx, nil
}

// ReleasePosition submits the DexLpLocker release position transaction.
func (a *DexLpLockerAdapter) ReleasePosition(opts *bind.TransactOpts, tokenID *big.Int, to common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ReleasePosition(opts, tokenID, to)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker release position: %w", err)
	}
	return tx, nil
}

// SetDefaultBeneficiary submits the DexLpLocker set default beneficiary transaction.
func (a *DexLpLockerAdapter) SetDefaultBeneficiary(opts *bind.TransactOpts, beneficiary common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetDefaultBeneficiary(opts, beneficiary)
	if err != nil {
		return nil, fmt.Errorf("dex lp locker set default beneficiary: %w", err)
	}
	return tx, nil
}
