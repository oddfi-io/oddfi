package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	// CtxRequestID 是 gin.Context 中 request_id 的 key。
	CtxRequestID = "request_id"
	// HeaderRequestID 是请求/响应头中携带 request_id 的字段名。
	HeaderRequestID = "X-Request-ID"
)

// RequestID 注入 X-Request-ID 到 gin.Context 和响应头。
//
// 优先取请求头传入的值（便于上游 Nginx / 网关注入做链路追踪），
// 缺失时生成 uuid v4。日志模块通过 c.GetString(CtxRequestID) 取用。
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(HeaderRequestID)
		if id == "" {
			id = uuid.NewString()
		}
		c.Set(CtxRequestID, id)
		c.Writer.Header().Set(HeaderRequestID, id)
		c.Next()
	}
}
