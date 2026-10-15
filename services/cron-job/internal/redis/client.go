package redis

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

var Client *redis.Client

var (
	ErrLockAcquired = errors.New("lock already held by another process")
	ErrLockNotHeld  = errors.New("lock not held by this instance")
)

// Init 初始化Redis客户端，失败则panic
func Init(addr string) {
	Client = redis.NewClient(&redis.Options{
		Addr:     addr,
		PoolSize: 10,
	})

	ctx := context.Background()
	if err := Client.Ping(ctx).Err(); err != nil {
		panic("redis connection failed: " + err.Error())
	}
}

// GetClient 获取全局Redis客户端
func GetClient() *redis.Client {
	return Client
}

// Close 关闭Redis连接
func Close() error {
	if Client != nil {
		return Client.Close()
	}
	return nil
}

// Lock 基于 Redis 的分布式锁
type Lock struct {
	key   string
	value string // 每个实例用 uuid 标记自己
	ttl   time.Duration
}

// NewLock 创建锁实例
func NewLock(key string, ttl time.Duration) *Lock {
	return &Lock{
		key:   "cron_lock:" + key, // 加前缀区分业务 key
		value: uuid.NewString(),   // 当前实例的唯一标识
		ttl:   ttl,
	}
}

// Acquire 尝试获取锁，成功返回 nil，失败返回 ErrLockAcquired
// true 尝试锁成功， false 尝试锁失败（已有锁）
func (l *Lock) Acquire(ctx context.Context) (bool, error) {
	ok, err := Client.SetNX(ctx, l.key, l.value, l.ttl).Result()
	if err != nil {
		return false, err
	}
	if !ok {
		return false, err
	}
	return true, nil
}

// Release 释放锁（只有持有者才能释放）
func (l *Lock) Release(ctx context.Context) error {
	// Lua 脚本：先检查值是否是自己，是才删，保证原子性
	script := redis.NewScript(`
		if redis.call("GET", KEYS[1]) == ARGV[1] then
			return redis.call("DEL", KEYS[1])
		else
			return 0
		end
	`)
	_, err := script.Run(ctx, Client, []string{l.key}, l.value).Result()
	if errors.Is(err, redis.Nil) {
		return ErrLockNotHeld
	}
	return err
}

func SetTTl(ctx context.Context, key string, ttl time.Duration) error {
	return Client.Set(ctx, key, "", ttl).Err()
}

func HasKey(ctx context.Context, key string) (bool, error) {
	exists, err := Client.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}

	return exists == 1, nil
}
