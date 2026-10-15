package handler

import "testing"

// BUG-001 B3: SigTime 容差 5 条边界用例
// 详见 .progress/bug/BUG-001-inv6-cross-clock-domain/BD.md §5.2
func TestIsSigTimeValid(t *testing.T) {
	const now = uint64(1_700_000_000)

	cases := []struct {
		name    string
		sigTime uint64
		want    bool
	}{
		{"正常 sigTime == now", now, true},
		{"未来 14s 容差内", now + 14, true},
		{"未来 16s 超容差", now + 16, false},
		{"过去 60s 窗口内", now - 60, true},
		{"过去 200s 超窗口", now - 200, false},
		// 边界精确点
		{"未来边界 15s 刚好通过", now + 15, true},
		{"过去边界 180s 刚好通过", now - 180, true},
		{"过去边界 181s 拒绝", now - 181, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := isSigTimeValid(tc.sigTime, now)
			if got != tc.want {
				t.Errorf("isSigTimeValid(sigTime=%d, now=%d) = %v, want %v",
					tc.sigTime, now, got, tc.want)
			}
		})
	}
}
