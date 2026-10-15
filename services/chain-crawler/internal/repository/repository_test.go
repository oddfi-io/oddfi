package repository

import (
	"context"

	"chain_crawler/internal/config"
	"chain_crawler/pkg/redis"
	"chain_crawler/pkg/tracelog"
)

var repositoryIns *repositoryImpl

func init() {
	tracelog.InitLogger("dev")
	repositoryIns = &repositoryImpl{
		cfg: config.Config{
			MySQL: config.MySQLConfig{
				Mock: true,
			},
			Redis: redis.RedisConfig{
				Host:        "127.0.0.1",
				Port:        "6379",
				Auth:        "",
				MaxIdle:     50,
				MaxActive:   100,
				IdleTimeout: 20,
				DB:          0,
			},
		},
	}
	repositoryIns.init(context.Background())
}
