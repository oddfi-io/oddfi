package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// ODDToken exposes read-only ODD token calls. Methods are safe for concurrent
// use and block on RPC until the backend returns or ctx is canceled.
type ODDToken struct {
	adapter *contracts.ODDTokenAdapter
}

// Name reads the ODDToken name.
func (t *ODDToken) Name(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "odd token name"); err != nil {
		return "", err
	}
	if err := ensureODDToken(t); err != nil {
		return "", err
	}
	value, err := t.adapter.Name(ctx)
	if err != nil {
		return "", wrapInfraError("odd token name", err)
	}
	return value, nil
}

// Symbol reads the ODDToken symbol.
func (t *ODDToken) Symbol(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "odd token symbol"); err != nil {
		return "", err
	}
	if err := ensureODDToken(t); err != nil {
		return "", err
	}
	value, err := t.adapter.Symbol(ctx)
	if err != nil {
		return "", wrapInfraError("odd token symbol", err)
	}
	return value, nil
}

// Decimals reads the ODDToken decimals.
func (t *ODDToken) Decimals(ctx context.Context) (uint8, error) {
	if err := checkContext(ctx, "odd token decimals"); err != nil {
		return 0, err
	}
	if err := ensureODDToken(t); err != nil {
		return 0, err
	}
	value, err := t.adapter.Decimals(ctx)
	if err != nil {
		return 0, wrapInfraError("odd token decimals", err)
	}
	return value, nil
}

// TotalSupply reads the ODDToken total supply in the token minimum unit.
func (t *ODDToken) TotalSupply(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "odd token total supply"); err != nil {
		return nil, err
	}
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	amount, err := t.adapter.TotalSupply(ctx)
	if err != nil {
		return nil, wrapInfraError("odd token total supply", err)
	}
	return amount, nil
}

// BalanceOf reads account balance in the token minimum unit.
func (t *ODDToken) BalanceOf(ctx context.Context, account common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "odd token balance of"); err != nil {
		return nil, err
	}
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	amount, err := t.adapter.BalanceOf(ctx, account)
	if err != nil {
		return nil, wrapInfraError("odd token balance of", err)
	}
	return amount, nil
}

// Allowance reads owner approval for spender in the token minimum unit.
func (t *ODDToken) Allowance(ctx context.Context, owner common.Address, spender common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "odd token allowance"); err != nil {
		return nil, err
	}
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	amount, err := t.adapter.Allowance(ctx, owner, spender)
	if err != nil {
		return nil, wrapInfraError("odd token allowance", err)
	}
	return amount, nil
}

// Paused reads whether ODDToken transfers are currently paused.
func (t *ODDToken) Paused(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "odd token paused"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.Paused(ctx)
	if err != nil {
		return false, wrapInfraError("odd token paused", err)
	}
	return value, nil
}

// DefaultAdminRole reads the OpenZeppelin default admin role id.
func (t *ODDToken) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "odd token default admin role"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return [32]byte{}, err
	}
	value, err := t.adapter.DefaultAdminRole(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("odd token default admin role", err)
	}
	return value, nil
}

// UpgradeInterfaceVersion reads the UUPS interface version string.
func (t *ODDToken) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "odd token upgrade interface version"); err != nil {
		return "", err
	}
	if err := ensureODDToken(t); err != nil {
		return "", err
	}
	value, err := t.adapter.UpgradeInterfaceVersion(ctx)
	if err != nil {
		return "", wrapInfraError("odd token upgrade interface version", err)
	}
	return value, nil
}

// ProxiableUUID reads the UUPS implementation slot UUID.
func (t *ODDToken) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "odd token proxiable uuid"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return [32]byte{}, err
	}
	value, err := t.adapter.ProxiableUUID(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("odd token proxiable uuid", err)
	}
	return value, nil
}

// SupportsInterface returns true when ODDToken supports interfaceID.
func (t *ODDToken) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	if err := checkContext(ctx, "odd token supports interface"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.SupportsInterface(ctx, interfaceID)
	if err != nil {
		return false, wrapInfraError("odd token supports interface", err)
	}
	return value, nil
}

// HasRole returns true when account holds role on ODDToken.
func (t *ODDToken) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	if err := checkContext(ctx, "odd token has role"); err != nil {
		return false, err
	}
	if err := ensureODDToken(t); err != nil {
		return false, err
	}
	value, err := t.adapter.HasRole(ctx, role, account)
	if err != nil {
		return false, wrapInfraError("odd token has role", err)
	}
	return value, nil
}

// GetRoleAdmin reads the admin role for role on ODDToken.
func (t *ODDToken) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	if err := checkContext(ctx, "odd token get role admin"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureODDToken(t); err != nil {
		return [32]byte{}, err
	}
	value, err := t.adapter.GetRoleAdmin(ctx, role)
	if err != nil {
		return [32]byte{}, wrapInfraError("odd token get role admin", err)
	}
	return value, nil
}

// Transfer submits an ODDToken transfer transaction using opts supplied by the caller.
func (t *ODDToken) Transfer(opts *bind.TransactOpts, to common.Address, value *big.Int) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.Transfer(opts, to, value)
	if err != nil {
		return nil, wrapInfraError("odd token transfer", err)
	}
	return tx, nil
}

// TransferFrom submits an ODDToken transferFrom transaction using opts supplied by the caller.
func (t *ODDToken) TransferFrom(opts *bind.TransactOpts, from common.Address, to common.Address, value *big.Int) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.TransferFrom(opts, from, to, value)
	if err != nil {
		return nil, wrapInfraError("odd token transfer from", err)
	}
	return tx, nil
}

