// Package handler 包含所有 HTTP handler。
package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// Health 是健康检查端点。
// LB / Nginx / systemd 上线后会持续调用，必须保持极简且无外部依赖（不查 DB）。
func Health(c *gin.Context) {
	response.OK(c, gin.H{"status": "ok"})
}
