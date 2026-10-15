package middleware_test

// BUG-001 v3 round security CRIT-1 回归保护：
// 防止未来有人误删 sensitiveBodyPaths 黑名单条目，让签名素材重新泄漏到 access log。
//
// 测试策略：
//  1. 断言黑名单 map 必含的核心路径（防误删）
//  2. httptest 真打中间件，确认敏感 + 非敏感路径都不 panic、响应正常
//     （实际日志脱敏行为靠 staging spot check / prod log audit）

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"everything_finance/org/web-api/internal/middleware"
)

// TestSensitiveBodyPaths_ContainsCritical：黑名单**必含**这些路径，否则 v3 round CRIT-1 回归
func TestSensitiveBodyPaths_ContainsCritical(t *testing.T) {
	required := []string{
		"/account/withdraw/apply",  // CRIT-1 主目标：含 withdraw_sig + sig_time
		"/account/login_by_wallet", // step2 含签名 + nonce
		"/account/refresh_token",   // refresh_token 长期凭据
		"/api/v1/referral/bind",    // 含 EOA（低敏但同型策略）
	}
	for _, p := range required {
		t.Run(p, func(t *testing.T) {
			if !middleware.IsSensitiveBodyPath(p) {
				t.Errorf("path %q MUST be in sensitiveBodyPaths (BUG-001 v3 CRIT-1 regression). "+
					"如果你删除该黑名单条目，请同步评估签名素材是否仍会泄漏到 access log", p)
			}
		})
	}
}

// TestSensitiveBodyPaths_PublicPathsNotBlocked：常规公共路径不应被加入黑名单（否则运维 debug 受阻）
func TestSensitiveBodyPaths_PublicPathsNotBlocked(t *testing.T) {
	publicPaths := []string{
		"/api/v1/presale/config",
		"/api/v1/presale/position",
		"/api/v1/referral/list",
		"/health",
	}
	for _, p := range publicPaths {
		t.Run(p, func(t *testing.T) {
			if middleware.IsSensitiveBodyPath(p) {
				t.Errorf("path %q 不应在脱敏黑名单内（会阻碍运维 debug）", p)
			}
		})
	}
}

// TestLogger_DoesNotPanicOnSensitivePath：敏感路径走完中间件后正常返回，不 panic
// 实际"body 被替换成 <redacted>" 行为依赖全局 zerolog stdout，本测试不拦截日志，
// 只验证 middleware 不破坏请求/响应链。完整 stdout 验证留 staging spot check。
func TestLogger_DoesNotPanicOnSensitivePath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.Logger())
	r.POST("/account/withdraw/apply", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// 模拟真实 withdraw 请求 body — 含签名素材
	body := bytes.NewBufferString(`{"amount":"100","withdraw_address":"0xabc","sig_time":1779860005,"withdraw_sig":"0xdeadbeef","chain":"bsc"}`)
	req := httptest.NewRequest(http.MethodPost, "/account/withdraw/apply", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("敏感路径请求应正常返回 200，实际 = %d body=%s", w.Code, w.Body.String())
	}
}

// TestLogger_DoesNotPanicOnPublicPath：非敏感路径走完中间件后也正常返回
func TestLogger_DoesNotPanicOnPublicPath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.Logger())
	r.GET("/api/v1/presale/config", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"vault": "0xabc"})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/presale/config", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("非敏感路径请求应正常返回 200，实际 = %d", w.Code)
	}
}
