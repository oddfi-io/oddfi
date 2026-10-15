package ethclient

import (
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/utils"
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"math/rand"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/avast/retry-go/v4"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/rpc"
	cmap "github.com/orcaman/concurrent-map/v2"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

type Route int

const (
	RouteRandom Route = -1
)

var (
	RequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "ethclient",
		Name:      "request_duration",
		Help:      "Request duration",
	}, []string{
		"method",
		"endpoint",
	})

	TraceBlockRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "ethclient",
		Name:      "trace_block_request_duration",
		Help:      "TraceBlock Request duration",
	}, []string{
		"status",
		"endpoint",
	})

	TraceBlockRawRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "web3",
		Subsystem: "ethclient",
		Name:      "trace_block_raw_request_duration",
		Help:      "TraceBlockRaw Request duration",
	}, []string{
		"status",
		"endpoint",
	})
)

type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type Log struct {
	Address          eth_common.Address `json:"address"`
	BlockHash        string             `json:"blockHash"`
	BlockNumber      hexutil.Uint64     `json:"blockNumber"`
	Data             string             `json:"data"`
	LogIndex         hexutil.Uint64     `json:"logIndex"`
	Removed          bool               `json:"removed"`
	Topics           []string           `json:"topics"`
	TransactionHash  eth_common.Hash    `json:"transactionHash"`
	TransactionIndex hexutil.Uint64     `json:"transactionIndex"`
}

func (s Log) Key() string {
	return fmt.Sprintf("%+v/%+v", s.Address, strings.Join(s.Topics, "/"))
}

type Receipt struct {
	BlockHash         string         `json:"blockHash"`
	BlockNumber       hexutil.Uint64 `json:"blockNumber"`
	ContractAddress   string         `json:"contractAddress"`
	CumulativeGasUsed hexutil.U256   `json:"cumulativeGasUsed"`
	EffectiveGasPrice *hexutil.U256  `json:"effectiveGasPrice,omitempty"`
	From              string         `json:"from"`
	GasUsed           hexutil.U256   `json:"gasUsed"`
	Logs              []Log          `json:"logs"`
	Status            hexutil.Uint64 `json:"status"`
	To                string         `json:"to"`
	TransactionHash   string         `json:"transactionHash"`
	TransactionIndex  hexutil.Uint64 `json:"transactionIndex"`
	Type              hexutil.Uint64 `json:"type"`
	L1Fee             *hexutil.U256  `json:"l1Fee"`
	GasUsedForL1      *hexutil.U256  `json:"gasUsedForL1"`
	feeInfoOnce       sync.Once
	FeeInfo           map[string]decimal.Decimal `json:"feeInfo"`
	Nonce             string                     `json:"nonce"`       //evm nonce
	Transaction       json.RawMessage            `json:"transaction"` //evm transaction
}

type BlockTraceSimple struct {
	BlockHash string `json:"blockHash"` // 通过trace_block接口返回的有此字段 例如eth ,debug_traceBlockByNumber没有此字段
	TxHash    string `json:"txHash"`    // 通过debug_traceBlockByNumber接口返回的有此字段 例如bsc
}

func (s *Receipt) GetEffectiveGasPrice() string {
	if s.EffectiveGasPrice == nil {
		return ""
	}
	return s.EffectiveGasPrice.String()
}

func (s *Receipt) GetL1Fee() string {
	if s.L1Fee == nil {
		return ""
	}
	return s.L1Fee.String()
}

func (s *Receipt) GetGasUsedForL1() string {
	if s.GasUsedForL1 == nil {
		return ""
	}
	return s.GasUsedForL1.String()
}

