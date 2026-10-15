package chain_crawler

import (
	"bytes"
	"chain-consumer/global"
	"chain-consumer/internal/tracelog"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type Client struct {
	cfg        *global.ChainCrawlerConfig
	httpClient *http.Client
}

func NewClient(cfg *global.ChainCrawlerConfig) *Client {
	return &Client{
		cfg:        cfg,
		httpClient: &http.Client{},
	}
}

type BackwardChainRequest struct {
	ChainName  string `json:"chain_name" form:"chain_name"`
	StartBlock int64  `json:"start_block"`
	EndBlock   int64  `json:"end_block"`
}

func (client *Client) RequestBackward(ctx context.Context, chain string, startBlock, endBlock int64) error {
	_, checkSpan := tracelog.StartSpan(ctx, "chain_crawler_client", "RequestBackward")
	defer checkSpan.End()

	if client.cfg.RpcUrl == "" {
		return fmt.Errorf("rpc url is empty")
	}
	reqUrl := client.cfg.RpcUrl + "/web3-chaincrawler/backward"

	req := &BackwardChainRequest{
		ChainName:  chain,
		StartBlock: startBlock,
		EndBlock:   endBlock,
	}
	data, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("json.Marshal error:%w", err)
	}

	resp, err := client.httpClient.Post(reqUrl, "application/json", bytes.NewBuffer(data))
	if err != nil {
		return fmt.Errorf("client.httpClient.Post error:%w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("io.ReadAll error:%w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("request failed, status code:%d, response:%s", resp.StatusCode, string(body))
	}
	return nil
}
