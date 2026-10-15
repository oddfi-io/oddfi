// Package admin — 入账 handler（DD-003 v3.1 B5）。
package admin

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"

	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/pkg/gormtx"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"
)

// list GET /internal/admin/presale/deposits
func (h *DepositHandler) list(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	fromTs, _ := strconv.ParseInt(c.Query("from_ts"), 10, 64)
	toTs, _ := strconv.ParseInt(c.Query("to_ts"), 10, 64)

	f := repository.PresaleDepositFilter{
		RoundID:      c.Query("round_id"),
		EoaAddress:   c.Query("eoa_address"),
		Status:       c.Query("status"),
		VaultAddress: c.Query("vault_address"),
		FromTs:       fromTs,
		ToTs:         toTs,
		Page:         page,
		Size:         size,
	}

	items, total, err := h.svc.ListDeposits(c.Request.Context(), f)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to list deposits",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "ok",
		"data":    gin.H{"list": items, "total": total, "page": page, "size": size},
	})
}

// get GET /internal/admin/presale/deposits/:txHash
func (h *DepositHandler) get(c *gin.Context) {
	txHash := c.Param("txHash")
	dep, err := h.svc.GetDeposit(c.Request.Context(), txHash)
	if err != nil {
		if errors.Is(err, service.ErrAdminDepositNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "DEPOSIT_NOT_FOUND", "message": "deposit not found"})
			return
		}
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to get deposit"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": dep})
}

// migrateRoundReq 是 POST /internal/admin/presale/deposits/:txHash/migrate-round 的请求体。
type migrateRoundReq struct {
	TargetRoundID string `json:"targetRoundId" binding:"required"`
	Note          string `json:"note"`
}

// migrateRound POST /internal/admin/presale/deposits/:txHash/migrate-round
func (h *DepositHandler) migrateRound(c *gin.Context) {
	txHash := c.Param("txHash")
	tx := gormtx.From(c.Request.Context())
	if tx == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "NO_TX", "message": "missing transaction context"})
		return
	}

	var req migrateRoundReq
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_BODY", "message": err.Error()})
		return
	}

	// 从配置读取容差分钟数（boundary_tolerance_min）
	cfg, err := h.cfgSvc.GetConfigTx(tx)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to get config"})
		return
	}

	// before 快照（在共享 tx 内读，不加行锁）
	before, err := h.svc.GetDepositTx(tx, txHash)
	if err != nil {
		depositAbortErr(c, err)
		return
	}
	beforeJSON, _ := json.Marshal(before)
	c.Set(middleware.CtxAuditBefore, string(beforeJSON))
	c.Set(middleware.CtxAuditTargetType, "deposit")
	c.Set(middleware.CtxAuditTargetID, txHash)
	c.Set(middleware.CtxAuditAction, "migrate_round_id")

	result, err := h.svc.MigrateRound(c.Request.Context(), tx, txHash, req.TargetRoundID, cfg.BoundaryToleranceMin)
	if err != nil {
		depositAbortErr(c, err)
		return
	}

	afterJSON, _ := json.Marshal(result.Deposit)
	c.Set(middleware.CtxAuditAfter, string(afterJSON))

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "ok",
		"data": gin.H{
			"txHash":       txHash,
			"oldRoundId":   result.OldRoundID,
			"newRoundId":   result.NewRoundID,
			"oldSharesOdd": result.OldSharesOdd.String(),
			"newSharesOdd": result.NewSharesOdd.String(),
			"deposit":      result.Deposit,
		},
	})
}

// ── 导出 HandlerFunc 包装器 ───────────────────────────────────────────────────

// ListHandler returns gin.HandlerFunc for GET /deposits.
func (h *DepositHandler) ListHandler() gin.HandlerFunc { return h.list }

// GetHandler returns gin.HandlerFunc for GET /deposits/:txHash.
func (h *DepositHandler) GetHandler() gin.HandlerFunc { return h.get }

// MigrateRoundHandler returns gin.HandlerFunc for POST /deposits/:txHash/migrate-round.
func (h *DepositHandler) MigrateRoundHandler() gin.HandlerFunc { return h.migrateRound }

// depositAbortErr 将 service 层错误映射为标准 HTTP 响应。
func depositAbortErr(c *gin.Context, err error) {
	if errors.Is(err, service.ErrAdminDepositNotFound) {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "DEPOSIT_NOT_FOUND", "message": "deposit not found"})
		return
	}
	if errors.Is(err, service.ErrInvalidStateTransition) {
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"code": "INVALID_STATE_TRANSITION", "message": err.Error()})
		return
	}
	if errors.Is(err, service.ErrMigrateRoundLimitExceeded) {
		c.AbortWithStatusJSON(http.StatusUnprocessableEntity, gin.H{"code": "MIGRATE_LIMIT_EXCEEDED", "message": err.Error()})
		return
	}
	if errors.Is(err, service.ErrBlockTimestampOutOfRange) {
		c.AbortWithStatusJSON(http.StatusUnprocessableEntity, gin.H{"code": "BLOCK_TIMESTAMP_OUT_OF_RANGE", "message": err.Error()})
		return
	}
	if errors.Is(err, service.ErrTargetRoundNotFound) {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "TARGET_ROUND_NOT_FOUND", "message": err.Error()})
		return
	}
	c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "internal error"})
}
