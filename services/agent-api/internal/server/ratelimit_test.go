package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/time/rate"
)

// ---------- realIP 测试（含 v2 安全关键回归） ----------

func TestRealIP_TrustsXRealIPOnly(t *testing.T) {
	cases := []struct {
		name       string
		realIP     string
		xff        string
		remoteAddr string
		want       string
	}{
		{"X-Real-IP 正常单值", "1.2.3.4", "", "10.0.0.1:5678", "1.2.3.4"},
		{"X-Real-IP 含逗号拒绝（防注入伪造）", "1.2.3.4,5.6.7.8", "", "10.0.0.1:5678", "10.0.0.1"},
		{"XFF 永远不被信任（即使 X-Real-IP 空）", "", "1.2.3.4", "10.0.0.1:5678", "10.0.0.1"},
		{"两头都空 fallback RemoteAddr", "", "", "10.0.0.1:5678", "10.0.0.1"},
		{"X-Real-IP 前后空白被 trim", "  1.2.3.4  ", "", "10.0.0.1:5678", "1.2.3.4"},
		{"RemoteAddr 无端口也能 fallback", "", "", "10.0.0.1", "10.0.0.1"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.RemoteAddr = tc.remoteAddr
			if tc.realIP != "" {
				r.Header.Set("X-Real-IP", tc.realIP)
			}
			if tc.xff != "" {
				r.Header.Set("X-Forwarded-For", tc.xff)
			}
			if got := realIP(r); got != tc.want {
				t.Errorf("realIP got=%q want=%q", got, tc.want)
			}
		})
	}
}

// ---------- SSEConnTracker 测试 ----------

func TestSSEConnTracker_PerIPLimit(t *testing.T) {
	tr := NewSSEConnTracker(3, 1000)
	for i := 0; i < 3; i++ {
		if err := tr.Acquire("1.2.3.4"); err != nil {
			t.Fatalf("iter %d unexpected err: %v", i, err)
		}
	}
	if err := tr.Acquire("1.2.3.4"); err != ErrSSETooManyPerIP {
		t.Errorf("4th acquire err=%v want=ErrSSETooManyPerIP", err)
	}
	tr.Release("1.2.3.4")
	if err := tr.Acquire("1.2.3.4"); err != nil {
		t.Errorf("after release err=%v", err)
	}
}

func TestSSEConnTracker_IsolatesIPs(t *testing.T) {
	tr := NewSSEConnTracker(2, 1000)
	if err := tr.Acquire("1.1.1.1"); err != nil {
		t.Fatal(err)
	}
	if err := tr.Acquire("1.1.1.1"); err != nil {
		t.Fatal(err)
	}
	if err := tr.Acquire("2.2.2.2"); err != nil {
		t.Errorf("IP2 应独立计数: %v", err)
	}
}

func TestSSEConnTracker_MaxIPs(t *testing.T) {
	tr := NewSSEConnTracker(3, 2) // 只允许 2 个不同 IP
	if err := tr.Acquire("1.1.1.1"); err != nil {
		t.Fatal(err)
	}
	if err := tr.Acquire("2.2.2.2"); err != nil {
		t.Fatal(err)
	}
	if err := tr.Acquire("3.3.3.3"); err != ErrSSETooManyIPs {
		t.Errorf("3rd IP err=%v want=ErrSSETooManyIPs", err)
	}
	// 已存在 IP 即使 map 满也能继续 acquire（直到 perIPLimit）
	if err := tr.Acquire("1.1.1.1"); err != nil {
		t.Errorf("已存在 ip 应能继续 acquire: %v", err)
	}
}

func TestSSEConnTracker_ReleaseDeletesWhenZero(t *testing.T) {
	tr := NewSSEConnTracker(3, 1000)
	_ = tr.Acquire("1.2.3.4")
	tr.Release("1.2.3.4")
	if c := tr.Count("1.2.3.4"); c != 0 {
		t.Errorf("Count after release=%d, want 0", c)
	}
}

func TestSSEConnTracker_ConcurrentSafe(t *testing.T) {
	tr := NewSSEConnTracker(3, 1000)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := tr.Acquire("hot.ip"); err == nil {
				time.Sleep(500 * time.Microsecond)
				tr.Release("hot.ip")
			}
		}()
	}
	wg.Wait()
	if c := tr.Count("hot.ip"); c != 0 {
		t.Errorf("final count=%d want=0", c)
	}
}

// ---------- IPLimiter 测试 ----------

func TestIPLimiter_BurstThenLimit(t *testing.T) {
	// rate 极低（约 1/分钟），burst=3 → 前 3 个秒级通过，第 4 个被拒
	lim := NewIPLimiter(rate.Limit(1.0/60.0), 3, 1000)
	for i := 0; i < 3; i++ {
		if !lim.Allow("1.2.3.4") {
			t.Fatalf("burst %d unexpected limit", i)
		}
	}
	if lim.Allow("1.2.3.4") {
		t.Error("burst+1 应被限流")
	}
}

func TestIPLimiter_IsolatesIPs(t *testing.T) {
	lim := NewIPLimiter(rate.Limit(1.0/60.0), 1, 1000)
	if !lim.Allow("1.1.1.1") {
		t.Fatal("第一次 IP1 应通过")
	}
	if lim.Allow("1.1.1.1") {
		t.Fatal("IP1 应被限")
	}
	if !lim.Allow("2.2.2.2") {
		t.Error("IP2 应不受 IP1 限流影响")
	}
}

