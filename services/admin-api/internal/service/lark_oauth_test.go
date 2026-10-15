package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
	redispkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/redis"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/repository"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/service"
)

// larkMock 是测试用的可编程 Lark mock。
// 每个测试单独构造，按 code/token/userInfo 三段独立配置响应。
type larkMock struct {
	tokenResp    interface{} // any → 序列化为 JSON 写回
	tokenStatus  int
	userInfoResp interface{}
	userInfoCode int
}

func newLarkServer(t *testing.T, m larkMock) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/oidc/access_token", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if m.tokenStatus != 0 {
			w.WriteHeader(m.tokenStatus)
		}
		// v2 失败响应也带 JSON body（含 error / error_description），
		// 所以 status 设了之后仍要继续写 body 以贴近真实场景。
		if m.tokenResp != nil {
			_ = json.NewEncoder(w).Encode(m.tokenResp)
		}
	})
	mux.HandleFunc("/user_info", func(w http.ResponseWriter, r *http.Request) {
		if m.userInfoCode != 0 {
			w.WriteHeader(m.userInfoCode)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(m.userInfoResp)
	})
	s := httptest.NewServer(mux)
	t.Cleanup(s.Close)
	return s
}

type testDeps struct {
	rdb    *redis.Client
	db     *gorm.DB
	repo   repository.AdminUserRepository
	jwtSvc jwt.Service
}

func setupDeps(t *testing.T) testDeps {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.AdminUser{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	jwtSvc := jwt.New(config.JWTConfig{
		Secret: "0123456789abcdef0123456789abcdef",
		TTL:    time.Hour, Issuer: "test",
	}, rdb)
	return testDeps{rdb, db, repository.NewAdminUser(db), jwtSvc}
}

func makeService(t *testing.T, srv *httptest.Server, d testDeps) service.LarkOAuthService {
	t.Helper()
	cfg := config.LarkConfig{
		AppID: "cli_test", AppSecret: "secret_test",
		AuthorizeURL: "https://lark.example/authorize",
		TokenURL:     srv.URL + "/oidc/access_token",
		UserInfoURL:  srv.URL + "/user_info",
		Scope:        "contact:user.base:readonly",
		RedirectURI:  "https://admin.oddfi.io/auth/lark/callback",
	}
	return service.NewLarkOAuth(cfg, d.rdb, d.repo, d.jwtSvc)
}

// okTokenResp 模拟 Lark v2 OAuth token endpoint 成功响应。
// v2 不在 token 响应里返回 open_id（OAuth 标准只含 token 字段），open_id 由 user_info mock 单独提供。
func okTokenResp() map[string]any {
	return map[string]any{
		"code":         0,
		"access_token": "u-fake-token",
		"expires_in":   7200,
		"token_type":   "Bearer",
		"scope":        "contact:user.base:readonly",
	}
}

func okUserInfoResp(openID, name, email string) map[string]any {
	return map[string]any{
		"code": 0, "msg": "ok",
		"data": map[string]any{
			"name":       name,
			"avatar_url": "https://x/y.png",
			"email":      email,
			"open_id":    openID,
		},
	}
}

func TestBuildAuthorizeURL_WritesState(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{})
	svc := makeService(t, srv, d)

	u, err := svc.BuildAuthorizeURL(context.Background())
	if err != nil {
		t.Fatalf("BuildAuthorizeURL: %v", err)
	}
	parsed, _ := url.Parse(u)
	state := parsed.Query().Get("state")
	if state == "" {
		t.Fatal("state empty")
	}
	if parsed.Query().Get("app_id") != "cli_test" {
		t.Errorf("app_id missing")
	}
	hit, _ := d.rdb.Exists(context.Background(), redispkg.KeyLarkState+state).Result()
	if hit == 0 {
		t.Fatal("state not in redis")
	}
}

// buildAndStealState 直接生成一个授权 URL，提取其中 state，便于后续 callback 测试。
func buildAndStealState(t *testing.T, svc service.LarkOAuthService) string {
	t.Helper()
	u, err := svc.BuildAuthorizeURL(context.Background())
	if err != nil {
		t.Fatalf("BuildAuthorizeURL: %v", err)
	}
	parsed, _ := url.Parse(u)
	return parsed.Query().Get("state")
}

func TestHandleCallback_StateMismatch(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{})
	svc := makeService(t, srv, d)

	_, err := svc.HandleCallback(context.Background(), "any-code", "no-such-state")
	if e := service.AsError(err); e == nil || e.Code != errcode.LarkStateMismatch {
		t.Errorf("want LarkStateMismatch, got %v", err)
	}
}

func TestHandleCallback_StateReplay(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{
		tokenResp:    okTokenResp(),
		userInfoResp: okUserInfoResp("ou_001", "张三", "zs@oddfi.io"),
	})
	svc := makeService(t, srv, d)

	// seed admin
	if err := d.repo.Create(context.Background(), &model.AdminUser{
		LarkUserID: "ou_001", LarkName: "张三", Role: model.RoleOperator,
	}); err != nil {
		t.Fatalf("seed: %v", err)
	}

	state := buildAndStealState(t, svc)
	if _, err := svc.HandleCallback(context.Background(), "code1", state); err != nil {
		t.Fatalf("first callback: %v", err)
	}
	// 再次用同一个 state：应被拒（已消费）
	_, err := svc.HandleCallback(context.Background(), "code2", state)
	if e := service.AsError(err); e == nil || e.Code != errcode.LarkStateMismatch {
		t.Errorf("replay want LarkStateMismatch, got %v", err)
	}
}

