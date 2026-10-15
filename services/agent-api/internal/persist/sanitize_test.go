package persist

import (
	"errors"
	"strings"
	"testing"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

var _ = strings.Contains // 占位

func TestSanitizeAiAnalysis_AllowList(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"keep delta-up", `<b class="delta-up">↑</b>`, `<b class="delta-up">↑</b>`},
		{"keep delta-down", `<b class="delta-down">↓</b>`, `<b class="delta-down">↓</b>`},
		{"strip script", `<script>alert(1)</script>正文`, `正文`},
		{"strip onclick", `<b class="delta-up" onclick="x">↑</b>`, `<b class="delta-up">↑</b>`},
		{"strip foreign class", `<b class="evil">x</b>`, `<b>x</b>`},
		{"strip img", `<img src=x onerror=alert(1)>价格`, `价格`},
		{"strip iframe", `<iframe src="//evil"></iframe>`, ``},
		{"plain text passthrough", `价格 +5%`, `价格 +5%`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ai := &pushtypes.AiAnalysis{Change: tc.in, PriceImpact: tc.in, ProbImpact: tc.in}
			SanitizeAiAnalysis(ai)
			if ai.PriceImpact != tc.want {
				t.Errorf("PriceImpact got %q want %q", ai.PriceImpact, tc.want)
			}
		})
	}
}

func TestSanitizeAiAnalysis_NilSafe(t *testing.T) {
	// 不应 panic
	SanitizeAiAnalysis(nil)
}

// R2 评审 L4：HTML5 编码绕过 / SVG 命名空间 / 实体编码 / 嵌套畸形标签。
func TestSanitizeAiAnalysis_HTML5BypassDefense(t *testing.T) {
	cases := []struct {
		name           string
		in             string
		mustNotContain []string
	}{
		{"svg with script", `<svg><script>alert(1)</script></svg>`, []string{"<script", "alert"}},
		{"svg onload", `<svg onload="alert(1)"></svg>`, []string{"onload", "<svg"}},
		{"entity-encoded class", `<b class="delta-up&#x20;">↑</b>`, []string{"&#x20;"}},
		{"malformed nested", `<b class="delta-<up">text</b>`, []string{"<up"}},
		{"data uri", `<a href="javascript:alert(1)">x</a>`, []string{"javascript:", "<a"}},
		{"style attr", `<b class="delta-up" style="background:url(javascript:0)">↑</b>`, []string{"style", "javascript:"}},
		{"namespace prefix", `<xss:script>alert(1)</xss:script>`, []string{"<xss", "<script"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ai := &pushtypes.AiAnalysis{PriceImpact: tc.in}
			SanitizeAiAnalysis(ai)
			for _, nope := range tc.mustNotContain {
				if strings.Contains(strings.ToLower(ai.PriceImpact), strings.ToLower(nope)) {
					t.Errorf("payload %q 未剥净 %q\n  cleaned=%q", tc.in, nope, ai.PriceImpact)
				}
			}
		})
	}
}

func TestSanitizeEnrichError(t *testing.T) {
	cases := []struct {
		name      string
		err       error
		wantHas   []string
		wantNotHas []string
	}{
		{
			"nil error",
			nil,
			nil,
			nil,
		},
		{
			"strip url",
			errors.New(`POST https://api.moonshot.cn/v1/chat 401 unauthorized`),
			[]string{"401 unauthorized", "[url]"},
			[]string{"moonshot.cn"},
		},
		{
			"strip api key",
			errors.New(`auth failed: sk-abc123xyz789 invalid`),
			[]string{"[key]", "invalid"},
			[]string{"sk-abc"},
		},
		{
			"strip bearer",
			errors.New(`Bearer eyJhbGciOiJIUzI1NiJ9.xxxxx denied`),
			[]string{"[key]", "denied"},
			[]string{"eyJhbGc"},
		},
		{
			"strip abs path",
			errors.New(`error at /Users/hang/secret/kimi.go:42 timeout`),
			[]string{"[path]", "timeout"},
			[]string{"Users", "/secret"},
		},
		{
			"strip long token",
			// 40+ 字符触发阈值（R2 评审 L3/Minor-4：阈值从 32 调到 40 避免误伤 request_id）
			errors.New(`tracing id abcdef1234567890abcdef1234567890abcdef12345 failed`),
			[]string{"[token]", "failed"},
			[]string{"abcdef12345abcdef"},
		},
		{
			"keep short request_id (avoid false positive)",
			// 32 字符的合法 request_id 不应被替换（保留供运维定位）
			errors.New(`req_id=abcdef1234567890abcdef1234567890 status=429 rate_limited`),
			[]string{"abcdef1234567890abcdef1234567890", "429", "rate_limited"},
			nil,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := SanitizeEnrichError(tc.err)
			if tc.err == nil && got != "" {
				t.Errorf("nil error should return empty, got %q", got)
				return
			}
			for _, want := range tc.wantHas {
				if !strings.Contains(got, want) {
					t.Errorf("output %q missing %q", got, want)
				}
			}
			for _, ng := range tc.wantNotHas {
				if strings.Contains(got, ng) {
					t.Errorf("output %q should not contain %q", got, ng)
				}
			}
		})
	}
}

func TestSanitizeEnrichError_Truncate(t *testing.T) {
	long := strings.Repeat("x", 1000)
	got := SanitizeEnrichError(errors.New(long))
	if len(got) > 256 {
		t.Errorf("len=%d should be ≤ 256", len(got))
	}
}
