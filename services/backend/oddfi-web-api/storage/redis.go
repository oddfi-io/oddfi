package storage

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"oddfi-web-api/config"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	rdb *redis.Client
}

var (
	client   *RedisClient
	initOnce sync.Once
)

func NewRedisStorage(cfg config.RedisConfig) (*RedisClient, error) {
	var err error
	initOnce.Do(func() {
		rdb := redis.NewClient(&redis.Options{
			Addr:     cfg.Addr(),
			Password: cfg.Password,
			DB:       cfg.DB,
			PoolSize: cfg.PoolSize,
		})

		// 先测试连接，成功了再赋值给全局 client
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		if pingErr := rdb.Ping(ctx).Err(); pingErr != nil {
			log.Printf("❌ [Redis] 连接失败: %v", pingErr)
			err = pingErr
			return
		}

		client = &RedisClient{rdb: rdb}
	})

	if err != nil {
		return nil, fmt.Errorf("redis init failed: %w", err)
	}

	if client == nil {
		return nil, fmt.Errorf("redis client is nil (possibly init failed before)")
	}

	return client, nil
}

func GetRedis() *RedisClient {
	if client == nil {
		panic("redis not initialized, call Init() first")
	}
	return client
}

func (c *RedisClient) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

func (c *RedisClient) Close() error {
	return c.rdb.Close()
}

func (c *RedisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.rdb.Set(ctx, key, value, expiration).Err()
}

func (c *RedisClient) SAdd(ctx context.Context, key string, value interface{}) error {
	return c.rdb.SAdd(ctx, key, value).Err()
}

func (c *RedisClient) Get(ctx context.Context, key string) (string, error) {
	return c.rdb.Get(ctx, key).Result()
}

func (c *RedisClient) MGet(ctx context.Context, keys ...string) ([]interface{}, error) {
	values, err := c.rdb.MGet(ctx, keys...).Result()
	return values, err
}

// Pipeline 批量操作
func (c *RedisClient) Pipeline() redis.Pipeliner {
	return c.rdb.Pipeline()
}

func (c *RedisClient) Del(ctx context.Context, keys ...string) error {
	return c.rdb.Del(ctx, keys...).Err()
}

func (c *RedisClient) Exists(ctx context.Context, keys ...string) (int64, error) {
	return c.rdb.Exists(ctx, keys...).Result()
}

func (c *RedisClient) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	return c.rdb.SetNX(ctx, key, value, expiration).Result()
}

func (c *RedisClient) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return c.rdb.Expire(ctx, key, expiration).Err()
}

func (c *RedisClient) TTL(ctx context.Context, key string) (time.Duration, error) {
	return c.rdb.TTL(ctx, key).Result()
}

func (c *RedisClient) Incr(ctx context.Context, key string) (int64, error) {
	return c.rdb.Incr(ctx, key).Result()
}

func (c *RedisClient) GetRedisClient() *redis.Client {
	return c.rdb
}
