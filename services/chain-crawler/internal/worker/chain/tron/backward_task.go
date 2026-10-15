package tron

import (
	"chain_crawler/internal/config"
	"chain_crawler/internal/repository"
	"chain_crawler/internal/worker/backward"
	"chain_crawler/internal/worker/interfaces"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/pubsub"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/tronclient"
	"chain_crawler/pkg/web3chain"
	"context"
	"fmt"
	"sync"
	"time"

)

type BackwardTask struct {
	*interfaces.BaseTask
	cfg           config.Config
	chainCfg      *config.NacosTronChainConfig
	chainInfo     *web3chain.Chain
	repositoryIns repository.Repository
	tronClient    *tronclient.TronClient
	poller        *TronPoller
	backwardTask  *backward.FullBackwardTask[*tronclient.TronBlockInfo]
	lock          *sync.RWMutex
}

func NewBackwardTask(ctx context.Context, cfg config.Config, chainCfg *config.NacosTronChainConfig, chainInfo *web3chain.Chain, repositoryIns repository.Repository) (interfaces.ScheduleTask, error) {
	// 为任务创建带 trace 的 context
	taskCtx, span := tracelog.StartSpan(ctx, "task", "NewBackwardTask")
	defer span.End()

	task := &BackwardTask{
		BaseTask:      interfaces.NewBaseTask(taskCtx, consts.TRON_BACKWARD_TASK_NAME, repositoryIns),
		cfg:           cfg,
		chainInfo:     chainInfo,
		repositoryIns: repositoryIns,
		lock:          &sync.RWMutex{},
	}

	task.initTask(taskCtx, chainCfg)

	// 订阅链配置更新事件
	pubsub.Register(pubsub.ChainCrawlerConfigUpdatedTopic, pubsub.NewSubscriber(task.onChainConfigUpdated))
	return task, nil
}

func (task *BackwardTask) initTask(ctx context.Context, chainCfg *config.NacosTronChainConfig) {
	initTaskSpanCtx, initTaskSpan := tracelog.StartSpan(ctx, "task", "initTask")
	defer initTaskSpan.End()
	tl := tracelog.NewWithContext(initTaskSpanCtx)
	task.lock.Lock()
	defer task.lock.Unlock()

	oldBackwardJsonRpc := ""
	oldBackwardRestRpc := ""
	if task.chainCfg != nil {
		oldBackwardJsonRpc = task.chainCfg.BackwardTask.BackwardJsonRpc
		oldBackwardRestRpc = task.chainCfg.BackwardTask.BackwardRestRpc
	}
	task.chainCfg = chainCfg
	// 配置未变化，不需要重新初始化
	if oldBackwardJsonRpc == chainCfg.BackwardTask.BackwardJsonRpc && oldBackwardRestRpc == chainCfg.BackwardTask.BackwardRestRpc {
		return
	}

	if chainCfg.BackwardTask.BackwardJsonRpc == "" || chainCfg.BackwardTask.BackwardRestRpc == "" {
		task.tronClient = nil
		task.poller = nil
		task.backwardTask = nil
		return
	}
	task.chainInfo.Endpoints = []string{chainCfg.BackwardTask.BackwardJsonRpc, chainCfg.BackwardTask.BackwardRestRpc}
	tronClient, err := tronclient.NewTronClient([]string{chainCfg.BackwardTask.BackwardRestRpc}, []string{chainCfg.BackwardTask.BackwardJsonRpc})
	if err != nil {
		tl.Errorw("BackwardTask NewTronClient error", "chain", task.chainInfo.Chain, "restRpc", chainCfg.BackwardTask.BackwardRestRpc, "jsonRpc", chainCfg.BackwardTask.BackwardJsonRpc, task.chainInfo.Endpoints, "err", err)
		task.poller = nil
		task.backwardTask = nil
		return
	}
	task.tronClient = tronClient

	tronPoller, err := NewTronPoller(&task.cfg.Kafka, task.cfg.Kafka.TopicWeb3ChainTronBackward, task.GetTaskName(), tronClient, chainCfg.BackwardTask.HasGetBlockReceiptMethod, true)
	if err != nil {
		tl.Errorw("BackwardTask NewTronPoller error", "chain", task.chainInfo.Chain, "topic", task.cfg.Kafka.TopicWeb3ChainTronBackward, "err", err)
		task.poller = nil
		task.backwardTask = nil
		return
	}
	task.poller = tronPoller
	task.backwardTask = backward.NewFullBackwardTask[*tronclient.TronBlockInfo](task.GetTaskName(), *task.chainInfo, task)

	tl.Infow("BackwardTask initTask success", "chain", "tron", "restRpc", chainCfg.BackwardTask.BackwardRestRpc, "jsonRpc", chainCfg.BackwardTask.BackwardJsonRpc)
}

func (task *BackwardTask) Run() {
	defer task.End()
	for {
		if task.InShutdown() {
			return
		}
		if needDelay := task.runOnce(); needDelay {
			select {
			case <-task.GetTaskContext().Done():
				return
			case <-time.After(time.Second * 2):
			}
		}
	}
}