func (receipt *Receipt) GetTransactionFee(gasPriceForTx *hexutil.U256) (
	decimal.Decimal, decimal.Decimal, decimal.Decimal, error) {
	receipt.feeInfoOnce.Do(func() {
		if len(receipt.FeeInfo) > 0 {
			return
		}
		gasUsed, ok := utils.HexToDecimal(receipt.GasUsed.String())
		if !ok {
			return
		}
		txGasPrice := receipt.EffectiveGasPrice
		if txGasPrice == nil {
			txGasPrice = gasPriceForTx
		}
		var gasPrice decimal.Decimal
		if txGasPrice != nil {
			var ok bool
			gasPrice, ok = utils.HexToDecimal(txGasPrice.String())
			if !ok {
				return
			}
		}
		fee := gasPrice.Mul(gasUsed)
		if receipt.FeeInfo == nil {
			receipt.FeeInfo = make(map[string]decimal.Decimal)
		}
		if receipt.GetL1Fee() != "" {
			l1Fee, ok := utils.HexToDecimal(receipt.GetL1Fee())
			if ok {
				fee = fee.Add(l1Fee)
				receipt.FeeInfo["l1Fee"] = l1Fee
			}
		} else if receipt.GetGasUsedForL1() != "" {
			gasUsedForL1, ok := utils.HexToDecimal(receipt.GetGasUsedForL1())
			if ok {
				l1Fee := gasUsedForL1.Mul(gasPrice)
				receipt.FeeInfo["gasUsedForL1"] = gasUsedForL1
				receipt.FeeInfo["gasUsedForL2"] = gasUsed.Sub(gasUsedForL1)
				receipt.FeeInfo["l1Fee"] = l1Fee
			}
		}
		receipt.FeeInfo["fee"] = fee
		receipt.FeeInfo["gas_used"] = gasUsed
		receipt.FeeInfo["gas_price"] = gasPrice
	})
	if receipt.FeeInfo != nil {
		if _, ok := receipt.FeeInfo["fee"]; ok {
			return receipt.FeeInfo["fee"], receipt.FeeInfo["gas_price"], receipt.FeeInfo["gas_used"], nil
		}
	}
	return decimal.Zero, decimal.Zero, decimal.Zero, fmt.Errorf("parse gas used failed, gasPrice: %s", receipt.GasUsed.String())
}

type Transaction struct {
	BlockHash            string          `json:"blockHash"`
	BlockNumber          hexutil.Uint64  `json:"blockNumber"`
	ChainID              *hexutil.Uint64 `json:"chainId,omitempty"`
	From                 string          `json:"from"`
	Gas                  *hexutil.U256   `json:"gas"`
	GasPrice             *hexutil.U256   `json:"gasPrice"`
	Hash                 eth_common.Hash `json:"hash"`
	Input                string          `json:"input"`
	MaxFeePerGas         *hexutil.U256   `json:"maxFeePerGas,omitempty"`
	MaxPriorityFeePerGas *hexutil.U256   `json:"maxPriorityFeePerGas,omitempty"`
	Nonce                json.RawMessage `json:"nonce"`
	To                   string          `json:"to"`
	TransactionIndex     string          `json:"transactionIndex"`
	Type                 string          `json:"type"`
	Value                hexutil.Big     `json:"value"`
}

var (
	OnlySupportDataCallChains = []consts.Chain{
		consts.CHAIN_GTEVM,
		consts.CHAIN_HARMONY,
		consts.CHAIN_ACALA,
		consts.CHAIN_CONFLUX,
		consts.CHAIN_COINEX,
		consts.CHAIN_ELA,
		consts.CHAIN_SBCH,
		consts.CHAIN_NAXION,
		consts.CHAIN_MARO,
		consts.CHAIN_GOCHAIN,
		consts.CHAIN_KARDIACHAIN,
		consts.CHAIN_KARURA,
		consts.CHAIN_OKTC,
		consts.CHAIN_PLATON,
		consts.CHAIN_LAVA,
		consts.CHAIN_VICTION,
	}
)

type EthClient interface {
	BlockNumber(ctx context.Context, r Route) (uint64, error)
	BlockByNumber(ctx context.Context, r Route, number *big.Int) (Block, error)
	BlockByNumberWithTxJsonRaw(ctx context.Context, r Route, number *big.Int) (BlockWithTxJsonRaw, error)
	BlockByNumberWithTxRaw(ctx context.Context, r Route, number *big.Int) (json.RawMessage, error)
	TransactionByHash(ctx context.Context, r Route, txHash eth_common.Hash) (Transaction, error)
	TransactionReceipt(ctx context.Context, r Route, txHash eth_common.Hash) (Receipt, error)
	IsTooManyReqErr(err error) bool
	IsServiceUnavailable(err error) bool
	BlockReceipts(ctx context.Context, r Route, blockNumber *big.Int) ([]Receipt, error)
	BlockReceiptsRaw(ctx context.Context, r Route, blockNumber *big.Int) (json.RawMessage, error)
	DebugTraceCallCallTracer(ctx context.Context, r Route, from, to eth_common.Address, data, value string, stateOverrides map[string]*EthAccountState) (*DebugTraceCallCallTracerResponse, error)
	DebugTraceCallPrestateTracer(ctx context.Context, r Route, from, to eth_common.Address, data string) (*DebugTraceCallPrestateTracerResponse, error)
	ClearBlockCache()
	TraceBlockRaw(ctx context.Context, r Route, blockNumber *big.Int, chain consts.Chain) (json.RawMessage, error)
	NetVersion(ctx context.Context, r Route) (consts.ChainID, error)
}

