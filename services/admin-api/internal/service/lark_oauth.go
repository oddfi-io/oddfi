// Package service 包含业务编排层。
//
// 设计原则：
//   - service 不依赖 gin.Context，便于单测直接调用
//   - 业务错误用 service.Error 携带 errcode，handler 直接翻译
//   - HTTP client 独立实例 + 10s timeout，不复用 http.DefaultClient
package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	redispkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/redis"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/repository"
)

// Error 是 service 层业务错误，handler 用 errors.As 提取 code 走 response 包装。
type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

// AsError 把 err 翻成 *Error；非业务错误返回 nil。
func AsError(err error) *Error {
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	return nil
}

func newError(code, msg string) *Error { return &Error{Code: code, Message: msg} }

// LarkOAuthService 是 Lark OIDC 三步登录的业务接口。
type LarkOAuthService interface {
	// BuildAuthorizeURL 生成 state 写 Redis，返回 Lark 授权页 URL。
	BuildAuthorizeURL(ctx context.Context) (string, error)
	// HandleCallback 校验 state → 换 token → 拉 user_info → 白名单 → 签 JWT。
	HandleCallback(ctx context.Context, code, state string) (*AdminSession, error)
}

// AdminSession 是登录闭环的输出。
type AdminSession struct {
	Admin *model.AdminUser
	JWT   string
	JTI   string
	Exp   time.Time
}

type larkOAuth struct {
	cfg       config.LarkConfig
	rdb       *redis.Client
	adminRepo repository.AdminUserRepository
	jwtSvc    jwt.Service
	httpc     *http.Client
}

// NewLarkOAuth 构造默认实现。HTTP client 独占，timeout=10s。
func NewLarkOAuth(
	cfg config.LarkConfig,
	rdb *redis.Client,
	repo repository.AdminUserRepository,
	jwtSvc jwt.Service,
) LarkOAuthService {
	return &larkOAuth{
		cfg:       cfg,
		rdb:       rdb,
		adminRepo: repo,
		jwtSvc:    jwtSvc,
		httpc:     &http.Client{Timeout: 10 * time.Second},
	}
}

// generateState 用 crypto/rand 生成 32 字节随机 state。
// base64.RawURLEncoding 不含 +/=，可直接进 URL query。
func generateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *larkOAuth) BuildAuthorizeURL(ctx context.Context) (string, error) {
	state, err := generateState()
	if err != nil {
		return "", fmt.Errorf("gen state: %w", err)
	}
	// NX 防极端碰撞（state 重复时 Redis 拒绝覆盖，触发返回错误）
	ok, err := s.rdb.SetNX(ctx, redispkg.KeyLarkState+state, "1", 10*time.Minute).Result()
	if err != nil {
		return "", fmt.Errorf("redis setnx: %w", err)
	}
	if !ok {
		return "", errors.New("state collision (unexpected)")
	}

	u, err := url.Parse(s.cfg.AuthorizeURL)
	if err != nil {
		return "", fmt.Errorf("parse authorize url: %w", err)
	}
	q := u.Query()
	q.Set("app_id", s.cfg.AppID)
	q.Set("redirect_uri", s.cfg.RedirectURI)
	q.Set("scope", s.cfg.Scope)
	q.Set("state", state)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (s *larkOAuth) HandleCallback(ctx context.Context, code, state string) (*AdminSession, error) {
	// 1. 一次性消费 state（GETDEL 原子）
	if err := s.consumeState(ctx, state); err != nil {
		return nil, err
	}
	if code == "" {
		return nil, newError(errcode.InvalidParam, "code empty")
	}
	// 2. code → user_access_token
	tokenResp, err := s.exchangeCode(ctx, code)
	if err != nil {
		return nil, err
	}
	// 3. user_access_token → user_info
	info, err := s.fetchUserInfo(ctx, tokenResp.AccessToken)
	if err != nil {
		return nil, err
	}
	// 4. 白名单校验：v2 token 响应不含 open_id（OAuth 标准 token 字段），完全依赖 user_info 返回
	openID := info.Data.OpenID
	if openID == "" {
		return nil, newError(errcode.LarkUserInfoFailed, "lark user_info missing open_id")
	}
	admin, err := s.adminRepo.FindByLarkUserID(ctx, openID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 记录被拒用户的可识别信息，便于 super_admin 决定是否纳入白名单（含首次 bootstrap）
			// token / access_token 仍然绝不入日志
			logger.L().Warn().
				Str("module", "auth_lark").
				Str("lark_user_id", openID).
				Str("lark_name", info.Data.Name).
				Str("lark_email", info.Data.Email).
				Msg("login rejected: not in admin_users whitelist")
			return nil, newError(errcode.NotAdmin, "lark user not in admin_users whitelist")
		}
		return nil, fmt.Errorf("find admin: %w", err)
	}
	// 5. 签 JWT
	tokenStr, jti, exp, err := s.jwtSvc.Sign(ctx, admin)
	if err != nil {
		return nil, fmt.Errorf("sign jwt: %w", err)
	}
	return &AdminSession{Admin: admin, JWT: tokenStr, JTI: jti, Exp: exp}, nil
}

