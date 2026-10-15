package server

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// realIP 提取请求的客户端真实 IP。
//
// 仅信任 nginx 反代显式写入的 X-Real-IP；**不读 X-Forwarded-For**，
// 因为 nginx 默认用 $proxy_add_x_forwarded_for（追加而非替换），
// 攻击者发送的 XFF 头会被保留在链头，realIP 若读 XFF 就会被绕过限流。
//
// 见 ENH-002 §4.4 / v1 security review Critical #1。
//
// 部署层配套：nginx 必须设置 `proxy_set_header X-Real-IP $remote_addr`
// 才能保证此函数读到的是真实客户端 IP；同时建议加
// `proxy_set_header X-Forwarded-For $remote_addr` 主动断 XFF 链。
func realIP(r *http.Request) string {
	ip := strings.TrimSpace(r.Header.Get("X-Real-IP"))
	// X-Real-IP 应为单值；含逗号说明被恶意构造，拒绝信任，fallback RemoteAddr
	if ip != "" && !strings.Contains(ip, ",") {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil || host == "" {
		return r.RemoteAddr
	}
	return host
}

// SSEConnTracker 跟踪每个 IP 当前持有的 SSE 连接数。
//
// 双重防御：
//
//	(a) perIPLimit：单 IP 同时连接数上限（默认 3）
//	(b) maxIPs：被跟踪的不同 IP 上限（默认 50000），防 map 增长攻击
//
// 为何没有 IPLimiter 那种后台 GC：SSE 连接生命周期短，Release 会自动 delete
// 计数归零的 IP；攻击者无法只 Acquire 不 Release（HTTP 连接断开 / handler 返回
// 时 defer Release 一定会跑）。即便是被 perIPLimit 拒绝的 IP，map 条目也根本
// 没新建。所以 maxIPs 兜底已足够，无需 GC 周期。
type SSEConnTracker struct {
	mu         sync.Mutex
	perIP      map[string]int
	perIPLimit int
	maxIPs     int
}

func NewSSEConnTracker(perIPLimit, maxIPs int) *SSEConnTracker {
	if perIPLimit <= 0 {
		perIPLimit = 10 // 与 server.go New() 默认值同步（BUG-019）
	}
	if maxIPs <= 0 {
		maxIPs = 50000
	}
	return &SSEConnTracker{
		perIP:      make(map[string]int),
		perIPLimit: perIPLimit,
		maxIPs:     maxIPs,
	}
}

var (
	// ErrSSETooManyPerIP 单 IP 同时 SSE 连接已达上限。
	ErrSSETooManyPerIP = errors.New("too many SSE connections from this client")
	// ErrSSETooManyIPs 全局被跟踪的不同 IP 已达硬上限，拒绝新 IP（map 攻击防御）。
	ErrSSETooManyIPs = errors.New("too many tracked IPs")
)

// Acquire 尝试为 ip 增加一个连接计数。
func (t *SSEConnTracker) Acquire(ip string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	cur := t.perIP[ip]
	if cur >= t.perIPLimit {
		return ErrSSETooManyPerIP
	}
	// 仅在 ip 首次出现且 map 已满时拒绝；已存在的 ip 即使 map 满也允许 acquire
	if cur == 0 && len(t.perIP) >= t.maxIPs {
		return ErrSSETooManyIPs
	}
	t.perIP[ip] = cur + 1
	return nil
}

// Release 释放一个连接计数；计数归零时从 map 删除该 ip（节省内存）。
func (t *SSEConnTracker) Release(ip string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	n := t.perIP[ip]
	if n <= 1 {
		delete(t.perIP, ip)
		return
	}
	t.perIP[ip] = n - 1
}

// Count 返回某 ip 当前的连接计数（仅测试 / 监控用）。
func (t *SSEConnTracker) Count(ip string) int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.perIP[ip]
}

// IPLimiter 按 IP 分桶的 token bucket 限流器。
//
// 用于 /api/push、/api/chat 等 REST 端点 per-IP 速率限制。
// 设计要点：
//
//	(a) 每 IP 独立 *rate.Limiter（token bucket）
//	(b) maxIPs 硬上限：超出直接拒绝新 IP（map 增长攻击防御）
//	(c) gcLoop 两阶段锁：先短锁收集过期 IP，解锁，再短锁批量删，
//	    避免持锁遍历几万条 map 阻塞主路径（v2 review High #3 修复）
type IPLimiter struct {
	mu       sync.Mutex
	limits   map[string]*rate.Limiter
	lastSeen map[string]time.Time
	rps      rate.Limit
	burst    int
	maxIPs   int
}

func NewIPLimiter(rps rate.Limit, burst, maxIPs int) *IPLimiter {
	if burst <= 0 {
		burst = 1
	}
	if maxIPs <= 0 {
		maxIPs = 50000
	}
	return &IPLimiter{
		limits:   make(map[string]*rate.Limiter),
		lastSeen: make(map[string]time.Time),
		rps:      rps,
		burst:    burst,
		maxIPs:   maxIPs,
	}
}

// Allow 检查 ip 在本桶内是否有 token；超 maxIPs 时新 IP 直接拒绝。
func (l *IPLimiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	lim, ok := l.limits[ip]
	if !ok {
		if len(l.limits) >= l.maxIPs {
			return false
		}
		lim = rate.NewLimiter(l.rps, l.burst)
		l.limits[ip] = lim
	}
	l.lastSeen[ip] = time.Now()
	return lim.Allow()
}

// Size 返回当前被跟踪的 IP 数（仅测试 / 监控用）。
func (l *IPLimiter) Size() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.limits)
}

// RunGC 启动后台 goroutine 定期清理过期 IP 桶。
// ctx cancel 时 goroutine 自动退出，不会泄漏。
func (l *IPLimiter) RunGC(ctx context.Context, interval, ttl time.Duration) {
	go l.gcLoop(ctx, interval, ttl)
}

func (l *IPLimiter) gcLoop(ctx context.Context, interval, ttl time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			l.gcOnce(time.Now().Add(-ttl))
		}
	}
}

// gcOnce 两阶段锁清理：
//
//	1. 短锁内收集 lastSeen < cutoff 的 key 到 slice（不持锁长时间遍历）
//	2. 释放锁
//	3. 短锁内逐个删除（二次 check：lastSeen 仍 < cutoff 才删，避免清掉
//	   两阶段之间刚被刷新的 ip）
//
// 此设计让 5 万条 map 的 GC 不会阻塞主路径上的 Allow 调用太久。
func (l *IPLimiter) gcOnce(cutoff time.Time) {
	var toDel []string
	l.mu.Lock()
	for ip, t := range l.lastSeen {
		if t.Before(cutoff) {
			toDel = append(toDel, ip)
		}
	}
	l.mu.Unlock()
	if len(toDel) == 0 {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, ip := range toDel {
		if t, ok := l.lastSeen[ip]; ok && t.Before(cutoff) {
			delete(l.limits, ip)
			delete(l.lastSeen, ip)
		}
	}
}

// rateLimitMiddleware 把 IPLimiter 包装为 HTTP middleware。
// 超限返回 429 + `Retry-After: <retryAfter>`。
func rateLimitMiddleware(lim *IPLimiter, retryAfter int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if lim != nil && !lim.Allow(realIP(r)) {
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
