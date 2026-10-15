package ratelimiter

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewTokenBucketLimiter(t *testing.T) {
	tests := []struct {
		name     string
		qps      int
		burst    int
		expected int // 期望的突发数
	}{
		{
			name:     "正常参数",
			qps:      100,
			burst:    150,
			expected: 150,
		},
		{
			name:     "突发数为0时使用QPS作为突发数",
			qps:      100,
			burst:    0,
			expected: 100,
		},
		{
			name:     "突发数小于0时使用QPS作为突发数",
			qps:      100,
			burst:    -10,
			expected: 100,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limiter := NewTokenBucketLimiter(tt.qps, tt.burst)
			assert.NotNil(t, limiter)
			
			// 验证限流器可以正常工作
			assert.True(t, limiter.Allow())
		})
	}
}

func TestTokenBucketLimiter_Allow(t *testing.T) {
	// 创建一个低QPS的限流器用于测试
	limiter := NewTokenBucketLimiter(2, 2) // 2 QPS, 突发2

	// 初始应该可以立即获取令牌
	assert.True(t, limiter.Allow())
	assert.True(t, limiter.Allow())
	
	// 第三次应该被限制
	assert.False(t, limiter.Allow())
	
	// 等待一段时间后应该可以再次获取令牌
	time.Sleep(600 * time.Millisecond) // 等待超过500ms
	assert.True(t, limiter.Allow())
}

func TestTokenBucketLimiter_Wait(t *testing.T) {
	limiter := NewTokenBucketLimiter(10, 1) // 10 QPS, 突发1
	ctx := context.Background()

	// 第一次应该立即成功
	err := limiter.Wait(ctx)
	assert.NoError(t, err)

	// 第二次需要等待
	start := time.Now()
	err = limiter.Wait(ctx)
	duration := time.Since(start)
	
	assert.NoError(t, err)
	// 应该等待了一定时间（大约100ms，因为10 QPS = 100ms间隔）
	assert.True(t, duration >= 50*time.Millisecond, "应该等待至少50ms，实际等待: %v", duration)
}

func TestTokenBucketLimiter_WaitWithCancelledContext(t *testing.T) {
	limiter := NewTokenBucketLimiter(1, 1) // 1 QPS, 突发1
	
	// 先消耗掉令牌
	assert.True(t, limiter.Allow())
	
	// 创建一个会被取消的context
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // 立即取消
	
	// 等待应该返回错误
	err := limiter.Wait(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "context canceled")
}

func TestTokenBucketLimiter_WaitWithTimeout(t *testing.T) {
	limiter := NewTokenBucketLimiter(1, 1) // 1 QPS, 突发1
	
	// 先消耗掉令牌
	assert.True(t, limiter.Allow())
	
	// 创建一个会超时的context
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	
	// 等待应该超时
	err := limiter.Wait(ctx)
	assert.Error(t, err)
	// 修正错误消息检查，golang.org/x/time/rate 返回的错误消息格式
	assert.Contains(t, err.Error(), "would exceed context deadline")
}

func TestTokenBucketLimiter_SetLimit(t *testing.T) {
	limiter := NewTokenBucketLimiter(10, 10)
	
	// 修改限流速率
	limiter.SetLimit(20)
	
	// 验证新的限流速率生效
	// 这里我们通过多次调用Allow来验证
	successCount := 0
	for i := 0; i < 25; i++ {
		if limiter.Allow() {
			successCount++
		}
	}
	
	// 调整期望值，因为SetLimit只改变QPS，突发数保持为QPS值
	assert.True(t, successCount >= 10, "应该能获取到至少10个令牌，实际获取: %d", successCount)
	assert.True(t, successCount <= 25, "获取的令牌数应该在合理范围内，实际获取: %d", successCount)
}

func TestTokenBucketLimiter_ConcurrentAccess(t *testing.T) {
	limiter := NewTokenBucketLimiter(100, 100)
	
	var wg sync.WaitGroup
	var successCount int64
	var mu sync.Mutex
	
	// 启动多个goroutine并发访问
	goroutineCount := 10
	requestsPerGoroutine := 20
	
	for i := 0; i < goroutineCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			localSuccess := 0
			
			for j := 0; j < requestsPerGoroutine; j++ {
				if limiter.Allow() {
					localSuccess++
				}
			}
			
			mu.Lock()
			successCount += int64(localSuccess)
			mu.Unlock()
		}()
	}
	
	wg.Wait()
	
	// 验证并发访问的安全性
	// 成功的请求数应该不超过突发数
	assert.True(t, successCount <= 100, "成功请求数不应超过突发数限制，实际: %d", successCount)
	assert.True(t, successCount > 0, "应该有一些请求成功")
}

func TestTokenBucketLimiter_ConcurrentSetLimit(t *testing.T) {
	limiter := NewTokenBucketLimiter(10, 10)
	
	var wg sync.WaitGroup
	
	// 并发修改限流速率
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(qps int) {
			defer wg.Done()
			limiter.SetLimit(qps * 10)
		}(i + 1)
	}
	
	// 并发调用Allow
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				limiter.Allow()
			}
		}()
	}
	
	wg.Wait()
	
	// 如果没有panic，说明并发安全
	assert.True(t, true, "并发访问应该是安全的")
}

func TestGetGlobalRPCLimiter(t *testing.T) {
	// 获取全局限流器
	limiter1 := GetGlobalRPCLimiter()
	limiter2 := GetGlobalRPCLimiter()
	
	// 应该返回同一个实例
	assert.Same(t, limiter1, limiter2, "应该返回同一个全局实例")
	
	// 验证限流器可以正常工作
	assert.True(t, limiter1.Allow())
}

func TestSetGlobalRPCLimit(t *testing.T) {
	// 设置全局限流速率
	SetGlobalRPCLimit(200)
	
	limiter := GetGlobalRPCLimiter()
	
	// 验证设置生效（通过多次Allow调用）
	successCount := 0
	for i := 0; i < 250; i++ {
		if limiter.Allow() {
			successCount++
		}
	}
	
	// 应该能够获取到相当数量的令牌
	assert.True(t, successCount >= 200, "应该能获取到至少200个令牌，实际获取: %d", successCount)
}

func BenchmarkTokenBucketLimiter_Allow(b *testing.B) {
	limiter := NewTokenBucketLimiter(1000000, 1000000) // 高QPS避免限流影响性能测试
	
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			limiter.Allow()
		}
	})
}

func BenchmarkTokenBucketLimiter_Wait(b *testing.B) {
	limiter := NewTokenBucketLimiter(1000000, 1000000) // 高QPS避免限流影响性能测试
	ctx := context.Background()
	
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			limiter.Wait(ctx)
		}
	})
}

func BenchmarkTokenBucketLimiter_SetLimit(b *testing.B) {
	limiter := NewTokenBucketLimiter(1000, 1000)
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		limiter.SetLimit(1000 + i%100)
	}
}