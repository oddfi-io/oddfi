package localcache

import (
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/spf13/cast"
	"github.com/stretchr/testify/assert"
)

func Test_cache_Get(t *testing.T) {

	c := GetLocalCache()

	type Value struct {
		Name string
		Age  int
	}
	origin := &Value{
		Name: "test",
		Age:  10,
	}
	c.Set("test", origin, 10*time.Second)

	cacheInterface, exist := c.Get("test")
	cacheVal := cacheInterface.(*Value)

	assert.True(t, exist)
	assert.Equal(t, origin.Name, cacheVal.Name)
	assert.Equal(t, origin.Age, cacheVal.Age)

	c.Set("test2", *origin, 10*time.Second)

	cacheInterface, exist = c.Get("test2")
	cacheObj := cacheInterface.(Value)

	assert.True(t, exist)
	assert.Equal(t, origin.Name, cacheObj.Name)
	assert.Equal(t, origin.Age, cacheObj.Age)
}

func TestAsyncInitCache(t *testing.T) {
	cache := GetLocalCache()
	key := "test_key"
	value := "test_value"

	t.Run("test cache miss and set", func(t *testing.T) {
		// 测试缓存未命中时的初始化
		result, err := cache.AsyncInitCache(LocalCacheKey(key), func() (interface{}, error) {
			return value, nil
		}, 5*time.Minute)

		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}

		if result != value {
			t.Errorf("expected %v, got %v", value, result)
		}

		// 验证缓存是否设置成功
		if v, ok := cache.Get(key); !ok || v != value {
			t.Errorf("cache not set correctly, got %v, want %v", v, value)
		}
	})

	t.Run("test cache hit", func(t *testing.T) {
		// 测试缓存命中
		called := false
		result, err := cache.AsyncInitCache(LocalCacheKey(key), func() (interface{}, error) {
			called = true
			return "new_value", nil
		}, 5*time.Minute)

		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}

		if result != value {
			t.Errorf("expected cached value %v, got %v", value, result)
		}

		if called {
			t.Error("initialization function should not be called when cache hit")
		}
	})

	t.Run("test error handling", func(t *testing.T) {
		// 测试错误处理
		expectedErr := errors.New("test error")
		result, err := cache.AsyncInitCache(LocalCacheKey("error_key"), func() (interface{}, error) {
			return "", expectedErr
		}, 5*time.Minute)

		if err != expectedErr {
			t.Errorf("expected error %v, got %v", expectedErr, err)
		}

		fmt.Println("FUCK", cast.ToString(result))

		if result != nil {
			t.Errorf("expected nil result, got %v", result)
		}
	})

	t.Run("test concurrent access", func(t *testing.T) {
		// 测试并发访问
		const numGoroutines = 10
		var wg sync.WaitGroup
		counter := 0
		concurrentKey := "concurrent_key"

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				result, err := cache.AsyncInitCache(LocalCacheKey(concurrentKey), func() (interface{}, error) {
					counter++
					time.Sleep(100 * time.Millisecond) // 模拟耗时操作
					return "concurrent_value", nil
				}, 5*time.Minute)

				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}

				if result != "concurrent_value" {
					t.Errorf("expected concurrent_value, got %v", result)
				}
			}()
		}

		wg.Wait()

		// 验证初始化函数只被调用一次
		if counter != 1 {
			t.Errorf("initialization function called %d times, expected 1", counter)
		}
	})

	t.Run("test cache expiration", func(t *testing.T) {
		// 测试缓存过期
		expiringKey := "expiring_key"
		initialValue := "initial_value"

		// 设置初始值
		cache.Set(expiringKey, initialValue, 100*time.Millisecond)

		// 等待缓存过期
		time.Sleep(200 * time.Millisecond)

		// 尝试获取过期缓存
		called := false
		result, err := cache.AsyncInitCache(LocalCacheKey(expiringKey), func() (interface{}, error) {
			called = true
			return "new_value", nil
		}, 5*time.Minute)

		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}

		if !called {
			t.Error("initialization function should be called when cache expired")
		}

		if result != "new_value" {
			t.Errorf("expected new_value, got %v", result)
		}
	})
}
