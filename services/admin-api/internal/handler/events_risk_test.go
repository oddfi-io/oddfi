package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
)

// newEventsRiskEnv 起 httptest mock 上游 + 装配 events 路由的 gin 引擎。
// upstream 为 nil 时用「200 + 回显请求信息」的默认桩（验证透传行为）。
func newEventsRiskEnv(t *testing.T, upstream http.HandlerFunc) (*gin.Engine, *httptest.Server) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	if upstream == nil {
		upstream = func(w http.ResponseWriter, r *http.Request) {
			// 回显 method/path/query/header，供断言透传是否原样
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0, "message": "ok",
				"data": map[string]any{
					"echo_path":  r.URL.Path,
					"echo_query": r.URL.RawQuery,
					"echo_jwt":   r.Header.Get("X-Admin-JWT"),
					"echo_idem":  r.Header.Get("X-Idempotency-Key"),
				},
			})
		}
	}
	ts := httptest.NewServer(upstream)
	t.Cleanup(ts.Close)

	wc := client.New(client.WebapiConfig{
		InternalURL: ts.URL, ServiceToken: "test-secret", TimeoutSec: 2, MaxRetries: 1,
	})
	h := NewEventsRisk(wc)

	r := gin.New()
	r.GET("/admin/events/risk/summary", h.Summary)
	r.GET("/admin/events/risk/list", h.List)
	r.GET("/admin/events/:event_id", h.Detail)
	r.GET("/admin/events/:event_id/adjust-history", h.AdjustHistory)
	r.POST("/admin/events/:event_id/risk-decision", h.RiskDecision)
	return r, ts
}

// doReq 发请求并解析响应壳。
func doReq(t *testing.T, r *gin.Engine, method, target, body string, headers map[string]string) (int, map[string]any) {
	t.Helper()
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, reader)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("响应非 JSON: %v, body=%s", err, w.Body.String())
	}
	return w.Code, resp
}

// dataMap 取响应 data 字段为 map。
func dataMap(t *testing.T, resp map[string]any) map[string]any {
	t.Helper()
	m, ok := resp["data"].(map[string]any)
	if !ok {
		t.Fatalf("data 不是对象: %v", resp["data"])
	}
	return m
}

// TestEventsRiskProxyPassthrough 验证 5 个端点的路径/查询/JWT 透传形态。
func TestEventsRiskProxyPassthrough(t *testing.T) {
	cases := []struct {
		name      string
		method    string
		target    string
		body      string
		headers   map[string]string
		wantPath  string
		wantQuery string
		wantIdem  string // 期望上游收到的 X-Idempotency-Key（GET 为空）
	}{
		{
			name: "summary 无 query 直透", method: "GET",
			target:   "/admin/events/risk/summary",
			wantPath: "/internal/admin/events/risk/summary",
		},
		{
			name: "list RawQuery 原样透传（signal 逗号多值不解析）", method: "GET",
			target:    "/admin/events/risk/list?signal=red,orange&status=active&sort_by=exposure&sort_order=desc&page=2&page_size=10",
			wantPath:  "/internal/admin/events/risk/list",
			wantQuery: "signal=red,orange&status=active&sort_by=exposure&sort_order=desc&page=2&page_size=10",
		},
		{
			name: "detail 数字 event_id 拼接 upstream 路径", method: "GET",
			target:   "/admin/events/5",
			wantPath: "/internal/admin/events/5",
		},
		{
			name: "adjust-history 带 market/direction 过滤透传", method: "GET",
			target:    "/admin/events/5/adjust-history?market=%E8%83%9C%E8%B4%9F&direction=Djokovic",
			wantPath:  "/internal/admin/events/5/adjust-history",
			wantQuery: "market=%E8%83%9C%E8%B4%9F&direction=Djokovic",
		},
		{
			name: "risk-decision POST 正常转发（幂等 key 透传上游）", method: "POST",
			target: "/admin/events/5/risk-decision",
			body:   `{"action":"stop","remark":"敞口超限人工停止"}`,
			headers: map[string]string{
				"X-Idempotency-Key": "idem-123",
				"Content-Type":      "application/json",
			},
			wantPath: "/internal/admin/events/5/risk-decision",
			wantIdem: "idem-123",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r, _ := newEventsRiskEnv(t, nil)
			headers := map[string]string{"Authorization": "Bearer test-jwt-raw"}
			for k, v := range c.headers {
				headers[k] = v
			}
			code, resp := doReq(t, r, c.method, c.target, c.body, headers)
			if code != http.StatusOK {
				t.Fatalf("HTTP = %d, want 200, resp=%v", code, resp)
			}
			data := dataMap(t, resp)
			if got := data["echo_path"]; got != c.wantPath {
				t.Errorf("upstream path = %v, want %s", got, c.wantPath)
			}
			if got := data["echo_query"]; got != c.wantQuery {
				t.Errorf("upstream query = %v, want %q", got, c.wantQuery)
			}
			// JWT 必须以 X-Admin-JWT 透传（Authorization 去 Bearer 前缀）
			if got := data["echo_jwt"]; got != "test-jwt-raw" {
				t.Errorf("upstream X-Admin-JWT = %v, want test-jwt-raw", got)
			}
			if c.wantIdem != "" {
				if got := data["echo_idem"]; got != c.wantIdem {
					t.Errorf("upstream X-Idempotency-Key = %v, want %s", got, c.wantIdem)
				}
			}
		})
	}
}

