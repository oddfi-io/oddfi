// preview_withdraw_test.go — white-box unit tests for the PreviewWithdraw DTO
// mapping. Exercises toWithdrawPreview directly so no chain / SDK client is
// needed: the RPC-free mapping (big.Int -> decimal, enum cast, nil handling) is
// the only project-owned logic in the read method.

package read

import (
	"math/big"
	"testing"

	"github.com/Crypto-Barrett/oddfi-ODD-SDK/pkg/oddfi"
)

func TestToWithdrawPreview(t *testing.T) {
	tests := []struct {
		name       string
		raw        oddfi.LiquidityWithdrawPreview
		wantAmount string
		wantPnL    string
		wantState  LpPositionState
	}{
		{
			name: "withdrawable with profit",
			raw: oddfi.LiquidityWithdrawPreview{
				WithdrawAmount: big.NewInt(1500),
				NetPnL:         big.NewInt(500),
				EffectiveState: oddfi.LiquidityPositionStateWithdrawable,
			},
			wantAmount: "1500",
			wantPnL:    "500",
			wantState:  LpPositionState(5), // Withdrawable
		},
		{
			name: "unbonding with loss (negative PnL preserved)",
			raw: oddfi.LiquidityWithdrawPreview{
				WithdrawAmount: big.NewInt(700),
				NetPnL:         big.NewInt(-300),
				EffectiveState: oddfi.LiquidityPositionStateUnbonding,
			},
			wantAmount: "700",
			wantPnL:    "-300",
			wantState:  LpPositionState(1), // Unbonding
		},
		{
			name: "non-withdrawable state returns zeroes (nil big.Ints)",
			raw: oddfi.LiquidityWithdrawPreview{
				WithdrawAmount: nil,
				NetPnL:         nil,
				EffectiveState: oddfi.LiquidityPositionStateActive,
			},
			wantAmount: "0",
			wantPnL:    "0",
			wantState:  LpPositionState(0), // Active
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := toWithdrawPreview(tc.raw)
			if got.WithdrawAmount.String() != tc.wantAmount {
				t.Errorf("WithdrawAmount = %s, want %s", got.WithdrawAmount, tc.wantAmount)
			}
			if got.NetPnL.String() != tc.wantPnL {
				t.Errorf("NetPnL = %s, want %s", got.NetPnL, tc.wantPnL)
			}
			if got.EffectiveState != tc.wantState {
				t.Errorf("EffectiveState = %d, want %d", got.EffectiveState, tc.wantState)
			}
		})
	}
}
