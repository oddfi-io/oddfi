package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

type reqIDCtxKey struct{}

// RequestIDMiddleware ensures every request has an X-Request-ID.
// Reuses caller-supplied header if present; otherwise generates one.
// The id is written into request context AND echoed back in response header.
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = generateRequestID()
		}
		w.Header().Set("X-Request-ID", id)

		ctx := context.WithValue(r.Context(), reqIDCtxKey{}, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func requestIDFromCtx(ctx context.Context) string {
	if v, ok := ctx.Value(reqIDCtxKey{}).(string); ok {
		return v
	}
	return ""
}

func generateRequestID() string {
	var buf [10]byte
	_, _ = rand.Read(buf[:])
	return "req_" + hex.EncodeToString(buf[:])
}
