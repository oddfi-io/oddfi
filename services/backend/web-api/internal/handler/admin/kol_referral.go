// Package admin — KOL 自定义返佣比例 handler（REQ-004）。
//
// 4 个 endpoint：GET / POST / PATCH / DELETE，挂在 /internal/admin/presale/kol-referral。
// 写操作走 admin_audit + idempotency middleware（路由层装配），
// handler 内必须 c.Set(audit ctx 字段) 让审计正常落库。
//
// RBAC：本路由的角色校验由 admin-backend proxy 层（REQ-004 Step 1）完成；
// web-api 信任 ServiceAuth + AdminJWT 透传的 operator + role，本 handler 不再二次校验。
package admin

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/gormtx"
	"everything_finance/org/web-api/internal/repository"
)

// KolReferralHandler 处理 4 个 KOL 自定义返佣相关 endpoint。
//
// 直接依赖 repo 而非 service，因为本表无业务流程编排（无状态机 / 无跨表事务），
// 与 AuditHandler 同思路（admin/types.go）。
type KolReferralHandler struct {
	repo repository.KolReferralPctRepository
}

// NewKolReferralHandler 构造 KolReferralHandler。
func NewKolReferralHandler(repo repository.KolReferralPctRepository) *KolReferralHandler {
	return &KolReferralHandler{repo: repo}
}

// eoaRegex EVM 地址格式（0x 前缀 + 40 hex）。
var eoaRegex = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

// maxReferralPct 上限 100%（业务无意义但兜底防错配）。
var maxReferralPct = decimal.NewFromInt(100)

// validateEoa 校验 EOA 格式，命中返小写后的地址 + nil；不命中返 ""+错误。
func validateEoa(eoa string) (string, error) {
	if !eoaRegex.MatchString(eoa) {
		return "", errors.New("invalid referrerEoa format (expect ^0x[0-9a-fA-F]{40}$)")
	}
	return strings.ToLower(eoa), nil
}

// validatePct 校验比例范围 [0, 100] + 精度 ≤ 4 位。
func validatePct(pct decimal.Decimal) error {
	if pct.IsNegative() {
		return errors.New("referralPct must be ≥ 0")
	}
	if pct.GreaterThan(maxReferralPct) {
		return errors.New("referralPct must be ≤ 100")
	}
	// Exponent 是 -小数位数；-4 表示 4 位小数，超出（-5/-6/...）即精度过高
	if pct.Exponent() < -4 {
		return errors.New("referralPct precision must be ≤ 4 decimal places")
	}
	return nil
}

// kolDTO 是给前端的标准化序列化结构。
// 注意 referralPct 用字符串而非 decimal.Decimal —— admin-backend / 前端均按字符串处理金额/比例
// （CLAUDE.md API 约定）。
type kolDTO struct {
	ReferrerEoa string  `json:"referrerEoa"`
	ReferralPct string  `json:"referralPct"`
	Note        *string `json:"note,omitempty"`
	CreatedBy   string  `json:"createdBy"`
	CreatedAt   int64   `json:"createdAt"`
	UpdatedAt   int64   `json:"updatedAt"`
}

func toDTO(m *model.PresaleKolReferralPct) kolDTO {
	return kolDTO{
		ReferrerEoa: m.ReferrerEoa,
		ReferralPct: m.ReferralPct.String(),
		Note:        m.Note,
		CreatedBy:   m.CreatedBy,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

// getByEoaTx 在外部 tx 上 SELECT 单条 KOL 记录，用于读 audit before / after 快照。
// 不走 repository.GetByEoa（后者用主 db，看不到本事务尚未 commit 的写）。
// 未命中返 repository.ErrKolNotFound（与 repo 接口语义一致）。
func (h *KolReferralHandler) getByEoaTx(ctx context.Context, tx *gorm.DB, eoa string) (*model.PresaleKolReferralPct, error) {
	if eoa == "" {
		return nil, repository.ErrKolNotFound
	}
	var kol model.PresaleKolReferralPct
	if err := tx.WithContext(ctx).
		Where("referrer_eoa = ?", eoa).
		First(&kol).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, repository.ErrKolNotFound
		}
		return nil, err
	}
	return &kol, nil
}

