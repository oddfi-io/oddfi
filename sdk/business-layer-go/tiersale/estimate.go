// estimate.go — read-only USDT→ODD budget estimator.
//
// The TierSale contract only exposes previewBuy(odd)→usdt (forward). To answer
// "how much ODD can N USDT buy at the current sale position?" the math must be
// inverted here, accounting for the 10-tier step pricing and tier crossings,
// exactly as the contract prices a buy (per-segment ceil over PRICE_DENOMINATOR).
//
// Flow:
//  1. read totalSold + usdtDecimals from chain;
//  2. compute the ODD amount locally (computeOddForUsdt, pure + tier-aware);
//  3. verify the result against the contract's previewBuy(odd) for the exact
//     USDT the buy will cost (≤ budget by construction).
//
// This mirrors TierSale.sol constants:
//   TIER_COUNT = 10, TIER_SIZE = 3,000,000 ODD, TOTAL_SALE_ODD = 30,000,000 ODD,
//   PRICE_DENOMINATOR = 100 ether, price(tierN) = N × $0.01.

package tiersale

import (
	"context"
	"math/big"

	"github.com/Crypto-Barrett/contracts-business-layer/coretypes"
)

// Sale constants mirror TierSale.sol (all in wei / 1e18-scaled ODD).
var (
	oneEther     = new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	zeroOneEther = new(big.Int).Exp(big.NewInt(10), big.NewInt(17), nil)
	tierSizeWei  = new(big.Int).Mul(big.NewInt(3_000_000), oneEther)  // 3,000,000 ODD per tier
	totalSaleWei = new(big.Int).Mul(big.NewInt(30_000_000), oneEther) // 30,000,000 ODD total
	priceDenom   = new(big.Int).Mul(big.NewInt(100), oneEther)        // PRICE_DENOMINATOR = 100 ether
)

// EstimateResult is the outcome of EstimateOddForUsdt.
type EstimateResult struct {
	// OddAmount is the total ODD wei the budget can buy at the current position.
	// Zero when the sale is sold out or the budget is too small to buy any ODD.
	OddAmount *big.Int
	// UsdtCost is the exact USDT the contract will charge for OddAmount
	// (previewBuy(OddAmount)); always ≤ the input budget. Zero when OddAmount is 0.
	UsdtCost *big.Int
	// BudgetLeft is budget − UsdtCost: the rounding zero-change plus any
	// global-cap remainder that stays in the buyer's wallet.
	BudgetLeft *big.Int
	// StartTier is the 1-based tier at the sale cursor before buying (1..10).
	StartTier uint64
	// EndTier is the 1-based tier of the last ODD bought (1..10).
	EndTier uint64
	// CrossesTier is true when the buy spans more than one tier.
	CrossesTier bool
	// CappedBySale is true when the global remaining (near sold-out) capped the
	// amount below what the budget could otherwise buy (PRD §3.2.2 末档封顶).
	CappedBySale bool
}

// EstimateOddForUsdt computes how many ODD the given USDT budget buys at the
// current on-chain sale position, then verifies the exact cost via previewBuy.
//
// usdtBudget is in USDT's smallest unit (wei at usdtDecimals). The SDK passed to
// New MUST be configured with TierSaleProxy, or the reads return a ConfigError.
func (c *Client) EstimateOddForUsdt(ctx context.Context, usdtBudget *big.Int) (EstimateResult, error) {
	const op = "EstimateOddForUsdt"
	if ctx == nil {
		return EstimateResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("nil ctx"))
	}
	if usdtBudget == nil || usdtBudget.Sign() <= 0 {
		return EstimateResult{}, coretypes.WrapBusiness(coretypes.ErrParamInvalid, op, errStr("usdtBudget must be positive"))
	}

	sale := c.sdk.TierSale()
	totalSold, err := sale.TotalSold(ctx)
	if err != nil {
		return EstimateResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, op+".TotalSold", err)
	}
	dec, err := sale.UsdtDecimals(ctx)
	if err != nil {
		return EstimateResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, op+".UsdtDecimals", err)
	}

	odd, startTier, endTier, capped := computeOddForUsdt(totalSold, dec, usdtBudget)

	res := EstimateResult{
		OddAmount:    odd,
		UsdtCost:     big.NewInt(0),
		BudgetLeft:   new(big.Int).Set(usdtBudget),
		StartTier:    startTier,
		EndTier:      endTier,
		CrossesTier:  endTier > startTier,
		CappedBySale: capped,
	}
	if odd.Sign() == 0 {
		// Sold out, or budget too small to buy a single wei of ODD.
		return res, nil
	}

	// Verify against the contract's exact per-segment pricing.
	cost, err := sale.PreviewBuy(ctx, odd)
	if err != nil {
		return EstimateResult{}, coretypes.WrapRetryable(coretypes.ErrInfraRPC, op+".PreviewBuy", err)
	}
	res.UsdtCost = cost
	left := new(big.Int).Sub(usdtBudget, cost)
	if left.Sign() < 0 {
		left = big.NewInt(0) // defensive; should not happen given the floor on the last segment
	}
	res.BudgetLeft = left
	return res, nil
}