// TestEventsRiskParamGuard 入参门卫：非法 event_id / 缺幂等 key / 非法 action / 空 remark。
func TestEventsRiskParamGuard(t *testing.T) {
	cases := []struct {
		name     string
		method   string
		target   string
		body     string
		headers  map[string]string
		wantCode string
	}{
		{
			name: "detail event_id 非数字 → INVALID_PARAM", method: "GET",
			target: "/admin/events/abc", wantCode: "INVALID_PARAM",
		},
		{
			name: "detail event_id 混合字符 → INVALID_PARAM", method: "GET",
			target: "/admin/events/5x", wantCode: "INVALID_PARAM",
		},
		{
			name: "detail event_id 带负号 → INVALID_PARAM", method: "GET",
			target: "/admin/events/-5", wantCode: "INVALID_PARAM",
		},
		{
			name: "adjust-history event_id 非数字 → INVALID_PARAM", method: "GET",
			target: "/admin/events/abc/adjust-history", wantCode: "INVALID_PARAM",
		},
		{
			name: "risk-decision 缺 X-Idempotency-Key → INVALID_PARAM", method: "POST",
			target:   "/admin/events/5/risk-decision",
			body:     `{"action":"stop","remark":"ok remark"}`,
			wantCode: "INVALID_PARAM",
		},
		{
			name: "risk-decision action 非法 → INVALID_PARAM", method: "POST",
			target:   "/admin/events/5/risk-decision",
			body:     `{"action":"pause","remark":"ok remark"}`,
			headers:  map[string]string{"X-Idempotency-Key": "k1"},
			wantCode: "INVALID_PARAM",
		},
		{
			name: "risk-decision remark 缺失 → INVALID_PARAM", method: "POST",
			target:   "/admin/events/5/risk-decision",
			body:     `{"action":"stop"}`,
			headers:  map[string]string{"X-Idempotency-Key": "k1"},
			wantCode: "INVALID_PARAM",
		},
		{
			name: "risk-decision remark 全空白 → INVALID_PARAM", method: "POST",
			target:   "/admin/events/5/risk-decision",
			body:     `{"action":"stop","remark":"   "}`,
			headers:  map[string]string{"X-Idempotency-Key": "k1"},
			wantCode: "INVALID_PARAM",
		},
		{
			name: "risk-decision body 非 JSON → INVALID_PARAM", method: "POST",
			target:   "/admin/events/5/risk-decision",
			body:     `not-json`,
			headers:  map[string]string{"X-Idempotency-Key": "k1"},
			wantCode: "INVALID_PARAM",
		},
		{
			name: "detail event_id 超长（21 位）→ INVALID_PARAM（review M-2）", method: "GET",
			target: "/admin/events/123456789012345678901", wantCode: "INVALID_PARAM",
		},
		{
			name: "risk-decision 幂等 key 超长（>128）→ INVALID_PARAM（review Sec-M2）", method: "POST",
			target:   "/admin/events/5/risk-decision",
			body:     `{"action":"stop","remark":"ok remark"}`,
			headers:  map[string]string{"X-Idempotency-Key": strings.Repeat("k", 129)},
			wantCode: "INVALID_PARAM",
		},
		{
			name: "risk-decision remark 超长（>500 rune）→ INVALID_PARAM（review Sec-M2）", method: "POST",
			target:   "/admin/events/5/risk-decision",
			body:     `{"action":"stop","remark":"` + strings.Repeat("长", 501) + `"}`,
			headers:  map[string]string{"X-Idempotency-Key": "k1"},
			wantCode: "INVALID_PARAM",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			upstreamHit := false
			r, _ := newEventsRiskEnv(t, func(w http.ResponseWriter, _ *http.Request) {
				upstreamHit = true
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"code":0,"message":"ok","data":null}`))
			})
			code, resp := doReq(t, r, c.method, c.target, c.body, c.headers)
			if code != http.StatusBadRequest {
				t.Fatalf("HTTP = %d, want 400, resp=%v", code, resp)
			}
			if got := resp["code"]; got != c.wantCode {
				t.Errorf("code = %v, want %s", got, c.wantCode)
			}
			// 门卫拦截不应打到上游
			if upstreamHit {
				t.Error("参数非法时不应请求上游")
			}
		})
	}
}

// TestEventsRiskErrorTranslation 错误翻译：5xx 降级 / 业务错透传 / 4xx 透传 / 网络错降级。
func TestEventsRiskErrorTranslation(t *testing.T) {
	cases := []struct {
		name       string
		upstream   http.HandlerFunc
		closeEarly bool // 模拟网络错误：先关 server
		wantHTTP   int
		wantCode   string
	}{
		{
			name: "upstream 5xx → 503 UPSTREAM_UNAVAILABLE",
			upstream: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusBadGateway)
				_, _ = w.Write([]byte(`{"code":"INTERNAL_ERROR","message":"boom"}`))
			},
			wantHTTP: http.StatusServiceUnavailable, wantCode: "UPSTREAM_UNAVAILABLE",
		},
		{
			name: "upstream 业务错（EVENT_NOT_RED_SIGNAL）→ HTTP 200 code 原样透传",
			upstream: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"code":"EVENT_NOT_RED_SIGNAL","message":"only red","data":null}`))
			},
			wantHTTP: http.StatusOK, wantCode: "EVENT_NOT_RED_SIGNAL",
		},
		{
			name: "upstream 业务错（RISK_DECISION_CONFLICT）→ HTTP 200 code 原样透传",
			upstream: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"code":"RISK_DECISION_CONFLICT","message":"dup","data":null}`))
			},
			wantHTTP: http.StatusOK, wantCode: "RISK_DECISION_CONFLICT",
		},
		{
			name: "upstream 404 EVENT_NOT_FOUND → 404 透传",
			upstream: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"code":"EVENT_NOT_FOUND","message":"not found","data":null}`))
			},
			wantHTTP: http.StatusNotFound, wantCode: "EVENT_NOT_FOUND",
		},
		{
			name:       "网络错误（上游已关）→ 503 UPSTREAM_UNAVAILABLE",
			upstream:   func(w http.ResponseWriter, _ *http.Request) {},
			closeEarly: true,
			wantHTTP:   http.StatusServiceUnavailable, wantCode: "UPSTREAM_UNAVAILABLE",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r, ts := newEventsRiskEnv(t, c.upstream)
			if c.closeEarly {
				ts.Close()
			}
			code, resp := doReq(t, r, "POST", "/admin/events/5/risk-decision",
				`{"action":"stop","remark":"valid remark"}`,
				map[string]string{"X-Idempotency-Key": "k1"})
			if code != c.wantHTTP {
				t.Fatalf("HTTP = %d, want %d, resp=%v", code, c.wantHTTP, resp)
			}
			if got := resp["code"]; got != c.wantCode {
				t.Errorf("code = %v, want %s", got, c.wantCode)
			}
		})
	}
}

