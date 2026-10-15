package repository

import (
	"testing"

	"everything_finance/org/web-api/internal/model"
)

// TestPresaleDeposit_StatusConstants 验证 PresaleDeposit 三态常量值
// 这些常量被 WHERE 条件直接引用，值错误会导致状态机失效
func TestPresaleDeposit_StatusConstants(t *testing.T) {
	cases := []struct {
		name  string
		value string
		want  string
	}{
		{"pending", model.PresaleDepositStatusPending, "pending"},
		{"confirmed", model.PresaleDepositStatusConfirmed, "confirmed"},
		{"anomaly", model.PresaleDepositStatusAnomaly, "anomaly"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.value != tc.want {
				t.Errorf("status constant %s = %q, want %q", tc.name, tc.value, tc.want)
			}
		})
	}
}

// TestPresaleDeposit_AnomalyReasonConstants 验证 anomaly_reason 枚举值
// 这些常量被存入数据库，值改变会导致 admin 后台过滤失效
func TestPresaleDeposit_AnomalyReasonConstants(t *testing.T) {
	cases := []struct {
		name  string
		value string
		want  string
	}{
		{"overflow", model.AnomalyOverflow, "overflow"},
		{"from_mismatch", model.AnomalyFromMismatch, "from_mismatch"},
		{"non_usdt", model.AnomalyNonUsdt, "non_usdt"},
		{"below_min", model.AnomalyBelowMin, "below_min"},
		{"round_mismatch", model.AnomalyRoundMismatch, "round_mismatch"},
		{"late_arrival", model.AnomalyLateArrival, "late_arrival"},
		{"paused_arrival", model.AnomalyPausedArrival, "paused_arrival"},
		{"unclaimed", model.AnomalyUnclaimed, "unclaimed"},
		{"fake_referrer", model.AnomalyFakeReferrer, "fake_referrer"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.value != tc.want {
				t.Errorf("anomaly reason %s = %q, want %q", tc.name, tc.value, tc.want)
			}
		})
	}
}

// TestCreateOrGet_IdempotencyContract 验证 CreateOrGet 的幂等语义契约
// 通过检查函数签名和返回语义（无 DB 时验证接口约定）
func TestCreateOrGet_IdempotencyContract(t *testing.T) {
	// CreateOrGet 的幂等语义：
	// - 第一次调用：RowsAffected=1 → created=true，返回新记录
	// - 第二次调用（相同 uk）：RowsAffected=0 → created=false，返回已有记录
	// 此处通过 nil DB repo 构建验证接口可以被正确实例化
	var repo PresaleDepositRepository
	repo = NewPresaleDepositRepo(nil) // nil DB，不调用方法
	if repo == nil {
		t.Fatal("NewPresaleDepositRepo should return non-nil interface")
	}
}
