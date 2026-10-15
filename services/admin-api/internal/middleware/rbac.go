package middleware

import (
	"fmt"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// RoleRequired 路由级 RBAC。
//
// **必须**挂在 AdminAuthMiddleware 之后（依赖 ctx 中的 role）。
//
// 设计取舍：super_admin **不自动通行**。想让 super_admin 访问就把它显式加进 allow。
// 这样避免"忘记加 super_admin 后改 middleware 默认行为导致越权"的隐式风险。
func RoleRequired(allow ...string) gin.HandlerFunc {
	// 路由注册期一次性构造，请求期 O(1) 查表
	allowSet := make(map[string]struct{}, len(allow))
	for _, r := range allow {
		allowSet[r] = struct{}{}
	}
	return func(c *gin.Context) {
		v, exists := c.Get(CtxRole)
		if !exists {
			response.Forbidden(c, errcode.InsufficientRole, "role not in context")
			c.Abort()
			return
		}
		roleStr, _ := v.(string)
		if _, ok := allowSet[roleStr]; !ok {
			response.Forbidden(c, errcode.InsufficientRole,
				fmt.Sprintf("role %s not allowed", roleStr))
			c.Abort()
			return
		}
		c.Next()
	}
}
