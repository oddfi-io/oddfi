package handler

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/repository"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/service"
)

// AuthHandler 聚合 Lark OAuth 登录闭环的 HTTP 入口。
type AuthHandler struct {
	cfg     *config.Config
	larkSvc service.LarkOAuthService
	jwtSvc  jwt.Service
	repo    repository.AdminUserRepository
}

// NewAuth 构造 AuthHandler。
func NewAuth(
	cfg *config.Config,
	larkSvc service.LarkOAuthService,
	jwtSvc jwt.Service,
	repo repository.AdminUserRepository,
) *AuthHandler {
	return &AuthHandler{cfg: cfg, larkSvc: larkSvc, jwtSvc: jwtSvc, repo: repo}
}

// LarkLogin GET /auth/lark/login → 302 跳 Lark 授权页。
func (h *AuthHandler) LarkLogin(c *gin.Context) {
	u, err := h.larkSvc.BuildAuthorizeURL(c.Request.Context())
	if err != nil {
		logger.L().Error().Err(err).Str("module", "auth_lark").Msg("build authorize url failed")
		response.Internal(c, errcode.InternalError, "build authorize url failed")
		return
	}
	c.Redirect(http.StatusFound, u)
}

// LarkCallback GET /auth/lark/callback?code=&state= → 302 回前端附带 JWT。
func (h *AuthHandler) LarkCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		response.BadRequest(c, errcode.InvalidParam, "code or state missing")
		return
	}
	sess, err := h.larkSvc.HandleCallback(c.Request.Context(), code, state)
	if err != nil {
		h.respondCallbackError(c, err)
		return
	}

	// 成功日志只记 lark_user_id / role / jti，禁止记 token 和 code
	logger.L().Info().
		Str("module", "auth_lark").
		Str("lark_user_id", sess.Admin.LarkUserID).
		Str("role", sess.Admin.Role.String()).
		Str("jti", sess.JTI).
		Msg("admin login success")

	// 拼接前端回调 URL。
	// 关键：**token 必须放 fragment（#token=）而非 query（?token=）**。
	// fragment 不会被浏览器塞进 Referer 头、Nginx access_log、浏览器历史 URL，
	// 极大降低 JWT 二次泄漏面（C-Sec-1 缓解）。
	// 前端：window.location.hash → 解析 "token=..."，立刻 history.replaceState 抹掉 hash。
	parsed, err := url.Parse(h.cfg.Frontend.CallbackURL)
	if err != nil {
		response.Internal(c, errcode.InternalError, "bad frontend callback url")
		return
	}
	// JWT 字符集（base64url + ".") 在 fragment 中无需转义；显式赋值 Fragment
	// 字段，url.URL.String() 会按 RFC 3986 自动处理需要转义的字符。
	parsed.Fragment = "token=" + sess.JWT
	c.Redirect(http.StatusFound, parsed.String())
}

// respondCallbackError 把 service 层业务错误翻译成 HTTP 响应。
// 用户可见 message 走 curated 文案，原始 error 细节进 zerolog（不外抛）。
func (h *AuthHandler) respondCallbackError(c *gin.Context, err error) {
	// ctx 取消：客户端断开 / 超时。返回 503 并不算 5xx 告警。
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		logger.L().Warn().Err(err).Str("module", "auth_lark").Msg("callback canceled")
		response.Error(c, http.StatusServiceUnavailable, errcode.InternalError, "request canceled")
		return
	}
	if e := service.AsError(err); e != nil {
		logger.L().Info().Err(err).Str("module", "auth_lark").Str("code", e.Code).Msg("callback failed")
		switch e.Code {
		case errcode.LarkStateMismatch:
			response.BadRequest(c, e.Code, "state mismatch or expired")
		case errcode.NotAdmin:
			response.Forbidden(c, e.Code, "not in admin whitelist")
		case errcode.LarkExchangeFailed, errcode.LarkUserInfoFailed:
			// 502：上游（Lark）失败。不外抛 e.Message，避免泄漏内部细节
			response.Error(c, http.StatusBadGateway, e.Code, "upstream auth failed")
		case errcode.InvalidParam:
			response.BadRequest(c, e.Code, "invalid parameter")
		default:
			response.Internal(c, errcode.InternalError, "internal error")
		}
		return
	}
	logger.L().Error().Err(err).Str("module", "auth_lark").Msg("callback unexpected error")
	response.Internal(c, errcode.InternalError, "internal error")
}

// Me GET /auth/me（需登录）返回当前管理员资料。
// 兜底查 DB 是为了防止 admin 在 admin_users 表已删但 JWT 还未过期的边界场景。
func (h *AuthHandler) Me(c *gin.Context) {
	adminUserID := c.GetString(middleware.CtxAdminUserID)
	admin, err := h.repo.FindByLarkUserID(c.Request.Context(), adminUserID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 不暴露 NOT_ADMIN 错误码，避免给攻击者 oracle
			response.Unauthorized(c, errcode.Unauthorized, "admin not found")
			return
		}
		logger.L().Error().Err(err).Str("module", "auth_lark").Msg("me lookup failed")
		response.Internal(c, errcode.InternalError, "internal error")
		return
	}
	response.OK(c, gin.H{
		"user_id": admin.LarkUserID,
		"name":    admin.LarkName,
		"email":   admin.LarkEmail,
		"avatar":  admin.LarkAvatar,
		"role":    admin.Role,
	})
}

// Logout POST /auth/logout（需登录）把当前 jti 拉黑直到 exp。
func (h *AuthHandler) Logout(c *gin.Context) {
	jti := c.GetString(middleware.CtxJTI)
	expVal, ok := c.Get(middleware.CtxExp)
	if jti == "" || !ok {
		response.Unauthorized(c, errcode.Unauthorized, "missing jti or exp")
		return
	}
	exp, ok := expVal.(time.Time)
	if !ok {
		response.Unauthorized(c, errcode.Unauthorized, "bad exp type")
		return
	}
	if err := h.jwtSvc.Revoke(c.Request.Context(), jti, exp); err != nil {
		logger.L().Error().Err(err).Str("module", "auth_lark").Str("jti", jti).Msg("revoke failed")
		response.Internal(c, errcode.InternalError, "internal error")
		return
	}
	logger.L().Info().Str("module", "auth_lark").Str("jti", jti).Msg("admin logout")
	response.OK(c, gin.H{"revoked": true})
}
