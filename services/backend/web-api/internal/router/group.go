package router

import (
	"everything_finance/org/web-api/internal/handler"
	"everything_finance/org/web-api/internal/middleware"

	"github.com/gin-gonic/gin"
)

type RouterGroup struct {
	Engine         *gin.Engine
	authMiddleware *middleware.AuthMiddleware
}

func New(r *gin.Engine, authMiddleware *middleware.AuthMiddleware) *RouterGroup {
	return &RouterGroup{Engine: r, authMiddleware: authMiddleware}
}

func (g *RouterGroup) RegisterAccountRoutes(h *handler.AuthHandler) {
	account := g.Engine.Group("/account")
	{
		account.POST("/login_by_wallet", h.LoginByWallet)
		account.POST("/refresh_access_token_by_refresh", h.RefreshAccessTokenByRefresh)
		account.POST("/logout", h.Logout)

		account.GET("/balance", g.authMiddleware.Authenticate(), h.GetBalance)
		account.GET("/deposit_address", g.authMiddleware.Authenticate(), h.GetUserDepositAddress)
		account.GET("/asset_ledger", g.authMiddleware.Authenticate(), h.GetAssetLedger)
		account.GET("/portfolio/history", g.authMiddleware.Authenticate(), h.GetHistory)

		account.POST("/withdraw/get_record_info", g.authMiddleware.Authenticate(), h.GetRecordByOrderSns)
		account.POST("/withdraw/apply", g.authMiddleware.Authenticate(), h.WithDrawApply)
		account.GET("/withdraw/fee", g.authMiddleware.Authenticate(), h.GetWithdrawFee)
		account.GET("/withdraw/get_record", g.authMiddleware.Authenticate(), h.GetWithDrawRecord)
		account.POST("/withdraw/cancel", g.authMiddleware.Authenticate(), h.WithDrawStatusCancel)

		// 线上接口 by@remy
		account.POST("/bet_place", g.authMiddleware.Authenticate(), h.BetPlace)    // 用户下注接口
		account.POST("/bet_cancel", g.authMiddleware.Authenticate(), h.BetCancle)  // 用户撤单接口
		account.GET("/bet_holding", g.authMiddleware.Authenticate(), h.BetHolding) // 用户持仓接口
		account.POST("/bet_claim", g.authMiddleware.Authenticate(), h.BetClaim)    // 领取接口

		// 新增的下注接口，具体逻辑要参考需求文档
		account.POST("/banner_bet_place", g.authMiddleware.Authenticate(), h.BannerBetPlace)    // 首页 banner 下注接口
		account.GET("/banner_bet_holding", g.authMiddleware.Authenticate(), h.BannerBetHolding) // 首页 banner 下注记录查询接口
	}
}

func (g *RouterGroup) RegisterMarketRoutes(h *handler.MarketHandler) {
	market := g.Engine.Group("/market")
	{
		market.GET("/price", h.GetPrice)
	}
}
