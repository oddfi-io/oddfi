package middleware_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
)

// setupTestDB 建立 SQLite + migrate audit + idempotency 表
func setupTestDB(t *testing.T) *gorm.DB {
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

// setupRouter 装配完整 admin internal middleware 栈（无 ServiceAuth / AdminJWT，单测里 mock 上下文）
func setupRouter(t *testing.T, db *gorm.DB, handlerFn gin.HandlerFunc) *gin.Engine {
	t.Helper()
	auditRepo := repository.NewPresaleAdminAuditRepository(db)
	idemRepo := repository.NewAdminIdempotencyRepository(db)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	// mock 上游 AdminJWT 的注入
	r.Use(func(c *gin.Context) {
		c.Set(middleware.CtxAdminOperatorID, "ou_test")
		c.Set(middleware.CtxAdminOperatorRole, "operator")
		c.Set(middleware.CtxServiceSecretID, "secret_id_abc")
		c.Next()
	})
	r.POST("/internal/admin/test",
		middleware.AdminAudit(middleware.AdminAuditConfig{DB: db, AuditRepo: auditRepo}),
		middleware.Idempotency(middleware.IdempotencyConfig{IdemRepo: idemRepo}),
		handlerFn,
	)
	return r
}

func jsonReq(t *testing.T, body any, headers map[string]string) *http.Request {
	t.Helper()
	bs, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", "/internal/admin/test", bytes.NewReader(bs))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return req
}

func countRows(t *testing.T, db *gorm.DB, tablename string) int64 {
	t.Helper()
	var n int64
	db.Table(tablename).Count(&n)
	return n
}

func TestAdminAudit_HappyPath_SameTxCommit(t *testing.T) {
	db := setupTestDB(t)
	r := setupRouter(t, db, func(c *gin.Context) {
		c.Set(middleware.CtxAuditAction, "pause")
		c.Set(middleware.CtxAuditTargetType, "round")
		c.Set(middleware.CtxAuditTargetID, "seed")
		c.Set(middleware.CtxAuditBefore, `{"status":"active"}`)
		c.Set(middleware.CtxAuditAfter, `{"status":"paused"}`)
		c.JSON(http.StatusOK, gin.H{"ok": true, "roundId": "seed"})
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, jsonReq(t, map[string]string{"note": "暂停种子轮回退做单元测试"}, map[string]string{
		"X-Idempotency-Key": "uuid-001",
		"X-Request-ID":      "req-001",
	}))

	if w.Code != http.StatusOK {
		t.Fatalf("code = %d, body = %s", w.Code, w.Body.String())
	}
	if countRows(t, db, "presale_admin_audit") != 1 {
		t.Errorf("audit rows = %d, want 1", countRows(t, db, "presale_admin_audit"))
	}
	if countRows(t, db, "admin_idempotency") != 1 {
		t.Errorf("idempotency rows = %d, want 1", countRows(t, db, "admin_idempotency"))
	}

	// 验证 audit 字段
	var audit model.PresaleAdminAudit
	db.First(&audit)
	if audit.Action != "pause" || audit.Operator != "ou_test" || audit.OperatorRole != "operator" {
		t.Errorf("audit fields wrong: %+v", audit)
	}
	if audit.ServiceSecretID == nil || *audit.ServiceSecretID != "secret_id_abc" {
		t.Errorf("service_secret_id not set")
	}
	if audit.OriginalRequestID == nil || *audit.OriginalRequestID != "req-001" {
		t.Errorf("original_request_id not set")
	}

	// 验证 idempotency 字段链接到 audit
	var idem model.AdminIdempotency
	db.First(&idem)
	if idem.AuditID == nil || *idem.AuditID != audit.ID {
		t.Errorf("idempotency.audit_id link failed: got %v, want %d", idem.AuditID, audit.ID)
	}
	if idem.ResponseStatus == nil || *idem.ResponseStatus != http.StatusOK {
		t.Errorf("response_status not cached")
	}
	if idem.ResponseSnapshot == nil || !strings.Contains(*idem.ResponseSnapshot, "roundId") {
		t.Errorf("response_snapshot missing handler body")
	}
}

func TestAdminAudit_NoteTooShort_400(t *testing.T) {
	db := setupTestDB(t)
	r := setupRouter(t, db, func(c *gin.Context) {
		t.Fatal("handler should not be called when note too short")
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, jsonReq(t, map[string]string{"note": "短"}, map[string]string{
		"X-Idempotency-Key": "k",
	}))

	if w.Code != http.StatusBadRequest {
		t.Errorf("code = %d, want 400", w.Code)
	}
	if !strings.Contains(w.Body.String(), "NOTE_REQUIRED") {
		t.Errorf("body should mention NOTE_REQUIRED: %s", w.Body.String())
	}
	if countRows(t, db, "presale_admin_audit") != 0 {
		t.Error("audit should not be written")
	}
	if countRows(t, db, "admin_idempotency") != 0 {
		t.Error("idempotency should not be written")
	}
}

func TestAdminAudit_MissingIdempotencyKey_400(t *testing.T) {
	db := setupTestDB(t)
	r := setupRouter(t, db, func(c *gin.Context) {
		t.Fatal("handler should not be called")
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, jsonReq(t, map[string]string{"note": "正常长度的操作备注没问题"}, nil))

	if w.Code != http.StatusBadRequest {
		t.Errorf("code = %d, want 400", w.Code)
	}
	if !strings.Contains(w.Body.String(), "IDEMPOTENCY_KEY_REQUIRED") {
		t.Errorf("body should mention IDEMPOTENCY_KEY_REQUIRED: %s", w.Body.String())
	}
}

func TestAdminAudit_HandlerAbort_NothingPersisted(t *testing.T) {
	db := setupTestDB(t)
	r := setupRouter(t, db, func(c *gin.Context) {
		c.Set(middleware.CtxAuditAction, "pause")
		c.Set(middleware.CtxAuditTargetType, "round")
		c.Set(middleware.CtxAuditTargetID, "seed")
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"code": "ROUND_NOT_FOUND"})
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, jsonReq(t, map[string]string{"note": "尝试 pause 不存在的轮次"}, map[string]string{
		"X-Idempotency-Key": "k",
	}))

	if w.Code != http.StatusNotFound {
		t.Errorf("code = %d, want 404", w.Code)
	}
	if countRows(t, db, "presale_admin_audit") != 0 {
		t.Errorf("handler abort should rollback audit; got %d rows", countRows(t, db, "presale_admin_audit"))
	}
	if countRows(t, db, "admin_idempotency") != 0 {
		t.Errorf("handler abort should rollback idempotency; got %d rows", countRows(t, db, "admin_idempotency"))
	}
}

func TestAdminAudit_DuplicateKey_SameBody_ReturnsCached(t *testing.T) {
	db := setupTestDB(t)
	callCount := 0
	r := setupRouter(t, db, func(c *gin.Context) {
		callCount++
		c.Set(middleware.CtxAuditAction, "pause")
		c.Set(middleware.CtxAuditTargetType, "round")
		c.Set(middleware.CtxAuditTargetID, "seed")
		c.JSON(http.StatusOK, gin.H{"ok": true, "callIdx": callCount})
	})

	body := map[string]string{"note": "重复请求测试用例需10字符"}
	headers := map[string]string{"X-Idempotency-Key": "dup-key", "X-Request-ID": "req-A"}

	// 第一次：正常处理
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, jsonReq(t, body, headers))
	if w1.Code != http.StatusOK {
		t.Fatalf("first req failed: %d", w1.Code)
	}
	if !strings.Contains(w1.Body.String(), `"callIdx":1`) {
		t.Errorf("first body should have callIdx:1: %s", w1.Body.String())
	}

	// 第二次：相同 key 相同 body → 返 cache，handler 不被调
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, jsonReq(t, body, map[string]string{"X-Idempotency-Key": "dup-key", "X-Request-ID": "req-B"}))
	if w2.Code != http.StatusOK {
		t.Errorf("second req failed: %d", w2.Code)
	}
	if callCount != 1 {
		t.Errorf("handler should be called once, got %d", callCount)
	}
	// 返回的 body 含 _replayed: true 标记
	if !strings.Contains(w2.Body.String(), `"_replayed":true`) {
		t.Errorf("cached response should have _replayed marker: %s", w2.Body.String())
	}
	if !strings.Contains(w2.Body.String(), `"_original_request_id":"req-A"`) {
		t.Errorf("cached response should retain original request id req-A: %s", w2.Body.String())
	}
	// X-Replayed header
	if w2.Header().Get("X-Replayed") != "true" {
		t.Errorf("X-Replayed header missing: %v", w2.Header())
	}
	// audit/idempotency 行数仍是 1
	if countRows(t, db, "presale_admin_audit") != 1 {
		t.Errorf("audit count = %d, want 1 (cache hit should not write new)", countRows(t, db, "presale_admin_audit"))
	}
}

func TestAdminAudit_DuplicateKey_DifferentBody_409(t *testing.T) {
	db := setupTestDB(t)
	r := setupRouter(t, db, func(c *gin.Context) {
		c.Set(middleware.CtxAuditAction, "pause")
		c.Set(middleware.CtxAuditTargetType, "round")
		c.Set(middleware.CtxAuditTargetID, "seed")
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// 第一次
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, jsonReq(t, map[string]string{"note": "原始 body 1 测试用例"}, map[string]string{
		"X-Idempotency-Key": "key-conflict",
	}))
	if w1.Code != http.StatusOK {
		t.Fatalf("first req failed: %d", w1.Code)
	}

	// 第二次：相同 key 不同 body → 409
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, jsonReq(t, map[string]string{"note": "篡改的 body 2 测试用例"}, map[string]string{
		"X-Idempotency-Key": "key-conflict",
	}))
	if w2.Code != http.StatusConflict {
		t.Errorf("body mismatch should 409; got %d", w2.Code)
	}
	if !strings.Contains(w2.Body.String(), "IDEMPOTENCY_BODY_MISMATCH") {
		t.Errorf("body should mention IDEMPOTENCY_BODY_MISMATCH: %s", w2.Body.String())
	}
}

// TestAdminAudit_AdversarialRollback_Atomicity 关键测试：
// handler 调用 c.Errors 添加错误 → 整个 tx 回滚，audit + idempotency + business 都不落
func TestAdminAudit_AdversarialRollback_Atomicity(t *testing.T) {
	db := setupTestDB(t)
	r := setupRouter(t, db, func(c *gin.Context) {
		c.Set(middleware.CtxAuditAction, "pause")
		c.Set(middleware.CtxAuditTargetType, "round")
		c.Set(middleware.CtxAuditTargetID, "seed")
		// 添加 error 但没 abort
		_ = c.Error(http.ErrAbortHandler)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "INTERNAL"})
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, jsonReq(t, map[string]string{"note": "测试 c.Errors 路径"}, map[string]string{
		"X-Idempotency-Key": "k-err",
	}))

	if countRows(t, db, "presale_admin_audit") != 0 {
		t.Errorf("c.Errors should rollback audit; got %d rows", countRows(t, db, "presale_admin_audit"))
	}
	if countRows(t, db, "admin_idempotency") != 0 {
		t.Errorf("c.Errors should rollback idempotency; got %d rows", countRows(t, db, "admin_idempotency"))
	}
}

func TestAdminAudit_GetRequest_Passthrough(t *testing.T) {
	db := setupTestDB(t)
	auditRepo := repository.NewPresaleAdminAuditRepository(db)
	idemRepo := repository.NewAdminIdempotencyRepository(db)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(middleware.CtxAdminOperatorID, "ou_test")
		c.Next()
	})
	r.GET("/internal/admin/test",
		middleware.AdminAudit(middleware.AdminAuditConfig{DB: db, AuditRepo: auditRepo}),
		middleware.Idempotency(middleware.IdempotencyConfig{IdemRepo: idemRepo}),
		func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) },
	)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/internal/admin/test", nil))

	if w.Code != http.StatusOK {
		t.Errorf("GET should pass through: %d", w.Code)
	}
	if countRows(t, db, "presale_admin_audit") != 0 {
		t.Error("GET should not write audit")
	}
}
