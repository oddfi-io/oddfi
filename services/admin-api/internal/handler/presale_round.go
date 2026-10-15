package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// PresaleRoundHandler 轮次相关 API 薄壳（DD-003 v3.1 B6）。
// 不再直连 DB：RBAC 校验由 middleware 完成后，转发给 web-api internal endpoint。
type PresaleRoundHandler struct {
	wc *client.Client
}

// NewPresaleRound 构造 handler。wc 为 nil 时仅用于 RBAC 单测（nil-safe 约定）。
func NewPresaleRound(wc *client.Client) *PresaleRoundHandler {
	return &PresaleRoundHandler{wc: wc}
}

// ListRounds GET /admin/presale/rounds
func (h *PresaleRoundHandler) ListRounds(c *gin.Context) {
	path := "/internal/admin/presale/rounds"
	// 透传原始 query string
	if q := c.Request.URL.RawQuery; q != "" {
		path += "?" + q
	}
	var out client.ListRoundsResponse
	if err := h.wc.Get(c.Request.Context(), path, extractJWT(c), "", &out); err != nil {
		presaleProxyErr(c, err, "list rounds")
		return
	}
	response.OK(c, out)
}

// GetRound GET /admin/presale/rounds/:id
func (h *PresaleRoundHandler) GetRound(c *gin.Context) {
	id := c.Param("id")
	var out client.RoundItem
	if err := h.wc.Get(c.Request.Context(), "/internal/admin/presale/rounds/"+id, extractJWT(c), "", &out); err != nil {
		presaleProxyErr(c, err, "get round")
		return
	}
	response.OK(c, out)
}

// PauseRound POST /admin/presale/rounds/:id/pause
func (h *PresaleRoundHandler) PauseRound(c *gin.Context) {
	h.applyStateTransition(c, "pause")
}

// ResumeRound POST /admin/presale/rounds/:id/resume
func (h *PresaleRoundHandler) ResumeRound(c *gin.Context) {
	h.applyStateTransition(c, "resume")
}

// ReopenRound POST /admin/presale/rounds/:id/reopen
func (h *PresaleRoundHandler) ReopenRound(c *gin.Context) {
	h.applyStateTransition(c, "reopen")
}

// CloseRound POST /admin/presale/rounds/:id/close
func (h *PresaleRoundHandler) CloseRound(c *gin.Context) {
	h.applyStateTransition(c, "close")
}

// applyStateTransition 是状态机操作的公共模板：验证 note → 转发 web-api → 透传响应。
func (h *PresaleRoundHandler) applyStateTransition(c *gin.Context, action string) {
	id := c.Param("id")
	idemKey := requireIdempotencyKey(c)
	if idemKey == "" {
		return
	}

	// body 已由 PresaleAudit middleware（note 校验）缓存到 gin.BodyBytesKey；
	// 此处直接透传原始 JSON body 给 web-api，保留 note 字段。
	var rawBody map[string]any
	if err := c.ShouldBindBodyWith(&rawBody, presaleJSONBinding(c)); err != nil {
		response.BadRequest(c, errcode.InvalidParam, "invalid request body: "+err.Error())
		c.Abort()
		return
	}

	path := "/internal/admin/presale/rounds/" + id + "/" + action
	var out client.RoundItem
	if err := h.wc.Post(c.Request.Context(), path, extractJWT(c), idemKey, rawBody, &out); err != nil {
		presaleAbortErr(c, err, "state transition "+action)
		return
	}

	logger.L().Info().
		Str("module", "presale_round").
		Str("round_id", id).
		Str("action", action).
		Msg("[PresaleRound] state transition forwarded to web-api")

	response.OK(c, out)
}

// updateRoundReq 是 PATCH /admin/presale/rounds/:id 的请求体。
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

