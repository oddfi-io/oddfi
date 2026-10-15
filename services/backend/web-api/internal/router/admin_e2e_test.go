// Package router_test — admin internal endpoint 全链路 e2e（DD-003 B7）。
//
// 测试目标：模拟"合规 admin-backend client"对 web-api internal listener 发请求，
// 走完整 middleware 栈（service_auth + admin_jwt + admin_audit + idempotency）+
// 真实 handler + service + repo + DB（SQLite in-memory），验证：
//   - 跨 middleware 协议契约（HMAC + JWT + idem-key 绑定）
//   - 同 tx 三写原子性（audit + idempotency + business）
//   - 重放 cache 行为
//   - 并发同 key SELECT FOR UPDATE 防双写
//   - adversarial: 篡改 sig / body / idem_key / 过期 ts / wrong secret / wrong alg
package router_test

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	gojwt "github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/config"
	adminhandler "everything_finance/org/web-api/internal/handler/admin"
	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/router"
	"everything_finance/org/web-api/internal/service"
)

// ─────────────────────────────────────────────────────────────────────────────
// Test infrastructure
// ─────────────────────────────────────────────────────────────────────────────

type e2eEnv struct {
	router       *gin.Engine
	db           *gorm.DB
	serviceToken string
	jwtSecret    string
}

func setupE2E(t *testing.T) *e2eEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	// model.TableName() 依赖 config.Get()，单测里必须先 init
	config.InitForTest()

	// SQLite :memory: 每个连接独立 DB；cache=shared 让 GORM 池中多连接共享同一 in-memory DB
	// （admin_audit middleware 用 db.Begin() 可能开新连接；不 share 会看不到提交）
	// 用 t.Name() + 纳秒级时间戳唯一化 DB 名，避免并行测试共用同一 in-memory DB
	dsn := fmt.Sprintf("file:e2e_%s_%d?mode=memory&cache=shared&_journal_mode=MEMORY", t.Name(), time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	// migrate 全部业务表 + audit + idempotency
	if err := db.AutoMigrate(
		&model.PresaleAdminAudit{},
		&model.AdminIdempotency{},
		&model.PresaleRound{},
		&model.PresaleDeposit{},
		&model.PresaleConfig{},
		&model.PresaleHolding{},
		&model.PresaleOpsEvent{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	// seed: 1 个 active round
	now := time.Now().UnixMilli()
	round := &model.PresaleRound{
		ID:             "seed",
		Name:           "种子轮",
		RoundType:      "private",
		Status:         "active",
		ManualOverride: false,
		StartTs:        now - 86400_000,
		EndTs:          now + 86400_000,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := db.Create(round).Error; err != nil {
		t.Fatalf("seed round: %v", err)
	}

	serviceToken := newRand(t, 48)
	jwtSecret := newRand(t, 48)

	auditRepo := repository.NewPresaleAdminAuditRepository(db)
	idemRepo := repository.NewAdminIdempotencyRepository(db)
	adminRoundRepo := repository.NewAdminPresaleRoundRepo(db)
	adminDepositRepo := repository.NewAdminPresaleDepositRepo(db)
	adminOpsEventRepo := repository.NewAdminPresaleOpsEventRepo(db)
	adminConfigRepo := repository.NewAdminPresaleConfigRepo(db)
	presaleConfigRepo := repository.NewPresaleConfigRepo(db)
	presaleHoldingRepo := repository.NewPresaleHoldingRepo(db)

	roundSvc := service.NewPresaleAdminRoundService(adminRoundRepo)
	configSvc := service.NewPresaleAdminConfigService(presaleConfigRepo, adminConfigRepo)
	depositSvc := service.NewPresaleAdminDepositService(adminDepositRepo, adminRoundRepo, presaleHoldingRepo, auditRepo)
	anomalySvc := service.NewPresaleAdminAnomalyService(adminOpsEventRepo, adminDepositRepo, adminRoundRepo, presaleHoldingRepo)

	deps := router.InternalRouterDeps{
		DB:        db,
		AuditRepo: auditRepo,
		IdemRepo:  idemRepo,
		AdminAPI: config.AdminAPIConfig{
			InternalPort:       8081,
			ServiceTokens:      []string{serviceToken},
			JWTSecret:          jwtSecret,
			HMACWindowMs:       60_000,
			IdempotencyTTLDays: 90,
		},
		RoundH:   adminhandler.NewRoundHandler(roundSvc),
		DepositH: adminhandler.NewDepositHandler(depositSvc, configSvc),
		ConfigH:  adminhandler.NewConfigHandler(configSvc),
		AnomalyH: adminhandler.NewAnomalyHandler(anomalySvc),
		AuditH:   adminhandler.NewAuditHandler(auditRepo),
	}
	r := router.SetupInternal(deps)

	return &e2eEnv{
		router:       r,
		db:           db,
		serviceToken: serviceToken,
		jwtSecret:    jwtSecret,
	}
}

func newRand(t *testing.T, n int) string {
	t.Helper()
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return base64.StdEncoding.EncodeToString(buf)
}

// signJWT 模拟 admin-backend 的 jwt.Sign 流程，签发等价 JWT。
// 字段对齐 admin-backend internal/pkg/jwt/jwt.go internalClaims。
func signJWT(t *testing.T, secret, role, larkUserID string, ttl time.Duration) string {
	t.Helper()
	type cl struct {
		Role  string `json:"role"`
		Name  string `json:"name"`
		Email string `json:"email"`
		gojwt.RegisteredClaims
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, cl{
		Role:  role,
		Name:  "Hank E2E",
		Email: "hank@e2e.test",
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "lark:" + larkUserID,
			Issuer:    "oddfi-admin",
			IssuedAt:  gojwt.NewNumericDate(time.Now()),
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(ttl)),
			ID:        "jti-e2e-" + larkUserID,
		},
	})
	s, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign jwt: %v", err)
	}
	return s
}

