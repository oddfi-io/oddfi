package tiersale

import (
	"math/big"
	"testing"
)

// odd returns n whole ODD in wei (n × 1e18).
func odd(n int64) *big.Int {
	return new(big.Int).Mul(big.NewInt(n), oneEther)
}

// usdt18 returns n whole USDT in wei at 18 decimals (BSC-USDT).
func usdt18(n int64) *big.Int {
	return new(big.Int).Mul(big.NewInt(n), oneEther)
}

func TestComputeOddForUsdt_Tier1Fresh(t *testing.T) {
	// totalSold=0, $100 budget at tier 1 ($0.01) → exactly 10,000 ODD, no crossing.
	got, startTier, endTier, capped := computeOddForUsdt(big.NewInt(0), 18, usdt18(100))
	if want := odd(10_000); got.Cmp(want) != 0 {
		t.Fatalf("odd: got %s want %s", got, want)
	}
	if startTier != 1 || endTier != 1 {
		t.Fatalf("tiers: got start=%d end=%d want 1/1", startTier, endTier)
	}
	if capped {
		t.Fatalf("capped: got true want false")
	}
}

func TestComputeOddForUsdt_PriceByTier(t *testing.T) {
	// $100 wholly inside a single tier → floor(100 / (N×0.01)) ODD.
	cases := []struct {
		startTotalSold *big.Int // places the cursor at the head of tier N
		tier           uint64
		wantOdd        int64
	}{
		{big.NewInt(0), 1, 10_000},               // $0.01
		{odd(3_000_000), 2, 5_000},               // tier 2 head, $0.02
		{odd(6_000_000), 3, 3_333},               // tier 3 head, $0.03 → floor(100/0.03)=3333.33→3333
		{odd(12_000_000), 5, 2_000},              // tier 5 head, $0.05
		{odd(27_000_000), 10, 1_000},             // tier 10 head, $0.10
	}
	for _, tc := range cases {
		got, startTier, _, _ := computeOddForUsdt(tc.startTotalSold, 18, usdt18(100))
		// tier 3 floor leaves a fractional remainder; compare whole ODD only.
		wantWhole := odd(tc.wantOdd)
		if tc.tier == 3 {
			// floor(100/0.03) = 3333 whole + fractional wei; assert ≥ 3333 and < 3334.
			if got.Cmp(odd(3_333)) < 0 || got.Cmp(odd(3_334)) >= 0 {
				t.Fatalf("tier3: got %s want in [3333,3334) ODD", got)
			}
			continue
		}
		if got.Cmp(wantWhole) != 0 {
			t.Fatalf("tier %d: got %s want %s", tc.tier, got, wantWhole)
		}
		if startTier != tc.tier {
			t.Fatalf("tier %d: startTier got %d", tc.tier, startTier)
		}
	}
}

func TestComputeOddForUsdt_CrossTier(t *testing.T) {
	// 4,000 ODD left in tier 1 ($0.01 → $40), then $60 into tier 2 ($0.02 → 3,000 ODD).
	totalSold := odd(2_996_000) // 3,000,000 − 4,000
	got, startTier, endTier, capped := computeOddForUsdt(totalSold, 18, usdt18(100))
	if want := odd(7_000); got.Cmp(want) != 0 {
		t.Fatalf("odd: got %s want %s", got, want)
	}
	if startTier != 1 || endTier != 2 {
		t.Fatalf("tiers: got start=%d end=%d want 1/2", startTier, endTier)
	}
	if capped {
		t.Fatalf("capped: got true want false")
	}
}

func TestComputeOddForUsdt_SoldOut(t *testing.T) {
	got, _, _, capped := computeOddForUsdt(totalSaleWei, 18, usdt18(100))
	if got.Sign() != 0 {
		t.Fatalf("odd: got %s want 0", got)
	}
	if capped {
		t.Fatalf("capped: got true want false (already sold out, not capped this call)")
	}
}

func TestComputeOddForUsdt_CappedByGlobalRemaining(t *testing.T) {
	// Only 1,000 ODD left in tier 10 ($0.10 → $100), but budget is $1,000,000.
	// Buy is capped to the 1,000 ODD remaining; budget left over.
	totalSold := new(big.Int).Sub(totalSaleWei, odd(1_000))
	got, startTier, endTier, capped := computeOddForUsdt(totalSold, 18, usdt18(1_000_000))
	if want := odd(1_000); got.Cmp(want) != 0 {
		t.Fatalf("odd: got %s want %s", got, want)
	}
	if startTier != 10 || endTier != 10 {
		t.Fatalf("tiers: got start=%d end=%d want 10/10", startTier, endTier)
	}
	if !capped {
		t.Fatalf("capped: got false want true")
	}
}

func TestComputeOddForUsdt_BudgetCostNeverExceedsBudget(t *testing.T) {
	// For a spread of budgets and positions, the implied cost (re-priced forward,
	// per-segment ceil) must never exceed the input budget.
	budgets := []int64{1, 7, 33, 100, 250, 9_999, 50_000}
	positions := []*big.Int{
		big.NewInt(0),
		odd(2_999_999),    // near tier-1 boundary
		odd(8_500_000),    // mid tier 3
		odd(29_000_000),   // tier 10
		odd(29_999_500),   // 500 ODD from sold out
	}
	for _, b := range budgets {
		for _, pos := range positions {
			got, _, _, _ := computeOddForUsdt(pos, 18, usdt18(b))
			if got.Sign() == 0 {
				continue
			}
			cost := forwardPreviewBuy(pos, 18, got)
			if cost.Cmp(usdt18(b)) > 0 {
				t.Fatalf("budget=$%d pos=%s: implied cost %s > budget %s (odd=%s)", b, pos, cost, usdt18(b), got)
			}
		}
	}
}

// forwardPreviewBuy re-implements TierSale.previewBuy (per-segment ceil) so the
// reverse calc can be cross-checked without a chain. It is a TEST oracle only.
func forwardPreviewBuy(totalSold *big.Int, usdtDecimals uint8, oddAmount *big.Int) *big.Int {
	usdtScale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(usdtDecimals)), nil)
	out := new(big.Int)
	remaining := new(big.Int).Set(oddAmount)
	cursor := new(big.Int).Set(totalSold)
	one := big.NewInt(1)
	for remaining.Sign() > 0 {
		idx := new(big.Int).Div(cursor, tierSizeWei)
		n := new(big.Int).Add(idx, one)
		tierEnd := new(big.Int).Mul(n, tierSizeWei)
		avail := new(big.Int).Sub(tierEnd, cursor)
		chunk := new(big.Int).Set(remaining)
		if chunk.Cmp(avail) > 0 {
			chunk.Set(avail)
		}
		num := new(big.Int).Mul(chunk, n)
		num.Mul(num, usdtScale)
		out.Add(out, ceilDiv(num, priceDenom))
		cursor.Add(cursor, chunk)
		remaining.Sub(remaining, chunk)
	}
	return out
}
