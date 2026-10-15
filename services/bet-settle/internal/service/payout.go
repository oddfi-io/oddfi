package service

import (
	"oddfi-bet-settle/internal/model"

	"github.com/shopspring/decimal"
)

// CalculateActualPayout 是派彩计算的兼容入口，内部统一转调 CalcPayout，避免派彩公式分叉。
func CalculateActualPayout(bet model.UserBetHolding, result BetResult) decimal.Decimal {
	return CalcPayout(bet.Stake, bet.Odds, result.Status)
}
