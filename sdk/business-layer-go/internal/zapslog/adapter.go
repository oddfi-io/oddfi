// Package zapslog provides a minimal adapter that wraps a *zap.Logger so it
// can be passed where the SDK expects *log/slog.Logger.
package zapslog

import (
	"context"
	"log/slog"

	"go.uber.org/zap"
)

// Adapt returns a *slog.Logger that writes through the supplied zap logger.
// If z is nil, returns a no-op slog logger.
func Adapt(z *zap.Logger) *slog.Logger {
	if z == nil {
		return slog.New(noopHandler{})
	}
	return slog.New(&handler{z: z})
}

type handler struct {
	z     *zap.Logger
	attrs []zap.Field
}

func (h *handler) Enabled(_ context.Context, _ slog.Level) bool { return true }

func (h *handler) Handle(_ context.Context, r slog.Record) error {
	fields := append([]zap.Field{}, h.attrs...)
	r.Attrs(func(a slog.Attr) bool {
		fields = append(fields, zap.Any(a.Key, a.Value.Any()))
		return true
	})
	switch {
	case r.Level >= slog.LevelError:
		h.z.Error(r.Message, fields...)
	case r.Level >= slog.LevelWarn:
		h.z.Warn(r.Message, fields...)
	case r.Level >= slog.LevelInfo:
		h.z.Info(r.Message, fields...)
	default:
		h.z.Debug(r.Message, fields...)
	}
	return nil
}

func (h *handler) WithAttrs(as []slog.Attr) slog.Handler {
	out := &handler{z: h.z, attrs: append([]zap.Field{}, h.attrs...)}
	for _, a := range as {
		out.attrs = append(out.attrs, zap.Any(a.Key, a.Value.Any()))
	}
	return out
}

func (h *handler) WithGroup(_ string) slog.Handler { return h }

type noopHandler struct{}

func (noopHandler) Enabled(_ context.Context, _ slog.Level) bool  { return false }
func (noopHandler) Handle(_ context.Context, _ slog.Record) error { return nil }
func (noopHandler) WithAttrs(_ []slog.Attr) slog.Handler          { return noopHandler{} }
func (noopHandler) WithGroup(_ string) slog.Handler               { return noopHandler{} }
