package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// PresaleAnomalyHandler 异常事件查询 + resolve API 薄壳（DD-003 v3.1 B6）。
type PresaleAnomalyHandler struct {
	wc *client.Client
}

// NewPresaleAnomaly 构造 handler。wc 为 nil 时仅用于 RBAC 单测。
func NewPresaleAnomaly(wc *client.Client) *PresaleAnomalyHandler {
	return &PresaleAnomalyHandler{wc: wc}
}

// ListAnomalyEvents GET /admin/presale/anomaly
// query: status / event_type / from_ts / to_ts / page / size
func (h *PresaleAnomalyHandler) ListAnomalyEvents(c *gin.Context) {
	path := "/internal/admin/presale/anomaly"
	if q := c.Request.URL.RawQuery; q != "" {
		path += "?" + q
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	var out client.ListAnomalyResponse
	if err := h.wc.Get(c.Request.Context(), path, extractJWT(c), "", &out); err != nil {
		presaleProxyErr(c, err, "list anomaly events")
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

// GetAnomalyEvent GET /admin/presale/anomaly/:id
func (h *PresaleAnomalyHandler) GetAnomalyEvent(c *gin.Context) {
	idStr := c.Param("id")
	// 前端路径参数校验（只校验格式，业务不存在让 web-api 返回 404）
	if _, err := strconv.ParseUint(idStr, 10, 64); err != nil {
		response.BadRequest(c, errcode.InvalidParam, "invalid anomaly id: "+idStr)
		return
	}
	var out client.AnomalyItem
	if err := h.wc.Get(c.Request.Context(), "/internal/admin/presale/anomaly/"+idStr,
		extractJWT(c), "", &out); err != nil {
		presaleProxyErr(c, err, "get anomaly event")
		return
	}
	response.OK(c, out)
}

// resolveReq 是 POST /admin/presale/anomaly/:id/resolve 的请求体。
type resolveReq struct {
	Resolution    string  `json:"resolution" binding:"required"`
	TargetRoundID *string `json:"targetRoundId"`
	Note          string  `json:"note"`
}

// ResolveAnomalyEvent POST /admin/presale/anomaly/:id/resolve — customer_service+
func (h *PresaleAnomalyHandler) ResolveAnomalyEvent(c *gin.Context) {
	idStr := c.Param("id")
	if _, err := strconv.ParseUint(idStr, 10, 64); err != nil {
		response.BadRequest(c, errcode.InvalidParam, "invalid anomaly id: "+idStr)
		c.Abort()
		return
	}

	idemKey := requireIdempotencyKey(c)
	if idemKey == "" {
		return
	}

	var req resolveReq
	if err := c.ShouldBindBodyWith(&req, presaleJSONBinding(c)); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}

	webapiReq := client.ResolveRequest{
		Resolution:    req.Resolution,
		TargetRoundID: req.TargetRoundID,
		Note:          req.Note,
	}

	var out client.AnomalyItem
	if err := h.wc.Post(c.Request.Context(), "/internal/admin/presale/anomaly/"+idStr+"/resolve",
		extractJWT(c), idemKey, webapiReq, &out); err != nil {
		presaleAbortErr(c, err, "resolve anomaly event")
		return
	}

	logger.L().Info().
		Str("module", "presale_anomaly").
		Str("anomaly_id", idStr).
		Str("resolution", req.Resolution).
		Msg("[PresaleAnomaly] resolve forwarded to web-api")

	response.OK(c, out)
}
