// Command server 是 oddfi-admin-backend 的启动入口。
//
// 启动顺序：logger -> config -> mysql -> redis -> 装配 service/handler/router -> 监听 HTTP。
// 收到 SIGINT/SIGTERM 后进入优雅退出：30s 内关闭 HTTP，再依次关闭 Redis/MySQL。
//
// 详细架构见根目录 ARCHITECTURE.md。
package main

import (
	"context"
	"errors"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/router"
)

func main() {
	// 1. 初始化全局 logger（zerolog），pretty 输出由 config.logger.pretty 控制
	logger.Init()

	// 解析配置路径：systemd 单元在 /var/lib/oddfi-admin 工作目录下跑，
	// 必须显式指向 /etc/oddfi-admin/config.yaml，本地 dev 沿用默认值
	configPath := flag.String("config", "./config.yaml", "path to config.yaml")
	flag.Parse()

	// 2. 读取配置（env 覆盖敏感字段）
	cfg, err := config.Load(*configPath)
	if err != nil {
		logger.L().Fatal().Err(err).Msg("load config failed")
	}
	logger.Reconfigure(cfg.Logger.Level, cfg.Logger.Pretty)

	// 3. 装配路由（middleware + handler）。
	//    MySQL / Redis / JWT / Lark OAuth 的初始化在 router.Setup 内部完成，
	//    这样 main 保持极简，便于 e2e 测试场景注入 mock。
	r, cleanup, err := router.Setup(cfg)
	if err != nil {
		logger.L().Fatal().Err(err).Msg("setup router failed")
	}
	defer cleanup()

	// 4. 启动 HTTP server
	// cfg.Server.Host 空 → 监听所有接口（dev）；prod 应配 127.0.0.1
	srv := &http.Server{
		Addr:         cfg.Server.Host + ":" + cfg.Server.Port,
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		logger.L().Info().Str("addr", srv.Addr).Str("env", cfg.Server.Env).Msg("admin server listening")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.L().Fatal().Err(err).Msg("server listen failed")
		}
	}()

	// 5. 优雅退出
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.L().Info().Msg("shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.L().Error().Err(err).Msg("graceful shutdown failed")
	}
	logger.L().Info().Msg("server exited")
}