// eoaFilterRegex 允许 referrerEoa 模糊查询入参的字符集：仅 hex（含可选前缀 0x）。
// 拒绝 SQL LIKE 通配符 `%` / `_`，避免运营误粘附带控制字符触发全表扫描（REV-006 MAJ-2）。
var eoaFilterRegex = regexp.MustCompile(`^(0x)?[0-9a-fA-F]*$`)

// list GET /internal/admin/presale/kol-referral
func (h *KolReferralHandler) list(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	rawFilter := c.Query("referrerEoa")
	if rawFilter != "" && !eoaFilterRegex.MatchString(rawFilter) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"code":    "INVALID_PARAM",
			"message": "referrerEoa filter must be hex (optional 0x prefix)",
		})
		return
	}
	eoaFilter := strings.ToLower(strings.TrimPrefix(rawFilter, "0x"))

	items, total, err := h.repo.List(c.Request.Context(), eoaFilter, page, size)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to list kol referral pct",
		})
		return
	}

	dtos := make([]kolDTO, 0, len(items))
	for _, it := range items {
		dtos = append(dtos, toDTO(it))
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "ok",
		"data":    gin.H{"list": dtos, "total": total, "page": page, "size": size},
	})
}

// createReq 是 POST 请求体。
type createReq struct {
	ReferrerEoa string  `json:"referrerEoa" binding:"required"`
	ReferralPct string  `json:"referralPct" binding:"required"`
	Note        *string `json:"note"`
}

// create POST /internal/admin/presale/kol-referral
//
// 语义：upsert（POST 幂等）—— 与现有 admin idempotency middleware 配合时仍幂等。
func (h *KolReferralHandler) create(c *gin.Context) {
	tx := gormtx.From(c.Request.Context())
	if tx == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "NO_TX", "message": "missing transaction context"})
		return
	}

	var req createReq
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_BODY", "message": err.Error()})
		return
	}

	eoa, err := validateEoa(req.ReferrerEoa)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": err.Error()})
		return
	}
	pct, err := decimal.NewFromString(req.ReferralPct)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid referralPct format"})
		return
	}
	if err := validatePct(pct); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": err.Error()})
		return
	}

	operator := c.GetString(middleware.CtxAdminOperatorID)
	now := time.Now().UnixMilli()

	// before 快照（用于 audit），在 tx 内读以看到本事务先前未 commit 的写（理论上空，但
	// 保持与后续 UpsertTx + getByEoaTx 一致的事务可见性边界）。
	before, _ := h.getByEoaTx(c.Request.Context(), tx, eoa)
	if before != nil {
		beforeJSON, _ := json.Marshal(toDTO(before))
		c.Set(middleware.CtxAuditBefore, string(beforeJSON))
	}
	c.Set(middleware.CtxAuditAction, "kol_referral_upsert")
	c.Set(middleware.CtxAuditTargetType, "kol_referral")
	c.Set(middleware.CtxAuditTargetID, eoa)

	entry := &model.PresaleKolReferralPct{
		ReferrerEoa: eoa,
		ReferralPct: pct,
		Note:        req.Note,
		CreatedBy:   operator,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	// REV-006 MAJ-1：必须走 UpsertTx 共享 audit middleware 的 tx，否则业务写自 commit
	// 而 audit 失败回滚时审计链就断了。
	if err := h.repo.UpsertTx(c.Request.Context(), tx, entry); err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to upsert kol referral pct"})
		return
	}

	// 读回 created_at 等 DB 落库后的真实值（同 tx 内 SELECT，否则读到的是已 commit 的旧值或
	// 完全看不到本次插入。after_json 必须反映本次事务最终态，audit middleware commit 前需准备好）
	after, err := h.getByEoaTx(c.Request.Context(), tx, eoa)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to reload kol referral pct"})
		return
	}

	dto := toDTO(after)
	afterJSON, _ := json.Marshal(dto)
	c.Set(middleware.CtxAuditAfter, string(afterJSON))

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": gin.H{"kol": dto}})
}

// updateReq 是 PATCH 请求体。
type updateReq struct {
	ReferralPct *string `json:"referralPct"`
	Note        *string `json:"note"`
}

