package model

import (
	"encoding/json"
	"testing"
)

// TestRiskSummaryUnmarshal 覆盖 counts 聚合解析 summary 的三种形态：
// 正常 / 缺字段零值兜底 / 上游多余字段忽略（契约前向兼容）。
func TestRiskSummaryUnmarshal(t *testing.T) {
	cases := []struct {
		name    string
		body    string
		want    int
		wantErr bool
	}{
		{
			name: "正常携带 red_pending_count",
			body: `{"red_pending_count": 3}`,
			want: 3,
		},
		{
			name: "缺字段时零值兜底（badge 显示 0 而非报错）",
			body: `{"total_events": 8}`,
			want: 0,
		},
		{
			name: "上游多余字段忽略（summary 全量字段不解析）",
			body: `{"red_pending_count":1,"green_count":3,"max_event_exposure":"19246.00","max_exposure_event_id":"5"}`,
			want: 1,
		},
		{
			name:    "非法 JSON 报错",
			body:    `{red_pending_count:}`,
			wantErr: true,
		},
		{
			name:    "类型不匹配（字符串数字）报错而非静默吞",
			body:    `{"red_pending_count":"3"}`,
			wantErr: true,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var s RiskSummary
			err := json.Unmarshal([]byte(c.body), &s)
			if c.wantErr {
				if err == nil {
					t.Fatalf("期望解析报错，实际成功: %+v", s)
				}
				return
			}
			if err != nil {
				t.Fatalf("解析失败: %v", err)
			}
			if s.RedPendingCount != c.want {
				t.Errorf("RedPendingCount = %d, want %d", s.RedPendingCount, c.want)
			}
		})
	}
}
