package evm

import (
	"chain_crawler/internal/config"
	"chain_crawler/internal/monitor"
	"chain_crawler/internal/repository"
	"chain_crawler/internal/utils"
	"chain_crawler/internal/worker/backward"
	"chain_crawler/internal/worker/chain/evm/validator"
	"chain_crawler/internal/worker/interfaces"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/ethclient"
	"chain_crawler/pkg/larkclient"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/web3chain"
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"time"
)

const (
	DefaultBlockInterval = time.Second * 2

	DefaultDelayBlockNumber = 16
	DefaultAlertBlockDelay  = 64
)

type FullForwardTaskData struct {
	CurrentBlock    uint64 `json:"current_block"`
	ParentBlockHash string `json:"parent_block_hash"`
}

func NewFullForwardTaskData(data string) (*FullForwardTaskData, error) {
	taskData := &FullForwardTaskData{}
	if err := json.Unmarshal([]byte(data), taskData); err != nil {
		return nil, fmt.Errorf("unmarshal FullForwardTaskData:%s error:%w", data, err)
	}
	return taskData, nil
}

func (td *FullForwardTaskData) Encode() string {
	data, _ := json.Marshal(td)
	return string(data)
}

type ForwardTask struct {
	*interfaces.BaseTask
	cfg            config.Config
	chainInfo      *web3chain.Chain
	repositoryIns  repository.Repository
	validated      *atomic.Bool
	evmClient      ethclient.EthClient
	taskValidators []validator.EVMTaskValidator
	larkClient     larkclient.Client
	poller         *EvmPoller
}

func NewForwardTask(ctx context.Context, cfg config.Config, chainCfg *config.ChainCrawlerChainEVMConfig, chainInfo *web3chain.Chain, repositoryIns repository.Repository) (interfaces.ScheduleTask, error) {
	// 为任务创建带 trace 的 context
	taskCtx, span := tracelog.StartSpan(ctx, "task", "NewForwardTask")
	defer span.End()

	task := &ForwardTask{
		BaseTask:      interfaces.NewBaseTask(taskCtx, chainCfg.ForwardTask.TaskName, repositoryIns),
		cfg:           cfg,
		chainInfo:     chainInfo,
		repositoryIns: repositoryIns,
		validated:     &atomic.Bool{},
		taskValidators: []validator.EVMTaskValidator{
			&validator.EvmChainIdValidator{},
		},
		larkClient: larkclient.NewClient(cfg.Env),
	}

	if err := task.initTask(taskCtx); err != nil {
		return nil, fmt.Errorf("initTask error: %w", err)
	}
	return task, nil
}

func (task *ForwardTask) initTask(ctx context.Context) error {
	initTaskSpanCtx, initTaskSpan := tracelog.StartSpan(ctx, "task", "initTask")
	defer initTaskSpan.End()
	tl := tracelog.NewWithContext(initTaskSpanCtx)
	evmClient, err := ethclient.GetEthClient(initTaskSpanCtx, task.chainInfo.Chain, task.chainInfo.Endpoints)
	if err != nil {
		tl.Errorw("ForwardTask GetEthClient error", "chain", task.chainInfo.Chain, "endpoints", task.chainInfo.Endpoints, "err", err)
		return fmt.Errorf("GetEthClient error: %w", err)
	}
	task.evmClient = evmClient

	evmPoller, err := NewEvmPoller(&task.cfg.Kafka, task.cfg.Kafka.TopicWeb3ChainEvmIncr, task.GetTaskName(), task.GetChain(), evmClient, true)
	if err != nil {
		tl.Errorw("ForwardTask NewEvmPoller error", "chain", task.chainInfo.Chain, "topic", task.cfg.Kafka.TopicWeb3ChainEvmIncr, "err", err)
		return fmt.Errorf("NewEvmPoller error: %w", err)
	}
	task.poller = evmPoller

	tl.Infow("ForwardTask initTask success", "chain", task.chainInfo.Chain)
	return nil
}

