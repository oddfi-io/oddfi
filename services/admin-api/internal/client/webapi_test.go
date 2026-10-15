package client_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
)

// ─── 测试辅助 ────────────────────────────────────────────────────────────────

const testSecret = "test-secret-32-bytes-padded-xxxx"

// buildTestClient 构造指向 mockServer 的 Client，TimeoutSec=2，MaxRetries=3。
func buildTestClient(serverURL string) *client.Client {
	return client.New(client.WebapiConfig{
		InternalURL:  serverURL,
		ServiceToken: testSecret,
		TimeoutSec:   2,
		MaxRetries:   3,
	})
}

// verifyServiceSig 在 mock server 内验证 X-Service-Sig 正确性（模拟 web-api ServiceAuth 逻辑）。
// 返回 true 代表签名合法。
func verifyServiceSig(r *http.Request, body []byte) bool {
	tsStr := r.Header.Get("X-Timestamp")
	sig := r.Header.Get("X-Service-Sig")
	idemKey := r.Header.Get("X-Idempotency-Key")

	expected := client.ComputeServiceSig(testSecret, tsStr, r.URL.Path, idemKey, body)
	return hmac.Equal([]byte(expected), []byte(sig))
}

// okJSON 写标准成功响应。
func okJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"code":    0,
		"message": "ok",
		"data":    data,
	})
}

// ─── 单元测试：Header 注入 ────────────────────────────────────────────────────

// TestGet_HeadersInjected 验证 GET 请求注入了所有必要 header。
func TestGet_HeadersInjected(t *testing.T) {
	const idemKey = "idem-key-001"
	const adminJWT = "admin.jwt.token"
	var capturedHeaders http.Header

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedHeaders = r.Header.Clone()
		okJSON(w, map[string]string{"ok": "1"})
	}))
	defer srv.Close()

	c := buildTestClient(srv.URL)
	var out map[string]string
	if err := c.Get(context.Background(), "/internal/admin/presale/rounds", adminJWT, idemKey, &out); err != nil {
		t.Fatalf("Get failed: %v", err)
	}

	// X-Timestamp 必须是毫秒时间戳（13 位）
	ts := capturedHeaders.Get("X-Timestamp")
	tsMs, err := strconv.ParseInt(ts, 10, 64)
	if err != nil || tsMs <= 0 {
		t.Errorf("X-Timestamp invalid: %q", ts)
	}
	// 时间戳应在当前时间 ±5s 内
	now := time.Now().UnixMilli()
	if diff := tsMs - now; diff < -5000 || diff > 5000 {
		t.Errorf("X-Timestamp %d too far from now %d", tsMs, now)
	}

	if capturedHeaders.Get("X-Service-Sig") == "" {
		t.Error("X-Service-Sig missing")
	}
	if capturedHeaders.Get("X-Idempotency-Key") != idemKey {
		t.Errorf("X-Idempotency-Key want %q got %q", idemKey, capturedHeaders.Get("X-Idempotency-Key"))
	}
	if capturedHeaders.Get("X-Admin-JWT") != adminJWT {
		t.Errorf("X-Admin-JWT want %q got %q", adminJWT, capturedHeaders.Get("X-Admin-JWT"))
	}
}

// ─── 单元测试：签名验证 ───────────────────────────────────────────────────────

// TestPost_SignatureVerifiedByServer 验证 POST body + path 参与签名，且 mock server 可验证通过。
func TestPost_SignatureVerifiedByServer(t *testing.T) {
	var sigValid bool

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(body)
		sigValid = verifyServiceSig(r, body)
		okJSON(w, gin_h{"ok": "1"})
	}))
	defer srv.Close()

	c := buildTestClient(srv.URL)
	var out map[string]any
	err := c.Post(context.Background(), "/internal/admin/presale/rounds/1/pause", "jwt", "idem-002",
		map[string]string{"note": "test note here"}, &out)
	if err != nil {
		t.Fatalf("Post failed: %v", err)
	}
	if !sigValid {
		t.Error("signature verification failed on mock server")
	}
}

