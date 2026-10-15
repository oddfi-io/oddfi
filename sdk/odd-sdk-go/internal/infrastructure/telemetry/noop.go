package telemetry

import "context"

// NoopLogger is the default logger placeholder for infrastructure adapters.
type NoopLogger struct{}

// Debug drops a debug log entry.
func (NoopLogger) Debug(context.Context, string, ...Field) {}

// Info drops an info log entry.
func (NoopLogger) Info(context.Context, string, ...Field) {}

// Warn drops a warning log entry.
func (NoopLogger) Warn(context.Context, string, ...Field) {}

// Error drops an error log entry.
func (NoopLogger) Error(context.Context, string, ...Field) {}

// Field is a structured telemetry field placeholder.
type Field struct {
	Key   string
	Value string
}
