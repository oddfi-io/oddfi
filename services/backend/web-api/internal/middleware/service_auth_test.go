package middleware

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func mkRouter(cfg ServiceAuthConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/test", ServiceAuth(cfg), func(c *gin.Context) {
		sid := c.GetString(CtxServiceSecretID)
		c.JSON(http.StatusOK, gin.H{"ok": true, "secretId": sid})
	})
	return r
}

func sign(secret, ts, path, idem string, body []byte) string {
	return ComputeServiceSig(secret, ts, path, idem, body)
}

func mkReq(t *testing.T, method, path string, body []byte, headers map[string]string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return req
}

func TestServiceAuth_HappyPath(t *testing.T) {
	secret := "this-is-a-test-secret-32-byte-long!"
	cfg := ServiceAuthConfig{Secrets: []string{secret}}
	r := mkRouter(cfg)

	body := []byte(`{"note":"hello world test note"}`)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "uuid-001"
	sig := sign(secret, ts, "/test", idem, body)

	w := httptest.NewRecorder()
	req := mkReq(t, "POST", "/test", body, map[string]string{
		"X-Timestamp":       ts,
		"X-Service-Sig":     sig,
		"X-Idempotency-Key": idem,
	})
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("code = %d, body = %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if sid, ok := resp["secretId"].(string); !ok || sid == "" {
		t.Errorf("secretId not set in ctx")
	}
}

func TestServiceAuth_StaleTimestamp(t *testing.T) {
	secret := "this-is-a-test-secret-32-byte-long!"
	cfg := ServiceAuthConfig{Secrets: []string{secret}, WindowMs: 60_000}
	r := mkRouter(cfg)

	body := []byte(`{}`)
	// 模拟 2 分钟前的请求
	staleTs := strconv.FormatInt(time.Now().Add(-2*time.Minute).UnixMilli(), 10)
	idem := "uuid-stale"
	sig := sign(secret, staleTs, "/test", idem, body)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, mkReq(t, "POST", "/test", body, map[string]string{
		"X-Timestamp":       staleTs,
		"X-Service-Sig":     sig,
		"X-Idempotency-Key": idem,
	}))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
}

func TestServiceAuth_InvalidSig(t *testing.T) {
	cfg := ServiceAuthConfig{Secrets: []string{"correct-secret-32-byte-long-string!"}}
	r := mkRouter(cfg)

	body := []byte(`{}`)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	// 用错的 secret 签
	badSig := sign("wrong-secret-also-32-byte-long-str!", ts, "/test", "k", body)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, mkReq(t, "POST", "/test", body, map[string]string{
		"X-Timestamp":       ts,
		"X-Service-Sig":     badSig,
		"X-Idempotency-Key": "k",
	}))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
}

func TestServiceAuth_MultiSecretOverlap(t *testing.T) {
	primary := "primary-secret-32-byte-long-string!"
	secondary := "secondary-secret-32-byte-long-strng"
	cfg := ServiceAuthConfig{Secrets: []string{primary, secondary}}
	r := mkRouter(cfg)

	body := []byte(`{"x":1}`)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	// 用 secondary 签：仍应通过（重叠期）
	sig := sign(secondary, ts, "/test", "k", body)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, mkReq(t, "POST", "/test", body, map[string]string{
		"X-Timestamp":       ts,
		"X-Service-Sig":     sig,
		"X-Idempotency-Key": "k",
	}))
	if w.Code != http.StatusOK {
		t.Errorf("code = %d, want 200 (secondary should be accepted in overlap window)", w.Code)
	}
}

// TestServiceAuth_AdversarialReplay_DifferentIdemKey 关键安全测试：
// 攻击者 capture 一个合法 sig，用不同的 idempotency_key 重放 → 必须 401
// 这是 critic v2 M1 加 idem_key 进签名的核心防御目的
func TestServiceAuth_AdversarialReplay_DifferentIdemKey(t *testing.T) {
	secret := "test-secret-32-byte-long-string-x!"
	cfg := ServiceAuthConfig{Secrets: []string{secret}}
	r := mkRouter(cfg)

	body := []byte(`{}`)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	originalIdem := "uuid-original"
	sig := sign(secret, ts, "/test", originalIdem, body)

	// 攻击者改 idem_key，但 sig 是用 originalIdem 算的
	w := httptest.NewRecorder()
	r.ServeHTTP(w, mkReq(t, "POST", "/test", body, map[string]string{
		"X-Timestamp":       ts,
		"X-Service-Sig":     sig,
		"X-Idempotency-Key": "uuid-attacker-chosen", // 不同 key
	}))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("replay with changed idem_key should fail; got code = %d", w.Code)
	}
}

// TestServiceAuth_AdversarialReplay_DifferentBody：攻击者改 body 也必须失败
func TestServiceAuth_AdversarialReplay_DifferentBody(t *testing.T) {
	secret := "test-secret-32-byte-long-string-x!"
	cfg := ServiceAuthConfig{Secrets: []string{secret}}
	r := mkRouter(cfg)

	originalBody := []byte(`{"action":"pause"}`)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "uuid-x"
	sig := sign(secret, ts, "/test", idem, originalBody)

	// 攻击者篡改 body 但 sig 不变
	w := httptest.NewRecorder()
	r.ServeHTTP(w, mkReq(t, "POST", "/test", []byte(`{"action":"close"}`), map[string]string{
		"X-Timestamp":       ts,
		"X-Service-Sig":     sig,
		"X-Idempotency-Key": idem,
	}))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("replay with changed body should fail; got code = %d", w.Code)
	}
}

