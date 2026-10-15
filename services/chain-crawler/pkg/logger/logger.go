package logger

import (
	"context"
	"io"
	"os"
	"time"

	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var logger *zap.Logger

// 这里能保证不出错, 但是初始化, 还是要使用InitLogger
func init() {
	InitLogger(zapcore.DebugLevel, []io.Writer{os.Stdout}, nil, nil)
}

func InitLogger(level zapcore.Level, syncers []io.Writer, options []zap.Option, hooks []HookFunc) *zap.Logger {

	// 新增日志同步的输出位置
	var writeSyncers []zapcore.WriteSyncer // io writer
	for _, syncer := range syncers {
		writeSyncers = append(writeSyncers, zapcore.Lock(zapcore.AddSync(syncer)))
	}

	// 设置日志 level
	atomic_level := zap.NewAtomicLevel()
	atomic_level.SetLevel(level)

	// 设置日志编码格式
	encoderCfg := zap.NewProductionEncoderConfig()
	encoderCfg.EncodeTime = zapcore.TimeEncoderOfLayout(time.DateTime)

	core := zapcore.NewCore(zapcore.NewJSONEncoder(encoderCfg), zapcore.NewMultiWriteSyncer(writeSyncers...), atomic_level)

	options = append(options,
		//zap.AddStacktrace(zap.ErrorLevel), // 错误日志新增异常
		zap.AddCaller(), //日志打印输出 文件名, 行号, 函数名
		zap.AddCallerSkip(1),
	)

	// 设置hook
	core = RegisterHooks(core, hooks...)

	logger = zap.New(core, options...)
	return logger
}

func Info(ctx context.Context, index LoggerIndex, msg string, fields ...zap.Field) {
	if logger == nil {
		panic("logger not init")
	}
	fields = append(fields, getCtxfields(ctx, index)...)
	logger.Info(msg, fields...)
}

func Error(ctx context.Context, index LoggerIndex, msg string, fields ...zap.Field) {
	if logger == nil {
		panic("logger not init")
	}
	fields = append(fields, getCtxfields(ctx, index)...)
	logger.Error(msg, fields...)
}

func Panic(ctx context.Context, index LoggerIndex, msg string, fields ...zap.Field) {
	if logger == nil {
		panic("logger not init")
	}
	fields = append(fields, getCtxfields(ctx, index)...)
	logger.Panic(msg, fields...)
}

func DPanic(ctx context.Context, index LoggerIndex, msg string, fields ...zap.Field) {
	if logger == nil {
		panic("logger not init")
	}
	fields = append(fields, getCtxfields(ctx, index)...)
	logger.DPanic(msg, fields...)
}

func Warn(ctx context.Context, index LoggerIndex, msg string, fields ...zap.Field) {
	if logger == nil {
		panic("logger not init")
	}
	fields = append(fields, getCtxfields(ctx, index)...)
	logger.Warn(msg, fields...)
}

func Debug(ctx context.Context, index LoggerIndex, msg string, fields ...zap.Field) {
	if logger == nil {
		panic("logger not init")
	}
	fields = append(fields, getCtxfields(ctx, index)...)
	logger.Debug(msg, fields...)
}

func Fatal(ctx context.Context, index LoggerIndex, msg string, fields ...zap.Field) {
	if logger == nil {
		panic("logger not init")
	}
	fields = append(fields, getCtxfields(ctx, index)...)
	logger.Fatal(msg, fields...)
}

func getCtxfields(ctx context.Context, index LoggerIndex) []zap.Field {
	ctxFields := make([]zap.Field, 0)
	span := trace.SpanFromContext(ctx).SpanContext()

	if span.HasTraceID() {
		ctxFields = append(ctxFields, zap.String("traceid", span.TraceID().String()))
	}
	if span.HasSpanID() {
		ctxFields = append(ctxFields, zap.String("spanid", span.SpanID().String()))
	}

	ctxFields = append(ctxFields, zap.String("index", index.String()))
	return ctxFields
}
