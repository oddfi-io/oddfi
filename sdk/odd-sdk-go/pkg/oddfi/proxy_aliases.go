package oddfi

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

// NextPositionId reads StakingPool.nextPositionId using the Solidity getter spelling.
func (p *StakingPool) NextPositionId(ctx context.Context) (*big.Int, error) {
	return p.NextPositionID(ctx)
}

// Positions reads StakingPool.positions using the Solidity getter spelling.
func (p *StakingPool) Positions(ctx context.Context, positionID *big.Int) (StakingPosition, error) {
	return p.Position(ctx, positionID)
}

// GetGlobalRequestableLiquidity reads LiquidityPool.getGlobalRequestableLiquidity using the Solidity method spelling.
func (p *LiquidityPool) GetGlobalRequestableLiquidity(ctx context.Context) (*big.Int, error) {
	return p.GlobalRequestableLiquidity(ctx)
}

// GetPayoutLiquidityWindow reads LiquidityPool.getPayoutLiquidityWindow using the Solidity method spelling.
func (p *LiquidityPool) GetPayoutLiquidityWindow(ctx context.Context, matchID [32]byte) (PayoutLiquidityWindow, error) {
	return p.PayoutLiquidityWindow(ctx, matchID)
}

// NextLpPositionId reads LiquidityPool.nextLpPositionId using the Solidity getter spelling.
func (p *LiquidityPool) NextLpPositionId(ctx context.Context) (*big.Int, error) {
	return p.NextLpPositionID(ctx)
}

// PayoutWindows reads LiquidityPool.payoutWindows using the Solidity getter spelling.
func (p *LiquidityPool) PayoutWindows(ctx context.Context, matchID [32]byte) (LiquidityPayoutWindow, error) {
	return p.PayoutWindow(ctx, matchID)
}

// Pools reads LiquidityPool.pools using the Solidity getter spelling.
func (p *LiquidityPool) Pools(ctx context.Context, poolID *big.Int) (LiquidityPoolInfo, error) {
	return p.Pool(ctx, poolID)
}

// Positions reads LiquidityPool.positions using the Solidity getter spelling.
func (p *LiquidityPool) Positions(ctx context.Context, positionID *big.Int) (LiquidityPosition, error) {
	return p.Position(ctx, positionID)
}

// MarketFinalResults reads BettingPool.marketFinalResults using the Solidity getter spelling.
func (p *BettingPool) MarketFinalResults(ctx context.Context, marketID [32]byte) (MarketFinalResult, error) {
	return p.MarketFinalResult(ctx, marketID)
}

// Parlays reads BettingPool.parlays using the Solidity getter spelling.
func (p *BettingPool) Parlays(ctx context.Context, parlayID [32]byte) (ParlayInfo, error) {
	return p.GetParlay(ctx, parlayID)
}

// ParlayLegs reads BettingPool.parlayLegs using the Solidity getter spelling.
func (p *BettingPool) ParlayLegs(ctx context.Context, parlayID [32]byte, legIndex *big.Int) (ParlayLegInfo, error) {
	return p.GetParlayLeg(ctx, parlayID, legIndex)
}

// ReferralClaimNonces reads BettingPool.referralClaimNonces using the Solidity getter spelling.
func (p *BettingPool) ReferralClaimNonces(ctx context.Context, user common.Address) (*big.Int, error) {
	return p.ReferralClaimNonce(ctx, user)
}

// Referrers reads BettingPool.referrers using the Solidity getter spelling.
func (p *BettingPool) Referrers(ctx context.Context, user common.Address) (common.Address, error) {
	return p.Referrer(ctx, user)
}

// NextPurchaseId reads TierSale.nextPurchaseId using the Solidity getter spelling.
func (p *TierSale) NextPurchaseId(ctx context.Context) (*big.Int, error) {
	return p.NextPurchaseID(ctx)
}

// Purchases reads TierSale.purchases using the Solidity getter spelling.
func (p *TierSale) Purchases(ctx context.Context, purchaseID *big.Int) (TierSalePurchase, error) {
	return p.Purchase(ctx, purchaseID)
}

// LpTokenId reads DexLaunchController.lpTokenId using the Solidity getter spelling.
func (p *DexLaunchController) LpTokenId(ctx context.Context) (*big.Int, error) {
	return p.LpTokenID(ctx)
}

// LockedPositions reads DexLpLocker.lockedPositions using the Solidity getter spelling.
func (p *DexLpLocker) LockedPositions(ctx context.Context, tokenID *big.Int) (DexLpLockerLockedPosition, error) {
	return p.LockedPosition(ctx, tokenID)
}

// Claimables reads EcosystemRewards.claimables using the Solidity getter spelling.
func (p *EcosystemRewards) Claimables(ctx context.Context, claimID *big.Int) (EcosystemRewardClaimable, error) {
	return p.Claimable(ctx, claimID)
}

// NextClaimId reads EcosystemRewards.nextClaimId using the Solidity getter spelling.
func (p *EcosystemRewards) NextClaimId(ctx context.Context) (*big.Int, error) {
	return p.NextClaimID(ctx)
}
