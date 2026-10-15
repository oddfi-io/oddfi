package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"oddfi-web-api/model"
	"oddfi-web-api/storage"
	"regexp"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
)

// ─────────────────────────────────────────────
// fakeEarlyAccessRepo — 内存实现，线程安全
// ─────────────────────────────────────────────

type fakeEarlyAccessRepo struct {
	mu      sync.Mutex
	records map[string]*model.EarlyAccessRegistration // key = biz_id
	nextID  uint64
}

func newFakeRepo() *fakeEarlyAccessRepo {
	return &fakeEarlyAccessRepo{
		records: make(map[string]*model.EarlyAccessRegistration),
		nextID:  1,
	}
}

func (f *fakeEarlyAccessRepo) FindActiveByEmailOrWallet(_ context.Context, email, wallet string) (*model.EarlyAccessRegistration, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, r := range f.records {
		if r.Status == 1 && (r.Email == email || r.WalletAddress == wallet) {
			cp := *r
			return &cp, nil
		}
	}
	return nil, nil
}

func (f *fakeEarlyAccessRepo) Create(_ context.Context, rec *model.EarlyAccessRegistration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	// 检查 email / wallet 唯一约束（模拟 DB unique key）
	for _, r := range f.records {
		if r.Email == rec.Email || r.WalletAddress == rec.WalletAddress {
			return fmt.Errorf("Error 1062: Duplicate entry")
		}
	}
	rec.ID = f.nextID
	f.nextID++
	cp := *rec
	f.records[rec.BizID] = &cp
	return nil
}

func (f *fakeEarlyAccessRepo) CountRankByID(_ context.Context, id uint64) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var count int64
	for _, r := range f.records {
		if r.Status == 1 && r.ID <= id {
			count++
		}
	}
	return count, nil
}

// lastInsert 返回 repo 中最近插入的记录（按 ID 最大）
func (f *fakeEarlyAccessRepo) lastInsert() *model.EarlyAccessRegistration {
	f.mu.Lock()
	defer f.mu.Unlock()
	var last *model.EarlyAccessRegistration
	for _, r := range f.records {
		if last == nil || r.ID > last.ID {
			cp := *r
			last = &cp
		}
	}
	return last
}

// ─────────────────────────────────────────────
// helper：构造测试路由
// ─────────────────────────────────────────────

func newTestRouter(repo storage.EarlyAccessRepo) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("api/v1")
	BuildEarlyAccess(v1, repo)
	return r
}

// ─────────────────────────────────────────────
// helper：发送 POST 请求
// ─────────────────────────────────────────────

func postRegister(r *gin.Engine, body map[string]interface{}) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/early_access/register", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// postRegisterRaw 发送原始 body 字节（用于测试 malformed JSON）
func postRegisterRaw(r *gin.Engine, rawBody []byte) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/early_access/register", bytes.NewReader(rawBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

var bizIDPattern = regexp.MustCompile(`^ea_[a-z0-9]{12}$`)

// ─────────────────────────────────────────────
// 原有测试（已修改以对齐 PRD §3.2）
// ─────────────────────────────────────────────

// 1. happy path
func TestRegisterEarlyAccessHappyPath(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":           "alice@example.com",
		"wallet_address":  "0xabcdef1234567890abcdef1234567890abcdef12",
		"referral_source": "x_twitter",
		"source":          "market_page",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp model.Response
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if resp.Code != 0 {
		t.Fatalf("expected code=0, got %d, msg=%s", resp.Code, resp.Msg)
	}

	data := resp.Data.(map[string]interface{})
	id, _ := data["id"].(string)
	if !bizIDPattern.MatchString(id) {
		t.Errorf("id %q does not match %s", id, bizIDPattern)
	}
	rank, _ := data["rank"].(float64)
	if rank < 1 {
		t.Errorf("expected rank >= 1, got %v", rank)
	}
	// already_registered 字段已删除，不再断言
	if _, exists := data["already_registered"]; exists {
		t.Errorf("already_registered field should not exist in response")
	}
}

// 2. 重复 email → 409（原幂等测试改为重复报错）
func TestRegisterEarlyAccessDuplicateEmail(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	// 第一次注册成功
	w1 := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
	})
	if w1.Code != http.StatusOK {
		t.Fatalf("first request failed: %d %s", w1.Code, w1.Body.String())
	}

	// 第二次：同 email，不同 wallet → 409
	w2 := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0x1111111111111111111111111111111111111111",
	})
	if w2.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w2.Code, w2.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w2.Body.Bytes(), &resp)
	if resp.Code != 409 {
		t.Errorf("expected code=409, got %d", resp.Code)
	}
	if resp.Msg != "This email is already registered" {
		t.Errorf("expected msg='This email is already registered', got %q", resp.Msg)
	}
}

