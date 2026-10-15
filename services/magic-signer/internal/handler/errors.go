// Package handler implements the HTTP request handlers for magic-signer.
package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/magicapi"
)

// ErrorResponse is the canonical error body returned by all handlers.
type ErrorResponse struct {
	ErrorCode    string `json:"error_code"`
	ErrorMessage string `json:"error_message"`
	RequestID    string `json:"request_id"`
	Env          string `json:"env"`
}

// writeError serializes an error response and records the error_code in
// the request context for the access log.
func writeError(w http.ResponseWriter, r *http.Request, env string, status int, code, msg string) {
	setLogExtra(r.Context(), logExtra{Result: "error", ErrorCode: code})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(ErrorResponse{
		ErrorCode:    code,
		ErrorMessage: msg,
		RequestID:    requestIDFromCtx(r.Context()),
		Env:          env,
	})
}

// writeJSON writes a 200 success response.
func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// mapMagicAPIError converts a magicapi error into (httpStatus, errorCode, message).
func mapMagicAPIError(err error) (int, string, string) {
	switch {
	case errors.Is(err, magicapi.ErrUnauthorized):
		var httpErr *magicapi.HTTPError
		if errors.As(err, &httpErr) {
			return http.StatusBadGateway, "MAGIC_UNAUTHORIZED",
				fmt.Sprintf("Magic rejected the JWT (status=%d): %s", httpErr.StatusCode, httpErr.Body)
		}
		return http.StatusBadGateway, "MAGIC_UNAUTHORIZED", "Magic rejected the JWT — check OIDC config"
	case errors.Is(err, magicapi.ErrMagicAPI):
		return http.StatusBadGateway, "MAGIC_API_ERROR", err.Error()
	case errors.Is(err, magicapi.ErrNetwork):
		return http.StatusServiceUnavailable, "MAGIC_NETWORK_ERROR", "Magic upstream unavailable after retries"
	case errors.Is(err, magicapi.ErrInvalidResponse):
		return http.StatusBadGateway, "MAGIC_API_ERROR", "invalid response from Magic"
	default:
		return http.StatusInternalServerError, "INTERNAL_ERROR", "internal error"
	}
}
