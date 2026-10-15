package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// EcosystemRewards exposes the EcosystemRewards proxy API. Methods are safe for concurrent
// use and RPC reads block until the backend returns or ctx is canceled.
type EcosystemRewards struct {
	adapter *contracts.EcosystemRewardsAdapter
}

// EcosystemRewardClaimable is one configured reward claim.
type EcosystemRewardClaimable struct {
	User      common.Address
	Category  uint8
	Amount    *big.Int
	Claimed   bool
	Cancelled bool
}

func toPublicEcosystemRewardClaimable(value contracts.EcosystemRewardClaimable) EcosystemRewardClaimable {
	return EcosystemRewardClaimable{User: value.User, Category: value.Category, Amount: value.Amount, Claimed: value.Claimed, Cancelled: value.Cancelled}
}

// DefaultAdminRole reads EcosystemRewards default admin role.
func (p *EcosystemRewards) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "ecosystem rewards default admin role"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.DefaultAdminRole(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("ecosystem rewards default admin role", err)
	}
	return value, nil
}

// UpgradeInterfaceVersion reads EcosystemRewards upgrade interface version.
func (p *EcosystemRewards) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "ecosystem rewards upgrade interface version"); err != nil {
		return "", err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return "", err
	}
	value, err := p.adapter.UpgradeInterfaceVersion(ctx)
	if err != nil {
		return "", wrapInfraError("ecosystem rewards upgrade interface version", err)
	}
	return value, nil
}

// GetRoleAdmin reads EcosystemRewards get role admin.
func (p *EcosystemRewards) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	if err := checkContext(ctx, "ecosystem rewards get role admin"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.GetRoleAdmin(ctx, role)
	if err != nil {
		return [32]byte{}, wrapInfraError("ecosystem rewards get role admin", err)
	}
	return value, nil
}

// HasRole reads EcosystemRewards has role.
func (p *EcosystemRewards) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	if err := checkContext(ctx, "ecosystem rewards has role"); err != nil {
		return false, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return false, err
	}
	value, err := p.adapter.HasRole(ctx, role, account)
	if err != nil {
		return false, wrapInfraError("ecosystem rewards has role", err)
	}
	return value, nil
}

// Paused reads EcosystemRewards paused.
func (p *EcosystemRewards) Paused(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "ecosystem rewards paused"); err != nil {
		return false, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return false, err
	}
	value, err := p.adapter.Paused(ctx)
	if err != nil {
		return false, wrapInfraError("ecosystem rewards paused", err)
	}
	return value, nil
}

// ProxiableUUID reads EcosystemRewards proxiable uuid.
func (p *EcosystemRewards) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "ecosystem rewards proxiable uuid"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.ProxiableUUID(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("ecosystem rewards proxiable uuid", err)
	}
	return value, nil
}

// SupportsInterface reads EcosystemRewards supports interface.
func (p *EcosystemRewards) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	if err := checkContext(ctx, "ecosystem rewards supports interface"); err != nil {
		return false, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SupportsInterface(ctx, interfaceID)
	if err != nil {
		return false, wrapInfraError("ecosystem rewards supports interface", err)
	}
	return value, nil
}

// EcosystemRewardsAllocation reads EcosystemRewards ecosystem rewards allocation.
func (p *EcosystemRewards) EcosystemRewardsAllocation(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards ecosystem rewards allocation"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.EcosystemRewardsAllocation(ctx)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards ecosystem rewards allocation", err)
	}
	return value, nil
}

// CategoryAllocated reads EcosystemRewards category allocated.
func (p *EcosystemRewards) CategoryAllocated(ctx context.Context, category uint8) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards category allocated"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.CategoryAllocated(ctx, category)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards category allocated", err)
	}
	return value, nil
}

// CategoryBudget reads EcosystemRewards category budget.
func (p *EcosystemRewards) CategoryBudget(ctx context.Context, category uint8) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards category budget"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.CategoryBudget(ctx, category)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards category budget", err)
	}
	return value, nil
}

// CategoryClaimed reads EcosystemRewards category claimed.
func (p *EcosystemRewards) CategoryClaimed(ctx context.Context, category uint8) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards category claimed"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.CategoryClaimed(ctx, category)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards category claimed", err)
	}
	return value, nil
}

// ClaimableOf reads EcosystemRewards claimable of.
func (p *EcosystemRewards) ClaimableOf(ctx context.Context, user common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards claimable of"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.ClaimableOf(ctx, user)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards claimable of", err)
	}
	return value, nil
}

// Claimable reads EcosystemRewards claimable.
func (p *EcosystemRewards) Claimable(ctx context.Context, claimID *big.Int) (EcosystemRewardClaimable, error) {
	if err := checkContext(ctx, "ecosystem rewards claimable"); err != nil {
		return EcosystemRewardClaimable{}, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return EcosystemRewardClaimable{}, err
	}
	if err := requireBigInts("ecosystem rewards claimable", claimID); err != nil {
		return EcosystemRewardClaimable{}, err
	}
	value, err := p.adapter.Claimable(ctx, claimID)
	if err != nil {
		return EcosystemRewardClaimable{}, wrapInfraError("ecosystem rewards claimable", err)
	}
	return toPublicEcosystemRewardClaimable(value), nil
}

