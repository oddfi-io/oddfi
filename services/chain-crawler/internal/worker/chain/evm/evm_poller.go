package evm

import (
	"chain_crawler/internal/config"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/ethclient"
	"chain_crawler/pkg/kafka"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/utils"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"sort"
	"time"

	"github.com/avast/retry-go/v4"
	"github.com/samber/lo"
	"github.com/sourcegraph/conc/pool"
)

const (
	MinEVMPollerGoPoolNumber = 1
	MaxEVMPollerGoPoolNumber = 32
	DefaultMaxSendKafKaRetry = uint(3)
)

type EvmPoller struct {
	taskName      string
	chain         consts.Chain
	topic         string
	kafkaCfg      *config.KafkaConfig
	evmClient     ethclient.EthClient
	kafkaProducer kafka.Producer
	isDelay       bool
}

func NewEvmPoller(cfg *config.KafkaConfig, topic, taskName string, chain consts.Chain, evmClient ethclient.EthClient, isDelay bool) (*EvmPoller, error) {
	if topic == "" {
		return nil, errors.New("kafka topic is empty")
	}
	return &EvmPoller{
		taskName:      taskName,
		chain:         chain,
		topic:         topic,
		kafkaCfg:      cfg,
		evmClient:     evmClient,
		isDelay:       isDelay,
		kafkaProducer: kafka.NewHugeMessageProducer(cfg.Host, fmt.Sprintf("%+v-%+v", topic, chain.ToString()), cfg.UserName, cfg.Password),
	}, nil
}

func (poller *EvmPoller) GetEvmChainData(ctx context.Context, fromBlock, toBlock uint64) ([]ethclient.EvmResult, uint64, error) {
	// 为区块链查询创建 span，追踪查询时间
	evmChainDataSpanCtx, evmChainDataSpan := tracelog.StartSpan(ctx, "blockchain", "GetEvmChainData")
	defer evmChainDataSpan.End()

	tl := tracelog.NewWithContext(evmChainDataSpanCtx)
	tl = tl.With("taskName", poller.taskName, "chain", poller.chain, "from", fromBlock, "to", toBlock, "count", toBlock-fromBlock+1)
	if toBlock < fromBlock {
		tl.Errorw("GetEvmChainData failed", "fromBlock", fromBlock, "toBlock", toBlock, "error", "toBlock is smaller than fromBlock")
		return nil, 0, errors.New("toBlock is smaller than fromBlock")
	}
	goSize := toBlock - fromBlock + 1
	if goSize < MinEVMPollerGoPoolNumber {
		goSize = MinEVMPollerGoPoolNumber
	} else if goSize > MaxEVMPollerGoPoolNumber {
		goSize = MaxEVMPollerGoPoolNumber
	}
	blockFetchPool := pool.NewWithResults[ethclient.EvmResult]().
		WithErrors().
		WithContext(ctx).
		WithMaxGoroutines(int(goSize))
	for i := fromBlock; i <= toBlock; i++ {
		blockNumber := i
		blockFetchPool.Go(func(ctx context.Context) (ethclient.EvmResult, error) {
			return poller.GetCheckedBlockDataWithRetry(ctx, blockNumber)
		})
	}
	results, err := blockFetchPool.Wait()
	if err != nil {
		tl.Errorw("EvmPoller GetCheckedBlockDataWithRetry failed", "error", err.Error())
		return nil, 0, err
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].BlockNumber < results[j].BlockNumber
	})

	poller.evmClient.ClearBlockCache()
	tl.Infow("EvmPoller 爬取数据成功")
	return results, toBlock + 1, nil
}

