// Package admin — admin internal endpoint handler 集合（DD-003 v3.1）。
//
// 设计约定：
//   - handler 方法签名都是 `func (h *XxxHandler) action(c *gin.Context)`
//   - 写操作必须 c.Set(middleware.CtxAuditAction / TargetType / TargetID / Before / After) 供 audit 落库
//   - 业务事务从 gormtx.From(c.Request.Context()) 拿（admin_audit middleware 已开 tx）
//   - 所有错误用 c.AbortWithStatusJSON + return（不光 c.JSON，否则 audit middleware 误认为成功）
//
// 17 endpoints 分布：
//   - RoundHandler：rounds 8 个（list/get + pause/resume/reopen/close + updateReferralPct/updateRound）
//   - DepositHandler：deposits 3 个（list/get + migrateRound）
//   - ConfigHandler：config 2 个（get + update）
//   - AnomalyHandler：anomaly 3 个（list/get + resolve）
//   - AuditHandler：audit 1 个（list）
package admin

import (
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"
)

// RoundHandler 处理 8 个 round 相关 endpoint。
type RoundHandler struct {
	svc service.PresaleAdminRoundService
}

// NewRoundHandler 构造 RoundHandler。
func NewRoundHandler(svc service.PresaleAdminRoundService) *RoundHandler {
	return &RoundHandler{svc: svc}
}

// DepositHandler 处理 3 个 deposit 相关 endpoint。
type DepositHandler struct {
	svc    service.PresaleAdminDepositService
	cfgSvc service.PresaleAdminConfigService
}

// NewDepositHandler 构造 DepositHandler。
func NewDepositHandler(svc service.PresaleAdminDepositService, cfgSvc service.PresaleAdminConfigService) *DepositHandler {
	return &DepositHandler{svc: svc, cfgSvc: cfgSvc}
}

// ConfigHandler 处理 2 个 config 相关 endpoint。
type ConfigHandler struct {
	svc service.PresaleAdminConfigService
}

// NewConfigHandler 构造 ConfigHandler。
func NewConfigHandler(svc service.PresaleAdminConfigService) *ConfigHandler {
	return &ConfigHandler{svc: svc}
}

// AnomalyHandler 处理 3 个 anomaly 相关 endpoint。
type AnomalyHandler struct {
	svc service.PresaleAdminAnomalyService
}

// NewAnomalyHandler 构造 AnomalyHandler。
func NewAnomalyHandler(svc service.PresaleAdminAnomalyService) *AnomalyHandler {
	return &AnomalyHandler{svc: svc}
}

// AuditHandler 处理 1 个 audit list endpoint。
type AuditHandler struct {
	repo repository.PresaleAdminAuditRepository
}

// NewAuditHandler 构造 AuditHandler。
func NewAuditHandler(repo repository.PresaleAdminAuditRepository) *AuditHandler {
	return &AuditHandler{repo: repo}
}

// KolReferralHandler / NewKolReferralHandler 见 kol_referral.go（REQ-004）。
