// Package admin — 轮次 handler（DD-003 v3.1 B5）。
package admin

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/pkg/gormtx"
	"everything_finance/org/web-api/internal/service"
)

// list GET /internal/admin/presale/rounds
func (h *RoundHandler) list(c *gin.Context) {
	rounds, err := h.svc.ListRounds(c.Request.Context())
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to list rounds",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "ok",
		"data":    gin.H{"list": rounds, "total": len(rounds)},
	})
}

// get GET /internal/admin/presale/rounds/:id
func (h *RoundHandler) get(c *gin.Context) {
	id := c.Param("id")
	round, err := h.svc.GetRound(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrAdminRoundNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
				"code":    "ROUND_NOT_FOUND",
				"message": "round not found",
			})
			return
		}
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to get round",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": round})
}

// pause POST /internal/admin/presale/rounds/:id/pause
func (h *RoundHandler) pause(c *gin.Context) {
	h.applyTransition(c, "pause", func(tx *gorm.DB, id string) (any, error) {
		return h.svc.PauseRound(tx, id)
	})
}

// resume POST /internal/admin/presale/rounds/:id/resume
func (h *RoundHandler) resume(c *gin.Context) {
	h.applyTransition(c, "resume", func(tx *gorm.DB, id string) (any, error) {
		return h.svc.ResumeRound(tx, id)
	})
}

// reopen POST /internal/admin/presale/rounds/:id/reopen
func (h *RoundHandler) reopen(c *gin.Context) {
	h.applyTransition(c, "reopen", func(tx *gorm.DB, id string) (any, error) {
		return h.svc.ReopenRound(tx, id)
	})
}

// close POST /internal/admin/presale/rounds/:id/close
func (h *RoundHandler) close(c *gin.Context) {
	h.applyTransition(c, "close", func(tx *gorm.DB, id string) (any, error) {
		return h.svc.CloseRound(tx, id)
	})
}

// applyTransition 状态机操作公共模板：before 快照 → 执行转换 → 设置 audit ctx → 返回响应。
func (h *RoundHandler) applyTransition(c *gin.Context, action string, fn func(tx *gorm.DB, id string) (any, error)) {
	id := c.Param("id")
	tx := gormtx.From(c.Request.Context())
	if tx == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"code":    "NO_TX",
			"message": "missing transaction context",
		})
		return
	}

	// before 快照（在共享 tx 内读，不加行锁）
	before, err := h.svc.GetRoundTx(tx, id)
	if err != nil {
		roundAbortErr(c, err)
		return
	}
	beforeJSON, _ := json.Marshal(before)
	c.Set(middleware.CtxAuditBefore, string(beforeJSON))
	c.Set(middleware.CtxAuditTargetType, "round")
	c.Set(middleware.CtxAuditTargetID, id)
	c.Set(middleware.CtxAuditAction, action)

	// 执行状态转换
	result, err := fn(tx, id)
	if err != nil {
		roundAbortErr(c, err)
		return
	}

	afterJSON, _ := json.Marshal(result)
	c.Set(middleware.CtxAuditAfter, string(afterJSON))

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": result})
}

// updateReferralPctReq 是 PATCH /internal/admin/presale/rounds/:id/referral-pct 的请求体。
type updateReferralPctReq struct {
	ReferralRewardPct string `json:"referralRewardPct" binding:"required"`
	Note              string `json:"note"`
}

// updateReferralPct PATCH /internal/admin/presale/rounds/:id/referral-pct
func (h *RoundHandler) updateReferralPct(c *gin.Context) {
	id := c.Param("id")
	tx := gormtx.From(c.Request.Context())
	if tx == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "NO_TX", "message": "missing transaction context"})
		return
	}

	var req updateReferralPctReq
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_BODY", "message": err.Error()})
		return
	}

	pct, err := decimal.NewFromString(req.ReferralRewardPct)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid referralRewardPct: " + err.Error()})
		return
	}

	before, err := h.svc.GetRoundTx(tx, id)
	if err != nil {
		roundAbortErr(c, err)
		return
	}
	beforeJSON, _ := json.Marshal(before)
	c.Set(middleware.CtxAuditBefore, string(beforeJSON))
	c.Set(middleware.CtxAuditTargetType, "round")
	c.Set(middleware.CtxAuditTargetID, id)
	c.Set(middleware.CtxAuditAction, "update_referral_pct")

	updated, err := h.svc.UpdateReferralPct(tx, id, pct)
	if err != nil {
		roundAbortErr(c, err)
		return
	}

	afterJSON, _ := json.Marshal(updated)
	c.Set(middleware.CtxAuditAfter, string(afterJSON))

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": updated})
}

