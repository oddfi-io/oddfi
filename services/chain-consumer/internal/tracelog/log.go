package tracelog

import (
	"context"
	"os"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var logger *zap.Logger

func InitLogger(env string) {
	// 使用 JSON 编码器，确保 traceID 和 spanID 作为顶层字段输出
	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderConfig.TimeKey = "time"
	encoderConfig.MessageKey = "message"
	encoderConfig.LevelKey = "level"
	encoderConfig.CallerKey = "caller"

	jsonEncoder := zapcore.NewJSONEncoder(encoderConfig)
	consoleOutput := zapcore.Lock(os.Stdout)
	level := zap.NewAtomicLevel()
	go func() {
		for {
			if _, err := os.Stat("./DEBUG"); os.IsNotExist(err) {
				level.SetLevel(zap.InfoLevel)
			} else {
				level.SetLevel(zap.DebugLevel)
			}
			time.Sleep(10 * time.Second)
		}
	}()
	jsonCore := zapcore.NewCore(jsonEncoder, consoleOutput, level)
	logger = zap.New(zapcore.NewTee(jsonCore), zap.AddCaller())
}

func NewWithContext(ctx context.Context) *zap.SugaredLogger {
	sl := logger.Sugar()
	span := SpanFromContext(ctx)
	spanCtx := span.SpanContext()

	// 将 traceID 和 spanID 作为顶层字段添加到 logger
	// 使用小写字段名以符合常见日志格式规范（trace_id, span_id）
	if spanCtx.HasTraceID() {
		sl = sl.With(zap.String("trace_id", spanCtx.TraceID().String()))
	}
	if spanCtx.HasSpanID() {
		sl = sl.With(zap.String("span_id", spanCtx.SpanID().String()))
	}

	return sl
}