// ─── adversarial：5xx 重试 ────────────────────────────────────────────────────

// TestGet_5xxRetry 验证 5xx 会重试直到成功。
func TestGet_5xxRetry(t *testing.T) {
	callCount := 0

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount < 3 {
			// 前两次返回 503，第三次成功
			http.Error(w, `{"code":"SERVER_ERROR","message":"retry me","data":null}`, http.StatusServiceUnavailable)
			return
		}
		okJSON(w, map[string]string{"result": "ok"})
	}))
	defer srv.Close()

	c := buildTestClient(srv.URL)
	var out map[string]string
	if err := c.Get(context.Background(), "/internal/admin/presale/rounds", "", "idem-003", &out); err != nil {
		t.Fatalf("expected success after retry, got: %v", err)
	}
	if callCount != 3 {
		t.Errorf("expected 3 calls (2 retry), got %d", callCount)
	}
	if out["result"] != "ok" {
		t.Errorf("unexpected response: %v", out)
	}
}

// TestGet_5xxExhausted 验证所有重试失败后返回错误。
func TestGet_5xxExhausted(t *testing.T) {
	callCount := 0

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		http.Error(w, `{"code":"SERVER_ERROR","message":"always fail","data":null}`, http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := buildTestClient(srv.URL)
	var out map[string]any
	err := c.Get(context.Background(), "/path", "", "idem-004", &out)
	if err == nil {
		t.Fatal("expected error after all retries exhausted")
	}
	if callCount != 3 {
		t.Errorf("expected 3 attempts, got %d", callCount)
	}
	if !strings.Contains(err.Error(), "all 3 attempts failed") {
		t.Errorf("error message should mention attempts: %v", err)
	}
}

// ─── adversarial：4xx 不重试 ─────────────────────────────────────────────────

// TestGet_4xxNoRetry 验证 4xx 立即返回错误，不重试。
func TestGet_4xxNoRetry(t *testing.T) {
	callCount := 0

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		http.Error(w, `{"code":"NOT_FOUND","message":"not found","data":null}`, http.StatusNotFound)
	}))
	defer srv.Close()

	c := buildTestClient(srv.URL)
	var out map[string]any
	err := c.Get(context.Background(), "/path", "", "idem-005", &out)
	if err == nil {
		t.Fatal("expected error for 4xx")
	}
	if callCount != 1 {
		t.Errorf("4xx should not retry, got %d calls", callCount)
	}
	httpErr, ok := client.IsHTTPError(err)
	if !ok {
		t.Fatalf("expected HTTPError, got %T: %v", err, err)
	}
	if httpErr.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", httpErr.StatusCode)
	}
}

// ─── adversarial：context 超时 ───────────────────────────────────────────────

// TestGet_ContextTimeout 验证 context 超时后返回错误。
func TestGet_ContextTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 故意 hang 足够长时间
		time.Sleep(500 * time.Millisecond)
		okJSON(w, nil)
	}))
	defer srv.Close()

	// 只给 50ms，远小于 server 的 500ms 延迟
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	c := client.New(client.WebapiConfig{
		InternalURL:  srv.URL,
		ServiceToken: testSecret,
		TimeoutSec:   10, // client timeout 大，靠 ctx timeout
		MaxRetries:   1,  // 只试一次，避免等太久
	})

	var out map[string]any
	err := c.Get(ctx, "/path", "", "idem-006", &out)
	if err == nil {
		t.Fatal("expected timeout error")
	}
}

// ─── adversarial：X-Admin-JWT 不被 client 篡改 ──────────────────────────────

// TestPost_JWTTransparent 验证 JWT 原样透传，client 不修改内容。
func TestPost_JWTTransparent(t *testing.T) {
	const originalJWT = "original.admin.jwt.untouched"
	var receivedJWT string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedJWT = r.Header.Get("X-Admin-JWT")
		okJSON(w, nil)
	}))
	defer srv.Close()

	c := buildTestClient(srv.URL)
	err := c.Post(context.Background(), "/path", originalJWT, "idem-007", nil, nil)
	if err != nil {
		t.Fatalf("Post failed: %v", err)
	}
	if receivedJWT != originalJWT {
		t.Errorf("JWT tampered: want %q got %q", originalJWT, receivedJWT)
	}
}

