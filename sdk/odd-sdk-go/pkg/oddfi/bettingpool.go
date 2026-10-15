package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/contracts"
)

// QuoteGuardInput provides quote protection when placing a bet.
// QuoteVersion and QuotedAt must match the values returned by GetMarketOdds
// at the time of quoting. The transaction reverts if the market quote has
// changed since the caller read it.
type QuoteGuardInput struct {
	// QuoteVersion is the quoteVersion from GetMarketOdds.
	QuoteVersion *big.Int
	// QuotedAt is the updatedAt timestamp from GetMarketOdds.
	QuotedAt uint64
	// MinOdds is the minimum acceptable locked odds (precision 1e4).
	MinOdds *big.Int
	// MinAcceptedAmount is the minimum acceptable fill amount in ODD wei.
	MinAcceptedAmount *big.Int
	// Deadline is the Unix timestamp after which the guard expires.
	Deadline *big.Int
}

// MarketInfo holds the on-chain configuration for a betting market.
type MarketInfo struct {
	MatchID        [32]byte
	MarketType     uint8
	Line           uint8
	OutcomeCount   uint8
	MatchStartTime uint64
	LockAt         uint64
	// Status encodes MarketStatus: 0=Open, 1=Locked, 2=Settled, 3=Refunded, 4=Cancelled.
	Status       uint8
	MatchEndTime uint64
}

// MarketOdds holds odds data for a betting market.
type MarketOdds struct {
	// BaseOdds are the operator-set base odds per outcome (precision 1e4).
	BaseOdds []*big.Int
	// QuotedOdds are the risk-adjusted live odds per outcome (precision 1e4).
	QuotedOdds []*big.Int
	// UpdatedAt is the timestamp of the last operator odds update.
	UpdatedAt uint64
	// QuoteVersion increments on every event that changes the effective quote.
	QuoteVersion *big.Int
}

// MarketExposure holds per-outcome stake and payout exposure for a betting market.
type MarketExposure struct {
	// TotalStakedByOutcome contains accepted stake by outcome, in ODD wei.
	TotalStakedByOutcome []*big.Int
	// PayoutByOutcome contains potential gross payout by outcome, in ODD wei.
	PayoutByOutcome []*big.Int
	// SignalColor encodes SignalColor: 0=Green, 1=Yellow, 2=Orange, 3=Red.
	SignalColor uint8
}

// SignalResult is the output of PreviewSignal.
type SignalResult struct {
	// Signal encodes SignalColor: 0=Green, 1=Yellow, 2=Orange, 3=Red.
	Signal uint8
	// AcceptedAmount is the estimated fill amount in ODD wei.
	AcceptedAmount *big.Int
	// LockedOdds is the estimated locked odds (precision 1e4).
	LockedOdds *big.Int
	// PartialFill is true when only a portion of the requested amount can be filled.
	PartialFill bool
	// MaxAcceptableAmount is the maximum fillable amount before red-light threshold.
	MaxAcceptableAmount *big.Int
}

// BetInfo holds the on-chain state of a placed bet.
type BetInfo struct {
	Owner          common.Address
	MarketID       [32]byte
	Outcome        uint8
	AcceptedAmount *big.Int
	RefundedAmount *big.Int
	LockedOdds     *big.Int
	// SettlementState encodes BetSettlementState: 0=Pending, 1=Refunded, 2=Lost, 3=WonUnclaimed, 4=WonClaimed.
	SettlementState uint8
	ClaimablePayout *big.Int
}

// ClaimStatus holds a display claimability snapshot for a bet or parlay.
type ClaimStatus struct {
	// Won is true when the position is currently claimable as a win.
	Won bool
	// Reward is the claimable reward amount in ODD wei.
	Reward *big.Int
}

// BetEstimatedValue is a display-only estimate for an existing bet.
type BetEstimatedValue struct {
	// EstimatedValue is display-only; it is not claimable and not a cash-out quote.
	EstimatedValue *big.Int
	// FloatingPnL is the estimated floating profit or loss in ODD wei.
	FloatingPnL *big.Int
}

// UserRiskLedger holds a user's daily betting and unsettled stake risk state.
type UserRiskLedger struct {
	DayBucket           uint32
	DailyAcceptedAmount *big.Int
	UnsettledStake      *big.Int
}

// ParlayLegInput provides quote protection for one parlay leg.
// QuoteVersion and QuotedAt must match the values returned by GetMarketOdds
// for that leg's market at the time of quoting.
type ParlayLegInput struct {
	// MarketID is the target market for this parlay leg.
	MarketID [32]byte
	// Outcome is the selected outcome within the market.
	Outcome uint8
	// QuoteVersion is the market quoteVersion observed by the caller.
	QuoteVersion *big.Int
	// QuotedAt is the market quote timestamp observed by the caller.
	QuotedAt uint64
	// MinOdds is the minimum acceptable odds for this leg (precision 1e4).
	MinOdds *big.Int
}

// MarketFinalResult holds the stored terminal result for a betting market.
type MarketFinalResult struct {
	Finalized    bool
	ResultKind   uint8
	ScoreSettled bool
	HomeScore    uint16
	AwayScore    uint16
}

// ParlayInfo holds the on-chain state of a parlay bet.
type ParlayInfo struct {
	Owner             common.Address
	Stake             *big.Int
	LockedComboOdds   *big.Int
	MaxPayout         *big.Int
	ClaimablePayout   *big.Int
	ParlayRiskID      [32]byte
	AcceptedDayBucket uint32
	LegCount          uint8
	// State encodes ParlayState from the contract ABI.
	State                uint8
	PayoutTaxRateBps     uint16
	TaxAllocStakingBps   uint16
	TaxAllocTaxBufferBps uint16
	TaxAllocReferrerBps  uint16
	ReferrerSnapshot     common.Address
}

// ParlayLegInfo holds the on-chain state of one parlay leg.
type ParlayLegInfo struct {
	MarketID        [32]byte
	MatchID         [32]byte
	MarketType      uint8
	Line            uint8
	Outcome         uint8
	LockedOdds      *big.Int
	SyntheticPayout *big.Int
	// Result encodes ParlayLegResult from the contract ABI.
	Result uint8
}

// BettingPool exposes read-only betting pool calls. Methods are safe for
// concurrent use and block on RPC until the backend returns or ctx is canceled.
type BettingPool struct {
	adapter *contracts.BettingPoolAdapter
}

// OddToken reads the ODD token address configured on BettingPool.
func (p *BettingPool) OddToken(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool odd token"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.OddToken(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool odd token", err)
	}
	return value, nil
}

// StakingPool reads the staking pool address configured on BettingPool.
func (p *BettingPool) StakingPool(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool staking pool"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.StakingPool(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool staking pool", err)
	}
	return value, nil
}

// LiquidityPool reads the liquidity pool address configured on BettingPool.
func (p *BettingPool) LiquidityPool(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool liquidity pool"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.LiquidityPool(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool liquidity pool", err)
	}
	return value, nil
}

// PlatformTreasury reads the platform treasury address configured on BettingPool.
func (p *BettingPool) PlatformTreasury(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool platform treasury"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.PlatformTreasury(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool platform treasury", err)
	}
	return value, nil
}

// Paused reads whether betting operations are paused.
func (p *BettingPool) Paused(ctx context.Context) (bool, error) {
	if err := checkContext(ctx, "betting pool paused"); err != nil {
		return false, err
	}
	if err := ensureBettingPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.Paused(ctx)
	if err != nil {
		return false, wrapInfraError("betting pool paused", err)
	}
	return value, nil
}

// DefaultAdminRole reads the OpenZeppelin default admin role id.
func (p *BettingPool) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "betting pool default admin role"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.DefaultAdminRole(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("betting pool default admin role", err)
	}
	return value, nil
}

// UpgradeInterfaceVersion reads the UUPS interface version string.
func (p *BettingPool) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	if err := checkContext(ctx, "betting pool upgrade interface version"); err != nil {
		return "", err
	}
	if err := ensureBettingPool(p); err != nil {
		return "", err
	}
	value, err := p.adapter.UpgradeInterfaceVersion(ctx)
	if err != nil {
		return "", wrapInfraError("betting pool upgrade interface version", err)
	}
	return value, nil
}

// ProxiableUUID reads the UUPS implementation slot UUID.
func (p *BettingPool) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	if err := checkContext(ctx, "betting pool proxiable uuid"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.ProxiableUUID(ctx)
	if err != nil {
		return [32]byte{}, wrapInfraError("betting pool proxiable uuid", err)
	}
	return value, nil
}

