package magicapi

import (
	"errors"
	"fmt"
)

// Sentinel errors that callers can switch on.
var (
	// ErrUnauthorized: Magic returned 401 or 403 — JWT rejected.
	// Don't retry; check OIDC configuration.
	ErrUnauthorized = errors.New("magicapi: magic rejected JWT (401/403)")

	// ErrMagicAPI: Magic returned 4xx (non-401/403) — business error.
	// Don't retry; fix the request.
	ErrMagicAPI = errors.New("magicapi: magic returned business error (4xx)")

	// ErrNetwork: network failure or 5xx after all retries exhausted.
	// Caller should backoff and retry later.
	ErrNetwork = errors.New("magicapi: network failure or 5xx (retries exhausted)")

	// ErrInvalidResponse: response body could not be parsed.
	// Indicates a contract change or upstream bug.
	ErrInvalidResponse = errors.New("magicapi: invalid response from magic")
)

// HTTPError carries the actual HTTP response details from Magic.
// Wraps one of the sentinel errors via Unwrap based on status code.
type HTTPError struct {
	StatusCode int
	Body       string // truncated to first 1024 bytes
	URL        string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("magicapi: HTTP %d from %s: %s", e.StatusCode, e.URL, e.Body)
}

// Unwrap maps the HTTP status to a sentinel error so errors.Is works as expected.
func (e *HTTPError) Unwrap() error {
	switch {
	case e.StatusCode == 401 || e.StatusCode == 403:
		return ErrUnauthorized
	case e.StatusCode >= 400 && e.StatusCode < 500:
		return ErrMagicAPI
	case e.StatusCode >= 500:
		return ErrNetwork
	}
	return nil
}