func TestHandleCallback_TokenHTTP5xx(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{tokenStatus: 500})
	svc := makeService(t, srv, d)

	state := buildAndStealState(t, svc)
	_, err := svc.HandleCallback(context.Background(), "code", state)
	if e := service.AsError(err); e == nil || e.Code != errcode.LarkExchangeFailed {
		t.Errorf("want LarkExchangeFailed, got %v", err)
	}
}

// v2 失败响应：HTTP 400 + OAuth 标准 error 字段（无 access_token）。
// 典型场景：invalid_client（App Secret 错）/ invalid_grant（code 失效）。
func TestHandleCallback_TokenV2Failure(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{
		tokenStatus: 400,
		tokenResp: map[string]any{
			"code":              20002,
			"error":             "invalid_client",
			"error_description": "Invalid client_secret",
		},
	})
	svc := makeService(t, srv, d)

	state := buildAndStealState(t, svc)
	_, err := svc.HandleCallback(context.Background(), "code", state)
	if e := service.AsError(err); e == nil || e.Code != errcode.LarkExchangeFailed {
		t.Errorf("want LarkExchangeFailed, got %v", err)
	}
}

// v2 异常响应：HTTP 200 但 access_token 为空（防御性）。
func TestHandleCallback_TokenEmptyAccessToken(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{
		tokenResp: map[string]any{"code": 0, "expires_in": 7200},
	})
	svc := makeService(t, srv, d)

	state := buildAndStealState(t, svc)
	_, err := svc.HandleCallback(context.Background(), "code", state)
	if e := service.AsError(err); e == nil || e.Code != errcode.LarkExchangeFailed {
		t.Errorf("want LarkExchangeFailed, got %v", err)
	}
}

func TestHandleCallback_UserInfoFails(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{
		tokenResp:    okTokenResp(),
		userInfoCode: 500,
	})
	svc := makeService(t, srv, d)

	state := buildAndStealState(t, svc)
	_, err := svc.HandleCallback(context.Background(), "code", state)
	if e := service.AsError(err); e == nil || e.Code != errcode.LarkUserInfoFailed {
		t.Errorf("want LarkUserInfoFailed, got %v", err)
	}
}

func TestHandleCallback_NotInAdminUsers(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{
		tokenResp:    okTokenResp(),
		userInfoResp: okUserInfoResp("ou_unauthorized", "外人", "x@x.com"),
	})
	svc := makeService(t, srv, d)

	state := buildAndStealState(t, svc)
	_, err := svc.HandleCallback(context.Background(), "code", state)
	if e := service.AsError(err); e == nil || e.Code != errcode.NotAdmin {
		t.Errorf("want NotAdmin, got %v", err)
	}
}

func TestHandleCallback_HappyPath(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{
		tokenResp:    okTokenResp(),
		userInfoResp: okUserInfoResp("ou_001", "张三", "zs@oddfi.io"),
	})
	svc := makeService(t, srv, d)

	if err := d.repo.Create(context.Background(), &model.AdminUser{
		LarkUserID: "ou_001", LarkName: "张三", LarkEmail: "zs@oddfi.io", Role: model.RoleOperator,
	}); err != nil {
		t.Fatalf("seed: %v", err)
	}

	state := buildAndStealState(t, svc)
	sess, err := svc.HandleCallback(context.Background(), "code", state)
	if err != nil {
		t.Fatalf("HandleCallback: %v", err)
	}
	if sess.JWT == "" || sess.JTI == "" {
		t.Errorf("empty JWT/JTI")
	}
	if sess.Admin.Role != model.RoleOperator {
		t.Errorf("role mismatch: %s", sess.Admin.Role)
	}
}

// TestConsumeState_AtomicGetDel 两个 goroutine 同时消费同一个 state，
// 由 Redis GETDEL 原子性保证只有一个成功。
func TestConsumeState_AtomicGetDel(t *testing.T) {
	d := setupDeps(t)
	srv := newLarkServer(t, larkMock{
		tokenResp:    okTokenResp(),
		userInfoResp: okUserInfoResp("ou_001", "张三", "zs@oddfi.io"),
	})
	svc := makeService(t, srv, d)

	if err := d.repo.Create(context.Background(), &model.AdminUser{
		LarkUserID: "ou_001", LarkName: "张三", Role: model.RoleOperator,
	}); err != nil {
		t.Fatalf("seed: %v", err)
	}

	state := buildAndStealState(t, svc)
	results := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.HandleCallback(context.Background(), "code", state)
			results <- err
		}()
	}
	wg.Wait()
	close(results)

	var okCount, stateMismatchCount int
	for err := range results {
		if err == nil {
			okCount++
			continue
		}
		if e := service.AsError(err); e != nil && e.Code == errcode.LarkStateMismatch {
			stateMismatchCount++
		}
	}
	if okCount != 1 || stateMismatchCount != 1 {
		t.Errorf("want 1 ok + 1 mismatch, got ok=%d mismatch=%d", okCount, stateMismatchCount)
	}
}
