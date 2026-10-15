package tron

import (
	"chain_crawler/internal/config"
	utils2 "chain_crawler/internal/utils"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/kafka"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/tronclient"
	"chain_crawler/pkg/utils"
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/avast/retry-go/v4"
	"github.com/samber/lo"
	"github.com/sourcegraph/conc/pool"
)

const (
	MinTronPollerGoPoolNumber = 1
	MaxTronPollerGoPoolNumber = 32
	DefaultMaxSendKafKaRetry  = uint(3)
)

type TronPoller struct {
	taskName           string
	topic              string
	kafkaCfg           *config.KafkaConfig
	tronClient         *tronclient.TronClient
	kafkaProducer      kafka.Producer
	hasGetBlockReceipt bool // 是否有eth_getBlockReceipts接口，quickNode是有的，但是其他节点是没有的
	isDelay            bool
}

func NewTronPoller(cfg *config.KafkaConfig, topic, taskName string, tronClient *tronclient.TronClient, hasGetBlockReceipt, isDelay bool) (*TronPoller, error) {
	return &TronPoller{
		taskName:           taskName,
		topic:              topic,
		kafkaCfg:           cfg,
		tronClient:         tronClient,
		hasGetBlockReceipt: hasGetBlockReceipt,
		isDelay:            isDelay,
		kafkaProducer:      kafka.NewHugeMessageProducer(cfg.Host, topic, cfg.UserName, cfg.Password),
	}, nil
}

func (poller *TronPoller) GetTronChainData(ctx context.Context, fromBlock, toBlock uint64) ([]*tronclient.TronBlockInfo, uint64, error) {
	// 为区块链查询创建 span，追踪查询时间
	getTronChainDataSpanCtx, getTronChainDataSpan := tracelog.StartSpan(ctx, "blockchain", "GetTronChainData")
	defer getTronChainDataSpan.End()

	tl := tracelog.NewWithContext(getTronChainDataSpanCtx)
	tl = tl.With("taskName", poller.taskName, "from", fromBlock, "to", toBlock, "count", toBlock-fromBlock+1)
	if toBlock < fromBlock {
		tl.Errorw("GetTronChainData failed", "fromBlock", fromBlock, "toBlock", toBlock, "error", "toBlock is smaller than fromBlock")
		return nil, 0, fmt.Errorf("toBlock is smaller than fromBlock")
	}
	goSize := toBlock - fromBlock + 1
	if goSize < MinTronPollerGoPoolNumber {
		goSize = MinTronPollerGoPoolNumber
	} else if goSize > MaxTronPollerGoPoolNumber {
		goSize = MaxTronPollerGoPoolNumber
	}
	blockFetchPool := pool.NewWithResults[*tronclient.TronBlockInfo]().
		WithErrors().
		WithContext(getTronChainDataSpanCtx).
		WithMaxGoroutines(int(goSize))
	for i := fromBlock; i <= toBlock; i++ {
		blockNumber := i
		blockFetchPool.Go(func(ctx context.Context) (*tronclient.TronBlockInfo, error) {
			return poller.getTronChainData(getTronChainDataSpanCtx, blockNumber)
		})
	}
	results, err := blockFetchPool.Wait()
	if err != nil {
		tl.Errorw("TronPoller getTronChainData failed", "error", err.Error())
		return nil, 0, err
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].BlockNumber < results[j].BlockNumber
	})

	tl.Infow("TronPoller 爬取数据成功")
	return results, toBlock + 1, nil
}

func (poller *TronPoller) getTronChainData(ctx context.Context, blockNumber uint64) (*tronclient.TronBlockInfo, error) {
	// 为区块链查询创建 span，追踪查询时间
	getTronChainDataSpanCtx, getTronChainDataSpan := tracelog.StartSpan(ctx, "blockchain", "getTronChainData")
	defer getTronChainDataSpan.End()

	tl := tracelog.NewWithContext(getTronChainDataSpanCtx)
	retryTimes := uint(3)
	var blockInfo *tronclient.TronBlockInfo
	err := retry.Do(func() error {
		fetcher := NewBlockFetcher(getTronChainDataSpanCtx, poller.tronClient, poller.hasGetBlockReceipt)
		var err error
		blockInfo, err = fetcher.FetchBlock(getTronChainDataSpanCtx, blockNumber)
		return err
	},
		retry.Attempts(retryTimes),
		retry.Delay(time.Second),               // 基础延迟1秒
		retry.DelayType(retry.BackOffDelay),    // 使用指数退避
		retry.LastErrorOnly(true),              // 只返回最后一个错误
		retry.Context(getTronChainDataSpanCtx), // 支持上下文取消
		retry.OnRetry(func(n uint, err error) {
			tl.Warnw("TronPoller fetcher.FetchBlock 失败，准备重试", "blockNumber", blockNumber, "attempt", n, "maxRetry", retryTimes, "error", err.Error())
		}))
	return blockInfo, err
}

