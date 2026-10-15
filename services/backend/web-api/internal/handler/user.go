package handler

import (
	"errors"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/response"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userService service.UserService
}

func NewUserHandler(userService service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

func (h *UserHandler) GetPendingOrders(c *gin.Context) {
	var req model.GetPendingOrdersRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}
	if req.User == "" || req.Password == "" {
		response.InvalidParams(c, "user and password are required")
		return
	}

	resp, err := h.userService.GetPendingOrders(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrAdminUserNotFound) ||
			errors.Is(err, service.ErrAdminInvalidCredentials) {
			response.Unauthorized(c, "invalid user or password")
			return
		}
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, resp)
}

func (h *UserHandler) ApproveOrder(c *gin.Context) {
	var req model.ApproveOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	err := h.userService.ApproveOrder(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrAdminUserNotFound) ||
			errors.Is(err, service.ErrAdminInvalidCredentials) {
			response.Unauthorized(c, "invalid user or password")
			return
		}
		if errors.Is(err, repository.ErrWithdrawRecordNotFound) {
			response.InvalidParams(c, "order not found")
			return
		}
		if errors.Is(err, repository.ErrOrderOverStatus) {
			response.InvalidParams(c, "order was over status")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, nil)
}

func (h *UserHandler) OrderInfo(c *gin.Context) {
	var req model.OrderInfoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	resp, err := h.userService.OrderInfo(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrAdminUserNotFound) ||
			errors.Is(err, service.ErrAdminInvalidCredentials) {
			response.Unauthorized(c, "invalid user or password")
			return
		}
		response.InternalError(c, err.Error())
		return
	}

	response.Success(c, resp)
}