// SupportsInterface returns true when BettingPool supports interfaceID.
func (p *BettingPool) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	if err := checkContext(ctx, "betting pool supports interface"); err != nil {
		return false, err
	}
	if err := ensureBettingPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.SupportsInterface(ctx, interfaceID)
	if err != nil {
		return false, wrapInfraError("betting pool supports interface", err)
	}
	return value, nil
}

// BetTaxBps reads the bet tax rate in basis points.
func (p *BettingPool) BetTaxBps(ctx context.Context) (uint16, error) {
	if err := checkContext(ctx, "betting pool bet tax bps"); err != nil {
		return 0, err
	}
	if err := ensureBettingPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.BetTaxBps(ctx)
	if err != nil {
		return 0, wrapInfraError("betting pool bet tax bps", err)
	}
	return value, nil
}

// PayoutTaxBps reads the payout tax rate in basis points.
func (p *BettingPool) PayoutTaxBps(ctx context.Context) (uint16, error) {
	if err := checkContext(ctx, "betting pool payout tax bps"); err != nil {
		return 0, err
	}
	if err := ensureBettingPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.PayoutTaxBps(ctx)
	if err != nil {
		return 0, wrapInfraError("betting pool payout tax bps", err)
	}
	return value, nil
}

// TaxAllocStakingBps reads the staking allocation of payout tax.
func (p *BettingPool) TaxAllocStakingBps(ctx context.Context) (uint16, error) {
	if err := checkContext(ctx, "betting pool tax alloc staking bps"); err != nil {
		return 0, err
	}
	if err := ensureBettingPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.TaxAllocStakingBps(ctx)
	if err != nil {
		return 0, wrapInfraError("betting pool tax alloc staking bps", err)
	}
	return value, nil
}

// TaxAllocTaxBufferBps reads the tax-buffer allocation of payout tax.
func (p *BettingPool) TaxAllocTaxBufferBps(ctx context.Context) (uint16, error) {
	if err := checkContext(ctx, "betting pool tax alloc tax buffer bps"); err != nil {
		return 0, err
	}
	if err := ensureBettingPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.TaxAllocTaxBufferBps(ctx)
	if err != nil {
		return 0, wrapInfraError("betting pool tax alloc tax buffer bps", err)
	}
	return value, nil
}

// TaxAllocPlatformBps reads the platform allocation of payout tax.
func (p *BettingPool) TaxAllocPlatformBps(ctx context.Context) (uint16, error) {
	if err := checkContext(ctx, "betting pool tax alloc platform bps"); err != nil {
		return 0, err
	}
	if err := ensureBettingPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.TaxAllocPlatformBps(ctx)
	if err != nil {
		return 0, wrapInfraError("betting pool tax alloc platform bps", err)
	}
	return value, nil
}

// TaxAllocReferrerBps reads the referrer allocation of payout tax.
func (p *BettingPool) TaxAllocReferrerBps(ctx context.Context) (uint16, error) {
	if err := checkContext(ctx, "betting pool tax alloc referrer bps"); err != nil {
		return 0, err
	}
	if err := ensureBettingPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.TaxAllocReferrerBps(ctx)
	if err != nil {
		return 0, wrapInfraError("betting pool tax alloc referrer bps", err)
	}
	return value, nil
}

// TaxBuffer reads the current L3 tax buffer balance.
func (p *BettingPool) TaxBuffer(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool tax buffer"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.TaxBuffer(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool tax buffer", err)
	}
	return value, nil
}

// LpLossOffsetRemaining reads the outstanding LP loss offset metric.
func (p *BettingPool) LpLossOffsetRemaining(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool lp loss offset remaining"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.LpLossOffsetRemaining(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool lp loss offset remaining", err)
	}
	return value, nil
}

// LpMarginShareBps reads the market margin share sent to LPs.
func (p *BettingPool) LpMarginShareBps(ctx context.Context) (uint16, error) {
	if err := checkContext(ctx, "betting pool lp margin share bps"); err != nil {
		return 0, err
	}
	if err := ensureBettingPool(p); err != nil {
		return 0, err
	}
	value, err := p.adapter.LpMarginShareBps(ctx)
	if err != nil {
		return 0, wrapInfraError("betting pool lp margin share bps", err)
	}
	return value, nil
}

// WclYellowThreshold reads the yellow WCL threshold.
func (p *BettingPool) WclYellowThreshold(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool wcl yellow threshold"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.WclYellowThreshold(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool wcl yellow threshold", err)
	}
	return value, nil
}

// WclOrangeThreshold reads the orange WCL threshold.
func (p *BettingPool) WclOrangeThreshold(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool wcl orange threshold"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.WclOrangeThreshold(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool wcl orange threshold", err)
	}
	return value, nil
}

// WclRedThreshold reads the red WCL threshold.
func (p *BettingPool) WclRedThreshold(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool wcl red threshold"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.WclRedThreshold(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool wcl red threshold", err)
	}
	return value, nil
}

// PlatformReserve reads platform reserve amount.
func (p *BettingPool) PlatformReserve(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool platform reserve"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.PlatformReserve(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool platform reserve", err)
	}
	return value, nil
}

// AccountedBalance reads accounted betting pool balance.
func (p *BettingPool) AccountedBalance(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool accounted balance"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.AccountedBalance(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool accounted balance", err)
	}
	return value, nil
}

// AddPlatformReserve submits a platform reserve top-up transaction using opts supplied by the caller.
func (p *BettingPool) AddPlatformReserve(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.AddPlatformReserve(opts, amount)
	if err != nil {
		return nil, wrapInfraError("betting pool add platform reserve", err)
	}
	return tx, nil
}

// BindReferrer binds the caller to a referrer.
func (p *BettingPool) BindReferrer(opts *bind.TransactOpts, referrer common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.BindReferrer(opts, referrer)
	if err != nil {
		return nil, wrapInfraError("betting pool bind referrer", err)
	}
	return tx, nil
}

// ClaimReferralRewards claims accrued ODD referral rewards for the caller.
func (p *BettingPool) ClaimReferralRewards(opts *bind.TransactOpts, oddAmount *big.Int) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if oddAmount == nil {
		return nil, wrapUserError("betting pool claim referral rewards", ErrNilBigIntParam)
	}
	tx, err := p.adapter.ClaimReferralRewards(opts, oddAmount)
	if err != nil {
		return nil, wrapInfraError("betting pool claim referral rewards", err)
	}
	return tx, nil
}

// ClaimUSDTReferralRewards claims referral rewards through the configured USDT swap path.
func (p *BettingPool) ClaimUSDTReferralRewards(opts *bind.TransactOpts, rewardMinUsdtOutAmount *big.Int, signatureDeadline *big.Int, signature []byte, minUsdtOut *big.Int) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if rewardMinUsdtOutAmount == nil || signatureDeadline == nil || minUsdtOut == nil {
		return nil, wrapUserError("betting pool claim usdt referral rewards", ErrNilBigIntParam)
	}
	tx, err := p.adapter.ClaimUSDTReferralRewards(opts, rewardMinUsdtOutAmount, signatureDeadline, signature, minUsdtOut)
	if err != nil {
		return nil, wrapInfraError("betting pool claim usdt referral rewards", err)
	}
	return tx, nil
}

// GrantRole grants a role to an account. Caller must hold the admin role for the target role.
func (p *BettingPool) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.GrantRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("betting pool grant role", err)
	}
	return tx, nil
}

// RevokeRole revokes a role from an account. Caller must hold the admin role for the target role.
func (p *BettingPool) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RevokeRole(opts, role, account)
	if err != nil {
		return nil, wrapInfraError("betting pool revoke role", err)
	}
	return tx, nil
}

// RenounceRole renounces a role held by the caller.
func (p *BettingPool) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, wrapInfraError("betting pool renounce role", err)
	}
	return tx, nil
}

// Pause pauses BettingPool guarded methods. Caller must hold PAUSER_ROLE.
func (p *BettingPool) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Pause(opts)
	if err != nil {
		return nil, wrapInfraError("betting pool pause", err)
	}
	return tx, nil
}

// Unpause unpauses BettingPool guarded methods. Caller must hold PAUSER_ROLE.
func (p *BettingPool) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.Unpause(opts)
	if err != nil {
		return nil, wrapInfraError("betting pool unpause", err)
	}
	return tx, nil
}

