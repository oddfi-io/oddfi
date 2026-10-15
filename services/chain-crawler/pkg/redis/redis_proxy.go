package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/avast/retry-go/v4"

	"chain_crawler/pkg/tracelog"

	"github.com/gomodule/redigo/redis"
	"github.com/spf13/cast"
)

type redisCmd string

const (
	HGet             redisCmd = "HGET"
	HSet             redisCmd = "HSET"
	Expire           redisCmd = "EXPIRE"
	SAdd             redisCmd = "SADD"
	ZRemRangeByScore redisCmd = "ZREMRANGEBYSCORE"
	SPop             redisCmd = "SPOP"
	ZAdd             redisCmd = "ZADD"
	ZRangeByScore    redisCmd = "ZRANGEBYSCORE"
	ZRevRangeByScore redisCmd = "ZREVRANGEBYSCORE"
	Set              redisCmd = "SET"
	Get              redisCmd = "GET"
	SCard            redisCmd = "SCARD"
	Eval             redisCmd = "EVAL"
	HKeys            redisCmd = "HKEYS"
	HLen             redisCmd = "HLEN"
	HDel             redisCmd = "HDEL"
	HScan            redisCmd = "HSCAN"
)

type PipeLineCmd struct {
	Cmd        redisCmd
	Args       []interface{}
	ExpireTime time.Duration
	reply      func(interface{}) error
}

type redisExecutor[T []string | int | float64 | string | []byte | []interface{}] struct {
	redisPool *redis.Pool
	reply     func(interface{}, error) (T, error)
}

func newRedisExecutor[T []string | int | float64 | string | []byte | []interface{}](rdsPool *redis.Pool, reply func(interface{}, error) (T, error)) *redisExecutor[T] {
	return &redisExecutor[T]{
		redisPool: rdsPool,
		reply:     reply,
	}
}

func (r *redisExecutor[T]) runCmd(_ context.Context, commandName redisCmd, args ...interface{}) (T, error) {
	conn := r.redisPool.Get()
	defer conn.Close()

	var reply interface{}
	var err error

	_ = retry.Do(func() error {
		reply, err = conn.Do(string(commandName), args...)

		if errors.Is(err, redis.ErrNil) {
			return nil
		}
		return err
	}, retry.Attempts(2))

	if err != nil && !errors.Is(err, redis.ErrNil) {
		// logger.Error(ctx, logger.LogIndexRedis, "run cmd error", zap.Error(err)) 这里日志应该由proxy暴露出
		var v T
		return v, err
	}

	result, err := r.reply(reply, err)
	if err != nil {
		// logger.Error(ctx, logger.LogIndexRedis, "run cmd error", zap.Error(err)) 同上
		return result, err
	}

	return result, nil
}

func (r *redisExecutor[T]) pipeLine(ctx context.Context, cmds []PipeLineCmd) ([]interface{}, error) {
	pipeLineSpanCtx, pipeLineSpan := tracelog.StartSpan(ctx, "redis", "PipeLine")
	defer pipeLineSpan.End()
	tl := tracelog.NewWithContext(pipeLineSpanCtx)
	tl.Infow("PipeLine", "cmds", cmds)
	conn := r.redisPool.Get()
	defer conn.Close()

	conn.Send("MULTI")
	for _, cmd := range cmds {
		err := conn.Send(string(cmd.Cmd), cmd.Args...)
		if err != nil {
			return nil, err
		}
		if cmd.ExpireTime > time.Second {
			err = conn.Send(string(Expire), cmd.Args[0], int(cmd.ExpireTime/time.Second))
			if err != nil {
				return nil, err
			}
		}
	}
	replies, err := redis.Values(conn.Do("EXEC"))
	if err != nil {
		tl.Errorw("run cmd error", "error", err.Error())
		return nil, err
	}

	expCount := 0
	for i, cmd := range cmds {
		if cmd.reply != nil {
			err = cmd.reply(replies[i+expCount])
			if err != nil {
				return nil, err
			}
		}
		if cmd.ExpireTime > time.Second {
			expCount++
		}
	}
	return replies, nil
}

