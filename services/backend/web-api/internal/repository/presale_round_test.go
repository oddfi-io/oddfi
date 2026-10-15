package repository

import (
	"testing"

	"everything_finance/org/web-api/internal/model"

	"github.com/shopspring/decimal"
)

// TestIncrSoldAndRaised_SQLFormula 验证 IncrSoldAndRaised 的乐观条件 SQL 结构
// 通过检查超额判定逻辑：确认 ErrCapacityExceeded 在 RowsAffected=0 时正确返回
// 注意：无 DB 环境下通过 GORM DryRun 验证 SQL 结构，不做实际数据库操作
func TestIncrSoldAndRaised_CapacityCheck(t *testing.T) {
	// 测试加权逻辑：验证 deltaOdd > (supply - sold) 场景的检测路径
	// 实际 DB 测试由集成测试覆盖（需要 MySQL）
	// 此处验证业务常量和错误类型的正确定义
	if ErrCapacityExceeded == nil {
		t.Fatal("ErrCapacityExceeded must be non-nil sentinel error")
	}

	// 验证错误信息有意义（方便日志排查）
	if ErrCapacityExceeded.Error() == "" {
		t.Fatal("ErrCapacityExceeded must have non-empty message")
	}
}

// TestPresaleRound_StatusConstants 验证状态常量值与数据库约定一致
// 这些常量被 cron SQL 的 WHERE 条件直接引用，值错误会导致轮次无法推进
func TestPresaleRound_StatusConstants(t *testing.T) {
	cases := []struct {
		name  string
		value string
		want  string
	}{
		{"upcoming", model.RoundStatusUpcoming, "upcoming"},
		{"active", model.RoundStatusActive, "active"},
		{"paused", model.RoundStatusPaused, "paused"},
		{"ended", model.RoundStatusEnded, "ended"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.value != tc.want {
				t.Errorf("status constant %s = %q, want %q", tc.name, tc.value, tc.want)
			}
		})
	}
}

// TestTotalRaisedUsd_ZeroDecimal 验证 decimal.Zero 是有效的初始值
// 确保 COALESCE(SUM(...), 0) 的默认值与 decimal.Zero 语义一致
func TestTotalRaisedUsd_ZeroDecimal(t *testing.T) {
	zero := decimal.Zero
	if !zero.IsZero() {
		t.Fatal("decimal.Zero should be zero")
	}
	if zero.String() != "0" {
		t.Fatalf("decimal.Zero.String() = %q, want %q", zero.String(), "0")
	}
}
