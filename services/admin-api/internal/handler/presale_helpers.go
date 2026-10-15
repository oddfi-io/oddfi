package handler

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// presaleJSONBinding 返回 gin JSON BindingBody 实例，供 ShouldBindBodyWith 使用。
// audit middleware 已用 ShouldBindBodyWith 读取 body（解析 note 字段），
// handler 内必须用相同方式再次读取，否则 body 已被消费会报 EOF。
func presaleJSONBinding(_ *gin.Context) binding.BindingBody {
	return binding.JSON
}

// presaleProxyErr 将 web-api client 返回的错误映射为标准 HTTP 响应（GET/只读接口用）。
// 不调用 c.Abort()，因为只读接口不经过 audit middleware 事务。
func presaleProxyErr(c *gin.Context, err error, action string) {
	httpErr, ok := client.IsHTTPError(err)
	if ok {
		// 透传 web-api 的 HTTP 状态码和 body（让前端直接看到业务错误）
		c.AbortWithStatusJSON(httpErr.StatusCode, proxyErrBody(httpErr))
		return
	}
	logger.L().Error().Err(err).Str("action", action).Msg("[PresaleProxy] webapi client error")
	response.Internal(c, errcode.InternalError, "internal error")
}

// presaleAbortErr 将 web-api client 返回的错误映射为标准 HTTP 响应（写接口用），
// 同时调用 c.Abort() 触发 audit middleware 回滚事务。
func presaleAbortErr(c *gin.Context, err error, action string) {
	presaleProxyErr(c, err, action)
	c.Abort()
}

// proxyErrBody 从 HTTPError body（JSON 字符串）中提取 code/message，
// 若解析失败则返回通用错误体。
func proxyErrBody(httpErr *client.HTTPError) gin.H {
	var parsed struct {
		Code    any    `json:"code"`
		Message string `json:"message"`
	}
	// 尝试解析 web-api 的标准错误格式
	if err := jsonUnmarshalString(httpErr.Body, &parsed); err == nil && parsed.Code != nil {
		return gin.H{
			"code":    parsed.Code,
			"message": parsed.Message,
			"data":    nil,
		}
	}
	// 降级：返回状态码对应的通用错误
	return gin.H{
		"code":    errcode.InternalError,
		"message": fmt.Sprintf("upstream error (HTTP %d)", httpErr.StatusCode),
		"data":    nil,
	}
}

// jsonUnmarshalString 反序列化 JSON 字符串到 v。
func jsonUnmarshalString(s string, v any) error {
	return json.NewDecoder(strings.NewReader(s)).Decode(v)
}

// validateDecimalPtr 已在 presale_round.go 中定义（同包可直接引用）。
// extractJWT / stripBearer / requireIdempotencyKey 定义在 presale_round.go 中。
