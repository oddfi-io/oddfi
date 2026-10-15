package redis

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

var redisClient RedisClient

func init() {
	redisClient = NewRedisClient(RedisConfig{
		Host:        "127.0.0.1",
		Port:        "6379",
		Auth:        "",
		MaxIdle:     50,
		MaxActive:   100,
		IdleTimeout: 20,
		DB:          0,
	})
}

func TestRedis(t *testing.T) {
	err := redisClient.SetEx(context.Background(), "key", "value", 1)
	assert.NoError(t, err)
	v, ok, err := redisClient.Get(context.Background(), "key")
	assert.NoError(t, err)
	assert.True(t, ok)
	assert.Equal(t, "value", v)
	time.Sleep(time.Second)
	_, ok, err = redisClient.Get(context.Background(), "key")
	assert.NoError(t, err)
	assert.False(t, ok)
}

type redisData struct {
	Name string `json:"name"`
}

func TestRedisJSON(t *testing.T) {
	originData := redisData{
		Name: "test",
	}
	var targetData redisData
	err := redisClient.SetExJSON(context.Background(), "key", originData, 1)
	assert.NoError(t, err)
	ok, err := redisClient.GetJSON(context.Background(), "key", &targetData)
	assert.NoError(t, err)
	assert.True(t, ok)
	assert.Equal(t, originData, targetData)
	time.Sleep(time.Second)
	ok, err = redisClient.GetJSON(context.Background(), "key", &targetData)
	assert.NoError(t, err)
	assert.False(t, ok)
}

func TestRedisZset(t *testing.T) {
	// test add value
	cnt, err := redisClient.ZAdd(context.Background(), "test_zset", 1, "value1")
	assert.NoError(t, err)
	assert.Equal(t, int64(1), cnt)
	cnt, err = redisClient.ZAdd(context.Background(), "test_zset", 2, "value2")
	assert.NoError(t, err)
	assert.Equal(t, int64(1), cnt)
	cnt, err = redisClient.ZAdd(context.Background(), "test_zset", 3, "value3")
	assert.NoError(t, err)
	assert.Equal(t, int64(1), cnt)

	// test count value
	total, err := redisClient.ZCount(context.Background(), "test_zset", 1, 3)
	assert.NoError(t, err)
	assert.Equal(t, int64(3), total)

	// test remove range
	_, err = redisClient.ZAdd(context.Background(), "test_zset", 10, "value3")
	assert.NoError(t, err)
	_, err = redisClient.ZRemRangeByScore(context.Background(), "test_zset", 1, 3)
	assert.NoError(t, err)
	total, err = redisClient.ZCount(context.Background(), "test_zset", 1, 30)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), total)

	// test set expire
	_, err = redisClient.Expire(context.Background(), "test_zset", 1)
	assert.NoError(t, err)

	// test ttl
	ttl, err := redisClient.TTL(context.Background(), "test_zset")
	assert.NoError(t, err)
	assert.Equal(t, int64(1), ttl)

	// test expire
	time.Sleep(1100 * time.Millisecond)
	total, err = redisClient.ZCount(context.Background(), "test_zset", 1, 30)
	assert.NoError(t, err)
	assert.Equal(t, int64(0), total)
}

func TestSetNxEx(t *testing.T) {
	ok, err := redisClient.SetNxEx(context.Background(), "key", "value", 1)
	assert.NoError(t, err)
	assert.True(t, ok)
	ok, err = redisClient.SetNxEx(context.Background(), "key", "value", 1)
	assert.NoError(t, err)
	assert.False(t, ok)

	time.Sleep(time.Millisecond * 100)
	ok, err = redisClient.SetNxEx(context.Background(), "key", "value", 1)
	assert.NoError(t, err)
	assert.False(t, ok)

	time.Sleep(time.Second)
	ok, err = redisClient.SetNxEx(context.Background(), "key", "value", 1)
	assert.NoError(t, err)
	assert.True(t, ok)
}
