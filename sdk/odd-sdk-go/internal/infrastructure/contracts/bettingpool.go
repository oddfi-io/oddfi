package contracts

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/bindings/bettingpool"
	"github.com/Crypto-Barrett/oddfi-ODD-SDK/internal/infrastructure/chain"
)

// BettingPoolAdapter reads betting pool state through generated bindings.
type BettingPoolAdapter struct {
	caller     *bettingpool.BettingPoolCaller
	transactor *bettingpool.BettingPoolTransactor
}

// BettingPoolQuoteGuardInput carries quote-protection values into the BettingPool binding adapter.
type BettingPoolQuoteGuardInput struct {
	QuoteVersion      *big.Int
	QuotedAt          uint64
	MinOdds           *big.Int
	MinAcceptedAmount *big.Int
	Deadline          *big.Int
}

// BettingPoolParlayLegInput carries quote-protection values for one parlay leg.
type BettingPoolParlayLegInput struct {
	MarketID     [32]byte
	Outcome      uint8
	QuoteVersion *big.Int
	QuotedAt     uint64
	MinOdds      *big.Int
}

// BettingPoolMarketFinalResult is the stored final result for a market.
type BettingPoolMarketFinalResult struct {
	Finalized    bool
	ResultKind   uint8
	ScoreSettled bool
	HomeScore    uint16
	AwayScore    uint16
}

// BettingPoolParlayInfo is the stored on-chain state of a parlay.
type BettingPoolParlayInfo struct {
	Owner                common.Address
	Stake                *big.Int
	LockedComboOdds      *big.Int
	MaxPayout            *big.Int
	ClaimablePayout      *big.Int
	ParlayRiskID         [32]byte
	AcceptedDayBucket    uint32
	LegCount             uint8
	State                uint8
	PayoutTaxRateBps     uint16
	TaxAllocStakingBps   uint16
	TaxAllocTaxBufferBps uint16
	TaxAllocReferrerBps  uint16
	ReferrerSnapshot     common.Address
}

// BettingPoolParlayLegInfo is the stored on-chain state of one parlay leg.
type BettingPoolParlayLegInfo struct {
	MarketID        [32]byte
	MatchID         [32]byte
	MarketType      uint8
	Line            uint8
	Outcome         uint8
	LockedOdds      *big.Int
	SyntheticPayout *big.Int
	Result          uint8
}

// BettingPoolClaimStatus is a claimability snapshot for a bet or parlay.
type BettingPoolClaimStatus struct {
	Won    bool
	Reward *big.Int
}

// BettingPoolBetEstimatedValue is the display estimate for an existing bet.
type BettingPoolBetEstimatedValue struct {
	EstimatedValue *big.Int
	FloatingPnL    *big.Int
}

// BettingPoolParlayEstimatedValue is the display estimate for an existing parlay.
type BettingPoolParlayEstimatedValue struct {
	State              uint8
	Stake              *big.Int
	LockedComboOdds    *big.Int
	MaxPayout          *big.Int
	EstimatedValue     *big.Int
	FloatingPnL        *big.Int
	FactorProduct      *big.Int
	FinalizedLegCount  uint8
	UnresolvedLegCount uint8
	HasFullLoss        bool
	IsFinal            bool
}

// BettingPoolUserRiskLedger is the user's daily and unsettled betting risk state.
type BettingPoolUserRiskLedger struct {
	DayBucket           uint32
	DailyAcceptedAmount *big.Int
	UnsettledStake      *big.Int
}

// NewBettingPoolAdapter binds a BettingPool adapter to proxyAddress.
func NewBettingPoolAdapter(caller bind.ContractCaller, transactor bind.ContractTransactor, proxyAddress common.Address) (*BettingPoolAdapter, error) {
	if caller == nil {
		return nil, chain.ErrMissingRPCClient
	}
	pool, err := bettingpool.NewBettingPoolCaller(proxyAddress, caller)
	if err != nil {
		return nil, fmt.Errorf("bind betting pool caller: %w", err)
	}
	var poolTransactor *bettingpool.BettingPoolTransactor
	if transactor != nil {
		poolTransactor, err = bettingpool.NewBettingPoolTransactor(proxyAddress, transactor)
		if err != nil {
			return nil, fmt.Errorf("bind betting pool transactor: %w", err)
		}
	}
	return &BettingPoolAdapter{caller: pool, transactor: poolTransactor}, nil
}

// OddToken reads the configured ODD token address.
func (a *BettingPoolAdapter) OddToken(ctx context.Context) (common.Address, error) {
	return a.caller.OddToken(callOpts(ctx))
}

// StakingPool reads the configured staking pool address.
func (a *BettingPoolAdapter) StakingPool(ctx context.Context) (common.Address, error) {
	return a.caller.StakingPool(callOpts(ctx))
}

// LiquidityPool reads the configured liquidity pool address.
func (a *BettingPoolAdapter) LiquidityPool(ctx context.Context) (common.Address, error) {
	return a.caller.LiquidityPool(callOpts(ctx))
}

// PlatformTreasury reads the configured platform treasury address.
func (a *BettingPoolAdapter) PlatformTreasury(ctx context.Context) (common.Address, error) {
	return a.caller.PlatformTreasury(callOpts(ctx))
}

// Paused reads whether betting operations are paused.
func (a *BettingPoolAdapter) Paused(ctx context.Context) (bool, error) {
	return a.caller.Paused(callOpts(ctx))
}

// DefaultAdminRole reads the OpenZeppelin default admin role id.
func (a *BettingPoolAdapter) DefaultAdminRole(ctx context.Context) ([32]byte, error) {
	return a.caller.DEFAULTADMINROLE(callOpts(ctx))
}

// UpgradeInterfaceVersion reads the UUPS interface version string.
func (a *BettingPoolAdapter) UpgradeInterfaceVersion(ctx context.Context) (string, error) {
	return a.caller.UPGRADEINTERFACEVERSION(callOpts(ctx))
}

// ProxiableUUID reads the UUPS implementation slot UUID.
func (a *BettingPoolAdapter) ProxiableUUID(ctx context.Context) ([32]byte, error) {
	return a.caller.ProxiableUUID(callOpts(ctx))
}

// SupportsInterface reads ERC165 support for interfaceID.
func (a *BettingPoolAdapter) SupportsInterface(ctx context.Context, interfaceID [4]byte) (bool, error) {
	return a.caller.SupportsInterface(callOpts(ctx), interfaceID)
}

// BetTaxBps reads the bet tax rate in basis points.
func (a *BettingPoolAdapter) BetTaxBps(ctx context.Context) (uint16, error) {
	return a.caller.BetTaxBps(callOpts(ctx))
}

// PayoutTaxBps reads the payout tax rate in basis points.
func (a *BettingPoolAdapter) PayoutTaxBps(ctx context.Context) (uint16, error) {
	return a.caller.PayoutTaxBps(callOpts(ctx))
}

