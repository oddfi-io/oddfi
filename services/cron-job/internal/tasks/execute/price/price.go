package price

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/shopspring/decimal"

	"oddfi-cron-job/internal/logger"
	"oddfi-cron-job/internal/redis"
)

const (
	pairAddress  = "0x7fc4d615bab4e06d2bb3f4c4ea02374e28773ab4"
	tokenSymbol  = "odd"
	bscChain     = "bsc"
	tokenDecimal = 18
	endPoint     = "https://bnb-mainnet.g.alchemy.com/v2/deHKMj6sxxxUn7h0uIzHt"
)

// GetPriceByV2PairTask 从 Uniswap V2 Pair 获取价格（每分钟执行）
type GetPriceByV2PairTask struct{}

// NewPriceTask 创建价格任务
func NewPriceTask() *GetPriceByV2PairTask {
	return &GetPriceByV2PairTask{}
}

// NewPriceTaskWithEndpoint 创建带 endpoint 的任务实例
func NewPriceTaskWithEndpoint() *GetPriceByV2PairTask {
	return &GetPriceByV2PairTask{}
}

func (t *GetPriceByV2PairTask) Name() string {
	return "get_price_by_v2_pair_task"
}

func (t *GetPriceByV2PairTask) Schedule() string {
	return "* * * * *" // 每分钟
}

func (t *GetPriceByV2PairTask) Execute(ctx context.Context) error {
	logger.Infof("[%s] Execution at %s", t.Name(), time.Now().Format("15:04:05"))

	if endPoint == "" {
		logger.Warnf("[%s] endPoint is empty, skipping BSC call", t.Name())
		return nil
	}

	// 步骤1: 创建 ethclient 连接
	client, err := ethclient.Dial(endPoint)
	if err != nil {
		logger.Errorf("[%s] Failed to connect to BSC: %v", t.Name(), err)
		return err
	}
	defer client.Close()

	// 步骤2: 解析 ABI
	parsedABI, err := abi.JSON(strings.NewReader(uniswapV2PairABI))
	if err != nil {
		logger.Errorf("[%s] Failed to parse ABI: %v", t.Name(), err)
		return err
	}

	// 步骤3: 构建 getReserves 调用数据
	pairAddr := common.HexToAddress(pairAddress)
	callData, err := parsedABI.Pack("getReserves")
	if err != nil {
		logger.Errorf("[%s] Failed to pack call data: %v", t.Name(), err)
		return err
	}

	// 步骤4: 调用合约
	result, err := client.CallContract(ctx, ethereum.CallMsg{
		To:   &pairAddr,
		Data: callData,
	}, nil)
	if err != nil {
		logger.Errorf("[%s] Failed to call getReserves: %v", t.Name(), err)
		return err
	}

	// 步骤5: 解码结果
	values, err := parsedABI.Unpack("getReserves", result)
	if err != nil {
		logger.Errorf("[%s] Failed to unpack result: %v", t.Name(), err)
		return err
	}

	// 步骤6: 提取并打印结果
	// abi.Unpack 返回的是 *big.Int，需要解引用
	reserve0 := *values[0].(*big.Int)
	reserve1 := *values[1].(*big.Int)
	reserve0Dec := decimal.NewFromBigInt(&reserve0, 0)
	reserve1Dec := decimal.NewFromBigInt(&reserve1, 0)
	blockTimestampLast := values[2].(uint32)
	priceDec := reserve0Dec.Div(reserve1Dec)

	logger.Infof("[%s] price:%s, Reserve0: %s, Reserve1: %s, BlockTimestampLast: %d",
		t.Name(),
		priceDec.String(),
		reserve0.String(),
		reserve1.String(),
		blockTimestampLast,
	)

	_, err = redis.GetClient().Set(ctx, priceKey(bscChain, tokenSymbol), priceDec.String(), 0).Result()
	if err != nil {
		logger.Errorf("[%s] Failed to set price to redis, key:%s, err:%v",
			t.Name(),
			priceKey(bscChain, tokenSymbol),
			err)
		return err
	}

	return nil
}

func priceKey(chain string, symbol string) string {
	return fmt.Sprintf("market:price:%s:%s", chain, symbol)
}

// uniswapV2PairABI UniswapV2 Pair 合约的 getReserves 方法 ABI
var uniswapV2PairABI = `[
	{
		"inputs": [],
		"name": "getReserves",
		"outputs": [
			{"internalType": "uint112", "name": "reserve0", "type": "uint112"},
			{"internalType": "uint112", "name": "reserve1", "type": "uint112"},
			{"internalType": "uint32", "name": "blockTimestampLast", "type": "uint32"}
		],
		"stateMutability": "view",
		"type": "function"
	}
]`
