package bsc

import (
	"oddfi-cron-job/internal/logger"

	"github.com/ethereum/go-ethereum/ethclient"
)

var Client *ethclient.Client

// Init 初始化 Ethereum RPC 客户端，失败则 panic
func Init(rpcURL string) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		panic("BSC dial failed: " + err.Error())
	}

	Client = client
	logger.Infof("BSC client initialized: %s", rpcURL)
}

// GetClient 获取全局 ethclient 实例
func GetClient() *ethclient.Client {
	return Client
}

// Close 关闭连接
func Close() {
	if Client != nil {
		Client.Close()
	}
}