// TaxAllocStakingBps reads the staking share of payout tax.
func (a *BettingPoolAdapter) TaxAllocStakingBps(ctx context.Context) (uint16, error) {
	return a.caller.TaxAllocStakingBps(callOpts(ctx))
}

// TaxAllocTaxBufferBps reads the tax-buffer share of payout tax.
func (a *BettingPoolAdapter) TaxAllocTaxBufferBps(ctx context.Context) (uint16, error) {
	return a.caller.TaxAllocTaxBufferBps(callOpts(ctx))
}

// TaxAllocPlatformBps reads the platform share of payout tax.
func (a *BettingPoolAdapter) TaxAllocPlatformBps(ctx context.Context) (uint16, error) {
	return a.caller.TaxAllocPlatformBps(callOpts(ctx))
}

// TaxAllocReferrerBps reads the referrer share of payout tax.
func (a *BettingPoolAdapter) TaxAllocReferrerBps(ctx context.Context) (uint16, error) {
	return a.caller.TaxAllocReferrerBps(callOpts(ctx))
}

// TaxBuffer reads the current L3 tax buffer.
func (a *BettingPoolAdapter) TaxBuffer(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.TaxBuffer(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// LpLossOffsetRemaining reads the outstanding LP loss offset metric.
func (a *BettingPoolAdapter) LpLossOffsetRemaining(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.LpLossOffsetRemaining(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// LpMarginShareBps reads the LP margin share in basis points.
func (a *BettingPoolAdapter) LpMarginShareBps(ctx context.Context) (uint16, error) {
	return a.caller.LpMarginShareBps(callOpts(ctx))
}

// WclYellowThreshold reads the yellow WCL threshold.
func (a *BettingPoolAdapter) WclYellowThreshold(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.WclYellowThreshold(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// WclOrangeThreshold reads the orange WCL threshold.
func (a *BettingPoolAdapter) WclOrangeThreshold(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.WclOrangeThreshold(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// WclRedThreshold reads the red WCL threshold.
func (a *BettingPoolAdapter) WclRedThreshold(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.WclRedThreshold(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// NextBetNonce reads the next bet nonce.
func (a *BettingPoolAdapter) NextBetNonce(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.NextBetNonce(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// Referrers reads a user's bound referrer.
func (a *BettingPoolAdapter) Referrers(ctx context.Context, user common.Address) (common.Address, error) {
	return a.caller.Referrers(callOpts(ctx), user)
}

// ReferrerRewardsOdd reads accrued ODD referral rewards.
func (a *BettingPoolAdapter) ReferrerRewardsOdd(ctx context.Context, referrer common.Address) (*big.Int, error) {
	value, err := a.caller.ReferrerRewardsOdd(callOpts(ctx), referrer)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// ReferralClaimSigner reads the signer for USDT referral reward claims.
func (a *BettingPoolAdapter) ReferralClaimSigner(ctx context.Context) (common.Address, error) {
	return a.caller.ReferralClaimSigner(callOpts(ctx))
}

// ReferralSwapPoolFee reads the configured Pancake V3 pool fee.
func (a *BettingPoolAdapter) ReferralSwapPoolFee(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.ReferralSwapPoolFee(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// ReferralSwapRouter reads the configured referral swap router.
func (a *BettingPoolAdapter) ReferralSwapRouter(ctx context.Context) (common.Address, error) {
	return a.caller.ReferralSwapRouter(callOpts(ctx))
}

// ReferralUsdtToken reads the configured referral USDT token.
func (a *BettingPoolAdapter) ReferralUsdtToken(ctx context.Context) (common.Address, error) {
	return a.caller.ReferralUsdtToken(callOpts(ctx))
}

// ReferralClaimNonces reads a user's referral claim nonce.
func (a *BettingPoolAdapter) ReferralClaimNonces(ctx context.Context, user common.Address) (*big.Int, error) {
	value, err := a.caller.ReferralClaimNonces(callOpts(ctx), user)
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// SettlementModule reads the configured settlement module implementation.
func (a *BettingPoolAdapter) SettlementModule(ctx context.Context) (common.Address, error) {
	return a.caller.SettlementModule(callOpts(ctx))
}

// BetModule reads the configured bet module implementation.
func (a *BettingPoolAdapter) BetModule(ctx context.Context) (common.Address, error) {
	return a.caller.BetModule(callOpts(ctx))
}

// MarketModule reads the configured market module implementation.
func (a *BettingPoolAdapter) MarketModule(ctx context.Context) (common.Address, error) {
	return a.caller.MarketModule(callOpts(ctx))
}

// ReferralModule reads the configured referral module implementation.
func (a *BettingPoolAdapter) ReferralModule(ctx context.Context) (common.Address, error) {
	return a.caller.ReferralModule(callOpts(ctx))
}

// PlatformReserve reads platform reserve amount.
func (a *BettingPoolAdapter) PlatformReserve(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.PlatformReserve(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// AccountedBalance reads accounted betting pool balance.
func (a *BettingPoolAdapter) AccountedBalance(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.AccountedBalance(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return new(big.Int).Set(value), nil
}

// AddPlatformReserve submits a platform reserve top-up transaction.
func (a *BettingPoolAdapter) AddPlatformReserve(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.AddPlatformReserve(opts, amount)
	if err != nil {
		return nil, fmt.Errorf("betting pool add platform reserve: %w", err)
	}
	return tx, nil
}

// BindReferrer binds the caller to a referrer.
func (a *BettingPoolAdapter) BindReferrer(opts *bind.TransactOpts, referrer common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.BindReferrer(opts, referrer)
	if err != nil {
		return nil, fmt.Errorf("betting pool bind referrer: %w", err)
	}
	return tx, nil
}

// ClaimReferralRewards claims accrued ODD referral rewards.
func (a *BettingPoolAdapter) ClaimReferralRewards(opts *bind.TransactOpts, oddAmount *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ClaimReferralRewards(opts, oddAmount)
	if err != nil {
		return nil, fmt.Errorf("betting pool claim referral rewards: %w", err)
	}
	return tx, nil
}

// ClaimUSDTReferralRewards swaps and claims referral rewards to USDT.
func (a *BettingPoolAdapter) ClaimUSDTReferralRewards(opts *bind.TransactOpts, rewardMinUsdtOutAmount *big.Int, signatureDeadline *big.Int, signature []byte, minUsdtOut *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ClaimUSDTReferralRewards(opts, rewardMinUsdtOutAmount, signatureDeadline, signature, minUsdtOut)
	if err != nil {
		return nil, fmt.Errorf("betting pool claim usdt referral rewards: %w", err)
	}
	return tx, nil
}

// GrantRole grants a role to an account.
func (a *BettingPoolAdapter) GrantRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.GrantRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("betting pool grant role: %w", err)
	}
	return tx, nil
}

// RevokeRole revokes a role from an account.
func (a *BettingPoolAdapter) RevokeRole(opts *bind.TransactOpts, role [32]byte, account common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RevokeRole(opts, role, account)
	if err != nil {
		return nil, fmt.Errorf("betting pool revoke role: %w", err)
	}
	return tx, nil
}

// RenounceRole renounces a role held by the caller.
func (a *BettingPoolAdapter) RenounceRole(opts *bind.TransactOpts, role [32]byte, callerConfirmation common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RenounceRole(opts, role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("betting pool renounce role: %w", err)
	}
	return tx, nil
}

// Pause pauses BettingPool guarded methods.
func (a *BettingPoolAdapter) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Pause(opts)
	if err != nil {
		return nil, fmt.Errorf("betting pool pause: %w", err)
	}
	return tx, nil
}

// Unpause unpauses BettingPool guarded methods.
func (a *BettingPoolAdapter) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.Unpause(opts)
	if err != nil {
		return nil, fmt.Errorf("betting pool unpause: %w", err)
	}
	return tx, nil
}

// UpgradeToAndCall upgrades the BettingPool proxy and optionally calls initialization data.
func (a *BettingPoolAdapter) UpgradeToAndCall(opts *bind.TransactOpts, newImplementation common.Address, data []byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.UpgradeToAndCall(opts, newImplementation, data)
	if err != nil {
		return nil, fmt.Errorf("betting pool upgrade to and call: %w", err)
	}
	return tx, nil
}

// SetBettingDependencies sets BettingPool dependency addresses for bootstrap or migration.
func (a *BettingPoolAdapter) SetBettingDependencies(opts *bind.TransactOpts, stakingPoolAddress common.Address, liquidityPoolAddress common.Address, oddTokenAddress common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetBettingDependencies(opts, stakingPoolAddress, liquidityPoolAddress, oddTokenAddress)
	if err != nil {
		return nil, fmt.Errorf("betting pool set betting dependencies: %w", err)
	}
	return tx, nil
}

// SetTaxConfig updates bet tax, payout tax, and payout tax allocations.
func (a *BettingPoolAdapter) SetTaxConfig(opts *bind.TransactOpts, newBetTaxBps uint16, newPayoutTaxBps uint16, newAllocStakingBps uint16, newAllocTaxBufferBps uint16, newAllocPlatformBps uint16, newAllocReferrerBps uint16) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetTaxConfig(opts, newBetTaxBps, newPayoutTaxBps, newAllocStakingBps, newAllocTaxBufferBps, newAllocPlatformBps, newAllocReferrerBps)
	if err != nil {
		return nil, fmt.Errorf("betting pool set tax config: %w", err)
	}
	return tx, nil
}

// SetPlatformTreasury updates the platform treasury address.
func (a *BettingPoolAdapter) SetPlatformTreasury(opts *bind.TransactOpts, treasuryAddress common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetPlatformTreasury(opts, treasuryAddress)
	if err != nil {
		return nil, fmt.Errorf("betting pool set platform treasury: %w", err)
	}
	return tx, nil
}

// SetRiskConfig updates WCL thresholds.
func (a *BettingPoolAdapter) SetRiskConfig(opts *bind.TransactOpts, yellowThreshold *big.Int, orangeThreshold *big.Int, redThreshold *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetRiskConfig(opts, yellowThreshold, orangeThreshold, redThreshold)
	if err != nil {
		return nil, fmt.Errorf("betting pool set risk config: %w", err)
	}
	return tx, nil
}

// SetMarginSplit updates the LP margin share.
func (a *BettingPoolAdapter) SetMarginSplit(opts *bind.TransactOpts, newLpMarginShareBps uint16) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetMarginSplit(opts, newLpMarginShareBps)
	if err != nil {
		return nil, fmt.Errorf("betting pool set margin split: %w", err)
	}
	return tx, nil
}

// SetReferralClaimConfig updates referral claim signer and pool fee.
func (a *BettingPoolAdapter) SetReferralClaimConfig(opts *bind.TransactOpts, signer common.Address, poolFee *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetReferralClaimConfig(opts, signer, poolFee)
	if err != nil {
		return nil, fmt.Errorf("betting pool set referral claim config: %w", err)
	}
	return tx, nil
}

// SetReferralSwapConfig updates referral swap router and USDT token.
func (a *BettingPoolAdapter) SetReferralSwapConfig(opts *bind.TransactOpts, swapRouter common.Address, usdtToken common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	raw := &bettingpool.BettingPoolTransactorRaw{Contract: a.transactor}
	tx, err := raw.Transact(opts, "setReferralSwapConfig0", swapRouter, usdtToken)
	if err != nil {
		return nil, fmt.Errorf("betting pool set referral swap config: %w", err)
	}
	return tx, nil
}

// SetReferralSwapConfigWithExpectedPool updates referral swap router, USDT token, and expected pool.
func (a *BettingPoolAdapter) SetReferralSwapConfigWithExpectedPool(opts *bind.TransactOpts, swapRouter common.Address, usdtToken common.Address, expectedPool common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetReferralSwapConfig(opts, swapRouter, usdtToken, expectedPool)
	if err != nil {
		return nil, fmt.Errorf("betting pool set referral swap config with expected pool: %w", err)
	}
	return tx, nil
}

// SetSettlementModule updates the delegatecall settlement module.
func (a *BettingPoolAdapter) SetSettlementModule(opts *bind.TransactOpts, newSettlementModule common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetSettlementModule(opts, newSettlementModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set settlement module: %w", err)
	}
	return tx, nil
}

// SetParlayModule updates the delegatecall parlay module.
func (a *BettingPoolAdapter) SetParlayModule(opts *bind.TransactOpts, newParlayModule common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetParlayModule(opts, newParlayModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set parlay module: %w", err)
	}
	return tx, nil
}

// SetBetModule updates the delegatecall bet module.
func (a *BettingPoolAdapter) SetBetModule(opts *bind.TransactOpts, newBetModule common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetBetModule(opts, newBetModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set bet module: %w", err)
	}
	return tx, nil
}

// SetMarketModule updates the delegatecall market module.
func (a *BettingPoolAdapter) SetMarketModule(opts *bind.TransactOpts, newMarketModule common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetMarketModule(opts, newMarketModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set market module: %w", err)
	}
	return tx, nil
}

// SetReferralModule updates the delegatecall referral module.
func (a *BettingPoolAdapter) SetReferralModule(opts *bind.TransactOpts, newReferralModule common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SetReferralModule(opts, newReferralModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set referral module: %w", err)
	}
	return tx, nil
}

// OpenMarket opens a new betting market.
func (a *BettingPoolAdapter) OpenMarket(opts *bind.TransactOpts, matchID [32]byte, marketType uint8, line uint8, matchStartTime uint64, matchEndTime uint64, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.OpenMarket(opts, matchID, marketType, line, matchStartTime, matchEndTime, baseOdds, updatedAt)
	if err != nil {
		return nil, fmt.Errorf("betting pool open market: %w", err)
	}
	return tx, nil
}

// UpdateOdds updates base odds for an open betting market.
func (a *BettingPoolAdapter) UpdateOdds(opts *bind.TransactOpts, marketID [32]byte, baseOdds []*big.Int, updatedAt uint64) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.UpdateOdds(opts, marketID, baseOdds, updatedAt)
	if err != nil {
		return nil, fmt.Errorf("betting pool update odds: %w", err)
	}
	return tx, nil
}

// LockMarket manually locks an open betting market.
func (a *BettingPoolAdapter) LockMarket(opts *bind.TransactOpts, marketID [32]byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.LockMarket(opts, marketID)
	if err != nil {
		return nil, fmt.Errorf("betting pool lock market: %w", err)
	}
	return tx, nil
}

// CashOut exits a pending bet before settlement using caller-provided quote protection.
func (a *BettingPoolAdapter) CashOut(opts *bind.TransactOpts, betID [32]byte, expectedQuoteVersion *big.Int, quotedAt uint64, minAmountOut *big.Int, deadline *big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.CashOut(opts, betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)
	if err != nil {
		return nil, fmt.Errorf("betting pool cash out: %w", err)
	}
	return tx, nil
}

// PlaceParlay submits a parlay bet transaction.
func (a *BettingPoolAdapter) PlaceParlay(opts *bind.TransactOpts, legs []BettingPoolParlayLegInput, stake *big.Int, minComboOdds *big.Int, deadline *big.Int, referrer common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.PlaceParlay(opts, toBettingPoolBindingParlayLegs(legs), stake, minComboOdds, deadline, referrer)
	if err != nil {
		return nil, fmt.Errorf("betting pool place parlay: %w", err)
	}
	return tx, nil
}

// PlaceBet submits a bet transaction.
func (a *BettingPoolAdapter) PlaceBet(opts *bind.TransactOpts, marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard BettingPoolQuoteGuardInput) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.PlaceBet(opts, marketID, outcome, requestedAmount, toBettingPoolBindingGuard(guard))
	if err != nil {
		return nil, fmt.Errorf("betting pool place bet: %w", err)
	}
	return tx, nil
}

// PlaceBetWithReferrer submits a bet transaction and optionally binds a referrer.
func (a *BettingPoolAdapter) PlaceBetWithReferrer(opts *bind.TransactOpts, marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard BettingPoolQuoteGuardInput, referrer common.Address) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.PlaceBet0(opts, marketID, outcome, requestedAmount, toBettingPoolBindingGuard(guard), referrer)
	if err != nil {
		return nil, fmt.Errorf("betting pool place bet with referrer: %w", err)
	}
	return tx, nil
}

// SettleMarketBetsByScore settles a batch of bets by final score.
func (a *BettingPoolAdapter) SettleMarketBetsByScore(opts *bind.TransactOpts, marketID [32]byte, homeScore uint16, awayScore uint16, betIDs [][32]byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SettleMarketBetsByScore(opts, marketID, homeScore, awayScore, betIDs)
	if err != nil {
		return nil, fmt.Errorf("betting pool settle market bets by score: %w", err)
	}
	return tx, nil
}

// FinalizeMarketSettlement finalizes a market settlement terminal state.
func (a *BettingPoolAdapter) FinalizeMarketSettlement(opts *bind.TransactOpts, marketID [32]byte, resultKindRaw uint8) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.FinalizeMarketSettlement(opts, marketID, resultKindRaw)
	if err != nil {
		return nil, fmt.Errorf("betting pool finalize market settlement: %w", err)
	}
	return tx, nil
}

// RefundBets refunds specific bet ids with explicit refund amounts.
func (a *BettingPoolAdapter) RefundBets(opts *bind.TransactOpts, marketID [32]byte, betIDs [][32]byte, refundAmounts []*big.Int) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.RefundBets(opts, marketID, betIDs, refundAmounts)
	if err != nil {
		return nil, fmt.Errorf("betting pool refund bets: %w", err)
	}
	return tx, nil
}

// ClaimPayout claims a winning bet's payout.
func (a *BettingPoolAdapter) ClaimPayout(opts *bind.TransactOpts, betID [32]byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ClaimPayout(opts, betID)
	if err != nil {
		return nil, fmt.Errorf("betting pool claim payout: %w", err)
	}
	return tx, nil
}

// SettleParlay settles a parlay after its legs have terminal market results.
func (a *BettingPoolAdapter) SettleParlay(opts *bind.TransactOpts, parlayID [32]byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.SettleParlay(opts, parlayID)
	if err != nil {
		return nil, fmt.Errorf("betting pool settle parlay: %w", err)
	}
	return tx, nil
}

// ClaimParlayPayout claims a winning parlay's payout.
func (a *BettingPoolAdapter) ClaimParlayPayout(opts *bind.TransactOpts, parlayID [32]byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ClaimParlayPayout(opts, parlayID)
	if err != nil {
		return nil, fmt.Errorf("betting pool claim parlay payout: %w", err)
	}
	return tx, nil
}

// ReleasePayoutReserve releases a risk payout reserve.
func (a *BettingPoolAdapter) ReleasePayoutReserve(opts *bind.TransactOpts, riskID [32]byte) (*types.Transaction, error) {
	if a.transactor == nil {
		return nil, chain.ErrMissingRPCClient
	}
	tx, err := a.transactor.ReleasePayoutReserve(opts, riskID)
	if err != nil {
		return nil, fmt.Errorf("betting pool release payout reserve: %w", err)
	}
	return tx, nil
}

// GetMarket reads market configuration.
func (a *BettingPoolAdapter) GetMarket(ctx context.Context, marketID [32]byte) (bettingpool.BettingPoolStorageMarketConfig, error) {
	return a.caller.GetMarket(callOpts(ctx), marketID)
}

// GetMarketOdds reads market odds.
func (a *BettingPoolAdapter) GetMarketOdds(ctx context.Context, marketID [32]byte) ([]*big.Int, []*big.Int, uint64, *big.Int, error) {
	baseOdds, quotedOdds, updatedAt, quoteVersion, err := a.caller.GetMarketOdds(callOpts(ctx), marketID)
	if err != nil {
		return nil, nil, 0, nil, err
	}
	return baseOdds, quotedOdds, updatedAt, quoteVersion, nil
}

// GetMarketBetIds reads paginated bet ids for a market.
func (a *BettingPoolAdapter) GetMarketBetIds(ctx context.Context, marketID [32]byte, offset *big.Int, limit *big.Int) ([][32]byte, error) {
	return a.caller.GetMarketBetIds(callOpts(ctx), marketID, offset, limit)
}

// GetMatchMarketIds reads all market ids for a match.
func (a *BettingPoolAdapter) GetMatchMarketIds(ctx context.Context, matchID [32]byte) ([][32]byte, error) {
	return a.caller.GetMatchMarketIds(callOpts(ctx), matchID)
}

// GetMarketExposure reads per-outcome market stake and payout exposure.
func (a *BettingPoolAdapter) GetMarketExposure(ctx context.Context, marketID [32]byte) ([]*big.Int, []*big.Int, uint8, error) {
	value, err := a.caller.GetMarketExposure(callOpts(ctx), marketID)
	if err != nil {
		return nil, nil, 0, err
	}
	totalStakedByOutcome := cloneBigIntSlice(value.TotalStakedByOutcome)
	payoutByOutcome := cloneBigIntSlice(value.PayoutByOutcome)
	return totalStakedByOutcome, payoutByOutcome, value.SignalColor, nil
}

// GetBet reads bet details.
func (a *BettingPoolAdapter) GetBet(ctx context.Context, betID [32]byte) (bettingpool.BettingPoolStorageBet, error) {
	return a.caller.GetBet(callOpts(ctx), betID)
}

// GetClaimStatus reads whether a bet is won and the claimable reward.
func (a *BettingPoolAdapter) GetClaimStatus(ctx context.Context, user common.Address, betID [32]byte) (BettingPoolClaimStatus, error) {
	value, err := a.caller.GetClaimStatus(callOpts(ctx), user, betID)
	if err != nil {
		return BettingPoolClaimStatus{}, err
	}
	return BettingPoolClaimStatus{
		Won:    value.Won,
		Reward: cloneBigInt(value.Reward),
	}, nil
}

// EstimateBetValue reads the display-only value estimate for a pending bet.
func (a *BettingPoolAdapter) EstimateBetValue(ctx context.Context, user common.Address, betID [32]byte) (BettingPoolBetEstimatedValue, error) {
	value, err := a.caller.EstimateBetValue(callOpts(ctx), user, betID)
	if err != nil {
		return BettingPoolBetEstimatedValue{}, err
	}
	return BettingPoolBetEstimatedValue{
		EstimatedValue: cloneBigInt(value.EstimatedValue),
		FloatingPnL:    cloneBigInt(value.FloatingPnL),
	}, nil
}

// GetUserRiskLedger reads the user's daily and unsettled stake risk ledger.
func (a *BettingPoolAdapter) GetUserRiskLedger(ctx context.Context, user common.Address) (BettingPoolUserRiskLedger, error) {
	value, err := a.caller.GetUserRiskLedger(callOpts(ctx), user)
	if err != nil {
		return BettingPoolUserRiskLedger{}, err
	}
	return BettingPoolUserRiskLedger{
		DayBucket:           value.DayBucket,
		DailyAcceptedAmount: cloneBigInt(value.DailyAcceptedAmount),
		UnsettledStake:      cloneBigInt(value.UnsettledStake),
	}, nil
}

// ParlayModule reads the configured parlay module address.
func (a *BettingPoolAdapter) ParlayModule(ctx context.Context) (common.Address, error) {
	return a.caller.ParlayModule(callOpts(ctx))
}

// NextParlayNonce reads the next parlay nonce.
func (a *BettingPoolAdapter) NextParlayNonce(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.NextParlayNonce(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// OpenParlayMaxPayout reads the current aggregate open parlay max payout.
func (a *BettingPoolAdapter) OpenParlayMaxPayout(ctx context.Context) (*big.Int, error) {
	value, err := a.caller.OpenParlayMaxPayout(callOpts(ctx))
	if err != nil {
		return nil, err
	}
	return cloneBigInt(value), nil
}

// MarketFinalResults reads the stored terminal result for a market.
func (a *BettingPoolAdapter) MarketFinalResults(ctx context.Context, marketID [32]byte) (BettingPoolMarketFinalResult, error) {
	value, err := a.caller.MarketFinalResults(callOpts(ctx), marketID)
	if err != nil {
		return BettingPoolMarketFinalResult{}, err
	}
	return BettingPoolMarketFinalResult{
		Finalized:    value.Finalized,
		ResultKind:   value.ResultKind,
		ScoreSettled: value.ScoreSettled,
		HomeScore:    value.HomeScore,
		AwayScore:    value.AwayScore,
	}, nil
}

// GetParlay reads parlay details.
func (a *BettingPoolAdapter) GetParlay(ctx context.Context, parlayID [32]byte) (BettingPoolParlayInfo, error) {
	value, err := a.caller.Parlays(callOpts(ctx), parlayID)
	if err != nil {
		return BettingPoolParlayInfo{}, err
	}
	return BettingPoolParlayInfo{
		Owner:                value.Owner,
		Stake:                cloneBigInt(value.Stake),
		LockedComboOdds:      cloneBigInt(value.LockedComboOdds),
		MaxPayout:            cloneBigInt(value.MaxPayout),
		ClaimablePayout:      cloneBigInt(value.ClaimablePayout),
		ParlayRiskID:         value.ParlayRiskId,
		AcceptedDayBucket:    value.AcceptedDayBucket,
		LegCount:             value.LegCount,
		State:                value.State,
		PayoutTaxRateBps:     value.PayoutTaxRateBps,
		TaxAllocStakingBps:   value.TaxAllocStakingBps,
		TaxAllocTaxBufferBps: value.TaxAllocTaxBufferBps,
		TaxAllocReferrerBps:  value.TaxAllocReferrerBps,
		ReferrerSnapshot:     value.ReferrerSnapshot,
	}, nil
}

// GetParlayLeg reads one parlay leg by index.
func (a *BettingPoolAdapter) GetParlayLeg(ctx context.Context, parlayID [32]byte, legIndex *big.Int) (BettingPoolParlayLegInfo, error) {
	value, err := a.caller.ParlayLegs(callOpts(ctx), parlayID, legIndex)
	if err != nil {
		return BettingPoolParlayLegInfo{}, err
	}
	return BettingPoolParlayLegInfo{
		MarketID:        value.MarketId,
		MatchID:         value.MatchId,
		MarketType:      value.MarketType,
		Line:            value.Line,
		Outcome:         value.Outcome,
		LockedOdds:      cloneBigInt(value.LockedOdds),
		SyntheticPayout: cloneBigInt(value.SyntheticPayout),
		Result:          value.Result,
	}, nil
}

// GetParlayClaimStatus reads whether a parlay is won and the claimable reward.
func (a *BettingPoolAdapter) GetParlayClaimStatus(ctx context.Context, user common.Address, parlayID [32]byte) (BettingPoolClaimStatus, error) {
	value, err := a.caller.GetParlayClaimStatus(callOpts(ctx), user, parlayID)
	if err != nil {
		return BettingPoolClaimStatus{}, err
	}
	return BettingPoolClaimStatus{
		Won:    value.Won,
		Reward: cloneBigInt(value.Reward),
	}, nil
}

// EstimateParlayValue reads the display-only value estimate for a pending parlay.
func (a *BettingPoolAdapter) EstimateParlayValue(ctx context.Context, user common.Address, parlayID [32]byte) (BettingPoolParlayEstimatedValue, error) {
	value, err := a.caller.EstimateParlayValue(callOpts(ctx), user, parlayID)
	if err != nil {
		return BettingPoolParlayEstimatedValue{}, err
	}
	return BettingPoolParlayEstimatedValue{
		State:              value.State,
		Stake:              cloneBigInt(value.Stake),
		LockedComboOdds:    cloneBigInt(value.LockedComboOdds),
		MaxPayout:          cloneBigInt(value.MaxPayout),
		EstimatedValue:     cloneBigInt(value.EstimatedValue),
		FloatingPnL:        cloneBigInt(value.FloatingPnL),
		FactorProduct:      cloneBigInt(value.FactorProduct),
		FinalizedLegCount:  value.FinalizedLegCount,
		UnresolvedLegCount: value.UnresolvedLegCount,
		HasFullLoss:        value.HasFullLoss,
		IsFinal:            value.IsFinal,
	}, nil
}

// PreviewSignal previews a bet's signal and accepted amount.
func (a *BettingPoolAdapter) PreviewSignal(ctx context.Context, marketID [32]byte, outcome uint8, requestedAmount *big.Int) (uint8, *big.Int, *big.Int, bool, *big.Int, error) {
	result, err := a.caller.PreviewSignal(callOpts(ctx), marketID, outcome, requestedAmount)
	if err != nil {
		return 0, nil, nil, false, nil, err
	}
	return result.Signal, result.AcceptedAmount, result.LockedOdds, result.PartialFill, result.MaxAcceptableAmount, nil
}

// IsMatchTerminal checks if all markets for a match are in terminal state.
func (a *BettingPoolAdapter) IsMatchTerminal(ctx context.Context, matchID [32]byte) (bool, error) {
	return a.caller.IsMatchTerminal(callOpts(ctx), matchID)
}

// HasRole checks if an account has a given role.
func (a *BettingPoolAdapter) HasRole(ctx context.Context, role [32]byte, account common.Address) (bool, error) {
	return a.caller.HasRole(callOpts(ctx), role, account)
}

// GetRoleAdmin reads the admin role for role on BettingPool.
func (a *BettingPoolAdapter) GetRoleAdmin(ctx context.Context, role [32]byte) ([32]byte, error) {
	return a.caller.GetRoleAdmin(callOpts(ctx), role)
}

var bettingPoolABI = mustLoadBettingPoolABI()

func mustLoadBettingPoolABI() abi.ABI {
	parsed, err := bettingpool.BettingPoolMetaData.GetAbi()
	if err != nil {
		panic("bind betting pool abi: " + err.Error())
	}
	if parsed == nil {
		panic("bind betting pool abi: nil abi")
	}
	return *parsed
}

// AddPlatformReserveCalldata returns ABI-encoded calldata for BettingPool.addPlatformReserve(uint256).
func (a *BettingPoolAdapter) AddPlatformReserveCalldata(amount *big.Int) ([]byte, error) {
	data, err := bettingPoolABI.Pack("addPlatformReserve", amount)
	if err != nil {
		return nil, fmt.Errorf("betting pool add platform reserve abi pack: %w", err)
	}
	return data, nil
}

// GrantRoleCalldata returns ABI-encoded calldata for BettingPool.grantRole(bytes32,address).
func (a *BettingPoolAdapter) GrantRoleCalldata(role [32]byte, account common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("grantRole", role, account)
	if err != nil {
		return nil, fmt.Errorf("betting pool grant role abi pack: %w", err)
	}
	return data, nil
}

// RevokeRoleCalldata returns ABI-encoded calldata for BettingPool.revokeRole(bytes32,address).
func (a *BettingPoolAdapter) RevokeRoleCalldata(role [32]byte, account common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("revokeRole", role, account)
	if err != nil {
		return nil, fmt.Errorf("betting pool revoke role abi pack: %w", err)
	}
	return data, nil
}

// RenounceRoleCalldata returns ABI-encoded calldata for BettingPool.renounceRole(bytes32,address).
func (a *BettingPoolAdapter) RenounceRoleCalldata(role [32]byte, callerConfirmation common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("renounceRole", role, callerConfirmation)
	if err != nil {
		return nil, fmt.Errorf("betting pool renounce role abi pack: %w", err)
	}
	return data, nil
}

// PauseCalldata returns ABI-encoded calldata for BettingPool.pause().
func (a *BettingPoolAdapter) PauseCalldata() ([]byte, error) {
	data, err := bettingPoolABI.Pack("pause")
	if err != nil {
		return nil, fmt.Errorf("betting pool pause abi pack: %w", err)
	}
	return data, nil
}

// UnpauseCalldata returns ABI-encoded calldata for BettingPool.unpause().
func (a *BettingPoolAdapter) UnpauseCalldata() ([]byte, error) {
	data, err := bettingPoolABI.Pack("unpause")
	if err != nil {
		return nil, fmt.Errorf("betting pool unpause abi pack: %w", err)
	}
	return data, nil
}

// UpgradeToAndCallCalldata returns ABI-encoded calldata for BettingPool.upgradeToAndCall(address,bytes).
func (a *BettingPoolAdapter) UpgradeToAndCallCalldata(newImplementation common.Address, callData []byte) ([]byte, error) {
	data, err := bettingPoolABI.Pack("upgradeToAndCall", newImplementation, callData)
	if err != nil {
		return nil, fmt.Errorf("betting pool upgrade to and call abi pack: %w", err)
	}
	return data, nil
}

// BindReferrerCalldata returns ABI-encoded calldata for BettingPool.bindReferrer(address).
func (a *BettingPoolAdapter) BindReferrerCalldata(referrer common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("bindReferrer", referrer)
	if err != nil {
		return nil, fmt.Errorf("betting pool bind referrer abi pack: %w", err)
	}
	return data, nil
}

// ClaimReferralRewardsCalldata returns ABI-encoded calldata for BettingPool.claimReferralRewards(uint256).
func (a *BettingPoolAdapter) ClaimReferralRewardsCalldata(oddAmount *big.Int) ([]byte, error) {
	data, err := bettingPoolABI.Pack("claimReferralRewards", oddAmount)
	if err != nil {
		return nil, fmt.Errorf("betting pool claim referral rewards abi pack: %w", err)
	}
	return data, nil
}

// ClaimUSDTReferralRewardsCalldata returns ABI-encoded calldata for BettingPool.claimUSDTReferralRewards(uint256,uint256,bytes,uint256).
func (a *BettingPoolAdapter) ClaimUSDTReferralRewardsCalldata(rewardMinUsdtOutAmount *big.Int, signatureDeadline *big.Int, signature []byte, minUsdtOut *big.Int) ([]byte, error) {
	data, err := bettingPoolABI.Pack("claimUSDTReferralRewards", rewardMinUsdtOutAmount, signatureDeadline, signature, minUsdtOut)
	if err != nil {
		return nil, fmt.Errorf("betting pool claim usdt referral rewards abi pack: %w", err)
	}
	return data, nil
}

// SetBettingDependenciesCalldata returns ABI-encoded calldata for BettingPool.setBettingDependencies(address,address,address).
func (a *BettingPoolAdapter) SetBettingDependenciesCalldata(stakingPoolAddress common.Address, liquidityPoolAddress common.Address, oddTokenAddress common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setBettingDependencies", stakingPoolAddress, liquidityPoolAddress, oddTokenAddress)
	if err != nil {
		return nil, fmt.Errorf("betting pool set betting dependencies abi pack: %w", err)
	}
	return data, nil
}

// SetTaxConfigCalldata returns ABI-encoded calldata for BettingPool.setTaxConfig.
func (a *BettingPoolAdapter) SetTaxConfigCalldata(newBetTaxBps uint16, newPayoutTaxBps uint16, newAllocStakingBps uint16, newAllocTaxBufferBps uint16, newAllocPlatformBps uint16, newAllocReferrerBps uint16) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setTaxConfig", newBetTaxBps, newPayoutTaxBps, newAllocStakingBps, newAllocTaxBufferBps, newAllocPlatformBps, newAllocReferrerBps)
	if err != nil {
		return nil, fmt.Errorf("betting pool set tax config abi pack: %w", err)
	}
	return data, nil
}

// SetPlatformTreasuryCalldata returns ABI-encoded calldata for BettingPool.setPlatformTreasury(address).
func (a *BettingPoolAdapter) SetPlatformTreasuryCalldata(treasuryAddress common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setPlatformTreasury", treasuryAddress)
	if err != nil {
		return nil, fmt.Errorf("betting pool set platform treasury abi pack: %w", err)
	}
	return data, nil
}

// SetRiskConfigCalldata returns ABI-encoded calldata for BettingPool.setRiskConfig(uint256,uint256,uint256).
func (a *BettingPoolAdapter) SetRiskConfigCalldata(yellowThreshold *big.Int, orangeThreshold *big.Int, redThreshold *big.Int) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setRiskConfig", yellowThreshold, orangeThreshold, redThreshold)
	if err != nil {
		return nil, fmt.Errorf("betting pool set risk config abi pack: %w", err)
	}
	return data, nil
}

// SetMarginSplitCalldata returns ABI-encoded calldata for BettingPool.setMarginSplit(uint16).
func (a *BettingPoolAdapter) SetMarginSplitCalldata(newLpMarginShareBps uint16) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setMarginSplit", newLpMarginShareBps)
	if err != nil {
		return nil, fmt.Errorf("betting pool set margin split abi pack: %w", err)
	}
	return data, nil
}

// SetReferralClaimConfigCalldata returns ABI-encoded calldata for BettingPool.setReferralClaimConfig(address,uint24).
func (a *BettingPoolAdapter) SetReferralClaimConfigCalldata(signer common.Address, poolFee *big.Int) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setReferralClaimConfig", signer, poolFee)
	if err != nil {
		return nil, fmt.Errorf("betting pool set referral claim config abi pack: %w", err)
	}
	return data, nil
}

// SetReferralSwapConfigCalldata returns ABI-encoded calldata for BettingPool.setReferralSwapConfig(address,address).
func (a *BettingPoolAdapter) SetReferralSwapConfigCalldata(swapRouter common.Address, usdtToken common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setReferralSwapConfig0", swapRouter, usdtToken)
	if err != nil {
		return nil, fmt.Errorf("betting pool set referral swap config abi pack: %w", err)
	}
	return data, nil
}

// SetReferralSwapConfigWithExpectedPoolCalldata returns ABI-encoded calldata for BettingPool.setReferralSwapConfig(address,address,address).
func (a *BettingPoolAdapter) SetReferralSwapConfigWithExpectedPoolCalldata(swapRouter common.Address, usdtToken common.Address, expectedPool common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setReferralSwapConfig", swapRouter, usdtToken, expectedPool)
	if err != nil {
		return nil, fmt.Errorf("betting pool set referral swap config with expected pool abi pack: %w", err)
	}
	return data, nil
}

// SetSettlementModuleCalldata returns ABI-encoded calldata for BettingPool.setSettlementModule(address).
func (a *BettingPoolAdapter) SetSettlementModuleCalldata(newSettlementModule common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setSettlementModule", newSettlementModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set settlement module abi pack: %w", err)
	}
	return data, nil
}

// SetParlayModuleCalldata returns ABI-encoded calldata for BettingPool.setParlayModule(address).
func (a *BettingPoolAdapter) SetParlayModuleCalldata(newParlayModule common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setParlayModule", newParlayModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set parlay module abi pack: %w", err)
	}
	return data, nil
}

// SetBetModuleCalldata returns ABI-encoded calldata for BettingPool.setBetModule(address).
func (a *BettingPoolAdapter) SetBetModuleCalldata(newBetModule common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setBetModule", newBetModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set bet module abi pack: %w", err)
	}
	return data, nil
}