// UpgradeToAndCall upgrades the BettingPool proxy and optionally executes initialization calldata.
func (p *BettingPool) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, wrapInfraError("betting pool upgrade to and call", err)
	}
	return tx, nil
}

// SetBettingDependencies sets BettingPool dependency addresses for bootstrap or migration.
func (p *BettingPool) SetBettingDependencies(opts *bind.TransactOpts, stakingPoolAddress common.Address, liquidityPoolAddress common.Address, oddTokenAddress common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetBettingDependencies(opts, stakingPoolAddress, liquidityPoolAddress, oddTokenAddress)
	if err != nil {
		return nil, wrapInfraError("betting pool set betting dependencies", err)
	}
	return tx, nil
}

// SetTaxConfig updates bet tax, payout tax, and payout tax allocations.
func (p *BettingPool) SetTaxConfig(opts *bind.TransactOpts, newBetTaxBps uint16, newPayoutTaxBps uint16, newAllocStakingBps uint16, newAllocTaxBufferBps uint16, newAllocPlatformBps uint16, newAllocReferrerBps uint16) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetTaxConfig(opts, newBetTaxBps, newPayoutTaxBps, newAllocStakingBps, newAllocTaxBufferBps, newAllocPlatformBps, newAllocReferrerBps)
	if err != nil {
		return nil, wrapInfraError("betting pool set tax config", err)
	}
	return tx, nil
}

// SetPlatformTreasury updates the platform treasury address.
func (p *BettingPool) SetPlatformTreasury(opts *bind.TransactOpts, treasuryAddress common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetPlatformTreasury(opts, treasuryAddress)
	if err != nil {
		return nil, wrapInfraError("betting pool set platform treasury", err)
	}
	return tx, nil
}

// SetRiskConfig updates WCL thresholds.
func (p *BettingPool) SetRiskConfig(opts *bind.TransactOpts, yellowThreshold *big.Int, orangeThreshold *big.Int, redThreshold *big.Int) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if yellowThreshold == nil || orangeThreshold == nil || redThreshold == nil {
		return nil, wrapUserError("betting pool set risk config", ErrNilBigIntParam)
	}
	tx, err := p.adapter.SetRiskConfig(opts, yellowThreshold, orangeThreshold, redThreshold)
	if err != nil {
		return nil, wrapInfraError("betting pool set risk config", err)
	}
	return tx, nil
}

// SetMarginSplit updates the market margin share sent to LPs.
func (p *BettingPool) SetMarginSplit(opts *bind.TransactOpts, newLpMarginShareBps uint16) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetMarginSplit(opts, newLpMarginShareBps)
	if err != nil {
		return nil, wrapInfraError("betting pool set margin split", err)
	}
	return tx, nil
}

// SetReferralClaimConfig updates the USDT referral claim signer and pool fee.
func (p *BettingPool) SetReferralClaimConfig(opts *bind.TransactOpts, signer common.Address, poolFee *big.Int) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if poolFee == nil {
		return nil, wrapUserError("betting pool set referral claim config", ErrNilBigIntParam)
	}
	tx, err := p.adapter.SetReferralClaimConfig(opts, signer, poolFee)
	if err != nil {
		return nil, wrapInfraError("betting pool set referral claim config", err)
	}
	return tx, nil
}

// SetReferralSwapConfig updates the router and USDT token used for USDT referral claims.
func (p *BettingPool) SetReferralSwapConfig(opts *bind.TransactOpts, swapRouter common.Address, usdtToken common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetReferralSwapConfig(opts, swapRouter, usdtToken)
	if err != nil {
		return nil, wrapInfraError("betting pool set referral swap config", err)
	}
	return tx, nil
}

// SetReferralSwapConfigWithExpectedPool updates the router, USDT token, and expected pool used for USDT referral claims.
func (p *BettingPool) SetReferralSwapConfigWithExpectedPool(opts *bind.TransactOpts, swapRouter common.Address, usdtToken common.Address, expectedPool common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetReferralSwapConfigWithExpectedPool(opts, swapRouter, usdtToken, expectedPool)
	if err != nil {
		return nil, wrapInfraError("betting pool set referral swap config with expected pool", err)
	}
	return tx, nil
}

// SetSettlementModule updates the delegatecall settlement module implementation.
func (p *BettingPool) SetSettlementModule(opts *bind.TransactOpts, newSettlementModule common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetSettlementModule(opts, newSettlementModule)
	if err != nil {
		return nil, wrapInfraError("betting pool set settlement module", err)
	}
	return tx, nil
}

// SetParlayModule updates the delegatecall parlay module implementation.
func (p *BettingPool) SetParlayModule(opts *bind.TransactOpts, newParlayModule common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetParlayModule(opts, newParlayModule)
	if err != nil {
		return nil, wrapInfraError("betting pool set parlay module", err)
	}
	return tx, nil
}

// SetBetModule updates the delegatecall bet module implementation.
func (p *BettingPool) SetBetModule(opts *bind.TransactOpts, newBetModule common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetBetModule(opts, newBetModule)
	if err != nil {
		return nil, wrapInfraError("betting pool set bet module", err)
	}
	return tx, nil
}

// SetMarketModule updates the delegatecall market module implementation.
func (p *BettingPool) SetMarketModule(opts *bind.TransactOpts, newMarketModule common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetMarketModule(opts, newMarketModule)
	if err != nil {
		return nil, wrapInfraError("betting pool set market module", err)
	}
	return tx, nil
}

// SetReferralModule updates the delegatecall referral module implementation.
func (p *BettingPool) SetReferralModule(opts *bind.TransactOpts, newReferralModule common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SetReferralModule(opts, newReferralModule)
	if err != nil {
		return nil, wrapInfraError("betting pool set referral module", err)
	}
	return tx, nil
}

// OpenMarket creates a new betting market. Caller must hold OPERATOR_ROLE.
// baseOdds length must match the market template: 3 for 1x2, 2 for handicap/over-under.
// matchStartTime must be at least 5 minutes in the future (lockAt = matchStartTime - 5 min).
func (p *BettingPool) OpenMarket(opts *bind.TransactOpts, matchID [32]byte, marketType uint8, line uint8, matchStartTime uint64, matchEndTime uint64, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.OpenMarket(opts, matchID, marketType, line, matchStartTime, matchEndTime, baseOdds, updatedAt)
	if err != nil {
		return nil, wrapInfraError("betting pool open market", err)
	}
	return tx, nil
}

// UpdateOdds updates base odds for an open market. Caller must hold OPERATOR_ROLE.
// baseOdds length must match the market outcome count and each odds value uses precision 1e4.
func (p *BettingPool) UpdateOdds(opts *bind.TransactOpts, marketID [32]byte, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.UpdateOdds(opts, marketID, baseOdds, updatedAt)
	if err != nil {
		return nil, wrapInfraError("betting pool update odds", err)
	}
	return tx, nil
}

// LockMarket manually locks an open market. Caller must hold OPERATOR_ROLE.
func (p *BettingPool) LockMarket(opts *bind.TransactOpts, marketID [32]byte) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.LockMarket(opts, marketID)
	if err != nil {
		return nil, wrapInfraError("betting pool lock market", err)
	}
	return tx, nil
}

// CashOut exits a pending bet before settlement using caller-provided quote protection.
// expectedQuoteVersion is the quoteVersion observed by the caller, quotedAt is the quote timestamp,
// minAmountOut is the minimum acceptable ODD wei amount, and deadline is a Unix timestamp.
func (p *BettingPool) CashOut(opts *bind.TransactOpts, betID [32]byte, expectedQuoteVersion *big.Int, quotedAt uint64, minAmountOut *big.Int, deadline *big.Int) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if expectedQuoteVersion == nil || minAmountOut == nil || deadline == nil {
		return nil, wrapUserError("betting pool cash out", ErrNilBigIntParam)
	}
	tx, err := p.adapter.CashOut(opts, betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)
	if err != nil {
		return nil, wrapInfraError("betting pool cash out", err)
	}
	return tx, nil
}

