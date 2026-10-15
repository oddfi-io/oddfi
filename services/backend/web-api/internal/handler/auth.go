package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/pkg/response"
	"everything_finance/org/web-api/internal/service"
	"everything_finance/org/web-api/utils"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

type AuthHandler struct {
	authService service.AuthService
}

func NewAuthHandler(authService service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) GetBalance(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	balance, err := h.authService.GetUserBalance(c.Request.Context(), uid)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("get user balance failed, err:%s", err.Error()))
		return
	}

	response.Success(c, balance)
}

func (h *AuthHandler) GetUserDepositAddress(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	depositAddressResp, err := h.authService.GetUserDepositAddress(c.Request.Context(), uid, "bsc")
	if err != nil {
		response.InternalError(c, fmt.Sprintf("get deposit address failed, err:%s", err.Error()))
		return
	}

	response.Success(c, depositAddressResp)
}

// 下注逻辑
func (h *AuthHandler) BetPlace(c *gin.Context) {
	var req model.ModifyBalanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Errorf("BetPlace req:%v, err:%v", req, err)
		response.InvalidParams(c, err.Error())
		return
	}

	// 基础防御：下注数组必须一一对应，避免后续按索引取值时越界或串错盘口。
	if len(req.OddIDs) == 0 ||
		len(req.OddIDs) != len(req.Stakes) ||
		len(req.OddIDs) != len(req.Market) ||
		len(req.OddIDs) != len(req.Label) ||
		len(req.OddIDs) != len(req.Odds) ||
		req.RefID == "" {
		logger.Errorf("[BetPlace] odd_ids, stakes, market, label, odds, ref_id must be filled")
		response.InvalidParams(c, "odd_ids, stakes, market, label, odds, ref_id must be filled")
		return
	}

	// 同一个请求内不允许重复 odd_id，避免同一个投注项被重复扣款/建单。
	seenOddIDs := make(map[int64]struct{}, len(req.OddIDs))
	for _, oddID := range req.OddIDs {
		if _, ok := seenOddIDs[oddID]; ok {
			logger.Errorf("[BetPlace] duplicate odd_id:%v", oddID)
			response.InvalidParams(c, "duplicate odd_id")
			return
		}
		seenOddIDs[oddID] = struct{}{}
	}

	// 鉴权成功之后获取用户 Id
	userID, exists := c.Get("user_id")
	if !exists {
		logger.Errorf("[BetPlace] missing user_id in context")
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		logger.Errorf("[BetPlace] invalid user_id type")
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	// for测试写死
	// uid := uint64(1001)
	logger.Infof("[BetPlace] [debug_loginfo] uid:%v req:%v", uid, req)

	// 下注类型统一归一化，避免 "Single"、" single " 这类输入误入未知分支。
	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	betType := req.Type
	if betType == "single" {
		// 单注逻辑：独立事务，顺序执行
		resp, err := h.authService.BetPlaceSingle(c.Request.Context(), uid, &req)
		if err != nil {
			logger.Errorf("[BetPlace] bet place single failed, err:%v", err)
			response.InternalError(c, fmt.Sprintf("bet place single failed, err:%s", err.Error()))
			return
		}
		logger.Infof("[BetPlace] resp:%v", resp)
		response.Success(c, resp)
	} else if betType == "parlay" {
		// 串注逻辑：并行执行
		resp, err := h.authService.BetPlaceParlay(c.Request.Context(), uid, &req)
		if err != nil {
			logger.Errorf("[BetPlace] get deposit address failed, err:%v", err)
			response.InternalError(c, fmt.Sprintf("get deposit address failed, err:%s", err.Error()))
			return
		}
		logger.Infof("[BetPlace] resp:%v", resp)
		response.Success(c, resp)
	} else {
		// 未知下注类型必须明确返回参数错误，不能让接口静默结束成空 200。
		logger.Errorf("[BetPlace] invalid bet type:%s", req.Type)
		response.InvalidParams(c, "invalid bet type")
		return
	}
}

// BannerBetPlace 首页 Banner 轻量下注接口。
// 这里只负责鉴权、参数绑定和错误返回，具体落库交给 service 层。
func (h *AuthHandler) BannerBetPlace(c *gin.Context) {
	var req model.BannerBetPlaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Errorf("BannerBetPlace req:%v, err:%v", req, err)
		response.InvalidParams(c, err.Error())
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		logger.Errorf("[BannerBetPlace] missing user_id in context")
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		logger.Errorf("[BannerBetPlace] invalid user_id type")
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	resp, err := h.authService.BannerBetPlace(c.Request.Context(), uid, &req)
	if err != nil {
		logger.Errorf("[BannerBetPlace] create banner bet failed, err:%v", err)
		response.InvalidParams(c, err.Error())
		return
	}

	response.Success(c, resp)
}

