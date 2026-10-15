package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
)

// CORS 严格放行 origin 白名单。
//
// 设计：
//   - origin 字符串完全匹配，不做通配符
//   - Allow-Credentials 跟着 config 走（默认 false，JWT 走 header 不用 cookie）
//   - origin 不在白名单：不写 Access-Control 头，浏览器自然阻断
//   - OPTIONS 预检直接 204，跳过后续 mw 与 handler
func CORS(cfg config.CORSConfig) gin.HandlerFunc {
	allowSet := make(map[string]struct{}, len(cfg.AllowedOrigins))
	for _, o := range cfg.AllowedOrigins {
		allowSet[o] = struct{}{}
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := allowSet[origin]; ok && origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
			// Vary 让 CDN/proxy 知道响应随 Origin 变化，避免缓存到错的 origin 头
			c.Header("Vary", "Origin")
			if cfg.AllowCredentials {
				c.Header("Access-Control-Allow-Credentials", "true")
			}
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