type RedisProxy struct {
	redisPool *redis.Pool
}

func NewRedisProxy(redisPool *redis.Pool) *RedisProxy {
	return &RedisProxy{
		redisPool: redisPool,
	}
}

func (r *RedisProxy) HSetEx(ctx context.Context, key string, fields map[string]interface{}, expireTime time.Duration) error {
	hSetExSpanCtx, hSetExSpan := tracelog.StartSpan(ctx, "redis", "HSetEx")
	defer hSetExSpan.End()
	tl := tracelog.NewWithContext(hSetExSpanCtx)
	tl.Infow("HSetEx", "key", key, "fields", fields, "expireTime", expireTime)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("HSetEx").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[int](r.redisPool, redis.Int)
	// 构建参数
	args := make([]interface{}, 0)
	args = append(args, key)
	for k, v := range fields {
		args = append(args, k, v)
	}
	// 执行命令
	_, err := executor.runCmd(hSetExSpanCtx, HSet, args...)
	if err != nil {
		tl.Errorw("run cmd error", "error", err.Error())
		return err
	}

	if expireTime > time.Second {
		// 设置过期时间
		_, err = executor.runCmd(hSetExSpanCtx, Expire, key, int(expireTime/time.Second))
	}
	return err
}

func (r *RedisProxy) HGet(ctx context.Context, key string, field string, receiver func([]byte) error) ([]byte, error) {
	hGetSpanCtx, hGetSpan := tracelog.StartSpan(ctx, "redis", "HGet")
	defer hGetSpan.End()
	tl := tracelog.NewWithContext(hGetSpanCtx)
	tl.Infow("HGet", "key", key, "field", field)
	executor := newRedisExecutor[[]byte](r.redisPool, redis.Bytes)
	bs, err := executor.runCmd(hGetSpanCtx, HGet, key, field)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return nil, nil
		}
		return nil, err
	}
	if receiver != nil {
		return bs, receiver(bs)
	}
	return bs, nil
}

func (r *RedisProxy) HLen(ctx context.Context, key string) (int, error) {
	hLenSpanCtx, hLenSpan := tracelog.StartSpan(ctx, "redis", "HLen")
	defer hLenSpan.End()
	tl := tracelog.NewWithContext(hLenSpanCtx)
	tl.Infow("HLen", "key", key)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("HLen").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[int](r.redisPool, redis.Int)
	bs, err := executor.runCmd(hLenSpanCtx, HLen, key)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return 0, nil
		}
		return 0, err
	}

	return bs, nil
}

func (r *RedisProxy) HDel(ctx context.Context, key string, fields ...string) (int, error) {
	hDelSpanCtx, hDelSpan := tracelog.StartSpan(ctx, "redis", "HDel")
	defer hDelSpan.End()
	tl := tracelog.NewWithContext(hDelSpanCtx)
	tl.Infow("HDel", "key", key, "fields", fields)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("HDel").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[int](r.redisPool, redis.Int)
	args := make([]interface{}, 0)
	args = append(args, key)
	for k, v := range fields {
		args = append(args, k, v)
	}
	bs, err := executor.runCmd(hDelSpanCtx, HDel, args...)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return 0, nil
		}
		return 0, err
	}

	return bs, nil
}

