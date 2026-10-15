// Package adminjwt 用于 web-api 验签 admin-backend 自签的 HS256 JWT。
//
// 设计要点（DD-003 v3.1 §4.2.2 + C3 修订）：
//
//   - admin-backend 在 Lark OAuth 完成后用 HS256 + ADMIN_JWT_SECRET 自签 JWT 给前端
//   - admin-backend 实现见：oddfi-admin-backend/internal/pkg/jwt/jwt.go
//   - web-api 通过 systemd 共享同一 ADMIN_JWT_SECRET，独立验签拿 operator 信息
//   - 不调 admin-backend /auth/me（无反向依赖）
//   - 不实现 JWT 黑名单查询（见 ADR-0002 Debt-2，TGE 前用 TTL≤2h 缓解）
//
// claims schema 对齐 admin-backend internalClaims：
//
//	{
//	  "role":   "super_admin / operator / customer_service / finance",
//	  "name":   "<lark name>",
//	  "email":  "<lark email>",
//	  "avatar": "<lark avatar url>",
//	  "sub":    "lark:<lark_user_id>",
//	  "iss":    "oddfi-admin",
//	  "iat":    <unix>,
//	  "exp":    <unix>,
//	  "jti":    "<uuid>"
//	}
package adminjwt

import (
	"fmt"
	"strings"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
)

// Issuer 是 admin-backend 签发 JWT 时固定的 iss claim 值（与 admin-backend config.jwt.issuer 一致）。
const Issuer = "oddfi-admin"

// SubjectPrefix 是 admin-backend 在 sub claim 前加的前缀（为未来扩展 sub 命名空间）。
const SubjectPrefix = "lark:"

// Claims 是验签 + 解析后暴露给上层的字段。
type Claims struct {
	LarkUserID string    // 从 sub 字段去掉 "lark:" 前缀
	Role       string
	Name       string
	Email      string
	JTI        string
	IssuedAt   time.Time
	ExpiresAt  time.Time
}

// internalClaims 是 jwt 库 marshal 的结构，custom 字段平铺到 JSON 顶层 + RegisteredClaims。
// 字段名严格对齐 oddfi-admin-backend/internal/pkg/jwt/jwt.go internalClaims。
type internalClaims struct {
	Role   string `json:"role"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Avatar string `json:"avatar"`
	gojwt.RegisteredClaims
}

// ErrInvalidToken 表示 JWT 验签 / 解析失败 / claims 异常。
type ErrInvalidToken struct{ Reason string }

func (e *ErrInvalidToken) Error() string { return "admin jwt invalid: " + e.Reason }

// Parse 验签 + 解析 admin-backend 签发的 HS256 JWT。
//
// 校验项：
//   - alg 必须是 HS256（防 alg=none 攻击）
//   - issuer 必须是 "oddfi-admin"
//   - exp 必须未过期（gojwt.ParseWithClaims 自动校验）
//   - sub 必须以 "lark:" 前缀开头（admin-backend 历史约定）
//
// 不做 JWT 黑名单（admin Redis）查询 — 这是有意 trade-off（ADR-0002 Debt-2）。
func Parse(token, secret string) (*Claims, error) {
	if token == "" {
		return nil, &ErrInvalidToken{Reason: "empty token"}
	}
	if len(secret) < 32 {
		return nil, &ErrInvalidToken{Reason: "secret too short (< 32 bytes)"}
	}

	var raw internalClaims
	parsed, err := gojwt.ParseWithClaims(token, &raw, func(t *gojwt.Token) (any, error) {
		if _, ok := t.Method.(*gojwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	},
		gojwt.WithIssuer(Issuer),
		gojwt.WithValidMethods([]string{"HS256"}),
	)
	if err != nil {
		return nil, &ErrInvalidToken{Reason: err.Error()}
	}
	if !parsed.Valid {
		return nil, &ErrInvalidToken{Reason: "parser reported invalid"}
	}

	larkUserID := strings.TrimPrefix(raw.Subject, SubjectPrefix)
	if larkUserID == raw.Subject {
		// 没去掉 prefix 说明 sub 不带 "lark:" — 不符合 admin-backend 约定
		return nil, &ErrInvalidToken{Reason: "sub missing 'lark:' prefix"}
	}
	if larkUserID == "" {
		return nil, &ErrInvalidToken{Reason: "sub empty after prefix strip"}
	}

	claims := &Claims{
		LarkUserID: larkUserID,
		Role:       raw.Role,
		Name:       raw.Name,
		Email:      raw.Email,
	}
	if raw.ID != "" {
		claims.JTI = raw.ID
	}
	if raw.IssuedAt != nil {
		claims.IssuedAt = raw.IssuedAt.Time
	}
	if raw.ExpiresAt != nil {
		claims.ExpiresAt = raw.ExpiresAt.Time
	}
	return claims, nil
}
