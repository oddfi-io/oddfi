package handler

import (
	"errors"
	"net/http"
	"strconv"

	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/pkg/response"
	"everything_finance/org/web-api/internal/service"

	"github.com/gin-gonic/gin"
)

// 预售相关业务错误码（对齐 02-api-contract.md §2）
const (
	errCodeInvalidTx             = 40006 // INVALID_TX：链上 receipt 不存在或已 revert
	errCodeTxNotToVault          = 40007 // TX_NOT_TO_VAULT：收款地址不在金库池
	errCodeTxNotUsdt             = 40008 // TX_NOT_USDT：不是 USDT 转账
	errCodeTxNotFound            = 40405 // TX_NOT_FOUND：deposit 记录不存在
	errCodePresaleWalletMismatch = 40902 // WALLET_MISMATCH：tx.from ≠ 登录态 EOA
)

// PresaleHandler 预售 HTTP handler（配置 + 入账 + 持仓）
type PresaleHandler struct {
	configSvc  service.PresaleConfigService
	depositSvc service.PresaleDepositService
}

// NewPresaleHandler 构造函数，依赖注入
func NewPresaleHandler(
	configSvc service.PresaleConfigService,
	depositSvc service.PresaleDepositService,
) *PresaleHandler {
	return &PresaleHandler{
		configSvc:  configSvc,
		depositSvc: depositSvc,
	}
}

// ===========================
// GET /api/v1/presale/config（公开，无 JWT）
// ===========================

// GetConfig 返回轮次配置 + 金库地址 + 全局参数
// 响应格式对齐 02-api-contract.md §3.1
func (h *PresaleHandler) GetConfig(c *gin.Context) {
	resp, err := h.configSvc.GetConfig(c.Request.Context())
	if err != nil {
		logger.Errorf("[PresaleHandler] get config failed: err=%v", err)
		response.InternalError(c, "failed to get presale config")
		return
	}
	response.Success(c, resp)
}

// ===========================
// POST /api/v1/presale/deposit/report-tx（JWT）
// ===========================

// reportTxRequest POST /presale/deposit/report-tx 请求体
type reportTxRequest struct {
	TxHash             string  `json:"txHash"             binding:"required"`
	ExpectedRoundID    *string `json:"expectedRoundId,omitempty"`
	ExpectedAmountUsdt *string `json:"expectedAmountUsdt,omitempty"`
}

// ReportTx 前端上报 txHash，启动双轨会师流程
// 响应格式对齐 02-api-contract.md §3.2
func (h *PresaleHandler) ReportTx(c *gin.Context) {
	uid, eoa, ok := extractUserContext(c)
	if !ok {
		return
	}

	var req reportTxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	svcReq := service.ReportTxRequest{
		TxHash:             req.TxHash,
		ExpectedRoundID:    req.ExpectedRoundID,
		ExpectedAmountUsdt: req.ExpectedAmountUsdt,
	}

	resp, err := h.depositSvc.ReportTx(c.Request.Context(), uid, eoa, svcReq)
	if err != nil {
		handleDepositError(c, err, uid, "report tx")
		return
	}

	response.Success(c, resp)
}

// ===========================
// GET /api/v1/presale/deposit/:txHash（JWT）
// ===========================

// GetDepositByTxHash 前端轮询查单笔 deposit 状态
// 响应格式对齐 02-api-contract.md §3.3
func (h *PresaleHandler) GetDepositByTxHash(c *gin.Context) {
	uid, _, ok := extractUserContext(c)
	if !ok {
		return
	}

	txHash := c.Param("txHash")
	if txHash == "" {
		response.InvalidParams(c, "txHash is required")
		return
	}

	detail, err := h.depositSvc.GetByTxHash(c.Request.Context(), uid, txHash)
	if err != nil {
		if errors.Is(err, service.ErrDepositTxNotFound) {
			c.JSON(http.StatusNotFound, response.Response{
				Code:    errCodeTxNotFound,
				Message: "deposit not found",
				Data:    nil,
			})
			return
		}
		logger.Errorf("[PresaleHandler] get deposit by txHash failed: user_id=%d err=%v", uid, err)
		response.InternalError(c, "failed to get deposit")
		return
	}

	response.Success(c, detail)
}

