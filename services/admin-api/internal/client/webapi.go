// Package client 封装 admin-backend 到 web-api internal endpoint 的 HTTP 调用。
//
// 设计要点（DD-003 v3.1 §4.2.1 + §4.2.2）：
//   - HMAC-SHA256 签名：payload = ts ":" path ":" idempotencyKey ":" hex(sha256(body))
//   - sig = hex(HMAC-SHA256(secret, payload))
//   - 与 web-api/internal/middleware/service_auth.go ComputeServiceSig 字节级对齐
//   - 超时 5s（context-based），重试 3 次（指数退避 100/200/400ms），仅 5xx + 网络错误重试
//   - idempotency_key 透传：从调用方传入，不在 client 层生成（DD-003 §3.3 M5）
//   - JWT 透传：以 X-Admin-JWT header 发往 web-api
package client

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"
)

// WebapiConfig 是 web-api HTTP client 的配置。
type WebapiConfig struct {
	// InternalURL 是 web-api 内部监听地址（例如 http://127.0.0.1:8081）。
	InternalURL string
	// ServiceToken 是 HMAC-SHA256 签名 secret（与 web-api 共享，env 注入）。
	ServiceToken string
	// TimeoutSec 是单次请求超时（秒），默认 5。
	TimeoutSec int
	// MaxRetries 是最大重试次数，默认 3（仅 5xx + 网络错误）。
	MaxRetries int
}

// Client 封装对 web-api internal endpoint 的 HTTP 调用。
type Client struct {
	cfg        WebapiConfig
	httpClient *http.Client
	// now 用于注入时钟，测试时替换。
	now func() time.Time
}

// New 构造 Client。
func New(cfg WebapiConfig) *Client {
	timeout := cfg.TimeoutSec
	if timeout <= 0 {
		timeout = 5
	}
	if cfg.MaxRetries <= 0 {
		cfg.MaxRetries = 3
	}
	return &Client{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: time.Duration(timeout) * time.Second},
		now:        time.Now,
	}
}

// ─── 公开 HTTP 方法 ──────────────────────────────────────────────────────────

// Get 发起 GET 请求，自动注入鉴权 header，将 data 部分反序列化到 out。
func (c *Client) Get(ctx context.Context, path, adminJWT, idempotencyKey string, out any) error {
	return c.do(ctx, http.MethodGet, path, adminJWT, idempotencyKey, nil, out)
}

// Post 发起 POST 请求，body 序列化为 JSON。
func (c *Client) Post(ctx context.Context, path, adminJWT, idempotencyKey string, body, out any) error {
	return c.do(ctx, http.MethodPost, path, adminJWT, idempotencyKey, body, out)
}

// Put 发起 PUT 请求，body 序列化为 JSON。
func (c *Client) Put(ctx context.Context, path, adminJWT, idempotencyKey string, body, out any) error {
	return c.do(ctx, http.MethodPut, path, adminJWT, idempotencyKey, body, out)
}

// Patch 发起 PATCH 请求，body 序列化为 JSON。
func (c *Client) Patch(ctx context.Context, path, adminJWT, idempotencyKey string, body, out any) error {
	return c.do(ctx, http.MethodPatch, path, adminJWT, idempotencyKey, body, out)
}

// Delete 发起 DELETE 请求。
func (c *Client) Delete(ctx context.Context, path, adminJWT, idempotencyKey string, out any) error {
	return c.do(ctx, http.MethodDelete, path, adminJWT, idempotencyKey, nil, out)
}

// ─── 核心执行逻辑 ────────────────────────────────────────────────────────────

// do 执行带重试的 HTTP 请求：
//  1. 序列化 body
//  2. 计算 HMAC 签名
//  3. 注入所有必要 header
//  4. 重试（最多 MaxRetries 次，仅 5xx + 网络错误）
//  5. 反序列化 ApiResponse.Data 到 out
func (c *Client) do(ctx context.Context, method, path, adminJWT, idempotencyKey string, reqBody, out any) error {
	// 序列化请求体
	var bodyBytes []byte
	if reqBody != nil {
		var err error
		bodyBytes, err = json.Marshal(reqBody)
		if err != nil {
			return fmt.Errorf("[WebapiClient] marshal request body: %w", err)
		}
	}

	url := c.cfg.InternalURL + path

	// 重试循环：指数退避 100ms / 200ms / 400ms
	// doOnce 返回三种情况：
	//   (nil, nil)       → 成功，返回
	//   (nil, fatalErr)  → 网络/序列化/4xx 不可重试错误，直接返回
	//   (retryErr, nil)  → 5xx 可重试错误，继续重试
	var lastErr error
	backoff := 100 * time.Millisecond
	for attempt := 0; attempt < c.cfg.MaxRetries; attempt++ {
		if attempt > 0 {
			// 等待退避后重试；若 ctx 已取消则提前退出
			select {
			case <-ctx.Done():
				return fmt.Errorf("[WebapiClient] context canceled before retry: %w", ctx.Err())
			case <-time.After(backoff):
			}
			backoff *= 2
		}

		retryErr, fatalErr := c.doOnce(ctx, method, url, path, adminJWT, idempotencyKey, bodyBytes, out)
		if fatalErr != nil {
			// 网络错误、序列化错误、4xx — 不重试
			return fatalErr
		}
		if retryErr == nil {
			// 成功
			return nil
		}
		// retryErr != nil：5xx 可重试
		lastErr = retryErr
		log.Warn().
			Str("module", "webapi_client").
			Str("method", method).
			Str("path", path).
			Int("attempt", attempt+1).
			Err(retryErr).
			Msg("[WebapiClient] 5xx response, will retry")
	}
	return fmt.Errorf("[WebapiClient] all %d attempts failed: %w", c.cfg.MaxRetries, lastErr)
}

