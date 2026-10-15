// Package router 装配中间件、handler 并注册 Gin 路由。
//
// Setup 返回 (*gin.Engine, cleanup, error)：
//   - cleanup 必须在 main 退出前调用，关闭 Redis / MySQL 连接
//   - err 非 nil 时 main 直接 Fatal 退出
package router

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/handler"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	mysqlpkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/mysql"
	redispkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/redis"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/repository"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/service"
)

// Setup 完成依赖装配 + 路由注册。
//
// 装配顺序：MySQL → Redis → JWT → webapi client → repo → service → handler → router。
// 任一步骤失败，前面已建立的连接会按"后进先出"释放，避免泄漏。
//
// B6 改造说明（DD-003 v3.1）：
//   - presale repo/service/audit middleware 全部删除
//   - 新增 webapi client，presale handler 全部改为薄壳转发
//   - admin_users 体系（repo/handler）保持不变
func Setup(cfg *config.Config) (*gin.Engine, func(), error) {
	if cfg.Server.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}
	// 启动期连接超时：避免 DB / Redis 卡死整个进程
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	log := logger.L()

	// 1. MySQL（同步 ping）
	db, dbClose, err := mysqlpkg.New(ctx, cfg.MySQL, log)
	if err != nil {
		return nil, nil, fmt.Errorf("mysql: %w", err)
	}
	// 2. Redis
	rdb, rdbClose, err := redispkg.New(ctx, cfg.Redis, log)
	if err != nil {
		_ = dbClose()
		return nil, nil, fmt.Errorf("redis: %w", err)
	}
	// 3. JWT
	jwtSvc := jwt.New(cfg.JWT, rdb)

	// 4. webapi HTTP client（替代原 presale repo/service 层，DD-003 v3.1 B6）
	webapiClient := client.New(client.WebapiConfig{
		InternalURL:  cfg.Webapi.InternalURL,
		ServiceToken: cfg.Webapi.ServiceToken,
		TimeoutSec:   cfg.Webapi.TimeoutSec,
		MaxRetries:   cfg.Webapi.MaxRetries,
	})
	// 4b. events 模块专用 client（DD002 联调期）：
	// 信号灯先发布在 C 端 dev，presale 主上游在 C 端生产——两模块上游可独立。
	// 覆盖未配置时 EventsUpstream() 回落主上游，eventsClient 即与 webapiClient 等价配置；
	// C 端发版生产后删 WEBAPI_EVENTS_* env 重启即合流，无需改代码。
	eventsURL, eventsToken := cfg.Webapi.EventsUpstream()
	eventsClient := client.New(client.WebapiConfig{
		InternalURL:  eventsURL,
		ServiceToken: eventsToken,
		TimeoutSec:   cfg.Webapi.TimeoutSec,
		MaxRetries:   cfg.Webapi.MaxRetries,
	})

	// 5. Repository（仅保留 admin_users）
	adminRepo := repository.NewAdminUser(db)

	// 6. Service（仅保留 Lark OAuth）
	larkSvc := service.NewLarkOAuth(cfg.Lark, rdb, adminRepo, jwtSvc)

	// 7. Handler
	authH := handler.NewAuth(cfg, larkSvc, jwtSvc, adminRepo)
	adminUsersH := handler.NewAdminUsers(adminRepo)
	// presale handler 薄壳（转发给 web-api，不依赖本地 DB）
	presaleRoundH := handler.NewPresaleRound(webapiClient)
	presaleConfigH := handler.NewPresaleConfig(webapiClient)
	presaleDepositH := handler.NewPresaleDeposit(webapiClient, nil)
	presaleAnomalyH := handler.NewPresaleAnomaly(webapiClient)
	presaleAuditH := handler.NewPresaleAudit(webapiClient)
	kolReferralH := handler.NewKolReferral(webapiClient)
	// 信号灯 events / approval handler 薄壳（DD002，转发 web-api internal）
	// 用 eventsClient：联调期指 C 端 dev，覆盖删除后自动回落主上游（见 4b）
	eventsRiskH := handler.NewEventsRisk(eventsClient)
	approvalCountsH := handler.NewApprovalCounts(eventsClient)

	// 8. Gin engine + 全局中间件
	r := gin.New()
	// TrustedProxies 显式限定为 loopback
	if err := r.SetTrustedProxies([]string{"127.0.0.1/32", "::1/128"}); err != nil {
		log.Warn().Err(err).Str("module", "router").Msg("set trusted proxies")
	}
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.CORS(cfg.CORS))

	// 限流容器
	rl := middleware.NewRateLimiter(cfg.RateLimit.PerIPPerMin)
	defaultLimit := rl.Group("default", 0)
	larkAuthLimit := rl.Group("lark_auth", 10)
	presaleSensitiveLimit := rl.Group("presale_sensitive", 10)
	// 红灯人工决策高敏桶（DD002，防误操作连点）
	eventsSensitiveLimit := rl.Group("events_sensitive", 10)

	// 健康检查
	r.GET("/health", handler.Health)

	// Lark OAuth 三步
	auth := r.Group("/auth")
	{
		auth.GET("/lark/login", larkAuthLimit, authH.LarkLogin)
		auth.GET("/lark/callback", larkAuthLimit, authH.LarkCallback)
	}

	// 已登录管理员的 /auth 子路由
	adminAuth := middleware.AdminAuthMiddleware(jwtSvc)
	authProtected := r.Group("/auth", adminAuth, defaultLimit)
	{
		authProtected.GET("/me", authH.Me)
		authProtected.POST("/logout", authH.Logout)
	}

	// /admin/* 业务路由
	admin := r.Group("/admin", adminAuth, defaultLimit)
	{
		// admin-users 管理：super_admin 专属
		au := admin.Group("/admin-users", middleware.RoleRequired("super_admin"))
		au.GET("", adminUsersH.List)
		au.POST("", adminUsersH.Create)
		au.PATCH("/:lark_user_id/role", adminUsersH.UpdateRole)
		au.DELETE("/:lark_user_id", adminUsersH.Delete)

		// presale 路由：audit middleware 已移到 web-api 侧，admin-backend 仅做 note 校验 + 转发
		// noAuditMW 只校验 note ≥ 10 字符（保持前端兼容），不再开本地 DB 事务
		RegisterPresaleRoutes(admin, presaleSensitiveLimit, noteValidatorMW(),
			presaleRoundH, presaleDepositH, presaleConfigH, presaleAnomalyH, presaleAuditH, kolReferralH)

		// 信号灯 events / approval 路由（DD002）：纯 proxy，审计在 web-api 侧落库，
		// 不走 noteValidatorMW（risk-decision 用 remark 字段而非 note，校验在 handler 内）
		RegisterEventsRoutes(admin, eventsSensitiveLimit, eventsRiskH, approvalCountsH)
	}

	// cleanup 顺序：Redis 先关 → MySQL 后关
	cleanup := func() {
		if err := rdbClose(); err != nil {
			log.Warn().Err(err).Str("module", "router").Msg("redis close")
		}
		if err := dbClose(); err != nil {
			log.Warn().Err(err).Str("module", "router").Msg("mysql close")
		}
	}
	return r, cleanup, nil
}

// noteValidatorMW 是 presale 写接口的 note 校验中间件（替代原 PresaleAudit middleware）。
//
// 职责缩减（B6 改造）：
//   - 原 PresaleAudit：开 DB 事务 + note 校验 + audit INSERT + 事务 Commit/Rollback
//   - 现在：只做 note 校验（≥10 字符），不开事务，audit 已移至 web-api 侧
//
// GET/HEAD/OPTIONS 请求跳过（只读接口无需 note）。
func noteValidatorMW() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// ShouldBindBodyWith 将 body 缓存到 gin.BodyBytesKey，后续 handler 可重复读
		var peek struct {
			Note string `json:"note"`
		}
		if err := c.ShouldBindBodyWith(&peek, binding.JSON); err != nil {
			c.AbortWithStatusJSON(400, gin.H{
				"code":    "INVALID_PARAM",
				"message": "request body must be valid JSON: " + err.Error(),
				"data":    nil,
			})
			return
		}
		if len([]rune(peek.Note)) < 10 {
			c.AbortWithStatusJSON(400, gin.H{
				"code":    "NOTE_REQUIRED",
				"message": "note must be at least 10 characters",
				"data":    nil,
			})
			return
		}
		c.Next()
	}
}