type EthAccountState struct {
	Balance string            `json:"balance,omitempty"`
	Nonce   uint64            `json:"nonce,omitempty"`
	Code    string            `json:"code,omitempty"`
	Storage map[string]string `json:"storage,omitempty"`
}

type DebugTraceCallPrestateTracerResponse struct {
	Post map[string]*EthAccountState `json:"post,omitempty"`
	Pre  map[string]*EthAccountState `json:"pre,omitempty"`
}

type DebugTraceCallCallTracerResponse struct {
	From         string `json:"from"`
	Gas          string `json:"gas"`
	GasUsed      string `json:"gasUsed"`
	To           string `json:"to"`
	Input        string `json:"input"`
	Output       string `json:"output"`
	Error        string `json:"error"`
	RevertReason string `json:"revertReason"`
	Calls        []Call `json:"calls"`
	Value        string `json:"value"`
	Type         string `json:"type"`
}

type Call struct {
	From         string `json:"from"`
	Gas          string `json:"gas"`
	GasUsed      string `json:"gasUsed"`
	To           string `json:"to"`
	Input        string `json:"input"`
	Output       string `json:"output"`
	Error        string `json:"error"`
	RevertReason string `json:"revertReason"`
	Calls        []Call `json:"calls"`
	Value        string `json:"value"`
	Type         string `json:"type"`
}
type BlockWithTx struct {
	BaseFeePerGas hexutil.Big    `json:"baseFeePerGas"`
	GasLimit      hexutil.Uint64 `json:"gasLimit"`
	GasUsed       hexutil.Uint64 `json:"gasUsed"`
	Hash          string         `json:"hash"`
	Miner         string         `json:"miner"`
	Nonce         string         `json:"nonce"`
	Number        hexutil.Uint64 `json:"number"`
	Timestamp     hexutil.Uint64 `json:"timestamp"`
	Transactions  []Transaction  `json:"transactions"`
}

type BlockWithTxJsonRaw struct {
	BaseFeePerGas hexutil.Big       `json:"baseFeePerGas"`
	GasLimit      hexutil.Uint64    `json:"gasLimit"`
	GasUsed       hexutil.Uint64    `json:"gasUsed"`
	Hash          string            `json:"hash"`
	Miner         string            `json:"miner"`
	Nonce         string            `json:"nonce"`
	Number        hexutil.Uint64    `json:"number"`
	Timestamp     hexutil.Uint64    `json:"timestamp"`
	Transactions  []json.RawMessage `json:"transactions"`
}

type Block struct {
	BaseFeePerGas hexutil.Big    `json:"baseFeePerGas"`
	GasLimit      hexutil.Uint64 `json:"gasLimit"`
	GasUsed       hexutil.Uint64 `json:"gasUsed"`
	Hash          string         `json:"hash"`
	Miner         string         `json:"miner"`
	Number        hexutil.Uint64 `json:"number"`
	Timestamp     hexutil.Uint64 `json:"timestamp"`
	Transactions  []string       `json:"transactions"`
}

type EvmResult struct {
	BlockNumber uint64          `json:"blockNumber"`
	Block       json.RawMessage `json:"block"`
	Receipts    json.RawMessage `json:"receipts"`
	TraceBlock  json.RawMessage `json:"traceBlock"`
}

type BlockInternalTrace struct {
	Result []InternalTrace `json:"result"`
}

type InternalTrace struct {
	Action struct {
		From     string `json:"from"`
		CallType string `json:"callType,omitempty"`
		Gas      string `json:"gas"`
		Input    string `json:"input,omitempty"`
		To       string `json:"to,omitempty"`
		Value    string `json:"value"`
	} `json:"action"`
	BlockHash   string `json:"blockHash"`
	BlockNumber int    `json:"blockNumber"`
	Error       string `json:"error,omitempty"`
	Result      struct {
		Address string `json:"value,omitempty"`
		Code    string `json:"code,omitempty"`
		GasUsed string `json:"gasUsed"`
		Output  string `json:"output,omitempty"`
	} `json:"result"`
	Subtraces           int    `json:"subtraces"`
	TraceAddress        []int  `json:"traceAddress"`
	TransactionHash     string `json:"transactionHash"`
	TransactionPosition int    `json:"transactionPosition"`
	Type                string `json:"type"`
}

type EthClientOpt func(EthClient)

func WithRateLimiter(qps int) EthClientOpt {
	return func(c EthClient) {
		if qps <= 0 {
			return
		}
		rateLimiter, _ := utils.NewRateLimiter(qps)
		switch client := c.(type) {
		case *ethClientImpl:
			lo.ForEach(client.urls, func(url string, _ int) {
				client.rateLimiters[url] = rateLimiter
			})
		case *ethCallWithDataArgClientImpl:
			lo.ForEach(client.urls, func(url string, _ int) {
				client.rateLimiters[url] = rateLimiter
			})
		}
	}
}

