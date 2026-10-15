// Package middleware — admin internal endpoint 的 service-to-service 鉴权。
//
// 设计要点（DD-003 v3.1 §4.2.1 + critic v2 M1 + critic v3 安全建议）：
//
//   - HMAC-SHA256 签名机制，secret 在 systemd EnvironmentFile 注入
//   - 60s timestamp 窗口（v3 从 5min 收紧）防 replay
//   - X-Idempotency-Key 参与签名 → sig 与 key 绑定，跨 key replay 自动失败
//   - 支持多 secret 重叠期（轮换不停机），audit 记录命中的 secret_id
//
// header 约定：
//
//	X-Timestamp:      <epoch milliseconds>
//	X-Service-Sig:    hex(HMAC-SHA256(secret, ts + ":" + path + ":" + idempotency_key + ":" + sha256(body)))
//	X-Idempotency-Key: <UUIDv4>
package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ServiceAuthConfig 是 service auth middleware 的配置。
type ServiceAuthConfig struct {
	// Secrets 支持多 secret 重叠期，admin/web-api 轮换时双侧同时配两个 secret。
	// 第一个 secret 即为 primary（生成新 sig 用）；其他为兼容旧 sig。
	Secrets []string
	// WindowMs 是 timestamp 容忍窗口（双向），默认 60_000 ms（60s）。
	// 太短易因时钟漂移误拒；太长易被 replay。
	WindowMs int64
	// Now 函数，单测注入；nil 时用 time.Now。
	Now func() time.Time
}

// CtxServiceSecretID 是命中 secret 在 ctx 的 key（audit 中间件读取后落库）。
const CtxServiceSecretID = "service_secret_id"

// ServiceAuth 返回验证 X-Service-Sig 的 gin middleware。
//
// 校验失败统一返 401 + 简短 message；不暴露内部签名细节防 fingerprint。
func ServiceAuth(cfg ServiceAuthConfig) gin.HandlerFunc {
	if cfg.WindowMs <= 0 {
		cfg.WindowMs = 60_000
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	// 预计算 secret_id（base16 短哈希）便于 audit 字段
	secretIDs := make([]string, len(cfg.Secrets))
	for i, s := range cfg.Secrets {
		secretIDs[i] = hashSecretID(s)
	}

	return func(c *gin.Context) {
		tsStr := c.GetHeader("X-Timestamp")
		sig := c.GetHeader("X-Service-Sig")
		idemKey := c.GetHeader("X-Idempotency-Key")

		if tsStr == "" || sig == "" {
			abortUnauthorized(c, "missing X-Timestamp or X-Service-Sig")
			return
		}

		ts, err := strconv.ParseInt(tsStr, 10, 64)
		if err != nil {
			abortUnauthorized(c, "invalid X-Timestamp format")
			return
		}
		now := cfg.Now().UnixMilli()
		if absInt64(now-ts) > cfg.WindowMs {
			abortUnauthorized(c, "stale X-Timestamp")
			return
		}

		// 读 body（必须可重读供后续 handler 用）
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			abortUnauthorized(c, "failed to read body")
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		bodyHash := sha256.Sum256(body)
		// ISSUE-004：重建与 admin-backend 签名侧逐字一致的 path（含 query）。
		// admin-backend 对带 query 的 internal 请求签名时用的是 path + "?" + RawQuery
		//（见 oddfi-admin-backend/internal/handler/presale_audit.go），这里必须同构，
		// 否则带 query 的请求验签全挂（rounds/config 等无 query 路径恰好相安无事）。
		// 同时把 query 纳入签名保护，攻击者篡改 query 会破坏签名。
		reqPath := c.Request.URL.Path
		if c.Request.URL.RawQuery != "" {
			reqPath += "?" + c.Request.URL.RawQuery
		}
		payload := tsStr + ":" + reqPath + ":" + idemKey + ":" + hex.EncodeToString(bodyHash[:])

		// 遍历 secrets，constant-time 比较防 timing 攻击
		expectedSigBytes := make([]byte, hex.DecodedLen(len(sig)))
		_, decErr := hex.Decode(expectedSigBytes, []byte(sig))
		if decErr != nil {
			abortUnauthorized(c, "invalid X-Service-Sig encoding")
			return
		}
		for i, secret := range cfg.Secrets {
			if secret == "" {
				continue
			}
			h := hmac.New(sha256.New, []byte(secret))
			h.Write([]byte(payload))
			actual := h.Sum(nil)
			if hmac.Equal(actual, expectedSigBytes) {
				c.Set(CtxServiceSecretID, secretIDs[i])
				c.Next()
				return
			}
		}
		abortUnauthorized(c, "invalid X-Service-Sig")
	}
}

// ComputeServiceSig 是 client（admin-backend）签名的工具函数，与 ServiceAuth 验签算法对齐。
// 暴露在本包以便 client + middleware 共用，避免算法漂移。
func ComputeServiceSig(secret, tsMs, path, idempotencyKey string, body []byte) string {
	bodyHash := sha256.Sum256(body)
	payload := tsMs + ":" + path + ":" + idempotencyKey + ":" + hex.EncodeToString(bodyHash[:])
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

// hashSecretID 取 secret SHA256 的前 8 字节 hex（16 字符），用于 audit 字段。
// 不可逆，泄漏排查友好。
func hashSecretID(secret string) string {
	if secret == "" {
		return ""
	}
	h := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(h[:8])
}

func absInt64(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}

func abortUnauthorized(c *gin.Context, _ string) {
	// 不把内部 message 暴露给客户端（防 fingerprint）
	// 内部 message 走 logger（caller 责任）
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"code":    "SERVICE_SIG_INVALID",
		"message": "service signature invalid",
	})
}