// PlaceParlay submits a parlay bet. Caller must have approved BettingPool for stake plus bet tax.
// Each leg must be assembled from GetMarketOdds output to prevent stale-quote fills.
func (p *BettingPool) PlaceParlay(opts *bind.TransactOpts, legs []ParlayLegInput, stake *big.Int, minComboOdds *big.Int, deadline *big.Int, referrer common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	adapterLegs, err := toAdapterParlayLegs("betting pool place parlay", legs)
	if err != nil {
		return nil, err
	}
	if stake == nil || minComboOdds == nil || deadline == nil {
		return nil, wrapUserError("betting pool place parlay", ErrNilBigIntParam)
	}
	tx, err := p.adapter.PlaceParlay(opts, adapterLegs, stake, minComboOdds, deadline, referrer)
	if err != nil {
		return nil, wrapInfraError("betting pool place parlay", err)
	}
	return tx, nil
}

// PlaceBet submits a bet. Caller must have approved BettingPool for requestedAmount + betTax.
// guard must be assembled from GetMarketOdds output to prevent stale-quote fills.
func (p *BettingPool) PlaceBet(opts *bind.TransactOpts, marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	adapterGuard := contracts.BettingPoolQuoteGuardInput{
		QuoteVersion:      guard.QuoteVersion,
		QuotedAt:          guard.QuotedAt,
		MinOdds:           guard.MinOdds,
		MinAcceptedAmount: guard.MinAcceptedAmount,
		Deadline:          guard.Deadline,
	}
	tx, err := p.adapter.PlaceBet(opts, marketID, outcome, requestedAmount, adapterGuard)
	if err != nil {
		return nil, wrapInfraError("betting pool place bet", err)
	}
	return tx, nil
}

// PlaceBetWithReferrer submits a bet and optionally binds a referrer on first use.
func (p *BettingPool) PlaceBetWithReferrer(opts *bind.TransactOpts, marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput, referrer common.Address) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	adapterGuard := contracts.BettingPoolQuoteGuardInput{
		QuoteVersion:      guard.QuoteVersion,
		QuotedAt:          guard.QuotedAt,
		MinOdds:           guard.MinOdds,
		MinAcceptedAmount: guard.MinAcceptedAmount,
		Deadline:          guard.Deadline,
	}
	tx, err := p.adapter.PlaceBetWithReferrer(opts, marketID, outcome, requestedAmount, adapterGuard, referrer)
	if err != nil {
		return nil, wrapInfraError("betting pool place bet with referrer", err)
	}
	return tx, nil
}

// SettleMarketBetsByScore settles a batch of bets by final score.
// Caller must hold SETTLER_ROLE and block.timestamp must be >= matchEndTime.
func (p *BettingPool) SettleMarketBetsByScore(opts *bind.TransactOpts, marketID [32]byte, homeScore uint16, awayScore uint16, betIDs [][32]byte) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SettleMarketBetsByScore(opts, marketID, homeScore, awayScore, betIDs)
	if err != nil {
		return nil, wrapInfraError("betting pool settle market bets by score", err)
	}
	return tx, nil
}

// FinalizeMarketSettlement finalizes the market terminal state.
// Caller must hold SETTLER_ROLE. resultKindRaw is 0=Settled, 1=Refunded, 2=Cancelled.
func (p *BettingPool) FinalizeMarketSettlement(opts *bind.TransactOpts, marketID [32]byte, resultKindRaw uint8) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.FinalizeMarketSettlement(opts, marketID, resultKindRaw)
	if err != nil {
		return nil, wrapInfraError("betting pool finalize market settlement", err)
	}
	return tx, nil
}

// RefundBets refunds specific bet ids with explicit refund amounts.
// Caller must hold SETTLER_ROLE. betIDs and refundAmounts must have the same length.
func (p *BettingPool) RefundBets(opts *bind.TransactOpts, marketID [32]byte, betIDs [][32]byte, refundAmounts []*big.Int) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.RefundBets(opts, marketID, betIDs, refundAmounts)
	if err != nil {
		return nil, wrapInfraError("betting pool refund bets", err)
	}
	return tx, nil
}

// ClaimPayout claims the net payout for a winning bet. Caller must be the bet owner.
func (p *BettingPool) ClaimPayout(opts *bind.TransactOpts, betID [32]byte) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.ClaimPayout(opts, betID)
	if err != nil {
		return nil, wrapInfraError("betting pool claim payout", err)
	}
	return tx, nil
}

// SettleParlay settles a parlay after its legs have terminal market results.
func (p *BettingPool) SettleParlay(opts *bind.TransactOpts, parlayID [32]byte) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.SettleParlay(opts, parlayID)
	if err != nil {
		return nil, wrapInfraError("betting pool settle parlay", err)
	}
	return tx, nil
}

// ClaimParlayPayout claims the net payout for a winning parlay. Caller must be the parlay owner.
func (p *BettingPool) ClaimParlayPayout(opts *bind.TransactOpts, parlayID [32]byte) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.ClaimParlayPayout(opts, parlayID)
	if err != nil {
		return nil, wrapInfraError("betting pool claim parlay payout", err)
	}
	return tx, nil
}

// ReleasePayoutReserve releases reserved payout capacity for a risk id.
func (p *BettingPool) ReleasePayoutReserve(opts *bind.TransactOpts, riskID [32]byte) (*types.Transaction, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	tx, err := p.adapter.ReleasePayoutReserve(opts, riskID)
	if err != nil {
		return nil, wrapInfraError("betting pool release payout reserve", err)
	}
	return tx, nil
}