// SetMarketModuleCalldata returns ABI-encoded calldata for BettingPool.setMarketModule(address).
func (a *BettingPoolAdapter) SetMarketModuleCalldata(newMarketModule common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setMarketModule", newMarketModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set market module abi pack: %w", err)
	}
	return data, nil
}

// SetReferralModuleCalldata returns ABI-encoded calldata for BettingPool.setReferralModule(address).
func (a *BettingPoolAdapter) SetReferralModuleCalldata(newReferralModule common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("setReferralModule", newReferralModule)
	if err != nil {
		return nil, fmt.Errorf("betting pool set referral module abi pack: %w", err)
	}
	return data, nil
}

// OpenMarketCalldata returns ABI-encoded calldata for BettingPool.openMarket(bytes32,uint8,uint8,uint64,uint64,uint256[],uint64).
func (a *BettingPoolAdapter) OpenMarketCalldata(matchID [32]byte, marketType uint8, line uint8, matchStartTime uint64, matchEndTime uint64, baseOdds []*big.Int, updatedAt uint64) ([]byte, error) {
	data, err := bettingPoolABI.Pack("openMarket", matchID, marketType, line, matchStartTime, matchEndTime, baseOdds, updatedAt)
	if err != nil {
		return nil, fmt.Errorf("betting pool open market abi pack: %w", err)
	}
	return data, nil
}

