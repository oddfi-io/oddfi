package evm

import (
	"chain_crawler/internal/config"
	"chain_crawler/internal/monitor"
	"chain_crawler/internal/repository"
	"chain_crawler/internal/utils"
	"chain_crawler/internal/worker/chain/evm/validator"
	"chain_crawler/internal/worker/interfaces"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/ethclient"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/web3chain"
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"time"
)

const (
	DefaultMaxBlockDelay = 64 // 实时任务最大允许落后区块数，超过这个值直接忽视
)

type FullRealtimeTaskData struct {
	CurrentBlock uint64 `json:"current_block"`
}

func NewFullRealtimeTaskData(data string) (*FullRealtimeTaskData, error) {
	taskData := &FullRealtimeTaskData{}
	if err := json.Unmarshal([]byte(data), taskData); err != nil {
		return nil, fmt.Errorf("unmarshal FullRealtimeTaskData:%s error:%w", data, err)
	}
	return taskData, nil
}

func (td *FullRealtimeTaskData) Encode() string {
	data, _ := json.Marshal(td)
	return string(data)
}

type RealTimeTask struct {
	*interfaces.BaseTask
	cfg            config.Config
	chainInfo      *web3chain.Chain
	repositoryIns  repository.Repository
	validated      *atomic.Bool
	evmClient      ethclient.EthClient
	taskValidators []validator.EVMTaskValidator
	poller         *EvmPoller
}

func NewRealTimeTask(ctx context.Context, cfg config.Config, chainCfg *config.ChainCrawlerChainEVMConfig, chainInfo *web3chain.Chain, repositoryIns repository.Repository) (*RealTimeTask, error) {
	// 为任务创建带 trace 的 context
	taskCtx, span := tracelog.StartSpan(ctx, "task", "NewRealTimeTask")
	defer span.End()

	task := &RealTimeTask{
		BaseTask:      interfaces.NewBaseTask(taskCtx, chainCfg.RealtimeTask.TaskName, repositoryIns),
		cfg:           cfg,
		chainInfo:     chainInfo,
		repositoryIns: repositoryIns,
		validated:     &atomic.Bool{},
		taskValidators: []validator.EVMTaskValidator{
			&validator.EvmChainIdValidator{},
		},
	}

	if err := task.initTask(taskCtx); err != nil {
		return nil, fmt.Errorf("initTask error: %w", err)
	}
	return task, nil
}

func (task *RealTimeTask) initTask(ctx context.Context) error {
	initTaskSpanCtx, initTaskSpan := tracelog.StartSpan(ctx, "task", "initTask")
	defer initTaskSpan.End()
	tl := tracelog.NewWithContext(initTaskSpanCtx)
	evmClient, err := ethclient.GetEthClient(initTaskSpanCtx, task.chainInfo.Chain, task.chainInfo.Endpoints)
	if err != nil {
		tl.Errorw("RealTimeTask GetEthClient error", "chain", task.chainInfo.Chain, "endpoints", task.chainInfo.Endpoints, "err", err)
		return fmt.Errorf("GetEthClient error: %w", err)
	}
	task.evmClient = evmClient

	evmPoller, err := NewEvmPoller(&task.cfg.Kafka, task.cfg.Kafka.TopicWeb3ChainEvmReal, task.GetTaskName(), task.GetChain(), evmClient, false)
	if err != nil {
		tl.Errorw("RealTimeTask NewEvmPoller error", "chain", task.chainInfo.Chain, "topic", task.cfg.Kafka.TopicWeb3ChainEvmIncr, "err", err)
		return fmt.Errorf("NewEvmPoller error: %w", err)
	}
	task.poller = evmPoller

	tl.Infow("RealTimeTask initTask success", "chain", task.chainInfo.Chain)
	return nil
}

func (task *RealTimeTask) Run() {
	defer task.End()
	for {
		if task.InShutdown() {
			return
		}
		if needDelay := task.runOnce(); needDelay {
			select {
			case <-task.GetTaskContext().Done():
				return
			case <-time.After(task.GetBlockInterval()):
			}
		}
	}
}

