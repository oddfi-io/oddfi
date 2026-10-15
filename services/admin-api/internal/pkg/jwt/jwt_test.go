package jwt_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	jwtpkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
	redispkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/redis"
)

// 32 字节长，满足 secret 最小长度。
const testSecret = "0123456789abcdef0123456789abcdef"

func newSvc(t *testing.T, nowFn func() time.Time) (jwtpkg.Service, *redis.Client) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	cfg := config.JWTConfig{
		Secret: testSecret,
		TTL:    time.Hour,
		Issuer: "oddfi-admin",
	}
	return jwtpkg.NewWithClock(cfg, rdb, nowFn), rdb
}

func sampleAdmin() *model.AdminUser {
	return &model.AdminUser{
		LarkUserID: "ou_test_001",
		LarkName:   "张三",
		LarkEmail:  "zhangsan@oddfi.io",
		LarkAvatar: "https://x/y.png",
		Role:       model.RoleOperator,
	}
}

// TestSignParse_HappyPath 验证 sign + parse 字段全等。
func TestSignParse_HappyPath(t *testing.T) {
	svc, _ := newSvc(t, time.Now)
	ctx := context.Background()
	admin := sampleAdmin()

	token, jti, exp, err := svc.Sign(ctx, admin)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	if token == "" || jti == "" || exp.IsZero() {
		t.Fatalf("empty fields: token=%q jti=%q exp=%v", token, jti, exp)
	}

	c, err := svc.Parse(ctx, token)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if c.UserID != admin.LarkUserID {
		t.Errorf("UserID = %q, want %q", c.UserID, admin.LarkUserID)
	}
	if c.Role != admin.Role.String() {
		t.Errorf("Role = %q, want %q", c.Role, admin.Role)
	}
	if c.Name != admin.LarkName || c.Email != admin.LarkEmail || c.Avatar != admin.LarkAvatar {
		t.Errorf("profile mismatch: %+v", c)
	}
	if c.JTI != jti {
		t.Errorf("JTI mismatch")
	}
}

// TestParse_TamperedPayload 篡改 payload 段，验签失败。
func TestParse_TamperedPayload(t *testing.T) {
	svc, _ := newSvc(t, time.Now)
	ctx := context.Background()

	token, _, _, err := svc.Sign(ctx, sampleAdmin())
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	// 把 token 中间一段替换（base64 字符），破坏 payload
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("token shape")
	}
	tampered := parts[0] + "." + "ZHVtbXk" + "." + parts[2]

	_, err = svc.Parse(ctx, tampered)
	if err != jwtpkg.ErrTokenInvalid {
		t.Errorf("want ErrTokenInvalid, got %v", err)
	}
}

// TestParse_WrongSecret 用另一个 secret 签的 token 必须被拒。
func TestParse_WrongSecret(t *testing.T) {
	svc, _ := newSvc(t, time.Now)
	ctx := context.Background()

	// 用错误 secret 签一个看似合法的 token
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, gojwt.MapClaims{
		"sub": "lark:ou_x",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	signed, _ := tok.SignedString([]byte("00000000000000000000000000000000"))

	_, err := svc.Parse(ctx, signed)
	if err != jwtpkg.ErrTokenInvalid {
		t.Errorf("want ErrTokenInvalid, got %v", err)
	}
}

// TestParse_Expired 通过注入未来时钟让现在签的 token 视为过期。
func TestParse_Expired(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	svc, _ := newSvc(t, func() time.Time { return now })
	ctx := context.Background()

	token, _, _, err := svc.Sign(ctx, sampleAdmin())
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	// 把时钟拨到 2 小时后（TTL 是 1h），token 已过期
	now = now.Add(2 * time.Hour)

	_, err = svc.Parse(ctx, token)
	if err != jwtpkg.ErrTokenExpired {
		t.Errorf("want ErrTokenExpired, got %v", err)
	}
}

// TestParse_AlgNone 拒绝 alg=none 攻击。
func TestParse_AlgNone(t *testing.T) {
	svc, _ := newSvc(t, time.Now)
	ctx := context.Background()

	tok := gojwt.NewWithClaims(gojwt.SigningMethodNone, gojwt.MapClaims{
		"sub": "lark:ou_evil",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	// SigningMethodNone 必须用 UnsafeAllowNoneSignatureType 才能签
	signed, _ := tok.SignedString(gojwt.UnsafeAllowNoneSignatureType)

	_, err := svc.Parse(ctx, signed)
	if err != jwtpkg.ErrTokenInvalid {
		t.Errorf("want ErrTokenInvalid, got %v", err)
	}
}

// TestRevoke_ThenParse 拉黑后 Parse 返回 Blacklisted。
func TestRevoke_ThenParse(t *testing.T) {
	svc, rdb := newSvc(t, time.Now)
	ctx := context.Background()

	token, jti, exp, err := svc.Sign(ctx, sampleAdmin())
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	if err := svc.Revoke(ctx, jti, exp); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	// 校验 Redis 确实写了
	hit, _ := rdb.Exists(ctx, redispkg.KeyJWTBlacklist+jti).Result()
	if hit == 0 {
		t.Fatal("blacklist key missing")
	}

	_, err = svc.Parse(ctx, token)
	if err != jwtpkg.ErrTokenBlacklisted {
		t.Errorf("want ErrTokenBlacklisted, got %v", err)
	}
}

// TestRevoke_AlreadyExpired 拉黑已过期的 token：不写 Redis，无错误返回。
func TestRevoke_AlreadyExpired(t *testing.T) {
	svc, rdb := newSvc(t, time.Now)
	ctx := context.Background()

	pastExp := time.Now().Add(-time.Hour)
	if err := svc.Revoke(ctx, "fake-jti", pastExp); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	hit, _ := rdb.Exists(ctx, redispkg.KeyJWTBlacklist+"fake-jti").Result()
	if hit != 0 {
		t.Fatal("blacklist key should not exist for expired jti")
	}
}

// TestSign_SecretTooShort 验证 secret 弱时拒签。
func TestSign_SecretTooShort(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	svc := jwtpkg.NewWithClock(config.JWTConfig{Secret: "short", TTL: time.Hour}, rdb, time.Now)
	_, _, _, err := svc.Sign(context.Background(), sampleAdmin())
	if err == nil {
		t.Fatal("expected secret-too-short error, got nil")
	}
}
