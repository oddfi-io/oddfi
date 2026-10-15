// Package response 统一 HTTP 响应包装。
//
// 所有 handler 通过本包返回响应，前端解析格式固定为 ApiResponse。
// 业务错误（code 非 0）也走 HTTP 200，特殊状态码（401/403/500）才用 HTTP 状态码。
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ApiResponse 是统一响应结构。
//
//	code 为 0 表示成功；非 0 时为业务错误码字符串（见 errcode 包）。
type ApiResponse struct {
	Code    any    `json:"code"` // 0 (int) 或 string（业务错误码）
	Message string `json:"message"`
	Data    any    `json:"data"`
}

// OK 返回 HTTP 200 + code 0。
func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, ApiResponse{Code: 0, Message: "ok", Data: data})
}

// Error 返回指定 HTTP 状态 + 错误码字符串。
func Error(c *gin.Context, httpStatus int, code, message string) {
	c.JSON(httpStatus, ApiResponse{Code: code, Message: message, Data: nil})
}

// Unauthorized 返回 401。
func Unauthorized(c *gin.Context, code, message string) {
	Error(c, http.StatusUnauthorized, code, message)
}

// Forbidden 返回 403。
func Forbidden(c *gin.Context, code, message string) {
	Error(c, http.StatusForbidden, code, message)
}

// BadRequest 返回 400。
func BadRequest(c *gin.Context, code, message string) {
	Error(c, http.StatusBadRequest, code, message)
}

// Internal 返回 500。
func Internal(c *gin.Context, code, message string) {
	Error(c, http.StatusInternalServerError, code, message)
}
