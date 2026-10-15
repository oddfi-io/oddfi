package client

import (
	"errors"
	"fmt"
)

// Sentinel errors. Callers use errors.Is(err, ErrXxx) to branch.
var (
	// ErrInvalidConfig: client constructed with missing/invalid fields.
	ErrInvalidConfig = errors.New("magic-signer/client: invalid config")

	// ErrUnauthorized: service returned 401 — token wrong or unknown.
	// Caller should fix their token configuration.
	ErrUnauthorized = errors.New("magic-signer/client: 401 from service")

	// ErrOpNotAllowed: service returned 403 — caller has no permission for op.
	ErrOpNotAllowed = errors.New("magic-signer/client: 403 from service")

	// ErrBadRequest: service returned 400 — request format wrong.
	ErrBadRequest = errors.New("magic-signer/client: 400 from service")

	// ErrMagicUpstream: service returned 502 — Magic API rejected.
	ErrMagicUpstream = errors.New("magic-signer/client: magic upstream rejected request (502)")

	// ErrMagicNetwork: service returned 503 — Magic unreachable after retries.
	// Caller can backoff and retry.
	ErrMagicNetwork = errors.New("magic-signer/client: magic network error (503)")

	// ErrServerInternal: service returned 500.
	ErrServerInternal = errors.New("magic-signer/client: service internal error (500)")

	// ErrNetwork: could not even reach the magic-signer service.
	ErrNetwork = errors.New("magic-signer/client: network failure to magic-signer service")
)

// ServiceError carries the structured error details from the service.
// Wraps one of the sentinel errors above based on HTTPStatus.
type ServiceError struct {
	HTTPStatus int
	ErrorCode  string
	Message    string
	RequestID  string
	Env        string
}

func (e *ServiceError) Error() string {
	return fmt.Sprintf("magic-signer/client: HTTP %d %s (env=%s req=%s): %s",
		e.HTTPStatus, e.ErrorCode, e.Env, e.RequestID, e.Message)
}

// Unwrap returns the sentinel error matching this response's HTTP status.
func (e *ServiceError) Unwrap() error {
	switch e.HTTPStatus {
	case 400:
		return ErrBadRequest
	case 401:
		return ErrUnauthorized
	case 403:
		return ErrOpNotAllowed
	case 500:
		return ErrServerInternal
	case 502:
		return ErrMagicUpstream
	case 503:
		return ErrMagicNetwork
	default:
		return nil
	}
}
