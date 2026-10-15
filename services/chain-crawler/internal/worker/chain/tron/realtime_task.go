package tron

import (
	"chain_crawler/internal/config"
	"chain_crawler/internal/monitor"
	"chain_crawler/internal/repository"
	"chain_crawler/internal/utils"
	"chain_crawler/internal/worker/interfaces"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/tronclient"
	"chain_crawler/pkg/web3chain"
	"context"
	"encoding/json"
	"fmt"
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
	cfg           config.Config
	chainInfo     *web3chain.Chain
	repositoryIns repository.Repository
	tronClient    *tronclient.TronClient
	poller        *TronPoller
}

func NewRealTimeTask(ctx context.Context, cfg config.Config, chainCfg *config.NacosTronChainConfig, chainInfo *web3chain.Chain, repositoryIns repository.Repository) (*RealTimeTask, error) {
	// 为任务创建带 trace 的 context
	taskCtx, span := tracelog.StartSpan(ctx, "task", "NewRealTimeTask")
	defer span.End()

	task := &RealTimeTask{
		BaseTask:      interfaces.NewBaseTask(taskCtx, consts.TRON_REALTIME_TASK_NAME, repositoryIns),
		cfg:           cfg,
		chainInfo:     chainInfo,
		repositoryIns: repositoryIns,
	}

	if err := task.initTask(taskCtx, chainCfg); err != nil {
		return nil, fmt.Errorf("initTask error: %w", err)
	}
	return task, nil
}

func (task *RealTimeTask) initTask(ctx context.Context, chainCfg *config.NacosTronChainConfig) error {
	initTaskSpanCtx, initTaskSpan := tracelog.StartSpan(ctx, "task", "initTask")
	defer initTaskSpan.End()
	tl := tracelog.NewWithContext(initTaskSpanCtx)

	restRpcUrls, jsonRpcUrls, err := GetTronRpcEndpoints(task.chainInfo.Endpoints)
	if err != nil {
		tl.Errorw("RealTimeTask initTask GetTronRpcEndpoints error", "chain", task.chainInfo.Chain, "endpoints", task.chainInfo.Endpoints, "err", err)
		return err
	}

	tronClient, err := tronclient.NewTronClient(restRpcUrls, jsonRpcUrls)
	if err != nil {
		tl.Errorw("RealTimeTask NewTronClient error", "chain", task.chainInfo.Chain, "restRpc", restRpcUrls, "jsonRpc", jsonRpcUrls, "err", err)
		return fmt.Errorf("NewTronClient error: %w", err)
	}
	task.tronClient = tronClient

	tronPoller, err := NewTronPoller(&task.cfg.Kafka, task.cfg.Kafka.TopicWeb3ChainTronReal, task.GetTaskName(), tronClient, chainCfg.RealtimeTask.HasGetBlockReceiptMethod, false)
	if err != nil {
		tl.Errorw("RealTimeTask NewTronPoller error", "chain", task.chainInfo.Chain, "topic", task.cfg.Kafka.TopicWeb3ChainTronReal, "err", err)
		return fmt.Errorf("NewTronPoller error: %w", err)
	}
	task.poller = tronPoller

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

	blockData, nextBlockNumber, err := task.poller.GetTronChainData(ctx, from, to)
	if err != nil {
		tl.Errorw("RealTimeTask runOnce GetTronChainData failed", "err", err)
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
	getBlockNumberSpanCtx, getBlockNumberSpan := tracelog.StartSpan(ctx, "task", "GetBlockNumber")
	defer getBlockNumberSpan.End()
	tl := tracelog.NewWithContext(getBlockNumberSpanCtx)
	tl = tl.With("chain", task.GetChain(), "taskName", task.GetTaskName())
	blockNumber, err := task.tronClient.GetBlockNumber(getBlockNumberSpanCtx)
	if err != nil {
		return 0, err
	}
	tl.Infow("RealTimeTask GetBlockNumber success", "blockNumber", blockNumber)
	// 更新监控指标
	monitor.LatestBlockNumber.WithLabelValues(task.GetEnv(), task.GetChain().ToString()+"_realtime").Set(float64(blockNumber))
	return blockNumber, nil
}

func (task *RealTimeTask) GetForwardBlockRange(ctx context.Context, latestBlockNumber uint64, realtimeTask *FullRealtimeTaskData) (wait bool, from, to uint64) {
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
		tl.Infow("当前块高blockDelay大于最大允许落后区块数，设置为最大允许落后区块数", "currentBlock", realtimeTask.CurrentBlock, "blockDelay", blockDelay, "maxBlockDelay", maxBlockDelay)
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

func (task *RealTimeTask) GetChainCfg() *config.NacosTronChainConfig {
	return config.GetDefaultNacosChainCrawlerConfig().GetTronChainConfig()
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
