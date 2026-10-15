package handler_test

// presale_rbac_test.go — 4 角色 × 17 接口 RBAC 矩阵验证
//
// 测试目标：确认每个角色对 presale 路由只能访问自己有权限的接口，
// 不关心业务逻辑是否执行成功（DB 返回 404 或 500 均可），只验证不返回 403。
// 403 意味着 RBAC 拦截，其他状态码意味着通过了 RBAC。
//
// 改造说明（B3 code review 修复）：
//   - 原实现用 buildPresaleRBACRouter 构建假路由（手动重复注册），与生产路由不同步
//   - 现在直接调用 router.RegisterPresaleRoutes（生产代码路径），确保 test 与生产一致

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/handler"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/router"
)

// buildPresaleRBACRouter 使用生产路由注册函数，handler 全部用 nop（恒 200）替代。
// RBAC 中间件在 handler 之前执行，403 即代表 RBAC 拦截，其他码即 RBAC 通过。
func buildPresaleRBACRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Recovery 确保 nil-svc handler panic 恢复为 500（而非测试进程崩溃）。
	// RBAC 通过 = 非 403（500 / 200 均可）；RBAC 拦截 = 403。
	r.Use(gin.Recovery())

	// 模拟 AdminAuthMiddleware：由测试用例通过 header 注入 role
	r.Use(func(c *gin.Context) {
		role := c.GetHeader("X-Test-Role")
		c.Set(middleware.CtxAdminUserID, "test-user")
		c.Set(middleware.CtxRole, role)
		c.Next()
	})

	// 占位 handler：RBAC 通过后恒返回 200
	nop := func(c *gin.Context) { c.Status(http.StatusOK) }

	// nopRound/Deposit/Config/Anomaly/Audit handler：全部方法返回 200
	roundH := newNopRoundHandler(nop)
	depositH := newNopDepositHandler(nop)
	configH := newNopConfigHandler(nop)
	anomalyH := newNopAnomalyHandler(nop)
	auditH := newNopAuditHandler(nop)

	// noopAuditMW：跳过事务和 audit 写入，让 handler 直接执行
	noopAuditMW := func(c *gin.Context) { c.Next() }
	// noopSensitiveLimit：跳过限流
	noopSensitiveLimit := func(c *gin.Context) { c.Next() }

	// 使用与生产完全相同的路由注册函数（真实 RBAC 中间件）
	admin := r.Group("/admin")
	kolH := handler.NewKolReferral(nil)
	router.RegisterPresaleRoutes(admin, noopSensitiveLimit, noopAuditMW,
		roundH, depositH, configH, anomalyH, auditH, kolH)

	return r
}

// presaleEndpoint 描述一个测试端点。
type presaleEndpoint struct {
	method string
	path   string
}

// presaleRBACCase 描述单条测试用例。
type presaleRBACCase struct {
	role     string
	endpoint presaleEndpoint
	wantPass bool // true = 期望通过 RBAC（非 403）；false = 期望 403
}