// 撤单逻辑
func (h *AuthHandler) BetCancle(c *gin.Context) {
	var req model.CancelBalanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Errorf("BetCancel req:%v, err:%v", req, err)
		response.InvalidParams(c, err.Error())
		return
	}

	// 撤单会释放锁定资金，用户身份必须以鉴权中间件写入的上下文为准，避免前端伪造请求体 user_id 撤销他人注单。
	userID, exists := c.Get("user_id")
	if !exists {
		logger.Errorf("BetCancel missing user_id in context")
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		logger.Errorf("BetCancel invalid user_id type")
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	//测试写死
	// uid := uint64(1001)
	resp, err := h.authService.CancelBalance(c.Request.Context(), uid, req.BetIds)
	if err != nil {
		logger.Errorf("BetCancel cancel balance failed, err:%v", err)
		response.InternalError(c, fmt.Sprintf("cancel balance failed, err:%s", err.Error()))
		return
	}
	logger.Infof("BetCancel resp:%v", resp)
	response.Success(c, resp)
}

// 持仓接口
func (h *AuthHandler) BetHolding(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		logger.Errorf("BetHolding missing user_id in context")
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		logger.Errorf("BetHolding invalid user_id type")
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	// 测试写
	// uid := uint64(1001)
	// fmt.Println("[BetHolding]===========", uid)
	resp, err := h.authService.GetBetHolding(c.Request.Context(), uid)
	if err != nil {
		fmt.Println("[BetHolding]========== err", err)
		logger.Errorf("BetHolding get bet holding failed, err:%v", err)
		response.InternalError(c, fmt.Sprintf("get bet holding failed, err:%s", err.Error()))
		return
	}
	logger.Infof("BetHolding resp:%v", resp)
	response.Success(c, resp)
}

// BannerBetHolding 查询当前用户最近的 Banner 下注记录。
func (h *AuthHandler) BannerBetHolding(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		logger.Errorf("BannerBetHolding missing user_id in context")
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		logger.Errorf("BannerBetHolding invalid user_id type")
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	resp, err := h.authService.GetBannerBetHolding(c.Request.Context(), uid)
	if err != nil {
		logger.Errorf("BannerBetHolding get banner bet holding failed, err:%v", err)
		response.InternalError(c, fmt.Sprintf("get banner bet holding failed, err:%s", err.Error()))
		return
	}

	response.Success(c, resp)
}

func (h *AuthHandler) BetClaim(c *gin.Context) {
	var req model.BetClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Errorf("BetClaim req:%v, err:%v", req, err)
		response.InvalidParams(c, err.Error())
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		logger.Errorf("BetClaim missing user_id in context")
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		logger.Errorf("BetClaim invalid user_id type")
		response.Unauthorized(c, "invalid user_id type")
		return
	}
	// 测试写死
	// uid := uint64(1001)

	resp, err := h.authService.ClaimBet(c.Request.Context(), uid, req.BetID, req.Amount)
	if err != nil {
		logger.Errorf("BetClaim get bet claim failed, err:%v", err)
		if resp != nil {
			respondBetClaimFailure(c, resp, err)
			return
		}
		response.InternalError(c, fmt.Sprintf("get bet claim failed, err:%s", err.Error()))
		return
	}
	logger.Infof("BetClaim resp:%v", resp)
	response.Success(c, resp)
}

func respondBetClaimFailure(c *gin.Context, resp *model.BetClaimResponse, err error) {
	httpStatus := http.StatusBadRequest
	code := response.CodeInvalidParams

	switch resp.Status {
	case model.BetClaimStatusConcurrencyClaimError:
		httpStatus = http.StatusConflict
		code = response.CodeConflict
	case model.BetClaimStatusDatabaseError, model.BetClaimStatusMultipleClaimableBalanceRows:
		httpStatus = http.StatusInternalServerError
		code = response.CodeInternalError
	}

	// 领取失败也要把 Status 放进 data 返回，前端才能区分注单不存在、不可领取、金额不匹配等业务状态。
	c.JSON(httpStatus, response.Response{
		Code:    code,
		Message: err.Error(),
		Data:    resp,
	})
}

// 示例 下注余额调整
// func (h *AuthHandler) BetBalance(c *gin.Context) {
// 	var req model.ModifyBalanceRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		response.InvalidParams(c, err.Error())
// 		return
// 	}

// 	userID, exists := c.Get("user_id")
// 	if !exists {
// 		response.Unauthorized(c, "missing user_id in context")
// 		return
// 	}

// 	uid, ok := userID.(uint64)
// 	if !ok {
// 		response.Unauthorized(c, "invalid user_id type")
// 		return
// 	}

