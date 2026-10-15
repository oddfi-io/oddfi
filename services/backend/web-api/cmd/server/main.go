package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/handler"
	adminhandler "everything_finance/org/web-api/internal/handler/admin"
	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/pkg/jwt"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/pkg/mysql"
	"everything_finance/org/web-api/internal/pkg/redis"
	"everything_finance/org/web-api/internal/pkg/snowflake"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/router"
	"everything_finance/org/web-api/internal/service"
)

// @title Oddfi Account Web API
// @version 1.0
// @description Oddfi 钱包登录、资产、下注、提现、后台订单和行情价格相关接口文档。
// @BasePath /
// @schemes http https
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description JWT 鉴权头格式：Bearer <access_token>
func main() {
	logger.Init("info", true)
	cfg := config.LoadDefault()

	// TODO-018：禁止 dump 整个 *cfg —— 含 RDS 密码 / JWT secret / Lark webhook URL / HMAC token 等敏感字段。
	// 只打非敏感字段（host/port/库名/枚举值/计数），需要完整 config 时改 cat config_prod.yaml。
	logger.Infof("[main] startup env=%s server=%s:%d mode=%s db=%s@%s/%s redis=%s:%d vault_count=%d lark_configured=%v",
		cfg.Server.Env, cfg.Server.Host, cfg.Server.Port, cfg.Server.Mode,
		cfg.Database.Username, cfg.Database.Host, cfg.Database.DBName,
		cfg.Redis.Host, cfg.Redis.Port,
		len(cfg.Presale.VaultPool),
		cfg.Presale.LarkWebhookUrl != "")

	mysql.Init(cfg.Database)
	mysql.InitGORM(cfg.Database)
	logger.Info("database connected successfully")
	snowflake.Init(1)
	logger.Info("snowflake init successfully")

	redis.Init(cfg.Redis)
	logger.Info("redis connected successfully")
	jwt.Init(cfg.JWT.Secret)
	logger.Info("jwt init successfully")
	middleware.Init(cfg.RateLimit)

	userRepo := repository.NewUserRepo(mysql.GetMySQL(), redis.GetRedis())
	tokenRepo := repository.NewTokenRepo(redis.GetRedis())
	walletSessionRepo := repository.NewWalletSessionRepo(redis.GetRedis())
	marketRepo := repository.NewMarketRepo(redis.GetRedis())

	authService := service.NewAuthService(userRepo, tokenRepo, walletSessionRepo, cfg)
	userService := service.NewUserService(userRepo)
	marketService := service.NewMarketService(marketRepo)

	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userService)
	marketHandler := handler.NewMarketHandler(marketService)

	// ─────────────────────────────────────────────────────────────────────────
	// 预售模块（presale + referral）门控：零配置即禁用
	// 触发条件：cfg.Presale.VaultPool 为空 → 整个模块跳过装配 + 不挂 referral hook
	//          + 不注册 /api/v1/presale/* 与 /api/v1/referral/* 路由
	// 设计意图：dev 分支同步预售代码后部署到 testnet 服务器，仅需不配 PRESALE_VAULT_POOL
	//          即可保证 testnet 不执行预售业务；生产服务器配齐 env 后自动启用。
	// ─────────────────────────────────────────────────────────────────────────
	presaleEnabled := len(cfg.Presale.VaultPool) > 0
	logger.Infof("[main] presale module enabled=%v (vault_pool_count=%d)", presaleEnabled, len(cfg.Presale.VaultPool))

	var (
		referralService service.ReferralService
		referralHandler *handler.ReferralHandler
		presaleHandler  *handler.PresaleHandler
		// REQ-004：KOL 自定义返佣 repo，跨 presale / admin internal 两个 if 块共用
		kolReferralRepo repository.KolReferralPctRepository
	)

	if presaleEnabled {
		// B1：邀请系统 repository
		referralCodeRepo := repository.NewUserReferralCodeRepo(mysql.GetGORM())
		referralBindRepo := repository.NewUserReferralBindRepo(mysql.GetGORM())
		presaleHoldingRepo := repository.NewPresaleHoldingRepo(mysql.GetGORM())
		presaleDepositRepo := repository.NewPresaleDepositRepo(mysql.GetGORM())

		// B2：预售模块 repository
		presaleConfigRepo := repository.NewPresaleConfigRepo(mysql.GetGORM())
		presaleRoundRepo := repository.NewPresaleRoundRepo(mysql.GetGORM())
		presaleOpsEventRepo := repository.NewPresaleOpsEventRepo(mysql.GetGORM())

		// B1：邀请系统 service + handler
		referralService = service.NewReferralService(referralCodeRepo, referralBindRepo, presaleHoldingRepo, presaleDepositRepo)
		referralHandler = handler.NewReferralHandler(referralService)

		// B2：预售模块 service + handler
		// BscClient 传 nil → 若 cfg.Presale.BscRpcUrl 未配则保持 nil（ReportTx 调用时若需链上校验才会 nil panic）
		// web-api 服务不强制 BSC RPC（监听由 presale-worker 进程独立管理）
		presaleConfigService := service.NewPresaleConfigService(presaleConfigRepo, presaleRoundRepo, redis.GetRedis().GetRedisClient(), cfg.Presale.UsdtAddress)

		// B4 / TODO-016：构造 LarkWebhookService。
		// 总是用 WithRepo 版本启用 DB lazy fetch（30s cache）— admin 改 presale_config.lark_webhook_url
		// 后秒级生效。cfg.Presale.LarkWebhookUrl（yaml/env）作为 DB 拉失败时的 fallback。
		// 即使 yaml/env 都空也用 WithRepo — DB 里有值就能跑起来，否则首次 Notify 时降级 skip。
		larkAlerter := service.AnomalyAlerter(service.NewLarkWebhookServiceWithRepo(cfg.Presale.LarkWebhookUrl, presaleConfigRepo))
		// REV-007 m1：装配日志脱敏 webhook URL，避免 secret token 落到 prod docker logs
		if cfg.Presale.LarkWebhookUrl != "" {
			logger.Infof("[main] LarkWebhookService initialized fallback_url=%s + DB lazy fetch",
				service.MaskLarkWebhookURL(cfg.Presale.LarkWebhookUrl))
		} else {
			logger.Info("[main] LarkWebhookService initialized (fallback empty, rely on DB lazy fetch)")
		}

		// REQ-004：KOL 自定义返佣 repo，注入 ReportTx 路径让落 deposit 时按 referrer_eoa 命中覆盖轮次比例
		kolReferralRepo = repository.NewKolReferralPctRepository(mysql.GetGORM())

		presaleDepositService := service.NewPresaleDepositService(
			&cfg.Presale, mysql.GetGORM(),
			presaleDepositRepo, presaleRoundRepo, presaleHoldingRepo,
			presaleOpsEventRepo, referralBindRepo,
			kolReferralRepo,    // REQ-004：未配置 KOL 时 GetByEoa 返 ErrKolNotFound，service 自动 fallback 轮次比例
			redis.GetRedis(),
			nil,         // bscClient: 启动时不连，调 ReportTx 时按需 lazy（或运维配 BscRpcUrl 让构造时连）
			larkAlerter, // B4: 注入真实 Lark 告警（URL 为空时为 noop）
		)
		presaleHandler = handler.NewPresaleHandler(presaleConfigService, presaleDepositService)
	} else {
		logger.Info("[main] presale module DISABLED — /api/v1/presale/* and /api/v1/referral/* routes not registered, referral hook not attached")
	}

	jwtMgr := jwt.GetJWTManager()
	authMiddleware := middleware.NewAuthMiddleware(jwtMgr, tokenRepo)
	if presaleEnabled {
		// B1：注入邀请服务到 authMiddleware，启用首次登录自动生成邀请码 hook（异步，不阻断鉴权）
		authMiddleware = authMiddleware.WithReferralService(referralService)
	}
	rateLimitMiddleware := middleware.NewRateLimitMiddleware(middleware.GetRateLimiter())

	// router.Setup 接受 referralHandler/presaleHandler 可能为 nil（presale 禁用时跳过路由注册）
	r := router.Setup(authHandler, userHandler, authMiddleware, rateLimitMiddleware, marketHandler, referralHandler, presaleHandler)

	// 公网 listener（DD-003 §3.1：8080 用户接口、health、legacy admin）
	publicSrv := &http.Server{
		Addr:         cfg.Server.Addr(),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Infof("public server starting on %s", cfg.Server.Addr())
		if err := publicSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("failed to start public server: %v", err)
		}
	}()

	// ─────────────────────────────────────────────────────────────────────────
	// Internal listener — admin /internal/admin/* RPC endpoint（DD-003 v3.1）
	// 启用门控：cfg.AdminAPI.Enabled() = InternalPort > 0 && ServiceTokens 非空 && JWTSecret ≥ 32
	// 部署模型：绑 127.0.0.1:InternalPort（仅 loopback），Nginx admin-api.oddfi.io vhost 反代过来
	// 公网 :8080 不挂任何 internal handler，物理隔离
	// ─────────────────────────────────────────────────────────────────────────
	var internalSrv *http.Server
	if cfg.AdminAPI.Enabled() && presaleEnabled {
		auditRepo := repository.NewPresaleAdminAuditRepository(mysql.GetGORM())
		idemRepo := repository.NewAdminIdempotencyRepository(mysql.GetGORM())

		// B5：装配真实 admin service + handler
		adminRoundRepo := repository.NewAdminPresaleRoundRepo(mysql.GetGORM())
		adminDepositRepo := repository.NewAdminPresaleDepositRepo(mysql.GetGORM())
		adminOpsEventRepo := repository.NewAdminPresaleOpsEventRepo(mysql.GetGORM())
		adminConfigRepo := repository.NewAdminPresaleConfigRepo(mysql.GetGORM())
		presaleConfigRepo2 := repository.NewPresaleConfigRepo(mysql.GetGORM())
		presaleHoldingRepo2 := repository.NewPresaleHoldingRepo(mysql.GetGORM())

		adminRoundSvc := service.NewPresaleAdminRoundService(adminRoundRepo)
		adminConfigSvc := service.NewPresaleAdminConfigService(presaleConfigRepo2, adminConfigRepo)
		adminDepositSvc := service.NewPresaleAdminDepositService(adminDepositRepo, adminRoundRepo, presaleHoldingRepo2, auditRepo)
		adminAnomalySvc := service.NewPresaleAdminAnomalyService(adminOpsEventRepo, adminDepositRepo, adminRoundRepo, presaleHoldingRepo2)

		roundH := adminhandler.NewRoundHandler(adminRoundSvc)
		depositH := adminhandler.NewDepositHandler(adminDepositSvc, adminConfigSvc)
		configH := adminhandler.NewConfigHandler(adminConfigSvc)
		anomalyH := adminhandler.NewAnomalyHandler(adminAnomalySvc)
		auditH := adminhandler.NewAuditHandler(auditRepo)
		// REQ-004：KOL 自定义返佣 CRUD handler；与 ReportTx 路径共用同一 repo
		kolReferralH := adminhandler.NewKolReferralHandler(kolReferralRepo)

		internalRouter := router.SetupInternal(router.InternalRouterDeps{
			DB:           mysql.GetGORM(),
			AuditRepo:    auditRepo,
			IdemRepo:     idemRepo,
			AdminAPI:     cfg.AdminAPI,
			RoundH:       roundH,
			DepositH:     depositH,
			ConfigH:      configH,
			AnomalyH:     anomalyH,
			AuditH:       auditH,
			KolReferralH: kolReferralH,
		})

		internalAddr := fmt.Sprintf("127.0.0.1:%d", cfg.AdminAPI.InternalPort)
		internalSrv = &http.Server{
			Addr:         internalAddr,
			Handler:      internalRouter,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		}
		go func() {
			logger.Infof("[main] internal admin server starting on %s (loopback only)", internalAddr)
			if err := internalSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				logger.Errorf("[main] internal server failed: %v", err)
			}
		}()
	} else {
		logger.Infof("[main] admin internal endpoint DISABLED (admin_api.enabled=%v, presale=%v)", cfg.AdminAPI.Enabled(), presaleEnabled)
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("shutting down servers...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := publicSrv.Shutdown(ctx); err != nil {
		logger.Errorf("public server shutdown error: %v", err)
	}
	if internalSrv != nil {
		if err := internalSrv.Shutdown(ctx); err != nil {
			logger.Errorf("internal server shutdown error: %v", err)
		}
	}

	logger.Info("servers exited gracefully")

	mysql.GetMySQL().Close()
	redis.GetRedis().Close()
}
