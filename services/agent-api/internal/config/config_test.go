package config

import (
	"testing"
)

// 单测覆盖 getIntOrDefault 边界 —— review fix（critic Major #1）后必须保证
// 严格配置 SSE_PER_IP_LIMIT=1 不再被静默吞掉。
func TestGetIntOrDefault(t *testing.T) {
	const key = "ENH002_TEST_INT"
	cases := []struct {
		name  string
		val   string
		def   int
		want  int
	}{
		{"unset returns default", "", 42, 42},
		{"strict 1 not silently dropped", "1", 42, 1},
		{"normal positive accepted", "60", 42, 60},
		{"explicit 0 falls back to default", "0", 42, 42},
		{"negative falls back to default", "-1", 42, 42},
		{"non-int falls back to default", "abc", 42, 42},
		{"empty string falls back", "", 42, 42},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(key, tc.val)
			if got := getIntOrDefault(key, tc.def); got != tc.want {
				t.Errorf("getIntOrDefault(%s=%q, def=%d) = %d, want %d", key, tc.val, tc.def, got, tc.want)
			}
		})
	}
}
