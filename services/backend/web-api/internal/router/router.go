package router

import (
	"everything_finance/org/web-api/internal/handler"
	"everything_finance/org/web-api/internal/middleware"

	"github.com/gin-gonic/gin"
)

func Setup(
	authHandler *handler.AuthHandler,
	userHandler *handler.UserHandler,
	authMiddleware *middleware.AuthMiddleware,
	rateLimitMiddleware *middleware.RateLimitMiddleware,
	marketService *handler.MarketHandler,
	referralHandler *handler.ReferralHandler,
	presaleHandler *handler.PresaleHandler,
) *gin.Engine {
	r := gin.New()

	r.Use(gin.Recovery())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())

	if rateLimitMiddleware != nil {
		r.Use(rateLimitMiddleware.RateLimit())
	}

	RegisterHealthRoutes(r)

	g := New(r, authMiddleware)
	g.RegisterAdminRoutes(r, userHandler)
	g.RegisterAccountRoutes(authHandler)
	g.RegisterMarketRoutes(marketService)
	// 预售模块零配置即禁用：main.go 检测 cfg.Presale.VaultPool 为空时传 nil handler，
	// router 这里跳过路由注册，testnet/dev 服务器无需建表也能正常启动
	if referralHandler != nil {
		// B1：注册站点级邀请系统路由 /api/v1/referral/*
		g.RegisterReferralRoutes(referralHandler)
	}
	if presaleHandler != nil {
		// B2：注册预售模块路由 /api/v1/presale/*
		g.RegisterPresaleRoutes(presaleHandler)
	}

	return r
}
