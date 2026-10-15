package redis

import (
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/utils"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/gomodule/redigo/redis"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	RequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "redis",
		Name:      "request_duration",
		Help:      "Request duration",
	}, []string{
		"method",
	})
)

type RedisConfig struct {
	Host        string `mapstructure:"host"`
	Port        string `mapstructure:"port"`
	Auth        string `mapstructure:"auth"`
	MaxIdle     int    `mapstructure:"max_idle"`
	MaxActive   int    `mapstructure:"max_active"`
	IdleTimeout int    `mapstructure:"idle_timeout"`
	DB          int    `mapstructure:"db"`
}

type RedisClient interface {
	Pool(ctx context.Context) *redis.Pool
	SetEx(ctx context.Context, key string, value string, seconds int64) error
	SetNxEx(ctx context.Context, key string, value string, seconds int64) (bool, error)
	Get(ctx context.Context, key string) (string, bool, error)
	SetExJSON(ctx context.Context, key string, value any, seconds int64) error
	GetJSON(ctx context.Context, key string, value any) (bool, error)
	TTL(ctx context.Context, key string) (int64, error)
	Expire(ctx context.Context, key string, expire int64) (int64, error)
	ZAdd(ctx context.Context, key string, data ...any) (int64, error)
	ZCount(ctx context.Context, key string, min float64, max float64) (int64, error)
	ZRemRangeByScore(ctx context.Context, key string, min float64, max float64) (int64, error)
}

func NewRedisClient(redisConfig RedisConfig) RedisClient {
	return &redisClientImpl{
		redisPool: &redis.Pool{
			MaxIdle:     redisConfig.MaxIdle,
			MaxActive:   redisConfig.MaxActive,
			IdleTimeout: time.Duration(redisConfig.IdleTimeout) * time.Second,
			Dial: func() (redis.Conn, error) {
				c, err := redis.Dial("tcp", fmt.Sprintf("%s:%s", redisConfig.Host, redisConfig.Port))
				if err != nil {
					return nil, err
				}
				if redisConfig.Auth != "" {
					if _, err := c.Do("AUTH", redisConfig.Auth); err != nil {
						c.Close()
						return nil, err
					}
				}
				return c, err
			},
		},
	}
}

type redisClientImpl struct {
	redisPool *redis.Pool
}

func (r *redisClientImpl) Pool(ctx context.Context) *redis.Pool {
	return r.redisPool
}

func (r *redisClientImpl) SetEx(ctx context.Context, key string, value string, seconds int64) error {

	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("SetEx").Observe(time.Since(now).Seconds())
	}()

	conn := r.redisPool.Get()
	defer conn.Close()
	_, err := conn.Do("SETEX", key, seconds, value)
	return err
}

func (r *redisClientImpl) SetNxEx(ctx context.Context, key string, value string, seconds int64) (bool, error) {
	setNxExSpanCtx, setNxExSpan := tracelog.StartSpan(ctx, "redis", "SetNxEx")
	defer setNxExSpan.End()
	tl := tracelog.NewWithContext(setNxExSpanCtx)
	tl.Infow("SetNxEx", "key", key, "value", value, "seconds", seconds)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("SetNxEx").Observe(time.Since(now).Seconds())
	}()

	conn := r.redisPool.Get()
	defer conn.Close()
	result, err := redis.String(conn.Do("SET", key, value, "NX", "EX", seconds))
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return false, nil
		}
		return false, err
	}
	return result == "OK", err
}

func (r *redisClientImpl) Get(ctx context.Context, key string) (string, bool, error) {
	getSpanCtx, getSpan := tracelog.StartSpan(ctx, "redis", "Get")
	defer getSpan.End()
	tl := tracelog.NewWithContext(getSpanCtx)
	tl.Infow("Get", "key", key)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("Get").Observe(time.Since(now).Seconds())
	}()

	conn := r.redisPool.Get()
	defer conn.Close()
	reply, err := conn.Do("GET", key)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return "", false, nil
		}
		return "", false, err
	}
	ret, err := redis.String(reply, err)
	if errors.Is(err, redis.ErrNil) {
		return "", false, nil
	}
	return ret, err == nil, err
}

func (r *redisClientImpl) SetExJSON(ctx context.Context, key string, value any, seconds int64) error {
	setExJSONSpanCtx, setExJSONSpan := tracelog.StartSpan(ctx, "redis", "SetExJSON")
	defer setExJSONSpan.End()
	tl := tracelog.NewWithContext(setExJSONSpanCtx)
	tl.Infow("SetExJSON", "key", key, "value", value, "seconds", seconds)
	valueStr, _ := utils.JsonEncode(value)
	return r.SetEx(ctx, key, valueStr, seconds)
}

