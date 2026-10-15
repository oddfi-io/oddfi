package client

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// Version is set at build time via -ldflags.
var Version = "dev"

// Config controls how the client talks to magic-signer.
type Config struct {
	// BaseURL: required. e.g. "https://magic-signer.svc.cluster.local"
	// (no trailing slash; trailing slash is stripped on use).
	BaseURL string

	// AuthToken: required. The plaintext token registered with the service
	// (the service has its sha256 in its config). Do not hash before passing.
	AuthToken string

	// Timeout: optional, default 10s. Per-request total timeout.
	// Must be long enough for service-side Magic retries (≈ 3*200ms = 600ms
	// plus the Magic call itself ~ 1-2s).
	Timeout time.Duration

	// Logger: optional, default slog.Default(). Use a context-scoped logger
	// for correlation with caller's request_id.
	Logger *slog.Logger

	// HTTPClient: optional. If nil, an http.Client with Timeout is created.
	HTTPClient *http.Client

	// UserAgent: optional, default "magic-signer-client/<Version>".
	UserAgent string

	// MaxNetworkRetries: optional, default 1. Retries on connection-level
	// failures only (DNS error, connection reset). HTTP responses are never
	// retried; the service does its own retry against Magic.
	MaxNetworkRetries int
}

// Validate runs config sanity checks.
func (c *Config) Validate() error {
	if strings.TrimSpace(c.BaseURL) == "" {
		return errors.New("BaseURL is required")
	}
	if strings.TrimSpace(c.AuthToken) == "" {
		return errors.New("AuthToken is required")
	}
	if c.Timeout < 0 {
		return errors.New("Timeout must be >= 0")
	}
	if c.MaxNetworkRetries < 0 {
		return errors.New("MaxNetworkRetries must be >= 0")
	}
	return nil
}

// applyDefaults fills in zero-value fields with sensible defaults.
func (c *Config) applyDefaults() {
	c.BaseURL = strings.TrimRight(strings.TrimSpace(c.BaseURL), "/")
	if c.Timeout == 0 {
		c.Timeout = 10 * time.Second
	}
	if c.Logger == nil {
		c.Logger = slog.Default()
	}
	if c.UserAgent == "" {
		c.UserAgent = "magic-signer-client/" + Version
	}
	if c.HTTPClient == nil {
		c.HTTPClient = &http.Client{
			Timeout: c.Timeout,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				MaxIdleConnsPerHost: 5,
				IdleConnTimeout:     90 * time.Second,
			},
		}
	}
	if c.MaxNetworkRetries == 0 {
		c.MaxNetworkRetries = 1
	}
}
