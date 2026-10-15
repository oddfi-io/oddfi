package tronclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/ethereum/go-ethereum/rpc"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/time/rate"
	"io"
	"math/big"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"chain_crawler/pkg/tracelog"
)

const DefaultTronRateLimit = int64(100)

var (
	TronRpcRequestCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "web3",
		Subsystem: "tron_client",
		Name:      "tron_rpc_request_count",
		Help:      "Tron rpc request count",
	}, []string{
		"method",
		"endpoint",
	})
	TronRpcRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "tron_client",
		Name:      "tron_rpc_request_duration",
		Help:      "Tron rpc request duration",
	}, []string{
		"method",
		"endpoint",
	})
	TronRpcRequestErrors = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "web3",
		Subsystem: "tron_client",
		Name:      "tron_rpc_request_errors_total",
		Help:      "Tron rpc request errors total",
	}, []string{
		"method",
		"endpoint",
		"error_code",
	})
)

type TronClient struct {
	jsonRpcUrls    []string
	restRpcUrls    []string
	jsonRpcClients []*rpc.Client
	restHttpClient *http.Client
	limit          *rate.Limiter
}

func NewTronClient(restRpcUrls, jsonRpcUrls []string, qpsLimit ...int64) (*TronClient, error) {
	maxQps := DefaultTronRateLimit
	if len(qpsLimit) > 0 && qpsLimit[0] > 0 {
		maxQps = qpsLimit[0]
	}
	client := &TronClient{
		restHttpClient: &http.Client{},
		limit:          rate.NewLimiter(rate.Limit(maxQps), int(maxQps)),
		restRpcUrls:    restRpcUrls,
	}
	for _, jsonRpcUrl := range jsonRpcUrls {
		rpcClient, err := rpc.Dial(jsonRpcUrl)
		if err != nil {
			return nil, fmt.Errorf("rpc dial:%s error: %v", jsonRpcUrl, err)
		}
		client.jsonRpcUrls = append(client.jsonRpcUrls, jsonRpcUrl)
		client.jsonRpcClients = append(client.jsonRpcClients, rpcClient)
	}
	for _, restRpcUrl := range restRpcUrls {
		client.restRpcUrls = append(client.restRpcUrls, strings.TrimSuffix(restRpcUrl, "/"))
	}
	return client, nil
}

type JsonRpcRequest struct {
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	Id      int           `json:"id"`
	Jsonrpc string        `json:"jsonrpc"`
}

type JsonRpcResponse struct {
	Id      int                   `json:"id"`
	Jsonrpc string                `json:"jsonrpc"`
	Result  json.RawMessage       `json:"result"`
	Error   *JsonRpcResponseError `json:"error,omitempty"`
}

type JsonRpcResponseError struct {
	Code    int64  `json:"code"`
	Message string `json:"message"`
}

func (c *TronClient) GetBlockNumber(ctx context.Context) (uint64, error) {
	// 为区块链查询创建 span，追踪查询时间
	blockNumberSpanCtx, blockNumberSpan := tracelog.StartSpan(ctx, "blockchain", "GetBlockNumber")
	defer blockNumberSpan.End()

	tl := tracelog.NewWithContext(blockNumberSpanCtx)
	data, err := c.doJsonRpcRequest(blockNumberSpanCtx, c.getRandomJsonRpcUrl(), "eth_blockNumber", nil)
	if err != nil {
		tl.Errorw("doJsonRpcRequest error", "error", err.Error())
		return 0, fmt.Errorf("doJsonRpcRequest error: %w", err)
	}
	var result string
	if err = json.Unmarshal(data, &result); err != nil {
		return 0, fmt.Errorf("json.Unmarshal blockNumber:%s error: %w", string(data), err)
	}
	blockNumber, ok := new(big.Int).SetString(strings.TrimPrefix(result, "0x"), 16)
	if !ok {
		return 0, fmt.Errorf("SetString blockNumber:%s error", result)
	}
	return blockNumber.Uint64(), nil
}

type TronBlockInfo struct {
	BlockNumber uint64          `json:"block_number"`
	TronBlock   json.RawMessage `json:"tron_block"`
	TronTxInfos json.RawMessage `json:"tron_tx_infos"`
	TVMBlock    json.RawMessage `json:"tvm_block"`
	TVMReceipts json.RawMessage `json:"tvm_receipts"`
}

func (c *TronClient) GetTronBlockRaw(ctx context.Context, blockNumber uint64) ([]byte, error) {
	// 为区块链查询创建 span，追踪查询时间
	getTronBlockRawSpanCtx, getTronBlockRawSpan := tracelog.StartSpan(ctx, "blockchain", "GetTronBlockRaw")
	defer getTronBlockRawSpan.End()

	rpcUrl := c.getRandomRestRpcUrl() + "/wallet/getblockbynum"
	return c.postRequest(getTronBlockRawSpanCtx, rpcUrl, map[string]interface{}{
		"num": blockNumber,
	})
}

