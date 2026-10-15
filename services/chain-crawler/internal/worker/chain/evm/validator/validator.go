package validator

import (
	"chain_crawler/pkg/ethclient"
	"chain_crawler/pkg/web3chain"
	"context"
)

// EVMTaskValidator 任务验证器接口
type EVMTaskValidator interface {
	Validate(ctx context.Context, chain *web3chain.Chain, evmClient ethclient.EthClient) error
}
