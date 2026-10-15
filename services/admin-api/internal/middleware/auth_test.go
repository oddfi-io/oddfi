package middleware_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	jwtpkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
)

func setupAuthEngine(t *testing.T, nowFn func() time.Time) (*gin.Engine, jwtpkg.Service) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	cfg := config.JWTConfig{
		Secret: "0123456789abcdef0123456789abcdef",
		TTL:    time.Hour, Issuer: "test",
	}
	jwtSvc := jwtpkg.NewWithClock(cfg, rdb, nowFn)

	r := gin.New()
	r.GET("/protected", middleware.AdminAuthMiddleware(jwtSvc), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"admin_user_id": c.GetString(middleware.CtxAdminUserID),
			"role":          c.GetString(middleware.CtxRole),
			"name":          c.GetString(middleware.CtxName),
			"email":         c.GetString(middleware.CtxEmail),
			"jti":           c.GetString(middleware.CtxJTI),
		})
	})
	return r, jwtSvc
}

func freshToken(t *testing.T, jwtSvc jwtpkg.Service) (token, jti string, exp time.Time) {
	t.Helper()
	tok, jt, ex, err := jwtSvc.Sign(context.Background(), &model.AdminUser{
		LarkUserID: "ou_test", LarkName: "测试", LarkEmail: "t@x.com", Role: model.RoleOperator,
	})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return tok, jt, ex
}

func TestAuth_MissingHeader(t *testing.T) {
	r, _ := setupAuthEngine(t, time.Now)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
}

func TestAuth_WrongPrefix(t *testing.T) {
	r, jwtSvc := setupAuthEngine(t, time.Now)
	tok, _, _ := freshToken(t, jwtSvc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Token "+tok)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
}

func TestAuth_EmptyBearer(t *testing.T) {
	r, _ := setupAuthEngine(t, time.Now)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer ")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
}

func TestAuth_TamperedToken(t *testing.T) {
	r, jwtSvc := setupAuthEngine(t, time.Now)
	tok, _, _ := freshToken(t, jwtSvc)
	tampered := tok[:len(tok)-4] + "AAAA"

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tampered)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	if body["code"] != "TOKEN_INVALID" {
		t.Errorf("code = %v, want TOKEN_INVALID", body["code"])
	}
}

func TestAuth_Expired(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	r, jwtSvc := setupAuthEngine(t, func() time.Time { return now })
	tok, _, _ := freshToken(t, jwtSvc)

	// 拨快 2 小时（TTL=1h）
	now = now.Add(2 * time.Hour)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	if body["code"] != "TOKEN_EXPIRED" {
		t.Errorf("code = %v, want TOKEN_EXPIRED", body["code"])
	}
}

func TestAuth_Revoked(t *testing.T) {
	r, jwtSvc := setupAuthEngine(t, time.Now)
	tok, jti, exp := freshToken(t, jwtSvc)

	if err := jwtSvc.Revoke(context.Background(), jti, exp); err != nil {
		t.Fatalf("revoke: %v", err)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", w.Code)
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	// revoked 不暴露 BLACKLISTED，用通用 UNAUTHORIZED
	if body["code"] != "UNAUTHORIZED" {
		t.Errorf("code = %v, want UNAUTHORIZED", body["code"])
	}
}

func TestAuth_HappyPath(t *testing.T) {
	r, jwtSvc := setupAuthEngine(t, time.Now)
	tok, jti, _ := freshToken(t, jwtSvc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	// 验证大小写不敏感的 Bearer
	req.Header.Set("Authorization", "bearer  "+tok)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", w.Code)
	}
	var body map[string]any
	_ = json.NewDecoder(w.Body).Decode(&body)
	if body["admin_user_id"] != "ou_test" {
		t.Errorf("admin_user_id = %v", body["admin_user_id"])
	}
	if body["role"] != "operator" {
		t.Errorf("role = %v", body["role"])
	}
	if body["jti"] != jti {
		t.Errorf("jti mismatch")
	}
}
