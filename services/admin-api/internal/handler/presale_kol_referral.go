package handler

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// eoaRegex 校验标准 EVM EOA 地址格式（0x + 40 位十六进制）。
var eoaRegex = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

// KolReferralHandler KOL 特殊返佣 API 薄壳（REQ-004）。
// 所有写操作已经在路由层要求 super_admin，本层只做入参校验 + 透传。
type KolReferralHandler struct {
	wc *client.Client
}

// NewKolReferral 构造 handler。wc 为 nil 时仅用于 RBAC 单测。
func NewKolReferral(wc *client.Client) *KolReferralHandler {
	return &KolReferralHandler{wc: wc}
}

// kolBasePath web-api 对应的 internal endpoint 前缀。
const kolBasePath = "/internal/admin/presale/kol-referral"

// ListKolReferral GET /admin/presale/kol-referral
// query: eoa（模糊搜索）、page、size
func (h *KolReferralHandler) ListKolReferral(c *gin.Context) {
	path := kolBasePath
	if q := c.Request.URL.RawQuery; q != "" {
		path += "?" + q
	}
	var out client.ListKolReferralResponse
	if err := h.wc.Get(c.Request.Context(), path, extractJWT(c), "", &out); err != nil {
		presaleProxyErr(c, err, "list kol referral")
		return
	}
	response.OK(c, out)
}

// createKolReq POST 请求体（admin-backend 层二次校验）。
type createKolReq struct {
	ReferrerEoa string `json:"referrerEoa" binding:"required"`
	ReferralPct string `json:"referralPct" binding:"required"`
	Note        string `json:"note"`
}

// CreateKolReferral POST /admin/presale/kol-referral — super_admin only
func (h *KolReferralHandler) CreateKolReferral(c *gin.Context) {
	var req createKolReq
	if err := c.ShouldBindBodyWith(&req, presaleJSONBinding(c)); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		return
	}
	if err := validateKolFields(req.ReferrerEoa, req.ReferralPct); err != "" {
		response.BadRequest(c, errcode.InvalidParam, err)
		return
	}

	webapiReq := client.CreateKolReferralRequest{
		ReferrerEoa: strings.ToLower(req.ReferrerEoa),
		ReferralPct: req.ReferralPct,
		Note:        req.Note,
	}
	var out client.KolReferralResponse
	if err := h.wc.Post(c.Request.Context(), kolBasePath, extractJWT(c), "", webapiReq, &out); err != nil {
		presaleAbortErr(c, err, "create kol referral")
		return
	}
	response.OK(c, out)
}

// updateKolReq PATCH 请求体。
type updateKolReq struct {
	ReferralPct string `json:"referralPct" binding:"required"`
	Note        string `json:"note"`
}

// UpdateKolReferral PATCH /admin/presale/kol-referral/:eoa — super_admin only
func (h *KolReferralHandler) UpdateKolReferral(c *gin.Context) {
	eoa, ok := parseAndValidateEoa(c)
	if !ok {
		return
	}

	var req updateKolReq
	if err := c.ShouldBindBodyWith(&req, presaleJSONBinding(c)); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		return
	}
	if errMsg := validateReferralPct(req.ReferralPct); errMsg != "" {
		response.BadRequest(c, errcode.KolReferralPctInvalid, errMsg)
		return
	}

	webapiReq := client.UpdateKolReferralRequest{
		ReferralPct: req.ReferralPct,
		Note:        req.Note,
	}
	var out client.KolReferralResponse
	if err := h.wc.Patch(c.Request.Context(), kolBasePath+"/"+url.PathEscape(eoa),
		extractJWT(c), "", webapiReq, &out); err != nil {
		presaleAbortErr(c, err, "update kol referral")
		return
	}
	response.OK(c, out)
}

// DeleteKolReferral DELETE /admin/presale/kol-referral/:eoa — super_admin only
func (h *KolReferralHandler) DeleteKolReferral(c *gin.Context) {
	eoa, ok := parseAndValidateEoa(c)
	if !ok {
		return
	}

	var out struct {
		ReferrerEoa string `json:"referrerEoa"`
	}
	if err := h.wc.Delete(c.Request.Context(), kolBasePath+"/"+url.PathEscape(eoa),
		extractJWT(c), "", &out); err != nil {
		presaleAbortErr(c, err, "delete kol referral")
		return
	}
	response.OK(c, out)
}

// ── 内部校验帮助函数 ──────────────────────────────────────────────────────────

// parseAndValidateEoa 从路径参数读取并校验 EOA，失败时直接写响应并返回 false。
func parseAndValidateEoa(c *gin.Context) (string, bool) {
	raw := c.Param("eoa")
	eoa, err := url.PathUnescape(raw)
	if err != nil || !eoaRegex.MatchString(eoa) {
		response.BadRequest(c, errcode.InvalidParam, "invalid eoa address format")
		return "", false
	}
	return strings.ToLower(eoa), true
}

// validateKolFields 校验 EOA 格式 + referralPct 范围，返回错误描述（空字符串表示通过）。
func validateKolFields(eoa, pct string) string {
	if !eoaRegex.MatchString(eoa) {
		return "invalid eoa address format (must be 0x + 40 hex chars)"
	}
	return validateReferralPct(pct)
}

// validateReferralPct 校验返佣比例：必须是有效 decimal 且在 [0, 100] 内。
func validateReferralPct(pct string) string {
	d, err := decimal.NewFromString(pct)
	if err != nil {
		return "referralPct must be a valid decimal number"
	}
	if d.LessThan(decimal.Zero) || d.GreaterThan(decimal.NewFromInt(100)) {
		return "referralPct must be between 0 and 100"
	}
	return ""
}