func GetEthClient(ctx context.Context, chain consts.Chain, endpoints []string, opts ...EthClientOpt) (EthClient, error) {
	getEthClientSpanCtx, getEthClientSpan := tracelog.StartSpan(ctx, "ethclient", "GetEthClient")
	defer getEthClientSpan.End()
	tl := tracelog.NewWithContext(getEthClientSpanCtx)
	var ethClient EthClient
	var err error
	if lo.Contains(OnlySupportDataCallChains, chain) {
		ethClient, err = NewEthCallWithDataArgClient(getEthClientSpanCtx, endpoints)
	} else {
		switch chain {
		default:
			ethClient, err = NewEthClient(getEthClientSpanCtx, endpoints)
		}
	}
	if err != nil {
		tl.Errorw("GetEthClient failed", "error", err.Error(), "chain", chain, "endpoints", endpoints)
		return nil, err
	}
	for _, opt := range opts {
		opt(ethClient)
	}
	return ethClient, nil
}

type ethClientImpl struct {
	urls         []string
	clients      []*rpc.Client
	blockCache   cmap.ConcurrentMap[string, []Receipt]
	rateLimiters map[string]*utils.RateLimiter
}

func NewEthClient(ctx context.Context, urls []string) (EthClient, error) {
	newEthClientSpanCtx, newEthClientSpan := tracelog.StartSpan(ctx, "ethclient", "NewEthClient")
	defer newEthClientSpan.End()
	tl := tracelog.NewWithContext(newEthClientSpanCtx)
	clients := make([]*rpc.Client, 0, len(urls))
	for _, url := range urls {
		client, err := rpc.DialOptions(ctx, url, rpc.WithHTTPClient(&http.Client{
			Timeout: consts.Eth_Client_Timeout * time.Second,
		}))
		if err != nil {
			tl.Errorw("NewEthClient failed", "error", err.Error(), "url", url)
			return nil, err
		}
		clients = append(clients, client)
	}
	return getEthClientImpl(urls, clients), nil
}

func getEthClientImpl(urls []string, clients []*rpc.Client) *ethClientImpl {
	return &ethClientImpl{urls: urls, clients: clients, blockCache: cmap.New[[]Receipt](), rateLimiters: make(map[string]*utils.RateLimiter)}
}

func (s *ethClientImpl) getClient(r Route) (*rpc.Client, string) {
	switch r {
	default:
		index := rand.Intn(len(s.clients))
		return s.clients[index], s.urls[index]
	}
}

func (s *ethClientImpl) BlockNumber(ctx context.Context, r Route) (uint64, error) {
	// 为区块链查询创建 span，追踪查询时间
	blockNumberSpanCtx, blockNumberSpan := tracelog.StartSpan(ctx, "blockchain", "BlockNumber")
	defer blockNumberSpan.End()

	tl := tracelog.NewWithContext(blockNumberSpanCtx)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("BlockNumber", url).Observe(time.Since(now).Seconds())
	}()

	var bn hexutil.Uint64
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(blockNumberSpanCtx, &bn, "eth_blockNumber")
	})
	if err != nil {
		tl.Warnw("eth_blockNumber failed", "error", adjustErr(err).Error(), "urls", url, "method", "eth_blockNumber")
		return 0, adjustErr(err)
	}
	return uint64(bn), nil

}

func (s *ethClientImpl) toBlockNumArg(number *big.Int) string {
	if number == nil {
		return "latest"
	}
	if number.Cmp(utils.MaxInt256) >= 0 {
		return "pending"
	}
	if number.Sign() >= 0 {
		return hexutil.EncodeBig(number)
	}
	// It's negative.
	if number.IsInt64() {
		return rpc.BlockNumber(number.Int64()).String()
	}
	// It's negative and large, which is invalid.
	return fmt.Sprintf("<invalid %d>", number)
}

func (s *ethClientImpl) BlockByNumber(ctx context.Context, r Route, blockNumber *big.Int) (Block, error) {
	blockByNumberSpanCtx, blockByNumberSpan := tracelog.StartSpan(ctx, "blockchain", "BlockByNumber")
	defer blockByNumberSpan.End()
	tl := tracelog.NewWithContext(blockByNumberSpanCtx)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("BlockByNumber", url).Observe(time.Since(now).Seconds())
	}()
	var block Block
	blockNumberArg := s.toBlockNumArg(blockNumber)
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(blockByNumberSpanCtx, &block, "eth_getBlockByNumber", blockNumberArg, false)
	})
	if err != nil {
		tl.Errorw("BlockByNumber failed", "blockNumber", blockNumberArg, "error", adjustErr(err).Error(),
			"urls", url, "method", "eth_getBlockByNumber", "blockNumberArg", blockNumberArg)
		return Block{}, adjustErr(err)
	}
	if block.Hash == "" {
		tl.Errorf("BlockByNumber returned empty block", "blockNumber", blockNumberArg, "urls", url, "method", "eth_getBlockByNumber")
	}
	return block, nil
}

