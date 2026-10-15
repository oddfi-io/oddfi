package ratelimiter

import (
	"context"
	"sync"

	"golang.org/x/time/rate"
)

// RateLimiter 接口定义
type RateLimiter interface {
	// Wait 等待直到可以执行请求，如果 context 被取消则返回错误
	Wait(ctx context.Context) error
	// Allow 检查是否可以立即执行请求
	Allow() bool
	// SetLimit 动态调整限流速率
	SetLimit(qps int)
}

// tokenBucketLimiter 基于令牌桶算法的限流器
type tokenBucketLimiter struct {
	limiter *rate.Limiter
}

// NewTokenBucketLimiter 创建新的令牌桶限流器
// qps: 每秒允许的请求数
// burst: 突发请求数，通常设置为 qps 的 1-2 倍
func NewTokenBucketLimiter(qps int, burst int) RateLimiter {
	if burst <= 0 {
		burst = qps // 默认突发数等于 QPS
	}
	return &tokenBucketLimiter{
		limiter: rate.NewLimiter(rate.Limit(qps), burst),
	}
}

func (r *tokenBucketLimiter) Wait(ctx context.Context) error {
	limiter := r.limiter
	return limiter.Wait(ctx)
}

func (r *tokenBucketLimiter) Allow() bool {
	limiter := r.limiter

	return limiter.Allow()
}

func (r *tokenBucketLimiter) SetLimit(qps int) {

	// 保持原有的突发数设置
	burst := r.limiter.Burst()
	if qps > burst {
		burst = qps
	}
	r.limiter.SetLimit(rate.Limit(qps))
	r.limiter.SetBurst(burst)
}

// GlobalRateLimiter 全局限流器实例
var (
	globalRPCLimiter RateLimiter
	once             sync.Once
)

// GetGlobalRPCLimiter 获取全局 RPC 限流器
func GetGlobalRPCLimiter() RateLimiter {
	once.Do(func() {
		// 默认 500 QPS，突发 600
		globalRPCLimiter = NewTokenBucketLimiter(500, 600)
	})
	return globalRPCLimiter
}

// SetGlobalRPCLimit 设置全局 RPC 限流速率
func SetGlobalRPCLimit(qps int) {
	limiter := GetGlobalRPCLimiter()
	limiter.SetLimit(qps)
}