// 3. 重复 wallet → 409
func TestRegisterEarlyAccessDuplicateWallet(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
	})

	w := postRegister(r, map[string]interface{}{
		"email":          "bob@example.com",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
	})
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 409 {
		t.Errorf("expected code=409, got %d", resp.Code)
	}
	if resp.Msg != "This wallet is already registered" {
		t.Errorf("expected msg='This wallet is already registered', got %q", resp.Msg)
	}
}

// 4. 大小写归一化后命中重复 → 409
func TestRegisterEarlyAccessDuplicateCaseInsensitive(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	// 注册小写版本
	postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
	})

	// 用大写再提交 → 归一化后命中重复 → 409
	w := postRegister(r, map[string]interface{}{
		"email":          "Alice@Example.com",
		"wallet_address": "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
	})
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 409 {
		t.Errorf("expected code=409, got %d", resp.Code)
	}
}

// 5. 无效 email → 400
func TestRegisterEarlyAccessInvalidEmail(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":          "not-an-email",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 400 {
		t.Errorf("expected code=400, got %d", resp.Code)
	}
	if resp.Msg != "Please enter a valid email" {
		t.Errorf("expected PRD msg, got %q", resp.Msg)
	}
}

// 6. 无效 wallet → 400
func TestRegisterEarlyAccessInvalidWallet(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "not-a-wallet",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 400 {
		t.Errorf("expected code=400, got %d", resp.Code)
	}
	if resp.Msg != "Error: Please enter a valid BSC wallet address (0x..., 42 chars)" {
		t.Errorf("expected PRD wallet msg, got %q", resp.Msg)
	}
}

// 7. 缺少必填字段 email → 400
func TestRegisterEarlyAccessMissingEmail(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// 8. referral_source 枚举不合法 → 400
func TestRegisterEarlyAccessInvalidReferralSource(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":           "alice@example.com",
		"wallet_address":  "0xabcdef1234567890abcdef1234567890abcdef12",
		"referral_source": "invalid_source",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 400 {
		t.Errorf("expected code=400, got %d", resp.Code)
	}
	if resp.Msg != "Please select a valid source" {
		t.Errorf("expected PRD msg, got %q", resp.Msg)
	}
}

// 9. expected_feature 超过 500 字符 → 400
func TestRegisterEarlyAccessExpectedFeatureTooLong(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":            "alice@example.com",
		"wallet_address":   "0xabcdef1234567890abcdef1234567890abcdef12",
		"expected_feature": strings.Repeat("a", 501),
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 400 {
		t.Errorf("expected code=400, got %d", resp.Code)
	}
	if resp.Msg != "Too long (max 500 chars)" {
		t.Errorf("expected PRD msg, got %q", resp.Msg)
	}
}

// 10. 拉黑重试：status=0 占位记录 → INSERT 冲突 → 重查 status=1 仍无 → 500
func TestRegisterEarlyAccessBlacklistedRetry(t *testing.T) {
	repo := newFakeRepo()

	// 预置 status=0 占位记录（模拟被拉黑）
	repo.mu.Lock()
	repo.records["ea_blacklisted0001"] = &model.EarlyAccessRegistration{
		ID:            99,
		BizID:         "ea_blacklisted0001",
		Email:         "blocked@example.com",
		WalletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		Status:        0, // 拉黑
	}
	repo.mu.Unlock()

	// 捕获日志输出
	var logBuf bytes.Buffer
	origLogger := earlyAccessLogger
	earlyAccessLogger = &logBuf
	defer func() { earlyAccessLogger = origLogger }()

	r := newTestRouter(repo)
	w := postRegister(r, map[string]interface{}{
		"email":          "blocked@example.com",
		"wallet_address": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	})

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 500 {
		t.Errorf("expected code=500, got %d", resp.Code)
	}
	if !strings.Contains(logBuf.String(), "blacklisted retry") {
		t.Errorf("expected log to contain 'blacklisted retry', got: %s", logBuf.String())
	}
}

// 11. utm 字段落库
func TestRegisterEarlyAccessUtmFieldsPersisted(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
		"utm_source":     "twitter",
		"utm_campaign":   "early_access_2026",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// 验证 fake repo 中的记录确实保存了 utm 字段
	repo.mu.Lock()
	defer repo.mu.Unlock()
	var found *model.EarlyAccessRegistration
	for _, r := range repo.records {
		if r.Email == "alice@example.com" {
			found = r
			break
		}
	}
	if found == nil {
		t.Fatal("record not found in fake repo")
	}
	if found.UTMSource != "twitter" {
		t.Errorf("expected utm_source=twitter, got %q", found.UTMSource)
	}
	if found.UTMCampaign != "early_access_2026" {
		t.Errorf("expected utm_campaign=early_access_2026, got %q", found.UTMCampaign)
	}
	// already_registered 字段已删除，不再断言
}

// 12. referral_source 为空（不传）→ 允许，返回 200
func TestRegisterEarlyAccessEmptyReferralSource(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
		// 不传 referral_source
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 0 {
		t.Errorf("expected code=0, got %d", resp.Code)
	}
	// already_registered 字段已删除，不再断言
}

// 13. GenBizID 格式校验：100 次调用，全部匹配格式且互不重复
func TestGenBizIDFormat(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		id := storage.GenBizID()
		if !bizIDPattern.MatchString(id) {
			t.Errorf("id %q does not match pattern %s", id, bizIDPattern)
		}
		if seen[id] {
			t.Errorf("duplicate biz_id generated: %s", id)
		}
		seen[id] = true
	}
}

