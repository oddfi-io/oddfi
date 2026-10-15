package ethereum

import (
	"context"
	"chain-consumer/global"
	"chain-consumer/internal"
	"chain-consumer/internal/kafka"
	"chain-consumer/service"
	"chain-consumer/service/evm"

	"chain-consumer/internal/logc"
	"github.com/redis/go-redis/v9"
)

type EthService struct {
	ctx      context.Context
	consumer *kafka.KafkaConsumer
}

const (
	cosPrefix = "ethereum"
)

func NewEthService(ctx context.Context, cfg global.Config, redisClient *redis.Client) (service.Service, error) {
	s, err := evm.NewEVMService(ctx, cfg.Global.ConsumerGroup, cfg.ChainCrawler, cfg.Eth, internal.ChainEth, redisClient)
	if err != nil {
		logc.Errorw(ctx, "创建 Ethereum 服务失败", logc.Field("error", err))
		return nil, err
	}
	return s, nil
}

var _ service.Service = (*ethService)(nil)

type ethService = evm.EVMService