// UpdateOddsCalldata returns ABI-encoded calldata for BettingPool.updateOdds(bytes32,uint256[],uint64).
func (a *BettingPoolAdapter) UpdateOddsCalldata(marketID [32]byte, baseOdds []*big.Int, updatedAt uint64) ([]byte, error) {
	data, err := bettingPoolABI.Pack("updateOdds", marketID, baseOdds, updatedAt)
	if err != nil {
		return nil, fmt.Errorf("betting pool update odds abi pack: %w", err)
	}
	return data, nil
}

// LockMarketCalldata returns ABI-encoded calldata for BettingPool.lockMarket(bytes32).
func (a *BettingPoolAdapter) LockMarketCalldata(marketID [32]byte) ([]byte, error) {
	data, err := bettingPoolABI.Pack("lockMarket", marketID)
	if err != nil {
		return nil, fmt.Errorf("betting pool lock market abi pack: %w", err)
	}
	return data, nil
}

// CashOutCalldata returns ABI-encoded calldata for BettingPool.cashOut(bytes32,uint256,uint64,uint256,uint256).
func (a *BettingPoolAdapter) CashOutCalldata(betID [32]byte, expectedQuoteVersion *big.Int, quotedAt uint64, minAmountOut *big.Int, deadline *big.Int) ([]byte, error) {
	data, err := bettingPoolABI.Pack("cashOut", betID, expectedQuoteVersion, quotedAt, minAmountOut, deadline)
	if err != nil {
		return nil, fmt.Errorf("betting pool cash out abi pack: %w", err)
	}
	return data, nil
}