// update PATCH /internal/admin/presale/kol-referral/:eoa
func (h *KolReferralHandler) update(c *gin.Context) {
	tx := gormtx.From(c.Request.Context())
	if tx == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "NO_TX", "message": "missing transaction context"})
		return
	}

	eoaParam := c.Param("eoa")
	eoa, err := validateEoa(eoaParam)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": err.Error()})
		return
	}

	var req updateReq
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_BODY", "message": err.Error()})
		return
	}
	if req.ReferralPct == nil && req.Note == nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "at least one of referralPct / note must be provided"})
		return
	}

	before, err := h.getByEoaTx(c.Request.Context(), tx, eoa)
	if err != nil {
		if errors.Is(err, repository.ErrKolNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "KOL_NOT_FOUND", "message": "kol referral pct not found"})
			return
		}
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to get kol referral pct"})
		return
	}

	// 决定本次 update 的 pct：未传则沿用 before 值
	newPct := before.ReferralPct
	if req.ReferralPct != nil {
		parsed, err := decimal.NewFromString(*req.ReferralPct)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid referralPct format"})
			return
		}
		if err := validatePct(parsed); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": err.Error()})
			return
		}
		newPct = parsed
	}

	beforeJSON, _ := json.Marshal(toDTO(before))
	c.Set(middleware.CtxAuditBefore, string(beforeJSON))
	c.Set(middleware.CtxAuditAction, "kol_referral_update")
	c.Set(middleware.CtxAuditTargetType, "kol_referral")
	c.Set(middleware.CtxAuditTargetID, eoa)

	now := time.Now().UnixMilli()
	// REV-006 MAJ-1：用 UpdateTx 共享 audit middleware tx
	if err := h.repo.UpdateTx(c.Request.Context(), tx, eoa, newPct, req.Note, now); err != nil {
		if errors.Is(err, repository.ErrKolNotFound) {
			// 并发删除 race：before 读到了但 Update 时被删
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "KOL_NOT_FOUND", "message": "kol referral pct not found"})
			return
		}
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to update kol referral pct"})
		return
	}

	after, err := h.getByEoaTx(c.Request.Context(), tx, eoa)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to reload kol referral pct"})
		return
	}

	dto := toDTO(after)
	afterJSON, _ := json.Marshal(dto)
	c.Set(middleware.CtxAuditAfter, string(afterJSON))

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": gin.H{"kol": dto}})
}

// del DELETE /internal/admin/presale/kol-referral/:eoa
func (h *KolReferralHandler) del(c *gin.Context) {
	tx := gormtx.From(c.Request.Context())
	if tx == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "NO_TX", "message": "missing transaction context"})
		return
	}

	eoaParam := c.Param("eoa")
	eoa, err := validateEoa(eoaParam)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": err.Error()})
		return
	}

	before, err := h.getByEoaTx(c.Request.Context(), tx, eoa)
	if err != nil && !errors.Is(err, repository.ErrKolNotFound) {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to get kol referral pct"})
		return
	}

	c.Set(middleware.CtxAuditAction, "kol_referral_delete")
	c.Set(middleware.CtxAuditTargetType, "kol_referral")
	c.Set(middleware.CtxAuditTargetID, eoa)
	if before != nil {
		beforeJSON, _ := json.Marshal(toDTO(before))
		c.Set(middleware.CtxAuditBefore, string(beforeJSON))
	}

	// REV-006 MAJ-1：用 DeleteTx 共享 audit middleware tx
	found, err := h.repo.DeleteTx(c.Request.Context(), tx, eoa)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to delete kol referral pct"})
		return
	}
	if !found {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "KOL_NOT_FOUND", "message": "kol referral pct not found"})
		return
	}

	c.Set(middleware.CtxAuditAfter, "{}")
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": gin.H{"referrerEoa": eoa}})
}

// ── 导出 HandlerFunc 包装器（route 注册用）─────────────────────────────────────

// ListHandler returns gin.HandlerFunc for GET /kol-referral.
func (h *KolReferralHandler) ListHandler() gin.HandlerFunc { return h.list }

// CreateHandler returns gin.HandlerFunc for POST /kol-referral.
func (h *KolReferralHandler) CreateHandler() gin.HandlerFunc { return h.create }

// UpdateHandler returns gin.HandlerFunc for PATCH /kol-referral/:eoa.
func (h *KolReferralHandler) UpdateHandler() gin.HandlerFunc { return h.update }

// DeleteHandler returns gin.HandlerFunc for DELETE /kol-referral/:eoa.
func (h *KolReferralHandler) DeleteHandler() gin.HandlerFunc { return h.del }