func (r *RedisProxy) HScan(ctx context.Context, key string, cursor int64) (int64, map[string]string, error) {
	hScanSpanCtx, hScanSpan := tracelog.StartSpan(ctx, "redis", "HScan")
	defer hScanSpan.End()
	tl := tracelog.NewWithContext(hScanSpanCtx)
	tl.Infow("HScan", "key", key, "cursor", cursor)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("HScan").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[[]interface{}](r.redisPool, redis.Values)
	results, err := executor.runCmd(hScanSpanCtx, HScan, key, cursor)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return 0, nil, nil
		}
		return 0, nil, err
	}

	if len(results) < 2 { // 如果为空, 会额外返回一个 err
		return 0, nil, errors.New("invalid response")
	}
	getValue := func(v interface{}) (string, error) {
		bs, ok := v.([]uint8)
		if !ok {
			return "", errors.New("invalid response")
		}

		return string(bs), nil
	}
	nextCursorBS, err := getValue(results[0])
	if err != nil {
		return 0, nil, err
	}
	nextCursor, err := strconv.Atoi(string(nextCursorBS))
	if err != nil {
		return 0, nil, err
	}

	values, ok := results[1].([]interface{})
	if !ok {
		return 0, nil, errors.New("invalid response")
	}

	resultsMap := make(map[string]string)
	for i := 0; i < len(values)-1; i += 2 {
		hashKey, err := getValue(values[i])
		if err != nil {
			return 0, nil, err
		}
		hashValue, err := getValue(values[i+1])
		if err != nil {
			return 0, nil, err
		}
		resultsMap[hashKey] = hashValue
	}

	return int64(nextCursor), resultsMap, err
}

func (r *RedisProxy) HKeys(ctx context.Context, key string) ([]string, error) {
	hKeysSpanCtx, hKeysSpan := tracelog.StartSpan(ctx, "redis", "HKeys")
	defer hKeysSpan.End()
	tl := tracelog.NewWithContext(hKeysSpanCtx)
	tl.Infow("HKeys", "key", key)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("HKeys").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[[]string](r.redisPool, redis.Strings)
	bs, err := executor.runCmd(hKeysSpanCtx, HKeys, key)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return nil, nil
		}
		return nil, err
	}
	return bs, nil
}

func (r *RedisProxy) SAdd(ctx context.Context, key string, value []string, expireTime time.Duration) error {
	sAddSpanCtx, sAddSpan := tracelog.StartSpan(ctx, "redis", "SAdd")
	defer sAddSpan.End()
	tl := tracelog.NewWithContext(sAddSpanCtx)
	tl.Infow("SAdd", "key", key, "value", value, "expireTime", expireTime)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("SAdd").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[int](r.redisPool, redis.Int)
	args := make([]interface{}, len(value)+1)
	args[0] = key
	for i, v := range value {
		args[i+1] = v
	}
	_, err := executor.runCmd(sAddSpanCtx, SAdd, args...)
	if err != nil {
		tl.Errorw("run cmd error", "error", err.Error())
		return err
	}

	if expireTime > time.Second {
		_, _ = executor.runCmd(sAddSpanCtx, Expire, key, int(expireTime/time.Second))
	}
	return nil
}

func (r *RedisProxy) SPop(ctx context.Context, key string, count int, receiver func([]interface{}) error) ([]string, error) {
	spopSpanCtx, spopSpan := tracelog.StartSpan(ctx, "redis", "SPop")
	defer spopSpan.End()
	tl := tracelog.NewWithContext(spopSpanCtx)
	tl.Infow("SPop", "key", key, "count", count)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("SPop").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[[]interface{}](r.redisPool, redis.Values)
	if count == 0 {
		count = 1
	}

	values, err := executor.runCmd(spopSpanCtx, SPop, key, count)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return nil, nil
		}
		return nil, err
	}
	result := make([]string, 0)

	for _, value := range values {
		result = append(result, cast.ToString(value))
	}

	if receiver != nil {
		return result, receiver(values)
	}
	return result, nil
}

func (r *RedisProxy) SCard(ctx context.Context, key string) (int, error) {
	scardSpanCtx, scardSpan := tracelog.StartSpan(ctx, "redis", "SCard")
	defer scardSpan.End()
	tl := tracelog.NewWithContext(scardSpanCtx)
	tl.Infow("SCard", "key", key)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("SCard").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[int](r.redisPool, redis.Int)
	count, err := executor.runCmd(scardSpanCtx, SCard, key)
	if err != nil {
		tl.Errorw("run cmd error", "error", err.Error())
		return 0, err
	}
	return count, nil
}

