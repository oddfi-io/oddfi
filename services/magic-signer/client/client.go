package client

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is the HTTP SDK for magic-signer. Thread-safe; reuse per process.
type Client struct {
	cfg Config
}

// New constructs a Client. Validates config; returns ErrInvalidConfig on failure.
func New(cfg Config) (*Client, error) {
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfig, err)
	}
	cfg.applyDefaults()
	return &Client{cfg: cfg}, nil
}

// doRequest sends a request to the service with one retry on network errors.
// 4xx/5xx responses are returned as *ServiceError (no retry).
func (c *Client) doRequest(ctx context.Context, method, path string, reqBody interface{}, out interface{}) error {
	payload, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	url := c.cfg.BaseURL + path

	requestID := requestIDFromCtx(ctx)
	if requestID == "" {
		requestID = generateRequestID()
	}

	var lastNetErr error
	for attempt := 0; attempt <= c.cfg.MaxNetworkRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(100 * time.Millisecond):
			}
		}

		req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(payload))
		if err != nil {
			return fmt.Errorf("new request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Service-Auth", "Bearer "+c.cfg.AuthToken)
		req.Header.Set("X-Request-ID", requestID)
		req.Header.Set("User-Agent", c.cfg.UserAgent)

		resp, err := c.cfg.HTTPClient.Do(req)
		if err != nil {
			lastNetErr = err
			continue // retry on network error
		}

		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if out == nil {
				return nil
			}
			if err := json.Unmarshal(body, out); err != nil {
				return fmt.Errorf("decode response: %w", err)
			}
			return nil
		}

		// Non-2xx: parse ServiceError and return without retry.
		var svcErr struct {
			ErrorCode    string `json:"error_code"`
			ErrorMessage string `json:"error_message"`
			RequestID    string `json:"request_id"`
			Env          string `json:"env"`
		}
		_ = json.Unmarshal(body, &svcErr)
		return &ServiceError{
			HTTPStatus: resp.StatusCode,
			ErrorCode:  svcErr.ErrorCode,
			Message:    svcErr.ErrorMessage,
			RequestID:  svcErr.RequestID,
			Env:        svcErr.Env,
		}
	}

	return fmt.Errorf("%w: %v", ErrNetwork, lastNetErr)
}

// ─── request_id ctx helpers ───
// Callers may inject a trace_id into ctx via WithRequestID for correlation.

type requestIDCtxKey struct{}

// WithRequestID returns a new context carrying the given request id, which
// the client will include as X-Request-ID on the outbound request.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDCtxKey{}, id)
}

func requestIDFromCtx(ctx context.Context) string {
	if v, ok := ctx.Value(requestIDCtxKey{}).(string); ok {
		return v
	}
	return ""
}

func generateRequestID() string {
	var buf [10]byte
	_, _ = rand.Read(buf[:])
	return "req_" + hex.EncodeToString(buf[:])
}