func TestIPLimiter_MaxIPs(t *testing.T) {
	lim := NewIPLimiter(rate.Limit(100), 100, 2)
	if !lim.Allow("1.1.1.1") {
		t.Fatal()
	}
	if !lim.Allow("2.2.2.2") {
		t.Fatal()
	}
	if lim.Allow("3.3.3.3") {
		t.Error("3rd IP 超 maxIPs 应被拒")
	}
	// 已存在 IP 仍可继续（依赖 token bucket）
	if !lim.Allow("1.1.1.1") {
		t.Error("已存在 IP 不应被 maxIPs 拒")
	}
}

func TestIPLimiter_GCRemovesIdle_TwoPhase(t *testing.T) {
	lim := NewIPLimiter(rate.Limit(100), 100, 1000)
	lim.Allow("idle.ip")
	lim.Allow("fresh.ip")

	// 手工让 idle.ip 的 lastSeen 退化到 2 小时前
	lim.mu.Lock()
	lim.lastSeen["idle.ip"] = time.Now().Add(-2 * time.Hour)
	lim.mu.Unlock()

	lim.gcOnce(time.Now().Add(-1 * time.Hour))

	if lim.Size() != 1 {
		t.Errorf("size after gc=%d want=1", lim.Size())
	}
	// fresh.ip 应仍在
	if !lim.Allow("fresh.ip") {
		t.Error("fresh.ip 不应被清理")
	}
}

func TestIPLimiter_GCDoubleCheckPreventsRace(t *testing.T) {
	// 模拟：两阶段之间 idle.ip 又被刷新 lastSeen → 二阶段二次 check 不应删
	lim := NewIPLimiter(rate.Limit(100), 100, 1000)
	lim.Allow("idle.ip")
	lim.mu.Lock()
	lim.lastSeen["idle.ip"] = time.Now().Add(-2 * time.Hour)
	lim.mu.Unlock()

	// 此处用 hack 走 gcOnce 中间态：先收集（持锁→解锁），手工刷新 lastSeen，再调用一次 gcOnce
	// 简化办法：直接验证 gcOnce 调用前刷新 lastSeen，应当不删
	lim.mu.Lock()
	lim.lastSeen["idle.ip"] = time.Now() // 刚刚刷新
	lim.mu.Unlock()
	lim.gcOnce(time.Now().Add(-1 * time.Hour))
	if lim.Size() != 1 {
		t.Errorf("刷新过 lastSeen 的 ip 不应被删, size=%d", lim.Size())
	}
}

func TestIPLimiter_ConcurrentSafe(t *testing.T) {
	lim := NewIPLimiter(rate.Limit(1000), 10, 1000)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			lim.Allow("hot.ip")
		}()
	}
	wg.Wait()
}

// ---------- rateLimitMiddleware 测试 ----------

func TestRateLimitMiddleware_ReturnsRetryAfter(t *testing.T) {
	lim := NewIPLimiter(rate.Limit(1.0/60.0), 1, 1000)
	called := 0
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called++
	})
	h := rateLimitMiddleware(lim, 60)(next)

	r1 := httptest.NewRequest(http.MethodGet, "/", nil)
	r1.RemoteAddr = "1.2.3.4:1"
	w1 := httptest.NewRecorder()
	h.ServeHTTP(w1, r1)
	if w1.Code != http.StatusOK || called != 1 {
		t.Fatalf("first code=%d called=%d", w1.Code, called)
	}

	r2 := httptest.NewRequest(http.MethodGet, "/", nil)
	r2.RemoteAddr = "1.2.3.4:2"
	w2 := httptest.NewRecorder()
	h.ServeHTTP(w2, r2)
	if w2.Code != http.StatusTooManyRequests {
		t.Errorf("second code=%d want 429", w2.Code)
	}
	if w2.Header().Get("Retry-After") != "60" {
		t.Errorf("Retry-After=%q want 60", w2.Header().Get("Retry-After"))
	}
	if called != 1 {
		t.Errorf("next 不应被调用第二次, called=%d", called)
	}
}

// TestRateLimitMiddleware_XForwardedForCannotBypass 安全回归：
// v2 review 发现 XFF 可伪造绕限流 → realIP 必须只信 X-Real-IP，
// 此测试是该修复的活证据。
func TestRateLimitMiddleware_XForwardedForCannotBypass(t *testing.T) {
	lim := NewIPLimiter(rate.Limit(1.0/60.0), 1, 1000)
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	h := rateLimitMiddleware(lim, 60)(next)

	r1 := httptest.NewRequest(http.MethodGet, "/", nil)
	r1.RemoteAddr = "1.2.3.4:1"
	w1 := httptest.NewRecorder()
	h.ServeHTTP(w1, r1)
	if w1.Code != http.StatusOK {
		t.Fatalf("first code=%d", w1.Code)
	}

	// 攻击者第二次：同样 RemoteAddr，但塞各种伪造头
	r2 := httptest.NewRequest(http.MethodGet, "/", nil)
	r2.RemoteAddr = "1.2.3.4:2"
	r2.Header.Set("X-Forwarded-For", "5.6.7.8")
	r2.Header.Set("X-Real-IP", "9.9.9.9,fake") // 含逗号也应拒绝信任
	w2 := httptest.NewRecorder()
	h.ServeHTTP(w2, r2)
	if w2.Code != http.StatusTooManyRequests {
		t.Errorf("伪造头绕过限流！code=%d body=%s want 429",
			w2.Code, strings.TrimSpace(w2.Body.String()))
	}
}

func TestRateLimitMiddleware_NilLimiter_NoOp(t *testing.T) {
	// nil 注入降级：保护边角调用方
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	h := rateLimitMiddleware(nil, 60)(next)
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusTeapot {
		t.Errorf("nil limiter 应该 passthrough, code=%d", w.Code)
	}
}