func (task *ForwardTask) Run() {
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

func (task *ForwardTask) runOnce() (needDelay bool) {
	if !task.GetChainCfg().ForwardTask.Enable {
		time.Sleep(time.Second * 2)
		return true
	}

	// 每次 runOnce 创建新的 trace，确保每次执行都有独立的 traceId
	ctx, span, cancel := tracelog.StartNewTraceWithTaskContext(task.GetTaskContext(), task.GetTaskName(), "runOnce")
	defer cancel()
	defer span.End()

	tl := tracelog.NewWithContext(ctx)
	tl = tl.With("chain", task.GetChain(), "taskName", task.GetTaskName())
	tl.Infof("start fetch %s block data, forward task", task.GetChain().ToString())

	if err := task.checkValidated(ctx); err != nil {
		tl.Errorw("ForwardTask runOnce checkValidated failed", "err", err)
		return true
	}

	tl.Info("111111 evm")

	forwardTask, err := task.GetCurrentTask(ctx)
	if err != nil {
		tl.Errorw("ForwardTask runOnce GetCurrentTask failed", "err", err)
		tl.Info("22222 evm")
		return true
	}
	if forwardTask.IsFailed() || forwardTask.IsDone() {
		tl.Info("3333 evm")
		return true
	}
	if forwardTask.IsPending() {
		forwardTask.State = repository.TaskStateProcessing
		if _, err = task.UpdateTask(ctx, forwardTask); err != nil {
			tl.Errorw("ForwardTask runOnce UpdateTask failed", "newState", forwardTask.State, "err", err)
			tl.Info("44444 evm")
			return true
		}
	}

	taskData, err := NewFullForwardTaskData(forwardTask.Data)
	if err != nil {
		tl.Errorw("ForwardTask runOnce NewFullForwardTaskData failed", "err", err)
		forwardTask.State = repository.TaskStateFailed
		if _, err = task.UpdateTask(ctx, forwardTask); err != nil {
			tl.Errorw("ForwardTask runOnce UpdateTask failed", "newState", forwardTask.State, "err", err)
		}
		tl.Info("555555 evm")
		return true
	}

	lastBlockNumber, err := task.GetBlockNumber(ctx)
	if err != nil {
		tl.Errorw("ForwardTask runOnce GetBlockNumber failed", "err", err)
		tl.Info("66666 evm")
		return true
	}

	wait, from, to, maxBlock := task.GetForwardBlockRange(ctx, lastBlockNumber, taskData)
	if wait {
		tl.Info("777777 evm")
		return true
	}
	tl.Infow("ForwardTask runOnce blockRange", "from", from, "to", to, "count", to-from+1, "maxBlock", maxBlock, "delay", maxBlock-to)

	task.CheckBlockDelay(ctx, taskData.CurrentBlock, maxBlock)

	blockData, nextBlockNumber, err := task.poller.GetEvmChainData(ctx, from, to)
	if err != nil {
		tl.Errorw("ForwardTask runOnce GetEvmChainData failed", "err", err)

		if utils.IsOutsideHistoricalState(err) {
			task.onTaskOutsideHistoricalState(ctx, forwardTask, taskData, maxBlock)
		}
		return true
	}
	lastBlockHash, err := task.getLastBlockHash(ctx, blockData)
	if err != nil {
		tl.Errorw("ForwardTask runOnce getLastBlockHash failed", "err", err)
		return true
	}

	if err = task.poller.SendToKafKaWithRetry(ctx, blockData); err != nil {
		tl.Errorw("ForwardTask runOnce SendToKafKaWithRetry failed", "err", err)
		return true
	}

	// 更新监控指标
	monitor.CurrentBlockNumber.WithLabelValues(task.GetEnv(), task.GetChain().ToString()+"_forward").Set(float64(to))

	taskData.CurrentBlock = nextBlockNumber
	taskData.ParentBlockHash = lastBlockHash
	forwardTask.Data = taskData.Encode()

	if _, err = task.UpdateTaskWithState(ctx, forwardTask, forwardTask.State); err != nil {
		tl.Errorw("ForwardTask runOnce UpdateTaskWithState failed", "err", err)
		return true
	}
	needDelay = nextBlockNumber >= maxBlock
	if !needDelay {
		time.Sleep(time.Millisecond * 10) // 防止数据库状态不一致
	}
	return needDelay
}

// onTaskOutsideHistoricalState 处理任务跑到剪枝节点外的情况
func (task *ForwardTask) onTaskOutsideHistoricalState(ctx context.Context, forwardTask repository.ScheduleTask, taskData *FullForwardTaskData, maxBlock uint64) {
	onTaskOutsideHistoricalStateSpanCtx, onTaskOutsideHistoricalStateSpan := tracelog.StartSpan(ctx, "task", "onTaskOutsideHistoricalState")
	defer onTaskOutsideHistoricalStateSpan.End()
	tl := tracelog.NewWithContext(onTaskOutsideHistoricalStateSpanCtx)
	startBlock := taskData.CurrentBlock
	endBlock := maxBlock
	backwardTaskData := &backward.FullBackwardTaskData{
		Chain:      task.GetChain(),
		StartBlock: startBlock,
		EndBlock:   endBlock,
		BlockStep:  task.GetBlockStep(),
	}
	backwardTask := repository.ScheduleTask{
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Task:      backward.GetFullBackwardTaskName(task.GetChain(), startBlock, endBlock),
		State:     repository.TaskStateProcessing,
		Data:      backwardTaskData.Encode(),
	}
	if _, err := task.repositoryIns.CreateTask(ctx, backwardTask); err != nil {
		tl.Errorw("ForwardTask onTaskOutsideHistoricalState CreateBackwardTask failed", "startBlock", startBlock, "endBlock", endBlock, "err", err)
		return
	}
	tl.Infow("ForwardTask onTaskOutsideHistoricalState created BackwardTask success", "startBlock", startBlock, "endBlock", endBlock, "task", backwardTask.Task)

	taskData.CurrentBlock = maxBlock
	taskData.ParentBlockHash = ""
	forwardTask.Data = taskData.Encode()
	if _, err := task.UpdateTaskWithState(ctx, forwardTask, forwardTask.State); err != nil {
		tl.Errorw("ForwardTask onTaskOutsideHistoricalState UpdateTaskWithState failed", "err", err)
		return
	}
	tl.Infow("ForwardTask onTaskOutsideHistoricalState reset ForwardTask currentBlock success", "oldCurrentBlock", startBlock, "newCurrentBlock", maxBlock)
}

func (task *ForwardTask) getLastBlockHash(ctx context.Context, results []ethclient.EvmResult) (string, error) {
	// 为区块链查询创建 span，追踪查询时间
	_, getLastBlockHashSpan := tracelog.StartSpan(ctx, "blockchain", "getLastBlockHash")
	defer getLastBlockHashSpan.End()

	if len(results) == 0 {
		return "", nil
	}
	lastBlock := results[len(results)-1]

	// 只解析hash字段，避免完整解析
	var blockData struct {
		Hash string `json:"hash"`
	}
	if err := json.Unmarshal(lastBlock.Block, &blockData); err != nil {
		return "", fmt.Errorf("unmarshal block data blockNumber:%d failed: %w", lastBlock.BlockNumber, err)
	}
	return blockData.Hash, nil
}

func (task *ForwardTask) CheckBlockDelay(ctx context.Context, currentBlockNumber, maxBlockNumber uint64) {
	// 为区块链查询创建 span，追踪查询时间
	checkBlockDelaySpanCtx, checkBlockDelaySpan := tracelog.StartSpan(ctx, "blockchain", "CheckBlockDelay")
	defer checkBlockDelaySpan.End()

	tl := tracelog.NewWithContext(checkBlockDelaySpanCtx)
	monitor.DelayBlockNumber.WithLabelValues(task.GetEnv(), task.GetChain().ToString()+"_forward").Set(float64(maxBlockNumber))

	if currentBlockNumber >= maxBlockNumber {
		return
	}
	blockDelay := maxBlockNumber - currentBlockNumber
	alertBlockDelay := task.GetAlertBlockDelay()
	if blockDelay <= alertBlockDelay {
		return
	}
	tl.Warnw("ChainCrawler延时爬块落后告警", "block_delay", blockDelay, "数据库高度", currentBlockNumber, "maxToBlock", maxBlockNumber)

	task.larkClient.PostMessageAsync(checkBlockDelaySpanCtx, "ChainCrawler延时爬块落后告警", fmt.Sprintf("task=%+v chain=%+v 区块延迟=%+v", task.GetTaskName(), task.GetTaskName(), blockDelay))
}

func (task *ForwardTask) GetAlertBlockDelay() uint64 {
	alertBlockDelay := task.GetChainCfg().ForwardTask.AlertBlockDelay
	if alertBlockDelay != 0 {
		return alertBlockDelay
	}
	alertBlockDelay = consts.ChainAlertBlockDelay[task.GetChain()]
	if alertBlockDelay == 0 {
		alertBlockDelay = DefaultAlertBlockDelay
	}
	return alertBlockDelay
}

/*
 * 向前更新流
 * 如果是首次处理， from会设置成现有高度-delay高度，to为最新高度
 */
func (task *ForwardTask) GetForwardBlockRange(ctx context.Context, lastBlockNumber uint64, forwardTask *FullForwardTaskData) (wait bool, from, to, maxBlock uint64) {
	// 为区块链查询创建 span，追踪查询时间
	blockRangeSpanCtx, blockRangeSpan := tracelog.StartSpan(ctx, "blockchain", "GetForwardBlockRange")
	defer blockRangeSpan.End()

	tl := tracelog.NewWithContext(blockRangeSpanCtx)
	delayNumber := task.GetDelayBlockNumber()
	if lastBlockNumber < delayNumber {
		return true, 0, 0, 0
	}
	maxBlock = lastBlockNumber - delayNumber
	if forwardTask.CurrentBlock == 0 {
		forwardTask.CurrentBlock = maxBlock
	}
	if forwardTask.CurrentBlock > maxBlock {
		tl.Infow("等待新块", "currentBlock", forwardTask.CurrentBlock, "maxBlock", maxBlock, "lastBlock", lastBlockNumber)
		return true, 0, 0, 0
	}
	blockStep := task.GetBlockStep()
	from = forwardTask.CurrentBlock
	to = from + blockStep - 1
	if to > maxBlock {
		to = maxBlock
	}
	tl.Infow("GetForwardBlockRange success", "currentBlock", forwardTask.CurrentBlock, "lastBlockNumber", lastBlockNumber, "delayNumber", delayNumber, "blockStep", blockStep, "from", from, "to", to, "maxBlock", maxBlock)
	return false, from, to, maxBlock
}

func (task *ForwardTask) GetDelayBlockNumber() uint64 {
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

func (task *ForwardTask) GetBlockStep() uint64 {
	blockStep := task.GetChainCfg().ForwardTask.BlockStep
	if blockStep != 0 {
		return blockStep
	}
	return utils.GetDefaultBlockStep(task.GetChain())
}

func (task *ForwardTask) GetBlockNumber(ctx context.Context) (uint64, error) {
	// 为区块链查询创建 span，追踪查询时间
	blockNumberSpanCtx, blockNumberSpan := tracelog.StartSpan(ctx, "blockchain", "GetBlockNumber")
	defer blockNumberSpan.End()

	blockNumber, err := task.evmClient.BlockNumber(blockNumberSpanCtx, ethclient.RouteRandom)
	if err != nil {
		return 0, err
	}
	// 更新监控指标
	monitor.LatestBlockNumber.WithLabelValues(task.GetEnv(), task.GetChain().ToString()+"_forward").Set(float64(blockNumber))
	return blockNumber, nil
}

func (task *ForwardTask) checkValidated(ctx context.Context) error {
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

func (task *ForwardTask) GetTaskName() string {
	return task.BaseTask.GetTaskName()
}

func (task *ForwardTask) GetChain() consts.Chain {
	return task.chainInfo.Chain
}

func (task *ForwardTask) GetChainCfg() *config.ChainCrawlerChainEVMConfig {
	return config.GetDefaultNacosChainCrawlerConfig().GetEVMChainConfig(task.GetChain())
}

func (task *ForwardTask) GetBlockInterval() time.Duration {
	interval := time.Duration(task.GetChainCfg().ForwardTask.BlockInterval) * time.Millisecond
	if interval > 0 {
		return interval
	}
	return DefaultBlockInterval
}

func (task *ForwardTask) GetEnv() string {
	return task.cfg.Env
}