// GrantRole grants a role to an account. Caller must hold the admin role for the target role.
func (t *ODDToken) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.GrantRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("odd token grant role", err)
	}
	return tx, nil
}

// RevokeRole revokes a role from an account. Caller must hold the admin role for the target role.
func (t *ODDToken) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.RevokeRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("odd token revoke role", err)
	}
	return tx, nil
}

// RenounceRole renounces a role held by the caller.
func (t *ODDToken) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, wrapInfraError("odd token renounce role", err)
	}
	return tx, nil
}

// Pause pauses token transfers. Caller must hold PAUSER_ROLE.
func (t *ODDToken) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.Pause(opts)
	if err != nil {
		return nil, wrapInfraError("odd token pause", err)
	}
	return tx, nil
}

// Unpause unpauses token transfers. Caller must hold PAUSER_ROLE.
func (t *ODDToken) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.Unpause(opts)
	if err != nil {
		return nil, wrapInfraError("odd token unpause", err)
	}
	return tx, nil
}

// UpgradeToAndCall upgrades the ODDToken proxy and optionally executes initialization calldata.
func (t *ODDToken) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, wrapInfraError("odd token upgrade to and call", err)
	}
	return tx, nil
}

// Approve submits an ODDToken approve transaction using opts supplied by the caller.
func (t *ODDToken) Approve(opts *bind.TransactOpts, spender common.Address, value *big.Int) (*types.Transaction, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	tx, err := t.adapter.Approve(opts, spender, value)
	if err != nil {
		return nil, wrapInfraError("odd token approve", err)
	}
	return tx, nil
}

// TransferCalldata returns ABI-encoded calldata for ODDToken.transfer; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (t *ODDToken) TransferCalldata(to common.Address, value *big.Int) ([]byte, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if value == nil {
		return nil, wrapUserError("odd token transfer calldata", ErrNilBigIntParam)
	}
	data, err := t.adapter.TransferCalldata(to, value)
	if err != nil {
		return nil, wrapUserError("odd token transfer calldata", err)
	}
	return data, nil
}

// ApproveCalldata returns ABI-encoded calldata for ODDToken.approve; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (t *ODDToken) ApproveCalldata(spender common.Address, value *big.Int) ([]byte, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if value == nil {
		return nil, wrapUserError("odd token approve calldata", ErrNilBigIntParam)
	}
	data, err := t.adapter.ApproveCalldata(spender, value)
	if err != nil {
		return nil, wrapUserError("odd token approve calldata", err)
	}
	return data, nil
}

// TransferFromCalldata returns ABI-encoded calldata for ODDToken.transferFrom; does not sign, broadcast, or query RPC.
func (t *ODDToken) TransferFromCalldata(from common.Address, to common.Address, value *big.Int) ([]byte, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	if value == nil {
		return nil, wrapUserError("odd token transfer from calldata", ErrNilBigIntParam)
	}
	data, err := t.adapter.TransferFromCalldata(from, to, value)
	if err != nil {
		return nil, wrapUserError("odd token transfer from calldata", err)
	}
	return data, nil
}

// GrantRoleCalldata returns ABI-encoded calldata for ODDToken.grantRole; does not sign, broadcast, or query RPC.
func (t *ODDToken) GrantRoleCalldata(role [32]byte, account common.Address) ([]byte, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	data, err := t.adapter.GrantRoleCalldata(role, account)
	if err != nil {
		return nil, wrapUserError("odd token grant role calldata", err)
	}
	return data, nil
}

// RevokeRoleCalldata returns ABI-encoded calldata for ODDToken.revokeRole; does not sign, broadcast, or query RPC.
func (t *ODDToken) RevokeRoleCalldata(role [32]byte, account common.Address) ([]byte, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	data, err := t.adapter.RevokeRoleCalldata(role, account)
	if err != nil {
		return nil, wrapUserError("odd token revoke role calldata", err)
	}
	return data, nil
}

// RenounceRoleCalldata returns ABI-encoded calldata for ODDToken.renounceRole; does not sign, broadcast, or query RPC.
func (t *ODDToken) RenounceRoleCalldata(role [32]byte, callerConfirmation common.Address) ([]byte, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	data, err := t.adapter.RenounceRoleCalldata(role, callerConfirmation)
	if err != nil {
		return nil, wrapUserError("odd token renounce role calldata", err)
	}
	return data, nil
}

// PauseCalldata returns ABI-encoded calldata for ODDToken.pause; does not sign, broadcast, or query RPC.
func (t *ODDToken) PauseCalldata() ([]byte, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	data, err := t.adapter.PauseCalldata()
	if err != nil {
		return nil, wrapUserError("odd token pause calldata", err)
	}
	return data, nil
}

// UnpauseCalldata returns ABI-encoded calldata for ODDToken.unpause; does not sign, broadcast, or query RPC.
func (t *ODDToken) UnpauseCalldata() ([]byte, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	data, err := t.adapter.UnpauseCalldata()
	if err != nil {
		return nil, wrapUserError("odd token unpause calldata", err)
	}
	return data, nil
}

// UpgradeToAndCallCalldata returns ABI-encoded calldata for ODDToken.upgradeToAndCall; does not sign, broadcast, or query RPC.
func (t *ODDToken) UpgradeToAndCallCalldata(newImplementation common.Address, callData []byte) ([]byte, error) {
	if err := ensureODDToken(t); err != nil {
		return nil, err
	}
	data, err := t.adapter.UpgradeToAndCallCalldata(newImplementation, callData)
	if err != nil {
		return nil, wrapUserError("odd token upgrade to and call calldata", err)
	}
	return data, nil
}