func (r *redisClientImpl) GetJSON(ctx context.Context, key string, value any) (bool, error) {
	getJSONSpanCtx, getJSONSpan := tracelog.StartSpan(ctx, "redis", "GetJSON")
	defer getJSONSpan.End()
	tl := tracelog.NewWithContext(getJSONSpanCtx)
	tl.Infow("GetJSON", "key", key)
	valueStr, ok, err := r.Get(ctx, key)
	if err != nil {
		return ok, err
	} else if !ok {
		return ok, nil
	}
	err = utils.JsonDecode([]byte(valueStr), value)
	return ok, err
}

func (r *redisClientImpl) TTL(ctx context.Context, key string) (int64, error) {
	TTLSpanCtx, TTLSpan := tracelog.StartSpan(ctx, "redis", "TTL")
	defer TTLSpan.End()
	tl := tracelog.NewWithContext(TTLSpanCtx)
	tl.Infow("TTL", "key", key)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("TTL").Observe(time.Since(now).Seconds())
	}()

	conn := r.redisPool.Get()
	defer conn.Close()
	reply, err := conn.Do("TTL", key)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return 0, nil
		}
		return 0, err
	}
	ret, err := redis.Int64(reply, err)
	if errors.Is(err, redis.ErrNil) {
		return 0, nil
	}
	return ret, err
}

func (r *redisClientImpl) Expire(ctx context.Context, key string, expire int64) (int64, error) {
	expireSpanCtx, expireSpan := tracelog.StartSpan(ctx, "redis", "Expire")
	defer expireSpan.End()
	tl := tracelog.NewWithContext(expireSpanCtx)
	tl.Infow("Expire", "key", key, "expire", expire)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("Expire").Observe(time.Since(now).Seconds())
	}()

	conn := r.redisPool.Get()
	defer conn.Close()
	reply, err := conn.Do("EXPIRE", key, expire)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return 0, nil
		}
		return 0, err
	}
	ret, err := redis.Int64(reply, err)
	if errors.Is(err, redis.ErrNil) {
		return 0, nil
	}
	return ret, err
}

func (r *redisClientImpl) ZAdd(ctx context.Context, key string, data ...any) (int64, error) {
	zAddSpanCtx, zAddSpan := tracelog.StartSpan(ctx, "redis", "ZAdd")
	defer zAddSpan.End()
	tl := tracelog.NewWithContext(zAddSpanCtx)
	tl.Infow("ZAdd", "key", key, "data", data)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("ZAdd").Observe(time.Since(now).Seconds())
	}()

	conn := r.redisPool.Get()
	defer conn.Close()
	reply, err := conn.Do("ZADD", append([]any{key}, data...)...)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return 0, nil
		}
		return 0, err
	}
	ret, err := redis.Int64(reply, err)
	if errors.Is(err, redis.ErrNil) {
		return 0, nil
	}
	return ret, err
}

func (r *redisClientImpl) ZCount(ctx context.Context, key string, min float64, max float64) (int64, error) {
	zCountSpanCtx, zCountSpan := tracelog.StartSpan(ctx, "redis", "ZCount")
	defer zCountSpan.End()
	tl := tracelog.NewWithContext(zCountSpanCtx)
	tl.Infow("ZCount", "key", key, "min", min, "max", max)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("ZCount").Observe(time.Since(now).Seconds())
	}()

	conn := r.redisPool.Get()
	defer conn.Close()
	reply, err := conn.Do("ZCOUNT", key, min, max)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return 0, nil
		}
		return 0, err
	}
	ret, err := redis.Int64(reply, err)
	if errors.Is(err, redis.ErrNil) {
		return 0, nil
	}
	return ret, err
}

func (r *redisClientImpl) ZRemRangeByScore(ctx context.Context, key string, min float64, max float64) (int64, error) {
	zRemRangeByScoreSpanCtx, zRemRangeByScoreSpan := tracelog.StartSpan(ctx, "redis", "ZRemRangeByScore")
	defer zRemRangeByScoreSpan.End()
	tl := tracelog.NewWithContext(zRemRangeByScoreSpanCtx)
	tl.Infow("ZRemRangeByScore", "key", key, "min", min, "max", max)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("ZRemRangeByScore").Observe(time.Since(now).Seconds())
	}()

	conn := r.redisPool.Get()
	defer conn.Close()
	reply, err := conn.Do("ZREMRANGEBYSCORE", key, min, max)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return 0, nil
		}
		return 0, err
	}
	ret, err := redis.Int64(reply, err)
	if errors.Is(err, redis.ErrNil) {
		return 0, nil
	}
	return ret, err
}
