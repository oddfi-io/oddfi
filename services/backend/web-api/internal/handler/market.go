package handler

import (
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/response"
	"everything_finance/org/web-api/internal/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

type MarketHandler struct {
	marketService service.MarketService
}

func NewMarketHandler(service service.MarketService) *MarketHandler {
	return &MarketHandler{marketService: service}
}

func (h *MarketHandler) GetPrice(c *gin.Context) {
	var req model.GetPriceRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.InvalidParams(c, err.Error())
		return
	}

	if req.Chain != "bsc" {
		response.InvalidParams(c, "invalid chain")
		return
	}

	if req.Symbol != "odd" {
		response.InvalidParams(c, "invalid symbol")
		return
	}

	resp, err := h.marketService.GetPrice(c.Request.Context(), req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, response.CodeInternalError, err.Error())
		return
	}

	response.Success(c, resp)
}