func (r *RedisProxy) ZAdd(ctx context.Context, key string, value map[int]string, expireTime time.Duration) error {
	zAddSpanCtx, zAddSpan := tracelog.StartSpan(ctx, "redis", "ZAdd")
	defer zAddSpan.End()
	tl := tracelog.NewWithContext(zAddSpanCtx)
	tl.Infow("ZAdd", "key", key, "value", value, "expireTime", expireTime)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("ZAdd").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[int](r.redisPool, redis.Int)
	args := []interface{}{key}
	for i, v := range value {
		args = append(args, i, v)
	}
	_, err := executor.runCmd(zAddSpanCtx, ZAdd, args...)
	if err != nil {
		tl.Errorw("run cmd error", "error", err.Error())
		return err
	}

	if expireTime > time.Second {
		_, _ = executor.runCmd(zAddSpanCtx, Expire, key, int(expireTime/time.Second))
	}
	return nil
}

func (r *RedisProxy) ZRemRangeByScore(ctx context.Context, key string, min, max int64) error {
	zRemRangeByScoreSpanCtx, zRemRangeByScoreSpan := tracelog.StartSpan(ctx, "redis", "ZRemRangeByScore")
	defer zRemRangeByScoreSpan.End()
	tl := tracelog.NewWithContext(zRemRangeByScoreSpanCtx)
	tl.Infow("ZRemRangeByScore", "key", key, "min", min, "max", max)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("ZRemRangeByScore").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[int](r.redisPool, redis.Int)
	args := []interface{}{key}
	if min == -1 {
		args = append(args, "-inf")
	} else {
		args = append(args, min)
	}

	if max == -1 {
		args = append(args, "+inf")
	} else {
		args = append(args, max)
	}

	_, err := executor.runCmd(zRemRangeByScoreSpanCtx, ZRemRangeByScore, args...)
	if err != nil {
		tl.Errorw("run cmd error", "error", err.Error())
		return err
	}
	return nil
}

func (r *RedisProxy) ZRevRangeByScore(ctx context.Context, key string, max, min, limit, offset int64, withscore bool, receiver func([]string) error) ([]string, error) {
	zRevRangeByScoreSpanCtx, zRevRangeByScoreSpan := tracelog.StartSpan(ctx, "redis", "ZRevRangeByScore")
	defer zRevRangeByScoreSpan.End()
	tl := tracelog.NewWithContext(zRevRangeByScoreSpanCtx)
	tl.Infow("ZRevRangeByScore", "key", key, "max", max, "min", min, "limit", limit, "offset", offset, "withscore", withscore)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("ZRevRangeByScore").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[[]string](r.redisPool, redis.Strings)
	args := []interface{}{key}
	if max < 0 {
		args = append(args, "+inf")
	} else {
		args = append(args, max)
	}

	if min < 0 {
		args = append(args, "-inf")
	} else {
		args = append(args, min)
	}

	if withscore {
		args = append(args, "WITHSCORES")
	}

	if limit > 0 || offset > 0 {
		args = append(args, "LIMIT", offset, limit)
	}

	reply, err := executor.runCmd(zRevRangeByScoreSpanCtx, ZRevRangeByScore, args...)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return nil, nil
		}
		return nil, err
	}

	if receiver != nil {
		err = receiver(reply)
		if err != nil {
			return nil, err
		}
	}
	return reply, nil
}

func (r *RedisProxy) ZRangeByScore(ctx context.Context, key string, min, max int64, withscore bool, receiver func([]string) error) ([]string, error) {
	zRangeByScoreSpanCtx, zRangeByScoreSpan := tracelog.StartSpan(ctx, "redis", "ZRangeByScore")
	defer zRangeByScoreSpan.End()
	tl := tracelog.NewWithContext(zRangeByScoreSpanCtx)
	tl.Infow("ZRangeByScore", "key", key, "min", min, "max", max, "withscore", withscore)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("ZRangeByScore").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[[]string](r.redisPool, redis.Strings)
	args := []interface{}{key, min, max}
	if withscore {
		args = append(args, "WITHSCORES")
	}
	reply, err := executor.runCmd(zRangeByScoreSpanCtx, ZRangeByScore, args...)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return nil, nil
		}
		return nil, err
	}

	if receiver != nil {
		err = receiver(reply)
		if err != nil {
			return nil, err
		}
	}
	return reply, nil
}

