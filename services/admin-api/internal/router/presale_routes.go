// Package router — presale 路由注册（独立函数，供生产 Setup 和 RBAC 单测共用）。
package router

import (
	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/handler"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
)

// RegisterPresaleRoutes 将所有 presale 路由注册到 admin 路由组。
//
// 参数：
//   - admin：已挂载鉴权中间件的 /admin 路由组
//   - sensitiveLimit：高敏接口限流中间件（10/min/IP）
//   - auditMW：presale 审计中间件（开事务 + 写 audit 记录）
//   - 各 handler 实例（可传 nil 占位，RBAC 测试时用 nopHandler 替代）
//
// 路由权限矩阵（B3 §2）：
//
//	角色            | 读  | operator 写 | super_admin 写
//	----------------|-----|------------|---------------
//	customer_service|  ✓  |     ✗      |      ✗
//	operator        |  ✓  |     ✓      |      ✗
//	super_admin     |  ✓  |     ✓      |      ✓
//	finance         |  ✗  |     ✗      |      ✗  （本期无预售权限）
func RegisterPresaleRoutes(
	admin *gin.RouterGroup,
	sensitiveLimit gin.HandlerFunc,
	auditMW gin.HandlerFunc,
	roundH *handler.PresaleRoundHandler,
	depositH *handler.PresaleDepositHandler,
	configH *handler.PresaleConfigHandler,
	anomalyH *handler.PresaleAnomalyHandler,
	auditH *handler.PresaleAuditHandler,
	kolH *handler.KolReferralHandler,
) {
	readRoles := middleware.RoleRequired("customer_service", "operator", "super_admin")
	operatorPlus := middleware.RoleRequired("operator", "super_admin")
	superOnly := middleware.RoleRequired("super_admin")

	ps := admin.Group("/presale")

	// 轮次管理
	// GET：customer_service / operator / super_admin 可读（finance 本期无预售权限）
	rounds := ps.Group("/rounds")
	rounds.GET("", readRoles, roundH.ListRounds)
	rounds.GET("/:id", readRoles, roundH.GetRound)
	// 状态机操作：operator+ 可执行，审计中间件包裹
	rounds.POST("/:id/pause", operatorPlus, auditMW, roundH.PauseRound)
	rounds.POST("/:id/resume", operatorPlus, auditMW, roundH.ResumeRound)
	rounds.POST("/:id/reopen", operatorPlus, auditMW, roundH.ReopenRound)
	rounds.POST("/:id/close", operatorPlus, auditMW, roundH.CloseRound)
	rounds.PATCH("/:id/referral-pct", operatorPlus, auditMW, roundH.UpdateReferralPct)
	// 高敏：修改价格/supply/时间窗 = super_admin only + 10/min 限流
	rounds.PATCH("/:id", superOnly, sensitiveLimit, auditMW, roundH.UpdateRound)

	// 入账管理
	deposits := ps.Group("/deposits")
	deposits.GET("", readRoles, depositH.ListDeposits)
	deposits.GET("/:txHash", readRoles, depositH.GetDeposit)
	// 高敏：migrate-round = operator+ + 10/min 限流 + 审计
	deposits.POST("/:txHash/migrate-round", operatorPlus, sensitiveLimit, auditMW, depositH.MigrateRound)

	// 全局配置
	ps.GET("/config", readRoles, configH.GetConfig)
	// 高敏：改配置 = super_admin only + 10/min 限流
	ps.PATCH("/config", superOnly, sensitiveLimit, auditMW, configH.UpdateConfig)

	// 异常事件
	anomaly := ps.Group("/anomaly")
	anomaly.GET("", readRoles, anomalyH.ListAnomalyEvents)
	anomaly.GET("/:id", readRoles, anomalyH.GetAnomalyEvent)
	// resolve：customer_service / operator / super_admin 可处理（finance 无权限）
	anomaly.POST("/:id/resolve", readRoles, auditMW, anomalyH.ResolveAnomalyEvent)

	// 操作审计日志：只读，customer_service / operator / super_admin
	ps.GET("/audit", readRoles, auditH.ListAuditLogs)

	// KOL 特殊返佣（REQ-004）
	// 读：所有角色（含 finance）；写：super_admin only
	kol := ps.Group("/kol-referral")
	allRoles := middleware.RoleRequired("customer_service", "operator", "finance", "super_admin")
	kol.GET("", allRoles, kolH.ListKolReferral)
	kol.POST("", superOnly, auditMW, kolH.CreateKolReferral)
	kol.PATCH("/:eoa", superOnly, auditMW, kolH.UpdateKolReferral)
	kol.DELETE("/:eoa", superOnly, auditMW, kolH.DeleteKolReferral)
}
