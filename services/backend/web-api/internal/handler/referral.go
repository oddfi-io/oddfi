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

// 错误码常量（对齐 02-api-contract.md §2）
const (
	errCodeSelfReferral  = 40004
	errCodeInvalidCode   = 40404
	errCodeAlreadyBound  = 40903
)

// ReferralHandler 站点级邀请系统 HTTP handler
type ReferralHandler struct {
	referralSvc service.ReferralService
}

// NewReferralHandler 构造函数，依赖注入 ReferralService
func NewReferralHandler(referralSvc service.ReferralService) *ReferralHandler {
	return &ReferralHandler{referralSvc: referralSvc}
}

// ===========================
// GET /api/v1/referral/me
// ===========================

// GetMyReferralInfo 查当前用户的邀请码 + 邀请人 + 统计
// 响应格式对齐 02-api-contract.md §3.6
func (h *ReferralHandler) GetMyReferralInfo(c *gin.Context) {
	// 从 JWT middleware 注入的上下文读取登录态 user_id
	userID, ok := c.Get("user_id")
	if !ok {
		response.Unauthorized(c, "missing user_id in context")
		return
	}
	uid, ok := userID.(uint64)
	if !ok {
		response.InternalError(c, "invalid user_id type in context")
		return
	}

	info, err := h.referralSvc.GetMyReferralInfo(c.Request.Context(), uid)
	if err != nil {
		logger.Errorf("[ReferralHandler] get referral info failed: user_id=%d err=%v", uid, err)
		response.InternalError(c, "failed to get referral info")
		return
	}

	response.Success(c, info)
}

// ===========================
// POST /api/v1/referral/bind
// ===========================

// bindRequest POST /referral/bind 请求体（对齐 02-api-contract.md §3.7）
type bindRequest struct {
	Code     string `json:"code"     binding:"required"`
	Source   string `json:"source"   binding:"required,oneof=link manual"`
	Business string `json:"business" binding:"required"`
}

// BindReferral 绑定邀请关系
// 响应格式对齐 02-api-contract.md §3.7
func (h *ReferralHandler) BindReferral(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		response.Unauthorized(c, "missing user_id in context")
		return
	}
	uid, ok := userID.(uint64)
	if !ok {
		response.InternalError(c, "invalid user_id type in context")
		return
	}

	// 从 context 读取 EOA 地址（JWT middleware 设置的 address 字段）
	addressVal, _ := c.Get("address")
	eoa, _ := addressVal.(string)
	if eoa == "" {
		response.Unauthorized(c, "missing address in context")
		return
	}

	var req bindRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	resp, err := h.referralSvc.BindReferral(c.Request.Context(), service.BindReferralRequest{
		UserID:     uid,
		EoaAddress: eoa,
		Code:       req.Code,
		Source:     req.Source,
		Business:   req.Business,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidReferralCode):
			// 40404 邀请码不存在
			c.JSON(http.StatusNotFound, response.Response{
				Code:    errCodeInvalidCode,
				Message: "invalid referral code",
				Data:    nil,
			})
		case errors.Is(err, service.ErrSelfReferral):
			// 40004 自邀阻断
			c.JSON(http.StatusBadRequest, response.Response{
				Code:    errCodeSelfReferral,
				Message: "cannot bind your own referral code",
				Data:    nil,
			})
		case errors.Is(err, service.ErrAlreadyBound):
			// 40903 已绑定（前端自动绑场景下静默处理）
			c.JSON(http.StatusConflict, response.Response{
				Code:    errCodeAlreadyBound,
				Message: "referral already bound",
				Data:    nil,
			})
		default:
			logger.Errorf("[ReferralHandler] bind referral failed: user_id=%d err=%v", uid, err)
			response.InternalError(c, "failed to bind referral")
		}
		return
	}

	response.Success(c, resp)
}

// ===========================
// GET /api/v1/referral/list
// ===========================

// GetReferredList 查我邀请的用户列表（含每人 presale deposit 明细）
// 响应格式对齐 02-api-contract.md §3.8
func (h *ReferralHandler) GetReferredList(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		response.Unauthorized(c, "missing user_id in context")
		return
	}
	uid, ok := userID.(uint64)
	if !ok {
		response.InternalError(c, "invalid user_id type in context")
		return
	}

	// 分页参数，默认 page=1, size=20，size 上限 100
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
	business := c.Query("business") // 可选，空字符串 = 不筛选

	list, err := h.referralSvc.ListReferred(c.Request.Context(), uid, business, page, size)
	if err != nil {
		logger.Errorf("[ReferralHandler] list referred failed: user_id=%d err=%v", uid, err)
		response.InternalError(c, "failed to list referred users")
		return
	}

	response.Success(c, list)
}
