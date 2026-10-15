package router

import (
	"everything_finance/org/web-api/internal/handler"
)

// RegisterPresaleRoutes 注册预售模块路由组 /api/v1/presale/*
//
// 路由鉴权策略（对齐 02-api-contract.md §1 鉴权列）：
//   - GET  /config            公开（无 JWT），首屏高频缓存接口
//   - POST /deposit/report-tx JWT，前端上报 txHash
//   - GET  /deposit/list      JWT，入账历史分页
//   - GET  /deposit/:txHash   JWT，单笔状态轮询
//   - GET  /position          JWT，持仓聚合
//
// 限流说明（见 02-api-contract.md §5）：当前为 nginx 层 + 全局 rateLimitMiddleware 兜底。
// per-route 精细限流待 B4 接入 redis-based rate limiter 后补充。
//
// 注意路由注册顺序：/deposit/list 必须在 /deposit/:txHash 之前注册，
// 否则 Gin 会把 "list" 当成 txHash 路径参数。
func (g *RouterGroup) RegisterPresaleRoutes(h *handler.PresaleHandler) {
	presale := g.Engine.Group("/api/v1/presale")
	{
		// 公开接口：不挂 JWT 中间件
		presale.GET("/config", h.GetConfig)

		// JWT 保护的入账接口
		deposit := presale.Group("/deposit")
		deposit.Use(g.authMiddleware.Authenticate())
		{
			deposit.POST("/report-tx", h.ReportTx)
			// /list 必须先于 /:txHash 注册，防止 Gin 路由歧义
			deposit.GET("/list", h.ListDeposits)
			deposit.GET("/:txHash", h.GetDepositByTxHash)
		}

		// JWT 保护的持仓接口
		presale.GET("/position", g.authMiddleware.Authenticate(), h.GetPosition)
	}
}