func (c *TronClient) GetTronTransactionInfoRaw(ctx context.Context, blockNumber uint64) ([]byte, error) {
	// 为区块链查询创建 span，追踪查询时间
	getTronTransactionInfoRawSpanCtx, getTronTransactionInfoRawSpan := tracelog.StartSpan(ctx, "blockchain", "GetTronTransactionInfoRaw")
	defer getTronTransactionInfoRawSpan.End()

	rpcUrl := c.getRandomRestRpcUrl() + "/wallet/gettransactioninfobyblocknum"
	return c.postRequest(getTronTransactionInfoRawSpanCtx, rpcUrl, map[string]interface{}{
		"num": blockNumber,
	})
}

func (c *TronClient) GetTVMBlockRaw(ctx context.Context, blockNumber uint64) ([]byte, error) {
	// 为区块链查询创建 span，追踪查询时间
	getTVMBlockRawSpanCtx, getTVMBlockRawSpan := tracelog.StartSpan(ctx, "blockchain", "GetTVMBlockRaw")
	defer getTVMBlockRawSpan.End()

	return c.doJsonRpcRequest(getTVMBlockRawSpanCtx, c.getRandomJsonRpcUrl(), "eth_getBlockByNumber", []interface{}{
		"0x" + strconv.FormatUint(blockNumber, 16),
		true,
	})
}

func (c *TronClient) GetTVMBlockReceiptsRaw(ctx context.Context, blockNumber uint64) ([]byte, error) {

	// 为区块链查询创建 span，追踪查询时间
	getTVMBlockReceiptsRawSpanCtx, getTVMBlockReceiptsRawSpan := tracelog.StartSpan(ctx, "blockchain", "GetTVMBlockReceiptsRaw")
	defer getTVMBlockReceiptsRawSpan.End()

	return c.doJsonRpcRequest(getTVMBlockReceiptsRawSpanCtx, c.getRandomJsonRpcUrl(), "eth_getBlockReceipts", []interface{}{
		"0x" + strconv.FormatUint(blockNumber, 16),
	})
}

func (c *TronClient) BatchGetTVMTransactionReceiptsRaw(ctx context.Context, txHashes []string) ([]json.RawMessage, error) {
	// 为区块链查询创建 span，追踪查询时间
	batchGetTVMTransactionReceiptsRawSpanCtx, batchGetTVMTransactionReceiptsRawSpan := tracelog.StartSpan(ctx, "blockchain", "BatchGetTVMTransactionReceiptsRaw")
	defer batchGetTVMTransactionReceiptsRawSpan.End()

	params := make([][]interface{}, 0, len(txHashes))
	for _, txHash := range txHashes {
		params = append(params, []interface{}{txHash})
	}
	return c.doBatchJsonRpcRequest(batchGetTVMTransactionReceiptsRawSpanCtx, c.getRandomJsonRpcUrl(), "eth_getTransactionReceipt", params)
}

func (c *TronClient) getRandomRestRpcUrlIndex() int {
	return rand.Intn(len(c.restRpcUrls))
}

func (c *TronClient) getRandomJsonRpcUrlIndex() int {
	return rand.Intn(len(c.jsonRpcUrls))
}

func (c *TronClient) getRandomRestRpcUrl() string {
	return c.restRpcUrls[c.getRandomRestRpcUrlIndex()]
}

func (c *TronClient) getRandomJsonRpcUrl() string {
	return c.jsonRpcUrls[c.getRandomJsonRpcUrlIndex()]
}

func (c *TronClient) getRandomRpcClientAndUrl() (*rpc.Client, string) {
	index := c.getRandomRestRpcUrlIndex()
	return c.jsonRpcClients[index], c.jsonRpcUrls[index]
}

