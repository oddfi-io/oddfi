package router_test

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	gojwt "github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/router"
)

func setupSecret(t *testing.T) string {
	t.Helper()
	buf := make([]byte, 48)
	_, _ = rand.Read(buf)
	return base64.StdEncoding.EncodeToString(buf)
}

func setupInternalDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.PresaleAdminAudit{}, &model.AdminIdempotency{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func signInternalJWT(t *testing.T, secret, role string) string {
	t.Helper()
	type claims struct {
		Role string `json:"role"`
		gojwt.RegisteredClaims
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims{
		Role: role,
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "lark:ou_test_admin",
			Issuer:    "oddfi-admin",
			IssuedAt:  gojwt.NewNumericDate(time.Now()),
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(time.Hour)),
			ID:        "jti-internal-test",
		},
	})
	signed, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

func setupInternalRouter(t *testing.T) (*gin.Engine, *gorm.DB, config.AdminAPIConfig) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db := setupInternalDB(t)
	cfg := config.AdminAPIConfig{
		InternalPort:       8081,
		ServiceTokens:      []string{setupSecret(t)},
		JWTSecret:          setupSecret(t),
		HMACWindowMs:       60_000,
		IdempotencyTTLDays: 90,
	}
	r := router.SetupInternal(router.InternalRouterDeps{
		DB:        db,
		AuditRepo: repository.NewPresaleAdminAuditRepository(db),
		IdemRepo:  repository.NewAdminIdempotencyRepository(db),
		AdminAPI:  cfg,
		// Round / Deposit / etc handler 留 nil → stub
	})
	return r, db, cfg
}

func sendInternalReq(t *testing.T, r *gin.Engine, cfg config.AdminAPIConfig, method, path string, body []byte, opts ...func(*http.Request)) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// 默认带合法 service-sig + admin JWT
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "uuid-" + path
	sig := middleware.ComputeServiceSig(cfg.ServiceTokens[0], ts, path, idem, body)
	req.Header.Set("X-Timestamp", ts)
	req.Header.Set("X-Service-Sig", sig)
	req.Header.Set("X-Idempotency-Key", idem)
	req.Header.Set("X-Admin-JWT", signInternalJWT(t, cfg.JWTSecret, "operator"))

	for _, opt := range opts {
		opt(req)
	}
	r.ServeHTTP(w, req)
	return w
}

func TestInternalRouter_HealthCheck(t *testing.T) {
	r, _, _ := setupInternalRouter(t)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/health", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("health code = %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"scope":"internal"`) {
		t.Errorf("health body missing scope marker: %s", w.Body.String())
	}
}

func TestInternalRouter_NoAuth_401(t *testing.T) {
	r, _, _ := setupInternalRouter(t)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/internal/admin/presale/rounds", nil))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("no service-sig should 401; got %d", w.Code)
	}
}

func TestInternalRouter_NoJWT_401(t *testing.T) {
	r, _, cfg := setupInternalRouter(t)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/internal/admin/presale/rounds", nil)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "k"
	sig := middleware.ComputeServiceSig(cfg.ServiceTokens[0], ts, req.URL.Path, idem, nil)
	req.Header.Set("X-Timestamp", ts)
	req.Header.Set("X-Service-Sig", sig)
	req.Header.Set("X-Idempotency-Key", idem)
	// 不带 X-Admin-JWT
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("no admin-jwt should 401; got %d", w.Code)
	}
}

func TestInternalRouter_StubList_Reachable(t *testing.T) {
	r, _, cfg := setupInternalRouter(t)
	w := sendInternalReq(t, r, cfg, "GET", "/internal/admin/presale/rounds", nil)
	if w.Code != http.StatusOK {
		t.Errorf("stub list should 200; got %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"stub":true`) {
		t.Errorf("expected stub:true marker: %s", w.Body.String())
	}
}