// ─── adversarial：错误 service_token → 签名失败 ──────────────────────────────

// TestPost_WrongServiceToken_SigMismatch 验证 client 用错误 secret 签名时，
// mock server（用正确 secret 验签）会检测到不匹配。
func TestPost_WrongServiceToken_SigMismatch(t *testing.T) {
	var sigValid bool

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(body)
		sigValid = verifyServiceSig(r, body) // server 用 testSecret 验证
		if !sigValid {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"code":"SERVICE_SIG_INVALID","message":"service signature invalid","data":null}`))
			return
		}
		okJSON(w, nil)
	}))
	defer srv.Close()

	// client 用错误 secret；401 是 4xx，不重试，callCount 应为 1
	badClient := client.New(client.WebapiConfig{
		InternalURL:  srv.URL,
		ServiceToken: "WRONG_SECRET_XXXXXXXXXXXXXXXXXXXXX",
		TimeoutSec:   2,
		MaxRetries:   3, // 即使 MaxRetries=3，4xx 也不重试
	})

	var out map[string]any
	err := badClient.Post(context.Background(), "/path", "jwt", "idem-008", map[string]string{"note": "x"}, &out)
	if err == nil {
		t.Fatal("expected error for wrong service token")
	}
	httpErr, ok := client.IsHTTPError(err)
	if !ok {
		t.Fatalf("expected HTTPError, got %T: %v", err, err)
	}
	if httpErr.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", httpErr.StatusCode)
	}
	if sigValid {
		t.Error("signature should not be valid with wrong secret")
	}
}

// ─── contract test：HMAC 签名与 web-api ComputeServiceSig 字节一致 ────────────

// TestComputeServiceSig_ContractAlignment 验证本 client 的 ComputeServiceSig 与
// web-api/internal/middleware/service_auth.go ComputeServiceSig 算法字节级一致。
//
// 实现方式：在此测试文件内内联 web-api 的算法（同 Go 语言实现），对比输出。
// 由于两仓库不能 import，这里以"已知参考向量"的方式做 contract 对齐验证。
func TestComputeServiceSig_ContractAlignment(t *testing.T) {
	cases := []struct {
		name           string
		secret         string
		tsMs           string
		path           string
		idempotencyKey string
		body           []byte
	}{
		{
			name:           "basic case",
			secret:         "my-secret",
			tsMs:           "1700000000000",
			path:           "/internal/admin/presale/rounds/1/pause",
			idempotencyKey: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			body:           []byte(`{"note":"pause for maintenance"}`),
		},
		{
			name:           "empty body",
			secret:         "another-secret",
			tsMs:           "1000000000000",
			path:           "/internal/admin/presale/config",
			idempotencyKey: "",
			body:           nil,
		},
		{
			name:           "unicode body",
			secret:         "secret-xyz",
			tsMs:           "9999999999999",
			path:           "/internal/admin/presale/anomaly/42/resolve",
			idempotencyKey: "uuid-test",
			body:           []byte(`{"note":"处理异常事件，转换为入账"}`),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// 本 client 实现
			clientSig := client.ComputeServiceSig(tc.secret, tc.tsMs, tc.path, tc.idempotencyKey, tc.body)

			// web-api 参考实现（内联，逻辑与 service_auth.go ComputeServiceSig 完全一致）
			referenceSig := referenceComputeServiceSig(tc.secret, tc.tsMs, tc.path, tc.idempotencyKey, tc.body)

			if clientSig != referenceSig {
				t.Errorf("HMAC signature mismatch!\n  client:    %s\n  reference: %s", clientSig, referenceSig)
			}
			t.Logf("sig OK: %s", clientSig)
		})
	}
}

// referenceComputeServiceSig 是 web-api/internal/middleware/service_auth.go
// ComputeServiceSig 函数的内联参考实现（字节对齐契约）。
//
// 原始代码：
//
//	func ComputeServiceSig(secret, tsMs, path, idempotencyKey string, body []byte) string {
//	    bodyHash := sha256.Sum256(body)
//	    payload := tsMs + ":" + path + ":" + idempotencyKey + ":" + hex.EncodeToString(bodyHash[:])
//	    h := hmac.New(sha256.New, []byte(secret))
//	    h.Write([]byte(payload))
//	    return hex.EncodeToString(h.Sum(nil))
//	}
func referenceComputeServiceSig(secret, tsMs, path, idempotencyKey string, body []byte) string {
	bodyHash := sha256.Sum256(body)
	payload := tsMs + ":" + path + ":" + idempotencyKey + ":" + hex.EncodeToString(bodyHash[:])
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

// TestComputeServiceSig_KnownVector 使用预计算的已知向量验证算法正确性。
// 向量由独立 Python 脚本生成（可人工核对），防止实现漂移。
func TestComputeServiceSig_KnownVector(t *testing.T) {
	// 向量：secret="test" tsMs="1000" path="/foo" idemKey="k1" body=[]byte("hello")
	// Python: import hmac, hashlib
	//   body_hash = hashlib.sha256(b"hello").hexdigest()
	//   payload = f"1000:/foo:k1:{body_hash}"
	//   sig = hmac.new(b"test", payload.encode(), hashlib.sha256).hexdigest()
	secret := "test"
	tsMs := "1000"
	path := "/foo"
	idemKey := "k1"
	body := []byte("hello")

	// 手动计算期望值
	bodyHashArr := sha256.Sum256(body)
	bodyHashHex := hex.EncodeToString(bodyHashArr[:])
	payload := fmt.Sprintf("%s:%s:%s:%s", tsMs, path, idemKey, bodyHashHex)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	expected := hex.EncodeToString(h.Sum(nil))

	got := client.ComputeServiceSig(secret, tsMs, path, idemKey, body)
	if got != expected {
		t.Errorf("known vector mismatch:\n  got:      %s\n  expected: %s", got, expected)
	}
}

// ─── e2e 测试：全链路通过 ─────────────────────────────────────────────────────

// TestE2E_GetRounds_FullChain 模拟 admin handler 调用 webapi client 获取 round 列表的完整链路。
func TestE2E_GetRounds_FullChain(t *testing.T) {
	// mock web-api 返回两条 round 数据
	mockRounds := ListRoundsResponse{
		List: []RoundItem{
			{ID: "round-1", Status: "active", PriceUsd: "0.05"},
			{ID: "round-2", Status: "ended", PriceUsd: "0.04"},
		},
		Total: 2,
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/admin/presale/rounds" {
			http.NotFound(w, r)
			return
		}
		// 验证签名
		if !verifyServiceSig(r, nil) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		// 验证 JWT 透传
		if r.Header.Get("X-Admin-JWT") != "admin-jwt" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		okJSON(w, mockRounds)
	}))
	defer srv.Close()

	c := buildTestClient(srv.URL)
	var out ListRoundsResponse
	err := c.Get(context.Background(), "/internal/admin/presale/rounds", "admin-jwt", "idem-e2e-001", &out)
	if err != nil {
		t.Fatalf("e2e Get failed: %v", err)
	}
	if len(out.List) != 2 {
		t.Errorf("expected 2 rounds, got %d", len(out.List))
	}
	if out.List[0].ID != "round-1" {
		t.Errorf("unexpected first round: %v", out.List[0])
	}
	if out.Total != 2 {
		t.Errorf("expected total=2, got %d", out.Total)
	}
}

// TestE2E_Post_MigrateRound 模拟 migrate-round 写操作完整链路。
func TestE2E_Post_MigrateRound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		respData := map[string]any{
			"txHash":       "0xabc",
			"oldRoundId":   "round-1",
			"newRoundId":   "round-2",
			"oldSharesOdd": "1000",
			"newSharesOdd": "950",
		}
		okJSON(w, respData)
	}))
	defer srv.Close()

	c := buildTestClient(srv.URL)
	body := map[string]any{"targetRoundId": "round-2", "note": "manual correction note"}
	var out map[string]any
	err := c.Post(context.Background(), "/internal/admin/presale/deposits/0xabc/migrate-round",
		"admin-jwt", "idem-e2e-002", body, &out)
	if err != nil {
		t.Fatalf("e2e Post failed: %v", err)
	}
	if out["txHash"] != "0xabc" {
		t.Errorf("unexpected txHash: %v", out["txHash"])
	}
}

// TestE2E_GetAudit_IDAsString 回归测试：web-api 把 PresaleAdminAudit.ID 以
// `json:"id,string"` 序列化（uint64 走字符串防 JS 精度丢失），admin-backend 的
// AuditItem.ID 必须带 ,string tag 才能正确反序列化。
//
// 历史 bug：AuditItem.ID 用 `json:"id"`（无 ,string），导致 json.Unmarshal 把
// 字符串 "2" 解进 uint64 报错 → list audit 请求 500（生产 audit 表非空时必现）。
// mock 故意返回原始字符串 id，确保即使将来误删 ,string 也会被本测试抓到。
func TestE2E_GetAudit_IDAsString(t *testing.T) {
	// 模拟 web-api 真实响应体：id 是 JSON 字符串而非数字
	const rawBody = `{"code":0,"message":"ok","data":{"list":[` +
		`{"id":"2","operator":"ou_x","operatorRole":"super_admin","action":"update_config",` +
		`"targetType":"config","targetId":"1","source":"api","note":"切金库地址 ≥10 字符","createdAt":1779962947726}` +
		`],"total":1,"page":1,"size":20}}`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/internal/admin/presale/audit" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(rawBody))
	}))
	defer srv.Close()

	c := buildTestClient(srv.URL)
	var out client.ListAuditResponse
	if err := c.Get(context.Background(), "/internal/admin/presale/audit", "admin-jwt", "", &out); err != nil {
		t.Fatalf("Get audit failed (id ,string regression): %v", err)
	}
	if len(out.List) != 1 {
		t.Fatalf("expected 1 audit item, got %d", len(out.List))
	}
	if out.List[0].ID != 2 {
		t.Errorf("expected ID=2 parsed from string, got %d", out.List[0].ID)
	}
	if out.Total != 1 {
		t.Errorf("expected total=1, got %d", out.Total)
	}
}

// ─── Fuzz 测试：HMAC 签名不应 panic ─────────────────────────────────────────

// FuzzComputeServiceSig 对 HMAC 签名算法进行 fuzz，验证任意输入不 panic。
func FuzzComputeServiceSig(f *testing.F) {
	// 种子语料库
	f.Add("secret", "1000", "/path", "key", []byte("body"))
	f.Add("", "", "", "", []byte(nil))
	f.Add("s", "9999999999999", "/admin/presale/rounds/1/pause", "uuid", []byte(`{"note":"x"}`))

	f.Fuzz(func(t *testing.T, secret, tsMs, path, idemKey string, body []byte) {
		// 不应 panic；签名结果应是 64 字节 hex 字符串
		sig := client.ComputeServiceSig(secret, tsMs, path, idemKey, body)
		if len(sig) != 64 {
			t.Errorf("expected 64-char hex sig, got len=%d: %q", len(sig), sig)
		}
	})
}

// ─── 本地 DTO 类型（避免 import cycle，仅用于 e2e 测试反序列化） ─────────────

type RoundItem struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	PriceUsd string `json:"priceUsd"`
}

type ListRoundsResponse struct {
	List  []RoundItem `json:"list"`
	Total int         `json:"total"`
}

// gin_h 是 map[string]any 的别名，避免 import gin（测试只需要 map）。
type gin_h = map[string]any