func (s *ethClientImpl) BlockByNumberWithTxRaw(ctx context.Context, r Route, blockNumber *big.Int) (json.RawMessage, error) {
	// 为区块链查询创建 span，追踪查询时间
	blockByNumberWithTxRawSpanCtx, blockByNumberWithTxRawSpan := tracelog.StartSpan(ctx, "blockchain", "BlockByNumberWithTxRaw")
	defer blockByNumberWithTxRawSpan.End()

	tl := tracelog.NewWithContext(blockByNumberWithTxRawSpanCtx)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("BlockByNumberWithTxRaw", url).Observe(time.Since(now).Seconds())
	}()
	var block json.RawMessage
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(blockByNumberWithTxRawSpanCtx, &block, "eth_getBlockByNumber", s.toBlockNumArg(blockNumber), true)
	})
	if err != nil {
		tl.Errorw("BlockByNumberWithTxRaw failed", "error", adjustErr(err).Error(),
			"urls", url, "method", "eth_getBlockByNumber", "blockNumberArg", s.toBlockNumArg(blockNumber))
		return nil, adjustErr(err)
	}
	var blockWithTx BlockWithTx
	err = json.Unmarshal(block, &blockWithTx)
	if err != nil {
		tl.Errorw("BlockByNumberWithTxRaw JsonUnmarshal failed", "error", adjustErr(err).Error(),
			"urls", url, "method", "eth_getBlockByNumber", "blockNumberArg", s.toBlockNumArg(blockNumber))
		return nil, adjustErr(err)
	}

	if blockWithTx.Hash == "" {
		tl.Errorf("BlockByNumberWithTxRaw returned empty block", "blockNumber", blockNumber, "urls", url, "method", "eth_getBlockByNumber")
	}

	return block, nil
}

func (s *ethClientImpl) BlockByNumberWithTxJsonRaw(ctx context.Context, r Route, blockNumber *big.Int) (BlockWithTxJsonRaw, error) {
	blockByNumberWithTxJsonRawSpanCtx, blockByNumberWithTxJsonRawSpan := tracelog.StartSpan(ctx, "blockchain", "BlockByNumberWithTxJsonRaw")
	defer blockByNumberWithTxJsonRawSpan.End()
	tl := tracelog.NewWithContext(blockByNumberWithTxJsonRawSpanCtx)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("BlockByNumberWithTxJsonRaw", url).Observe(time.Since(now).Seconds())
	}()
	var block BlockWithTxJsonRaw
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(blockByNumberWithTxJsonRawSpanCtx, &block, "eth_getBlockByNumber", s.toBlockNumArg(blockNumber), true)
	})
	if err != nil {
		tl.Errorw("BlockByNumberWithTxJsonRaw BlockByNumber failed", "error", adjustErr(err).Error(),
			"urls", url, "method", "eth_getBlockByNumber", "blockNumberArg", s.toBlockNumArg(blockNumber))
		return BlockWithTxJsonRaw{}, adjustErr(err)
	}
	return block, nil
}

func (s *ethClientImpl) TransactionByHash(ctx context.Context, r Route, txHash eth_common.Hash) (Transaction, error) {
	transactionByHashSpanCtx, transactionByHashSpan := tracelog.StartSpan(ctx, "blockchain", "TransactionByHash")
	defer transactionByHashSpan.End()
	tl := tracelog.NewWithContext(transactionByHashSpanCtx)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("TransactionByHash", url).Observe(time.Since(now).Seconds())
	}()
	var transaction Transaction
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(transactionByHashSpanCtx, &transaction, "eth_getTransactionByHash", txHash)
	})
	if err != nil {
		tl.Warn("eth_getTransactionByHash failed", "error", adjustErr(err).Error(), "urls", url, "method", "eth_getTransactionByHash", "txHash", txHash)
		return transaction, adjustErr(err)
	}
	return transaction, nil
}

