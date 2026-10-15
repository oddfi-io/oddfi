package redis

import (
	"context"
	"fmt"
	"sync"
	"time"

	"everything_finance/org/web-api/internal/config"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	rdb *redis.Client
}

var (
	client   *Client
	initOnce sync.Once
)

func Init(cfg config.RedisConfig) *Client {
	initOnce.Do(func() {
		rdb := redis.NewClient(&redis.Options{
			Addr:     cfg.Addr(),
			Password: cfg.Password,
			DB:       cfg.DB,
			PoolSize: cfg.PoolSize,
		})
		client = &Client{rdb: rdb}
	})

	if err := client.Ping(context.Background()); err != nil {
		panic(fmt.Sprintf("failed to ping redis: %v", err))
	}
	return client
}

func GetRedis() *Client {
	if client == nil {
		panic("redis not initialized, call Init() first")
	}
	return client
}

func (c *Client) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

func (c *Client) Close() error {
	return c.rdb.Close()
}

func (c *Client) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.rdb.Set(ctx, key, value, expiration).Err()
}

func (c *Client) SAdd(ctx context.Context, key string, value interface{}) error {
	return c.rdb.SAdd(ctx, key, value).Err()
}

func (c *Client) Get(ctx context.Context, key string) (string, error) {
	return c.rdb.Get(ctx, key).Result()
}

func (c *Client) Del(ctx context.Context, keys ...string) error {
	return c.rdb.Del(ctx, keys...).Err()
}

func (c *Client) Exists(ctx context.Context, keys ...string) (int64, error) {
	return c.rdb.Exists(ctx, keys...).Result()
}

func (c *Client) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	return c.rdb.SetNX(ctx, key, value, expiration).Result()
}

func (c *Client) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return c.rdb.Expire(ctx, key, expiration).Err()
}

func (c *Client) TTL(ctx context.Context, key string) (time.Duration, error) {
	return c.rdb.TTL(ctx, key).Result()
}

func (c *Client) Incr(ctx context.Context, key string) (int64, error) {
	return c.rdb.Incr(ctx, key).Result()
}

func (c *Client) GetRedisClient() *redis.Client {
	return c.rdb
}