func (ep *EvmPoller) GetCheckedBlockDataWithRetry(ctx context.Context, blockNumber uint64) (ethclient.EvmResult, error) {
	// 为区块链查询创建 span，追踪查询时间
	checkedBlockDataSpanCtx, checkedBlockDataSpan := tracelog.StartSpan(ctx, "blockchain", "GetCheckedBlockDataWithRetry")
	defer checkedBlockDataSpan.End()

	tl := tracelog.NewWithContext(checkedBlockDataSpanCtx)
	evmResultMap := make(map[string]*ethclient.EvmResult)
	for i := 1; i <= 3; i++ {
		if i > 1 {
			tl.Errorw("evmClient.getBlockDataWithRetry try getData again", "time", i, "block_number", blockNumber, "chain", ep.chain)
			sleepTime := time.Duration((i-1)*500) * time.Millisecond
			time.Sleep(sleepTime)
		}

		data, err := ep.getEvmChainData(checkedBlockDataSpanCtx, blockNumber)
		if err != nil {
			tl.Errorw("evmClient.getBlockDataWithRetry getData failed", "error", err.Error(), "block_number", blockNumber, "chain", ep.chain)
			return ethclient.EvmResult{}, err
		}
		tl.Infow("evmClient.getBlockDataWithRetry getData success", "block_number", blockNumber, "chain", ep.chain)

		blockHash, err := ep.checkBlockData(checkedBlockDataSpanCtx, data, blockNumber, evmResultMap)
		if err != nil {
			tl.Errorw("evmClient.getBlockDataWithRetry checkData failed", "error", err.Error(), "block_number", blockNumber, "chain", ep.chain)
			return ethclient.EvmResult{}, err
		}

		if blockHash != "" {
			result := *evmResultMap[blockHash]
			tl.Infow("evmClient.GetCheckedBlockDataWithRetry success", "chain", ep.chain, "block_number", blockNumber, "retry time", i-1)
			return result, nil
		}
	}

	tl.Errorw("evmClient.GetCheckedBlockDataWithRetry fail", "chain", ep.chain, "block_number", blockNumber)
	return ethclient.EvmResult{}, nil
}

// 去掉 trace data 的处理
func (ep *EvmPoller) checkBlockData(ctx context.Context, ethResult ethclient.EvmResult, blockNumber uint64, evmResultMap map[string]*ethclient.EvmResult) (string, error) {
	// 为区块链查询创建 span，追踪查询时间
	checkedBlockDataSpanCtx, checkedBlockDataSpan := tracelog.StartSpan(ctx, "blockchain", "checkBlockData")
	defer checkedBlockDataSpan.End()

	tl := tracelog.NewWithContext(checkedBlockDataSpanCtx)
	var blockWithTx ethclient.BlockWithTx
	err := json.Unmarshal(ethResult.Block, &blockWithTx)
	if err != nil {
		tl.Errorw("evmClient.getBlockDataWithRetry.checkData Unmarshal Block failed", "error", err.Error(), "block_number", blockNumber, "chain", ep.chain)
		return "", err
	} else {
		hashResult := lo.ValueOr(evmResultMap, blockWithTx.Hash, &ethclient.EvmResult{})
		hashResult.Block = ethResult.Block
		hashResult.BlockNumber = blockNumber
		evmResultMap[blockWithTx.Hash] = hashResult
	}

	var receipts []*ethclient.Receipt
	err = json.Unmarshal(ethResult.Receipts, &receipts)
	if err != nil {
		tl.Errorw("evmClient.getBlockDataWithRetry.checkData Unmarshal Receipt failed", "error", err.Error(), "block_number", blockNumber, "chain", ep.chain)
		return "", err
	} else {
		if len(receipts) > 0 {
			hashResult := lo.ValueOr(evmResultMap, receipts[0].BlockHash, &ethclient.EvmResult{})
			hashResult.Receipts = ethResult.Receipts
			evmResultMap[blockWithTx.Hash] = hashResult
		} else {
			hashResult := lo.ValueOr(evmResultMap, blockWithTx.Hash, &ethclient.EvmResult{})
			hashResult.Receipts = ethResult.Receipts
			evmResultMap[blockWithTx.Hash] = hashResult
		}
	}

	// var traces []*ethclient.BlockTraceSimple
	// err = json.Unmarshal(ethResult.TraceBlock, &traces)
	// if err != nil {
	// 	tl.Errorw("evmClient.getBlockDataWithRetry.checkData Unmarshal traces failed", "error", err.Error(), "block_number", blockNumber, "chain", ep.chain)
	// 	return "", err
	// } else {
	// 	if len(traces) > 0 {
	// 		// 如果存在BlockHash,则代表是trace_block接口的返回值,否则是debug_traceBlockByNumber接口的返回值
	// 		if traces[0].BlockHash != "" {
	// 			hashResult := lo.ValueOr(evmResultMap, traces[0].BlockHash, &ethclient.EvmResult{})
	// 			hashResult.TraceBlock = ethResult.TraceBlock
	// 			evmResultMap[traces[0].BlockHash] = hashResult
	// 		} else {
	// 			// debug_traceBlockByNumber 接口的返回值,检查 traces txHash列表是否是receipts txHash列表的子集,若是,则使用receipt的blockHash,否则丢弃
	// 			traceTxSet := lo.SliceToMap(traces, func(item *ethclient.BlockTraceSimple) (string, struct{}) {
	// 				return item.TxHash, struct{}{}
	// 			})
	// 			receiptTxSet := lo.SliceToMap(receipts, func(item *ethclient.Receipt) (string, struct{}) {
	// 				return item.TransactionHash, struct{}{}
	// 			})

	// 			isSubset := true
	// 			for tx := range traceTxSet {
	// 				if _, ok := receiptTxSet[tx]; !ok && tx != "" {
	// 					isSubset = false
	// 					break
	// 				}
	// 			}

	// 			if isSubset {
	// 				hashResult := lo.ValueOr(evmResultMap, receipts[0].BlockHash, &ethclient.EvmResult{})
	// 				hashResult.TraceBlock = ethResult.TraceBlock
	// 				evmResultMap[receipts[0].BlockHash] = hashResult
	// 			}
	// 		}
	// 	} else {
	// 		hashResult := lo.ValueOr(evmResultMap, blockWithTx.Hash, &ethclient.EvmResult{})
	// 		hashResult.TraceBlock = ethResult.TraceBlock
	// 		evmResultMap[blockWithTx.Hash] = hashResult
	// 	}
	// }

	// for blockHash, hashResult := range evmResultMap {
	// 	if hashResult.BlockNumber == 0 || len(hashResult.Block) == 0 || len(hashResult.Receipts) == 0 || len(hashResult.TraceBlock) == 0 {
	// 		continue
	// 	} else {
	// 		return blockHash, nil
	// 	}
	// }

	return blockWithTx.Hash, nil
}

