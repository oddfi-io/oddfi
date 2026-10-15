package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
)

func TestRateLimit_BurstExhausted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rl := middleware.NewRateLimiter(60)
	r := gin.New()
	// 设 perMin=5：第 6 个请求应被拒（burst=5）
	r.GET("/x", rl.Group("test", 5), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	for i := 1; i <= 5; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/x", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("req %d code=%d, want 200", i, w.Code)
		}
	}
	// 第 6 个：超限
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/x", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	r.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("req 6 code=%d, want 429", w.Code)
	}
}

func TestRateLimit_DifferentIPsIndependent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rl := middleware.NewRateLimiter(60)
	r := gin.New()
	r.GET("/x", rl.Group("test", 2), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// IP A 用满 burst
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/x", nil)
		req.RemoteAddr = "10.0.0.1:1234"
		r.ServeHTTP(w, req)
	}
	// IP B 第 1 次仍可通过
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/x", nil)
	req.RemoteAddr = "10.0.0.2:1234"
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("IP B first req code=%d, want 200", w.Code)
	}
}

func TestRateLimit_DifferentGroupsIndependent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rl := middleware.NewRateLimiter(60)
	r := gin.New()
	// 两个 group：default 5/min，sensitive 1/min
	r.GET("/a", rl.Group("default", 5), func(c *gin.Context) { c.Status(200) })
	r.GET("/b", rl.Group("sensitive", 1), func(c *gin.Context) { c.Status(200) })

	doIP := func(path string) int {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, path, nil)
		req.RemoteAddr = "10.0.0.1:1234"
		r.ServeHTTP(w, req)
		return w.Code
	}
	if code := doIP("/b"); code != http.StatusOK {
		t.Fatalf("/b first code=%d", code)
	}
	if code := doIP("/b"); code != http.StatusTooManyRequests {
		t.Fatalf("/b second code=%d, want 429", code)
	}
	// /a 仍可通过（不同 group）
	if code := doIP("/a"); code != http.StatusOK {
		t.Errorf("/a code=%d, want 200", code)
	}
}