func (poller *TronPoller) GetChain() consts.Chain {
	return consts.CHAIN_TRON
}

func (poller *TronPoller) SendToKafKaWithRetry(ctx context.Context, results []*tronclient.TronBlockInfo, maxRetry ...uint) error {
	// 为区块链查询创建 span，追踪查询时间
	sendToKafKaWithRetrySpanCtx, sendToKafKaWithRetrySpan := tracelog.StartSpan(ctx, "blockchain", "SendToKafKaWithRetry")
	defer sendToKafKaWithRetrySpan.End()

	tl := tracelog.NewWithContext(sendToKafKaWithRetrySpanCtx)
	retryTimes := DefaultMaxSendKafKaRetry
	if len(maxRetry) > 0 && maxRetry[0] > 0 {
		retryTimes = maxRetry[0]
	}
	tl = tl.With("taskName", poller.taskName, "chain", poller.GetChain())
	return retry.Do(func() error {
		return poller.SendToKafKa(sendToKafKaWithRetrySpanCtx, results)
	},
		retry.Attempts(retryTimes),
		retry.Delay(1*time.Second),                 // 基础延迟1秒
		retry.DelayType(retry.BackOffDelay),        // 使用指数退避
		retry.LastErrorOnly(true),                  // 只返回最后一个错误
		retry.Context(sendToKafKaWithRetrySpanCtx), // 支持上下文取消
		retry.OnRetry(func(n uint, err error) {
			tl.Warnw("TronPoller kafka发送失败，准备重试", "attempt", n, "maxRetry", retryTimes, "error", err.Error())
		}),
		retry.RetryIf(func(err error) bool {
			if errors.Is(err, context.Canceled) {
				return false // 上下文取消，不重试
			}
			if utils2.IsOutsideHistoricalState(err) {
				return false // 跑到剪枝节点外，不重试
			}
			return err != nil
		}),
	)
}

func (poller *TronPoller) SendToKafKa(ctx context.Context, results []*tronclient.TronBlockInfo) error {
	sendToKafKaSpanCtx, sendToKafKaSpan := tracelog.StartSpan(ctx, "blockchain", "SendToKafKa")
	defer sendToKafKaSpan.End()

	tl := tracelog.NewWithContext(sendToKafKaSpanCtx)
	if len(results) == 0 {
		return nil
	}
	tl = tl.With("taskName", poller.taskName, "chain", poller.GetChain(), "from", results[0].BlockNumber, "to", results[len(results)-1].BlockNumber, "count", len(results))
	// 直接构建消息并发送，不进行大小检查和优化
	msgs := lo.Map(results, func(res *tronclient.TronBlockInfo, idx int) kafka.Message {
		receiptStr, _ := utils.JsonEncode(res)
		return kafka.Message{
			Type:        kafka.MessageTypeEvmIncr,
			Chain:       poller.GetChain(),
			Data:        []byte(receiptStr),
			BlockNumber: res.BlockNumber,
			DelayFlag:   poller.isDelay,
		}
	})

	// 直接发送消息（传入 context 以便注入 trace 信息）
	if err := poller.kafkaProducer.WriteCompactMessages(sendToKafKaSpanCtx, msgs...); err != nil {
		tl.Errorw("TronPoller Kafka发送失败", "error", err.Error())
		return fmt.Errorf("kafka writeMessages error: %w", err)
	}

	// if len(msgs) > 0 {
	// 	data, _ := json.Marshal(msgs)
	// 	tl.Warnf("tron 需要发送kafka消息, msg:%s", string(data))
	// 	os.WriteFile("tron_push_kafka_msg.json", data, 0644)
	// }

	tl.Infow("TronPoller Kafka发送成功")
	return nil
}
