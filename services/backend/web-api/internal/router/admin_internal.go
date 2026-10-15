// Package router — admin internal endpoint 路由（DD-003 v3.1 §4 §5）。
//
// 关键设计：
//   - 单独 *gin.Engine 实例，与公网 router 完全隔离
//   - 物理隔离：main.go 把这个 engine 绑到 127.0.0.1:8081 loopback listener
//   - middleware 栈：ServiceAuth → AdminJWT → AdminAudit → Idempotency → handler
//   - 17 routes 镜像 admin-backend 现有 RBAC 矩阵（但 RBAC 校验在 admin-backend 完成，
//     web-api 只信任 admin JWT 透传的 verified operator role）
package router

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/config"
	adminhandler "everything_finance/org/web-api/internal/handler/admin"
	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/repository"
)

// InternalRouterDeps 是 SetupInternal 的依赖注入。
type InternalRouterDeps struct {
	DB        *gorm.DB
	AuditRepo repository.PresaleAdminAuditRepository
	IdemRepo  repository.AdminIdempotencyRepository
	AdminAPI  config.AdminAPIConfig

	// internal handler 集合；任意为 nil 时该组路由用 stub 占位（B4 单测用）
	RoundH       *adminhandler.RoundHandler
	DepositH     *adminhandler.DepositHandler
	ConfigH      *adminhandler.ConfigHandler
	AnomalyH     *adminhandler.AnomalyHandler
	AuditH       *adminhandler.AuditHandler
	KolReferralH *adminhandler.KolReferralHandler
}

// SetupInternal 装配 /internal/admin/* 路由组并返回独立的 gin.Engine。
//
// 此 engine 只挂内部路由，公网 :8080 不会装它。
// caller（main.go）负责把 engine 绑到 127.0.0.1:cfg.AdminAPI.InternalPort 上 listen。
func SetupInternal(deps InternalRouterDeps) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.Logger())

	// /health 双挂便于探活
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "scope": "internal"})
	})

	// /internal/admin/* 受三层 middleware 保护
	hmacWindow := deps.AdminAPI.HMACWindowMs
	if hmacWindow <= 0 {
		hmacWindow = 60_000
	}
	ttlDays := deps.AdminAPI.IdempotencyTTLDays
	if ttlDays <= 0 {
		ttlDays = 90
	}

	internal := r.Group("/internal/admin",
		middleware.ServiceAuth(middleware.ServiceAuthConfig{
			Secrets:  deps.AdminAPI.ServiceTokens,
			WindowMs: hmacWindow,
		}),
		middleware.AdminJWT(middleware.AdminJWTConfig{
			Secret: deps.AdminAPI.JWTSecret,
		}),
	)

	// 写操作走 admin_audit + idempotency middleware（同 tx 三写原子）
	auditMW := middleware.AdminAudit(middleware.AdminAuditConfig{
		DB:        deps.DB,
		AuditRepo: deps.AuditRepo,
	})
	idemMW := middleware.Idempotency(middleware.IdempotencyConfig{
		IdemRepo: deps.IdemRepo,
		TTL:      time.Duration(ttlDays) * 24 * time.Hour,
	})

	registerPresaleInternalRoutes(internal, auditMW, idemMW, deps)

	return r
}