// ===========================
// GET /api/v1/presale/deposit/list（JWT）
// ===========================

// ListDeposits 用户查入账历史（分页）
// 响应格式对齐 02-api-contract.md §3.4
func (h *PresaleHandler) ListDeposits(c *gin.Context) {
	uid, _, ok := extractUserContext(c)
	if !ok {
		return
	}

	// 分页参数，默认 page=1 size=20，size 上限 100
	page := 1
	size := 20
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if s := c.Query("size"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 {
			if v > 100 {
				v = 100 // size 上限 100，防止大批量查询
			}
			size = v
		}
	}
	// status 可选筛选（空字符串 = 不筛选）
	status := c.Query("status")

	resp, err := h.depositSvc.ListByUser(c.Request.Context(), uid, status, page, size)
	if err != nil {
		logger.Errorf("[PresaleHandler] list deposits failed: user_id=%d err=%v", uid, err)
		response.InternalError(c, "failed to list deposits")
		return
	}

	response.Success(c, resp)
}

// ===========================
// GET /api/v1/presale/position（JWT）
// ===========================

// GetPosition 聚合用户预售持仓
// 响应格式对齐 02-api-contract.md §3.5
func (h *PresaleHandler) GetPosition(c *gin.Context) {
	uid, _, ok := extractUserContext(c)
	if !ok {
		return
	}

	pos, err := h.depositSvc.GetPosition(c.Request.Context(), uid)
	if err != nil {
		logger.Errorf("[PresaleHandler] get position failed: user_id=%d err=%v", uid, err)
		response.InternalError(c, "failed to get position")
		return
	}

	response.Success(c, pos)
}

// ===========================
// 内部工具函数
// ===========================

// extractUserContext 从 JWT middleware 注入的 gin.Context 中提取 user_id 和 EOA 地址
// 返回 false 时已写入错误响应，调用方直接 return
func extractUserContext(c *gin.Context) (uid uint64, eoa string, ok bool) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return 0, "", false
	}
	uid, ok = userIDVal.(uint64)
	if !ok {
		response.InternalError(c, "invalid user_id type in context")
		return 0, "", false
	}

	addressVal, _ := c.Get("address")
	eoa, _ = addressVal.(string)
	return uid, eoa, true
}

// handleDepositError 统一处理 deposit service 返回的业务错误，映射到 HTTP 错误码
// 对齐 02-api-contract.md §2 错误码字典
func handleDepositError(c *gin.Context, err error, uid uint64, action string) {
	switch {
	case errors.Is(err, service.ErrInvalidTx):
		// 40006 INVALID_TX：链上 receipt 不存在或已 revert
		c.JSON(http.StatusBadRequest, response.Response{
			Code:    errCodeInvalidTx,
			Message: "invalid tx: receipt not found or reverted",
			Data:    nil,
		})
	case errors.Is(err, service.ErrTxNotToVault):
		// 40007 TX_NOT_TO_VAULT：收款地址不在金库池
		c.JSON(http.StatusBadRequest, response.Response{
			Code:    errCodeTxNotToVault,
			Message: "tx not to vault: to address not in vault pool",
			Data:    nil,
		})
	case errors.Is(err, service.ErrTxNotUsdt):
		// 40008 TX_NOT_USDT：不是 USDT 转账
		c.JSON(http.StatusBadRequest, response.Response{
			Code:    errCodeTxNotUsdt,
			Message: "tx not usdt: no USDT Transfer log found",
			Data:    nil,
		})
	case errors.Is(err, service.ErrDepositWalletMismatch):
		// 40902 WALLET_MISMATCH：tx.from ≠ 登录态 EOA
		c.JSON(http.StatusConflict, response.Response{
			Code:    errCodePresaleWalletMismatch,
			Message: "wallet mismatch: tx.from does not match login eoa",
			Data:    nil,
		})
	default:
		logger.Errorf("[PresaleHandler] %s failed: user_id=%d err=%v", action, uid, err)
		response.InternalError(c, "failed to "+action)
	}
}
