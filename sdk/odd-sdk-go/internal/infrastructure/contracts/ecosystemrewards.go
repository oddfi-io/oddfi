package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/ecosystemrewards"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// EcosystemRewardsAdapter reads and writes EcosystemRewards state through generated bindings.
type EcosystemRewardsAdapter struct {
	caller     *ecosystemrewards.EcosystemRewardsCaller
	transactor *ecosystemrewards.EcosystemRewardsTransactor
}

// EcosystemRewardClaimable is one configured reward claim.
type EcosystemRewardClaimable struct {
	User      common.Address
	Category  uint8
	Amount    *big.Int
	Claimed   bool
	Cancelled bool
}

// NewEcosystemRewardsAdapter binds a EcosystemRewards adapter to proxyAddress.
func NewEcosystemRewardsAdapter(caller bind.ContractCaller, transactor bind.ContractTransactor, proxyAddress common.Address) (*EcosystemRewardsAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	boundCaller, err := ecosystemrewards.NewEcosystemRewardsCaller(proxyAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind ecosystem rewards caller: %w", err)
	}
	var boundTransactor *ecosystemrewards.EcosystemRewardsTransactor
	if transactor != nil {
		boundTransactor, err = ecosystemrewards.NewEcosystemRewardsTransactor(proxyAddress, transactor)
		if err != nil {
			return nil, fmt.Errorf("bind ecosystem rewards transactor: %w", err)
		}
	}
	return &EcosystemRewardsAdapter{caller: boundCaller, transactor: boundTransactor}, nil
}

func toEcosystemRewardClaimable(value struct {
	User      common.Address
	Category  uint8
	Amount    *big.Int
	Claimed   bool
	Cancelled bool
}) EcosystemRewardClaimable {
	return EcosystemRewardClaimable{User: value.User, Category: value.Category, Amount: cloneBigInt(value.Amount), Claimed: value.Claimed, Cancelled: value.Cancelled}
}

// DefaultAdminRole reads EcosystemRewards default admin role.
func (a *EcosystemRewardsAdapter) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.DEFAULTADMINROLE(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// UpgradeInterfaceVersion reads EcosystemRewards upgrade interface version.
func (a *EcosystemRewardsAdapter) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	value, err := a.caller.UPGRADEINTERFACEVERSION(callOpts(ctx))
	if err != nil {
		return "", err
	}
	return value, nil
}

// GetRoleAdmin reads EcosystemRewards get role admin.
func (a *EcosystemRewardsAdapter) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	value, err := a.caller.GetRoleAdmin(callOpts(ctx), role)
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// HasRole reads EcosystemRewards has role.
func (a *EcosystemRewardsAdapter) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	value, err := a.caller.HasRole(callOpts(ctx), role, account)
	if err != nil {
		return false, err
	}
	return value, nil
}

// Paused reads EcosystemRewards paused.
func (a *EcosystemRewardsAdapter) Paused(ctx context.Context) (bool, error) {
	value, err := a.caller.Paused(callOpts(ctx))
	if err != nil {
		return false, err
	}
	return value, nil
}

// ProxiableUUID reads EcosystemRewards proxiable uuid.
func (a *EcosystemRewardsAdapter) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	value, err := a.caller.ProxiableUUID(callOpts(ctx))
	if err != nil {
		return [32]byte{}, err
	}
	return value, nil
}

// SupportsInterface reads EcosystemRewards supports interface.
func (a *EcosystemRewardsAdapter) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	value, err := a.caller.SupportsInterface(callOpts(ctx), interfaceID)
	if err != nil {
		return false, err
	}
	return value, nil
}