func (task *RealTimeTask) runOnce() (needDelay bool) {
	if !task.GetChainCfg().RealtimeTask.Enable {
		time.Sleep(time.Second * 2)
		return true
	}

	// 每次 runOnce 创建新的 trace，确保每次执行都有独立的 traceId
	ctx, span, cancel := tracelog.StartNewTraceWithTaskContext(task.GetTaskContext(), task.GetTaskName(), "runOnce")
	defer cancel()
	defer span.End()

	tl := tracelog.NewWithContext(ctx)
	tl = tl.With("chain", task.GetChain(), "taskName", task.GetTaskName())

	if err := task.checkValidated(ctx); err != nil {
		tl.Errorw("RealTimeTask runOnce checkValidated failed", "err", err)
		return true
	}

	realtimeTask, err := task.GetCurrentTask(ctx)
	if err != nil {
		tl.Errorw("RealTimeTask runOnce GetCurrentTask failed", "err", err)
		return true
	}
	if realtimeTask.IsFailed() || realtimeTask.IsDone() {
		return true
	}
	if realtimeTask.IsPending() {
		realtimeTask.State = repository.TaskStateProcessing
		if _, err = task.UpdateTask(ctx, realtimeTask); err != nil {
			tl.Errorw("RealTimeTask runOnce UpdateTask failed", "newState", realtimeTask.State, "err", err)
			return true
		}
	}

	taskData, err := NewFullRealtimeTaskData(realtimeTask.Data)
	if err != nil {
		tl.Errorw("RealTimeTask runOnce NewFullForwardTaskData failed", "err", err)
		realtimeTask.State = repository.TaskStateFailed
		if _, err = task.UpdateTask(ctx, realtimeTask); err != nil {
			tl.Errorw("RealTimeTask runOnce UpdateTask failed", "newState", realtimeTask.State, "err", err)
		}
		return true
	}

	latestBlockNumber, err := task.GetBlockNumber(ctx)
	if err != nil {
		tl.Errorw("RealTimeTask runOnce GetBlockNumber failed", "err", err)
		return true
	}

	wait, from, to := task.GetForwardBlockRange(ctx, latestBlockNumber, taskData)
	if wait {
		return true
	}
	tl.Infow("RealTimeTask runOnce blockRange", "latestBlockNumber", latestBlockNumber, "from", from, "to", to, "count", to-from+1)

	blockData, nextBlockNumber, err := task.poller.GetEvmChainData(ctx, from, to)
	if err != nil {
		tl.Errorw("RealTimeTask runOnce GetEvmChainData failed", "err", err)
		return true
	}

	if err = task.poller.SendToKafKaWithRetry(ctx, blockData); err != nil {
		tl.Errorw("RealTimeTask runOnce SendToKafKaWithRetry failed", "err", err)
		return true
	}

	// 更新监控指标
	monitor.RealtimeBlockNumber.WithLabelValues(task.GetEnv(), task.GetChain().ToString()+"_realtime").Set(float64(to))

	taskData.CurrentBlock = nextBlockNumber
	realtimeTask.Data = taskData.Encode()

	if _, err = task.UpdateTaskWithState(ctx, realtimeTask, realtimeTask.State); err != nil {
		tl.Errorw("RealTimeTask runOnce UpdateTaskWithState failed", "err", err)
		return true
	}
	needDelay = nextBlockNumber >= latestBlockNumber
	if !needDelay {
		time.Sleep(time.Millisecond * 10) // 防止数据库状态不一致
	}
	return needDelay
}

func (task *RealTimeTask) GetBlockStep() uint64 {
	blockStep := task.GetChainCfg().RealtimeTask.BlockStep
	if blockStep != 0 {
		return blockStep
	}
	return utils.GetDefaultBlockStep(task.GetChain())
}

func (task *RealTimeTask) GetBlockNumber(ctx context.Context) (uint64, error) {
	// 为区块链查询创建 span，追踪查询时间
	blockNumberSpanCtx, blockNumberSpan := tracelog.StartSpan(ctx, "blockchain", "GetBlockNumber")
	defer blockNumberSpan.End()
	blockNumber, err := task.evmClient.BlockNumber(blockNumberSpanCtx, ethclient.RouteRandom)
	if err != nil {
		return 0, err
	}
	// 更新监控指标
	monitor.LatestBlockNumber.WithLabelValues(task.GetEnv(), task.GetChain().ToString()+"_realtime").Set(float64(blockNumber))
	return blockNumber, nil
}

