package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
)

func newCORSEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.CORS(config.CORSConfig{
		AllowedOrigins:   []string{"https://admin.oddfi.io", "http://localhost:5173"},
		AllowCredentials: false,
	}))
	r.GET("/x", func(c *gin.Context) { c.String(200, "ok") })
	return r
}

func TestCORS_AllowedOrigin(t *testing.T) {
	r := newCORSEngine()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Origin", "https://admin.oddfi.io")
	r.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://admin.oddfi.io" {
		t.Errorf("ACAO = %q, want admin.oddfi.io", got)
	}
}

func TestCORS_DisallowedOriginNoHeader(t *testing.T) {
	r := newCORSEngine()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Origin", "https://evil.example")
	r.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("ACAO should be empty, got %q", got)
	}
}

func TestCORS_Preflight(t *testing.T) {
	r := newCORSEngine()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodOptions, "/x", nil)
	req.Header.Set("Origin", "https://admin.oddfi.io")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("code = %d, want 204", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Errorf("ACAM missing")
	}
}
