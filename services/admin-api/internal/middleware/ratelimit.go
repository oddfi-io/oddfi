package middleware

import (
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// rlEntry 是 sync.Map 中的 value。
// lastSeen 用 atomic 避免对 limiter 加锁；gcLoop 据此回收闲置 entry。
type rlEntry struct {
	lim      *rate.Limiter
	lastSeen atomic.Int64 // unix nano
}

// RateLimiter 是 (group, IP) → *rate.Limiter 的进程级容器。
//
// 设计取舍：
//   - sync.Map + lastSeen 周期 GC，避免攻击者用随机 IP（如伪造 XFF、IPv6 子网）刷爆内存
//   - 单进程内存方案：多实例部署时各机器各算各的；如需全局精确限流，后续走 Redis token bucket
//   - GC goroutine 是进程级单例，整个程序生命周期常驻；测试场景泄漏可忽略
type RateLimiter struct {
	limiters      sync.Map
	defaultPerMin int
	idleCutoff    time.Duration
	stopCh        chan struct{}
	stopOnce      sync.Once
}

// NewRateLimiter 构造容器并启动后台 GC（5min 周期，30min 闲置回收）。
// perMin <= 0 时用 60。
func NewRateLimiter(perMin int) *RateLimiter {
	if perMin <= 0 {
		perMin = 60
	}
	rl := &RateLimiter{
		defaultPerMin: perMin,
		idleCutoff:    30 * time.Minute,
		stopCh:        make(chan struct{}),
	}
	go rl.gcLoop()
	return rl
}

// Stop 用于优雅退出（可选）；不调用也不会泄漏关键资源（进程退出即清理）。
func (r *RateLimiter) Stop() {
	r.stopOnce.Do(func() { close(r.stopCh) })
}

func (r *RateLimiter) gcLoop() {
	t := time.NewTicker(5 * time.Minute)
	defer t.Stop()
	for {
		select {
		case <-r.stopCh:
			return
		case <-t.C:
			r.gc()
		}
	}
}

func (r *RateLimiter) gc() {
	cutoff := time.Now().Add(-r.idleCutoff).UnixNano()
	r.limiters.Range(func(k, v any) bool {
		e, ok := v.(*rlEntry)
		if !ok {
			r.limiters.Delete(k)
			return true
		}
		if e.lastSeen.Load() < cutoff {
			r.limiters.Delete(k)
		}
		return true
	})
}

// Group 返回针对该路由分组的中间件。
//
//   - group：分组名（如 "default" / "lark_callback"），不同 group 各算各的桶
//   - perMin：本组每分钟上限；<= 0 时用 RateLimiter 默认值
//
// rate 用 perMin/60 tokens-per-sec，burst = perMin（允许短时小高峰）。
func (r *RateLimiter) Group(group string, perMin int) gin.HandlerFunc {
	if perMin <= 0 {
		perMin = r.defaultPerMin
	}
	rt := rate.Limit(float64(perMin) / 60.0)
	burst := perMin
	return func(c *gin.Context) {
		ip := c.ClientIP()
		// \x00 分隔，避免任意 group 名包含分隔符产生碰撞
		key := group + "\x00" + ip
		v, _ := r.limiters.LoadOrStore(key, &rlEntry{
			lim: rate.NewLimiter(rt, burst),
		})
		e, ok := v.(*rlEntry)
		if !ok {
			c.Next()
			return
		}
		e.lastSeen.Store(time.Now().UnixNano())
		if !e.lim.Allow() {
			response.Error(c, http.StatusTooManyRequests, errcode.RateLimited, "rate limit exceeded")
			c.Abort()
			return
		}
		c.Next()
	}
}
