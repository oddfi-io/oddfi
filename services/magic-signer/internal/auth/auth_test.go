package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/config"
)

// tableFromMap builds an AuthTable directly from a sha256-hex → CallerInfo map.
func tableFromMap(entries map[string]config.CallerInfo) config.AuthTable {
	return config.NewAuthTableForTest(entries)
}

// hexSHA returns hex(sha256(s)).
func hexSHA(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func TestMiddleware_NoHeader(t *testing.T) {
	table := tableFromMap(map[string]config.CallerInfo{
		hexSHA("good-token"): {Name: "web-api", AllowedOps: []string{"address"}},
	})
	mw := Middleware(MiddlewareConfig{
		Table: table,
		OnError: func(w http.ResponseWriter, r *http.Request, status int, code, msg string) {
			w.WriteHeader(status)
			_, _ = w.Write([]byte(code))
		},
	})
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/v1/wallet/address", nil)
	handler.ServeHTTP(rec, req)

	require.Equal(t, 401, rec.Code)
	require.Contains(t, rec.Body.String(), "UNAUTHORIZED")
}

func TestMiddleware_WrongToken(t *testing.T) {
	table := tableFromMap(map[string]config.CallerInfo{
		hexSHA("good-token"): {Name: "web-api"},
	})
	mw := Middleware(MiddlewareConfig{
		Table: table,
		OnError: func(w http.ResponseWriter, r *http.Request, status int, code, msg string) {
			w.WriteHeader(status)
			_, _ = w.Write([]byte(code))
		},
	})
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/v1/wallet/address", nil)
	req.Header.Set("X-Service-Auth", "Bearer WRONG")
	handler.ServeHTTP(rec, req)

	require.Equal(t, 401, rec.Code)
}

func TestMiddleware_GoodToken(t *testing.T) {
	table := tableFromMap(map[string]config.CallerInfo{
		hexSHA("good-token"): {Name: "web-api", AllowedOps: []string{"address", "sign"}},
	})
	called := false
	mw := Middleware(MiddlewareConfig{
		Table: table,
		OnError: func(w http.ResponseWriter, r *http.Request, status int, code, msg string) {
			w.WriteHeader(status)
		},
	})
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		a, ok := FromContext(r.Context())
		require.True(t, ok)
		require.Equal(t, "web-api", a.Caller)
		w.WriteHeader(200)
	}))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/v1/wallet/address", nil)
	req.Header.Set("X-Service-Auth", "Bearer good-token")
	handler.ServeHTTP(rec, req)

	require.True(t, called)
	require.Equal(t, 200, rec.Code)
}

func TestMiddleware_SkipPaths(t *testing.T) {
	table := tableFromMap(map[string]config.CallerInfo{})
	mw := Middleware(MiddlewareConfig{
		Table:     table,
		OnError:   func(w http.ResponseWriter, r *http.Request, status int, code, msg string) { w.WriteHeader(status) },
		SkipPaths: []string{"/healthz"},
	})
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/healthz", nil)
	handler.ServeHTTP(rec, req)
	require.Equal(t, 200, rec.Code)
}

func TestRequireOp_Denied(t *testing.T) {
	called := false
	onErr := func(w http.ResponseWriter, r *http.Request, status int, code, msg string) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(code))
	}
	h := RequireOp("sign", onErr, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true }))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/v1/wallet/sign", nil)
	ctx := contextWithAuthForTest(req.Context(), Authenticated{Caller: "web-api", AllowedOps: []string{"address"}})
	h(rec, req.WithContext(ctx))
	require.False(t, called)
	require.Equal(t, 403, rec.Code)
	require.Contains(t, rec.Body.String(), "OP_NOT_ALLOWED")
}

func TestRequireOp_Allowed(t *testing.T) {
	called := false
	h := RequireOp("sign", func(w http.ResponseWriter, r *http.Request, status int, code, msg string) {
		w.WriteHeader(status)
	}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(200)
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/v1/wallet/sign", nil)
	ctx := contextWithAuthForTest(req.Context(), Authenticated{Caller: "web-api", AllowedOps: []string{"address", "sign"}})
	h(rec, req.WithContext(ctx))
	require.True(t, called)
	require.Equal(t, 200, rec.Code)
}