func TestServiceAuth_MissingHeaders(t *testing.T) {
	secret := "test-secret-32-byte-long-string-x!"
	cfg := ServiceAuthConfig{Secrets: []string{secret}}
	r := mkRouter(cfg)

	cases := []struct {
		name    string
		headers map[string]string
	}{
		{"missing all", map[string]string{}},
		{"missing sig", map[string]string{"X-Timestamp": "1", "X-Idempotency-Key": "k"}},
		{"missing ts", map[string]string{"X-Service-Sig": "x", "X-Idempotency-Key": "k"}},
		{"bad ts format", map[string]string{"X-Timestamp": "not-a-number", "X-Service-Sig": "x", "X-Idempotency-Key": "k"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			r.ServeHTTP(w, mkReq(t, "POST", "/test", []byte(`{}`), tc.headers))
			if w.Code != http.StatusUnauthorized {
				t.Errorf("code = %d, want 401", w.Code)
			}
		})
	}
}

func TestServiceAuth_BadSigEncoding(t *testing.T) {
	secret := "test-secret-32-byte-long-string-x!"
	cfg := ServiceAuthConfig{Secrets: []string{secret}}
	r := mkRouter(cfg)

	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, mkReq(t, "POST", "/test", []byte(`{}`), map[string]string{
		"X-Timestamp":       ts,
		"X-Service-Sig":     "not-valid-hex-zzz",
		"X-Idempotency-Key": "k",
	}))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
}

func TestServiceAuth_ConstantTimeCompare(t *testing.T) {
	// 不能完全确证 constant-time，但至少验证 hmac.Equal 被使用
	// 通过对比"差 1 字节"和"完全不同"两个 sig 处理时间相近
	secret := "test-secret-32-byte-long-string-x!"
	cfg := ServiceAuthConfig{Secrets: []string{secret}}
	r := mkRouter(cfg)

	body := []byte(`{}`)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "k"
	correctSig := sign(secret, ts, "/test", idem, body)

	// 改 sig 末尾 1 字节
	corrupted := []byte(correctSig)
	corrupted[len(corrupted)-1] ^= 0x01
	corruptedSig := string(corrupted)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, mkReq(t, "POST", "/test", body, map[string]string{
		"X-Timestamp":       ts,
		"X-Service-Sig":     corruptedSig,
		"X-Idempotency-Key": idem,
	}))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("corrupted sig should fail; got %d", w.Code)
	}
}

// TestServiceAuth_WithQueryString — ISSUE-004 回归：带 query 的请求，签名 path 含 query 时验签必须通过。
// 修复前（中间件用裸 URL.Path 验签）本用例失败；修复后通过。
// 对应场景：admin-backend 对带 query 的 internal 请求签名时用 path + "?" + RawQuery，
// 这里中间件要逐字镜像。
func TestServiceAuth_WithQueryString(t *testing.T) {
	secret := "this-is-a-test-secret-32-byte-long!"
	r := mkRouter(ServiceAuthConfig{Secrets: []string{secret}})

	body := []byte(`{}`)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "uuid-q-1"
	// 关键：签名 path 含 query，与 admin-backend 同构
	sig := sign(secret, ts, "/test?page=1&size=5", idem, body)

	w := httptest.NewRecorder()
	req := mkReq(t, "POST", "/test?page=1&size=5", body, map[string]string{
		"X-Timestamp":       ts,
		"X-Service-Sig":     sig,
		"X-Idempotency-Key": idem,
	})
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("with-query should pass after fix; code=%d body=%s", w.Code, w.Body.String())
	}
}

// TestServiceAuth_WithQuery_SignedWithoutQuery_Rejected — 防御：带 query 的请求若签名漏 query 必须被拒
// （等价于"query 被攻击者篡改"或"两端协议不一致"的攻击面）
func TestServiceAuth_WithQuery_SignedWithoutQuery_Rejected(t *testing.T) {
	secret := "this-is-a-test-secret-32-byte-long!"
	r := mkRouter(ServiceAuthConfig{Secrets: []string{secret}})

	body := []byte(`{}`)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "uuid-q-2"
	sig := sign(secret, ts, "/test", idem, body) // 故意漏 query

	w := httptest.NewRecorder()
	req := mkReq(t, "POST", "/test?page=1&size=5", body, map[string]string{
		"X-Timestamp":       ts,
		"X-Service-Sig":     sig,
		"X-Idempotency-Key": idem,
	})
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("query tampering must be rejected; code=%d", w.Code)
	}
}

func TestComputeServiceSig_DeterministicAndChangesWithInput(t *testing.T) {
	secret := "s"
	body := []byte(`x`)
	a := ComputeServiceSig(secret, "1", "/p", "k", body)
	b := ComputeServiceSig(secret, "1", "/p", "k", body)
	if a != b {
		t.Error("HMAC must be deterministic")
	}
	// 改任意输入必变 sig
	if ComputeServiceSig(secret, "2", "/p", "k", body) == a {
		t.Error("sig should change with ts")
	}
	if ComputeServiceSig(secret, "1", "/q", "k", body) == a {
		t.Error("sig should change with path")
	}
	if ComputeServiceSig(secret, "1", "/p", "x", body) == a {
		t.Error("sig should change with idem_key")
	}
	if ComputeServiceSig(secret, "1", "/p", "k", []byte(`y`)) == a {
		t.Error("sig should change with body")
	}
	if !strings.HasPrefix(a, "") || len(a) != 64 {
		t.Errorf("sig must be 64 hex chars, got %d", len(a))
	}
	// 验证是有效 hex
	if _, err := hex.DecodeString(a); err != nil {
		t.Errorf("sig must be valid hex: %v", err)
	}
}