// GetMarket reads the on-chain configuration for a market.
func (p *BettingPool) GetMarket(ctx context.Context, marketID [32]byte) (MarketInfo, error) {
	if err := checkContext(ctx, "betting pool get market"); err != nil {
		return MarketInfo{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return MarketInfo{}, err
	}
	raw, err := p.adapter.GetMarket(ctx, marketID)
	if err != nil {
		return MarketInfo{}, wrapInfraError("betting pool get market", err)
	}
	return MarketInfo{
		MatchID:        raw.MatchId,
		MarketType:     raw.MarketType,
		Line:           raw.Line,
		OutcomeCount:   raw.OutcomeCount,
		MatchStartTime: raw.MatchStartTime,
		LockAt:         raw.LockAt,
		Status:         raw.Status,
		MatchEndTime:   raw.MatchEndTime,
	}, nil
}

// GetMarketOdds reads the current odds for a market.
func (p *BettingPool) GetMarketOdds(ctx context.Context, marketID [32]byte) (MarketOdds, error) {
	if err := checkContext(ctx, "betting pool get market odds"); err != nil {
		return MarketOdds{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return MarketOdds{}, err
	}
	baseOdds, quotedOdds, updatedAt, quoteVersion, err := p.adapter.GetMarketOdds(ctx, marketID)
	if err != nil {
		return MarketOdds{}, wrapInfraError("betting pool get market odds", err)
	}
	return MarketOdds{
		BaseOdds:     baseOdds,
		QuotedOdds:   quotedOdds,
		UpdatedAt:    updatedAt,
		QuoteVersion: quoteVersion,
	}, nil
}

// GetMarketExposure reads per-outcome stake and payout exposure for a market.
func (p *BettingPool) GetMarketExposure(ctx context.Context, marketID [32]byte) (MarketExposure, error) {
	if err := checkContext(ctx, "betting pool get market exposure"); err != nil {
		return MarketExposure{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return MarketExposure{}, err
	}
	totalStakedByOutcome, payoutByOutcome, signalColor, err := p.adapter.GetMarketExposure(ctx, marketID)
	if err != nil {
		return MarketExposure{}, wrapInfraError("betting pool get market exposure", err)
	}
	return MarketExposure{
		TotalStakedByOutcome: totalStakedByOutcome,
		PayoutByOutcome:      payoutByOutcome,
		SignalColor:          signalColor,
	}, nil
}

// GetMarketBetIds reads paginated bet IDs for a market.
func (p *BettingPool) GetMarketBetIds(ctx context.Context, marketID [32]byte, offset *big.Int, limit *big.Int) ([][32]byte, error) {
	if err := checkContext(ctx, "betting pool get market bet ids"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if offset == nil || limit == nil {
		return nil, wrapUserError("betting pool get market bet ids", ErrNilBigIntParam)
	}
	betIDs, err := p.adapter.GetMarketBetIds(ctx, marketID, offset, limit)
	if err != nil {
		return nil, wrapInfraError("betting pool get market bet ids", err)
	}
	return betIDs, nil
}

// GetMatchMarketIds reads all market IDs registered for a match.
func (p *BettingPool) GetMatchMarketIds(ctx context.Context, matchID [32]byte) ([][32]byte, error) {
	if err := checkContext(ctx, "betting pool get match market ids"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	marketIDs, err := p.adapter.GetMatchMarketIds(ctx, matchID)
	if err != nil {
		return nil, wrapInfraError("betting pool get match market ids", err)
	}
	return marketIDs, nil
}

// GetBet reads the on-chain state of a bet.
func (p *BettingPool) GetBet(ctx context.Context, betID [32]byte) (BetInfo, error) {
	if err := checkContext(ctx, "betting pool get bet"); err != nil {
		return BetInfo{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return BetInfo{}, err
	}
	raw, err := p.adapter.GetBet(ctx, betID)
	if err != nil {
		return BetInfo{}, wrapInfraError("betting pool get bet", err)
	}
	return BetInfo{
		Owner:           raw.Owner,
		MarketID:        raw.MarketId,
		Outcome:         raw.Outcome,
		AcceptedAmount:  raw.AcceptedAmount,
		RefundedAmount:  raw.RefundedAmount,
		LockedOdds:      raw.LockedOdds,
		SettlementState: raw.SettlementState,
		ClaimablePayout: raw.ClaimablePayout,
	}, nil
}

// GetClaimStatus reads whether a bet is won and the claimable reward.
func (p *BettingPool) GetClaimStatus(ctx context.Context, user common.Address, betID [32]byte) (ClaimStatus, error) {
	if err := checkContext(ctx, "betting pool get claim status"); err != nil {
		return ClaimStatus{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return ClaimStatus{}, err
	}
	value, err := p.adapter.GetClaimStatus(ctx, user, betID)
	if err != nil {
		return ClaimStatus{}, wrapInfraError("betting pool get claim status", err)
	}
	return ClaimStatus{
		Won:    value.Won,
		Reward: value.Reward,
	}, nil
}

// EstimateBetValue reads the display-only estimated value for a pending bet.
func (p *BettingPool) EstimateBetValue(ctx context.Context, user common.Address, betID [32]byte) (BetEstimatedValue, error) {
	if err := checkContext(ctx, "betting pool estimate bet value"); err != nil {
		return BetEstimatedValue{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return BetEstimatedValue{}, err
	}
	value, err := p.adapter.EstimateBetValue(ctx, user, betID)
	if err != nil {
		return BetEstimatedValue{}, wrapInfraError("betting pool estimate bet value", err)
	}
	return BetEstimatedValue{
		EstimatedValue: value.EstimatedValue,
		FloatingPnL:    value.FloatingPnL,
	}, nil
}

// GetUserRiskLedger reads a user's daily accepted amount and unsettled stake.
func (p *BettingPool) GetUserRiskLedger(ctx context.Context, user common.Address) (UserRiskLedger, error) {
	if err := checkContext(ctx, "betting pool get user risk ledger"); err != nil {
		return UserRiskLedger{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return UserRiskLedger{}, err
	}
	raw, err := p.adapter.GetUserRiskLedger(ctx, user)
	if err != nil {
		return UserRiskLedger{}, wrapInfraError("betting pool get user risk ledger", err)
	}
	return UserRiskLedger{
		DayBucket:           raw.DayBucket,
		DailyAcceptedAmount: raw.DailyAcceptedAmount,
		UnsettledStake:      raw.UnsettledStake,
	}, nil
}

// ParlayModule reads the parlay module address configured on BettingPool.
func (p *BettingPool) ParlayModule(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool parlay module"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.ParlayModule(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool parlay module", err)
	}
	return value, nil
}

// BetModule reads the bet module address configured on BettingPool.
func (p *BettingPool) BetModule(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool bet module"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.BetModule(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool bet module", err)
	}
	return value, nil
}

// MarketModule reads the market module address configured on BettingPool.
func (p *BettingPool) MarketModule(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool market module"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.MarketModule(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool market module", err)
	}
	return value, nil
}

// ReferralModule reads the referral module address configured on BettingPool.
func (p *BettingPool) ReferralModule(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool referral module"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.ReferralModule(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool referral module", err)
	}
	return value, nil
}

// NextParlayNonce reads the next parlay nonce that will be assigned.
func (p *BettingPool) NextParlayNonce(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool next parlay nonce"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.NextParlayNonce(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool next parlay nonce", err)
	}
	return value, nil
}

// NextBetNonce reads the next bet nonce that will be assigned.
func (p *BettingPool) NextBetNonce(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool next bet nonce"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.NextBetNonce(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool next bet nonce", err)
	}
	return value, nil
}

// OpenParlayMaxPayout reads aggregate max payout currently reserved by open parlays.
func (p *BettingPool) OpenParlayMaxPayout(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool open parlay max payout"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.OpenParlayMaxPayout(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool open parlay max payout", err)
	}
	return value, nil
}

