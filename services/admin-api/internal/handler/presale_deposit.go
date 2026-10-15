package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// PresaleDepositHandler 入账查询 + migrate-round API 薄壳（DD-003 v3.1 B6）。
type PresaleDepositHandler struct {
	wc *client.Client
}

// NewPresaleDeposit 构造 handler。wc 为 nil 时仅用于 RBAC 单测。
func NewPresaleDeposit(wc *client.Client, _ *client.Client) *PresaleDepositHandler {
	return &PresaleDepositHandler{wc: wc}
}

// ListDeposits GET /admin/presale/deposits
// query: round_id / eoa_address / status / vault_address / from_ts / to_ts / page / size
func (h *PresaleDepositHandler) ListDeposits(c *gin.Context) {
	path := "/internal/admin/presale/deposits"
	if q := c.Request.URL.RawQuery; q != "" {
		path += "?" + q
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	var out client.ListDepositsResponse
	if err := h.wc.Get(c.Request.Context(), path, extractJWT(c), "", &out); err != nil {
		presaleProxyErr(c, err, "list deposits")
		return
	}
	// 若 web-api 响应未填分页字段，用本地解析值补充（保持响应格式兼容前端）
	if out.Page == 0 {
		out.Page = page
	}
	if out.Size == 0 {
		out.Size = size
	}
	response.OK(c, out)
}

// GetDeposit GET /admin/presale/deposits/:txHash
func (h *PresaleDepositHandler) GetDeposit(c *gin.Context) {
	txHash := c.Param("txHash")
	var out client.DepositItem
	if err := h.wc.Get(c.Request.Context(), "/internal/admin/presale/deposits/"+txHash,
		extractJWT(c), "", &out); err != nil {
		presaleProxyErr(c, err, "get deposit")
		return
	}
	response.OK(c, out)
}

// migrateRoundReq 是 POST /admin/presale/deposits/:txHash/migrate-round 的请求体。
type migrateRoundReq struct {
	TargetRoundID string `json:"targetRoundId" binding:"required"`
	Note          string `json:"note"`
}

// MigrateRound POST /admin/presale/deposits/:txHash/migrate-round — operator+
func (h *PresaleDepositHandler) MigrateRound(c *gin.Context) {
	txHash := c.Param("txHash")
	idemKey := requireIdempotencyKey(c)
	if idemKey == "" {
		return
	}

	var req migrateRoundReq
	if err := c.ShouldBindBodyWith(&req, presaleJSONBinding(c)); err != nil {
		response.BadRequest(c, errcode.InvalidParam, err.Error())
		c.Abort()
		return
	}

	webapiReq := client.MigrateRoundRequest{
		TargetRoundID: req.TargetRoundID,
		Note:          req.Note,
	}

	var out client.MigrateRoundResponse
	if err := h.wc.Post(c.Request.Context(),
		"/internal/admin/presale/deposits/"+txHash+"/migrate-round",
		extractJWT(c), idemKey, webapiReq, &out); err != nil {
		presaleAbortErr(c, err, "migrate round")
		return
	}

	logger.L().Info().
		Str("module", "presale_deposit").
		Str("tx_hash", txHash).
		Str("new_round", out.NewRoundID).
		Msg("[PresaleDeposit] migrate-round forwarded to web-api")

	response.OK(c, out)
}
