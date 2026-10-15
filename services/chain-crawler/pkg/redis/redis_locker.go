package redis

import (
	"chain_crawler/pkg/tracelog"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/bsm/redislock"
	"github.com/redis/go-redis/v9"
)

type RedisLocker struct {
	client *redis.Client
	locker *redislock.Client
}

func NewRedisLocker(cfg RedisConfig) *RedisLocker {

	client := redis.NewClient(&redis.Options{
		Network:  "tcp",
		Addr:     fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Password: cfg.Auth,
		//MaxIdleConns:    1024,
		//MaxActiveConns:  1024,
		//ConnMaxIdleTime: 2 * time.Second,
	})

	lkr := new(RedisLocker)
	lkr.client = client
	lkr.locker = redislock.New(client)

	return lkr
}

func (r *RedisLocker) Lock(ctx context.Context, key string, ttl time.Duration) (locker *redislock.Lock, locked bool, err error) {
	lockSpanCtx, lockSpan := tracelog.StartSpan(ctx, "redis", "Lock")
	defer lockSpan.End()
	tl := tracelog.NewWithContext(lockSpanCtx)
	tl.Infow("Lock", "key", key, "ttl", ttl)
	dctx, cancel := context.WithDeadline(ctx, time.Now().Add(ttl))
	defer cancel()
	locker, err = r.locker.Obtain(dctx, key, ttl, &redislock.Options{
		RetryStrategy: redislock.LinearBackoff(time.Millisecond * 50),
	})
	if err == redislock.ErrNotObtained {
		return nil, true, nil
	} else if err != nil {
		return nil, false, err
	}
	return locker, false, nil
}

func (r *RedisLocker) GetClient() *redis.Client {
	return r.client
}

func Refresh(ctx context.Context, locker *redislock.Lock, ttl time.Duration) error {
	refreshSpanCtx, refreshSpan := tracelog.StartSpan(ctx, "redis", "Refresh")
	defer refreshSpan.End()
	tl := tracelog.NewWithContext(refreshSpanCtx)
	tl.Infow("Refresh", "locker", locker, "ttl", ttl)
	return locker.Refresh(refreshSpanCtx, ttl, nil)
}

func Release(ctx context.Context, locker *redislock.Lock) error {
	releaseSpanCtx, releaseSpan := tracelog.StartSpan(ctx, "redis", "Release")
	defer releaseSpan.End()
	tl := tracelog.NewWithContext(releaseSpanCtx)
	tl.Infow("Release", "locker", locker)
	return locker.Release(releaseSpanCtx)
}

func TTL(ctx context.Context, locker *redislock.Lock) (time.Duration, error) {
	tTLSpanCtx, tTLSpan := tracelog.StartSpan(ctx, "redis", "TTL")
	defer tTLSpan.End()
	tl := tracelog.NewWithContext(tTLSpanCtx)
	tl.Infow("TTL", "locker", locker)
	return locker.TTL(tTLSpanCtx)
}

func (r *RedisLocker) WaitForLock(ctx context.Context, key string, ttl time.Duration) (*redislock.Lock, error) {
	waitForLockSpanCtx, waitForLockSpan := tracelog.StartSpan(ctx, "redis", "WaitForLock")
	defer waitForLockSpan.End()
	tl := tracelog.NewWithContext(waitForLockSpanCtx)
	tl.Infow("WaitForLock", "key", key, "ttl", ttl)
	l, locked, err := r.Lock(waitForLockSpanCtx, key, ttl)
	if err != nil {
		tl.Errorw("WaitForLock failed", "error", err.Error())
		return nil, err
	}
	if locked {
		return nil, errors.New("can't get lock after retry")
	}
	return l, nil
}
