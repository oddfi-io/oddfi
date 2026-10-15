// Package redis 封装 go-redis/v9 client 的进程级初始化和 key 前缀常量。
//
// 设计取舍：
//   - 不抽象 interface（go-redis 自带的 Cmdable 接口已足够 mock，本包只做装配）
//   - key 前缀集中常量，避免业务层散落字符串拼写错误
package redis

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
)

const (
	// KeyLarkState 是 Lark OAuth state CSRF token 在 Redis 的 key 前缀。
	// TTL 由调用方控制（默认 10 分钟），消费时必须 GETDEL 原子操作。
	KeyLarkState = "lark_oauth_state:"

	// KeyJWTBlacklist 是 JWT jti 黑名单 key 前缀，TTL = 剩余 exp。
	// 用户主动登出后写入，AdminAuthMiddleware 查命即视为已注销。
	KeyJWTBlacklist = "admin_jwt_blacklist:"

	// KeyRateLimit 是限流 key 前缀（IP × 路由分组），由 ratelimit middleware 内部使用。
	KeyRateLimit = "admin_rate_limit:"
)

// New 初始化 redis client。启动期 Ping 校验。
// log 为 nil 时不输出日志（单测复用）。
func New(ctx context.Context, cfg config.RedisConfig, log *zerolog.Logger) (*redis.Client, func() error, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, nil, fmt.Errorf("redis ping: %w", err)
	}

	if log != nil {
		log.Info().
			Str("module", "pkg_redis").
			Str("addr", cfg.Addr).
			Int("db", cfg.DB).
			Msg("redis connected")
	}

	cleanup := func() error {
		return client.Close()
	}
	return client, cleanup, nil
}