func (s *ethClientImpl) TransactionReceipt(ctx context.Context, r Route, txHash eth_common.Hash) (Receipt, error) {
	transactionReceiptSpanCtx, transactionReceiptSpan := tracelog.StartSpan(ctx, "blockchain", "TransactionReceipt")
	defer transactionReceiptSpan.End()
	tl := tracelog.NewWithContext(transactionReceiptSpanCtx)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("TransactionReceipt", url).Observe(time.Since(now).Seconds())
	}()
	var receipt Receipt
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(transactionReceiptSpanCtx, &receipt, "eth_getTransactionReceipt", txHash)
	})
	if err != nil {
		tl.Warn("eth_getTransactionReceipt failed", "error", adjustErr(err).Error(), "urls", url, "method", "eth_getTransactionReceipt", "txHash", txHash)
		return Receipt{}, adjustErr(err)
	}
	return receipt, nil
}

func adjustErr(err error) error {
	if dataErr, ok := err.(rpc.DataError); ok {
		return fmt.Errorf("message: %s, data: %s", err.Error(), dataErr.ErrorData())
	}
	return err
}

func (s *ethClientImpl) IsTooManyReqErr(err error) bool {
	if rpcErr, ok := err.(rpc.HTTPError); ok {
		return rpcErr.StatusCode == http.StatusTooManyRequests
	}
	return false
}

func (s *ethClientImpl) IsServiceUnavailable(err error) bool {
	if urlErr, ok := err.(net.Error); ok {
		return urlErr.Timeout()
	}
	if rpcErr, ok := err.(rpc.HTTPError); ok {
		return rpcErr.StatusCode == http.StatusGatewayTimeout || rpcErr.StatusCode == http.StatusServiceUnavailable
	}
	return false
}

func (s *ethClientImpl) BlockReceipts(ctx context.Context, r Route, blockNumber *big.Int) ([]Receipt, error) {
	blockReceiptsSpanCtx, blockReceiptsSpan := tracelog.StartSpan(ctx, "blockchain", "BlockReceipts")
	defer blockReceiptsSpan.End()
	tl := tracelog.NewWithContext(blockReceiptsSpanCtx)
	if v, ok := s.blockCache.Get(blockNumber.String()); ok {
		return v, nil
	}
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("TransactionReceipt", url).Observe(time.Since(now).Seconds())
	}()
	receipts := make([]Receipt, 0)
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(blockReceiptsSpanCtx, &receipts, "eth_getBlockReceipts", s.toBlockNumArg(blockNumber))
	})
	if err != nil {
		tl.Warnw("eth_getBlockReceipts failed", "error", adjustErr(err).Error(), "urls", url, "method", "eth_getBlockReceipts", "blockNumber", s.toBlockNumArg(blockNumber))
		return nil, adjustErr(err)
	}
	s.blockCache.Set(blockNumber.String(), receipts)
	return receipts, nil
}

func (s *ethClientImpl) BlockReceiptsRaw(ctx context.Context, r Route, blockNumber *big.Int) (json.RawMessage, error) {
	// 为区块链查询创建 span，追踪查询时间
	blockReceiptsRawSpanCtx, blockReceiptsRawSpan := tracelog.StartSpan(ctx, "blockchain", "BlockReceiptsRaw")
	defer blockReceiptsRawSpan.End()

	tl := tracelog.NewWithContext(blockReceiptsRawSpanCtx)

	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("TransactionReceiptRaw", url).Observe(time.Since(now).Seconds())
	}()
	var receipts json.RawMessage
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(blockReceiptsRawSpanCtx, &receipts, "eth_getBlockReceipts", s.toBlockNumArg(blockNumber))
	})
	if err != nil {
		tl.Warnw("eth_getBlockReceiptsRaw failed", "error", adjustErr(err).Error(), "urls", url, "method", "eth_getBlockReceipts", "blockNumber", s.toBlockNumArg(blockNumber))
		return nil, adjustErr(err)
	}

	return receipts, nil
}