// PlaceParlayCalldata returns ABI-encoded calldata for BettingPool.placeParlay((bytes32,uint8,uint256,uint64,uint256)[],uint256,uint256,uint256,address).
func (a *BettingPoolAdapter) PlaceParlayCalldata(legs []BettingPoolParlayLegInput, stake *big.Int, minComboOdds *big.Int, deadline *big.Int, referrer common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("placeParlay", toBettingPoolBindingParlayLegs(legs), stake, minComboOdds, deadline, referrer)
	if err != nil {
		return nil, fmt.Errorf("betting pool place parlay abi pack: %w", err)
	}
	return data, nil
}

// PlaceBetCalldata returns ABI-encoded calldata for BettingPool.placeBet(bytes32,uint8,uint256,(uint256,uint64,uint256,uint256,uint256)).
func (a *BettingPoolAdapter) PlaceBetCalldata(marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard BettingPoolQuoteGuardInput) ([]byte, error) {
	data, err := bettingPoolABI.Pack("placeBet", marketID, outcome, requestedAmount, toBettingPoolBindingGuard(guard))
	if err != nil {
		return nil, fmt.Errorf("betting pool place bet abi pack: %w", err)
	}
	return data, nil
}

// PlaceBetWithReferrerCalldata returns ABI-encoded calldata for the referrer overload of BettingPool.placeBet.
func (a *BettingPoolAdapter) PlaceBetWithReferrerCalldata(marketID [32]byte, outcome uint8, requestedAmount *big.Int, guard BettingPoolQuoteGuardInput, referrer common.Address) ([]byte, error) {
	data, err := bettingPoolABI.Pack("placeBet0", marketID, outcome, requestedAmount, toBettingPoolBindingGuard(guard), referrer)
	if err != nil {
		return nil, fmt.Errorf("betting pool place bet with referrer abi pack: %w", err)
	}
	return data, nil
}