// MarketFinalResult reads the stored terminal result for a market.
func (p *BettingPool) MarketFinalResult(ctx context.Context, marketID [32]byte) (MarketFinalResult, error) {
	if err := checkContext(ctx, "betting pool market final result"); err != nil {
		return MarketFinalResult{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return MarketFinalResult{}, err
	}
	raw, err := p.adapter.MarketFinalResults(ctx, marketID)
	if err != nil {
		return MarketFinalResult{}, wrapInfraError("betting pool market final result", err)
	}
	return MarketFinalResult{
		Finalized:    raw.Finalized,
		ResultKind:   raw.ResultKind,
		ScoreSettled: raw.ScoreSettled,
		HomeScore:    raw.HomeScore,
		AwayScore:    raw.AwayScore,
	}, nil
}

// GetParlay reads the on-chain state of a parlay.
func (p *BettingPool) GetParlay(ctx context.Context, parlayID [32]byte) (ParlayInfo, error) {
	if err := checkContext(ctx, "betting pool get parlay"); err != nil {
		return ParlayInfo{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return ParlayInfo{}, err
	}
	raw, err := p.adapter.GetParlay(ctx, parlayID)
	if err != nil {
		return ParlayInfo{}, wrapInfraError("betting pool get parlay", err)
	}
	return ParlayInfo{
		Owner:                raw.Owner,
		Stake:                raw.Stake,
		LockedComboOdds:      raw.LockedComboOdds,
		MaxPayout:            raw.MaxPayout,
		ClaimablePayout:      raw.ClaimablePayout,
		ParlayRiskID:         raw.ParlayRiskID,
		AcceptedDayBucket:    raw.AcceptedDayBucket,
		LegCount:             raw.LegCount,
		State:                raw.State,
		PayoutTaxRateBps:     raw.PayoutTaxRateBps,
		TaxAllocStakingBps:   raw.TaxAllocStakingBps,
		TaxAllocTaxBufferBps: raw.TaxAllocTaxBufferBps,
		TaxAllocReferrerBps:  raw.TaxAllocReferrerBps,
		ReferrerSnapshot:     raw.ReferrerSnapshot,
	}, nil
}

// GetParlayLeg reads one parlay leg by index.
func (p *BettingPool) GetParlayLeg(ctx context.Context, parlayID [32]byte, legIndex *big.Int) (ParlayLegInfo, error) {
	if err := checkContext(ctx, "betting pool get parlay leg"); err != nil {
		return ParlayLegInfo{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return ParlayLegInfo{}, err
	}
	if legIndex == nil {
		return ParlayLegInfo{}, wrapUserError("betting pool get parlay leg", ErrNilBigIntParam)
	}
	raw, err := p.adapter.GetParlayLeg(ctx, parlayID, legIndex)
	if err != nil {
		return ParlayLegInfo{}, wrapInfraError("betting pool get parlay leg", err)
	}
	return ParlayLegInfo{
		MarketID:        raw.MarketID,
		MatchID:         raw.MatchID,
		MarketType:      raw.MarketType,
		Line:            raw.Line,
		Outcome:         raw.Outcome,
		LockedOdds:      raw.LockedOdds,
		SyntheticPayout: raw.SyntheticPayout,
		Result:          raw.Result,
	}, nil
}

// GetParlayClaimStatus reads whether a parlay is won and the claimable reward.
func (p *BettingPool) GetParlayClaimStatus(ctx context.Context, user common.Address, parlayID [32]byte) (ClaimStatus, error) {
	if err := checkContext(ctx, "betting pool get parlay claim status"); err != nil {
		return ClaimStatus{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return ClaimStatus{}, err
	}
	value, err := p.adapter.GetParlayClaimStatus(ctx, user, parlayID)
	if err != nil {
		return ClaimStatus{}, wrapInfraError("betting pool get parlay claim status", err)
	}
	return ClaimStatus{
		Won:    value.Won,
		Reward: value.Reward,
	}, nil
}

// EstimateParlayValue reads the display-only estimated value for a pending parlay.
func (p *BettingPool) EstimateParlayValue(ctx context.Context, user common.Address, parlayID [32]byte) (ParlayEstimatedValue, error) {
	if err := checkContext(ctx, "betting pool estimate parlay value"); err != nil {
		return ParlayEstimatedValue{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return ParlayEstimatedValue{}, err
	}
	value, err := p.adapter.EstimateParlayValue(ctx, user, parlayID)
	if err != nil {
		return ParlayEstimatedValue{}, wrapInfraError("betting pool estimate parlay value", err)
	}
	return ParlayEstimatedValue{
		State:              value.State,
		Stake:              value.Stake,
		LockedComboOdds:    value.LockedComboOdds,
		MaxPayout:          value.MaxPayout,
		EstimatedValue:     value.EstimatedValue,
		FloatingPnL:        value.FloatingPnL,
		FactorProduct:      value.FactorProduct,
		FinalizedLegCount:  value.FinalizedLegCount,
		UnresolvedLegCount: value.UnresolvedLegCount,
		HasFullLoss:        value.HasFullLoss,
		IsFinal:            value.IsFinal,
	}, nil
}

// PreviewSignal estimates the signal, fill, and locked odds for a potential bet without submitting.
func (p *BettingPool) PreviewSignal(ctx context.Context, marketID [32]byte, outcome uint8, requestedAmount *big.Int) (SignalResult, error) {
	if err := checkContext(ctx, "betting pool preview signal"); err != nil {
		return SignalResult{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return SignalResult{}, err
	}
	signal, accepted, locked, partial, maxAcceptable, err := p.adapter.PreviewSignal(ctx, marketID, outcome, requestedAmount)
	if err != nil {
		return SignalResult{}, wrapInfraError("betting pool preview signal", err)
	}
	return SignalResult{
		Signal:              signal,
		AcceptedAmount:      accepted,
		LockedOdds:          locked,
		PartialFill:         partial,
		MaxAcceptableAmount: maxAcceptable,
	}, nil
}

// IsMatchTerminal returns true when all markets for the match are in a terminal state.
func (p *BettingPool) IsMatchTerminal(ctx context.Context, matchID [32]byte) (bool, error) {
	if err := checkContext(ctx, "betting pool is match terminal"); err != nil {
		return false, err
	}
	if err := ensureBettingPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.IsMatchTerminal(ctx, matchID)
	if err != nil {
		return false, wrapInfraError("betting pool is match terminal", err)
	}
	return value, nil
}

// Referrer reads the referrer bound to a user.
func (p *BettingPool) Referrer(ctx context.Context, user common.Address) (common.Address, error) {
	if err := checkContext(ctx, "betting pool referrer"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.Referrers(ctx, user)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool referrer", err)
	}
	return value, nil
}

// ReferrerRewardsOdd reads claimable ODD referral rewards for a referrer.
func (p *BettingPool) ReferrerRewardsOdd(ctx context.Context, referrer common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool referrer rewards odd"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.ReferrerRewardsOdd(ctx, referrer)
	if err != nil {
		return nil, wrapInfraError("betting pool referrer rewards odd", err)
	}
	return value, nil
}

// ReferralClaimSigner reads the signer used for USDT referral claim authorization.
func (p *BettingPool) ReferralClaimSigner(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool referral claim signer"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.ReferralClaimSigner(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool referral claim signer", err)
	}
	return value, nil
}

// ReferralSwapPoolFee reads the Pancake V3 pool fee used by USDT referral claims.
func (p *BettingPool) ReferralSwapPoolFee(ctx context.Context) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool referral swap pool fee"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.ReferralSwapPoolFee(ctx)
	if err != nil {
		return nil, wrapInfraError("betting pool referral swap pool fee", err)
	}
	return value, nil
}

// ReferralSwapRouter reads the router used by USDT referral claims.
func (p *BettingPool) ReferralSwapRouter(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool referral swap router"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.ReferralSwapRouter(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool referral swap router", err)
	}
	return value, nil
}

// ReferralUsdtToken reads the USDT token used by USDT referral claims.
func (p *BettingPool) ReferralUsdtToken(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool referral usdt token"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.ReferralUsdtToken(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool referral usdt token", err)
	}
	return value, nil
}

// ReferralClaimNonce reads a user's USDT referral claim nonce.
func (p *BettingPool) ReferralClaimNonce(ctx context.Context, user common.Address) (*big.Int, error) {
	if err := checkContext(ctx, "betting pool referral claim nonce"); err != nil {
		return nil, err
	}
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	value, err := p.adapter.ReferralClaimNonces(ctx, user)
	if err != nil {
		return nil, wrapInfraError("betting pool referral claim nonce", err)
	}
	return value, nil
}

// SettlementModule reads the settlement module implementation configured on BettingPool.
func (p *BettingPool) SettlementModule(ctx context.Context) (common.Address, error) {
	if err := checkContext(ctx, "betting pool settlement module"); err != nil {
		return common.Address{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return common.Address{}, err
	}
	value, err := p.adapter.SettlementModule(ctx)
	if err != nil {
		return common.Address{}, wrapInfraError("betting pool settlement module", err)
	}
	return value, nil
}

// HasRole returns true when account holds role on BettingPool.
func (p *BettingPool) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	if err := checkContext(ctx, "betting pool has role"); err != nil {
		return false, err
	}
	if err := ensureBettingPool(p); err != nil {
		return false, err
	}
	value, err := p.adapter.HasRole(ctx, role, account)
	if err != nil {
		return false, wrapInfraError("betting pool has role", err)
	}
	return value, nil
}

// GetRoleAdmin reads the admin role for role on BettingPool.
func (p *BettingPool) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	if err := checkContext(ctx, "betting pool get role admin"); err != nil {
		return [32]byte{}, err
	}
	if err := ensureBettingPool(p); err != nil {
		return [32]byte{}, err
	}
	value, err := p.adapter.GetRoleAdmin(ctx, role)
	if err != nil {
		return [32]byte{}, wrapInfraError("betting pool get role admin", err)
	}
	return value, nil
}

// AddPlatformReserveCalldata returns ABI-encoded calldata for BettingPool.addPlatformReserve; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) AddPlatformReserveCalldata(amount *big.Int) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if amount == nil {
		return nil, wrapUserError("betting pool add platform reserve calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.AddPlatformReserveCalldata(amount)
	if err != nil {
		return nil, wrapUserError("betting pool add platform reserve calldata", err)
	}
	return data, nil
}

// GrantRoleCalldata returns ABI-encoded calldata for BettingPool.grantRole; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) GrantRoleCalldata(role [32]byte, account common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.GrantRoleCalldata(role, account)
	if err != nil {
		return nil, wrapUserError("betting pool grant role calldata", err)
	}
	return data, nil
}

// RevokeRoleCalldata returns ABI-encoded calldata for BettingPool.revokeRole; does not sign, broadcast, or query RPC.
func (p *BettingPool) RevokeRoleCalldata(role [32]byte, account common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.RevokeRoleCalldata(role, account)
	if err != nil {
		return nil, wrapUserError("betting pool revoke role calldata", err)
	}
	return data, nil
}

// RenounceRoleCalldata returns ABI-encoded calldata for BettingPool.renounceRole; does not sign, broadcast, or query RPC.
func (p *BettingPool) RenounceRoleCalldata(role [32]byte, callerConfirmation common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.RenounceRoleCalldata(role, callerConfirmation)
	if err != nil {
		return nil, wrapUserError("betting pool renounce role calldata", err)
	}
	return data, nil
}

// PauseCalldata returns ABI-encoded calldata for BettingPool.pause; does not sign, broadcast, or query RPC.
func (p *BettingPool) PauseCalldata() ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.PauseCalldata()
	if err != nil {
		return nil, wrapUserError("betting pool pause calldata", err)
	}
	return data, nil
}

// UnpauseCalldata returns ABI-encoded calldata for BettingPool.unpause; does not sign, broadcast, or query RPC.
func (p *BettingPool) UnpauseCalldata() ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.UnpauseCalldata()
	if err != nil {
		return nil, wrapUserError("betting pool unpause calldata", err)
	}
	return data, nil
}

