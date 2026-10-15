// Package admin — 全局配置 handler（DD-003 v3.1 B5）。
package admin

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/shopspring/decimal"

	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/pkg/gormtx"
	"everything_finance/org/web-api/internal/service"
)

// get GET /internal/admin/presale/config
func (h *ConfigHandler) get(c *gin.Context) {
	cfg, err := h.svc.GetConfig(c.Request.Context())
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to get config",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": cfg})
}

// updateConfigReq 是 PATCH /internal/admin/presale/config 的请求体。
// 所有字段可选（pointer），只传要改的。
type updateConfigReq struct {
	TgeTs                *int64  `json:"tgeTs"`
	TgeOpenPriceUsd      *string `json:"tgeOpenPriceUsd"`
	VaultAddress         *string `json:"vaultAddress"`
	MinSubscribeUsd      *string `json:"minSubscribeUsd"`
	BoundaryToleranceMin *int    `json:"boundaryToleranceMin"`
	TotalTargetUsd       *string `json:"totalTargetUsd"`
	AuditLabel           *string `json:"auditLabel"`
	LarkWebhookUrl       *string `json:"larkWebhookUrl"`
	Note                 string  `json:"note"`
}

// ── 导出 HandlerFunc 包装器 ───────────────────────────────────────────────────

// GetHandler returns gin.HandlerFunc for GET /config.
func (h *ConfigHandler) GetHandler() gin.HandlerFunc { return h.get }

// UpdateHandler returns gin.HandlerFunc for PATCH /config.
func (h *ConfigHandler) UpdateHandler() gin.HandlerFunc { return h.update }

// update PATCH /internal/admin/presale/config
func (h *ConfigHandler) update(c *gin.Context) {
	tx := gormtx.From(c.Request.Context())
	if tx == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "NO_TX", "message": "missing transaction context"})
		return
	}

	var req updateConfigReq
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_BODY", "message": err.Error()})
		return
	}

	// 将字符串金额转为 decimal
	svcReq := &service.UpdateConfigRequest{
		TgeTs:                req.TgeTs,
		VaultAddress:         req.VaultAddress,
		BoundaryToleranceMin: req.BoundaryToleranceMin,
		AuditLabel:           req.AuditLabel,
		LarkWebhookUrl:       req.LarkWebhookUrl,
	}
	if req.TgeOpenPriceUsd != nil {
		d, err := decimal.NewFromString(*req.TgeOpenPriceUsd)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid tgeOpenPriceUsd"})
			return
		}
		svcReq.TgeOpenPriceUsd = &d
	}
	if req.MinSubscribeUsd != nil {
		d, err := decimal.NewFromString(*req.MinSubscribeUsd)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid minSubscribeUsd"})
			return
		}
		svcReq.MinSubscribeUsd = &d
	}
	if req.TotalTargetUsd != nil {
		d, err := decimal.NewFromString(*req.TotalTargetUsd)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid totalTargetUsd"})
			return
		}
		svcReq.TotalTargetUsd = &d
	}

	// before 快照
	before, err := h.svc.GetConfigTx(tx)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to get config"})
		return
	}
	beforeJSON, _ := json.Marshal(before)
	c.Set(middleware.CtxAuditBefore, string(beforeJSON))
	c.Set(middleware.CtxAuditTargetType, "config")
	c.Set(middleware.CtxAuditTargetID, "1")
	c.Set(middleware.CtxAuditAction, "update_config")

	result, err := h.svc.UpdateConfig(tx, svcReq)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": err.Error()})
		return
	}

	afterJSON, _ := json.Marshal(result.Config)
	c.Set(middleware.CtxAuditAfter, string(afterJSON))

	resp := gin.H{"code": 0, "message": "ok", "data": result.Config}
	if result.Warning != "" {
		resp["warning"] = result.Warning
	}
	c.JSON(http.StatusOK, resp)
}
