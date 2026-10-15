package logc

import (
	"context"
	"fmt"

	"chain-consumer/internal/tracelog"

	"go.uber.org/zap"
)

func Info(ctx context.Context, msg string, fields ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	if len(fields) == 0 {
		logger.Info(msg)
	} else {
		logger.Infow(msg, toKeyValues(fields...)...)
	}
}

func Infof(ctx context.Context, format string, args ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Infof(format, args...)
}

func Infow(ctx context.Context, msg string, fields ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Infow(msg, toKeyValues(fields...)...)
}

func Error(ctx context.Context, msg string, fields ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Errorw(msg, toKeyValues(fields...)...)
}

func Errorf(ctx context.Context, format string, args ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Errorf(format, args...)
}

func Errorw(ctx context.Context, msg string, fields ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Errorw(msg, toKeyValues(fields...)...)
}

func Fatal(ctx context.Context, msg string, fields ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Fatalw(msg, toKeyValues(fields...)...)
}

func Fatalf(ctx context.Context, format string, args ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Fatalf(format, args...)
}

func Debug(ctx context.Context, msg string, fields ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	if len(fields) == 0 {
		logger.Debug(msg)
	} else {
		logger.Debugw(msg, toKeyValues(fields...)...)
	}
}

func Debugf(ctx context.Context, format string, args ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Debugf(format, args...)
}

func Debugw(ctx context.Context, msg string, fields ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Debugw(msg, toKeyValues(fields...)...)
}

func Warn(ctx context.Context, msg string, fields ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	if len(fields) == 0 {
		logger.Warn(msg)
	} else {
		logger.Warnw(msg, toKeyValues(fields...)...)
	}
}

func Warnf(ctx context.Context, format string, args ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Warnf(format, args...)
}

func Warnw(ctx context.Context, msg string, fields ...interface{}) {
	logger := tracelog.NewWithContext(ctx)
	logger.Warnw(msg, toKeyValues(fields...)...)
}

type logField struct {
	Key   string
	Value interface{}
}

func Field(key string, value interface{}) logField {
	return logField{Key: key, Value: value}
}

func toKeyValues(fields ...interface{}) []interface{} {
	var result []interface{}
	for _, f := range fields {
		switch v := f.(type) {
		case logField:
			result = append(result, v.Key, v.Value)
		case error:
			result = append(result, "error", v.Error())
		case zap.Field:
			result = append(result, v.Key, v.Interface)
		default:
			result = append(result, "unknown", fmt.Sprintf("%+v", v))
		}
	}
	return result
}
