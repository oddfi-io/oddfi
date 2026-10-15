package middleware

import "github.com/gin-gonic/gin"

// SecurityHeaders 注入一组通用安全响应头。
//
// - X-Content-Type-Options: nosniff      防止浏览器 MIME 嗅探
// - X-Frame-Options: DENY                禁止被 iframe 嵌入（点击劫持防御）
// - Referrer-Policy: no-referrer         避免 URL（含 ?token=）通过 Referer 泄漏到第三方
// - Strict-Transport-Security            告知浏览器一年内强制 HTTPS（生产由 Nginx 终止 TLS 时也带）
// - Cache-Control: no-store              admin 后台无静态资源，全局禁缓存，避免 token / 敏感数据落 CDN
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Header("Cache-Control", "no-store")
		c.Next()
	}
}
