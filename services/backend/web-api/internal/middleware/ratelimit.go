package middleware

import (
	"context"
	"net/http"
	"sync"
	"time"

	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type IPRateLimiter struct {
	ips     map[string]*rate.Limiter
	mu      sync.RWMutex
	rps     rate.Limit
	burst   int
	enabled bool
}

var (
	rateLimiter   *IPRateLimiter
	rateLimitOnce sync.Once
)

func Init(cfg config.RateLimitConfig) *IPRateLimiter {
	rateLimitOnce.Do(func() {
		rateLimiter = &IPRateLimiter{
			ips:     make(map[string]*rate.Limiter),
			rps:     rate.Limit(cfg.RequestsPerSecond),
			burst:   cfg.BurstSize,
			enabled: cfg.Enabled,
		}
	})
	return rateLimiter
}

func GetRateLimiter() *IPRateLimiter {
	if rateLimiter == nil {
		panic("rate limiter not initialized, call Init() first")
	}
	return rateLimiter
}

func NewIPRateLimiter(cfg *config.RateLimitConfig) *IPRateLimiter {
	return &IPRateLimiter{
		ips:     make(map[string]*rate.Limiter),
		rps:     rate.Limit(cfg.RequestsPerSecond),
		burst:   cfg.BurstSize,
		enabled: cfg.Enabled,
	}
}

func (i *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	limiter, exists := i.ips[ip]
	if !exists {
		limiter = rate.NewLimiter(i.rps, i.burst)
		i.ips[ip] = limiter
	}

	return limiter
}

func (i *IPRateLimiter) CleanupExpired() {
	i.mu.Lock()
	defer i.mu.Unlock()

	now := time.Now()
	for _, limiter := range i.ips {
		if limiter.AllowN(now, limiter.Burst()) {
			continue
		}
	}
}

type RateLimitMiddleware struct {
	limiter *IPRateLimiter
}

func NewRateLimitMiddleware(limiter *IPRateLimiter) *RateLimitMiddleware {
	return &RateLimitMiddleware{limiter: limiter}
}

func (m *RateLimitMiddleware) RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !m.limiter.enabled {
			c.Next()
			return
		}

		ip := c.ClientIP()
		limiter := m.limiter.getLimiter(ip)

		if !limiter.Allow() {
			response.RateLimitExceeded(c)
			c.Abort()
			return
		}

		c.Next()
	}
}

func GlobalRateLimit(rps float64, burst int) gin.HandlerFunc {
	type client struct {
		limiter  *rate.Limiter
		lastSeen time.Time
	}

	var (
		mu      sync.Mutex
		clients = make(map[string]*client)
	)

	go func() {
		for {
			time.Sleep(time.Minute)
			mu.Lock()
			for ip, c := range clients {
				if time.Since(c.lastSeen) > 3*time.Minute {
					delete(clients, ip)
				}
			}
			mu.Unlock()
		}
	}()

	getClient := func(ip string) *rate.Limiter {
		mu.Lock()
		defer mu.Unlock()

		if c, exists := clients[ip]; exists {
			c.lastSeen = time.Now()
			return c.limiter
		}

		limiter := rate.NewLimiter(rate.Limit(rps), burst)
		clients[ip] = &client{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}

	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := getClient(ip)

		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"code":    1007,
				"message": "rate limit exceeded",
				"data":    nil,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func RateLimitWithContext(ctx context.Context, limiter *rate.Limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		select {
		case <-ctx.Done():
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"code":    503,
				"message": "service unavailable",
				"data":    nil,
			})
			c.Abort()
			return
		default:
			if !limiter.Allow() {
				c.JSON(http.StatusTooManyRequests, gin.H{
					"code":    1007,
					"message": "rate limit exceeded",
					"data":    nil,
				})
				c.Abort()
				return
			}
		}
		c.Next()
	}
}
