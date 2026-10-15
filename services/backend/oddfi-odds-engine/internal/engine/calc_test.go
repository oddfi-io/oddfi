package engine

import (
	"oddfi-odds-engine/internal/model"
	"testing"
)

func TestCalculateNewOdds_AntiIntuitionScenario(t *testing.T) {
	// 模拟产品文档中的“示例 B：反直觉（冷门=重仓）”
	// 主胜 1.30 收到 5000，客胜 4.50 收到 15000
	outcomes := []model.Outcome{
		{ID: "home", BaseOdds: 1.30, CurrentOdds: 1.30, TotalStake: 5000.0, ManualOffset: 0},
		{ID: "away", BaseOdds: 4.50, CurrentOdds: 4.50, TotalStake: 15000.0, ManualOffset: 0},
	}

	newOutcomes, signal := CalculateNewOdds(outcomes)

	// 客胜最坏亏损 = 15000 * (4.5-1) - 5000 = 52500 - 5000 = 47500
	// 47500 大于红灯阈值 28000，应该触发 红灯 (SignalRed)，且采用最大压缩率 12%

	if signal != model.SignalRed {
		t.Errorf("预期红灯，实际得到: %d", signal)
	}

	for _, o := range newOutcomes {
		if o.ID == "away" {
			// 预期客胜被压缩 12%：4.50 * 0.88 = 3.96
			expectedOdds := 3.96
			if o.CurrentOdds != expectedOdds {
				t.Errorf("客胜赔率压缩失败，预期 %.2f, 实际 %.2f", expectedOdds, o.CurrentOdds)
			}
		} else if o.ID == "home" {
			// 预期主胜作为轻仓，上浮 12% (但受限于最大上浮上限 8%)
			// 1.30 * 1.08 = 1.404 -> 保留两位小数 -> 1.40
			expectedOdds := 1.40
			if o.CurrentOdds != expectedOdds {
				t.Errorf("主胜赔率上浮失败，预期 %.2f, 实际 %.2f", expectedOdds, o.CurrentOdds)
			}
		}
	}
}