// ─────────────────────────────────────────────
// P0 测试：新增
// ─────────────────────────────────────────────

// 14. XSS 过滤 expected_feature — DB 存 escape 后内容
func TestRegisterEarlyAccessXSSExpectedFeature(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":            "xss1@example.com",
		"wallet_address":   "0x1111111111111111111111111111111111111111",
		"expected_feature": "<script>alert(1)</script>",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	rec := repo.lastInsert()
	if rec == nil {
		t.Fatal("no record inserted")
	}
	want := "&lt;script&gt;alert(1)&lt;/script&gt;"
	if rec.ExpectedFeature != want {
		t.Errorf("expected XSS escaped %q, got %q", want, rec.ExpectedFeature)
	}
}

// 15. XSS 过滤 referral_source_other — DB 存 escape 后内容
func TestRegisterEarlyAccessXSSReferralSourceOther(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":                 "xss2@example.com",
		"wallet_address":        "0x2222222222222222222222222222222222222222",
		"referral_source":       "other",
		"referral_source_other": "<img src=x onerror=alert(1)>",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	rec := repo.lastInsert()
	if rec == nil {
		t.Fatal("no record inserted")
	}
	want := "&lt;img src=x onerror=alert(1)&gt;"
	if rec.ReferralSourceOther != want {
		t.Errorf("expected XSS escaped %q, got %q", want, rec.ReferralSourceOther)
	}
}

