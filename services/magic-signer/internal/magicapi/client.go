package magicapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strconv"
	"time"
)

// ClientConfig is everything the Magic API client needs.
type ClientConfig struct {
	APIKey         string
	OIDCProviderID string
	Referrer       string
	Chain          string
	Endpoint       string // e.g. "https://tee.express.magiclabs.com"
	Timeout        time.Duration
	MaxRetries     int
	RetryBaseDelay time.Duration
	HTTPClient     *http.Client // optional; default constructed if nil
}

// Client is an HTTP client for Magic TEE Express.
//
// Thread-safe; reuse one instance per process.
type Client struct {
	apiKey         string
	oidcProviderID string
	referrer       string
	chain          string
	endpoint       string
	maxRetries     int
	retryBaseDelay time.Duration
	http           *http.Client
}

// New constructs a Magic API client.
func New(cfg ClientConfig) *Client {
	http := cfg.HTTPClient
	if http == nil {
		http = newDefaultHTTPClient(cfg.Timeout)
	}
	return &Client{
		apiKey:         cfg.APIKey,
		oidcProviderID: cfg.OIDCProviderID,
		referrer:       cfg.Referrer,
		chain:          cfg.Chain,
		endpoint:       cfg.Endpoint,
		maxRetries:     cfg.MaxRetries,
		retryBaseDelay: cfg.RetryBaseDelay,
		http:           http,
	}
}

func newDefaultHTTPClient(timeout time.Duration) *http.Client {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}
}

// CallResult holds the response payload + observability metadata.
type CallResult struct {
	Body            []byte
	StatusCode      int
	UpstreamLatency time.Duration
}

// doRequest sends a request to Magic with retry on 5xx/429/network errors.
// 4xx (non-429) returns immediately with *HTTPError.
//
// jwtToken: JWT to put in Authorization header
// method:   "POST" / "GET" etc.
// path:     "/v1/wallet" or "/v1/wallet/sign/data"
// body:     marshaled to JSON
func (c *Client) doRequest(ctx context.Context, jwtToken, method, path string, body interface{}) (*CallResult, error) {
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	url := c.endpoint + path

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff with ±25% jitter.
			delay := c.retryBaseDelay * (1 << (attempt - 1))
			jitter := time.Duration(rand.Int63n(int64(delay) / 2))
			if rand.Intn(2) == 0 {
				delay -= jitter
			} else {
				delay += jitter
			}
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}

		req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(bodyBytes))
		if err != nil {
			return nil, fmt.Errorf("new request: %w", err)
		}
		for k, vs := range c.buildHeaders(jwtToken) {
			for _, v := range vs {
				req.Header.Add(k, v)
			}
		}

		start := time.Now()
		resp, err := c.http.Do(req)
		latency := time.Since(start)

		if err != nil {
			lastErr = fmt.Errorf("http: %w", err)
			if isCtxErr(ctx) {
				return nil, ctx.Err()
			}
			continue // retry on network error
		}

		respBody, readErr := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MB cap
		resp.Body.Close()
		if readErr != nil {
			lastErr = fmt.Errorf("read body: %w", readErr)
			continue
		}

		switch {
		case resp.StatusCode >= 200 && resp.StatusCode < 300:
			return &CallResult{Body: respBody, StatusCode: resp.StatusCode, UpstreamLatency: latency}, nil
		case resp.StatusCode == 429:
			// Honor Retry-After if present.
			if ra := resp.Header.Get("Retry-After"); ra != "" {
				if secs, err := strconv.Atoi(ra); err == nil {
					select {
					case <-ctx.Done():
						return nil, ctx.Err()
					case <-time.After(time.Duration(secs) * time.Second):
					}
				}
			}
			lastErr = &HTTPError{StatusCode: 429, Body: truncate(string(respBody), 1024), URL: url}
			continue
		case resp.StatusCode >= 500:
			lastErr = &HTTPError{StatusCode: resp.StatusCode, Body: truncate(string(respBody), 1024), URL: url}
			continue
		default:
			// 4xx (non-429): don't retry.
			return nil, &HTTPError{StatusCode: resp.StatusCode, Body: truncate(string(respBody), 1024), URL: url}
		}
	}

	// All retries exhausted.
	if httpErr, ok := lastErr.(*HTTPError); ok {
		return nil, httpErr
	}
	return nil, fmt.Errorf("%w: %v", ErrNetwork, lastErr)
}

func isCtxErr(ctx context.Context) bool {
	select {
	case <-ctx.Done():
		return true
	default:
		return false
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "...(truncated)"
}
