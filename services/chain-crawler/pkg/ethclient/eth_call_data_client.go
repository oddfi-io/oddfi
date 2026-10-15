package ethclient

import (
	"chain_crawler/pkg/httpclient"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/utils"
	"context"
	"math/big"
	"time"

	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/rpc"
)

type ethCallWithDataArgClientImpl struct {
	*ethClientImpl
	httpClient httpclient.HttpClient
}

func NewEthCallWithDataArgClient(ctx context.Context, urls []string) (EthClient, error) {
	//create span
	ethCallWithDataArgClientSpanCtx, ethCallWithDataArgClientSpan := tracelog.StartSpan(ctx, "ethclient", "NewEthCallWithDataArgClient")
	defer ethCallWithDataArgClientSpan.End()
	tl := tracelog.NewWithContext(ethCallWithDataArgClientSpanCtx)
	clients := make([]*rpc.Client, 0, len(urls))
	for _, url := range urls {
		client, err := rpc.DialOptions(ethCallWithDataArgClientSpanCtx, url, rpc.WithBatchItemLimit(8))
		if err != nil {
			tl.Errorw("NewEthCallWithDataArgClient failed", "error", err.Error(), "url", url)
			return nil, err
		}
		clients = append(clients, client)
	}
	return &ethCallWithDataArgClientImpl{
		ethClientImpl: getEthClientImpl(urls, clients),
		httpClient:    httpclient.NewHttpClient(),
	}, nil
}

func (s *ethCallWithDataArgClientImpl) EthCall(ctx context.Context, r Route, from, to eth_common.Address, input []byte, blockNumber *big.Int) ([]byte, error) {
	ethCallSpanCtx, ethCallSpan := tracelog.StartSpan(ctx, "ethclient", "EthCall")
	defer ethCallSpan.End()
	tl := tracelog.NewWithContext(ethCallSpanCtx)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("EthCall", url).Observe(time.Since(now).Seconds())
	}()

	var hex hexutil.Bytes
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(ethCallSpanCtx, &hex, "eth_call", map[string]any{
			"from": from,
			"to":   to,
			"data": hexutil.Bytes(input),
		}, s.toBlockNumArg(blockNumber))
	})
	if err != nil {
		tl.Errorw("eth_call failed", "error", adjustErr(err).Error(), "url", url)
		return nil, adjustErr(err)
	}
	return hex, nil
}

// BlockByNumberFinalized 获取已最终确认的区块
func (s *ethCallWithDataArgClientImpl) BlockByNumberFinalized(ctx context.Context, r Route) (Block, error) {
	blockByNumberFinalizedSpanCtx, blockByNumberFinalizedSpan := tracelog.StartSpan(ctx, "ethclient", "BlockByNumberFinalized")
	defer blockByNumberFinalizedSpan.End()
	tl := tracelog.NewWithContext(blockByNumberFinalizedSpanCtx)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("BlockByNumberFinalized", url).Observe(time.Since(now).Seconds())
	}()
	var block Block
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(blockByNumberFinalizedSpanCtx, &block, "eth_getBlockByNumber", "finalized", false)
	})
	if err != nil {
		tl.Errorw("BlockByNumberFinalized failed", "error", adjustErr(err).Error(),
			"urls", url, "method", "eth_getBlockByNumber", "blockNumberArg", "finalized")
		return Block{}, adjustErr(err)
	}
	if block.Hash == "" {
		tl.Errorf("BlockByNumberFinalized returned empty block", "urls", url, "method", "eth_getBlockByNumber")
	}
	return block, nil
}