// 	resp, err := h.authService.BetBalance(c.Request.Context(), uid, &req)
// 	if err != nil {
// 		response.InternalError(c, fmt.Sprintf("bet balance failed, err:%s", err.Error()))
// 		return
// 	}

// 	response.Success(c, resp)
// }

func (h *AuthHandler) Logout(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		response.Unauthorized(c, "missing authorization header")
		return
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		response.Unauthorized(c, "invalid authorization header format")
		return
	}

	token := parts[1]

	if err := h.authService.Logout(c.Request.Context(), token); err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, model.LogoutResponse{Message: "logged out successfully"})
}

func (h *AuthHandler) LoginByWallet(c *gin.Context) {
	var req model.WalletLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	if strings.ToLower(req.Chain) != "bsc" {
		response.InvalidParams(c, "invalid chain")
		return
	}

	resp, err := h.authService.LoginByWallet(c.Request.Context(), &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidSignature) {
			response.InvalidCredentials(c)
			return
		}
		if errors.Is(err, service.ErrInvalidSession) {
			response.InvalidParams(c, "invalid session or missing signature")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, resp)
}

func (h *AuthHandler) RefreshAccessTokenByRefresh(c *gin.Context) {
	var req model.RefreshAccessTokenByRefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	resp, err := h.authService.RefreshAccessTokenByRefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, resp)
}

// 旧方法，已经使用中间件替代
// // 校验 access token 中的user_id 并返回
// func (h *AuthHandler) validateAccessToken(c *gin.Context) (uint64, error) {
// 	authHeader := c.GetHeader("Authorization")
// 	if authHeader == "" {
// 		response.Unauthorized(c, "missing authorization header")
// 		return 0, errors.New("missing authorization header")
// 	}

// 	parts := strings.SplitN(authHeader, " ", 2)
// 	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
// 		response.Unauthorized(c, "invalid authorization header format")
// 		return 0, errors.New("invalid authorization header format")
// 	}

// 	token := parts[1]

// 	claim, err := h.authService.ValidateAccessToken(token)
// 	if err != nil {
// 		response.Unauthorized(c, fmt.Sprintf("invalid authorization header, vaildate err, err:%s", err.Error()))
// 		return 0, err
// 	}

// 	userID, err := strconv.ParseUint(claim.UserID, 10, 64)
// 	if err != nil {
// 		response.Unauthorized(c, "invalid authorization, userId parse error")
// 		return 0, err
// 	}

// 	return userID, nil
// }

func (h *AuthHandler) GetHistory(c *gin.Context) {
	orderByList := []string{"created_at", "amount"}
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		response.Unauthorized(c, "invalid user_id type")
		return
	}
	var req model.GetBetHistoryRequest
	err := c.ShouldBindQuery(&req)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	// todo 先放开 search 字段
	// if len(req.Search) == 0 {
	// 	//返回报错
	// 	response.InvalidParams(c, "missing search")
	// 	return
	// }

	if req.Page == 0 {
		req.Page = 1
	}

	if req.PageSize == 0 {
		req.PageSize = 20
	}

	if req.PageSize > 50 {
		req.PageSize = 50
	}

	if len(req.OrderBy) == 0 {
		req.OrderBy = "created_at"
	}
	req.OrderBy = strings.ToLower(strings.TrimSpace(req.OrderBy))
	if !lo.Contains(orderByList, req.OrderBy) {
		// History 排序字段最终会进入 GORM Order，必须限制白名单，避免异常字段或注入式输入影响线上查询。
		// @remy youhua
		response.InvalidParams(c, "invalid order_by")
		return
	}

	//默认按更新时间降序
	if len(req.Sort) == 0 {
		req.Sort = "desc"
	}
	req.Sort = strings.ToLower(strings.TrimSpace(req.Sort))
	if !lo.Contains([]string{"asc", "desc"}, req.Sort) {
		response.InvalidParams(c, "invalid sort")
		return
	}

	if !model.IsValidBetHistoryType(req.Type) {
		// type 会驱动资金流水与注单状态的组合查询，提前限制枚举可以避免未知值静默返回空列表。
		response.InvalidParams(c, "invalid type")
		return
	}
	req.Type = model.NormalizeBetHistoryTypeCSV(req.Type)

	req.Result = strings.ToLower(strings.TrimSpace(req.Result))
	if req.Result != "" && !lo.Contains([]string{"all", "won", "lost", "push", "void"}, req.Result) {
		// result 只允许比赛结算终局状态，避免前端把 CLAIMED/CANCELLED 这类资金状态当成赛果筛选。
		response.InvalidParams(c, "invalid result")
		return
	}

	// debug log
	logger.Infof("[GetHistory] get bet history, req:%v", req)
	historyResp, err := h.authService.GetBetHistory(c.Request.Context(), uid, req)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("get bet history failed, err:%s", err.Error()))
		return
	}

	response.Success(c, historyResp)
}