func (s *ethClientImpl) DebugTraceCallCallTracer(ctx context.Context, r Route, from, to eth_common.Address, data, value string,
	stateOverrides map[string]*EthAccountState) (*DebugTraceCallCallTracerResponse, error) {
	debugTraceCallCallTracerSpanCtx, debugTraceCallCallTracerSpan := tracelog.StartSpan(ctx, "blockchain", "DebugTraceCallCallTracer")
	defer debugTraceCallCallTracerSpan.End()
	tl := tracelog.NewWithContext(debugTraceCallCallTracerSpanCtx)
	tl.Infow("DebugTraceCallCallTracer", "from", from, "to", to)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("DebugTraceCallCallTracer", url).Observe(time.Since(now).Seconds())
	}()

	type ethAccountStateOverride struct {
		Balance   string            `json:"balance,omitempty"`
		Nonce     string            `json:"nonce,omitempty"` // hex string
		Code      string            `json:"code,omitempty"`
		Statediff map[string]string `json:"statediff,omitempty"`
	}

	var convertedStateOverrides map[string]*ethAccountStateOverride
	if len(stateOverrides) > 0 {
		convertedStateOverrides = make(map[string]*ethAccountStateOverride, len(stateOverrides))
		for addr, state := range stateOverrides {
			convertedStateOverrides[addr] = &ethAccountStateOverride{
				Balance:   state.Balance,
				Nonce:     fmt.Sprintf("0x%x", state.Nonce),
				Statediff: state.Storage,
			}
		}
	}

	result := &DebugTraceCallCallTracerResponse{}
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(
			debugTraceCallCallTracerSpanCtx,
			result,
			"debug_traceCall",
			map[string]any{
				"from":  from,
				"to":    to,
				"data":  data,
				"value": value,
			},
			"latest",
			map[string]any{
				"tracer":           "callTracer",
				"enableMemory":     false,
				"enableReturnData": false,
				"disableStorage":   true,
				"disableStack":     true,
				"tracerConfig": map[string]any{
					"diffMode": true,
				},
				"stateOverrides": convertedStateOverrides,
			},
		)
	})
	if err != nil {
		return nil, errors.WithMessage(err, "debug_traceCall with callTracer err")
	}

	if result.Error != "" || result.RevertReason != "" {
		return nil, fmt.Errorf("debug_traceCall with callTracer failed, error: %s, revertReason: %s", result.Error, result.RevertReason)
	}

	return result, nil
}

func (s *ethClientImpl) DebugTraceCallPrestateTracer(ctx context.Context, r Route, from, to eth_common.Address, data string) (
	*DebugTraceCallPrestateTracerResponse, error) {
	debugTraceCallPrestateTracerSpanCtx, debugTraceCallPrestateTracerSpan := tracelog.StartSpan(ctx, "blockchain", "DebugTraceCallPrestateTracer")
	defer debugTraceCallPrestateTracerSpan.End()
	tl := tracelog.NewWithContext(debugTraceCallPrestateTracerSpanCtx)
	tl.Infow("DebugTraceCallPrestateTracer", "from", from, "to", to)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("DebugTraceCallPrestateTracer", url).Observe(time.Since(now).Seconds())
	}()
	result := &DebugTraceCallPrestateTracerResponse{}
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(
			debugTraceCallPrestateTracerSpanCtx,
			result,
			"debug_traceCall",
			map[string]any{
				"from": from,
				"to":   to,
				"data": data,
			},
			"latest",
			map[string]any{
				"tracer":           "prestateTracer",
				"enableMemory":     false,
				"enableReturnData": false,
				"disableStorage":   true,
				"disableStack":     true,
				"tracerConfig": map[string]any{
					"diffMode": true,
				},
			},
		)
	})
	if err != nil {
		return nil, errors.WithMessage(err, "debug_traceCall with prestateTracer err")
	}
	return result, nil
}

func (s *ethClientImpl) ClearBlockCache() {
	s.blockCache.Clear()
}

