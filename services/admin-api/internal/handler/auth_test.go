package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/handler"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	jwtpkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
	redispkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/redis"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/repository"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/service"
)

type testFixture struct {
	engine  *gin.Engine
	rdb     *redis.Client
	db      *gorm.DB
	repo    repository.AdminUserRepository
	jwtSvc  jwtpkg.Service
	cfg     *config.Config
	larkSrv *httptest.Server // 真实 lark mock
}

// newLarkMockServer 构造可编程 Lark mock，按 query/code 分发响应。
func newLarkMockServer(t *testing.T, tokenJSON, userInfoJSON string, tokenStatus, userInfoStatus int) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/oidc/access_token", func(w http.ResponseWriter, r *http.Request) {
		if tokenStatus != 0 {
			w.WriteHeader(tokenStatus)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(tokenJSON))
	})
	mux.HandleFunc("/user_info", func(w http.ResponseWriter, r *http.Request) {
		if userInfoStatus != 0 {
			w.WriteHeader(userInfoStatus)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(userInfoJSON))
	})
	s := httptest.NewServer(mux)
	t.Cleanup(s.Close)
	return s
}

func setupHandlerFixture(t *testing.T, larkSrv *httptest.Server) *testFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)

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

	jwtSvc := jwtpkg.New(config.JWTConfig{
		Secret: "0123456789abcdef0123456789abcdef",
		TTL:    time.Hour, Issuer: "test",
	}, rdb)
	repo := repository.NewAdminUser(db)

	cfg := &config.Config{
		Lark: config.LarkConfig{
			AppID: "cli_test", AppSecret: "secret_test",
			AuthorizeURL: "https://lark.example/authorize",
			TokenURL:     larkSrv.URL + "/oidc/access_token",
			UserInfoURL:  larkSrv.URL + "/user_info",
			Scope:        "contact:user.base:readonly",
			RedirectURI:  "https://admin.oddfi.io/auth/lark/callback",
		},
		Frontend: config.FrontendConfig{
			CallbackURL: "https://admin.oddfi.io/auth/lark/callback",
		},
	}
	larkSvc := service.NewLarkOAuth(cfg.Lark, rdb, repo, jwtSvc)
	authH := handler.NewAuth(cfg, larkSvc, jwtSvc, repo)

	r := gin.New()
	auth := r.Group("/auth")
	{
		auth.GET("/lark/login", authH.LarkLogin)
		auth.GET("/lark/callback", authH.LarkCallback)
	}
	authProtected := r.Group("/auth", middleware.AdminAuthMiddleware(jwtSvc))
	{
		authProtected.GET("/me", authH.Me)
		authProtected.POST("/logout", authH.Logout)
	}
	return &testFixture{
		engine: r, rdb: rdb, db: db, repo: repo,
		jwtSvc: jwtSvc, cfg: cfg, larkSrv: larkSrv,
	}
}

// stealStateFromLogin 调一次 /auth/lark/login，从 Location 提取 state。
func stealStateFromLogin(t *testing.T, fix *testFixture) string {
	t.Helper()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/auth/lark/login", nil)
	fix.engine.ServeHTTP(w, req)
	if w.Code != http.StatusFound {
		t.Fatalf("login code=%d, want 302", w.Code)
	}
	loc := w.Header().Get("Location")
	u, _ := url.Parse(loc)
	state := u.Query().Get("state")
	if state == "" {
		t.Fatal("state empty in login redirect")
	}
	return state
}

func TestLarkLogin_Redirects(t *testing.T) {
	srv := newLarkMockServer(t, "", "", 0, 0)
	fix := setupHandlerFixture(t, srv)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/auth/lark/login", nil)
	fix.engine.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Fatalf("code = %d, want 302", w.Code)
	}
	loc := w.Header().Get("Location")
	if !strings.Contains(loc, "app_id=cli_test") || !strings.Contains(loc, "state=") {
		t.Errorf("bad redirect: %s", loc)
	}
}

func TestLarkCallback_MissingParams(t *testing.T) {
	srv := newLarkMockServer(t, "", "", 0, 0)
	fix := setupHandlerFixture(t, srv)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/auth/lark/callback", nil)
	fix.engine.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("code = %d, want 400", w.Code)
	}
}

// v2TokenJSON 返回 Lark v2 token endpoint 的合法成功响应 wire 字面量（access_token 平铺，无 open_id）。
// 集中放一处避免多个测试各自手写 JSON 漂移。
func v2TokenJSON(accessToken string) string {
	return `{"code":0,"access_token":"` + accessToken + `","expires_in":7200,"token_type":"Bearer","scope":"contact:user.base:readonly"}`
}

