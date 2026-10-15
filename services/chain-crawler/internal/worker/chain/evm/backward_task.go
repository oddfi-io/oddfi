package evm

import (
	"chain_crawler/internal/config"
	"chain_crawler/internal/repository"
	"chain_crawler/internal/utils"
	"chain_crawler/internal/worker/backward"
	"chain_crawler/internal/worker/chain/evm/validator"
	"chain_crawler/internal/worker/interfaces"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/ethclient"
	"chain_crawler/pkg/pubsub"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/web3chain"
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

)

type BackwardTask struct {
	*interfaces.BaseTask
	cfg            config.Config
	chainCfg       *config.ChainCrawlerChainEVMConfig
	chainInfo      *web3chain.Chain
	repositoryIns  repository.Repository
	validated      *atomic.Bool
	evmClient      ethclient.EthClient
	taskValidators []validator.EVMTaskValidator
	confirmedBlock *utils.ObjectCache[uint64]
	poller         *EvmPoller
	backwardTask   *backward.FullBackwardTask[ethclient.EvmResult]
	lock           *sync.RWMutex
}

func NewBackwardTask(ctx context.Context, cfg config.Config, chainCfg *config.ChainCrawlerChainEVMConfig, chainInfo *web3chain.Chain, repositoryIns repository.Repository) (interfaces.ScheduleTask, error) {
	// 为任务创建带 trace 的 context
	newBackwardTaskSpanCtx, newBackwardTaskSpan := tracelog.StartSpan(ctx, "task", "NewBackwardTask")
	defer newBackwardTaskSpan.End()
	tl := tracelog.NewWithContext(newBackwardTaskSpanCtx)
	tl.Info("Starting new backward task")

	task := &BackwardTask{
		BaseTask:      interfaces.NewBaseTask(newBackwardTaskSpanCtx, chainCfg.BackwardTask.TaskName, repositoryIns),
		cfg:           cfg,
		chainInfo:     chainInfo,
		repositoryIns: repositoryIns,
		validated:     &atomic.Bool{},
		taskValidators: []validator.EVMTaskValidator{
			&validator.EvmChainIdValidator{},
		},
		lock: &sync.RWMutex{},
	}
	task.confirmedBlock = utils.NewObjectCache[uint64](task.getConfirmedBlockNumber, time.Second*2)

	task.initTask(newBackwardTaskSpanCtx, chainCfg)

	// 订阅链配置更新事件
	pubsub.Register(pubsub.ChainCrawlerConfigUpdatedTopic, pubsub.NewSubscriber(task.onChainConfigUpdated))
	return task, nil
}

func (task *BackwardTask) initTask(ctx context.Context, chainCfg *config.ChainCrawlerChainEVMConfig) {
	backwardTaskSpanCtx, backwardTaskSpan := tracelog.StartSpan(ctx, "task", "initTask")
	defer backwardTaskSpan.End()
	tl := tracelog.NewWithContext(backwardTaskSpanCtx)
	tl.Info("Starting init backward task")
	task.lock.Lock()
	defer task.lock.Unlock()

	oldBackwardRpc := ""
	if task.chainCfg != nil {
		oldBackwardRpc = task.chainCfg.BackwardTask.BackwardRpc
	}
	task.chainCfg = chainCfg
	// 配置未变化，不需要重新初始化
	if oldBackwardRpc == chainCfg.BackwardTask.BackwardRpc {
		return
	}

	if chainCfg.BackwardTask.BackwardRpc == "" {
		task.evmClient = nil
		task.poller = nil
		task.backwardTask = nil
		return
	}
	task.chainInfo.Endpoints = []string{chainCfg.BackwardTask.BackwardRpc}
	evmClient, err := ethclient.GetEthClient(backwardTaskSpanCtx, task.chainInfo.Chain, task.chainInfo.Endpoints)
	if err != nil {
		tl.Errorw("BackwardTask GetEthClient error", "chain", task.chainInfo.Chain, "endpoints", task.chainInfo.Endpoints, "err", err)
		task.poller = nil
		task.backwardTask = nil
		return
	}
	task.evmClient = evmClient

	evmPoller, err := NewEvmPoller(&task.cfg.Kafka, task.cfg.Kafka.TopicWeb3ChainEvmBackward, task.GetTaskName(), task.GetChain(), evmClient, true)
	if err != nil {
		tl.Errorw("BackwardTask NewEvmPoller error", "chain", task.chainInfo.Chain, "topic", task.cfg.Kafka.TopicWeb3ChainEvmBackward, "err", err)
		task.evmClient = nil
		task.backwardTask = nil
		return
	}
	task.poller = evmPoller
	task.backwardTask = backward.NewFullBackwardTask[ethclient.EvmResult](task.GetTaskName(), *task.chainInfo, task)

	task.resetValidated()
	tl.Infow("BackwardTask initTask success", "rpc", chainCfg.BackwardTask.BackwardRpc)
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
	backwardTaskRunOnceSpanCtx, backwardTaskRunOnceSpan, cancel := tracelog.StartNewTraceWithTaskContext(task.GetTaskContext(), task.GetTaskName(), "runOnce")
	defer backwardTaskRunOnceSpan.End()
	defer cancel()
	tl := tracelog.NewWithContext(backwardTaskRunOnceSpanCtx)
	tl.Info("Starting backward task run once")

	if err := task.checkValidated(backwardTaskRunOnceSpanCtx); err != nil {
		tl.Errorw("BackwardTask runOnce checkValidated failed", "err", err)
		return true
	}

	backwardTask := task.getBackwardTask()
	if backwardTask == nil {
		return true
	}

	confirmedBlockNumber, err := task.confirmedBlock.Get()
	if err != nil {
		tl.Errorw("BackwardTask runOnce get confirmedBlockNumber failed", "err", err)
		return true
	}
	noWait, err := backwardTask.DoBackwardTask(backwardTaskRunOnceSpanCtx, confirmedBlockNumber)
	if err != nil {
		tl.Errorw("BackwardTask DoBackwardTask error", "err", err)
		return true
	}
	return !noWait
}