func (s *ethClientImpl) TraceBlockRaw(ctx context.Context, r Route, blockNumber *big.Int, chain consts.Chain) (json.RawMessage, error) {
	// 为区块链查询创建 span，追踪查询时间
	traceBlockRawSpanCtx, traceBlockRawSpan := tracelog.StartSpan(ctx, "blockchain", "TraceBlockRaw")
	defer traceBlockRawSpan.End()

	tl := tracelog.NewWithContext(traceBlockRawSpanCtx)
	var err error
	var traceResult json.RawMessage
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("TraceBlockRaw", url).Observe(time.Since(now).Seconds())
		status := consts.Success_Status
		if err != nil {
			status = consts.Failed_Status
		}
		TraceBlockRawRequestDuration.WithLabelValues(status, url).Observe(time.Since(now).Seconds())
	}()

	blockNumberArg := s.toBlockNumArg(blockNumber)

	method := consts.Debug_TraceBlockByNumber
	// var tracerConfigs map[string]interface{}
	tracerConfigs := consts.Tracer_Configs
	if chain == consts.CHAIN_ARBITRUM {
		blockNumInt, convErr := new(big.Int).SetString(fmt.Sprintf("%v", blockNumber), 10)
		if convErr && blockNumInt.Cmp(big.NewInt(22207817)) > 0 {
			method = consts.Debug_TraceBlockByNumber
		} else if convErr {
			method = consts.Arbitrum_Trace_Block
			// arbtrace_block 不需要tracer配置
			tracerConfigs = nil
		}
	}

	// // 根据不同链选择合适的方法和配置
	// switch chain {
	// // case consts.CHAIN_BLAST, consts.CHAIN_ZK, consts.CHAIN_OP, consts.CHAIN_BSC, consts.CHAIN_POLYGON, consts.CHAIN_LINEA:
	// // 	method = consts.Debug_TraceBlockByNumber
	// // 	// debug_traceBlockByNumber 需要tracer配置
	// // 	tracerConfigs = consts.Tracer_Configs
	// // case consts.CHAIN_AVALANCHE:
	// // 	method = consts.Debug_TraceBlockByNumber
	// // 	tracerConfigs = consts.Tracer_Configs
	// case consts.CHAIN_ARBITRUM:
	// 	// arbtrace_block   0-22207816
	// 	// debug_traceBlockByNumber  >22207817
	// 	// blockNumberArg 可能为字符串（如 "latest"）或十进制字符串，需要转换为 int64 进行比较
	// 	blockNumInt, convErr := new(big.Int).SetString(fmt.Sprintf("%v", blockNumber), 10)
	// 	if convErr && blockNumInt.Cmp(big.NewInt(22207817)) > 0 {
	// 		method = consts.Debug_TraceBlockByNumber
	// 		// debug_traceBlockByNumber 需要tracer配置
	// 		tracerConfigs = consts.Tracer_Configs
	// 	} else if convErr {
	// 		method = consts.Arbitrum_Trace_Block
	// 		// arbtrace_block 不需要tracer配置
	// 		tracerConfigs = nil
	// 	} else {
	// 		// 兜底，防止类型不匹配导致 panic
	// 		method = consts.Debug_TraceBlockByNumber
	// 		// debug_traceBlockByNumber 需要tracer配置
	// 		tracerConfigs = consts.Tracer_Configs
	// 	}
	// default:
	// 	// trace_block 不需要tracer配置
	// 	tracerConfigs = nil
	// }

	tl.Infow("trace_block", "method", method, "blockNumber", s.toBlockNumArg(blockNumber), "tracerConfigs", tracerConfigs, "chain", chain)

	// 使用重试机制调用RPC方法
	err = utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return retry.Do(
			func() error {
				var callErr error
				if tracerConfigs != nil {
					callErr = client.CallContext(traceBlockRawSpanCtx, &traceResult, method, blockNumberArg, tracerConfigs)
				} else {
					callErr = client.CallContext(traceBlockRawSpanCtx, &traceResult, method, blockNumberArg)
				}
				return callErr
			},
			retry.Attempts(3),                   // 最多重试3次
			retry.Delay(1*time.Second),          // 基础延迟1秒
			retry.DelayType(retry.BackOffDelay), // 使用指数退避
			retry.LastErrorOnly(true),           // 只返回最后一次错误
			retry.OnRetry(func(n uint, err error) {
				tl.Warnw("trace_block_raw retry",
					"attempt", n+1,
					"max_attempts", 3,
					"error", err.Error(),
					"url", url,
					"method", method,
					"blockNumber", blockNumberArg,
					"chain", chain)
			}),
			retry.RetryIf(func(err error) bool {
				// 所有错误都进行重试
				tl.Infow("trace_block_raw will retry",
					"reason", "all errors retry",
					"error", err.Error(),
					"url", url,
					"method", method,
					"blockNumber", blockNumberArg,
					"chain", chain)
				return true
			}),
		)
	})

	if err != nil {
		tl.Errorw("trace_block_raw failed",
			"error", adjustErr(err).Error(),
			"urls", url,
			"method", method,
			"blockNumber", s.toBlockNumArg(blockNumber),
			"traceResult", traceResult)
		return nil, adjustErr(err)
	}

	return traceResult, err
}

func (s *ethClientImpl) NetVersion(ctx context.Context, r Route) (consts.ChainID, error) {
	netVersionSpanCtx, netVersionSpan := tracelog.StartSpan(ctx, "blockchain", "NetVersion")
	defer netVersionSpan.End()
	tl := tracelog.NewWithContext(netVersionSpanCtx)
	client, url := s.getClient(r)
	now := time.Now()
	defer func() {
		RequestDuration.WithLabelValues("NetVersion", url).Observe(time.Since(now).Seconds())
	}()
	var netVersion string
	err := utils.DoRateLimiterLogic(s.rateLimiters[url], func() error {
		return client.CallContext(netVersionSpanCtx, &netVersion, "net_version")
	})
	if err != nil {
		tl.Errorw("NetVersion failed", "error", adjustErr(err).Error(), "urls", url, "method", "net_version")
		return 0, err
	}
	netVersionInt, err := strconv.Atoi(netVersion)
	if err != nil {
		tl.Errorw("NetVersion failed", "error", err.Error(), "urls", url, "method", "net_version")
		return 0, err
	}
	return consts.ChainID(netVersionInt), nil
}