// UpdateRound PATCH /admin/presale/rounds/:id — super_admin 专用
func (h *PresaleRoundHandler) UpdateRound(c *gin.Context) {
	id := c.Param("id")
	idemKey := requireIdempotencyKey(c)
	if idemKey == "" {
		return
	}

	var req updateRoundReq
	if err := c.ShouldBindBodyWith(&req, presaleJSONBinding(c)); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}

	// 校验金额字段格式（admin-backend 仍负责输入验证，只是不做业务逻辑）
	if err := validateDecimalPtr(req.PriceUsd, "priceUsd"); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}
	if err := validateDecimalPtr(req.SupplyOdd, "supplyOdd"); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}
	if err := validateDecimalPtr(req.MinPerOrderUsd, "minPerOrderUsd"); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}
	if err := validateDecimalPtr(req.MaxPerWalletUsd, "maxPerWalletUsd"); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}
	if err := validateDecimalPtr(req.TgeReleasePct, "tgeReleasePct"); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}

	webapiReq := client.UpdateRoundRequest{
		PriceUsd:          req.PriceUsd,
		SupplyOdd:         req.SupplyOdd,
		EndTs:             req.EndTs,
		MinPerOrderUsd:    req.MinPerOrderUsd,
		MaxPerWalletUsd:   req.MaxPerWalletUsd,
		TgeReleasePct:     req.TgeReleasePct,
		LinearReleaseDays: req.LinearReleaseDays,
		Note:              req.Note,
	}

	var out client.RoundItem
	if err := h.wc.Patch(c.Request.Context(), "/internal/admin/presale/rounds/"+id,
		extractJWT(c), idemKey, webapiReq, &out); err != nil {
		presaleAbortErr(c, err, "update round")
		return
	}

	logger.L().Info().
		Str("module", "presale_round").
		Str("round_id", id).
		Msg("[PresaleRound] round fields update forwarded to web-api")

	response.OK(c, out)
}

// updateReferralPctReq 是 PATCH /admin/presale/rounds/:id/referral-pct 的请求体。
type updateReferralPctReq struct {
	ReferralRewardPct string `json:"referralRewardPct" binding:"required"`
	Note              string `json:"note"`
}

// UpdateReferralPct PATCH /admin/presale/rounds/:id/referral-pct
func (h *PresaleRoundHandler) UpdateReferralPct(c *gin.Context) {
	id := c.Param("id")
	idemKey := requireIdempotencyKey(c)
	if idemKey == "" {
		return
	}

	var req updateReferralPctReq
	if err := c.ShouldBindBodyWith(&req, presaleJSONBinding(c)); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}
	// 校验 decimal 格式
	if _, err := decimal.NewFromString(req.ReferralRewardPct); err != nil {
		response.BadRequest(c, errcode.InvalidParam, "invalid referralRewardPct: "+err.Error())
		c.Abort()
		return
	}

	webapiReq := client.UpdateReferralPctRequest{
		ReferralRewardPct: req.ReferralRewardPct,
		Note:              req.Note,
	}

	var out client.RoundItem
	if err := h.wc.Patch(c.Request.Context(), "/internal/admin/presale/rounds/"+id+"/referral-pct",
		extractJWT(c), idemKey, webapiReq, &out); err != nil {
		presaleAbortErr(c, err, "update referral pct")
		return
	}

	response.OK(c, out)
}

// validateDecimalPtr 校验可选 decimal 字符串字段。
func validateDecimalPtr(v *string, fieldName string) error {
	if v == nil {
		return nil
	}
	if _, err := decimal.NewFromString(*v); err != nil {
		return fmt.Errorf("invalid %s: %w", fieldName, err)
	}
	return nil
}

// extractJWT 从 Authorization header 提取原始 Bearer token，
// 透传给 web-api 的 X-Admin-JWT header（DD-003 §4.2.2 C3）。
func extractJWT(c *gin.Context) string {
	return stripBearer(c.GetHeader("Authorization"))
}

// stripBearer 去掉 "Bearer " 前缀（大小写不敏感）。
func stripBearer(h string) string {
	h = strings.TrimSpace(h)
	if len(h) > 7 && strings.EqualFold(h[:7], "Bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return h
}

// requireIdempotencyKey 从 header 读取 X-Idempotency-Key。
// 缺失时写 400 + Abort，返回 ""（调用方应 return）。
// admin-backend 不生成 key，必须由前端透传（DD-003 §3.3 M5）。
func requireIdempotencyKey(c *gin.Context) string {
	key := c.GetHeader("X-Idempotency-Key")
	if key == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"code":    "IDEMPOTENCY_KEY_REQUIRED",
			"message": "X-Idempotency-Key header is required",
			"data":    nil,
		})
		return ""
	}
	return key
}