// SettleMarketBetsByScoreCalldata returns ABI-encoded calldata for BettingPool.settleMarketBetsByScore(bytes32,uint16,uint16,bytes32[]).
func (a *BettingPoolAdapter) SettleMarketBetsByScoreCalldata(marketID [32]byte, homeScore uint16, awayScore uint16, betIDs [][32]byte) ([]byte, error) {
	data, err := bettingPoolABI.Pack("settleMarketBetsByScore", marketID, homeScore, awayScore, betIDs)
	if err != nil {
		return nil, fmt.Errorf("betting pool settle market bets by score abi pack: %w", err)
	}
	return data, nil
}

// FinalizeMarketSettlementCalldata returns ABI-encoded calldata for BettingPool.finalizeMarketSettlement(bytes32,uint8).
func (a *BettingPoolAdapter) FinalizeMarketSettlementCalldata(marketID [32]byte, resultKindRaw uint8) ([]byte, error) {
	data, err := bettingPoolABI.Pack("finalizeMarketSettlement", marketID, resultKindRaw)
	if err != nil {
		return nil, fmt.Errorf("betting pool finalize market settlement abi pack: %w", err)
	}
	return data, nil
}

// RefundBetsCalldata returns ABI-encoded calldata for BettingPool.refundBets(bytes32,bytes32[],uint256[]).
func (a *BettingPoolAdapter) RefundBetsCalldata(marketID [32]byte, betIDs [][32]byte, refundAmounts []*big.Int) ([]byte, error) {
	data, err := bettingPoolABI.Pack("refundBets", marketID, betIDs, refundAmounts)
	if err != nil {
		return nil, fmt.Errorf("betting pool refund bets abi pack: %w", err)
	}
	return data, nil
}