// TestEventsRiskBodyPassthrough data 响应体逐字段透传（json.RawMessage 不丢字段、不动类型）。
func TestEventsRiskBodyPassthrough(t *testing.T) {
	// 含 ,string ID、null 字段、嵌套对象的代表性上游响应
	upstreamData := `{"event_id":"5","score":null,"signal":"red","times":{"settle":null},"pending_decision":true,"yield_ratio":null}`
	r, _ := newEventsRiskEnv(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"message":"ok","data":` + upstreamData + `}`))
	})

	req := httptest.NewRequest("GET", "/admin/events/5", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("HTTP = %d, want 200", w.Code)
	}
	// 解析两侧 data 做深度相等比较（不依赖键序）
	var got map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}
	var wantData, gotData any
	if err := json.Unmarshal([]byte(upstreamData), &wantData); err != nil {
		t.Fatalf("解析期望失败: %v", err)
	}
	gotData = got["data"]
	wantJSON, _ := json.Marshal(wantData)
	gotJSON, _ := json.Marshal(gotData)
	if string(wantJSON) != string(gotJSON) {
		t.Errorf("data 透传不一致:\n got=%s\nwant=%s", gotJSON, wantJSON)
	}
	// event_id 必须保持字符串（,string 契约）
	dm, ok := gotData.(map[string]any)
	if !ok {
		t.Fatal("data 不是对象")
	}
	if _, ok := dm["event_id"].(string); !ok {
		t.Errorf("event_id 应为字符串，实际 %T", dm["event_id"])
	}
}