// registerPresaleInternalRoutes 注册 17 个 /internal/admin/presale/* 路由。
//
// 每个 handler 通过 exported wrapper 方法（ListHandler / PauseHandler 等）取得 gin.HandlerFunc。
// 若 deps 的某 handler 为 nil → 走 stub（B4 测试场景）。
func registerPresaleInternalRoutes(
	g *gin.RouterGroup,
	auditMW gin.HandlerFunc,
	idemMW gin.HandlerFunc,
	deps InternalRouterDeps,
) {
	ps := g.Group("/presale")

	// 取得真实 handler 或 stub
	roundList := stubOrReal(deps.RoundH, func(h *adminhandler.RoundHandler) gin.HandlerFunc { return h.ListHandler() }, stubRead("round"))
	roundGet := stubOrReal(deps.RoundH, func(h *adminhandler.RoundHandler) gin.HandlerFunc { return h.GetHandler() }, stubRead("round"))
	roundPause := stubOrReal(deps.RoundH, func(h *adminhandler.RoundHandler) gin.HandlerFunc { return h.PauseHandler() }, stubMutate("pause", "round"))
	roundResume := stubOrReal(deps.RoundH, func(h *adminhandler.RoundHandler) gin.HandlerFunc { return h.ResumeHandler() }, stubMutate("resume", "round"))
	roundReopen := stubOrReal(deps.RoundH, func(h *adminhandler.RoundHandler) gin.HandlerFunc { return h.ReopenHandler() }, stubMutate("reopen", "round"))
	roundClose := stubOrReal(deps.RoundH, func(h *adminhandler.RoundHandler) gin.HandlerFunc { return h.CloseHandler() }, stubMutate("close", "round"))
	roundReferralPct := stubOrReal(deps.RoundH, func(h *adminhandler.RoundHandler) gin.HandlerFunc { return h.UpdateReferralPctHandler() }, stubMutate("update_referral_pct", "round"))
	roundUpdate := stubOrReal(deps.RoundH, func(h *adminhandler.RoundHandler) gin.HandlerFunc { return h.UpdateRoundHandler() }, stubMutate("update_round", "round"))

	depositList := stubOrReal(deps.DepositH, func(h *adminhandler.DepositHandler) gin.HandlerFunc { return h.ListHandler() }, stubRead("deposit"))
	depositGet := stubOrReal(deps.DepositH, func(h *adminhandler.DepositHandler) gin.HandlerFunc { return h.GetHandler() }, stubRead("deposit"))
	depositMigrate := stubOrReal(deps.DepositH, func(h *adminhandler.DepositHandler) gin.HandlerFunc { return h.MigrateRoundHandler() }, stubMutate("migrate_round", "deposit"))

	cfgGet := stubOrReal(deps.ConfigH, func(h *adminhandler.ConfigHandler) gin.HandlerFunc { return h.GetHandler() }, stubRead("config"))
	cfgUpdate := stubOrReal(deps.ConfigH, func(h *adminhandler.ConfigHandler) gin.HandlerFunc { return h.UpdateHandler() }, stubMutate("update_config", "config"))

	anomalyList := stubOrReal(deps.AnomalyH, func(h *adminhandler.AnomalyHandler) gin.HandlerFunc { return h.ListHandler() }, stubRead("anomaly"))
	anomalyGet := stubOrReal(deps.AnomalyH, func(h *adminhandler.AnomalyHandler) gin.HandlerFunc { return h.GetHandler() }, stubRead("anomaly"))
	anomalyResolve := stubOrReal(deps.AnomalyH, func(h *adminhandler.AnomalyHandler) gin.HandlerFunc { return h.ResolveHandler() }, stubMutate("anomaly_resolve", "anomaly"))

	auditList := stubOrReal(deps.AuditH, func(h *adminhandler.AuditHandler) gin.HandlerFunc { return h.ListHandler() }, stubRead("audit"))

	kolList := stubOrReal(deps.KolReferralH, func(h *adminhandler.KolReferralHandler) gin.HandlerFunc { return h.ListHandler() }, stubRead("kol_referral"))
	kolCreate := stubOrReal(deps.KolReferralH, func(h *adminhandler.KolReferralHandler) gin.HandlerFunc { return h.CreateHandler() }, stubMutate("kol_referral_upsert", "kol_referral"))
	kolUpdate := stubOrReal(deps.KolReferralH, func(h *adminhandler.KolReferralHandler) gin.HandlerFunc { return h.UpdateHandler() }, stubMutate("kol_referral_update", "kol_referral"))
	kolDelete := stubOrReal(deps.KolReferralH, func(h *adminhandler.KolReferralHandler) gin.HandlerFunc { return h.DeleteHandler() }, stubMutate("kol_referral_delete", "kol_referral"))

	// 轮次管理（5 read + 3 mutate）
	ps.GET("/rounds", roundList)
	ps.GET("/rounds/:id", roundGet)
	ps.POST("/rounds/:id/pause", auditMW, idemMW, roundPause)
	ps.POST("/rounds/:id/resume", auditMW, idemMW, roundResume)
	ps.POST("/rounds/:id/reopen", auditMW, idemMW, roundReopen)
	ps.POST("/rounds/:id/close", auditMW, idemMW, roundClose)
	ps.PATCH("/rounds/:id/referral-pct", auditMW, idemMW, roundReferralPct)
	ps.PATCH("/rounds/:id", auditMW, idemMW, roundUpdate)

	// 入账管理（2 read + 1 mutate）
	ps.GET("/deposits", depositList)
	ps.GET("/deposits/:txHash", depositGet)
	ps.POST("/deposits/:txHash/migrate-round", auditMW, idemMW, depositMigrate)

	// 全局配置（1 read + 1 mutate）
	ps.GET("/config", cfgGet)
	ps.PATCH("/config", auditMW, idemMW, cfgUpdate)

	// 异常事件（2 read + 1 mutate）
	ps.GET("/anomaly", anomalyList)
	ps.GET("/anomaly/:id", anomalyGet)
	ps.POST("/anomaly/:id/resolve", auditMW, idemMW, anomalyResolve)

	// 操作审计（1 read）
	ps.GET("/audit", auditList)

	// KOL 自定义返佣（REQ-004，1 read + 3 mutate）
	// RBAC 在 admin-backend proxy 层完成（Step 1 已实现），web-api 只信任 JWT 透传 operator/role。
	ps.GET("/kol-referral", kolList)
	ps.POST("/kol-referral", auditMW, idemMW, kolCreate)
	ps.PATCH("/kol-referral/:eoa", auditMW, idemMW, kolUpdate)
	ps.DELETE("/kol-referral/:eoa", auditMW, idemMW, kolDelete)
}

// stubOrReal 是泛型 helper：handler 非 nil 返真实 gin.HandlerFunc；nil 返 stub。
func stubOrReal[T any](h *T, real func(*T) gin.HandlerFunc, stub gin.HandlerFunc) gin.HandlerFunc {
	if h == nil {
		return stub
	}
	return real(h)
}

// stubRead 占位只读 handler（B4 测试用）。
func stubRead(targetType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"stub": true, "targetType": targetType, "items": []any{}})
	}
}

// stubMutate 占位写 handler（B4 测试用）：设置 audit ctx 字段 + 返 200，让 middleware 栈走完。
func stubMutate(action, targetType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(middleware.CtxAuditAction, action)
		c.Set(middleware.CtxAuditTargetType, targetType)
		c.Set(middleware.CtxAuditTargetID, c.Param("id")+c.Param("txHash"))
		c.JSON(http.StatusOK, gin.H{"ok": true, "stub": true, "action": action})
	}
}