// 暂时不用 debug_traceBlockByNumber 方法获取，只过滤log
func (poller *EvmPoller) getEvmChainData(ctx context.Context, blockNumber uint64) (ethclient.EvmResult, error) {
	// 为区块链查询创建 span，追踪查询时间
	evmChainDataSpanCtx, evmChainDataSpan := tracelog.StartSpan(ctx, "blockchain", "getEvmChainData")
	defer evmChainDataSpan.End()

	tl := tracelog.NewWithContext(evmChainDataSpanCtx)
	block, err := poller.evmClient.BlockByNumberWithTxRaw(evmChainDataSpanCtx, ethclient.RouteRandom, big.NewInt(int64(blockNumber)))
	if err != nil {
		tl.Errorw("evmClient.BlockByNumberWithTxRaw failed", "block_number", blockNumber, "error", err.Error())
		return ethclient.EvmResult{}, err
	}
	tl.Infow("evmClient.BlockByNumberWithTxRaw success", "block_number", blockNumber, "chain", poller.chain)
	receipts, err := poller.evmClient.BlockReceiptsRaw(evmChainDataSpanCtx, ethclient.RouteRandom, big.NewInt(int64(blockNumber)))
	if err != nil {
		tl.Errorw("evmClient.BlockReceiptsRaw failed", "block_number", blockNumber, "error", err.Error())
		return ethclient.EvmResult{}, err
	}
	tl.Infow("evmClient.BlockReceiptsRaw success", "block_number", blockNumber, "chain", poller.chain)
	// traceBlock, err := poller.evmClient.TraceBlockRaw(evmChainDataSpanCtx, ethclient.RouteRandom, big.NewInt(int64(blockNumber)), poller.chain)
	// if err != nil {
	// 	tl.Errorw("evmClient.TraceBlockRaw failed", "block_number", blockNumber, "error", err.Error())
	// 	return ethclient.EvmResult{}, err
	// }
	tl.Infow("evmClient.TraceBlockRaw success", "block_number", blockNumber, "chain", poller.chain)
	return ethclient.EvmResult{
		BlockNumber: blockNumber,
		Block:       block,
		Receipts:    receipts,
		// TraceBlock:  traceBlock,
	}, nil
}

