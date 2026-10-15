package model

import (
	"encoding/json"
	"testing"
)

// TestModifyBalanceRequestAcceptsLegacyHandicapLine 覆盖线上旧字段名。
// 亚让/大小球必须拿到客户端盘口线，否则仓储层会用默认 0 参与风控校验并误判 HANDICAP_LINE_MISMATCH。
func TestModifyBalanceRequestAcceptsLegacyHandicapLine(t *testing.T) {
	cases := []struct {
		name string
		body []byte
		want string
	}{
		{
			name: "asian handicap",
			body: []byte(`{"odd_ids":[9920000108],"stakes":["50"],"type":"single","market":["asian_handicap"],"label":["1"],"handicapline":["-1.5"],"odds":["3.10"],"ref_id":"a78be5b8-fcb9-4018-9702-7dbcc9f26c96"}`),
			want: "-1.5",
		},
		{
			name: "asian over under",
			body: []byte(`{"odd_ids":[9920000110],"stakes":["50"],"type":"single","market":["asian_over_under"],"label":["over"],"handicapline":["1.5"],"odds":["1.40"],"ref_id":"9e60d4ef-0ca4-4c36-920e-8e34ba6507e3"}`),
			want: "1.5",
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			var req ModifyBalanceRequest
			if err := json.Unmarshal(tt.body, &req); err != nil {
				t.Fatalf("json.Unmarshal() error = %v", err)
			}
			if len(req.HandicapLine) != 1 || req.HandicapLine[0] != tt.want {
				t.Fatalf("handicap_line = %v, want [%s]", req.HandicapLine, tt.want)
			}
		})
	}
}

// TestModifyBalanceRequestPrefersCanonicalHandicapLine 确认新旧字段同时出现时使用标准字段。
// 这样可以避免客户端灰度期间旧字段残留覆盖新版盘口线，造成用户下注到错误盘口。
func TestModifyBalanceRequestPrefersCanonicalHandicapLine(t *testing.T) {
	body := []byte(`{"odd_ids":[1],"stakes":["10"],"type":"single","market":["asian_handicap"],"label":["1"],"handicap_line":["-0.5"],"handicapline":["-1.5"],"odds":["2.00"],"ref_id":"ref"}`)

	var req ModifyBalanceRequest
	if err := json.Unmarshal(body, &req); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	if len(req.HandicapLine) != 1 || req.HandicapLine[0] != "-0.5" {
		t.Fatalf("handicap_line = %v, want [-0.5]", req.HandicapLine)
	}
}
