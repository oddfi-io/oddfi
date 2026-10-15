// Package middleware — admin internal endpoint 的 JWT 鉴权（共享 HS256 secret）。
//
// 设计要点（DD-003 v3.1 §4.2.2 + C3 重写）：
//
//   - admin-backend 自签 HS256 JWT 给前端；admin-backend → web-api 转发时透传 token
//   - web-api 通过 ADMIN_JWT_SECRET 共享 secret 直接验签（不调 admin-backend /auth/me）
//   - 解 claims 拿 verified operator（lark_user_id + role），audit middleware 用这些字段
//
// header 约定：
//
//	X-Admin-JWT: <Bearer prefix optional> <token>
//
// 不查 JWT 黑名单（ADR-0002 Debt-2），TGE 前用 admin-backend JWT TTL ≤ 2h 缓解。
package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"everything_finance/org/web-api/internal/pkg/adminjwt"
)

const (
	// CtxAdminOperatorID 是 verified operator (lark_user_id) 在 ctx 的 key。
	CtxAdminOperatorID = "admin_operator_id"
	// CtxAdminOperatorRole 是 operator role 在 ctx 的 key。
	CtxAdminOperatorRole = "admin_operator_role"
	// CtxAdminJTI 是 JWT jti 在 ctx 的 key（audit 字段；未来黑名单可用）。
	CtxAdminJTI = "admin_jti"
)

// AdminJWTConfig 是 admin JWT middleware 配置。
type AdminJWTConfig struct {
	// Secret 与 admin-backend `jwt.secret` 共享，HS256 secret，必须 ≥ 32 字节。
	Secret string
	// Now 单测注入；nil 时用 time.Now。
	Now func() time.Time
}

// AdminJWT 返回验签 admin-backend HS256 JWT 的 gin middleware。
//
// 校验项（adminjwt.Parse 已做）：
//   - HS256 only（防 alg confusion）
//   - issuer = "oddfi-admin"
//   - exp 未过期
//   - sub 必含 "lark:" 前缀
//
// 失败统一 401，message 简短防 fingerprint。
func AdminJWT(cfg AdminJWTConfig) gin.HandlerFunc {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return func(c *gin.Context) {
		raw := c.GetHeader("X-Admin-JWT")
		if raw == "" {
			abortAdminJWT(c, "ADMIN_JWT_REQUIRED")
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(raw, "Bearer "))
		if token == "" {
			abortAdminJWT(c, "ADMIN_JWT_REQUIRED")
			return
		}

		claims, err := adminjwt.Parse(token, cfg.Secret)
		if err != nil {
			abortAdminJWT(c, "ADMIN_JWT_INVALID")
			return
		}

		// 二次校验 exp（adminjwt.Parse 已校但保留一道防御，避免单测 mock 时漏）
		if !claims.ExpiresAt.IsZero() && cfg.Now().After(claims.ExpiresAt) {
			abortAdminJWT(c, "ADMIN_JWT_EXPIRED")
			return
		}

		c.Set(CtxAdminOperatorID, claims.LarkUserID)
		c.Set(CtxAdminOperatorRole, claims.Role)
		c.Set(CtxAdminJTI, claims.JTI)
		c.Next()
	}
}

func abortAdminJWT(c *gin.Context, code string) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"code":    code,
		"message": "admin jwt invalid or expired",
	})
}
