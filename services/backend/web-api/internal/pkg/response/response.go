package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

type PageResult struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

const (
	CodeSuccess            = 0
	CodeBadRequest         = 400
	CodeUnauthorized       = 401
	CodeForbidden          = 403
	CodeNotFound           = 404
	CodeConflict           = 409
	CodeInternalError      = 500
	CodeInvalidParams      = 1001
	CodeInvalidCredentials = 1002
	CodeTokenExpired       = 1003
	CodeTokenInvalid       = 1004
	CodeUserNotFound       = 1005
	CodeUserAlreadyExists  = 1006
	CodeRateLimitExceeded  = 1007
)

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    CodeSuccess,
		Message: "success",
		Data:    data,
	})
}

func SuccessWithMessage(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    CodeSuccess,
		Message: message,
		Data:    data,
	})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{
		Code:    CodeSuccess,
		Message: "created",
		Data:    data,
	})
}

func Error(c *gin.Context, httpStatus int, code int, message string) {
	c.JSON(httpStatus, Response{
		Code:    code,
		Message: message,
		Data:    nil,
	})
}

func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, CodeBadRequest, message)
}

func InvalidParams(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, CodeInvalidParams, message)
}

func Unauthorized(c *gin.Context, message string) {
	Error(c, http.StatusUnauthorized, CodeUnauthorized, message)
}

func InvalidCredentials(c *gin.Context) {
	Error(c, http.StatusUnauthorized, CodeInvalidCredentials, "invalid credentials")
}

func TokenExpired(c *gin.Context) {
	Error(c, http.StatusUnauthorized, CodeTokenExpired, "token has expired")
}

func TokenInvalid(c *gin.Context) {
	Error(c, http.StatusUnauthorized, CodeTokenInvalid, "invalid token")
}

func Forbidden(c *gin.Context, message string) {
	Error(c, http.StatusForbidden, CodeForbidden, message)
}

func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, CodeNotFound, message)
}

func UserNotFound(c *gin.Context) {
	Error(c, http.StatusNotFound, CodeUserNotFound, "user not found")
}

func UserAlreadyExists(c *gin.Context) {
	Error(c, http.StatusConflict, CodeUserAlreadyExists, "user already exists")
}

func InternalError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, CodeInternalError, message)
}

func RateLimitExceeded(c *gin.Context) {
	Error(c, http.StatusTooManyRequests, CodeRateLimitExceeded, "rate limit exceeded")
}
