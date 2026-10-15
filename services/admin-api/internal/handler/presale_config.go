package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// PresaleConfigHandler 全局配置读写 API 薄壳（DD-003 v3.1 B6）。
type PresaleConfigHandler struct {
	wc *client.Client
}

// NewPresaleConfig 构造 handler。wc 为 nil 时仅用于 RBAC 单测。
func NewPresaleConfig(wc *client.Client) *PresaleConfigHandler {
	return &PresaleConfigHandler{wc: wc}
}

// GetConfig GET /admin/presale/config — customer_service+
func (h *PresaleConfigHandler) GetConfig(c *gin.Context) {
	var out client.ConfigItem
	if err := h.wc.Get(c.Request.Context(), "/internal/admin/presale/config", extractJWT(c), "", &out); err != nil {
		presaleProxyErr(c, err, "get config")
		return
	}
	response.OK(c, out)
}

// updateConfigReq 是 PATCH /admin/presale/config 的请求体（所有字段可选）。
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

// UpdateConfig PATCH /admin/presale/config — super_admin only
func (h *PresaleConfigHandler) UpdateConfig(c *gin.Context) {
	idemKey := requireIdempotencyKey(c)
	if idemKey == "" {
		return
	}

	var req updateConfigReq
	if err := c.ShouldBindBodyWith(&req, presaleJSONBinding(c)); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}

	// 校验金额字段格式
	for _, pair := range []struct {
		v    *string
		name string
	}{
		{req.TgeOpenPriceUsd, "tgeOpenPriceUsd"},
		{req.MinSubscribeUsd, "minSubscribeUsd"},
		{req.TotalTargetUsd, "totalTargetUsd"},
	} {
		if pair.v != nil {
			if _, err := decimal.NewFromString(*pair.v); err != nil {
				response.BadRequest(c, errcode.InvalidParam, "invalid "+pair.name+": "+err.Error())
				c.Abort()
				return
			}
		}
	}

	webapiReq := client.UpdateConfigRequest{
		TgeTs:                req.TgeTs,
		TgeOpenPriceUsd:      req.TgeOpenPriceUsd,
		VaultAddress:         req.VaultAddress,
		MinSubscribeUsd:      req.MinSubscribeUsd,
		BoundaryToleranceMin: req.BoundaryToleranceMin,
		TotalTargetUsd:       req.TotalTargetUsd,
		AuditLabel:           req.AuditLabel,
		LarkWebhookUrl:       req.LarkWebhookUrl,
		Note:                 req.Note,
	}

	var out client.UpdateConfigResponse
	if err := h.wc.Patch(c.Request.Context(), "/internal/admin/presale/config",
		extractJWT(c), idemKey, webapiReq, &out); err != nil {
		presaleAbortErr(c, err, "update config")
		return
	}

	logger.L().Info().
		Str("module", "presale_config").
		Msg("[PresaleConfig] config update forwarded to web-api")

	respData := gin.H{"config": out.Config}
	if out.Warning != "" {
		respData["warning"] = out.Warning
	}
	response.OK(c, respData)
}