// consumeState 原子读+删 state。
// 未命中（包括重放、过期）统一返回 LarkStateMismatch；
// Redis 自身错误透传上层（handler 翻译成 500 + 内部告警）。
func (s *larkOAuth) consumeState(ctx context.Context, state string) error {
	if state == "" {
		return newError(errcode.LarkStateMismatch, "state empty")
	}
	_, err := s.rdb.GetDel(ctx, redispkg.KeyLarkState+state).Result()
	if errors.Is(err, redis.Nil) {
		return newError(errcode.LarkStateMismatch, "state not found or expired")
	}
	if err != nil {
		return fmt.Errorf("redis getdel state: %w", err)
	}
	return nil
}

// larkTokenResp 兼容 Lark v2 OAuth token endpoint 响应。
// v2 响应是 OAuth 标准平铺字段（access_token 顶层），失败时附 error / error_description；
// 兼容老 v1 OIDC（{code, msg, data:{access_token}}）已弃用，本结构不再 fallback。
type larkTokenResp struct {
	// Code: Lark v2 wire format 是 int（文档渲染成字符串误导）。仅用于失败日志透传，
	// 不作为成功判定依据（access_token 非空才是真正的成功信号）。
	Code             int    `json:"code"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
	AccessToken      string `json:"access_token"`
	ExpiresIn        int    `json:"expires_in"`
	TokenType        string `json:"token_type"`
	Scope            string `json:"scope"`
	RefreshToken     string `json:"refresh_token,omitempty"`
}

// exchangeCode POST Lark v2 token 端点（/authen/v2/oauth/token）。
// 不 retry：code 是一次性凭证，重试可能触发 Lark 标记 code 已消费导致后续失败。
//
// v2 与 v1 差异（迁移背景）：
//   - URL: /authen/v1/oidc/access_token → /authen/v2/oauth/token
//   - 字段名: app_id/app_secret → client_id/client_secret（OAuth 标准）
//   - 新增必填: redirect_uri（必须与授权请求一致，作为 client authentication 强校验）
//   - 响应: code/msg/data 嵌套 → 平铺；失败用 OAuth 标准 error/error_description
func (s *larkOAuth) exchangeCode(ctx context.Context, code string) (*larkTokenResp, error) {
	body, _ := json.Marshal(map[string]string{
		"grant_type":    "authorization_code",
		"code":          code,
		"client_id":     s.cfg.AppID,
		"client_secret": s.cfg.AppSecret,
		"redirect_uri":  s.cfg.RedirectURI,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.TokenURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("new req: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := s.httpc.Do(req)
	if err != nil {
		return nil, newError(errcode.LarkExchangeFailed, "lark token http: "+err.Error())
	}
	defer drainAndClose(resp.Body)

	// 一次性读+尽力解码：v2 失败响应也带 JSON body（含 error_description），所以无论 status 都先尝试解码。
	// 后续 status / access_token 校验用解码结果，单条决策路径，比拆"先 status 再 decode"更易读。
	var out larkTokenResp
	raw, _ := io.ReadAll(resp.Body)
	_ = json.Unmarshal(raw, &out) // 解码失败时 out 保留零值，由下方 access_token 校验兜底

	if resp.StatusCode != http.StatusOK {
		return nil, newError(errcode.LarkExchangeFailed,
			fmt.Sprintf("lark token status=%d code=%d error=%q description=%q",
				resp.StatusCode, out.Code, out.Error, out.ErrorDescription))
	}
	if out.AccessToken == "" {
		return nil, newError(errcode.LarkExchangeFailed,
			fmt.Sprintf("lark token empty access_token code=%d error=%q", out.Code, out.Error))
	}
	return &out, nil
}

type larkUserInfoResp struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Name      string `json:"name"`
		EnName    string `json:"en_name"`
		AvatarURL string `json:"avatar_url"`
		Email     string `json:"email"`
		OpenID    string `json:"open_id"`
		UnionID   string `json:"union_id"`
	} `json:"data"`
}

func (s *larkOAuth) fetchUserInfo(ctx context.Context, userAccessToken string) (*larkUserInfoResp, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.cfg.UserInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("new req: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+userAccessToken)
	resp, err := s.httpc.Do(req)
	if err != nil {
		return nil, newError(errcode.LarkUserInfoFailed, "user_info http: "+err.Error())
	}
	defer drainAndClose(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, newError(errcode.LarkUserInfoFailed, fmt.Sprintf("user_info status %d", resp.StatusCode))
	}
	var out larkUserInfoResp
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, newError(errcode.LarkUserInfoFailed, "user_info decode: "+err.Error())
	}
	if out.Code != 0 {
		return nil, newError(errcode.LarkUserInfoFailed, fmt.Sprintf("user_info code=%d msg=%s", out.Code, out.Msg))
	}
	return &out, nil
}

// drainAndClose 在关闭前耗尽 body，让底层 TCP 连接能被 keep-alive 池复用，
// 否则未读完的 body 会触发 Transport 丢弃连接，下次请求被迫重新握手。
func drainAndClose(body io.ReadCloser) {
	_, _ = io.Copy(io.Discard, body)
	_ = body.Close()
}