func TestPresaleRBAC_Matrix(t *testing.T) {
	r := buildPresaleRBACRouter(t)

	// 17 个端点（与生产路由完全对应）
	readEndpoints := []presaleEndpoint{
		{"GET", "/admin/presale/rounds"},
		{"GET", "/admin/presale/rounds/seed"},
		{"GET", "/admin/presale/deposits"},
		{"GET", "/admin/presale/deposits/0xABC"},
		{"GET", "/admin/presale/config"},
		{"GET", "/admin/presale/anomaly"},
		{"GET", "/admin/presale/anomaly/1"},
		{"GET", "/admin/presale/audit"},
	}
	operatorWriteEndpoints := []presaleEndpoint{
		{"POST", "/admin/presale/rounds/seed/pause"},
		{"POST", "/admin/presale/rounds/seed/resume"},
		{"POST", "/admin/presale/rounds/seed/reopen"},
		{"POST", "/admin/presale/rounds/seed/close"},
		{"PATCH", "/admin/presale/rounds/seed/referral-pct"},
		{"POST", "/admin/presale/deposits/0xABC/migrate-round"},
	}
	// resolve 属于 readRoles（customer_service / operator / super_admin），单独列出
	resolveEndpoint := presaleEndpoint{"POST", "/admin/presale/anomaly/1/resolve"}
	superAdminWriteEndpoints := []presaleEndpoint{
		{"PATCH", "/admin/presale/rounds/seed"},
		{"PATCH", "/admin/presale/config"},
	}

	cases := []presaleRBACCase{}

	// customer_service：只读 + resolve（全 3 非 finance 角色可读 + resolve）
	for _, ep := range readEndpoints {
		cases = append(cases, presaleRBACCase{"customer_service", ep, true})
	}
	cases = append(cases, presaleRBACCase{"customer_service", resolveEndpoint, true})
	for _, ep := range operatorWriteEndpoints {
		cases = append(cases, presaleRBACCase{"customer_service", ep, false})
	}
	for _, ep := range superAdminWriteEndpoints {
		cases = append(cases, presaleRBACCase{"customer_service", ep, false})
	}

	// finance：本期无预售权限，所有接口均拒绝（B3 §2 finance 列全 ✗）
	for _, ep := range readEndpoints {
		cases = append(cases, presaleRBACCase{"finance", ep, false})
	}
	cases = append(cases, presaleRBACCase{"finance", resolveEndpoint, false})
	for _, ep := range operatorWriteEndpoints {
		cases = append(cases, presaleRBACCase{"finance", ep, false})
	}
	for _, ep := range superAdminWriteEndpoints {
		cases = append(cases, presaleRBACCase{"finance", ep, false})
	}

	// operator：读 + operator 写 + resolve；super_admin 写不可
	for _, ep := range readEndpoints {
		cases = append(cases, presaleRBACCase{"operator", ep, true})
	}
	cases = append(cases, presaleRBACCase{"operator", resolveEndpoint, true})
	for _, ep := range operatorWriteEndpoints {
		cases = append(cases, presaleRBACCase{"operator", ep, true})
	}
	for _, ep := range superAdminWriteEndpoints {
		cases = append(cases, presaleRBACCase{"operator", ep, false})
	}

	// super_admin：全部可访问
	for _, ep := range readEndpoints {
		cases = append(cases, presaleRBACCase{"super_admin", ep, true})
	}
	cases = append(cases, presaleRBACCase{"super_admin", resolveEndpoint, true})
	for _, ep := range operatorWriteEndpoints {
		cases = append(cases, presaleRBACCase{"super_admin", ep, true})
	}
	for _, ep := range superAdminWriteEndpoints {
		cases = append(cases, presaleRBACCase{"super_admin", ep, true})
	}

	// KOL 特殊返佣（REQ-004）
	// GET：四角色全可；写：super_admin only
	kolReadEp := presaleEndpoint{"GET", "/admin/presale/kol-referral"}
	kolWriteEndpoints := []presaleEndpoint{
		{"POST", "/admin/presale/kol-referral"},
		{"PATCH", "/admin/presale/kol-referral/0x1234567890123456789012345678901234567890"},
		{"DELETE", "/admin/presale/kol-referral/0x1234567890123456789012345678901234567890"},
	}
	for _, role := range []string{"customer_service", "operator", "finance", "super_admin"} {
		cases = append(cases, presaleRBACCase{role, kolReadEp, true})
	}
	cases = append(cases, presaleRBACCase{"unknown_role", kolReadEp, false})
	for _, ep := range kolWriteEndpoints {
		for _, role := range []string{"customer_service", "operator", "finance"} {
			cases = append(cases, presaleRBACCase{role, ep, false})
		}
		cases = append(cases, presaleRBACCase{"super_admin", ep, true})
		cases = append(cases, presaleRBACCase{"unknown_role", ep, false})
	}

	// unknown_role：全部拒绝
	for _, ep := range readEndpoints {
		cases = append(cases, presaleRBACCase{"unknown_role", ep, false})
	}

	for _, tc := range cases {
		tc := tc
		name := tc.role + " " + tc.endpoint.method + " " + tc.endpoint.path
		t.Run(name, func(t *testing.T) {
			w := httptest.NewRecorder()
			body := strings.NewReader(`{}`)
			req, _ := http.NewRequest(tc.endpoint.method, tc.endpoint.path, body)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Test-Role", tc.role)
			r.ServeHTTP(w, req)

			got403 := w.Code == http.StatusForbidden
			if tc.wantPass && got403 {
				t.Errorf("role=%s %s %s: got 403, expected pass (non-403)",
					tc.role, tc.endpoint.method, tc.endpoint.path)
			}
			if !tc.wantPass && !got403 {
				t.Errorf("role=%s %s %s: got %d, expected 403",
					tc.role, tc.endpoint.method, tc.endpoint.path, w.Code)
			}
		})
	}
}