// NextClaimID reads EcosystemRewards next claim id.
func (p *EcosystemRewards) NextClaimID(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards next claim id"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.NextClaimID(ctx)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards next claim id", err)
	}
	return value, nil
}

// OddToken reads EcosystemRewards odd token.
func (p *EcosystemRewards) OddToken(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "ecosystem rewards odd token"); err != nil {
		return common.Address{}, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.OddToken(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("ecosystem rewards odd token", err)
	}
	return value, nil
}

// TotalAllocated reads EcosystemRewards total allocated.
func (p *EcosystemRewards) TotalAllocated(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards total allocated"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalAllocated(ctx)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards total allocated", err)
	}
	return value, nil
}

// TotalCancelled reads EcosystemRewards total cancelled.
func (p *EcosystemRewards) TotalCancelled(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards total cancelled"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalCancelled(ctx)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards total cancelled", err)
	}
	return value, nil
}

// TotalCategoryBudget reads EcosystemRewards total category budget.
func (p *EcosystemRewards) TotalCategoryBudget(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards total category budget"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalCategoryBudget(ctx)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards total category budget", err)
	}
	return value, nil
}

// TotalClaimed reads EcosystemRewards total claimed.
func (p *EcosystemRewards) TotalClaimed(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "ecosystem rewards total claimed"); err != nil {
		return nil, err
	}
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TotalClaimed(ctx)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards total claimed", err)
	}
	return value, nil
}

// GrantRole submits a EcosystemRewards grant role transaction using caller-supplied opts.
func (p *EcosystemRewards) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.GrantRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards grant role", err)
	}
	return tx, nil
}

// RenounceRole submits a EcosystemRewards renounce role transaction using caller-supplied opts.
func (p *EcosystemRewards) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards renounce role", err)
	}
	return tx, nil
}

// RevokeRole submits a EcosystemRewards revoke role transaction using caller-supplied opts.
func (p *EcosystemRewards) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RevokeRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards revoke role", err)
	}
	return tx, nil
}

// UpgradeToAndCall submits a EcosystemRewards upgrade to and call transaction using caller-supplied opts.
func (p *EcosystemRewards) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards upgrade to and call", err)
	}
	return tx, nil
}

// Pause submits a EcosystemRewards pause transaction using caller-supplied opts.
func (p *EcosystemRewards) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Pause(opts)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards pause", err)
	}
	return tx, nil
}

// Unpause submits a EcosystemRewards unpause transaction using caller-supplied opts.
func (p *EcosystemRewards) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Unpause(opts)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards unpause", err)
	}
	return tx, nil
}

// Initialize submits a EcosystemRewards initialize transaction using caller-supplied opts.
func (p *EcosystemRewards) Initialize(opts *bind.TransactOpts, admin common.Address, oddTokenAddress common.Address) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Initialize(opts, admin, oddTokenAddress)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards initialize", err)
	}
	return tx, nil
}

// CancelClaimable submits a EcosystemRewards cancel claimable transaction using caller-supplied opts.
func (p *EcosystemRewards) CancelClaimable(opts *bind.TransactOpts, claimID *big.Int) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("ecosystem rewards cancel claimable", claimID); err != nil {
		return nil, err
	}
	tx, err := p.adapter.CancelClaimable(opts, claimID)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards cancel claimable", err)
	}
	return tx, nil
}

// Claim submits a EcosystemRewards claim transaction using caller-supplied opts.
func (p *EcosystemRewards) Claim(opts *bind.TransactOpts, claimID *big.Int) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("ecosystem rewards claim", claimID); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Claim(opts, claimID)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards claim", err)
	}
	return tx, nil
}

// CreateClaimable submits a EcosystemRewards create claimable transaction using caller-supplied opts.
func (p *EcosystemRewards) CreateClaimable(opts *bind.TransactOpts, user common.Address, category uint8, amount *big.Int) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("ecosystem rewards create claimable", amount); err != nil {
		return nil, err
	}
	tx, err := p.adapter.CreateClaimable(opts, user, category, amount)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards create claimable", err)
	}
	return tx, nil
}

// SetCategoryBudget submits a EcosystemRewards set category budget transaction using caller-supplied opts.
func (p *EcosystemRewards) SetCategoryBudget(opts *bind.TransactOpts, category uint8, budget *big.Int) (*types.Transaction, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("ecosystem rewards set category budget", budget); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetCategoryBudget(opts, category, budget)
	if err != nil {
		return nil, wrapInfraError("ecosystem rewards set category budget", err)
	}
	return tx, nil
}

// ClaimCalldata returns ABI-encoded calldata for EcosystemRewards.claim; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call (e.g. a sponsored claim on behalf of
// the claimable owner) or any other context that needs raw calldata. Works on read-only clients (no transactor).
// A nil claimID returns a *UserError carrying ErrNilBigIntParam.
func (p *EcosystemRewards) ClaimCalldata(claimID *big.Int) ([]byte, error) {
	if err := ensureEcosystemRewards(p); err != nil {
		return nil, err
	}
	if err := requireBigInts("ecosystem rewards claim calldata", claimID); err != nil {
		return nil, err
	}
	data, err := p.adapter.ClaimCalldata(claimID)
	if err != nil {
		return nil, wrapUserError("ecosystem rewards claim calldata", err)
	}
	return data, nil
}
