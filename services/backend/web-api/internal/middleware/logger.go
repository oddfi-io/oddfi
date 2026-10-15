package middleware

import (
	"bytes"
	"io"
	"time"

	"github.com/gin-gonic/gin"
	"everything_finance/org/web-api/internal/pkg/logger"
)

type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// IsSensitiveBodyPath 暴露给同包测试用：判定路径是否在脱敏黑名单内。
// 黑名单语义见 sensitiveBodyPaths。
func IsSensitiveBodyPath(path string) bool {
	_, ok := sensitiveBodyPaths[path]
	return ok
}

// sensitiveBodyPaths：这些路径的请求体含签名/凭据等可重放素材，禁止全量打到 info 日志。
// 命中后只记录 body 长度，避免 access log 变成"重放素材库"。
//
// BUG-001 v3 round（security CRIT-1）：在 withdraw_record 表加 sig_time 列 + DB uk 兜底
// 落地（TODO-010）之前，access log 是签名重放的最大泄漏面，必须脱敏。
var sensitiveBodyPaths = map[string]struct{}{
	"/account/withdraw/apply":      {}, // 含 withdraw_sig + sig_time
	"/account/login_by_wallet":     {}, // step2 含签名 + nonce
	"/account/refresh_token":       {}, // refresh_token 长期凭据
	"/api/v1/referral/bind":        {}, // 邀请码绑定（含 EOA），低敏但同型策略
}

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		var bodyBytes []byte
		if c.Request.Body != nil {
			bodyBytes, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method

		_ = map[string]interface{}{
			"status":     status,
			"latency":    latency.String(),
			"client_ip":  clientIP,
			"method":     method,
			"path":       path,
			"query":      query,
			"body_size":  len(bodyBytes),
			"resp_size":  c.Writer.Size(),
		}

		logger.Infof("[GIN] %v | %3d | %13v | %15s | %-7s %s",
			time.Now().Format("2006/01/02 - 15:04:05"),
			status,
			latency,
			clientIP,
			method,
			path,
		)

		if query != "" {
			logger.Infof("         Query: %s", query)
		}
		if len(bodyBytes) > 0 {
			if _, sensitive := sensitiveBodyPaths[path]; sensitive {
				// 敏感路径：只记长度，body 内容不入日志
				logger.Infof("         Body: <redacted len=%d>", len(bodyBytes))
			} else {
				logger.Infof("         Body: %s", string(bodyBytes))
			}
		}
		if status >= 400 {
			// 4xx 响应已在 handler 层做错误信息脱敏（如 SigTime "withdraw sig time is invalid"）；
			// 这里保留 response 打印用于运维 debug。如发现新泄漏面再扩展同路径黑名单。
			logger.Infof("         Response: %s", blw.body.String())
		}
	}
}
