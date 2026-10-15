package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	gojwt "github.com/golang-jwt/jwt/v5"
)

// internalClaimsTest 模拟 admin-backend internalClaims marshal 格式
type internalClaimsTest struct {
	Role  string `json:"role"`
	Name  string `json:"name"`
	Email string `json:"email"`
	gojwt.RegisteredClaims
}

func newSecretMW(t *testing.T) string {
	t.Helper()
	buf := make([]byte, 48)
	_, _ = rand.Read(buf)
	return base64.StdEncoding.EncodeToString(buf)
}

func signAdminJWT(t *testing.T, secret string, claims internalClaimsTest) string {
	t.Helper()
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	s, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return s
}

func setupAdminJWTRouter(secret string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/admin", AdminJWT(AdminJWTConfig{Secret: secret}), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"operatorId":   c.GetString(CtxAdminOperatorID),
			"operatorRole": c.GetString(CtxAdminOperatorRole),
			"jti":          c.GetString(CtxAdminJTI),
		})
	})
	return r
}

func TestAdminJWT_HappyPath(t *testing.T) {
	secret := newSecretMW(t)
	now := time.Now()
	token := signAdminJWT(t, secret, internalClaimsTest{
		Role:  "operator",
		Name:  "Hank",
		Email: "h@x.com",
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "lark:ou_abc123",
			Issuer:    "oddfi-admin",
			IssuedAt:  gojwt.NewNumericDate(now),
			ExpiresAt: gojwt.NewNumericDate(now.Add(2 * time.Hour)),
			ID:        "jti-001",
		},
	})

	r := setupAdminJWTRouter(secret)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/admin", nil)
	req.Header.Set("X-Admin-JWT", token)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("code = %d, body = %s", w.Code, w.Body.String())
	}
	// 简单字段验证
	body := w.Body.String()
	if !contains(body, "ou_abc123") {
		t.Errorf("operatorId not in response: %s", body)
	}
	if !contains(body, "operator") {
		t.Errorf("operatorRole not in response: %s", body)
	}
}

func TestAdminJWT_BearerPrefix(t *testing.T) {
	secret := newSecretMW(t)
	now := time.Now()
	token := signAdminJWT(t, secret, internalClaimsTest{
		Role: "operator",
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "lark:ou_x",
			Issuer:    "oddfi-admin",
			ExpiresAt: gojwt.NewNumericDate(now.Add(time.Hour)),
		},
	})

	r := setupAdminJWTRouter(secret)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/admin", nil)
	req.Header.Set("X-Admin-JWT", "Bearer "+token)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Bearer prefix should be stripped; got %d", w.Code)
	}
}

func TestAdminJWT_MissingHeader(t *testing.T) {
	secret := newSecretMW(t)
	r := setupAdminJWTRouter(secret)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/admin", nil))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("missing X-Admin-JWT should 401; got %d", w.Code)
	}
}

func TestAdminJWT_InvalidToken(t *testing.T) {
	secret := newSecretMW(t)
	r := setupAdminJWTRouter(secret)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/admin", nil)
	req.Header.Set("X-Admin-JWT", "not.a.valid.jwt")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("invalid token should 401; got %d", w.Code)
	}
}

func TestAdminJWT_WrongSecret(t *testing.T) {
	signSecret := newSecretMW(t)
	mwSecret := newSecretMW(t)
	now := time.Now()
	token := signAdminJWT(t, signSecret, internalClaimsTest{
		Role: "operator",
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "lark:ou_x",
			Issuer:    "oddfi-admin",
			ExpiresAt: gojwt.NewNumericDate(now.Add(time.Hour)),
		},
	})

	r := setupAdminJWTRouter(mwSecret)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/admin", nil)
	req.Header.Set("X-Admin-JWT", token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("wrong secret should 401; got %d", w.Code)
	}
}

func TestAdminJWT_Expired(t *testing.T) {
	secret := newSecretMW(t)
	token := signAdminJWT(t, secret, internalClaimsTest{
		Role: "operator",
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "lark:ou_x",
			Issuer:    "oddfi-admin",
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(-time.Hour)),
		},
	})

	r := setupAdminJWTRouter(secret)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/admin", nil)
	req.Header.Set("X-Admin-JWT", token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expired token should 401; got %d", w.Code)
	}
}

func TestAdminJWT_SubMissingPrefix(t *testing.T) {
	secret := newSecretMW(t)
	token := signAdminJWT(t, secret, internalClaimsTest{
		Role: "operator",
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "ou_x_no_prefix",
			Issuer:    "oddfi-admin",
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})

	r := setupAdminJWTRouter(secret)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/admin", nil)
	req.Header.Set("X-Admin-JWT", token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("sub without 'lark:' prefix should 401; got %d", w.Code)
	}
}

// TestAdminJWT_AdversarialAlgConfusion 防 alg confusion：HS512 签的 token 必须被 HS256-only middleware 拒
func TestAdminJWT_AdversarialAlgConfusion(t *testing.T) {
	secret := newSecretMW(t)
	claims := internalClaimsTest{
		Role: "operator",
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "lark:ou_x",
			Issuer:    "oddfi-admin",
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS512, claims)
	signed, _ := tok.SignedString([]byte(secret))

	r := setupAdminJWTRouter(secret)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/admin", nil)
	req.Header.Set("X-Admin-JWT", signed)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("HS512 token should be rejected by HS256-only middleware; got %d", w.Code)
	}
}

func contains(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
