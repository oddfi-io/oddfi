package repository

import (
	"context"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/redis"
	"fmt"

	"github.com/shopspring/decimal"
)

type MarketRepo interface {
	GetPrice(ctx context.Context, req model.GetPriceRequest) (decimal.Decimal, error)
}

type marketRepo struct {
	rdb *redis.Client
}

func NewMarketRepo(rdb *redis.Client) MarketRepo {
	return &marketRepo{rdb: rdb}
}

func (m marketRepo) priceKey(req model.GetPriceRequest) string {
	return fmt.Sprintf("market:price:%s:%s", req.Chain, req.Symbol)
}

func (m marketRepo) GetPrice(ctx context.Context, req model.GetPriceRequest) (decimal.Decimal, error) {
	priceStr, err := m.rdb.Get(ctx, m.priceKey(req))
	if err != nil {
		return decimal.Zero, err
	}

	price, err := decimal.NewFromString(priceStr)
	if err != nil {
		return decimal.Zero, err
	}

	return price, nil
}