func (r *RedisProxy) Get(ctx context.Context, key string) (string, error) {
	getSpanCtx, getSpan := tracelog.StartSpan(ctx, "redis", "Get")
	defer getSpan.End()
	tl := tracelog.NewWithContext(getSpanCtx)
	tl.Infow("Get", "key", key)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("Get").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[string](r.redisPool, redis.String)
	reply, err := executor.runCmd(getSpanCtx, Get, key)
	if err != nil {
		if errors.Is(err, redis.ErrNil) {
			return "", nil
		}
		tl.Errorw("run cmd error", "error", err.Error())
		return "", err
	}
	return reply, nil
}

func (r *RedisProxy) Set(ctx context.Context, key string, value string, expireTime time.Duration) error {
	setSpanCtx, setSpan := tracelog.StartSpan(ctx, "redis", "Set")
	defer setSpan.End()
	tl := tracelog.NewWithContext(setSpanCtx)
	tl.Infow("Set", "key", key, "value", value, "expireTime", expireTime)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("Set").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[string](r.redisPool, redis.String)
	//args := make([]interface{}, len(value)+1)
	//args[0] = key
	//for i, v := range value {
	//	args[i+1] = v
	//}
	_, err := executor.runCmd(setSpanCtx, Set, key, value)
	if err != nil {
		tl.Errorw("run cmd error", "error", err.Error())
		return err
	}

	if expireTime > time.Second {
		_, _ = executor.runCmd(setSpanCtx, Expire, key, int(expireTime/time.Second))
	}
	return nil
}

func (r *RedisProxy) Pipeline(ctx context.Context, cmds []PipeLineCmd) (interface{}, error) {
	pipelineSpanCtx, pipelineSpan := tracelog.StartSpan(ctx, "redis", "Pipeline")
	defer pipelineSpan.End()
	tl := tracelog.NewWithContext(pipelineSpanCtx)
	tl.Infow("Pipeline", "cmds", cmds)
	t := time.Now()
	executor := newRedisExecutor[[]byte](r.redisPool, redis.Bytes)
	v, err := executor.pipeLine(pipelineSpanCtx, cmds)
	if err != nil {
		tl.Errorw("pipeline run cmd error", "error", err.Error())
		return nil, err
	}
	bs, err := json.Marshal(cmds)
	if err != nil {
		return nil, err
	}
	fmt.Println("FUCK PIPELINE", time.Since(t), string(bs))
	return v, nil
}

func (r *RedisProxy) Eval(ctx context.Context, script string, keys []interface{}, scriptArgs []interface{}, receiver func(interface{}) (string, error)) error {
	evalSpanCtx, evalSpan := tracelog.StartSpan(ctx, "redis", "Eval")
	defer evalSpan.End()
	tl := tracelog.NewWithContext(evalSpanCtx)
	tl.Infow("Eval", "script", script, "keys", keys, "scriptArgs", scriptArgs)
	// metrics
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("Eval").Observe(time.Since(now).Seconds())
	}()

	executor := newRedisExecutor[string](r.redisPool, func(i interface{}, err error) (string, error) {
		if receiver != nil {
			return receiver(i)
		}
		return cast.ToString(i), nil
	})
	args := make([]interface{}, 0)
	args = append(args, script, len(keys))
	args = append(args, keys...)
	args = append(args, scriptArgs...)

	_, err := executor.runCmd(evalSpanCtx, Eval, args...)
	if err != nil {
		tl.Errorw("run cmd error", "error", err.Error())
		return err
	}
	return nil
}
