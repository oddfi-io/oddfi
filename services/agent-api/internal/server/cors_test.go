package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/store"
)

// TestOriginAllowed_ExactMatch 验证白名单精确匹配；
// v2 简化后不支持 regex/通配，所有 origin 必须严格相等命中。
func TestOriginAllowed_ExactMatch(t *testing.T) {
	s := New(Options{
		Store:          store.NewMemoryStore(),
		AllowedOrigins: "https://oddfi.io,https://www.oddfi.io,http://localhost:4000,http://localhost:4001,http://localhost:4002",
	})
	cases := []struct {
		origin string
		want   bool
	}{
		{"https://oddfi.io", true},
		{"https://www.oddfi.io", true},
		{"http://localhost:4000", true},
		{"http://localhost:4001", true},
		{"http://localhost:4002", true},
		{"https://evil.com", false},
		{"http://localhost:3000", false},                                // 不在白名单
		{"", false},                                                     // 空头一律拒
		{"HTTPS://ODDFI.IO", false},                                     // 大小写敏感（RFC6454 标准化后比较）
		{"https://oddfi.io/", false},                                    // 尾斜杠不匹配（浏览器不发，但要严格拒）
		{"https://oddfi-frontend-anything.vercel.app", false},           // Vercel preview 不再支持
	}
	for _, tc := range cases {
		if got := s.originAllowed(tc.origin); got != tc.want {
			t.Errorf("originAllowed(%q) = %v, want %v", tc.origin, got, tc.want)
		}
	}
}

// TestOriginAllowed_Wildcard 验证 "*" 通配全放行。
// 仅 dev 本地或不暴露公网时使用。
func TestOriginAllowed_Wildcard(t *testing.T) {
	s := New(Options{
		Store:          store.NewMemoryStore(),
		AllowedOrigins: "*",
	})
	cases := []string{
		"https://anything.example",
		"http://localhost:9999",
		"https://oddfi.io",
		"", // 空头在 * 下也允许（current behavior，但 withCORS 调用方还有额外判空）
	}
	for _, o := range cases {
		if !s.originAllowed(o) {
			t.Errorf("* should allow origin %q", o)
		}
	}
}

// TestOriginAllowed_EmptyWhitelist 空白名单（CORS_ALLOWED_ORIGINS="" 极端配置）应拒绝所有。
func TestOriginAllowed_EmptyWhitelist(t *testing.T) {
	s := New(Options{
		Store:          store.NewMemoryStore(),
		AllowedOrigins: "",
	})
	if s.originAllowed("https://oddfi.io") {
		t.Error("empty whitelist should deny all origins")
	}
}

// TestWithCORS_EchoOrigin 验证 withCORS 真实地把请求 Origin 回显（非通配模式）。
// 这是端到端集成：HTTP preflight 后必须看到与请求 Origin 一致的 ACAO，否则浏览器拒绝。
func TestWithCORS_EchoOrigin(t *testing.T) {
	s := New(Options{
		Store:          store.NewMemoryStore(),
		AllowedOrigins: "https://oddfi.io,https://www.oddfi.io,http://localhost:4000",
	})
	cases := []struct {
		origin   string
		wantACAO string // 期望返回的 Access-Control-Allow-Origin（""=未返回）
		wantVary bool
	}{
		{"https://oddfi.io", "https://oddfi.io", true},
		{"https://www.oddfi.io", "https://www.oddfi.io", true},
		{"http://localhost:4000", "http://localhost:4000", true},
		{"https://evil.com", "", false},
		{"", "", false},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodOptions, "/api/push", nil)
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		w := httptest.NewRecorder()
		s.Routes().ServeHTTP(w, req)

		gotACAO := w.Header().Get("Access-Control-Allow-Origin")
		if gotACAO != tc.wantACAO {
			t.Errorf("origin=%q ACAO got=%q want=%q", tc.origin, gotACAO, tc.wantACAO)
		}
		gotVary := w.Header().Get("Vary") == "Origin"
		if gotVary != tc.wantVary {
			t.Errorf("origin=%q Vary=Origin got=%v want=%v", tc.origin, gotVary, tc.wantVary)
		}
	}
}

// TestSSEOriginCheck_UsesSameMatcher 回归测试：sse.go 的 Origin 检查必须复用 originAllowed。
// 防止 withCORS 改了 matcher 但 sse.go 漏改导致 REST 通过、SSE 403 的不一致状态。
func TestSSEOriginCheck_UsesSameMatcher(t *testing.T) {
	s := New(Options{
		Store:          store.NewMemoryStore(),
		AllowedOrigins: "https://oddfi.io",
	})
	cases := []struct {
		origin   string
		wantCode int
	}{
		{"https://oddfi.io", http.StatusOK},        // 允许 → handler 会推进到后续逻辑（最终因无 bus 走 204，但 origin gate 已过）
		{"https://evil.com", http.StatusForbidden}, // 拒绝
		{"", http.StatusForbidden},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, "/api/push/stream", nil)
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		w := httptest.NewRecorder()
		s.Routes().ServeHTTP(w, req)

		// 允许的 origin：bus=nil 时 handleStream 走 204 NoContent
		gotCode := w.Code
		if tc.wantCode == http.StatusOK && gotCode != http.StatusNoContent {
			t.Errorf("origin=%q want passthrough (204 due to nil bus), got %d", tc.origin, gotCode)
			continue
		}
		if tc.wantCode == http.StatusForbidden && gotCode != http.StatusForbidden {
			t.Errorf("origin=%q want 403, got %d", tc.origin, gotCode)
		}
	}
}
