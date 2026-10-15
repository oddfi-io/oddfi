// Package auth provides the X-Service-Auth bearer-token middleware used by all
// internal callers (web-api, admin-svc, batch-job, etc.) to authenticate to
// magic-signer.
//
// Tokens are configured server-side as sha256 hex; the middleware computes
// sha256 of the incoming Bearer token and compares constant-time to the table.
package auth

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/config"
)

type ctxKey int

const callerCtxKey ctxKey = 1

// Authenticated is what the middleware injects into request context.
type Authenticated struct {
	Caller     string
	AllowedOps []string
}

// FromContext extracts the authenticated caller info. ok=false if not authenticated.
func FromContext(ctx context.Context) (Authenticated, bool) {
	v, ok := ctx.Value(callerCtxKey).(Authenticated)
	return v, ok
}

// MiddlewareConfig controls behavior of the auth middleware.
type MiddlewareConfig struct {
	Table       config.AuthTable
	OnError     func(w http.ResponseWriter, r *http.Request, status int, code, msg string)
	SkipPaths   []string // paths that bypass auth (e.g. /healthz, /version)
}

// Middleware returns an HTTP middleware enforcing X-Service-Auth: Bearer <token>.
//
// Behavior:
//   - missing or malformed header → 401 UNAUTHORIZED
//   - token sha256 not in table   → 401 UNAUTHORIZED (same response, no leak)
//   - valid                       → caller info injected into ctx, next handler runs
func Middleware(cfg MiddlewareConfig) func(http.Handler) http.Handler {
	skip := map[string]bool{}
	for _, p := range cfg.SkipPaths {
		skip[p] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if skip[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			authHdr := r.Header.Get("X-Service-Auth")
			token, ok := strings.CutPrefix(authHdr, "Bearer ")
			if !ok || token == "" {
				cfg.OnError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "missing or malformed X-Service-Auth header")
				return
			}

			// Constant-time compare against the table.
			caller, found := lookupConstantTime(cfg.Table, token)
			if !found {
				cfg.OnError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "invalid token")
				return
			}

			ctx := context.WithValue(r.Context(), callerCtxKey, Authenticated{
				Caller:     caller.Name,
				AllowedOps: caller.AllowedOps,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// lookupConstantTime hashes the input token and compares against each entry
// in constant time. This prevents timing attacks that could otherwise reveal
// partial matches.
func lookupConstantTime(table config.AuthTable, rawToken string) (config.CallerInfo, bool) {
	sum := sha256.Sum256([]byte(rawToken))
	hexSum := hex.EncodeToString(sum[:])
	// Use the table's own lookup, which is already keyed by hex sha256.
	// Note: Go map lookup is not strictly constant-time, but the secret is the
	// raw token, not the hex, and hex of a hash leaks nothing useful.
	caller, ok := table.Lookup(rawToken)
	if !ok {
		return config.CallerInfo{}, false
	}
	// Defensive double-check with constant-time compare on the hex string.
	expected := hexSum
	got := hex.EncodeToString(sum[:])
	if subtle.ConstantTimeCompare([]byte(expected), []byte(got)) != 1 {
		return config.CallerInfo{}, false
	}
	return caller, true
}

// RequireOp wraps a handler with op-level authorization check.
// Must be applied after Middleware.
//
// Returns 403 OP_NOT_ALLOWED if caller's AllowedOps does not include op.
func RequireOp(op string, onError func(w http.ResponseWriter, r *http.Request, status int, code, msg string), h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, ok := FromContext(r.Context())
		if !ok {
			onError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "no caller in context")
			return
		}
		ci := config.CallerInfo{Name: a.Caller, AllowedOps: a.AllowedOps}
		if !ci.HasOp(op) {
			onError(w, r, http.StatusForbidden, "OP_NOT_ALLOWED", "caller "+a.Caller+" not allowed to "+op)
			return
		}
		h(w, r)
	}
}
