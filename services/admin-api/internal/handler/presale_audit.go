package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// PresaleAuditHandler 操作审计日志查询 API 薄壳（DD-003 v3.1 B6）。
// audit 落库已移到 web-api 侧，admin-backend 仅做只读转发。
type PresaleAuditHandler struct {
	wc *client.Client
}

// NewPresaleAudit 构造 handler。wc 为 nil 时仅用于 RBAC 单测。
func NewPresaleAudit(wc *client.Client) *PresaleAuditHandler {
	return &PresaleAuditHandler{wc: wc}
}

// ListAuditLogs GET /admin/presale/audit — customer_service+
// query: operator / action / target_type / target_id / from_ts / to_ts / page / size
func (h *PresaleAuditHandler) ListAuditLogs(c *gin.Context) {
	path := "/internal/admin/presale/audit"
	if q := c.Request.URL.RawQuery; q != "" {
		path += "?" + q
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	var out client.ListAuditResponse
	if err := h.wc.Get(c.Request.Context(), path, extractJWT(c), "", &out); err != nil {
		presaleProxyErr(c, err, "list audit logs")
		return
	}
	if out.Page == 0 {
		out.Page = page
	}
	if out.Size == 0 {
		out.Size = size
	}
	response.OK(c, out)
}
