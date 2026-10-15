package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/oddtoken"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// ContractCaller is the geth read-only backend needed by abigen callers.
type ContractCaller interface {
	bind.ContractCaller
}

// ODDTokenAdapter reads and writes ODDToken state through generated bindings.
type ODDTokenAdapter struct {
	caller     *oddtoken.ODDTokenCaller
	transactor *oddtoken.ODDTokenTransactor
}

// NewODDTokenAdapter binds an ODDToken adapter to proxyAddress.
func NewODDTokenAdapter(caller bind.ContractCaller, transactor bind.ContractTransactor, proxyAddress common.Address) (*ODDTokenAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tokenCaller, err := oddtoken.NewODDTokenCaller(proxyAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind odd token caller: %w", err)
	}
	var tokenTransactor *oddtoken.ODDTokenTransactor
	if transactor != nil {
		tokenTransactor, err = oddtoken.NewODDTokenTransactor(proxyAddress, transactor)
		if err != nil {
			return nil, fmt.Errorf("bind odd token transactor: %w", err)
		}
	}
	return &ODDTokenAdapter{caller: tokenCaller, transactor: tokenTransactor}, nil
}

// Name reads the token name using ctx for RPC cancellation.
func (r *ODDTokenAdapter) Name(ctx context.Context) (string, error) {
	value, err := r.caller.Name(callOpts(ctx))
	if err != nil {
		return "", fmt.Errorf("odd token name: %w", err)
	}
	return value, nil
}

// Symbol reads the token symbol using ctx for RPC cancellation.
func (r *ODDTokenAdapter) Symbol(ctx context.Context) (string, error) {
	value, err := r.caller.Symbol(callOpts(ctx))
	if err != nil {
		return "", fmt.Errorf("odd token symbol: %w", err)
	}
	return value, nil
}

// Decimals reads token decimals using ctx for RPC cancellation.
func (r *ODDTokenAdapter) Decimals(ctx context.Context) (uint8, error) {
	value, err := r.caller.Decimals(callOpts(ctx))
	if err != nil {
		return 0, fmt.Errorf("odd token decimals: %w", err)
	}
	return value, nil
}

// TotalSupply reads total token supply in the token minimum unit.
func (r *ODDTokenAdapter) TotalSupply(ctx context.Context) (*big.Int, error) {
	value, err := r.caller.TotalSupply(callOpts(ctx))
	if err != nil {
		return nil, fmt.Errorf("odd token total supply: %w", err)
	}
	return new(big.Int).Set(value), nil
}

// BalanceOf reads account balance in the token minimum unit.
func (r *ODDTokenAdapter) BalanceOf(ctx context.Context, account common.Address) (*big.Int, error) {
	value, err := r.caller.BalanceOf(callOpts(ctx), account)
	if err != nil {
		return nil, fmt.Errorf("odd token balance of: %w", err)
	}
	return new(big.Int).Set(value), nil
}

// Allowance reads owner approval for spender in the token minimum unit.
func (r *ODDTokenAdapter) Allowance(ctx context.Context, owner common.Address, spender common.Address) (*big.Int, error) {
	value, err := r.caller.Allowance(callOpts(ctx), owner, spender)
	if err != nil {
		return nil, fmt.Errorf("odd token allowance: %w", err)
	}
	return new(big.Int).Set(value), nil
}

// Paused reads whether token transfers are currently paused.
func (r *ODDTokenAdapter) Paused(ctx context.Context) (bool, error) {
	value, err := r.caller.Paused(callOpts(ctx))
	if err != nil {
		return false, fmt.Errorf("odd token paused: %w", err)
	}
	return value, nil
}

// DefaultAdminRole reads the OpenZeppelin default admin role id.
func (r *ODDTokenAdapter) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	return r.caller.DEFAULTADMINROLE(callOpts(ctx))
}

// UpgradeInterfaceVersion reads the UUPS interface version string.
func (r *ODDTokenAdapter) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	return r.caller.UPGRADEINTERFACEVERSION(callOpts(ctx))
}

// ProxiableUUID reads the UUPS implementation slot UUID.
func (r *ODDTokenAdapter) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	return r.caller.ProxiableUUID(callOpts(ctx))
}

// SupportsInterface reads ERC165 support for interfaceID.
func (r *ODDTokenAdapter) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	return r.caller.SupportsInterface(callOpts(ctx), interfaceID)
}

// HasRole returns true when account holds role on ODDToken.
func (r *ODDTokenAdapter) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	return r.caller.HasRole(callOpts(ctx), role, account)
}

// GetRoleAdmin reads the admin role for role on ODDToken.
func (r *ODDTokenAdapter) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	return r.caller.GetRoleAdmin(callOpts(ctx), role)
}

func callOpts(ctx context.Context) *bind.CallOpts {
	return &bind.CallOpts{Context: ctx}
}

// Transfer submits an ODDToken transfer transaction.
func (r *ODDTokenAdapter) Transfer(opts *bind.TransactOpts, to common.Address, value *big.Int) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.Transfer(opts, to, value)
	if err != nil {
		return nil, fmt.Errorf("odd token transfer: %w", err)
	}
	return tx, nil
}

// Approve submits an ODDToken approve transaction.
func (r *ODDTokenAdapter) Approve(opts *bind.TransactOpts, spender common.Address, value *big.Int) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.Approve(opts, spender, value)
	if err != nil {
		return nil, fmt.Errorf("odd token approve: %w", err)
	}
	return tx, nil
}