// ClaimPayoutCalldata returns ABI-encoded calldata for BettingPool.claimPayout(bytes32).
func (a *BettingPoolAdapter) ClaimPayoutCalldata(betID [32]byte) ([]byte, error) {
	data, err := bettingPoolABI.Pack("claimPayout", betID)
	if err != nil {
		return nil, fmt.Errorf("betting pool claim payout abi pack: %w", err)
	}
	return data, nil
}

// SettleParlayCalldata returns ABI-encoded calldata for BettingPool.settleParlay(bytes32).
func (a *BettingPoolAdapter) SettleParlayCalldata(parlayID [32]byte) ([]byte, error) {
	data, err := bettingPoolABI.Pack("settleParlay", parlayID)
	if err != nil {
		return nil, fmt.Errorf("betting pool settle parlay abi pack: %w", err)
	}
	return data, nil
}

// ClaimParlayPayoutCalldata returns ABI-encoded calldata for BettingPool.claimParlayPayout(bytes32).
func (a *BettingPoolAdapter) ClaimParlayPayoutCalldata(parlayID [32]byte) ([]byte, error) {
	data, err := bettingPoolABI.Pack("claimParlayPayout", parlayID)
	if err != nil {
		return nil, fmt.Errorf("betting pool claim parlay payout abi pack: %w", err)
	}
	return data, nil
}

