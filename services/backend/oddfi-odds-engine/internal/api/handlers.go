package api

import (
	"net/http"
	// 你上传的 slippage 逻辑
	bet "oddfi-odds-engine/internal"

	"github.com/gin-gonic/gin"
)

type OddsHandler struct {
	// 依赖注入数据库等
}

// GetBetPreview 处理 POST /api/v1/bets/preview
func (h *OddsHandler) GetBetPreview(c *gin.Context) {
	var req bet.PreviewRequest // [source: 4]
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. 调用你上传的滑点计算逻辑 [source: 4]
	resp := bet.Preview(req)

	// 2. 返回给前端展示，包含是否需要确认的标记 RequiresConfirm
	c.JSON(http.StatusOK, resp)
}
