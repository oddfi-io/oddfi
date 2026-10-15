package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Logger 全局日志实例
var Logger *zap.SugaredLogger

// Init 初始化日志系统
func Init(level string, encoding string) error {
	// 解析日志级别
	var zapLevel zapcore.Level
	switch level {
	case "debug":
		zapLevel = zap.DebugLevel
	case "info":
		zapLevel = zap.InfoLevel
	case "warn":
		zapLevel = zap.WarnLevel
	case "error":
		zapLevel = zap.ErrorLevel
	default:
		zapLevel = zap.InfoLevel
	}

	// 配置编码器
	var encoder zapcore.Encoder
	if encoding == "console" {
		encoder = zapcore.NewConsoleEncoder(zap.NewDevelopmentEncoderConfig())
	} else {
		encoder = zapcore.NewJSONEncoder(zap.NewProductionEncoderConfig())
	}

	// 配置核心
	core := zapcore.NewCore(
		encoder,
		zapcore.AddSync(os.Stdout),
		zapLevel,
	)

	// 创建logger并转为SugaredLogger
	baseLogger := zap.New(core, zap.AddCaller(), zap.AddStacktrace(zap.ErrorLevel))
	Logger = baseLogger.Sugar()

	return nil
}

// GetLogger 获取全局logger
func GetLogger() *zap.SugaredLogger {
	return Logger
}

// Infof 记录info级别日志
func Infof(template string, args ...interface{}) {
	Logger.Infof(template, args...)
}

// Debugf 记录debug级别日志
func Debugf(template string, args ...interface{}) {
	Logger.Debugf(template, args...)
}

// Warnf 记录warn级别日志
func Warnf(template string, args ...interface{}) {
	Logger.Warnf(template, args...)
}

// Errorf 记录error级别日志
func Errorf(template string, args ...interface{}) {
	Logger.Errorf(template, args...)
}

// With 添加字段
func With(args ...interface{}) *zap.SugaredLogger {
	return Logger.With(args...)
}
