package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
)

func newRequestIDEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.RequestID())
	r.GET("/x", func(c *gin.Context) {
		c.String(http.StatusOK, c.GetString(middleware.CtxRequestID))
	})
	return r
}

func TestRequestID_Generated(t *testing.T) {
	r := newRequestIDEngine()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/x", nil)
	r.ServeHTTP(w, req)

	got := w.Header().Get(middleware.HeaderRequestID)
	if got == "" {
		t.Fatal("X-Request-ID header missing")
	}
	if w.Body.String() != got {
		t.Errorf("ctx (%q) != header (%q)", w.Body.String(), got)
	}
}

func TestRequestID_PassThrough(t *testing.T) {
	r := newRequestIDEngine()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set(middleware.HeaderRequestID, "client-abc-123")
	r.ServeHTTP(w, req)

	if w.Header().Get(middleware.HeaderRequestID) != "client-abc-123" {
		t.Errorf("not pass-through")
	}
	if w.Body.String() != "client-abc-123" {
		t.Errorf("ctx wrong")
	}
}