func TestInternalRouter_PauseRoute_FullMiddlewareStack(t *testing.T) {
	r, db, cfg := setupInternalRouter(t)

	// POST /pause 要走完整 middleware：ServiceAuth → AdminJWT → AdminAudit → Idempotency → stub
	body, _ := json.Marshal(map[string]string{"note": "stub 测试 pause 完整链路验证"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/internal/admin/presale/rounds/seed/pause", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "uuid-pause-test"
	sig := middleware.ComputeServiceSig(cfg.ServiceTokens[0], ts, req.URL.Path, idem, body)
	req.Header.Set("X-Timestamp", ts)
	req.Header.Set("X-Service-Sig", sig)
	req.Header.Set("X-Idempotency-Key", idem)
	req.Header.Set("X-Admin-JWT", signInternalJWT(t, cfg.JWTSecret, "operator"))

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("pause stub should 200; got %d body=%s", w.Code, w.Body.String())
	}

	// 验证 middleware 栈正确执行：audit + idempotency 各 1 行
	var auditCount int64
	db.Model(&model.PresaleAdminAudit{}).Count(&auditCount)
	if auditCount != 1 {
		t.Errorf("expected 1 audit row, got %d", auditCount)
	}
	var idemCount int64
	db.Model(&model.AdminIdempotency{}).Count(&idemCount)
	if idemCount != 1 {
		t.Errorf("expected 1 idempotency row, got %d", idemCount)
	}

	// audit 应该包含 stub 设置的 action
	var audit model.PresaleAdminAudit
	db.First(&audit)
	if audit.Action != "pause" || audit.TargetType != "round" {
		t.Errorf("audit fields mismatch: %+v", audit)
	}
	if audit.Operator != "ou_test_admin" {
		t.Errorf("audit operator = %q, want ou_test_admin", audit.Operator)
	}
	if audit.OperatorRole != "operator" {
		t.Errorf("audit operator_role = %q, want operator", audit.OperatorRole)
	}
}

func TestInternalRouter_17EndpointsRegistered(t *testing.T) {
	r, _, cfg := setupInternalRouter(t)

	// 通过路由表验证 17 个 endpoint 都注册了（不走业务逻辑，只验证路由存在）
	// 用 OPTIONS 是因为 admin_audit middleware 跳过；只需路由匹配即可
	endpoints := []struct {
		method, path string
	}{
		{"GET", "/internal/admin/presale/rounds"},
		{"GET", "/internal/admin/presale/rounds/seed"},
		{"POST", "/internal/admin/presale/rounds/seed/pause"},
		{"POST", "/internal/admin/presale/rounds/seed/resume"},
		{"POST", "/internal/admin/presale/rounds/seed/reopen"},
		{"POST", "/internal/admin/presale/rounds/seed/close"},
		{"PATCH", "/internal/admin/presale/rounds/seed/referral-pct"},
		{"PATCH", "/internal/admin/presale/rounds/seed"},
		{"GET", "/internal/admin/presale/deposits"},
		{"GET", "/internal/admin/presale/deposits/0xabc"},
		{"POST", "/internal/admin/presale/deposits/0xabc/migrate-round"},
		{"GET", "/internal/admin/presale/config"},
		{"PATCH", "/internal/admin/presale/config"},
		{"GET", "/internal/admin/presale/anomaly"},
		{"GET", "/internal/admin/presale/anomaly/123"},
		{"POST", "/internal/admin/presale/anomaly/123/resolve"},
		{"GET", "/internal/admin/presale/audit"},
	}

	if len(endpoints) != 17 {
		t.Fatalf("test data has %d endpoints, expected 17", len(endpoints))
	}

	for _, e := range endpoints {
		t.Run(e.method+" "+e.path, func(t *testing.T) {
			var body []byte
			if e.method == "POST" || e.method == "PATCH" {
				body, _ = json.Marshal(map[string]string{"note": "stub 端点存在性测试"})
			}
			w := sendInternalReq(t, r, cfg, e.method, e.path, body)
			// 路由存在 → 不应 404；可能是 200 (stub) 或别的，但绝不 404
			if w.Code == http.StatusNotFound {
				t.Errorf("endpoint %s %s returned 404 — not registered? body=%s", e.method, e.path, w.Body.String())
			}
		})
	}
}

func TestAdminAPIConfig_EnabledGate(t *testing.T) {
	cases := []struct {
		name    string
		cfg     config.AdminAPIConfig
		enabled bool
	}{
		{"all set", config.AdminAPIConfig{InternalPort: 8081, ServiceTokens: []string{"x"}, JWTSecret: strings.Repeat("x", 32)}, true},
		{"no port", config.AdminAPIConfig{ServiceTokens: []string{"x"}, JWTSecret: strings.Repeat("x", 32)}, false},
		{"no tokens", config.AdminAPIConfig{InternalPort: 8081, JWTSecret: strings.Repeat("x", 32)}, false},
		{"short secret", config.AdminAPIConfig{InternalPort: 8081, ServiceTokens: []string{"x"}, JWTSecret: "short"}, false},
		{"empty", config.AdminAPIConfig{}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.cfg.Enabled(); got != tc.enabled {
				t.Errorf("Enabled() = %v, want %v", got, tc.enabled)
			}
		})
	}
}