// doOnce 执行单次 HTTP 请求。
// 返回值约定：
//   - (nil, nil)：成功
//   - (nil, fatalErr)：网络/序列化错误 或 4xx（不可重试）
//   - (retryErr, nil)：5xx（可重试）
func (c *Client) doOnce(ctx context.Context, method, url, path, adminJWT, idempotencyKey string, bodyBytes []byte, out any) (retryableErr, fatalErr error) {
	tsMs := strconv.FormatInt(c.now().UnixMilli(), 10)
	sig := ComputeServiceSig(c.cfg.ServiceToken, tsMs, path, idempotencyKey, bodyBytes)

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("[WebapiClient] build request: %w", err)
	}

	// 注入必要 header（DD-003 §4.2.1 + §4.2.2）
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Timestamp", tsMs)
	req.Header.Set("X-Service-Sig", sig)
	req.Header.Set("X-Idempotency-Key", idempotencyKey)
	if adminJWT != "" {
		req.Header.Set("X-Admin-JWT", adminJWT)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// 网络错误：可重试
		return nil, fmt.Errorf("[WebapiClient] http do: %w", err)
	}
	defer func() {
		// 必须读尽并关闭 body，避免 keep-alive 连接泄漏
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()

	respBodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("[WebapiClient] read response body: %w", err)
	}

	// 5xx → 可重试（返回 retryErr，由 do() 决定是否继续重试）
	if resp.StatusCode >= 500 {
		return &HTTPError{StatusCode: resp.StatusCode, Body: string(respBodyBytes)}, nil
	}

	// 4xx → 不可重试，作为 fatalErr 直接返回调用方（绕过重试）
	if resp.StatusCode >= 400 {
		return nil, &HTTPError{StatusCode: resp.StatusCode, Body: string(respBodyBytes)}
	}

	// 2xx：反序列化 ApiResponse，提取 data 字段
	if out != nil {
		// 先解析外层
		var wrapper struct {
			Code    any             `json:"code"`
			Message string          `json:"message"`
			Data    json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(respBodyBytes, &wrapper); err != nil {
			return nil, fmt.Errorf("[WebapiClient] unmarshal response: %w", err)
		}
		// code 非 0 视为业务错误（不重试）
		if !isSuccessCode(wrapper.Code) {
			return nil, &BusinessError{Code: wrapper.Code, Message: wrapper.Message}
		}
		if wrapper.Data != nil {
			if err := json.Unmarshal(wrapper.Data, out); err != nil {
				return nil, fmt.Errorf("[WebapiClient] unmarshal response data: %w", err)
			}
		}
	}
	return nil, nil
}

// ─── HMAC 签名（与 web-api ComputeServiceSig 字节级对齐）──────────────────────

// ComputeServiceSig 计算 X-Service-Sig header 值。
//
// 算法（DD-003 §4.2.1，与 web-api/internal/middleware/service_auth.go 完全一致）：
//
//	bodyHash = sha256(body)
//	payload  = tsMs + ":" + path + ":" + idempotencyKey + ":" + hex(bodyHash)
//	sig      = hex(HMAC-SHA256(secret, payload))
//
// 暴露为包级函数方便 contract test 直接 import 调用。
func ComputeServiceSig(secret, tsMs, path, idempotencyKey string, body []byte) string {
	bodyHash := sha256.Sum256(body)
	payload := tsMs + ":" + path + ":" + idempotencyKey + ":" + hex.EncodeToString(bodyHash[:])
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

// ─── 错误类型 ────────────────────────────────────────────────────────────────

// HTTPError 表示 web-api 返回了非 2xx 的 HTTP 状态。
type HTTPError struct {
	StatusCode int
	Body       string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("webapi returned HTTP %d: %s", e.StatusCode, e.Body)
}

// IsHTTPError 判断 err 是否为 HTTPError（含 errors.As 解包）并返回其指针。
func IsHTTPError(err error) (*HTTPError, bool) {
	var e *HTTPError
	if errors.As(err, &e) {
		return e, true
	}
	return nil, false
}

// BusinessError 表示 web-api 返回 2xx 但业务码非 0。
type BusinessError struct {
	Code    any
	Message string
}

func (e *BusinessError) Error() string {
	return fmt.Sprintf("webapi business error: code=%v message=%s", e.Code, e.Message)
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

// isRetryable 判断错误是否属于可重试的 5xx 错误。
func isRetryable(err error) bool {
	if httpErr, ok := err.(*HTTPError); ok {
		return httpErr.StatusCode >= 500
	}
	return false
}

// isSuccessCode 判断 code 字段是否为成功值（0 或 "0"）。
func isSuccessCode(code any) bool {
	switch v := code.(type) {
	case float64:
		return v == 0
	case int:
		return v == 0
	case string:
		return v == "0"
	case nil:
		return true
	}
	return false
}