// UpgradeToAndCallCalldata returns ABI-encoded calldata for BettingPool.upgradeToAndCall; does not sign, broadcast, or query RPC.
func (p *BettingPool) UpgradeToAndCallCalldata(newImplementation common.Address, callData []byte) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.UpgradeToAndCallCalldata(newImplementation, callData)
	if err != nil {
		return nil, wrapUserError("betting pool upgrade to and call calldata", err)
	}
	return data, nil
}

// BindReferrerCalldata returns ABI-encoded calldata for BettingPool.bindReferrer; does not sign, broadcast, or query RPC.
func (p *BettingPool) BindReferrerCalldata(referrer common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.BindReferrerCalldata(referrer)
	if err != nil {
		return nil, wrapUserError("betting pool bind referrer calldata", err)
	}
	return data, nil
}

// ClaimReferralRewardsCalldata returns ABI-encoded calldata for BettingPool.claimReferralRewards; does not sign, broadcast, or query RPC.
func (p *BettingPool) ClaimReferralRewardsCalldata(oddAmount *big.Int) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if oddAmount == nil {
		return nil, wrapUserError("betting pool claim referral rewards calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.ClaimReferralRewardsCalldata(oddAmount)
	if err != nil {
		return nil, wrapUserError("betting pool claim referral rewards calldata", err)
	}
	return data, nil
}

// ClaimUSDTReferralRewardsCalldata returns ABI-encoded calldata for BettingPool.claimUSDTReferralRewards; does not sign, broadcast, or query RPC.
func (p *BettingPool) ClaimUSDTReferralRewardsCalldata(rewardMinUsdtOutAmount *big.Int, signatureDeadline *big.Int, signature []byte, minUsdtOut *big.Int) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if rewardMinUsdtOutAmount == nil || signatureDeadline == nil || minUsdtOut == nil {
		return nil, wrapUserError("betting pool claim usdt referral rewards calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.ClaimUSDTReferralRewardsCalldata(rewardMinUsdtOutAmount, signatureDeadline, signature, minUsdtOut)
	if err != nil {
		return nil, wrapUserError("betting pool claim usdt referral rewards calldata", err)
	}
	return data, nil
}

// SetBettingDependenciesCalldata returns ABI-encoded calldata for BettingPool.setBettingDependencies; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetBettingDependenciesCalldata(stakingPoolAddress common.Address, liquidityPoolAddress common.Address, oddTokenAddress common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetBettingDependenciesCalldata(stakingPoolAddress, liquidityPoolAddress, oddTokenAddress)
	if err != nil {
		return nil, wrapUserError("betting pool set betting dependencies calldata", err)
	}
	return data, nil
}

// SetTaxConfigCalldata returns ABI-encoded calldata for BettingPool.setTaxConfig; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetTaxConfigCalldata(newBetTaxBps uint16, newPayoutTaxBps uint16, newAllocStakingBps uint16, newAllocTaxBufferBps uint16, newAllocPlatformBps uint16, newAllocReferrerBps uint16) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetTaxConfigCalldata(newBetTaxBps, newPayoutTaxBps, newAllocStakingBps, newAllocTaxBufferBps, newAllocPlatformBps, newAllocReferrerBps)
	if err != nil {
		return nil, wrapUserError("betting pool set tax config calldata", err)
	}
	return data, nil
}

// SetPlatformTreasuryCalldata returns ABI-encoded calldata for BettingPool.setPlatformTreasury; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetPlatformTreasuryCalldata(treasuryAddress common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetPlatformTreasuryCalldata(treasuryAddress)
	if err != nil {
		return nil, wrapUserError("betting pool set platform treasury calldata", err)
	}
	return data, nil
}

// SetRiskConfigCalldata returns ABI-encoded calldata for BettingPool.setRiskConfig; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetRiskConfigCalldata(yellowThreshold *big.Int, orangeThreshold *big.Int, redThreshold *big.Int) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if yellowThreshold == nil || orangeThreshold == nil || redThreshold == nil {
		return nil, wrapUserError("betting pool set risk config calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.SetRiskConfigCalldata(yellowThreshold, orangeThreshold, redThreshold)
	if err != nil {
		return nil, wrapUserError("betting pool set risk config calldata", err)
	}
	return data, nil
}

// SetMarginSplitCalldata returns ABI-encoded calldata for BettingPool.setMarginSplit; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetMarginSplitCalldata(newLpMarginShareBps uint16) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetMarginSplitCalldata(newLpMarginShareBps)
	if err != nil {
		return nil, wrapUserError("betting pool set margin split calldata", err)
	}
	return data, nil
}

// SetReferralClaimConfigCalldata returns ABI-encoded calldata for BettingPool.setReferralClaimConfig; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetReferralClaimConfigCalldata(signer common.Address, poolFee *big.Int) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if poolFee == nil {
		return nil, wrapUserError("betting pool set referral claim config calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.SetReferralClaimConfigCalldata(signer, poolFee)
	if err != nil {
		return nil, wrapUserError("betting pool set referral claim config calldata", err)
	}
	return data, nil
}

// SetReferralSwapConfigCalldata returns ABI-encoded calldata for BettingPool.setReferralSwapConfig; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetReferralSwapConfigCalldata(swapRouter common.Address, usdtToken common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetReferralSwapConfigCalldata(swapRouter, usdtToken)
	if err != nil {
		return nil, wrapUserError("betting pool set referral swap config calldata", err)
	}
	return data, nil
}

// SetReferralSwapConfigWithExpectedPoolCalldata returns ABI-encoded calldata for BettingPool.setReferralSwapConfig(address,address,address); does not sign, broadcast, or query RPC.
func (p *BettingPool) SetReferralSwapConfigWithExpectedPoolCalldata(swapRouter common.Address, usdtToken common.Address, expectedPool common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetReferralSwapConfigWithExpectedPoolCalldata(swapRouter, usdtToken, expectedPool)
	if err != nil {
		return nil, wrapUserError("betting pool set referral swap config with expected pool calldata", err)
	}
	return data, nil
}

// SetSettlementModuleCalldata returns ABI-encoded calldata for BettingPool.setSettlementModule; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetSettlementModuleCalldata(newSettlementModule common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetSettlementModuleCalldata(newSettlementModule)
	if err != nil {
		return nil, wrapUserError("betting pool set settlement module calldata", err)
	}
	return data, nil
}

// SetParlayModuleCalldata returns ABI-encoded calldata for BettingPool.setParlayModule; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetParlayModuleCalldata(newParlayModule common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetParlayModuleCalldata(newParlayModule)
	if err != nil {
		return nil, wrapUserError("betting pool set parlay module calldata", err)
	}
	return data, nil
}

// SetBetModuleCalldata returns ABI-encoded calldata for BettingPool.setBetModule; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetBetModuleCalldata(newBetModule common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetBetModuleCalldata(newBetModule)
	if err != nil {
		return nil, wrapUserError("betting pool set bet module calldata", err)
	}
	return data, nil
}

// SetMarketModuleCalldata returns ABI-encoded calldata for BettingPool.setMarketModule; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetMarketModuleCalldata(newMarketModule common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetMarketModuleCalldata(newMarketModule)
	if err != nil {
		return nil, wrapUserError("betting pool set market module calldata", err)
	}
	return data, nil
}

// SetReferralModuleCalldata returns ABI-encoded calldata for BettingPool.setReferralModule; does not sign, broadcast, or query RPC.
func (p *BettingPool) SetReferralModuleCalldata(newReferralModule common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SetReferralModuleCalldata(newReferralModule)
	if err != nil {
		return nil, wrapUserError("betting pool set referral module calldata", err)
	}
	return data, nil
}

// OpenMarketCalldata returns ABI-encoded calldata for BettingPool.openMarket; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) OpenMarketCalldata(matchID [32]byte, marketType uint8, line uint8, matchStartTime uint64, matchEndTime uint64, baseOdds []*big.Int, updatedAt uint64) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if baseOdds == nil {
		return nil, wrapUserError("betting pool open market calldata", ErrNilBigIntParam)
	}
	for _, o := range baseOdds {
		if o == nil {
			return nil, wrapUserError("betting pool open market calldata", ErrNilBigIntParam)
		}
	}
	data, err := p.adapter.OpenMarketCalldata(matchID, marketType, line, matchStartTime, matchEndTime, baseOdds, updatedAt)
	if err != nil {
		return nil, wrapUserError("betting pool open market calldata", err)
	}
	return data, nil
}

