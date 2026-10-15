package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
)

func TestRoleRequired_TableDriven(t *testing.T) {
	cases := []struct {
		name     string
		setRole  bool // 是否在 ctx 注入 role
		role     string
		allow    []string
		wantCode int
	}{
		{"super_admin not auto-pass for finance route", true, "super_admin", []string{"finance"}, http.StatusForbidden},
		{"super_admin passes when explicitly allowed", true, "super_admin", []string{"super_admin"}, http.StatusOK},
		{"finance passes finance+super", true, "finance", []string{"finance", "super_admin"}, http.StatusOK},
		{"operator denied for finance route", true, "operator", []string{"finance"}, http.StatusForbidden},
		{"empty role denied", true, "", []string{"finance"}, http.StatusForbidden},
		{"unknown role denied", true, "intern", []string{"finance"}, http.StatusForbidden},
		{"missing role in ctx denied (upstream mw not set)", false, "", []string{"finance"}, http.StatusForbidden},
	}

	gin.SetMode(gin.TestMode)
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := gin.New()
			// 模拟 AdminAuthMiddleware 注入 role
			r.Use(func(ctx *gin.Context) {
				if c.setRole {
					ctx.Set(middleware.CtxRole, c.role)
				}
				ctx.Next()
			})
			r.GET("/x", middleware.RoleRequired(c.allow...), func(ctx *gin.Context) {
				ctx.Status(http.StatusOK)
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/x", nil)
			r.ServeHTTP(w, req)

			if w.Code != c.wantCode {
				t.Errorf("code = %d, want %d", w.Code, c.wantCode)
			}
		})
	}
}