func (task *RealTimeTask) checkValidated(ctx context.Context) error {
	checkValidatedSpanCtx, checkValidatedSpan := tracelog.StartSpan(ctx, "task", "checkValidated")
	defer checkValidatedSpan.End()
	if task.validated.Load() {
		return nil
	}
	for _, taskValidator := range task.taskValidators {
		if err := taskValidator.Validate(checkValidatedSpanCtx, task.chainInfo, task.evmClient); err != nil {
			return err
		}
	}
	task.validated.Store(true)
	return nil
}

/*
 * 实事流在现有高度距离最新高度太大时候会跳过中间块同步，直接同步最新高度一个步长的区块
 * 初次启动为高度0时候直接把from强制改为 最新高度- max_block_delay（或写死64）
 * 二次进入时候落后太多会跳过中间高度，从最后一个区间开始取
 */
func (task *RealTimeTask) GetForwardBlockRange(ctx context.Context, latestBlockNumber uint64, realtimeTask *FullRealtimeTaskData) (wait bool, from, to uint64) {
	// 为区块链查询创建 span，追踪查询时间
	blockRangeSpanCtx, blockRangeSpan := tracelog.StartSpan(ctx, "blockchain", "GetForwardBlockRange")
	defer blockRangeSpan.End()

	tl := tracelog.NewWithContext(blockRangeSpanCtx)
	if realtimeTask.CurrentBlock > latestBlockNumber {
		tl.Infow("等待新块", "currentBlock", realtimeTask.CurrentBlock, "latestBlockNumber", latestBlockNumber)
		return true, 0, 0
	}
	blockDelay := latestBlockNumber - realtimeTask.CurrentBlock + 1
	// 最大允许落后区块数，超过这个值直接忽视
	maxBlockDelay := task.GetMaxBlockDelay()
	tl.Infow("当前块高以及延迟高度最大允许落后区块数", "currentBlock", realtimeTask.CurrentBlock, "latestBlockNumber", latestBlockNumber, "blockDelay", blockDelay, "maxBlockDelay", maxBlockDelay)

	if blockDelay > maxBlockDelay {
		tl.Errorw("实时跳块当前块高blockDelay大于最大允许落后区块数，设置为最大允许落后区块数", "currentBlock", realtimeTask.CurrentBlock, "blockDelay", blockDelay, "maxBlockDelay", maxBlockDelay)
		blockDelay = maxBlockDelay
	}

	from = latestBlockNumber - blockDelay
	if from < realtimeTask.CurrentBlock {
		from = realtimeTask.CurrentBlock
	}

	blockStep := task.GetBlockStep()
	to = from + blockStep - 1
	if to > latestBlockNumber {
		to = latestBlockNumber
	}
	tl.Infow("GetForwardBlockRange success", "currentBlock", realtimeTask.CurrentBlock, "latestBlockNumber", latestBlockNumber, "blockDelay", blockDelay, "maxBlockDelay", maxBlockDelay, "from", from, "to", to)
	return false, from, to
}

func (task *RealTimeTask) GetMaxBlockDelay() uint64 {
	blockDelay := task.GetChainCfg().RealtimeTask.MaxBlockDelay
	if blockDelay != 0 {
		return blockDelay
	}
	return DefaultMaxBlockDelay
}

func (task *RealTimeTask) GetTaskName() string {
	return task.BaseTask.GetTaskName()
}

func (task *RealTimeTask) GetChain() consts.Chain {
	return task.chainInfo.Chain
}

func (task *RealTimeTask) GetChainCfg() *config.ChainCrawlerChainEVMConfig {
	return config.GetDefaultNacosChainCrawlerConfig().GetEVMChainConfig(task.GetChain())
}

func (task *RealTimeTask) GetBlockInterval() time.Duration {
	if interval := time.Duration(task.GetChainCfg().RealtimeTask.BlockInterval) * time.Millisecond; interval > 0 {
		return interval
	}
	return DefaultBlockInterval
}

func (task *RealTimeTask) GetEnv() string {
	return task.cfg.Env
}
