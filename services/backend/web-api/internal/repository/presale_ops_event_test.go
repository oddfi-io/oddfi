package repository

import (
	"testing"

	"everything_finance/org/web-api/internal/model"
)

// TestOpsEventStatus_Constants 验证异常事件状态常量与数据库约定一致
func TestOpsEventStatus_Constants(t *testing.T) {
	cases := []struct {
		name  string
		value string
		want  string
	}{
		{"pending", model.OpsEventStatusPending, "pending"},
		{"notified", model.OpsEventStatusNotified, "notified"},
		{"resolved", model.OpsEventStatusResolved, "resolved"},
		{"rejected", model.OpsEventStatusRejected, "rejected"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.value != tc.want {
				t.Errorf("OpsEventStatus %s = %q, want %q", tc.name, tc.value, tc.want)
			}
		})
	}
}
