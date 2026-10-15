package router_test

// events_routes_test.go — DD002 信号灯路由 RBAC 全矩阵验证（6 路由 × 4 角色 + 空/未知 role）。
//
// 与 presale_rbac_test.go 同方法论：直接调用生产注册函数 RegisterEventsRoutes，
// handler 用 nil client 实例（RBAC 拦截在中间件层，被放行的请求会因 nil client
// panic → gin.Recovery() 恢复 500）。判定口径：403 = RBAC 拦截；非 403 = RBAC 通过。

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/handler"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/router"
)

// buildEventsRBACRouter 构建带生产路由注册的测试引擎，role 由 X-Test-Role 注入。
func buildEventsRBACRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())

	// 模拟 AdminAuthMiddleware：注入 role；header 缺省时不 Set（覆盖「role 不在 context」分支）
	r.Use(func(c *gin.Context) {
		if role := c.GetHeader("X-Test-Role"); role != "" {
			c.Set(middleware.CtxAdminUserID, "test-user")
			c.Set(middleware.CtxRole, role)
		}
		c.Next()
	})

	noopSensitiveLimit := func(c *gin.Context) { c.Next() }
	admin := r.Group("/admin")
	router.RegisterEventsRoutes(admin, noopSensitiveLimit,
		handler.NewEventsRisk(nil), handler.NewApprovalCounts(nil))
	return r
}

type eventsEndpoint struct {
	method string
	path   string
}

var eventsEndpoints = map[string]eventsEndpoint{
	"summary":        {"GET", "/admin/events/risk/summary"},
	"list":           {"GET", "/admin/events/risk/list"},
	"detail":         {"GET", "/admin/events/5"},
	"adjust-history": {"GET", "/admin/events/5/adjust-history"},
	"risk-decision":  {"POST", "/admin/events/5/risk-decision"},
	"counts":         {"GET", "/admin/approval/counts"},
}

// TestEventsRoutesRBACMatrix 全矩阵：6 路由 × (4 角色 + 空 + 未知)。
func TestEventsRoutesRBACMatrix(t *testing.T) {
	// 每个端点的 allow 集（与 RegisterEventsRoutes 注册逐行对应；
	// 任何一边改动而另一边没改，本表会立刻红——双向锁定矩阵）
	allow := map[string]map[string]bool{
		"summary":        {"customer_service": true, "operator": true, "finance": true, "super_admin": true},
		"list":           {"customer_service": true, "operator": true, "finance": true, "super_admin": true},
		"detail":         {"customer_service": true, "operator": true, "finance": true, "super_admin": true},
		"adjust-history": {"customer_service": true, "operator": true, "finance": true, "super_admin": true},
		"risk-decision":  {"operator": true, "super_admin": true},
		"counts":         {"customer_service": true, "operator": true, "finance": true, "super_admin": true},
	}
	roles := []string{"customer_service", "operator", "finance", "super_admin", "", "unknown_role"}

	r := buildEventsRBACRouter(t)
	for name, ep := range eventsEndpoints {
		for _, role := range roles {
			caseName := name + "/" + role
			if role == "" {
				caseName = name + "/<empty>"
			}
			t.Run(caseName, func(t *testing.T) {
				req := httptest.NewRequest(ep.method, ep.path, nil)
				if role != "" {
					req.Header.Set("X-Test-Role", role)
				}
				w := httptest.NewRecorder()
				r.ServeHTTP(w, req)

				wantPass := allow[name][role]
				gotPass := w.Code != http.StatusForbidden
				if gotPass != wantPass {
					t.Errorf("%s %s role=%q: HTTP=%d, wantPass=%v", ep.method, ep.path, role, w.Code, wantPass)
				}
			})
		}
	}
}

// TestEventsRoutesPathShape 路由形状锁定：
//   - /admin/events/risk/summary 静态段不被 :event_id 吞掉（不会进 Detail 的数字校验 400）
//   - 裸 /admin/events/risk 不存在注册 handler → 落入 :event_id 兜底后被数字校验拦截
//     （gin 静态节点回溯参数节点，event_id="risk" → 400 INVALID_PARAM，不打上游）
func TestEventsRoutesPathShape(t *testing.T) {
	r := buildEventsRBACRouter(t)
	cases := []struct {
		name     string
		method   string
		path     string
		wantCode []int // 任一命中即通过
	}{
		// summary 静态路由命中：super_admin 放行后因 nil client panic→500（非 400/404）
		{"summary 不被参数段吞", "GET", "/admin/events/risk/summary", []int{http.StatusInternalServerError}},
		// 裸 /admin/events/risk：被 :event_id 兜底捕获 → 数字校验 400；或 gin 直接 404
		{"裸 /admin/events/risk 安全失败", "GET", "/admin/events/risk", []int{http.StatusBadRequest, http.StatusNotFound}},
		// 不存在的子路径
		{"未注册子路径 404", "GET", "/admin/events/5/unknown", []int{http.StatusNotFound}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(c.method, c.path, nil)
			req.Header.Set("X-Test-Role", "super_admin")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			for _, want := range c.wantCode {
				if w.Code == want {
					return
				}
			}
			t.Errorf("%s %s: HTTP=%d, want one of %v", c.method, c.path, w.Code, c.wantCode)
		})
	}
}

// TestEventsSensitiveLimitOrder 限流中间件在 RBAC 之后：finance 调 risk-decision
// 必须拿 403（而非先被限流桶消耗 token）。这里用「会失败的限流桩」验证顺序——
// 若顺序错误（限流在前），finance 请求会先 429。
func TestEventsSensitiveLimitOrder(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(func(c *gin.Context) {
		c.Set(middleware.CtxAdminUserID, "test-user")
		c.Set(middleware.CtxRole, "finance")
		c.Next()
	})
	// 恒 429 的限流桩：只要执行到它就报 429
	always429 := func(c *gin.Context) {
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"code": "RATE_LIMITED"})
	}
	admin := r.Group("/admin")
	router.RegisterEventsRoutes(admin, always429,
		handler.NewEventsRisk(nil), handler.NewApprovalCounts(nil))

	req := httptest.NewRequest("POST", "/admin/events/5/risk-decision", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	// RBAC 先拦：finance 应拿 403 而不是 429
	if w.Code != http.StatusForbidden {
		t.Errorf("finance POST risk-decision: HTTP=%d, want 403（RBAC 必须先于限流执行）", w.Code)
	}
}
