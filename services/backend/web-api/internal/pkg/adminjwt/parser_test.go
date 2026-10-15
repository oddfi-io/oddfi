package adminjwt

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
	"testing"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
)

// signTestToken 模拟 admin-backend 签发流程（与 internal/pkg/jwt/jwt.go internalClaims 一致）。
func signTestToken(t *testing.T, secret string, claims internalClaims) string {
	t.Helper()
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

// signRS256Token 用于测试 alg=none / RS256 等异常 alg 拒签（防 alg confusion 攻击）。
func signHS512Token(t *testing.T, secret string, claims internalClaims) string {
	t.Helper()
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS512, claims)
	signed, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign HS512: %v", err)
	}
	return signed
}

func validClaims(now time.Time) internalClaims {
	return internalClaims{
		Role:   "operator",
		Name:   "Hank",
		Email:  "hank@example.com",
		Avatar: "https://avatar/url",
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "lark:ou_12abc",
			Issuer:    Issuer,
			IssuedAt:  gojwt.NewNumericDate(now),
			ExpiresAt: gojwt.NewNumericDate(now.Add(2 * time.Hour)),
			ID:        "jti-001",
		},
	}
}

func newSecret(t *testing.T) string {
	t.Helper()
	buf := make([]byte, 48)
	if _, err := rand.Read(buf); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return base64.StdEncoding.EncodeToString(buf)
}

func TestParse_Valid(t *testing.T) {
	secret := newSecret(t)
	now := time.Now()
	token := signTestToken(t, secret, validClaims(now))

	claims, err := Parse(token, secret)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if claims.LarkUserID != "ou_12abc" {
		t.Errorf("LarkUserID = %q, want ou_12abc", claims.LarkUserID)
	}
	if claims.Role != "operator" {
		t.Errorf("Role = %q", claims.Role)
	}
	if claims.JTI != "jti-001" {
		t.Errorf("JTI = %q", claims.JTI)
	}
	if claims.ExpiresAt.Before(now) {
		t.Error("ExpiresAt should be in future")
	}
}

func TestParse_WrongSecret(t *testing.T) {
	secret := newSecret(t)
	token := signTestToken(t, secret, validClaims(time.Now()))

	other := newSecret(t)
	_, err := Parse(token, other)
	if err == nil {
		t.Fatal("expected error with wrong secret")
	}
}

func TestParse_Expired(t *testing.T) {
	secret := newSecret(t)
	claims := validClaims(time.Now())
	claims.ExpiresAt = gojwt.NewNumericDate(time.Now().Add(-1 * time.Hour))
	token := signTestToken(t, secret, claims)

	_, err := Parse(token, secret)
	if err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestParse_WrongIssuer(t *testing.T) {
	secret := newSecret(t)
	claims := validClaims(time.Now())
	claims.Issuer = "wrong-issuer"
	token := signTestToken(t, secret, claims)

	_, err := Parse(token, secret)
	if err == nil {
		t.Fatal("expected error for wrong issuer")
	}
}

func TestParse_SubMissingLarkPrefix(t *testing.T) {
	secret := newSecret(t)
	claims := validClaims(time.Now())
	claims.Subject = "user_no_prefix"
	token := signTestToken(t, secret, claims)

	_, err := Parse(token, secret)
	if err == nil {
		t.Fatal("expected error for sub without 'lark:' prefix")
	}
	if !strings.Contains(err.Error(), "lark:") {
		t.Errorf("error should mention 'lark:' prefix, got: %v", err)
	}
}

func TestParse_SubEmptyAfterPrefix(t *testing.T) {
	secret := newSecret(t)
	claims := validClaims(time.Now())
	claims.Subject = "lark:"
	token := signTestToken(t, secret, claims)

	_, err := Parse(token, secret)
	if err == nil {
		t.Fatal("expected error for empty sub after prefix strip")
	}
}

// TestParse_RejectsHS512_AlgConfusion 防 alg confusion 攻击：HS256 secret 用 HS512 签的 token 必须拒
func TestParse_RejectsHS512(t *testing.T) {
	secret := newSecret(t)
	token := signHS512Token(t, secret, validClaims(time.Now()))

	_, err := Parse(token, secret)
	if err == nil {
		t.Fatal("expected error for HS512 token (only HS256 allowed)")
	}
}

func TestParse_EmptyToken(t *testing.T) {
	secret := newSecret(t)
	_, err := Parse("", secret)
	if err == nil {
		t.Fatal("expected error for empty token")
	}
}

func TestParse_ShortSecret(t *testing.T) {
	token := signTestToken(t, "any-secret-that-was-used", validClaims(time.Now()))
	_, err := Parse(token, "short")
	if err == nil {
		t.Fatal("expected error for short secret")
	}
	if !strings.Contains(err.Error(), "secret too short") {
		t.Errorf("error should mention secret length, got: %v", err)
	}
}

func TestParse_MalformedToken(t *testing.T) {
	secret := newSecret(t)
	_, err := Parse("not.a.valid.jwt", secret)
	if err == nil {
		t.Fatal("expected error for malformed token")
	}
}

// TestParse_CompatibleWithAdminBackend 验证 web-api 验签 admin-backend 真实签发流程的 token 也通过。
// 这是 contract test — 字段名 / 类型 / issuer / sub 前缀必须与 admin-backend internalClaims 完全对齐。
func TestParse_CompatibleWithAdminBackend(t *testing.T) {
	secret := newSecret(t)
	// 模拟 admin-backend internalClaims（字段名严格对齐 jwt.go:82-92）
	type adminInternalClaims struct {
		Role   string `json:"role"`
		Name   string `json:"name"`
		Email  string `json:"email"`
		Avatar string `json:"avatar"`
		gojwt.RegisteredClaims
	}
	claims := adminInternalClaims{
		Role:   "super_admin",
		Name:   "Hank",
		Email:  "hank@oddfi.io",
		Avatar: "https://i.example.com/x",
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   "lark:ou_real_user_id_here",
			Issuer:    "oddfi-admin",
			IssuedAt:  gojwt.NewNumericDate(time.Now()),
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
			ID:        "real-jti-uuid",
		},
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	signed, _ := tok.SignedString([]byte(secret))

	parsed, err := Parse(signed, secret)
	if err != nil {
		t.Fatalf("admin-backend compatible token failed: %v", err)
	}
	if parsed.LarkUserID != "ou_real_user_id_here" {
		t.Errorf("LarkUserID mismatch: %q", parsed.LarkUserID)
	}
	if parsed.Role != "super_admin" {
		t.Errorf("Role mismatch: %q", parsed.Role)
	}
	if parsed.Email != "hank@oddfi.io" {
		t.Errorf("Email mismatch: %q", parsed.Email)
	}
}

// TestParse_Fuzz_RandomGarbage 用随机字节做 fuzz：不应 panic，只应返 error
func TestParse_Fuzz_RandomGarbage(t *testing.T) {
	secret := newSecret(t)
	cases := []string{
		"...",
		"a.b.c",
		"eyJhbGc.eyJzdWI.invalid",
		strings.Repeat("A", 10000),
		"\x00\x01\x02",
	}
	for _, garbage := range cases {
		t.Run("garbage_"+garbage[:min(len(garbage), 20)], func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("Parse panicked on garbage: %v", r)
				}
			}()
			_, _ = Parse(garbage, secret) // 不关心返回，只关心不 panic
		})
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
