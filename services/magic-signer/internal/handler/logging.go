package handler

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Crypto-Barrett/oddfi-magic-client/internal/auth"
)

// logExtra holds the per-request business fields that handlers populate
// during execution; the logging middleware reads them at the end.
type logExtra struct {
	Op               string
	UserID           string
	DigestPrefix     string
	Cached           bool
	MagicLatencyMs   int64
	MagicStatus      int
	Result           string // "success" or "error"
	ErrorCode        string
	ErrorDetail      string // full err.Error() for diagnostics (server-side only)
	MagicRawResponse string // verbatim response body from Magic (sign path; diagnostics only)
	Address          string
}

type logExtraCtxKey struct{}

// extraHolder wraps logExtra in a mutex-protected struct so handlers can
// progressively set fields (e.g., set Op early, then MagicLatencyMs later).
type extraHolder struct {
	mu    sync.Mutex
	extra logExtra
}

// withLogExtra injects an empty logExtra holder into ctx so handlers can update it.
func withLogExtra(ctx context.Context) context.Context {
	return context.WithValue(ctx, logExtraCtxKey{}, &extraHolder{})
}

// setLogExtra merges the given fields into the holder. Zero values are ignored.
func setLogExtra(ctx context.Context, e logExtra) {
	h, ok := ctx.Value(logExtraCtxKey{}).(*extraHolder)
	if !ok {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if e.Op != "" {
		h.extra.Op = e.Op
	}
	if e.UserID != "" {
		h.extra.UserID = e.UserID
	}
	if e.DigestPrefix != "" {
		h.extra.DigestPrefix = e.DigestPrefix
	}
	if e.Cached {
		h.extra.Cached = true
	}
	if e.MagicLatencyMs > 0 {
		h.extra.MagicLatencyMs = e.MagicLatencyMs
	}
	if e.MagicStatus > 0 {
		h.extra.MagicStatus = e.MagicStatus
	}
	if e.Result != "" {
		h.extra.Result = e.Result
	}
	if e.ErrorCode != "" {
		h.extra.ErrorCode = e.ErrorCode
	}
	if e.ErrorDetail != "" {
		h.extra.ErrorDetail = e.ErrorDetail
	}
	if e.MagicRawResponse != "" {
		h.extra.MagicRawResponse = e.MagicRawResponse
	}
	if e.Address != "" {
		h.extra.Address = e.Address
	}
}

func readLogExtra(ctx context.Context) logExtra {
	h, ok := ctx.Value(logExtraCtxKey{}).(*extraHolder)
	if !ok {
		return logExtra{}
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.extra
}

type recordingResponseWriter struct {
	http.ResponseWriter
	status   int
	byteSize int
}

func (w *recordingResponseWriter) WriteHeader(s int) {
	w.status = s
	w.ResponseWriter.WriteHeader(s)
}

func (w *recordingResponseWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.byteSize += n
	return n, err
}

// LoggingMiddleware emits one structured log line per request with all
// observability fields populated.
func LoggingMiddleware(env string, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := withLogExtra(r.Context())
			start := time.Now()

			rw := &recordingResponseWriter{ResponseWriter: w, status: 200}
			next.ServeHTTP(rw, r.WithContext(ctx))

			caller := "unknown"
			if a, ok := auth.FromContext(ctx); ok {
				caller = a.Caller
			}

			extra := readLogExtra(ctx)
			log.Info("http_request",
				"svc", "magic-signer",
				"env", env,
				"request_id", requestIDFromCtx(ctx),
				"caller", caller,
				"caller_ip", clientIP(r),
				"method", r.Method,
				"path", r.URL.Path,
				"status", rw.status,
				"duration_ms", time.Since(start).Milliseconds(),
				"bytes", rw.byteSize,
				"op", extra.Op,
				"user_id", extra.UserID,
				"digest_prefix", extra.DigestPrefix,
				"address", extra.Address,
				"magic_latency_ms", extra.MagicLatencyMs,
				"magic_status", extra.MagicStatus,
				"cached", extra.Cached,
				"result", extra.Result,
				"error_code", extra.ErrorCode,
				"error_detail", extra.ErrorDetail,
				"magic_raw_response", extra.MagicRawResponse,
			)
		})
	}
}

func clientIP(r *http.Request) string {
	// Trust X-Forwarded-For only from a known proxy in production; we keep
	// it simple here and prefer the direct RemoteAddr.
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