// updateRoundReq 是 PATCH /internal/admin/presale/rounds/:id 的请求体。
type updateRoundReq struct {
	PriceUsd          *string `json:"priceUsd"`
	SupplyOdd         *string `json:"supplyOdd"`
	EndTs             *int64  `json:"endTs"`
	MinPerOrderUsd    *string `json:"minPerOrderUsd"`
	MaxPerWalletUsd   *string `json:"maxPerWalletUsd"`
	TgeReleasePct     *string `json:"tgeReleasePct"`
	LinearReleaseDays *int    `json:"linearReleaseDays"`
	Note              string  `json:"note"`
}

// updateRound PATCH /internal/admin/presale/rounds/:id
func (h *RoundHandler) updateRound(c *gin.Context) {
	id := c.Param("id")
	tx := gormtx.From(c.Request.Context())
	if tx == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "NO_TX", "message": "missing transaction context"})
		return
	}

	var req updateRoundReq
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_BODY", "message": err.Error()})
		return
	}

	// 将字符串金额转为 decimal（API 约定：金额用字符串传输，避免 JS float64 精度丢失）
	svcReq := &service.UpdateRoundRequest{
		EndTs:             req.EndTs,
		LinearReleaseDays: req.LinearReleaseDays,
	}
	if req.PriceUsd != nil {
		d, err := decimal.NewFromString(*req.PriceUsd)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid priceUsd: " + err.Error()})
			return
		}
		svcReq.PriceUsd = &d
	}
	if req.SupplyOdd != nil {
		d, err := decimal.NewFromString(*req.SupplyOdd)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid supplyOdd: " + err.Error()})
			return
		}
		svcReq.SupplyOdd = &d
	}
	if req.MinPerOrderUsd != nil {
		d, err := decimal.NewFromString(*req.MinPerOrderUsd)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid minPerOrderUsd: " + err.Error()})
			return
		}
		svcReq.MinPerOrderUsd = &d
	}
	if req.MaxPerWalletUsd != nil {
		d, err := decimal.NewFromString(*req.MaxPerWalletUsd)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid maxPerWalletUsd: " + err.Error()})
			return
		}
		svcReq.MaxPerWalletUsd = &d
	}
	if req.TgeReleasePct != nil {
		d, err := decimal.NewFromString(*req.TgeReleasePct)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid tgeReleasePct: " + err.Error()})
			return
		}
		svcReq.TgeReleasePct = &d
	}

	before, err := h.svc.GetRoundTx(tx, id)
	if err != nil {
		roundAbortErr(c, err)
		return
	}
	beforeJSON, _ := json.Marshal(before)
	c.Set(middleware.CtxAuditBefore, string(beforeJSON))
	c.Set(middleware.CtxAuditTargetType, "round")
	c.Set(middleware.CtxAuditTargetID, id)
	c.Set(middleware.CtxAuditAction, "update_round")

	updated, err := h.svc.UpdateRound(tx, id, svcReq)
	if err != nil {
		roundAbortErr(c, err)
		return
	}

	afterJSON, _ := json.Marshal(updated)
	c.Set(middleware.CtxAuditAfter, string(afterJSON))

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": updated})
}

// ── 导出 HandlerFunc 包装器（供测试和 router 注册使用）────────────────────────

// ListHandler returns gin.HandlerFunc for GET /rounds.
func (h *RoundHandler) ListHandler() gin.HandlerFunc { return h.list }

// GetHandler returns gin.HandlerFunc for GET /rounds/:id.
func (h *RoundHandler) GetHandler() gin.HandlerFunc { return h.get }

// PauseHandler returns gin.HandlerFunc for POST /rounds/:id/pause.
func (h *RoundHandler) PauseHandler() gin.HandlerFunc { return h.pause }

// ResumeHandler returns gin.HandlerFunc for POST /rounds/:id/resume.
func (h *RoundHandler) ResumeHandler() gin.HandlerFunc { return h.resume }

// ReopenHandler returns gin.HandlerFunc for POST /rounds/:id/reopen.
func (h *RoundHandler) ReopenHandler() gin.HandlerFunc { return h.reopen }

// CloseHandler returns gin.HandlerFunc for POST /rounds/:id/close.
func (h *RoundHandler) CloseHandler() gin.HandlerFunc { return h.close }

// UpdateReferralPctHandler returns gin.HandlerFunc for PATCH /rounds/:id/referral-pct.
func (h *RoundHandler) UpdateReferralPctHandler() gin.HandlerFunc { return h.updateReferralPct }

// UpdateRoundHandler returns gin.HandlerFunc for PATCH /rounds/:id.
func (h *RoundHandler) UpdateRoundHandler() gin.HandlerFunc { return h.updateRound }

// roundAbortErr 将 service 层错误映射为标准 HTTP 响应，必须 AbortWithStatusJSON。
func roundAbortErr(c *gin.Context, err error) {
	if errors.Is(err, service.ErrAdminRoundNotFound) {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "ROUND_NOT_FOUND", "message": "round not found"})
		return
	}
	if errors.Is(err, service.ErrInvalidStateTransition) {
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"code": "INVALID_STATE_TRANSITION", "message": err.Error()})
		return
	}
	c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "internal error"})
}
