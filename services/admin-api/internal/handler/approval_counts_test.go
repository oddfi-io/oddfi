package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
)

// newApprovalCountsEnv 起 httptest 上游 + 装配 counts 路由。
func newApprovalCountsEnv(t *testing.T, upstream http.HandlerFunc) (*gin.Engine, *httptest.Server) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ts := httptest.NewServer(upstream)
	t.Cleanup(ts.Close)

	wc := client.New(client.WebapiConfig{
		InternalURL: ts.URL, ServiceToken: "test-secret", TimeoutSec: 2, MaxRetries: 1,
	})
	r := gin.New()
	r.GET("/admin/approval/counts", NewApprovalCounts(wc).Counts)
	return r, ts
}

// TestApprovalCounts 覆盖 T03 必测四形态 + 占位字段约定。
func TestApprovalCounts(t *testing.T) {
	cases := []struct {
		name       string
		upstream   http.HandlerFunc
		closeEarly bool
		wantHTTP   int
		wantCode   any // 0(float64) 或错误码字符串
		wantEvent  int
	}{
		{
			name: "正常：red_pending_count 透出为 event_count",
			upstream: func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(`{"code":0,"message":"ok","data":{"red_pending_count":3,"green_count":2}}`))
			},
			wantHTTP: http.StatusOK, wantCode: float64(0), wantEvent: 3,
		},
		{
			name: "上游响应缺 red_pending_count → event_count=0 不报错",
			upstream: func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(`{"code":0,"message":"ok","data":{"total_events":8}}`))
			},
			wantHTTP: http.StatusOK, wantCode: float64(0), wantEvent: 0,
		},
		{
			name: "上游 5xx → 503 UPSTREAM_UNAVAILABLE",
			upstream: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"code":"INTERNAL_ERROR","message":"boom"}`))
			},
			wantHTTP: http.StatusServiceUnavailable, wantCode: "UPSTREAM_UNAVAILABLE",
		},
		{
			name: "上游业务错 code≠0 → 503 UPSTREAM_UNAVAILABLE（badge 非关键路径统一降级）",
			upstream: func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(`{"code":"INTERNAL_ERROR","message":"degraded","data":null}`))
			},
			wantHTTP: http.StatusServiceUnavailable, wantCode: "UPSTREAM_UNAVAILABLE",
		},
		{
			name:       "上游不可达（网络错误）→ 503 UPSTREAM_UNAVAILABLE",
			upstream:   func(w http.ResponseWriter, _ *http.Request) {},
			closeEarly: true,
			wantHTTP:   http.StatusServiceUnavailable, wantCode: "UPSTREAM_UNAVAILABLE",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r, ts := newApprovalCountsEnv(t, c.upstream)
			if c.closeEarly {
				ts.Close()
			}
			code, resp := doReq(t, r, "GET", "/admin/approval/counts", "", nil)
			if code != c.wantHTTP {
				t.Fatalf("HTTP = %d, want %d, resp=%v", code, c.wantHTTP, resp)
			}
			if got := resp["code"]; got != c.wantCode {
				t.Fatalf("code = %v, want %v", got, c.wantCode)
			}
			if c.wantHTTP != http.StatusOK {
				return
			}
			data := dataMap(t, resp)
			if got := int(data["event_count"].(float64)); got != c.wantEvent {
				t.Errorf("event_count = %d, want %d", got, c.wantEvent)
			}
			// claim / withdraw 占位 0 且字段必须存在（T08 badge 渲染依赖）
			for _, k := range []string{"claim_count", "withdraw_count"} {
				v, ok := data[k].(float64)
				if !ok || v != 0 {
					t.Errorf("%s = %v, want 0", k, data[k])
				}
			}
		})
	}
}