func (task *BackwardTask) GetBlockData(ctx context.Context, startBlock, endBlock uint64) ([]ethclient.EvmResult, error) {
	// 为区块链查询创建 span，追踪查询时间
	getBlockDataSpanCtx, getBlockDataSpan := tracelog.StartSpan(ctx, "blockchain", "GetBlockData")
	defer getBlockDataSpan.End()

	tl := tracelog.NewWithContext(getBlockDataSpanCtx)
	results, _, err := task.poller.GetEvmChainData(getBlockDataSpanCtx, startBlock, endBlock)
	if err != nil {
		tl.Errorw("GetEvmChainData error", "error", err.Error())
		return nil, fmt.Errorf("GetEvmChainData error: %w", err)
	}
	return results, nil
}

func (task *BackwardTask) SendBlockDataToKafka(ctx context.Context, results []ethclient.EvmResult) error {
	sendBlockDataToKafkaSpanCtx, sendBlockDataToKafkaSpan := tracelog.StartSpan(ctx, "task", "SendBlockDataToKafka")
	defer sendBlockDataToKafkaSpan.End()
	tl := tracelog.NewWithContext(sendBlockDataToKafkaSpanCtx)
	tl = tl.With("chain", task.GetChain(), "taskName", task.GetTaskName())
	return task.poller.SendToKafKaWithRetry(sendBlockDataToKafkaSpanCtx, results)
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

func (task *BackwardTask) getBackwardTask() *backward.FullBackwardTask[ethclient.EvmResult] {
	task.lock.RLock()
	defer task.lock.RUnlock()
	return task.backwardTask
}

func (task *BackwardTask) checkValidated(ctx context.Context) error {
	checkValidatedSpanCtx, checkValidatedSpan := tracelog.StartSpan(ctx, "task", "checkValidated")
	defer checkValidatedSpan.End()
	
	if task.validated.Load() {
		return nil
	}
	for _, taskValidator := range task.taskValidators {
		if err := taskValidator.Validate(checkValidatedSpanCtx, task.chainInfo, task.GetEvmClient()); err != nil {
			return err
		}
	}
	task.validated.Store(true)
	return nil
}

func (task *BackwardTask) GetEvmClient() ethclient.EthClient {
	task.lock.RLock()
	defer task.lock.RUnlock()
	return task.evmClient
}

func (task *BackwardTask) resetValidated() {
	task.validated.Store(false)
}

func (task *BackwardTask) GetTaskName() string {
	return task.BaseTask.GetTaskName()
}

func (task *BackwardTask) GetChain() consts.Chain {
	return task.chainInfo.Chain
}

func (task *BackwardTask) GetChainCfg() *config.ChainCrawlerChainEVMConfig {
	return config.GetDefaultNacosChainCrawlerConfig().GetEVMChainConfig(task.GetChain())
}

func (task *BackwardTask) GetEnv() string {
	return task.cfg.Env
}

func (task *BackwardTask) onChainConfigUpdated(data interface{}) {
	newCfg := data.(*config.NacosChainCrawlerConfig)
	newChainCfg := newCfg.GetEVMChainConfig(task.GetChain())
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
	evmClient := task.GetEvmClient()
	if evmClient == nil {
		return 0, nil
	}
	// 使用任务的 context，确保 trace 信息能够正确传播
	ctx := task.GetTaskContext()
	getConfirmedBlockNumberSpanCtx, getConfirmedBlockNumberSpan := tracelog.StartSpan(ctx, "task", "getConfirmedBlockNumber")
	defer getConfirmedBlockNumberSpan.End()
	tl := tracelog.NewWithContext(getConfirmedBlockNumberSpanCtx)
	tl = tl.With("chain", task.GetChain(), "taskName", task.GetTaskName())

	delayNumber := task.GetDelayBlockNumber()
	blockNumber, err := evmClient.BlockNumber(getConfirmedBlockNumberSpanCtx, ethclient.RouteRandom)
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