func (poller *EvmPoller) SendToKafKaWithRetry(ctx context.Context, results []ethclient.EvmResult, maxRetry ...uint) error {
	// 为区块链查询创建 span，追踪查询时间
	sendToKafKaWithRetrySpanCtx, sendToKafKaWithRetrySpan := tracelog.StartSpan(ctx, "blockchain", "SendToKafKaWithRetry")
	defer sendToKafKaWithRetrySpan.End()

	tl := tracelog.NewWithContext(sendToKafKaWithRetrySpanCtx)
	retryTimes := DefaultMaxSendKafKaRetry
	if len(maxRetry) > 0 && maxRetry[0] > 0 {
		retryTimes = maxRetry[0]
	}
	return retry.Do(func() error {
		return poller.SendToKafKa(sendToKafKaWithRetrySpanCtx, results)
	},
		retry.Attempts(retryTimes),
		retry.Delay(1*time.Second),                 // 基础延迟1秒
		retry.DelayType(retry.BackOffDelay),        // 使用指数退避
		retry.LastErrorOnly(true),                  // 只返回最后一个错误
		retry.Context(sendToKafKaWithRetrySpanCtx), // 支持上下文取消
		retry.OnRetry(func(n uint, err error) {
			tl.Warnw("EvmPoller kafka发送失败，准备重试", "attempt", n, "maxRetry", retryTimes, "error", err.Error())
		}),
		retry.RetryIf(func(err error) bool {
			if errors.Is(err, context.Canceled) {
				return false // 上下文取消，不重试
			}
			return err != nil
		}),
	)
}

func (poller *EvmPoller) SendToKafKa(ctx context.Context, results []ethclient.EvmResult) error {
	// 为区块链查询创建 span，追踪查询时间
	sendToKafKaSpanCtx, sendToKafKaSpan := tracelog.StartSpan(ctx, "blockchain", "SendToKafKa")
	defer sendToKafKaSpan.End()

	tl := tracelog.NewWithContext(sendToKafKaSpanCtx)
	if len(results) == 0 {
		return nil
	}
	start := time.Now()
	tl = tl.With("taskName", poller.taskName, "chain", poller.chain, "from", results[0].BlockNumber, "to", results[len(results)-1].BlockNumber, "count", len(results))
	// 直接构建消息并发送，不进行大小检查和优化
	msgs := lo.Map(results, func(res ethclient.EvmResult, idx int) kafka.Message {
		receiptStr, _ := utils.JsonEncode(res)
		return kafka.Message{
			Type:        kafka.MessageTypeEvmIncr,
			Chain:       poller.chain,
			Data:        []byte(receiptStr),
			BlockNumber: res.BlockNumber,
			DelayFlag:   poller.isDelay,
		}
	})

	// 直接发送消息（传入 context 以便注入 trace 信息）
	if err := poller.kafkaProducer.WriteCompactMessages(sendToKafKaSpanCtx, msgs...); err != nil {
		tl.Errorw("EvmPoller Kafka发送失败", "error", err.Error(), "time_cost", fmt.Sprintf("%.2f", time.Since(start).Seconds()))
		return fmt.Errorf("kafka writeMessages error: %w", err)
	}

	// if len(msgs) > 0 {
	// 	data, _ := json.Marshal(msgs)
	// 	tl.Warnf("evm 需要发送kafka消息, msg:%s", string(data))
	// 	fileName := fmt.Sprintf("./%d_kafka_msg", msgs[0].BlockNumber)
	// 	os.WriteFile(fileName, data, 0644)
	// }
	tl.Infow("EvmPoller Kafka发送成功", "time_cost", fmt.Sprintf("%.2f", time.Since(start).Seconds()))
	return nil
}
