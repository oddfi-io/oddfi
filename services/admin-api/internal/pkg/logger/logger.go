// Package logger 提供进程级 zerolog 实例。
//
// 设计：
//   - 全局单例 + 显式 Reconfigure，避免每处注入 logger 实例
//   - Pretty 模式仅用于本地 dev；prod 输出纯 JSON 便于日志采集
//   - 字段命名统一 snake_case；调用方必须带 module 字段
package logger

import (
	"os"
	"sync"

	"github.com/rs/zerolog"
)

var (
	mu      sync.RWMutex
	current zerolog.Logger
)

// Init 用启动期默认配置（info / pretty 关闭）初始化一个 logger。
// 配置文件加载后调用 Reconfigure 应用真实级别。
func Init() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	current = zerolog.New(os.Stdout).With().Timestamp().Logger()
}

// Reconfigure 根据 config 切换日志级别和 pretty 模式。
func Reconfigure(level string, pretty bool) {
	mu.Lock()
	defer mu.Unlock()

	lv, err := zerolog.ParseLevel(level)
	if err != nil || lv == zerolog.NoLevel {
		lv = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(lv)

	var w = os.Stdout
	if pretty {
		current = zerolog.New(zerolog.ConsoleWriter{Out: w, TimeFormat: "15:04:05"}).
			With().Timestamp().Logger()
	} else {
		current = zerolog.New(w).With().Timestamp().Logger()
	}
}

// L 返回当前 logger。
func L() *zerolog.Logger {
	mu.RLock()
	defer mu.RUnlock()
	l := current
	return &l
}
