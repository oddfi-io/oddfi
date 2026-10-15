package router

import (
	"everything_finance/org/web-api/internal/handler"
)

// RegisterReferralRoutes 注册站点级邀请系统路由组 /api/v1/referral/*
// 所有接口均需 JWT 鉴权（通过 g.authMiddleware.Authenticate()）
// 限流说明（见 02-api-contract.md §5）：
//   - GET  /me：60 req/min/user
//   - GET  /list：60 req/min/user
//   - POST /bind：5 req/min/user
//
// 注意：当前 rateLimitMiddleware 为全局中间件（见 router.go），不支持 per-route 粒度限流。
// Minor：per-route 精细限流待 B4 接入 redis-based rate limiter 后补充（当前 nginx 层兜底）。
func (g *RouterGroup) RegisterReferralRoutes(h *handler.ReferralHandler) {
	referral := g.Engine.Group("/api/v1/referral")
	// JWT 鉴权中间件：所有邀请接口均需登录态
	referral.Use(g.authMiddleware.Authenticate())
	{
		referral.GET("/me", h.GetMyReferralInfo)
		referral.POST("/bind", h.BindReferral)
		referral.GET("/list", h.GetReferredList)
	}
}