// UpdateOddsCalldata returns ABI-encoded calldata for BettingPool.updateOdds; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) UpdateOddsCalldata(marketID [32]byte, baseOdds []*big.Int, updatedAt uint64) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if baseOdds == nil {
		return nil, wrapUserError("betting pool update odds calldata", ErrNilBigIntParam)
	}
	for _, o := range baseOdds {
		if o == nil {
			return nil, wrapUserError("betting pool update odds calldata", ErrNilBigIntParam)
		}
	}
	data, err := p.adapter.UpdateOddsCalldata(marketID, baseOdds, updatedAt)
	if err != nil {
		return nil, wrapUserError("betting pool update odds calldata", err)
	}
	return data, nil
}

// LockMarketCalldata returns ABI-encoded calldata for BettingPool.lockMarket; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) LockMarketCalldata(marketID [32]byte) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.LockMarketCalldata(marketID)
	if err != nil {
		return nil, wrapUserError("betting pool lock market calldata", err)
	}
	return data, nil
}

// CashOutCalldata returns ABI-encoded calldata for BettingPool.cashOut; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) CashOutCalldata(betID [32]byte, expectedQuoteVersion *big.Int, quotedAt uint64, minAmountOut *big.Int, deadline *big.Int) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if expectedQuoteVersion == nil || minAmountOut == nil || deadline == nil {
		return nil, wrapUserError("betting pool cash out calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.CashOutCalldata(betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)
	if err != nil {
		return nil, wrapUserError("betting pool cash out calldata", err)
	}
	return data, nil
}

// PlaceParlayCalldata returns ABI-encoded calldata for BettingPool.placeParlay; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) PlaceParlayCalldata(legs []ParlayLegInput, stake *big.Int, minComboOdds *big.Int, deadline *big.Int, referrer common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	adapterLegs, err := toAdapterParlayLegs("betting pool place parlay calldata", legs)
	if err != nil {
		return nil, err
	}
	if stake == nil || minComboOdds == nil || deadline == nil {
		return nil, wrapUserError("betting pool place parlay calldata", ErrNilBigIntParam)
	}
	data, err := p.adapter.PlaceParlayCalldata(adapterLegs, stake, minComboOdds, deadline, referrer)
	if err != nil {
		return nil, wrapUserError("betting pool place parlay calldata", err)
	}
	return data, nil
}

// PlaceBetCalldata returns ABI-encoded calldata for BettingPool.placeBet; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) PlaceBetCalldata(marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if requestedAmount == nil ||
		guard.QuoteVersion == nil ||
		guard.MinOdds == nil ||
		guard.MinAcceptedAmount == nil ||
		guard.Deadline == nil {
		return nil, wrapUserError("betting pool place bet calldata", ErrNilBigIntParam)
	}
	adapterGuard := contracts.BettingPoolQuoteGuardInput{
		QuoteVersion:      guard.QuoteVersion,
		QuotedAt:          guard.QuotedAt,
		MinOdds:           guard.MinOdds,
		MinAcceptedAmount: guard.MinAcceptedAmount,
		Deadline:          guard.Deadline,
	}
	data, err := p.adapter.PlaceBetCalldata(marketID, outcome, requestedAmount, adapterGuard)
	if err != nil {
		return nil, wrapUserError("betting pool place bet calldata", err)
	}
	return data, nil
}

// PlaceBetWithReferrerCalldata returns ABI-encoded calldata for the referrer overload of BettingPool.placeBet; does not sign, broadcast, or query RPC.
func (p *BettingPool) PlaceBetWithReferrerCalldata(marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard QuoteGuardInput, referrer common.Address) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if requestedAmount == nil ||
		guard.QuoteVersion == nil ||
		guard.MinOdds == nil ||
		guard.MinAcceptedAmount == nil ||
		guard.Deadline == nil {
		return nil, wrapUserError("betting pool place bet with referrer calldata", ErrNilBigIntParam)
	}
	adapterGuard := contracts.BettingPoolQuoteGuardInput{
		QuoteVersion:      guard.QuoteVersion,
		QuotedAt:          guard.QuotedAt,
		MinOdds:           guard.MinOdds,
		MinAcceptedAmount: guard.MinAcceptedAmount,
		Deadline:          guard.Deadline,
	}
	data, err := p.adapter.PlaceBetWithReferrerCalldata(marketID, outcome, requestedAmount, adapterGuard, referrer)
	if err != nil {
		return nil, wrapUserError("betting pool place bet with referrer calldata", err)
	}
	return data, nil
}

// SettleMarketBetsByScoreCalldata returns ABI-encoded calldata for BettingPool.settleMarketBetsByScore; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) SettleMarketBetsByScoreCalldata(marketID [32]byte, homeScore uint16, awayScore uint16, betIDs [][32]byte) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SettleMarketBetsByScoreCalldata(marketID, homeScore, awayScore, betIDs)
	if err != nil {
		return nil, wrapUserError("betting pool settle market bets by score calldata", err)
	}
	return data, nil
}

// FinalizeMarketSettlementCalldata returns ABI-encoded calldata for BettingPool.finalizeMarketSettlement; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) FinalizeMarketSettlementCalldata(marketID [32]byte, resultKindRaw uint8) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.FinalizeMarketSettlementCalldata(marketID, resultKindRaw)
	if err != nil {
		return nil, wrapUserError("betting pool finalize market settlement calldata", err)
	}
	return data, nil
}

// RefundBetsCalldata returns ABI-encoded calldata for BettingPool.refundBets; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) RefundBetsCalldata(marketID [32]byte, betIDs [][32]byte, refundAmounts []*big.Int) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	if refundAmounts == nil {
		return nil, wrapUserError("betting pool refund bets calldata", ErrNilBigIntParam)
	}
	for _, amount := range refundAmounts {
		if amount == nil {
			return nil, wrapUserError("betting pool refund bets calldata", ErrNilBigIntParam)
		}
	}
	data, err := p.adapter.RefundBetsCalldata(marketID, betIDs, refundAmounts)
	if err != nil {
		return nil, wrapUserError("betting pool refund bets calldata", err)
	}
	return data, nil
}

// ClaimPayoutCalldata returns ABI-encoded calldata for BettingPool.claimPayout; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) ClaimPayoutCalldata(betID [32]byte) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.ClaimPayoutCalldata(betID)
	if err != nil {
		return nil, wrapUserError("betting pool claim payout calldata", err)
	}
	return data, nil
}

// SettleParlayCalldata returns ABI-encoded calldata for BettingPool.settleParlay; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) SettleParlayCalldata(parlayID [32]byte) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.SettleParlayCalldata(parlayID)
	if err != nil {
		return nil, wrapUserError("betting pool settle parlay calldata", err)
	}
	return data, nil
}

// ClaimParlayPayoutCalldata returns ABI-encoded calldata for BettingPool.claimParlayPayout; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) ClaimParlayPayoutCalldata(parlayID [32]byte) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.ClaimParlayPayoutCalldata(parlayID)
	if err != nil {
		return nil, wrapUserError("betting pool claim parlay payout calldata", err)
	}
	return data, nil
}

// ReleasePayoutReserveCalldata returns ABI-encoded calldata for BettingPool.releasePayoutReserve; does not sign, broadcast, or query RPC.
// The returned bytes can be used as the data field of an EIP-7702 inner call or any other context that needs raw calldata.
func (p *BettingPool) ReleasePayoutReserveCalldata(riskID [32]byte) ([]byte, error) {
	if err := ensureBettingPool(p); err != nil {
		return nil, err
	}
	data, err := p.adapter.ReleasePayoutReserveCalldata(riskID)
	if err != nil {
		return nil, wrapUserError("betting pool release payout reserve calldata", err)
	}
	return data, nil
}

func toAdapterParlayLegs(op string, legs []ParlayLegInput) ([]contracts.BettingPoolParlayLegInput, error) {
	if legs == nil {
		return nil, wrapUserError(op, ErrNilBigIntParam)
	}
	adapterLegs := make([]contracts.BettingPoolParlayLegInput, len(legs))
	for i, leg := range legs {
		if leg.QuoteVersion == nil || leg.MinOdds == nil {
			return nil, wrapUserError(op, ErrNilBigIntParam)
		}
		adapterLegs[i] = contracts.BettingPoolParlayLegInput{
			MarketID:     leg.MarketID,
			Outcome:      leg.Outcome,
			QuoteVersion: leg.QuoteVersion,
			QuotedAt:     leg.QuotedAt,
			MinOdds:      leg.MinOdds,
		}
	}
	return adapterLegs, nil
}
