package handler

import (
	"chain_crawler/internal/repository"
	"context"

	"chain_crawler/internal/config"
	"chain_crawler/internal/monitor"
	"chain_crawler/internal/pkg/response"
	"chain_crawler/pkg/middleware"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Handler interface {
	GetRouter() *gin.Engine
}

func NewHandler(ctx context.Context, cfg config.Config) Handler {
	gin.SetMode(gin.ReleaseMode)
	return &handlerImpl{
		GinReplier: response.NewGinReplier(),
		cfg:        cfg,
		repository: repository.NewRepository(ctx, cfg),
	}
}

type handlerImpl struct {
	cfg config.Config
	response.GinReplier
	repository repository.Repository
}

func (h *handlerImpl) GetRouter() *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())

	// 日志中间件（从ctx中获取trace信息注入到logger）
	router.Use(middleware.LoggerWithTraceID())

	promHandler := promhttp.HandlerFor(
		monitor.Registry,
		promhttp.HandlerOpts{
			EnableOpenMetrics: true,
		})
	router.Any("/web3-chaincrawler/metrics", func(ctx *gin.Context) {
		promHandler.ServeHTTP(ctx.Writer, ctx.Request)
	})
	router.POST("/web3-chaincrawler/backward", h.BackwardChain)

	return router
}