// 16. 缺少必填字段 wallet → 400
func TestRegisterEarlyAccessMissingWallet(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email": "alice@example.com",
		// 不传 wallet_address
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// 17. referral_source=other 但 referral_source_other 为空 → 400
func TestRegisterEarlyAccessReferralSourceOtherRequired(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":           "alice@example.com",
		"wallet_address":  "0xabcdef1234567890abcdef1234567890abcdef12",
		"referral_source": "other",
		// referral_source_other 不传（空字符串）
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Msg != "Please specify the source" {
		t.Errorf("expected 'Please specify the source', got %q", resp.Msg)
	}
}

// 18. referral_source=other + referral_source_other 全空白 → 400（trim 后为空）
func TestRegisterEarlyAccessReferralSourceOtherWhitespace(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":                 "alice@example.com",
		"wallet_address":        "0xabcdef1234567890abcdef1234567890abcdef12",
		"referral_source":       "other",
		"referral_source_other": "   ",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Msg != "Please specify the source" {
		t.Errorf("expected 'Please specify the source', got %q", resp.Msg)
	}
}

// ─────────────────────────────────────────────
// P1 测试：边界值
// ─────────────────────────────────────────────

// 19. email 恰好 128 字符 → 200
func TestRegisterEarlyAccessEmailExactly128(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	// 构造 128 字符 email：local@domain.com，local 部分填充到总长 128
	// 格式：local(N)@example.com，domain 部分 12 字符（@example.com）
	local := strings.Repeat("a", 128-len("@example.com"))
	email := local + "@example.com"
	if len(email) != 128 {
		t.Fatalf("test setup: email len=%d, want 128", len(email))
	}

	w := postRegister(r, map[string]interface{}{
		"email":          email,
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// 20. email 129 字符 → 400
func TestRegisterEarlyAccessEmailTooLong129(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	local := strings.Repeat("a", 129-len("@example.com"))
	email := local + "@example.com"
	if len(email) != 129 {
		t.Fatalf("test setup: email len=%d, want 129", len(email))
	}

	w := postRegister(r, map[string]interface{}{
		"email":          email,
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// 21. wallet 41 位 hex（缺1）→ 400
func TestRegisterEarlyAccessWalletTooShort(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0x" + strings.Repeat("a", 39), // 0x + 39 = 41 字符，少1位
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// 22. wallet 43 位（多1）→ 400
func TestRegisterEarlyAccessWalletTooLong(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0x" + strings.Repeat("a", 41), // 0x + 41 = 43 字符，多1位
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// 23. expected_feature 恰好 500 字符（escape 后）→ 200
func TestRegisterEarlyAccessExpectedFeatureExactly500(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	// 500 个普通字符（不含 XSS，escape 后长度不变）
	feature := strings.Repeat("a", 500)

	w := postRegister(r, map[string]interface{}{
		"email":            "alice@example.com",
		"wallet_address":   "0xabcdef1234567890abcdef1234567890abcdef12",
		"expected_feature": feature,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// 24. referral_source_other 恰好 64 字符 → 200
func TestRegisterEarlyAccessReferralSourceOtherExactly64(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":                 "alice@example.com",
		"wallet_address":        "0xabcdef1234567890abcdef1234567890abcdef12",
		"referral_source":       "other",
		"referral_source_other": strings.Repeat("a", 64),
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// 25. referral_source_other 65 字符 → 400
func TestRegisterEarlyAccessReferralSourceOtherTooLong65(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":                 "alice@example.com",
		"wallet_address":        "0xabcdef1234567890abcdef1234567890abcdef12",
		"referral_source":       "other",
		"referral_source_other": strings.Repeat("a", 65),
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Msg != "referral_source_other too long" {
		t.Errorf("expected 'referral_source_other too long', got %q", resp.Msg)
	}
}

// 26. source=facebook（不在白名单）→ 400
func TestRegisterEarlyAccessSourceInvalid(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
		"source":         "facebook",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp model.Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if !strings.Contains(strings.ToLower(resp.Msg), "invalid source") {
		t.Errorf("expected msg contains 'invalid source', got %q", resp.Msg)
	}
}

// 27. utm_source 65 字符 → 400
func TestRegisterEarlyAccessUtmSourceTooLong(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
		"utm_source":     strings.Repeat("x", 65),
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// 28. utm_campaign 65 字符 → 400
func TestRegisterEarlyAccessUtmCampaignTooLong(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{
		"email":          "alice@example.com",
		"wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12",
		"utm_campaign":   strings.Repeat("x", 65),
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// 29. 空 body {} → 400（必填缺失）
func TestRegisterEarlyAccessEmptyBody(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegister(r, map[string]interface{}{})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// 30. malformed JSON → 400
func TestRegisterEarlyAccessMalformedJSON(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	w := postRegisterRaw(r, []byte(`{invalid`))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// ─────────────────────────────────────────────
// P2 测试
// ─────────────────────────────────────────────

// 31. emoji 在 expected_feature 中 → 200（unicode 不受 html.EscapeString 影响）
func TestRegisterEarlyAccessEmojiExpectedFeature(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	feature := "我期待 🎉 新功能"
	w := postRegister(r, map[string]interface{}{
		"email":            "emoji@example.com",
		"wallet_address":   "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
		"expected_feature": feature,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	rec := repo.lastInsert()
	if rec == nil {
		t.Fatal("no record inserted")
	}
	// html.EscapeString 不影响 unicode，内容应保持不变
	if rec.ExpectedFeature != feature {
		t.Errorf("expected feature=%q, got %q", feature, rec.ExpectedFeature)
	}
}

// 32. email 字段类型错误（传数字）→ 400
func TestRegisterEarlyAccessTypeMismatchEmail(t *testing.T) {
	repo := newFakeRepo()
	r := newTestRouter(repo)

	// JSON 中 email 为数字，binding 应失败
	w := postRegisterRaw(r, []byte(`{"email":123,"wallet_address":"0xabcdef1234567890abcdef1234567890abcdef12"}`))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}
