// Package jwt 封装管理员 JWT 的签发、解析、黑名单。
//
// 设计要点：
//   - 强制 HS256，Parse 时显式校验 alg，防 alg=none 攻击
//   - secret ≥ 32 字节，启动期校验 + Sign 时再兜底
//   - jti 用 uuid v4 写入 claims，登出时拉黑（Redis TTL = 剩余 exp）
//   - 黑名单失败不阻断 Parse 的成功路径（Redis 抖动不应让所有人登出），但日志告警
//   - 时间源通过 nowFn 注入，便于单测控制过期
package jwt

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	redispkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/redis"
)

var (
	// ErrTokenExpired 表示 JWT 已过期，middleware 翻译成 TOKEN_EXPIRED。
	ErrTokenExpired = errors.New("jwt expired")
	// ErrTokenInvalid 表示 JWT 签名/格式/alg 错误，middleware 翻译成 TOKEN_INVALID。
	ErrTokenInvalid = errors.New("jwt invalid")
	// ErrTokenBlacklisted 表示 jti 已被拉黑（用户主动登出），middleware 翻译成 UNAUTHORIZED。
	// 不暴露黑名单存在性，避免给攻击者 oracle。
	ErrTokenBlacklisted = errors.New("jwt blacklisted")
)

// Claims 是解析后暴露给上层的字段集合，去掉了 jwt 库内部细节。
type Claims struct {
	UserID string
	Role   string
	Name   string
	Email  string
	Avatar string
	JTI    string
	Iss    string
	Iat    time.Time
	Exp    time.Time
}

// Service 暴露给 service / middleware 的接口。
type Service interface {
	Sign(ctx context.Context, admin *model.AdminUser) (token string, jti string, exp time.Time, err error)
	Parse(ctx context.Context, token string) (*Claims, error)
	Revoke(ctx context.Context, jti string, exp time.Time) error
}

type service struct {
	secret []byte
	ttl    time.Duration
	issuer string
	rdb    *redis.Client
	now    func() time.Time
}

// New 用真实时钟构造 Service。
func New(cfg config.JWTConfig, rdb *redis.Client) Service {
	return NewWithClock(cfg, rdb, time.Now)
}

// NewWithClock 注入自定义时钟，仅用于单测（生产代码不要调用）。
func NewWithClock(cfg config.JWTConfig, rdb *redis.Client, nowFn func() time.Time) Service {
	if nowFn == nil {
		nowFn = time.Now
	}
	return &service{
		secret: []byte(cfg.Secret),
		ttl:    cfg.TTL,
		issuer: cfg.Issuer,
		rdb:    rdb,
		now:    nowFn,
	}
}

// internalClaims 是 jwt 库内部 marshal 的结构。custom 字段平铺到 JSON 顶层，
// 同时嵌入 RegisteredClaims 拿到标准字段（sub/iss/iat/exp/jti）。
type internalClaims struct {
	Role   string `json:"role"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Avatar string `json:"avatar"`
	gojwt.RegisteredClaims
}

// Sign 签发 JWT。失败场景：secret 弱、admin nil。
// 返回 jti / exp 便于 logout handler 拉黑。
func (s *service) Sign(_ context.Context, admin *model.AdminUser) (string, string, time.Time, error) {
	// secret 弱直接拒签，避免运行期才暴问题。config.validate 也会拦默认值，这里是二次兜底。
	if len(s.secret) < 32 {
		return "", "", time.Time{}, errors.New("jwt secret too short (< 32 bytes)")
	}
	if admin == nil {
		return "", "", time.Time{}, errors.New("admin is nil")
	}
	now := s.now()
	exp := now.Add(s.ttl)
	jti := uuid.NewString()

	claims := internalClaims{
		Role:   admin.Role.String(),
		Name:   admin.LarkName,
		Email:  admin.LarkEmail,
		Avatar: admin.LarkAvatar,
		RegisteredClaims: gojwt.RegisteredClaims{
			// sub 加 "lark:" 前缀，留出未来可能扩展 sub 命名空间的空间
			Subject:   "lark:" + admin.LarkUserID,
			Issuer:    s.issuer,
			IssuedAt:  gojwt.NewNumericDate(now),
			ExpiresAt: gojwt.NewNumericDate(exp),
			ID:        jti,
		},
	}
	tok := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(s.secret)
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("sign: %w", err)
	}
	return signed, jti, exp, nil
}

// Parse 校验签名 + alg + 过期 + 黑名单。
// 任一失败返回具名 error，由 middleware 翻译。
func (s *service) Parse(ctx context.Context, token string) (*Claims, error) {
	if token == "" {
		return nil, ErrTokenInvalid
	}
	// 用注入的时钟做过期判断（jwt v5 默认使用 time.Now）
	parser := gojwt.NewParser(
		gojwt.WithValidMethods([]string{gojwt.SigningMethodHS256.Alg()}),
		gojwt.WithTimeFunc(s.now),
	)
	parsed, err := parser.ParseWithClaims(token, &internalClaims{}, func(t *gojwt.Token) (interface{}, error) {
		// 二次校验 alg，防 alg=none / RS256 伪造
		if _, ok := t.Method.(*gojwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected alg %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		if errors.Is(err, gojwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrTokenInvalid
	}
	c, ok := parsed.Claims.(*internalClaims)
	if !ok || !parsed.Valid {
		return nil, ErrTokenInvalid
	}

	// 黑名单查询：**fail-closed**。
	// 登出是用户显式动作，安全优先于可用性。Redis 抖动期间宁可让所有人重登，
	// 也不能让已注销的 jti 继续访问。返回 ErrTokenInvalid（不暴露黑名单存在性）。
	if s.rdb != nil && c.ID != "" {
		hit, err := s.rdb.Exists(ctx, redispkg.KeyJWTBlacklist+c.ID).Result()
		if err != nil {
			return nil, ErrTokenInvalid
		}
		if hit > 0 {
			return nil, ErrTokenBlacklisted
		}
	}

	// 把 "lark:" 前缀去掉，让上层拿到原始 lark_user_id
	userID := strings.TrimPrefix(c.Subject, "lark:")

	return &Claims{
		UserID: userID,
		Role:   c.Role,
		Name:   c.Name,
		Email:  c.Email,
		Avatar: c.Avatar,
		JTI:    c.ID,
		Iss:    c.Issuer,
		Iat:    safeTime(c.IssuedAt),
		Exp:    safeTime(c.ExpiresAt),
	}, nil
}

// Revoke 把 jti 写黑名单，TTL = 剩余 exp。
// 已过期的 jti 不写（自然过期）。
func (s *service) Revoke(ctx context.Context, jti string, exp time.Time) error {
	if jti == "" {
		return errors.New("jti empty")
	}
	if s.rdb == nil {
		return errors.New("redis client is nil")
	}
	ttl := exp.Sub(s.now())
	if ttl <= 0 {
		return nil
	}
	if err := s.rdb.Set(ctx, redispkg.KeyJWTBlacklist+jti, "1", ttl).Err(); err != nil {
		return fmt.Errorf("redis set blacklist: %w", err)
	}
	return nil
}

func safeTime(n *gojwt.NumericDate) time.Time {
	if n == nil {
		return time.Time{}
	}
	return n.Time
}
