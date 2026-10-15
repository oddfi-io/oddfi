// Package admin — 审计日志 handler（DD-003 v3.1 B5）。
package admin

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"everything_finance/org/web-api/internal/repository"
)

// ── 导出 HandlerFunc 包装器 ───────────────────────────────────────────────────

// ListHandler returns gin.HandlerFunc for GET /audit.
func (h *AuditHandler) ListHandler() gin.HandlerFunc { return h.list }

// list GET /internal/admin/presale/audit
func (h *AuditHandler) list(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	f := repository.PresaleAdminAuditFilter{
		Operator:   c.Query("operator"),
		Action:     c.Query("action"),
		TargetType: c.Query("target_type"),
		TargetID:   c.Query("target_id"),
		StartTime:  startTime,
		EndTime:    endTime,
		Limit:      limit,
		Offset:     offset,
	}

	items, total, err := h.repo.List(c.Request.Context(), f)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"code":    "INTERNAL_ERROR",
			"message": "failed to list audit logs",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "ok",
		"data":    gin.H{"list": items, "total": total, "limit": limit, "offset": offset},
	})
}
