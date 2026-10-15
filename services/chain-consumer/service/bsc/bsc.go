package bsc

import (
	"context"
	"chain-consumer/global"
	"chain-consumer/internal"
	"chain-consumer/service"
	"chain-consumer/service/evm"

	"chain-consumer/internal/logc"

	"github.com/redis/go-redis/v9"
)

const (
	cosPrefix = "bsc"
)

var _ service.Service = (*bscService)(nil)

type bscService = evm.EVMService

func NewBscService(ctx context.Context, cfg global.Config, redisClient *redis.Client) (service.Service, error) {
	s, err := evm.NewEVMService(ctx, cfg.Global.ConsumerGroup, cfg.ChainCrawler, cfg.Bsc, internal.ChainBsc, redisClient)
	if err != nil {
		logc.Errorw(ctx, "创建 Bsc 服务失败", logc.Field("error", err))
		return nil, err
	}
	return s, nil
}
