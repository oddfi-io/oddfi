package handler_test

// presale_nop_test.go — RBAC 测试用的 nop handler 工厂函数。
//
// 这些函数构造持有 nil service 的 handler 实例。
// RBAC test 只关心 RBAC 中间件是否返回 403，不会触达真正的 handler 业务逻辑：
//   - 被拒绝的请求：RBAC 中间件在 handler 之前返回 403，handler 不执行
//   - 被放行的请求：noopAuditMW 直接 c.Next()，handler 执行但 service 调用会 panic/nil
//     → 为避免 panic，注入一个恒返回 200 的覆盖 handler（见 buildPresaleRBACRouter）
//
// 实际上 buildPresaleRBACRouter 传入的 nopXxxH 是通过下面的包装函数构造的，
// 这些函数返回真实类型但 handler 方法被 gin nop 覆盖（通过 gin.WrapF 技巧无法做到）。
// 因此改用最简方案：直接用 nil service 构造，但在 noopAuditMW 之后注入覆盖 handler。
//
// 最终方案：buildPresaleRBACRouter 不使用真实 handler 实例的方法，
// 而是让 gin 路由上的 final handler 直接是 nop func，通过 gin.HandlerFunc 覆盖。
// 这通过在 router.RegisterPresaleRoutes 后，利用 gin 的路由信息验证 RBAC 层。
//
// 实现：用 nil-safe 构造函数，构造出合法实例，实际方法调用会因 nil svc 而 500，
// 但 RBAC test 对"通过"的判断是"非 403"，500 同样满足。

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/handler"
)

// newNopRoundHandler 构造一个 nil service 的 PresaleRoundHandler。
// RBAC 通过后 handler 会因 nil svc panic，通过 gin.Recovery() 恢复为 500，
// 测试断言只检查"非 403"，500 符合预期。
// 对于真正被 RBAC 拦截的请求，handler 不执行，直接返回 403。
func newNopRoundHandler(_ gin.HandlerFunc) *handler.PresaleRoundHandler {
	return handler.NewPresaleRound(nil)
}

func newNopDepositHandler(_ gin.HandlerFunc) *handler.PresaleDepositHandler {
	return handler.NewPresaleDeposit(nil, nil)
}

func newNopConfigHandler(_ gin.HandlerFunc) *handler.PresaleConfigHandler {
	return handler.NewPresaleConfig(nil)
}

func newNopAnomalyHandler(_ gin.HandlerFunc) *handler.PresaleAnomalyHandler {
	return handler.NewPresaleAnomaly(nil)
}

func newNopAuditHandler(_ gin.HandlerFunc) *handler.PresaleAuditHandler {
	return handler.NewPresaleAudit(nil)
}

// nopHandlerFunc 是一个简单的 200 handler，用于验证 RBAC 通过后能正常响应。
// 配合 gin.Recovery()，即使 nil-svc handler panic 也会恢复为 500（同样"非 403"）。
var nopHandlerFunc gin.HandlerFunc = func(c *gin.Context) {
	c.Status(http.StatusOK)
}