func (task *BackwardTask) runOnce() (needDelay bool) {
	if !task.GetChainCfg().BackwardTask.Enable {
		return true
	}

	// 每次 runOnce 创建新的 trace，确保每次执行都有独立的 traceId
	ctx, span, cancel := tracelog.StartNewTraceWithTaskContext(task.GetTaskContext(), task.GetTaskName(), "runOnce")
	defer cancel()
	defer span.End()

	tl := tracelog.NewWithContext(ctx)
	tl = tl.With("chain", task.GetChain(), "taskName", task.GetTaskName())

	backwardTask := task.getBackwardTask()
	if backwardTask == nil {
		return true
	}

	confirmedBlockNumber, err := task.getConfirmedBlockNumber()
	if err != nil {
		tl.Errorw("BackwardTask runOnce getConfirmedBlockNumber failed", "err", err)
		return true
	}
	noWait, err := backwardTask.DoBackwardTask(ctx, confirmedBlockNumber)
	if err != nil {
		tl.Errorw("BackwardTask DoBackwardTask error", "err", err)
		return true
	}
	return !noWait
}

func (task *BackwardTask) GetBlockData(ctx context.Context, startBlock, endBlock uint64) ([]*tronclient.TronBlockInfo, error) {
	// 为区块链查询创建 span，追踪查询时间
	getBlockDataSpanCtx, getBlockDataSpan := tracelog.StartSpan(ctx, "blockchain", "GetBlockData")
	defer getBlockDataSpan.End()

	tl := tracelog.NewWithContext(getBlockDataSpanCtx)
	results, _, err := task.poller.GetTronChainData(ctx, startBlock, endBlock)
	if err != nil {
		tl.Errorw("GetTronChainData error", "error", err.Error())
		return nil, fmt.Errorf("GetTronChainData error: %w", err)
	}
	return results, nil
}

func (task *BackwardTask) SendBlockDataToKafka(ctx context.Context, results []*tronclient.TronBlockInfo) error {
	return task.poller.SendToKafKaWithRetry(ctx, results)
}

// GetDelayBlockNumber 获取Forward任务区块确认数，保证回溯任务不会回溯到未确认区块
func (task *BackwardTask) GetDelayBlockNumber() uint64 {
	delayNumber := task.GetChainCfg().ForwardTask.DelayBlockNumber
	if delayNumber != 0 {
		return delayNumber
	}
	if chainConfig, ok := consts.ChainConfigs[task.GetChain()]; ok {
		delayNumber = uint64(chainConfig.MaxBlockLag)
	} else {
		delayNumber = DefaultDelayBlockNumber
	}
	return delayNumber
}

func (task *BackwardTask) getBackwardTask() *backward.FullBackwardTask[*tronclient.TronBlockInfo] {
	task.lock.RLock()
	defer task.lock.RUnlock()
	return task.backwardTask
}

func (task *BackwardTask) GetTronClient() *tronclient.TronClient {
	task.lock.RLock()
	defer task.lock.RUnlock()
	return task.tronClient
}

func (task *BackwardTask) GetTaskName() string {
	return task.BaseTask.GetTaskName()
}

func (task *BackwardTask) GetChain() consts.Chain {
	return task.chainInfo.Chain
}

func (task *BackwardTask) GetChainCfg() *config.NacosTronChainConfig {
	return config.GetDefaultNacosChainCrawlerConfig().GetTronChainConfig()
}

func (task *BackwardTask) GetEnv() string {
	return task.cfg.Env
}

func (task *BackwardTask) onChainConfigUpdated(data interface{}) {
	newCfg := data.(*config.NacosChainCrawlerConfig)
	newChainCfg := newCfg.GetTronChainConfig()
	// 使用任务的 context，确保 trace 信息能够正确传播
	ctx := task.GetTaskContext()
	onChainConfigUpdatedSpanCtx, onChainConfigUpdatedSpan := tracelog.StartSpan(ctx, "task", "onChainConfigUpdated")
	defer onChainConfigUpdatedSpan.End()
	tl := tracelog.NewWithContext(onChainConfigUpdatedSpanCtx)
	tl = tl.With("task", task.GetTaskName(), "chain", task.GetChain())
	task.initTask(ctx, newChainCfg)
	tl.Infow("BackwardTask onChainConfigUpdated success")
}

func (task *BackwardTask) getConfirmedBlockNumber() (uint64, error) {
	tronClient := task.GetTronClient()
	if tronClient == nil {
		return 0, nil
	}
	// 使用任务的 context，确保 trace 信息能够正确传播
	ctx := task.GetTaskContext()
	getConfirmedBlockNumberSpanCtx, getConfirmedBlockNumberSpan := tracelog.StartSpan(ctx, "task", "getConfirmedBlockNumber")
	defer getConfirmedBlockNumberSpan.End()
	tl := tracelog.NewWithContext(getConfirmedBlockNumberSpanCtx)
	tl = tl.With("chain", task.GetChain(), "taskName", task.GetTaskName())

	delayNumber := task.GetDelayBlockNumber()
	blockNumber, err := tronClient.GetBlockNumber(getConfirmedBlockNumberSpanCtx)
	if err != nil {
		tl.Errorw("BackwardTask get block number failed", "error", err)
		return 0, err
	}
	if blockNumber < delayNumber {
		tl.Errorw("BackwardTask get block number failed", "blockNumber", blockNumber, "delayNumber", delayNumber, "error", "block number less than delay number")
		return 0, fmt.Errorf("block number %d less than delay number %d", blockNumber, delayNumber)
	}
	return blockNumber - delayNumber, nil
}
