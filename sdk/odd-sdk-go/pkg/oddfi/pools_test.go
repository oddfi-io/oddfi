package oddfi

import (
	"context"
	"errors"
	"math/big"
	"testing"
)

func TestPoolMethodsValidateContextAndConfiguration(t *testing.T) {
	t.Parallel()

	var nilCtx context.Context

	if _, err := (*ODDToken)(nil).Name(context.Background()); !errors.Is(err, ErrMissingODDToken) {
		t.Fatalf("ODDToken.Name missing error = %v", err)
	}
	if _, err := (*StakingPool)(nil).Paused(context.Background()); !errors.Is(err, ErrMissingStakingPool) {
		t.Fatalf("StakingPool.Paused missing error = %v", err)
	}
	if _, err := (*LiquidityPool)(nil).Paused(context.Background()); !errors.Is(err, ErrMissingLiquidityPool) {
		t.Fatalf("LiquidityPool.Paused missing error = %v", err)
	}
	if _, err := (*LiquidityPool)(nil).PreviewWithdraw(context.Background(), big.NewInt(1)); !errors.Is(err, ErrMissingLiquidityPool) {
		t.Fatalf("LiquidityPool.PreviewWithdraw missing error = %v", err)
	}
	if _, err := (*BettingPool)(nil).Paused(context.Background()); !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("BettingPool.Paused missing error = %v", err)
	}
	if _, err := (*BettingPool)(nil).GetMarketExposure(context.Background(), [32]byte{0x01}); !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("BettingPool.GetMarketExposure missing error = %v", err)
	}
	if _, err := (&ODDToken{}).Name(nilCtx); !errors.Is(err, ErrNilContext) {
		t.Fatalf("ODDToken.Name nil context error = %v", err)
	}
	if _, err := (&LiquidityPool{}).PreviewWithdraw(nilCtx, big.NewInt(1)); !errors.Is(err, ErrNilContext) {
		t.Fatalf("LiquidityPool.PreviewWithdraw nil context error = %v", err)
	}
	if _, err := (&BettingPool{}).GetMarketExposure(nilCtx, [32]byte{0x01}); !errors.Is(err, ErrNilContext) {
		t.Fatalf("BettingPool.GetMarketExposure nil context error = %v", err)
	}
}

func TestLiquidityPoolPreviewWithdrawValidatesNilPositionID(t *testing.T) {
	t.Parallel()

	pool := newOfflineLiquidityPool(t)
	_, err := pool.PreviewWithdraw(context.Background(), nil)
	if !errors.Is(err, ErrNilBigIntParam) {
		t.Fatalf("expected ErrNilBigIntParam, got %v", err)
	}
}

func TestBettingPoolWriteMethodsValidateConfiguration(t *testing.T) {
	t.Parallel()

	marketID := [32]byte{0x01}
	betIDs := [][32]byte{{0x02}}

	if _, err := (*BettingPool)(nil).UpdateOdds(nil, marketID, nil, 0); !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("BettingPool.UpdateOdds missing error = %v", err)
	}
	if _, err := (*BettingPool)(nil).LockMarket(nil, marketID); !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("BettingPool.LockMarket missing error = %v", err)
	}
	if _, err := (*BettingPool)(nil).CashOut(nil, betIDs[0], big.NewInt(1), 1, big.NewInt(1), big.NewInt(2)); !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("BettingPool.CashOut missing error = %v", err)
	}
	if _, err := (*BettingPool)(nil).SettleMarketBetsByScore(nil, marketID, 2, 1, betIDs); !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("BettingPool.SettleMarketBetsByScore missing error = %v", err)
	}
	if _, err := (*BettingPool)(nil).FinalizeMarketSettlement(nil, marketID, 1); !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("BettingPool.FinalizeMarketSettlement missing error = %v", err)
	}
	if _, err := (*BettingPool)(nil).RefundBets(nil, marketID, betIDs, nil); !errors.Is(err, ErrMissingBettingPool) {
		t.Fatalf("BettingPool.RefundBets missing error = %v", err)
	}
}

func TestBettingPoolCashOutValidatesNilBigInt(t *testing.T) {
	t.Parallel()

	pool := newOfflineBettingPool(t)
	betID := [32]byte{0x01}

	tests := []struct {
		name                 string
		expectedQuoteVersion *big.Int
		minAmountOut         *big.Int
		deadline             *big.Int
	}{
		{name: "expected quote version", expectedQuoteVersion: nil, minAmountOut: big.NewInt(1), deadline: big.NewInt(2)},
		{name: "min amount out", expectedQuoteVersion: big.NewInt(1), minAmountOut: nil, deadline: big.NewInt(2)},
		{name: "deadline", expectedQuoteVersion: big.NewInt(1), minAmountOut: big.NewInt(1), deadline: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := pool.CashOut(nil, betID, tt.expectedQuoteVersion, 1, tt.minAmountOut, tt.deadline)
			if !errors.Is(err, ErrNilBigIntParam) {
				t.Fatalf("expected ErrNilBigIntParam, got %v", err)
			}
			var ue *UserError
			if !errors.As(err, &ue) {
				t.Fatalf("expected *UserError, got %T", err)
			}
		})
	}
}
