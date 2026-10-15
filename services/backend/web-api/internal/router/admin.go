package router

import (
	"everything_finance/org/web-api/internal/handler"

	"github.com/gin-gonic/gin"
)

func (g *RouterGroup) RegisterAdminRoutes(r *gin.Engine, h *handler.UserHandler) {
	admin := r.Group("/admin")
	admin.GET("/order/pending_orders", h.GetPendingOrders) // 获取所有pending订单
	admin.POST("/order/approve_order", h.ApproveOrder)     // 审查订单
	admin.POST("/order/order_info", h.OrderInfo)           // 获取订单信息
}
