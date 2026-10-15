// Package router — 赛事风险信号灯路由注册（DD002 T04，独立函数供生产 Setup 和 RBAC 单测共用）。
package router

import (
	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/handler"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
)

// RegisterEventsRoutes 将信号灯 events / approval 路由注册到 admin 路由组。
//
// 参数：
//   - admin：已挂载鉴权中间件的 /admin 路由组
//   - sensitiveLimit：高敏接口限流中间件（risk-decision 10/min/IP，防误操作）
//   - eventsH / countsH：handler 实例（RBAC 测试可传 nil 实例，拦截在中间件层）
//
// 路由权限矩阵（DD002 §3.2，super_admin 必须显式进每行 allow——rbac.md 硬规则）：
//
//	路由                                       | 允许角色
//	-------------------------------------------|------------------------------------------
//	GET  /admin/events/risk/summary            | operator, finance, customer_service, super_admin
//	GET  /admin/events/risk/list               | 同上
//	GET  /admin/events/:event_id               | 同上
//	GET  /admin/events/:event_id/adjust-history| 同上
//	POST /admin/events/:event_id/risk-decision | operator, super_admin（finance/客服只读不可决策）
//	GET  /admin/approval/counts                | 全部四角色
//
// gin 路由说明：/risk/summary 静态段优先于 :event_id 参数段，"risk" 不会被吞进
// event_id；裸 GET /admin/events/risk 无注册 handler（行为由 events_routes_test 锁定）。
func RegisterEventsRoutes(
	admin *gin.RouterGroup,
	sensitiveLimit gin.HandlerFunc,
	eventsH *handler.EventsRiskHandler,
	countsH *handler.ApprovalCountsHandler,
) {
	// 读权限 = 四角色全开（风险列表是运营/财务/客服共同关注面板）
	readRoles := middleware.RoleRequired("customer_service", "operator", "finance", "super_admin")
	// 决策权限 = operator+（红灯人工决策是运营动作，财务/客服 403）
	decisionRoles := middleware.RoleRequired("operator", "super_admin")

	ev := admin.Group("/events")
	ev.GET("/risk/summary", readRoles, eventsH.Summary)
	ev.GET("/risk/list", readRoles, eventsH.List)
	ev.GET("/:event_id", readRoles, eventsH.Detail)
	ev.GET("/:event_id/adjust-history", readRoles, eventsH.AdjustHistory)
	// 高敏：决策写操作 = RBAC 先拦、再过 10/min 限流（与 presale 高敏接口同序）
	ev.POST("/:event_id/risk-decision", decisionRoles, sensitiveLimit, eventsH.RiskDecision)

	// 铃铛 badge 聚合：四角色全开（导航栏全局组件）
	admin.GET("/approval/counts", readRoles, countsH.Counts)
}