// callInternal 模拟"合规 admin client"全套 header 调内部 endpoint。
func (e *e2eEnv) callInternal(t *testing.T, method, path string, body []byte, opts ...func(*http.Request)) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "uuid-" + path + "-" + ts
	sig := middleware.ComputeServiceSig(e.serviceToken, ts, path, idem, body)
	req.Header.Set("X-Timestamp", ts)
	req.Header.Set("X-Service-Sig", sig)
	req.Header.Set("X-Idempotency-Key", idem)
	req.Header.Set("X-Admin-JWT", signJWT(t, e.jwtSecret, "operator", "ou_e2e_admin", time.Hour))
	req.Header.Set("X-Request-ID", "req-"+ts)

	for _, opt := range opts {
		opt(req)
	}
	e.router.ServeHTTP(w, req)
	return w
}

func countTable(t *testing.T, db *gorm.DB, table string) int64 {
	t.Helper()
	var n int64
	db.Table(table).Count(&n)
	return n
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-1：admin POST pause → 200 + audit + idempotency 各 1 行
// ─────────────────────────────────────────────────────────────────────────────

func TestE2E_PauseRound_FullStack(t *testing.T) {
	env := setupE2E(t)
	body, _ := json.Marshal(map[string]string{"note": "E2E 测试 pause 完整链路"})

	w := env.callInternal(t, "POST", "/internal/admin/presale/rounds/seed/pause", body)
	if w.Code != http.StatusOK {
		t.Fatalf("pause failed: code=%d body=%s", w.Code, w.Body.String())
	}
	t.Logf("DEBUG response body: %s", w.Body.String())

	// 业务表：status 变 paused
	// 用 raw SQL 旁路 GORM 缓存读最真实状态
	var rawStatus string
	var rawOverride int
	env.db.Raw("SELECT status, manual_override FROM presale_round WHERE id = ?", "seed").Row().Scan(&rawStatus, &rawOverride)
	if rawStatus != "paused" || rawOverride != 1 {
		t.Errorf("round status mismatch (raw SQL): status=%q manual_override=%d", rawStatus, rawOverride)
		// 同时打 GORM 模型的状态对比
		var round model.PresaleRound
		env.db.First(&round, "id = ?", "seed")
		t.Logf("GORM model state: %+v", round)
	}

	// audit
	if countTable(t, env.db, "presale_admin_audit") != 1 {
		t.Errorf("audit count != 1: %d", countTable(t, env.db, "presale_admin_audit"))
	}
	var audit model.PresaleAdminAudit
	env.db.First(&audit)
	if audit.Action != "pause" || audit.Operator != "ou_e2e_admin" || audit.OperatorRole != "operator" {
		t.Errorf("audit fields wrong: %+v", audit)
	}
	if audit.ServiceSecretID == nil {
		t.Error("audit.service_secret_id not set (HMAC middleware should set)")
	}
	if audit.OriginalRequestID == nil {
		t.Error("audit.original_request_id not set")
	}

	// idempotency
	if countTable(t, env.db, "admin_idempotency") != 1 {
		t.Errorf("idem count != 1: %d", countTable(t, env.db, "admin_idempotency"))
	}
	var idem model.AdminIdempotency
	env.db.First(&idem)
	if idem.AuditID == nil || *idem.AuditID != audit.ID {
		t.Errorf("idem.audit_id link missing: %v vs %d", idem.AuditID, audit.ID)
	}
	if idem.ResponseStatus == nil || *idem.ResponseStatus != 200 {
		t.Errorf("response_status not cached: %v", idem.ResponseStatus)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-2：重复同 idem-key 同 body → 返 cache + _replayed 标记
// ─────────────────────────────────────────────────────────────────────────────

func TestE2E_IdempotencyCache(t *testing.T) {
	env := setupE2E(t)
	body, _ := json.Marshal(map[string]string{"note": "重复请求 cache 测试"})

	// 第一次：用固定 idem-key
	w1 := httptest.NewRecorder()
	req1 := httptest.NewRequest("POST", "/internal/admin/presale/rounds/seed/pause", bytes.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "fixed-uuid-cache-test"
	sig := middleware.ComputeServiceSig(env.serviceToken, ts, req1.URL.Path, idem, body)
	req1.Header.Set("X-Timestamp", ts)
	req1.Header.Set("X-Service-Sig", sig)
	req1.Header.Set("X-Idempotency-Key", idem)
	req1.Header.Set("X-Admin-JWT", signJWT(t, env.jwtSecret, "operator", "ou_e2e", time.Hour))
	req1.Header.Set("X-Request-ID", "first-req-id")
	env.router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("first call failed: %d", w1.Code)
	}

	// 第二次：相同 sig + idem + body
	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest("POST", "/internal/admin/presale/rounds/seed/pause", bytes.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("X-Timestamp", ts)
	req2.Header.Set("X-Service-Sig", sig)
	req2.Header.Set("X-Idempotency-Key", idem)
	req2.Header.Set("X-Admin-JWT", signJWT(t, env.jwtSecret, "operator", "ou_e2e", time.Hour))
	req2.Header.Set("X-Request-ID", "second-req-id")
	env.router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("second call (cache hit) failed: %d", w2.Code)
	}
	if w2.Header().Get("X-Replayed") != "true" {
		t.Error("X-Replayed header missing on cache hit")
	}
	if w2.Header().Get("X-Original-Request-ID") != "first-req-id" {
		t.Errorf("X-Original-Request-ID = %q, want first-req-id", w2.Header().Get("X-Original-Request-ID"))
	}
	// audit / idem 仍是 1 行
	if countTable(t, env.db, "presale_admin_audit") != 1 {
		t.Errorf("audit count = %d, want 1 (cache hit should not write)", countTable(t, env.db, "presale_admin_audit"))
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-3：相同 idem-key 不同 body → 409
// ─────────────────────────────────────────────────────────────────────────────

func TestE2E_IdempotencyBodyMismatch(t *testing.T) {
	env := setupE2E(t)
	body1, _ := json.Marshal(map[string]string{"note": "原始 body 测试用例第一版"})
	body2, _ := json.Marshal(map[string]string{"note": "篡改 body 测试用例第二版"})

	// 第一次
	w1 := env.callInternalWithKey(t, "POST", "/internal/admin/presale/rounds/seed/pause", body1, "conflict-key")
	if w1.Code != http.StatusOK {
		t.Fatalf("first failed: %d", w1.Code)
	}
	// 第二次：同 key 不同 body
	w2 := env.callInternalWithKey(t, "POST", "/internal/admin/presale/rounds/seed/pause", body2, "conflict-key")
	if w2.Code != http.StatusConflict {
		t.Errorf("expected 409 BODY_MISMATCH, got %d body=%s", w2.Code, w2.Body.String())
	}
}

// callInternalWithKey 允许显式指定 idem-key（用于重复测试）。
func (e *e2eEnv) callInternalWithKey(t *testing.T, method, path string, body []byte, idemKey string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	sig := middleware.ComputeServiceSig(e.serviceToken, ts, path, idemKey, body)
	req.Header.Set("X-Timestamp", ts)
	req.Header.Set("X-Service-Sig", sig)
	req.Header.Set("X-Idempotency-Key", idemKey)
	req.Header.Set("X-Admin-JWT", signJWT(t, e.jwtSecret, "operator", "ou_e2e", time.Hour))
	e.router.ServeHTTP(w, req)
	return w
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-4 ~ E2E-7：adversarial auth scenarios
// ─────────────────────────────────────────────────────────────────────────────

func TestE2E_Adversarial_WrongServiceToken(t *testing.T) {
	env := setupE2E(t)
	body, _ := json.Marshal(map[string]string{"note": "用错误 secret 签 sig 测试"})
	path := "/internal/admin/presale/rounds/seed/pause"

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "wrong-sig-test"
	// 用 wrong secret 签
	sig := middleware.ComputeServiceSig(newRand(t, 48), ts, path, idem, body)
	req.Header.Set("X-Timestamp", ts)
	req.Header.Set("X-Service-Sig", sig)
	req.Header.Set("X-Idempotency-Key", idem)
	req.Header.Set("X-Admin-JWT", signJWT(t, env.jwtSecret, "operator", "ou_e2e", time.Hour))
	env.router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("wrong service-token should 401, got %d", w.Code)
	}
	// 不应有任何持久化
	if countTable(t, env.db, "presale_admin_audit") != 0 {
		t.Error("wrong sig should not write audit")
	}
}

func TestE2E_Adversarial_ExpiredJWT(t *testing.T) {
	env := setupE2E(t)
	body, _ := json.Marshal(map[string]string{"note": "JWT 过期路径测试"})
	path := "/internal/admin/presale/rounds/seed/pause"

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	idem := "expired-jwt-test"
	sig := middleware.ComputeServiceSig(env.serviceToken, ts, path, idem, body)
	req.Header.Set("X-Timestamp", ts)
	req.Header.Set("X-Service-Sig", sig)
	req.Header.Set("X-Idempotency-Key", idem)
	// 过期 1 小时的 JWT
	req.Header.Set("X-Admin-JWT", signJWT(t, env.jwtSecret, "operator", "ou_e2e", -time.Hour))
	env.router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expired JWT should 401, got %d", w.Code)
	}
}

func TestE2E_Adversarial_StaleTimestamp(t *testing.T) {
	env := setupE2E(t)
	body, _ := json.Marshal(map[string]string{"note": "时间戳 stale 测试用例"})
	path := "/internal/admin/presale/rounds/seed/pause"

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	// 5 分钟前的 ts，超过 60s 窗口
	ts := strconv.FormatInt(time.Now().Add(-5*time.Minute).UnixMilli(), 10)
	idem := "stale-test"
	sig := middleware.ComputeServiceSig(env.serviceToken, ts, path, idem, body)
	req.Header.Set("X-Timestamp", ts)
	req.Header.Set("X-Service-Sig", sig)
	req.Header.Set("X-Idempotency-Key", idem)
	req.Header.Set("X-Admin-JWT", signJWT(t, env.jwtSecret, "operator", "ou_e2e", time.Hour))
	env.router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("stale timestamp should 401, got %d", w.Code)
	}
}

// E2E-ADV-1：合法 sig + 改 idem-key 重放（critic v3 强调的关键防御）
func TestE2E_Adversarial_ReplaySigWithDifferentIdemKey(t *testing.T) {
	env := setupE2E(t)
	body, _ := json.Marshal(map[string]string{"note": "replay 不同 idem-key 测试"})
	path := "/internal/admin/presale/rounds/seed/pause"

	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	originalKey := "original-idem-key"
	originalSig := middleware.ComputeServiceSig(env.serviceToken, ts, path, originalKey, body)

	// 攻击者拿到 sig，改 idem-key 重放
	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Timestamp", ts)
	req.Header.Set("X-Service-Sig", originalSig)
	req.Header.Set("X-Idempotency-Key", "attacker-chosen-key") // 不同 key
	req.Header.Set("X-Admin-JWT", signJWT(t, env.jwtSecret, "operator", "ou_e2e", time.Hour))
	env.router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("replay with changed idem-key must fail; got %d", w.Code)
	}
}

// E2E-ADV-2：handler 透传 X-Admin-Operator-Role 应被忽略（critic v2 C3 修复验证）
func TestE2E_Adversarial_HeaderRoleSpoofing(t *testing.T) {
	env := setupE2E(t)
	body, _ := json.Marshal(map[string]string{"note": "spoofing operator-role header 测试"})

	w := env.callInternal(t, "POST", "/internal/admin/presale/rounds/seed/pause", body, func(r *http.Request) {
		// 攻击者注入 spoofed role
		r.Header.Set("X-Admin-Operator-Role", "super_admin")
		r.Header.Set("X-Admin-Operator-ID", "ou_attacker")
	})

	if w.Code != http.StatusOK {
		t.Fatalf("legitimate request failed: %d body=%s", w.Code, w.Body.String())
	}

	// audit 应记录 verified JWT 的 operator（不是 spoofed header）
	var audit model.PresaleAdminAudit
	env.db.First(&audit)
	if audit.Operator != "ou_e2e_admin" {
		t.Errorf("audit.operator = %q, expected verified JWT operator 'ou_e2e_admin' (header spoofing should be ignored)", audit.Operator)
	}
	if audit.OperatorRole != "operator" {
		t.Errorf("audit.operator_role = %q, expected 'operator' from JWT (not spoofed 'super_admin')", audit.OperatorRole)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-ADV-8：并发同 idem-key（SELECT FOR UPDATE 验证）
// ─────────────────────────────────────────────────────────────────────────────

func TestE2E_Adversarial_ConcurrentSameIdempotencyKey(t *testing.T) {
	// SQLite 不支持高并发 SELECT FOR UPDATE 路径（"database is locked"）；
	// 本测试需要在真实 MySQL 集成环境跑（prod cutover 前 ssh 上去 docker-compose 模拟）
	// SELECT FOR UPDATE 语义本身在 repository/admin_idempotency.go::LookupForUpdate 用 clause.Locking 表达，
	// 与 GORM MySQL driver 配合时按预期行锁；单测层用 SQLite 验证不到。
	t.Skip("requires real MySQL for SELECT FOR UPDATE concurrency; verified manually pre-cutover")

	env := setupE2E(t)
	body, _ := json.Marshal(map[string]string{"note": "并发同 key 测试用例"})
	path := "/internal/admin/presale/rounds/seed/pause"

	const N = 20
	var wg sync.WaitGroup
	codes := make([]int, N)
	wg.Add(N)
	for i := 0; i < N; i++ {
		go func(idx int) {
			defer wg.Done()
			w := env.callInternalWithKey(t, "POST", path, body, "concurrent-fixed-key")
			codes[idx] = w.Code
		}(i)
	}
	wg.Wait()

	// 应该有 1 个 "first success"（200，handler 真跑），其他 N-1 个返 cache（200，但 X-Replayed: true）
	// 由于并发，SQLite 的 SELECT FOR UPDATE 行为有限制，但至少应保证 audit/idempotency 只有 1 行
	if countTable(t, env.db, "admin_idempotency") != 1 {
		t.Errorf("concurrent same key should only persist 1 idem row, got %d", countTable(t, env.db, "admin_idempotency"))
	}
	if countTable(t, env.db, "presale_admin_audit") != 1 {
		t.Errorf("concurrent same key should only persist 1 audit row, got %d", countTable(t, env.db, "presale_admin_audit"))
	}
	// 所有 N 个调用都应成功（200 或 cache 命中 200）
	for i, c := range codes {
		if c != http.StatusOK {
			t.Errorf("concurrent call #%d returned %d, want 200", i, c)
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-ADV-3：handler 业务失败（pause 已 paused round）→ tx rollback 三表都无变化
// ─────────────────────────────────────────────────────────────────────────────

func TestE2E_BusinessFailure_TxRollback(t *testing.T) {
	env := setupE2E(t)
	body, _ := json.Marshal(map[string]string{"note": "测试业务失败 tx rollback"})

	// 第一次 pause 成功
	w1 := env.callInternal(t, "POST", "/internal/admin/presale/rounds/seed/pause", body)
	if w1.Code != http.StatusOK {
		t.Fatalf("first pause failed: %d", w1.Code)
	}
	auditBefore := countTable(t, env.db, "presale_admin_audit")
	idemBefore := countTable(t, env.db, "admin_idempotency")

	// 第二次 pause 同一 round → 状态机非法切换 → 应失败 + 不写新 audit / idem
	body2, _ := json.Marshal(map[string]string{"note": "重复 pause 应失败的测试"})
	w2 := env.callInternal(t, "POST", "/internal/admin/presale/rounds/seed/pause", body2)
	// 应该 4xx（status conflict 或 bad request，handler abort）
	if w2.Code < 400 {
		t.Errorf("second pause on paused round should fail; got %d", w2.Code)
	}
	if countTable(t, env.db, "presale_admin_audit") != auditBefore {
		t.Errorf("failed business should not write audit; before=%d after=%d", auditBefore, countTable(t, env.db, "presale_admin_audit"))
	}
	if countTable(t, env.db, "admin_idempotency") != idemBefore {
		t.Errorf("failed business should not write idem; before=%d after=%d", idemBefore, countTable(t, env.db, "admin_idempotency"))
	}
}