func TestLarkCallback_HappyPath(t *testing.T) {
	tokenJSON := v2TokenJSON("u-fake")
	userInfoJSON := `{"code":0,"msg":"ok","data":{"name":"张三","avatar_url":"https://x/y.png","email":"zs@oddfi.io","open_id":"ou_001"}}`
	srv := newLarkMockServer(t, tokenJSON, userInfoJSON, 0, 0)
	fix := setupHandlerFixture(t, srv)

	// seed admin
	if err := fix.repo.Create(context.Background(), &model.AdminUser{
		LarkUserID: "ou_001", LarkName: "张三", LarkEmail: "zs@oddfi.io", Role: model.RoleOperator,
	}); err != nil {
		t.Fatalf("seed: %v", err)
	}

	state := stealStateFromLogin(t, fix)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/auth/lark/callback?code=c1&state="+state, nil)
	fix.engine.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Fatalf("code = %d, want 302; body=%s", w.Code, w.Body.String())
	}
	loc := w.Header().Get("Location")
	// token 在 fragment（#token=...）中，不在 query
	if !strings.Contains(loc, "#token=") {
		t.Errorf("token should be in fragment: %s", loc)
	}
	parsed, _ := url.Parse(loc)
	if parsed.Query().Get("token") != "" {
		t.Errorf("token leaked to query: %s", parsed.RawQuery)
	}
	if !strings.HasPrefix(parsed.Fragment, "token=") || len(parsed.Fragment) < len("token=")+10 {
		t.Errorf("bad fragment: %q", parsed.Fragment)
	}
}

func TestLarkCallback_StateMismatch(t *testing.T) {
	srv := newLarkMockServer(t, "", "", 0, 0)
	fix := setupHandlerFixture(t, srv)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/auth/lark/callback?code=c&state=no-such", nil)
	fix.engine.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("code = %d, want 400", w.Code)
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	if body["code"] != "LARK_STATE_MISMATCH" {
		t.Errorf("errcode = %v", body["code"])
	}
}

func TestLarkCallback_NotAdmin(t *testing.T) {
	tokenJSON := v2TokenJSON("u")
	userInfoJSON := `{"code":0,"msg":"ok","data":{"name":"x","email":"x@x","open_id":"ou_outsider"}}`
	srv := newLarkMockServer(t, tokenJSON, userInfoJSON, 0, 0)
	fix := setupHandlerFixture(t, srv)

	state := stealStateFromLogin(t, fix)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/auth/lark/callback?code=c&state="+state, nil)
	fix.engine.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("code = %d, want 403", w.Code)
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	if body["code"] != "NOT_ADMIN" {
		t.Errorf("errcode = %v", body["code"])
	}
}

func TestMe_Unauthorized(t *testing.T) {
	srv := newLarkMockServer(t, "", "", 0, 0)
	fix := setupHandlerFixture(t, srv)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/auth/me", nil)
	fix.engine.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
}

func TestMe_HappyPath(t *testing.T) {
	srv := newLarkMockServer(t, "", "", 0, 0)
	fix := setupHandlerFixture(t, srv)

	admin := &model.AdminUser{LarkUserID: "ou_001", LarkName: "张三", LarkEmail: "zs@oddfi.io", Role: model.RoleOperator}
	if err := fix.repo.Create(context.Background(), admin); err != nil {
		t.Fatalf("seed: %v", err)
	}
	tok, _, _, err := fix.jwtSvc.Sign(context.Background(), admin)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	fix.engine.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	data := body["data"].(map[string]any)
	if data["user_id"] != "ou_001" {
		t.Errorf("user_id = %v", data["user_id"])
	}
	if data["role"] != "operator" {
		t.Errorf("role = %v", data["role"])
	}
}

func TestLogoutThenMe(t *testing.T) {
	srv := newLarkMockServer(t, "", "", 0, 0)
	fix := setupHandlerFixture(t, srv)

	admin := &model.AdminUser{LarkUserID: "ou_001", LarkName: "张三", Role: model.RoleOperator}
	if err := fix.repo.Create(context.Background(), admin); err != nil {
		t.Fatalf("seed: %v", err)
	}
	tok, jti, _, _ := fix.jwtSvc.Sign(context.Background(), admin)

	// 1) /auth/logout
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	fix.engine.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("logout code=%d", w.Code)
	}
	// 校验黑名单确实写入
	hit, _ := fix.rdb.Exists(context.Background(), redispkg.KeyJWTBlacklist+jti).Result()
	if hit == 0 {
		t.Fatal("blacklist key missing")
	}

	// 2) 第二次 /auth/me 必须 401（已注销）
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodGet, "/auth/me", nil)
	req2.Header.Set("Authorization", "Bearer "+tok)
	fix.engine.ServeHTTP(w2, req2)
	if w2.Code != http.StatusUnauthorized {
		t.Errorf("post-logout /me code=%d, want 401", w2.Code)
	}
}