// computeOddForUsdt is the pure tier-aware reverse calc. Given the current
// totalSold (ODD wei), the USDT decimals, and a budget (USDT wei), it returns
// the buyable ODD wei plus tier metadata. It never queries the chain, so it is
// fully unit-testable. It mirrors TierSale.previewBuy's per-segment ceil pricing
// and never exceeds the global remaining (TOTAL_SALE_ODD − totalSold).
func computeOddForUsdt(totalSold *big.Int, usdtDecimals uint8, budget *big.Int) (oddAmount *big.Int, startTier, endTier uint64, cappedBySale bool) {
	usdtScale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(usdtDecimals)), nil)
	oddAmount = new(big.Int)

	// Already sold out → nothing buyable.
	if totalSold.Cmp(totalSaleWei) >= 0 {
		return oddAmount, 10, 10, false
	}

	cursor := new(big.Int).Set(totalSold)
	remaining := new(big.Int).Set(budget)
	startTier = tierOf(cursor)
	endTier = startTier

	one := big.NewInt(1)
	for remaining.Sign() > 0 && cursor.Cmp(totalSaleWei) < 0 {
		idx := new(big.Int).Div(cursor, tierSizeWei) // 0-based tier index
		n := new(big.Int).Add(idx, one)              // tier number (price multiplier)
		tierEnd := new(big.Int).Mul(n, tierSizeWei)  // (idx+1) * TIER_SIZE
		avail := new(big.Int).Sub(tierEnd, cursor)   // ODD wei left in this tier

		// costFull = ceil(avail * n * usdtScale / priceDenom)
		num := new(big.Int).Mul(avail, n)
		num.Mul(num, usdtScale)
		costFull := ceilDiv(num, priceDenom)

		if remaining.Cmp(costFull) >= 0 {
			// Buy the whole tier, advance to the next.
			oddAmount.Add(oddAmount, avail)
			remaining.Sub(remaining, costFull)
			cursor.Set(tierEnd)
			endTier = n.Uint64()
			continue
		}

		// Partial fill of this tier: max odd with ceil(odd*n*scale/denom) ≤ remaining
		// ⇔ odd ≤ remaining*denom/(n*scale) (floor).
		num2 := new(big.Int).Mul(remaining, priceDenom)
		den2 := new(big.Int).Mul(n, usdtScale)
		oddInTier := new(big.Int).Quo(num2, den2) // floor, non-negative
		if oddInTier.Cmp(avail) > 0 {
			oddInTier.Set(avail)
		}
		if oddInTier.Sign() > 0 {
			oddAmount.Add(oddAmount, oddInTier)
			cursor.Add(cursor, oddInTier)
			endTier = n.Uint64()
		}
		remaining.SetInt64(0)
		break
	}

	// Budget still had funds but the global supply ran out (末档封顶).
	cappedBySale = cursor.Cmp(totalSaleWei) >= 0 && remaining.Sign() > 0
	return oddAmount, startTier, endTier, cappedBySale
}

// tierOf returns the 1-based tier containing cursor (clamped to 10 at/after sell-out).
func tierOf(cursor *big.Int) uint64 {
	if cursor.Cmp(totalSaleWei) >= 0 {
		return 10
	}
	idx := new(big.Int).Div(cursor, tierSizeWei)
	return idx.Uint64() + 1
}

// ceilDiv returns ceil(a/b) for non-negative a and positive b.
func ceilDiv(a, b *big.Int) *big.Int {
	if a.Sign() == 0 {
		return big.NewInt(0)
	}
	res := new(big.Int).Sub(a, big.NewInt(1))
	res.Quo(res, b)
	res.Add(res, big.NewInt(1))
	return res
}