func (h *AuthHandler) GetAssetLedger(c *gin.Context) {
	orderByList := []string{"created_at", "amount"}
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	var req model.AssetLedgerRequest
	err := c.ShouldBindQuery(&req)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	if len(req.OrderBy) == 0 {
		req.OrderBy = "created_at"
	}

	if !lo.Contains(orderByList, req.OrderBy) {
		response.InvalidParams(c, "invalid order_by")
		return
	}

	if len(req.Sort) == 0 {
		req.Sort = "desc"
	}

	if !lo.Contains([]string{"asc", "desc"}, req.Sort) {
		response.InvalidParams(c, "invalid sort")
		return
	}

	depositAddressResp, err := h.authService.GetAssetLedger(c.Request.Context(), uid, req)
	if err != nil {
		response.InternalError(c, fmt.Sprintf("get deposit address failed, err:%s", err.Error()))
		return
	}

	response.Success(c, depositAddressResp)
}

func (h *AuthHandler) GetRecordByOrderSns(c *gin.Context) {
	// 获取传参
	var req model.GetRecordByOrderSnsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	// 获取user_id
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		response.Unauthorized(c, "invalid user_id type")
		return
	}
	logger.Infof("%d check status, orders:%v", uid, req.Orders)
	resp, err := h.authService.GetRecordByOrderSns(c.Request.Context(), req.Orders)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, resp)
}

// 提现申请
// 需要调起eoa钱包签名提现地址
func (h *AuthHandler) WithDrawApply(c *gin.Context) {
	// 获取传参
	var req model.WithDrawApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	// 获取user_id
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	// 检查传参
	// 1.提现金额, 小于1 不给提
	if req.Amount.LessThan(decimal.NewFromInt(1)) {
		response.InvalidParams(c, "withdraw amount is less than 1")
		return
	}
	// 2.提现链符合不
	if !utils.IsSupportWithDrawChain(req.Chain) {
		response.InvalidParams(c, "withdraw chain is invalid")
		return
	}

	// 3.校验提现地址
	if utils.IsEvmChain(req.Chain) {
		if !utils.ValidateEvmAddress(req.WithDrawAddress) {
			response.InvalidParams(c, "withdraw address is invalid")
			return
		}
	}

	// BUG-001 B3：SigTime 时间窗口校验
	//   - 过去窗口 3 min：与提现签名有效期对齐（不变）
	//   - 未来容差 15s：吸收手机端 NTP 漂移（修复前 0 容差 → 客户端钟超前 1s 就拒签）
	// 错误信息不再回吐 now/sig 时间，避免攻击者反向校准服务器墙钟
	// 注：完整重放保护（schema 加 sig_time 列 + 持久化 + uk + nonce 改造）见 TODO-010
	if !isSigTimeValid(req.SigTime, uint64(time.Now().Unix())) {
		response.InvalidParams(c, "withdraw sig time is invalid")
		return
	}

	resp, err := h.authService.WithDrawApply(c.Request.Context(), uid, req)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, resp)
}

// 提现记录获取
func (h *AuthHandler) GetWithDrawRecord(c *gin.Context) {
	// 获取user_id
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	resp, err := h.authService.GetWithDrawRecord(c.Request.Context(), uid)
	if err != nil {
		response.InternalError(c, err.Error())
	}

	response.Success(c, resp)

}

// 提现状态取消
func (h *AuthHandler) WithDrawStatusCancel(c *gin.Context) {
	var req model.WithdrawCancelReqest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	// 获取user_id
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	if len(req.Order) == 0 {
		response.Unauthorized(c, "missing order context")
		return
	}

	err := h.authService.WithDrawCannel(c.Request.Context(), uid, req.Order)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, model.WithdrawCancelResponse{Status: "ok"})
}

// 获取提现手续费
func (h *AuthHandler) GetWithdrawFee(c *gin.Context) {
	var req model.WithdrawFeeRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	// 获取user_id
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "missing user_id in context")
		return
	}

	uid, ok := userID.(uint64)
	if !ok {
		response.Unauthorized(c, "invalid user_id type")
		return
	}

	logger.Infof("[GetWithdrawFee] user_id:%d, withdraw amount:%s", uid, req.Amount.String())

	// 校验金额合理性：必须大于手续费 0.5
	if req.Amount.LessThanOrEqual(decimal.NewFromFloat(0.5)) {
		response.InvalidParams(c, "withdraw amount must be greater than 0.5")
		return
	}

	// 计算手续费和实际金额
	fee := decimal.NewFromFloat(0.5)
	realAmount := req.Amount.Sub(fee)

	response.Success(c, model.WithdrawFeeResponse{
		TotalAmount: req.Amount,
		Fee:         fee,
		RealAmount:  realAmount,
	})
}
