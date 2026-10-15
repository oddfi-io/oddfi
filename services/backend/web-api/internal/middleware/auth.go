package middleware

import (
	"context"
	"strconv"
	"strings"

	"everything_finance/org/web-api/internal/pkg/jwt"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/pkg/response"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"

	"github.com/gin-gonic/gin"
)

type AuthMiddleware struct {
	jwtMgr      *jwt.JWTManager
	tokenRepo   repository.TokenRepo
	// referralSvc 用于首次登录时自动生成邀请码（非阻断 hook）
	// nil 时跳过 hook（向后兼容旧装配方式，确保测试/老路由不受影响）
	referralSvc service.ReferralService
}

func NewAuthMiddleware(jwtMgr *jwt.JWTManager, tokenRepo repository.TokenRepo) *AuthMiddleware {
	return &AuthMiddleware{
		jwtMgr:    jwtMgr,
		tokenRepo: tokenRepo,
	}
}

// WithReferralService 注入邀请服务，启用首次登录自动生成邀请码 hook
// 采用 option 方法而非修改构造函数签名，避免破坏已有调用方
func (m *AuthMiddleware) WithReferralService(svc service.ReferralService) *AuthMiddleware {
	m.referralSvc = svc
	return m
}

func (m *AuthMiddleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "missing authorization header")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			response.Unauthorized(c, "invalid authorization header format")
			c.Abort()
			return
		}

		token := parts[1]

		claims, err := m.jwtMgr.ValidateToken(token)
		if err != nil {
			if err == jwt.ErrExpiredToken {
				response.TokenExpired(c)
			} else {
				response.TokenInvalid(c)
			}
			c.Abort()
			return
		}

		if claims == nil {
			c.Abort()
			return
		}

		revoked, err := m.tokenRepo.IsAccessTokenRevoked(c.Request.Context(), claims.TokenID)
		if err != nil {
			response.InternalError(c, "failed to check token status")
			c.Abort()
			return
		}

		// 已经退出登录了
		if revoked {
			response.TokenInvalid(c)
			c.Abort()
			return
		}

		userID, err := strconv.ParseUint(claims.UserID, 10, 64)
		if err != nil {
			response.InternalError(c, "failed to conv user_id")
			c.Abort()
			return
		}

		if userID == 0 {
			response.InternalError(c, "no user_id is zero")
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Set("address", claims.Address)
		c.Set("token_id", claims.TokenID)

		// 首次登录 hook：异步触发邀请码生成（INSERT IGNORE 幂等）
		// 异步原因：DB 抖动不应拖慢鉴权中间件响应；失败仅记 warn，不阻断登录主链路
		// referralSvc 为 nil 时（旧装配/测试环境）跳过，向后兼容
		if m.referralSvc != nil {
			eoa := claims.Address
			go func() {
				if err := m.referralSvc.GenerateCodeForUser(context.Background(), userID, eoa); err != nil {
					logger.Warnf("[AuthMiddleware] generate referral code failed — user_id=%d err=%v", userID, err)
				}
			}()
		}

		c.Next()
	}
}
