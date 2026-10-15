package service

import (
	"context"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
)

type MarketService interface {
	GetPrice(ctx context.Context, req model.GetPriceRequest) (*model.GetPriceResponse, error)
}

type marketService struct {
	marketRepo repository.MarketRepo
}

func NewMarketService(marketRepo repository.MarketRepo) MarketService {
	return &marketService{marketRepo: marketRepo}
}

func (m marketService) GetPrice(ctx context.Context, req model.GetPriceRequest) (*model.GetPriceResponse, error) {
	dcm, err := m.marketRepo.GetPrice(ctx, req)
	if err != nil {
		return nil, err
	}

	return &model.GetPriceResponse{Price: dcm}, nil
}