// TransferFrom submits an ODDToken transferFrom transaction.
func (r *ODDTokenAdapter) TransferFrom(opts *bind.TransactOpts, from common.Address, to common.Address, value *big.Int) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.TransferFrom(opts, from, to, value)
	if err != nil {
		return nil, fmt.Errorf("odd token transfer from: %w", err)
	}
	return tx, nil
}

// GrantRole grants a role to an account.
func (r *ODDTokenAdapter) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.GrantRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("odd token grant role: %w", err)
	}
	return tx, nil
}

// RevokeRole revokes a role from an account.
func (r *ODDTokenAdapter) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.RevokeRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("odd token revoke role: %w", err)
	}
	return tx, nil
}

// RenounceRole renounces a role held by the caller.
func (r *ODDTokenAdapter) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("odd token renounce role: %w", err)
	}
	return tx, nil
}

// Pause pauses token transfers.
func (r *ODDTokenAdapter) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.Pause(opts)
	if err != nil {
		return nil, fmt.Errorf("odd token pause: %w", err)
	}
	return tx, nil
}

// Unpause unpauses token transfers.
func (r *ODDTokenAdapter) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.Unpause(opts)
	if err != nil {
		return nil, fmt.Errorf("odd token unpause: %w", err)
	}
	return tx, nil
}

// UpgradeToAndCall upgrades the ODDToken proxy and optionally calls initialization data.
func (r *ODDTokenAdapter) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if r.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := r.transactor.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, fmt.Errorf("odd token upgrade to and call: %w", err)
	}
	return tx, nil
}

var oddTokenABI = mustLoadODDTokenABI()

func mustLoadODDTokenABI() abi.ABI {
	parsed, err := oddtoken.ODDTokenMetaData.GetAbi()
	if err != nil {
		panic("bind odd token abi: " + err.Error())
	}
	if parsed == nil {
		panic("bind odd token abi: nil abi")
	}
	return *parsed
}

// TransferCalldata returns ABI-encoded calldata for ODDToken.transfer(address,uint256).
func (r *ODDTokenAdapter) TransferCalldata(to common.Address, value *big.Int) ([]byte, error) {
	data, err := oddTokenABI.Pack("transfer", to, value)
	if err != nil {
		return nil, fmt.Errorf("odd token transfer abi pack: %w", err)
	}
	return data, nil
}

// ApproveCalldata returns ABI-encoded calldata for ODDToken.approve(address,uint256).
func (r *ODDTokenAdapter) ApproveCalldata(spender common.Address, value *big.Int) ([]byte, error) {
	data, err := oddTokenABI.Pack("approve", spender, value)
	if err != nil {
		return nil, fmt.Errorf("odd token approve abi pack: %w", err)
	}
	return data, nil
}

// TransferFromCalldata returns ABI-encoded calldata for ODDToken.transferFrom(address,address,uint256).
func (r *ODDTokenAdapter) TransferFromCalldata(from common.Address, to common.Address, value *big.Int) ([]byte, error) {
	data, err := oddTokenABI.Pack("transferFrom", from, to, value)
	if err != nil {
		return nil, fmt.Errorf("odd token transfer from abi pack: %w", err)
	}
	return data, nil
}

// GrantRoleCalldata returns ABI-encoded calldata for ODDToken.grantRole(bytes32,address).
func (r *ODDTokenAdapter) GrantRoleCalldata(role [32]byte, account common.Address) ([]byte, error) {
	data, err := oddTokenABI.Pack("grantRole", role, account)
	if err != nil {
		return nil, fmt.Errorf("odd token grant role abi pack: %w", err)
	}
	return data, nil
}

// RevokeRoleCalldata returns ABI-encoded calldata for ODDToken.revokeRole(bytes32,address).
func (r *ODDTokenAdapter) RevokeRoleCalldata(role [32]byte, account common.Address) ([]byte, error) {
	data, err := oddTokenABI.Pack("revokeRole", role, account)
	if err != nil {
		return nil, fmt.Errorf("odd token revoke role abi pack: %w", err)
	}
	return data, nil
}

// RenounceRoleCalldata returns ABI-encoded calldata for ODDToken.renounceRole(bytes32,address).
func (r *ODDTokenAdapter) RenounceRoleCalldata(role [32]byte, callerConfirmation common.Address) ([]byte, error) {
	data, err := oddTokenABI.Pack("renounceRole", role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("odd token renounce role abi pack: %w", err)
	}
	return data, nil
}

// PauseCalldata returns ABI-encoded calldata for ODDToken.pause().
func (r *ODDTokenAdapter) PauseCalldata() ([]byte, error) {
	data, err := oddTokenABI.Pack("pause")
	if err != nil {
		return nil, fmt.Errorf("odd token pause abi pack: %w", err)
	}
	return data, nil
}

// UnpauseCalldata returns ABI-encoded calldata for ODDToken.unpause().
func (r *ODDTokenAdapter) UnpauseCalldata() ([]byte, error) {
	data, err := oddTokenABI.Pack("unpause")
	if err != nil {
		return nil, fmt.Errorf("odd token unpause abi pack: %w", err)
	}
	return data, nil
}

// UpgradeToAndCallCalldata returns ABI-encoded calldata for ODDToken.upgradeToAndCall(address,bytes).
func (r *ODDTokenAdapter) UpgradeToAndCallCalldata(newImplementation common.Address, callData []byte) ([]byte, error) {
	data, err := oddTokenABI.Pack("upgradeToAndCall", newImplementation, callData)
	if err != nil {
		return nil, fmt.Errorf("odd token upgrade to and call abi pack: %w", err)
	}
	return data, nil
}
