// claim_test.go — white-box unit tests for the SDK v0.0.12 BettingPool query
// DTO mappers: toClaimStatus (getClaimStatus / getParlayClaimStatus),
// toBetEstimate (estimateBetValue) and the FloatingPnL-extended toParlayEstimate
// (estimateParlayValue). Each mapper is RPC-free — the big.Int -> decimal scaling,
// signed FloatingPnL preservation, odds /1e4 division and nil handling are the
// only project-owned logic in these reads, so they are tested directly without a
// chain or SDK client.

package read

import (
	"math/big"
	"testing"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

func TestToClaimStatus(t *testing.T) {
	tests := []struct {
		name       string
		raw        oddfi.ClaimStatus
		wantWon    bool
		wantReward string
	}{
		{
			name:       "won with net reward",
			raw:        oddfi.ClaimStatus{Won: true, Reward: big.NewInt(950)},
			wantWon:    true,
			wantReward: "950",
		},
		{
			name:       "not won, zero reward",
			raw:        oddfi.ClaimStatus{Won: false, Reward: big.NewInt(0)},
			wantWon:    false,
			wantReward: "0",
		},
		{
			name:       "refundable parlay: not won but principal refund claimable",
			raw:        oddfi.ClaimStatus{Won: false, Reward: big.NewInt(1000)},
			wantWon:    false,
			wantReward: "1000",
		},
		{
			name:       "nil reward treated as zero",
			raw:        oddfi.ClaimStatus{Won: false, Reward: nil},
			wantWon:    false,
			wantReward: "0",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := toClaimStatus(tc.raw)
			if got.Won != tc.wantWon {
				t.Errorf("Won = %v, want %v", got.Won, tc.wantWon)
			}
			if got.Reward.String() != tc.wantReward {
				t.Errorf("Reward = %s, want %s", got.Reward, tc.wantReward)
			}
		})
	}
}

func TestToBetEstimate(t *testing.T) {
	tests := []struct {
		name     string
		raw      oddfi.BetEstimatedValue
		wantVal  string
		wantPnL  string
	}{
		{
			name:    "in-the-money: positive floating PnL",
			raw:     oddfi.BetEstimatedValue{EstimatedValue: big.NewInt(1300), FloatingPnL: big.NewInt(300)},
			wantVal: "1300",
			wantPnL: "300",
		},
		{
			name:    "out-of-the-money: negative floating PnL preserved",
			raw:     oddfi.BetEstimatedValue{EstimatedValue: big.NewInt(700), FloatingPnL: big.NewInt(-300)},
			wantVal: "700",
			wantPnL: "-300",
		},
		{
			name:    "nil big.Ints treated as zero",
			raw:     oddfi.BetEstimatedValue{EstimatedValue: nil, FloatingPnL: nil},
			wantVal: "0",
			wantPnL: "0",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := toBetEstimate(tc.raw)
			if got.EstimatedValue.String() != tc.wantVal {
				t.Errorf("EstimatedValue = %s, want %s", got.EstimatedValue, tc.wantVal)
			}
			if got.FloatingPnL.String() != tc.wantPnL {
				t.Errorf("FloatingPnL = %s, want %s", got.FloatingPnL, tc.wantPnL)
			}
		})
	}
}

func TestToParlayEstimate(t *testing.T) {
	raw := oddfi.ParlayEstimatedValue{
		State:              2, // WonUnclaimed
		Stake:              big.NewInt(1000),
		LockedComboOdds:    big.NewInt(25000), // 2.5x after /1e4
		MaxPayout:          big.NewInt(2500),
		EstimatedValue:     big.NewInt(1800),
		FloatingPnL:        big.NewInt(800),
		FactorProduct:      big.NewInt(0),
		FinalizedLegCount:  2,
		UnresolvedLegCount: 1,
		HasFullLoss:        false,
		IsFinal:            false,
	}

	got := toParlayEstimate(raw)

	if got.State != ParlayWonUnclaimed {
		t.Errorf("State = %v, want WonUnclaimed", got.State)
	}
	if got.Stake.String() != "1000" {
		t.Errorf("Stake = %s, want 1000", got.Stake)
	}
	if got.LockedComboOdds.String() != "2.5" {
		t.Errorf("LockedComboOdds = %s, want 2.5", got.LockedComboOdds)
	}
	if got.MaxPayout.String() != "2500" {
		t.Errorf("MaxPayout = %s, want 2500", got.MaxPayout)
	}
	if got.EstimatedValue.String() != "1800" {
		t.Errorf("EstimatedValue = %s, want 1800", got.EstimatedValue)
	}
	if got.FloatingPnL.String() != "800" {
		t.Errorf("FloatingPnL = %s, want 800", got.FloatingPnL)
	}
	if got.FinalizedLegCount != 2 || got.UnresolvedLegCount != 1 {
		t.Errorf("leg counts = (%d,%d), want (2,1)", got.FinalizedLegCount, got.UnresolvedLegCount)
	}
}

func TestToParlayEstimate_NegativeFloatingPnLAndNil(t *testing.T) {
	raw := oddfi.ParlayEstimatedValue{
		State:           0, // Pending
		Stake:           big.NewInt(1000),
		LockedComboOdds: nil, // nil odds -> 0
		EstimatedValue:  big.NewInt(600),
		FloatingPnL:     big.NewInt(-400),
	}

	got := toParlayEstimate(raw)

	if got.LockedComboOdds.String() != "0" {
		t.Errorf("LockedComboOdds = %s, want 0", got.LockedComboOdds)
	}
	if got.FloatingPnL.String() != "-400" {
		t.Errorf("FloatingPnL = %s, want -400", got.FloatingPnL)
	}
}
