package redis

import (
	"context"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
)

func TestFilterExistingInSet_EmptyMembers(t *testing.T) {
	client = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	defer func() {
		client.Close()
		client = nil
	}()

	result, err := FilterExistingInSet(context.Background(), "test-key")
	assert.NoError(t, err)
	assert.Nil(t, result)
}

func TestFilterExistingInSet_NilClient(t *testing.T) {
	client = nil

	result, err := FilterExistingInSet(context.Background(), "test-key", "member1")
	assert.Error(t, err)
	assert.Nil(t, result)
}

func TestFilterExistingInSet_WithCancelledContext(t *testing.T) {
	client = redis.NewClient(&redis.Options{
		Addr: "invalid:9999",
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	result, err := FilterExistingInSet(ctx, "test-key", "member1")
	assert.Error(t, err)
	assert.Nil(t, result)

	client.Close()
	client = nil
}

func TestFilterExistingInSet_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping integration test")
	}

	client.Del(ctx, "test-set-filter")
	client.SAdd(ctx, "test-set-filter", "exist1", "exist2", "exist3")

	members := []string{"exist1", "not-exist", "exist2", "also-not-exist"}
	result, err := FilterExistingInSet(ctx, "test-set-filter", members...)

	assert.NoError(t, err)
	assert.ElementsMatch(t, []string{"exist1", "exist2"}, result)

	client.Del(ctx, "test-set-filter")
	client.Close()
	client = nil
}

func TestFilterExistingInSet_Integration_AllExist(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping integration test")
	}

	client.Del(ctx, "test-set-all")
	client.SAdd(ctx, "test-set-all", "a", "b", "c")

	result, err := FilterExistingInSet(ctx, "test-set-all", "a", "b", "c")

	assert.NoError(t, err)
	assert.ElementsMatch(t, []string{"a", "b", "c"}, result)

	client.Del(ctx, "test-set-all")
	client.Close()
	client = nil
}

func TestFilterExistingInSet_Integration_NoneExist(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping integration test")
	}

	client.Del(ctx, "test-set-none")
	client.SAdd(ctx, "test-set-none", "a", "b", "c")

	result, err := FilterExistingInSet(ctx, "test-set-none", "x", "y", "z")

	assert.NoError(t, err)
	assert.Empty(t, result)

	client.Del(ctx, "test-set-none")
	client.Close()
	client = nil
}

func TestFilterExistingInSet_Integration_LargeBatch(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping integration test")
	}

	client.Del(ctx, "test-set-large")

	members := make([]string, 50)
	existMembers := make([]interface{}, 10)
	for i := 0; i < 50; i++ {
		members[i] = "member" + string(rune(i))
		if i < 10 {
			existMembers[i] = members[i]
		}
	}

	client.SAdd(ctx, "test-set-large", existMembers...)

	result, err := FilterExistingInSet(ctx, "test-set-large", members...)

	spew.Dump(result)
	assert.NoError(t, err)
	assert.ElementsMatch(t, members[:10], result)

	client.Del(ctx, "test-set-large")
	client.Close()
	client = nil
}
