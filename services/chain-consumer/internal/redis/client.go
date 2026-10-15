package redis

import (
	"context"
	"fmt"
	"time"

	"chain-consumer/global"

	"github.com/redis/go-redis/v9"
)

var (
	client *redis.Client
)

func InitRedis(cfg global.RedisConfig) error {
	if cfg.Addr == "" {
		return fmt.Errorf("redis addr is empty")
	}

	client = redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
		PoolSize: cfg.PoolSize,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to redis: %w", err)
	}

	return nil
}

func GetClient() *redis.Client {
	return client
}

func IsEmpty() bool {
	return client == nil
}

func FilterExistingInSet(ctx context.Context, key string, members ...string) ([]string, error) {
	if client == nil {
		return nil, fmt.Errorf("redis client is not initialized")
	}

	if len(members) == 0 {
		return nil, nil
	}

	pipe := client.Pipeline()
	cmds := make([]*redis.BoolCmd, len(members))

	for i, member := range members {
		cmds[i] = pipe.SIsMember(ctx, key, member)
	}

	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, err
	}

	var result []string
	for i, cmd := range cmds {
		exists, err := cmd.Result()
		if err != nil {
			if err == redis.Nil {
				continue
			}
			return nil, fmt.Errorf("failed to get SISMEMBER result for member %s: %w", members[i], err)
		}
		if exists {
			result = append(result, members[i])
		}
	}

	return result, nil
}

func Close() error {
	if client != nil {
		return client.Close()
	}
	return nil
}