// EcosystemRewardsAllocation reads EcosystemRewards ecosystem rewards allocation.
func (a *EcosystemRewardsAdapter) EcosystemRewardsAllocation(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.ECOSYSTEMREWARDSALLOCATION(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// CategoryAllocated reads EcosystemRewards category allocated.
func (a *EcosystemRewardsAdapter) CategoryAllocated(ctx context.Context, category uint8) (*big.Int, error) {
	value, err := a.caller.CategoryAllocated(callOpts(ctx), category)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// CategoryBudget reads EcosystemRewards category budget.
func (a *EcosystemRewardsAdapter) CategoryBudget(ctx context.Context, category uint8) (*big.Int, error) {
	value, err := a.caller.CategoryBudget(callOpts(ctx), category)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// CategoryClaimed reads EcosystemRewards category claimed.
func (a *EcosystemRewardsAdapter) CategoryClaimed(ctx context.Context, category uint8) (*big.Int, error) {
	value, err := a.caller.CategoryClaimed(callOpts(ctx), category)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// ClaimableOf reads EcosystemRewards claimable of.
func (a *EcosystemRewardsAdapter) ClaimableOf(ctx context.Context, user common.Address) (*big.Int, error) {
	value, err := a.caller.ClaimableOf(callOpts(ctx), user)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// Claimable reads EcosystemRewards claimable.
func (a *EcosystemRewardsAdapter) Claimable(ctx context.Context, claimID *big.Int) (EcosystemRewardClaimable, error) {
	value, err := a.caller.Claimables(callOpts(ctx), claimID)
	if err != nil {
		return EcosystemRewardClaimable{}, err
	}
	return toEcosystemRewardClaimable(value), nil
}

// NextClaimID reads EcosystemRewards next claim id.
func (a *EcosystemRewardsAdapter) NextClaimID(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.NextClaimId(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// OddToken reads EcosystemRewards odd token.
func (a *EcosystemRewardsAdapter) OddToken(ctx context.Context) (common.Address, error) {
	value, err := a.caller.OddToken(callOpts(ctx))
	if err != nil {
		return common.Address{}, err
	}
	return value, nil
}

// TotalAllocated reads EcosystemRewards total allocated.
func (a *EcosystemRewardsAdapter) TotalAllocated(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalAllocated(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TotalCancelled reads EcosystemRewards total cancelled.
func (a *EcosystemRewardsAdapter) TotalCancelled(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalCancelled(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TotalCategoryBudget reads EcosystemRewards total category budget.
func (a *EcosystemRewardsAdapter) TotalCategoryBudget(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalCategoryBudget(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// TotalClaimed reads EcosystemRewards total claimed.
func (a *EcosystemRewardsAdapter) TotalClaimed(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TotalClaimed(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// GrantRole submits the EcosystemRewards grant role transaction.
func (a *EcosystemRewardsAdapter) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.GrantRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards grant role: %w", err)
	}
	return tx, nil
}

// RenounceRole submits the EcosystemRewards renounce role transaction.
func (a *EcosystemRewardsAdapter) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards renounce role: %w", err)
	}
	return tx, nil
}

// RevokeRole submits the EcosystemRewards revoke role transaction.
func (a *EcosystemRewardsAdapter) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RevokeRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards revoke role: %w", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits the EcosystemRewards upgrade to and call transaction.
func (a *EcosystemRewardsAdapter) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards upgrade to and call: %w", err)
	}
	return tx, nil
}

// Pause submits the EcosystemRewards pause transaction.
func (a *EcosystemRewardsAdapter) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Pause(opts)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards pause: %w", err)
	}
	return tx, nil
}

// Unpause submits the EcosystemRewards unpause transaction.
func (a *EcosystemRewardsAdapter) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Unpause(opts)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards unpause: %w", err)
	}
	return tx, nil
}

// Initialize submits the EcosystemRewards initialize transaction.
func (a *EcosystemRewardsAdapter) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Initialize(opts, admin, oddTokenAddress)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards initialize: %w", err)
	}
	return tx, nil
}

// CancelClaimable submits the EcosystemRewards cancel claimable transaction.
func (a *EcosystemRewardsAdapter) CancelClaimable(opts *bind.TransactOpts, claimID *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.CancelClaimable(opts, claimID)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards cancel claimable: %w", err)
	}
	return tx, nil
}

// Claim submits the EcosystemRewards claim transaction.
func (a *EcosystemRewardsAdapter) Claim(opts *bind.TransactOpts, claimID *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Claim(opts, claimID)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards claim: %w", err)
	}
	return tx, nil
}

// CreateClaimable submits the EcosystemRewards create claimable transaction.
func (a *EcosystemRewardsAdapter) CreateClaimable(opts *bind.TransactOpts, user common.Address, category uint8, amount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.CreateClaimable(opts, user, category, amount)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards create claimable: %w", err)
	}
	return tx, nil
}

// SetCategoryBudget submits the EcosystemRewards set category budget transaction.
func (a *EcosystemRewardsAdapter) SetCategoryBudget(opts *bind.TransactOpts, category uint8, budget *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetCategoryBudget(opts, category, budget)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards set category budget: %w", err)
	}
	return tx, nil
}

var ecosystemRewardsABI = mustLoadEcosystemRewardsABI()

func mustLoadEcosystemRewardsABI() abi.ABI {
	parsed, err := ecosystemrewards.EcosystemRewardsMetaData.GetAbi()
	if err != nil {
		panic("bind ecosystem rewards abi: " + err.Error())
	}
	if parsed == nil {
		panic("bind ecosystem rewards abi: nil abi")
	}
	return *parsed
}

// ClaimCalldata returns ABI-encoded calldata for EcosystemRewards.claim(uint256).
func (a *EcosystemRewardsAdapter) ClaimCalldata(claimID *big.Int) ([]byte, error) {
	data, err := ecosystemRewardsABI.Pack("claim", claimID)
	if err != nil {
		return nil, fmt.Errorf("ecosystem rewards claim abi pack: %w", err)
	}
	return data, nil
}