// ReleasePayoutReserveCalldata returns ABI-encoded calldata for BettingPool.releasePayoutReserve(bytes32).
func (a *BettingPoolAdapter) ReleasePayoutReserveCalldata(riskID [32]byte) ([]byte, error) {
	data, err := bettingPoolABI.Pack("releasePayoutReserve", riskID)
	if err != nil {
		return nil, fmt.Errorf("betting pool release payout reserve abi pack: %w", err)
	}
	return data, nil
}

func toBettingPoolBindingGuard(guard BettingPoolQuoteGuardInput) bettingpool.QuoteGuardInput {
	return bettingpool.QuoteGuardInput{
		QuoteVersion:      guard.QuoteVersion,
		QuotedAt:          guard.QuotedAt,
		MinOdds:           guard.MinOdds,
		MinAcceptedAmount: guard.MinAcceptedAmount,
		Deadline:          guard.Deadline,
	}
}

func toBettingPoolBindingParlayLegs(legs []BettingPoolParlayLegInput) []bettingpool.ParlayLegInput {
	if legs == nil {
		return nil
	}
	converted := make([]bettingpool.ParlayLegInput, len(legs))
	for i, leg := range legs {
		converted[i] = bettingpool.ParlayLegInput{
			MarketId:     leg.MarketID,
			Outcome:      leg.Outcome,
			QuoteVersion: leg.QuoteVersion,
			QuotedAt:     leg.QuotedAt,
			MinOdds:      leg.MinOdds,
		}
	}
	return converted
}

func cloneBigInt(value *big.Int) *big.Int {
	if value == nil {
		return nil
	}
	return new(big.Int).Set(value)
}

func cloneBigIntSlice(values []*big.Int) []*big.Int {
	if values == nil {
		return nil
	}
	cloned := make([]*big.Int, len(values))
	for i, value := range values {
		cloned[i] = cloneBigInt(value)
	}
	return cloned
}
