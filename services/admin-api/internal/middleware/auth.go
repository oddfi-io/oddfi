// Package middleware 包含 Gin 中间件：鉴权、RBAC、CORS、限流、RequestID。
package middleware

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// Context key 常量，统一约定避免散落字符串。
const (
	CtxAdminUserID = "admin_user_id"
	CtxRole        = "role"
	CtxName        = "name"
	CtxEmail       = "email"
	CtxJTI         = "jti"
	CtxExp         = "exp"
)

// AdminAuthMiddleware 解析 Authorization: Bearer <jwt>，注入 claims 到 ctx。
//
// 错误映射：
//   - 缺 header / 错前缀 / 空 token → 401 UNAUTHORIZED
//   - 过期 → 401 TOKEN_EXPIRED
//   - 已 Revoke → 401 UNAUTHORIZED（不暴露黑名单存在性，避免给攻击者 oracle）
//   - 签名/格式错 → 401 TOKEN_INVALID
//
// **不查 DB**：admin 是否还存在由 /auth/me handler 兜底，
// 避免每次请求多一次 SELECT 拖慢热路径。
func AdminAuthMiddleware(jwtSvc jwt.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := stripBearer(c.GetHeader("Authorization"))
		if token == "" {
			response.Unauthorized(c, errcode.Unauthorized, "missing bearer token")
			c.Abort()
			return
		}
		claims, err := jwtSvc.Parse(c.Request.Context(), token)
		if err != nil {
			// errors.Is：将来 jwt.Parse 改成 fmt.Errorf("...%w", sentinel) 包装时仍能命中
			switch {
			case errors.Is(err, jwt.ErrTokenExpired):
				response.Unauthorized(c, errcode.TokenExpired, "jwt expired")
			case errors.Is(err, jwt.ErrTokenBlacklisted):
				// 不暴露 BLACKLISTED 错误码，用通用 UNAUTHORIZED
				response.Unauthorized(c, errcode.Unauthorized, "session revoked")
			default:
				response.Unauthorized(c, errcode.TokenInvalid, "invalid token")
			}
			c.Abort()
			return
		}
		c.Set(CtxAdminUserID, claims.UserID)
		c.Set(CtxRole, claims.Role)
		c.Set(CtxName, claims.Name)
		c.Set(CtxEmail, claims.Email)
		c.Set(CtxJTI, claims.JTI)
		c.Set(CtxExp, claims.Exp)
		c.Next()
	}
}

// stripBearer 容错解析 Bearer header。
//   - 前后空格剥掉
//   - 前缀 "Bearer " 大小写不敏感
//   - 缺前缀 / 空 token → 返回 ""
func stripBearer(h string) string {
	h = strings.TrimSpace(h)
	if len(h) < 7 {
		return ""
	}
	if !strings.EqualFold(h[:7], "Bearer ") {
		return ""
	}
	return strings.TrimSpace(h[7:])
}
