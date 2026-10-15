package engine

import (
	"math"
	"oddfi-odds-engine/internal/model"
)

// 常量定义，对照产品需求文档
const (
	ThresholdYellow    = 8000.0
	ThresholdOrange    = 18000.0
	ThresholdRed       = 28000.0
	UnitCompressYellow = 0.004 // 每超 $1,000 压缩 0.4%
	UnitCompressOrange = 0.008 // 每超 $1,000 压缩 0.8%
	MaxCompressYellow  = 0.040 // 黄灯最大压缩 4%
	MaxCompressOrange  = 0.080 // 橙灯附加最大 8%
	MinOdds            = 1.01
	OddsChangedThresh  = 0.05
)

// CalculateNewOdds 接收当前市场状态，返回重算后的所有方向新赔率
func CalculateNewOdds(outcomes []model.Outcome) ([]model.Outcome, model.SignalColor) {
	// 1. 计算总投注额
	totalStake := 0.0
	for _, o := range outcomes {
		totalStake += o.TotalStake
	}

	// 2. 计算最坏亏损 & 寻找重仓方向
	losses := make([]float64, len(outcomes))
	heavyIdx := 0
	maxLoss := -math.MaxFloat64

	for i, o := range outcomes {
		otherStake := totalStake - o.TotalStake
		// 最坏亏损 = 该方向总注额 * (当前赔率 - 1) - 其他方向总注额
		losses[i] = o.TotalStake*(o.CurrentOdds-1) - otherStake
		if losses[i] > maxLoss {
			maxLoss = losses[i]
			heavyIdx = i
		}
	}

	// 3. 计算风控信号和压缩率
	signal := getSignal(maxLoss)
	r := getCompressionRate(maxLoss)

	// 4. 应用重算和人工干预
	updatedOutcomes := make([]model.Outcome, len(outcomes))
	for i, o := range outcomes {
		updatedOutcomes[i] = o
		base := o.BaseOdds
		manualOffset := math.Max(-0.30, math.Min(0.30, o.ManualOffset)) // 限幅 ±0.30

		var computedOdds float64
		if i == heavyIdx {
			// 重仓：压缩
			compressed := base * (1 - r)
			compressed = math.Max(compressed, base*0.88) // 最大压缩 12%
			computedOdds = compressed
		} else {
			// 轻仓：上浮 (k=1.0)
			floatRate := math.Min(r*1.0, 0.08)
			floated := base * (1 + floatRate)
			floated = math.Min(floated, base*1.08) // 防套利上限
			computedOdds = floated
		}

		// 附加人工调整并保留两位小数
		finalOdds := math.Max(computedOdds+manualOffset, MinOdds)
		updatedOutcomes[i].CurrentOdds = math.Round(finalOdds/0.01) * 0.01
	}

	return updatedOutcomes, signal
}

func getSignal(loss float64) model.SignalColor {
	if loss <= ThresholdYellow {
		return model.SignalGreen
	}
	if loss <= ThresholdOrange {
		return model.SignalYellow
	}
	if loss <= ThresholdRed {
		return model.SignalOrange
	}
	return model.SignalRed
}

func getCompressionRate(loss float64) float64 {
	if loss <= ThresholdYellow {
		return 0
	}
	if loss <= ThresholdOrange {
		r := ((loss - ThresholdYellow) / 1000) * UnitCompressYellow
		return math.Min(r, MaxCompressYellow)
	}
	if loss <= ThresholdRed {
		rOrange := ((loss - ThresholdOrange) / 1000) * UnitCompressOrange
		return MaxCompressYellow + math.Min(rOrange, MaxCompressOrange)
	}
	return MaxCompressYellow + MaxCompressOrange // 12%
}