func (c *TronClient) postRequest(ctx context.Context, rpcUrl string, params interface{}, rpcMethod ...string) ([]byte, error) {
	// 为区块链查询创建 span，追踪查询时间
	postRequestSpanCtx, postRequestSpan := tracelog.StartSpan(ctx, "blockchain", "postRequest")
	defer postRequestSpan.End()

	tl := tracelog.NewWithContext(postRequestSpanCtx)
	if err := c.limit.Wait(postRequestSpanCtx); err != nil {
		tl.Errorw("limit.Wait error", "error", err.Error())
		return nil, fmt.Errorf("rate limit wait error: %w", err)
	}

	var httpStatusCode int
	timeStart := time.Now()
	defer func() {
		method := ""
		if len(rpcMethod) > 0 {
			method = rpcMethod[0]
		}
		TronRpcRequestDuration.WithLabelValues(method, rpcUrl).Observe(time.Since(timeStart).Seconds())
		TronRpcRequestCount.WithLabelValues(method, rpcUrl).Inc()
		if httpStatusCode != http.StatusOK {
			TronRpcRequestErrors.WithLabelValues(method, rpcUrl, strconv.Itoa(httpStatusCode)).Inc()
		}
	}()

	body, err := json.Marshal(params)
	if err != nil {
		return nil, fmt.Errorf("json.Marshal params error: %w", err)
	}
	
	// 使用NewRequestWithContext以便注入trace信息
	httpReq, err := http.NewRequestWithContext(postRequestSpanCtx, "POST", rpcUrl, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("http.NewRequestWithContext error: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	
	// 注入trace信息到HTTP请求头中
	tracelog.InjectHttpHeader(postRequestSpanCtx, httpReq)
	
	resp, err := c.restHttpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("http.Do error: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("io.ReadAll error: %w", err)
	}
	httpStatusCode = resp.StatusCode
	if httpStatusCode != http.StatusOK {
		return nil, fmt.Errorf("http status code: %d body:%s", httpStatusCode, string(data))
	}
	return data, nil
}

func (c *TronClient) doJsonRpcRequest(ctx context.Context, rpcUrl, method string, params []interface{}) (json.RawMessage, error) {
	// 为区块链查询创建 span，追踪查询时间
	jsonRpcRequestSpanCtx, jsonRpcRequestSpan := tracelog.StartSpan(ctx, "blockchain", "doJsonRpcRequest")
	defer jsonRpcRequestSpan.End()

	tl := tracelog.NewWithContext(jsonRpcRequestSpanCtx)
	if err := c.limit.Wait(jsonRpcRequestSpanCtx); err != nil {
		tl.Errorw("limit.Wait error", "error", err.Error())
		return nil, fmt.Errorf("rate limit wait error: %w", err)
	}

	req := &JsonRpcRequest{
		Method:  method,
		Params:  params,
		Jsonrpc: "2.0",
		Id:      rand.Int(),
	}
	respData, err := c.postRequest(jsonRpcRequestSpanCtx, rpcUrl, req, method)
	if err != nil {
		tl.Errorw("postRequest error", "error", err.Error())
		return nil, fmt.Errorf("postRequest error: %w", err)
	}
	resp := &JsonRpcResponse{}
	if err = json.Unmarshal(respData, resp); err != nil {
		return nil, fmt.Errorf("json.Unmarshal JsonRpcResponse:%s error: %w", string(respData), err)
	}
	if resp.Error != nil {
		return nil, fmt.Errorf("json rpc error: code=%d message=%s", resp.Error.Code, resp.Error.Message)
	}
	return resp.Result, nil
}

func (c *TronClient) doBatchJsonRpcRequest(ctx context.Context, rpcUrl, method string, paramsList [][]interface{}) ([]json.RawMessage, error) {
	// 为区块链查询创建 span，追踪查询时间
	doBatchJsonRpcRequestSpanCtx, doBatchJsonRpcRequestSpan := tracelog.StartSpan(ctx, "blockchain", "doBatchJsonRpcRequest")
	defer doBatchJsonRpcRequestSpan.End()

	if err := c.limit.Wait(doBatchJsonRpcRequestSpanCtx); err != nil {
		return nil, fmt.Errorf("rate limit wait error: %w", err)
	}

	reqs := make([]*JsonRpcRequest, 0, len(paramsList))
	for i, params := range paramsList {
		req := &JsonRpcRequest{
			Method:  method,
			Params:  params,
			Jsonrpc: "2.0",
			Id:      i,
		}
		reqs = append(reqs, req)
	}
	respData, err := c.postRequest(doBatchJsonRpcRequestSpanCtx, rpcUrl, reqs, method)
	if err != nil {
		return nil, fmt.Errorf("postRequest error: %w", err)
	}
	resps := make([]*JsonRpcResponse, 0, len(reqs))
	if err = json.Unmarshal(respData, &resps); err != nil {
		return nil, fmt.Errorf("json.Unmarshal JsonRpcResponse:%s error: %w", string(respData), err)
	}
	// 按照请求顺序返回结果
	results := make([]json.RawMessage, 0, len(reqs))
	for _, resp := range resps {
		if resp.Error != nil {
			return nil, fmt.Errorf("json rpc error: code=%d message=%s", resp.Error.Code, resp.Error.Message)
		}
		results = append(results, resp.Result)
	}
	return results, nil
}
