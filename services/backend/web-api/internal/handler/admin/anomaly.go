// Package admin — 异常事件 handler（DD-003 v3.1 B5）。
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

// list GET /internal/admin/presale/anomaly
func (h *AnomalyHandler) list(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	fromTs, _ := strconv.ParseInt(c.Query("from_ts"), 10, 64)
	toTs, _ := strconv.ParseInt(c.Query("to_ts"), 10, 64)

	f := repository.PresaleOpsEventFilter{
		EventType: c.Query("event_type"),
		Status:    c.Query("status"),
		FromTs:    fromTs,
		ToTs:      toTs,
		Page:      page,
		Size:      size,
	}

	items, total, err := h.svc.ListAnomaly(c.Request.Context(), f)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to list anomaly events",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "ok",
		"data":    gin.H{"list": items, "total": total, "page": page, "size": size},
	})
}

// get GET /internal/admin/presale/anomaly/:id
func (h *AnomalyHandler) get(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid id"})
		return
	}

	evt, err := h.svc.GetAnomaly(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrAnomalyNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "ANOMALY_NOT_FOUND", "message": "anomaly event not found"})
			return
		}
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "failed to get anomaly event"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": evt})
}

// resolveReq 是 POST /internal/admin/presale/anomaly/:id/resolve 的请求体。
type resolveReq struct {
	Resolution    string  `json:"resolution" binding:"required"`
	TargetRoundID *string `json:"targetRoundId"`
	Note          string  `json:"note"`
}

// resolve POST /internal/admin/presale/anomaly/:id/resolve
func (h *AnomalyHandler) resolve(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_PARAM", "message": "invalid id"})
		return
	}

	tx := gormtx.From(c.Request.Context())
	if tx == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "NO_TX", "message": "missing transaction context"})
		return
	}

	var req resolveReq
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_BODY", "message": err.Error()})
		return
	}

	// before 快照（在共享 tx 内读，加行锁：service 内 GetAnomalyTx 用 FOR UPDATE）
	before, err := h.svc.GetAnomalyTx(tx, id)
	if err != nil {
		anomalyAbortErr(c, err)
		return
	}
	beforeJSON, _ := json.Marshal(before)
	c.Set(middleware.CtxAuditBefore, string(beforeJSON))
	c.Set(middleware.CtxAuditTargetType, "anomaly")
	c.Set(middleware.CtxAuditTargetID, idStr)
	c.Set(middleware.CtxAuditAction, "anomaly_resolve")

	operatorID := c.GetString(middleware.CtxAdminOperatorID)

	svcReq := &service.ResolveRequest{
		Resolution:    req.Resolution,
		TargetRoundID: req.TargetRoundID,
		Note:          req.Note,
	}

	result, err := h.svc.Resolve(tx, id, svcReq, operatorID)
	if err != nil {
		anomalyAbortErr(c, err)
		return
	}

	afterJSON, _ := json.Marshal(result)
	c.Set(middleware.CtxAuditAfter, string(afterJSON))

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "ok", "data": result})
}

// ── 导出 HandlerFunc 包装器 ───────────────────────────────────────────────────

// ListHandler returns gin.HandlerFunc for GET /anomaly.
func (h *AnomalyHandler) ListHandler() gin.HandlerFunc { return h.list }

// GetHandler returns gin.HandlerFunc for GET /anomaly/:id.
func (h *AnomalyHandler) GetHandler() gin.HandlerFunc { return h.get }

// ResolveHandler returns gin.HandlerFunc for POST /anomaly/:id/resolve.
func (h *AnomalyHandler) ResolveHandler() gin.HandlerFunc { return h.resolve }

// anomalyAbortErr 将 service 层错误映射为标准 HTTP 响应。
func anomalyAbortErr(c *gin.Context, err error) {
	if errors.Is(err, service.ErrAnomalyNotFound) {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "ANOMALY_NOT_FOUND", "message": "anomaly event not found"})
		return
	}
	if errors.Is(err, service.ErrInvalidStateTransition) {
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"code": "INVALID_STATE_TRANSITION", "message": err.Error()})
		return
	}
	if errors.Is(err, service.ErrTargetRoundNotFound) {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "TARGET_ROUND_NOT_FOUND", "message": err.Error()})
		return
	}
	if errors.Is(err, service.ErrInvalidResolution) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"code": "INVALID_RESOLUTION", "message": err.Error()})
		return
	}
	c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL_ERROR", "message": "internal error"})
}
