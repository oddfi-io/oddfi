package tron

import (
	"chain_crawler/internal/config"
	"chain_crawler/internal/monitor"
	"chain_crawler/internal/repository"
	"chain_crawler/internal/utils"
	"chain_crawler/internal/worker/backward"
	"chain_crawler/internal/worker/interfaces"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/larkclient"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/tronclient"
	"chain_crawler/pkg/web3chain"
	"context"
	"encoding/json"
	"fmt"
	"time"
)

const (
	DefaultBlockInterval = 3 * time.Second

	DefaultDelayBlockNumber = 17
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
	cfg           config.Config
	chainInfo     *web3chain.Chain
	repositoryIns repository.Repository
	tronClient    *tronclient.TronClient
	larkClient    larkclient.Client
	poller        *TronPoller
}

func NewForwardTask(ctx context.Context, cfg config.Config, chainCfg *config.NacosTronChainConfig, chainInfo *web3chain.Chain, repositoryIns repository.Repository) (interfaces.ScheduleTask, error) {
	// 为任务创建带 trace 的 context
	taskCtx, span := tracelog.StartSpan(ctx, "task", "NewForwardTask")
	defer span.End()

	task := &ForwardTask{
		BaseTask:      interfaces.NewBaseTask(taskCtx, consts.TRON_TASK_NAME, repositoryIns),
		cfg:           cfg,
		chainInfo:     chainInfo,
		repositoryIns: repositoryIns,
		larkClient:    larkclient.NewClient(cfg.Env),
	}

	if err := task.initTask(taskCtx, chainCfg); err != nil {
		return nil, fmt.Errorf("initTask error: %w", err)
	}
	return task, nil
}

func (task *ForwardTask) initTask(ctx context.Context, chainCfg *config.NacosTronChainConfig) error {
	initTaskSpanCtx, initTaskSpan := tracelog.StartSpan(ctx, "task", "initTask")
	defer initTaskSpan.End()
	tl := tracelog.NewWithContext(initTaskSpanCtx)

	restRpcUrls, jsonRpcUrls, err := GetTronRpcEndpoints(task.chainInfo.Endpoints)
	if err != nil {
		tl.Errorw("ForwardTask initTask GetTronRpcEndpoints error", "chain", task.chainInfo.Chain, "endpoints", task.chainInfo.Endpoints, "err", err)
		return err
	}

	tronClient, err := tronclient.NewTronClient(restRpcUrls, jsonRpcUrls)
	if err != nil {
		tl.Errorw("ForwardTask NewTronClient error", "chain", task.chainInfo.Chain, "restRpc", restRpcUrls, "jsonRpc", jsonRpcUrls, "err", err)
		return fmt.Errorf("NewTronClient error: %w", err)
	}
	task.tronClient = tronClient

	tronPoller, err := NewTronPoller(&task.cfg.Kafka, task.cfg.Kafka.TopicWeb3ChainTronIncr, task.GetTaskName(), tronClient, chainCfg.ForwardTask.HasGetBlockReceiptMethod, true)
	if err != nil {
		tl.Errorw("ForwardTask NewTronPoller error", "chain", task.chainInfo.Chain, "topic", task.cfg.Kafka.TopicWeb3ChainTronIncr, "err", err)
		return fmt.Errorf("NewTronPoller error: %w", err)
	}
	task.poller = tronPoller

	tl.Infow("ForwardTask initTask success", "chain", task.chainInfo.Chain, "restRpc", restRpcUrls, "jsonRpc", jsonRpcUrls)
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

	forwardTask, err := task.GetCurrentTask(ctx)
	if err != nil {
		tl.Errorw("ForwardTask runOnce GetCurrentTask failed", "err", err)
		return true
	}
	if forwardTask.IsFailed() || forwardTask.IsDone() {
		return true
	}

	taskData, err := NewFullForwardTaskData(forwardTask.Data)
	if err != nil {
		tl.Errorw("ForwardTask runOnce NewFullForwardTaskData failed", "err", err)
		forwardTask.State = repository.TaskStateFailed
		if _, err = task.UpdateTask(ctx, forwardTask); err != nil {
			tl.Errorw("ForwardTask runOnce UpdateTask failed", "newState", forwardTask.State, "err", err)
		}
		return true
	}

	lastBlockNumber, err := task.GetBlockNumber(ctx)
	if err != nil {
		tl.Errorw("ForwardTask runOnce GetBlockNumber failed", "err", err)
		return true
	}

	wait, from, to, maxBlock := task.GetForwardBlockRange(ctx, lastBlockNumber, taskData)
	if wait {
		return true
	}
	tl.Infow("ForwardTask runOnce blockRange", "from", from, "to", to, "count", to-from+1, "maxBlock", maxBlock)

	task.CheckBlockDelay(ctx, taskData.CurrentBlock, maxBlock)

	blockData, nextBlockNumber, err := task.poller.GetTronChainData(ctx, from, to)
	if err != nil {
		tl.Errorw("ForwardTask runOnce GetTronChainData failed", "err", err)

		if utils.IsOutsideHistoricalState(err) {
			task.onTaskOutsideHistoricalState(ctx, forwardTask, taskData, maxBlock)
		}
		return true
	}
	lastBlockHash, err := task.getLastBlockHash(blockData)
	if err != nil {
		tl.Errorw("ForwardTask runOnce getLastBlockHash failed", "err", err)
		return true
	}

	if err = task.poller.SendToKafKaWithRetry(ctx, blockData); err != nil {
		tl.Errorw("ForwardTask runOnce SendToKafKaWithRetry failed", "err", err)
		return true
	}

	// 更新监控指标
	monitor.CurrentBlockNumber.WithLabelValues(task.GetEnv(), task.GetChain().ToString()+"full_forward").Set(float64(to))

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

func (task *ForwardTask) getLastBlockHash(results []*tronclient.TronBlockInfo) (string, error) {
	if len(results) == 0 {
		return "", nil
	}
	lastBlock := results[len(results)-1]

	// 只解析hash字段，避免完整解析
	var blockData struct {
		BlockID string `json:"blockID"`
	}
	if err := json.Unmarshal(lastBlock.TronBlock, &blockData); err != nil {
		return "", fmt.Errorf("unmarshal block data blockNumber:%d failed: %w", lastBlock.BlockNumber, err)
	}
	return blockData.BlockID, nil
}

func (task *ForwardTask) CheckBlockDelay(ctx context.Context, currentBlockNumber, maxBlockNumber uint64) {

	// 为区块链查询创建 span，追踪查询时间
	checkBlockDelaySpanCtx, checkBlockDelaySpan := tracelog.StartSpan(ctx, "blockchain", "CheckBlockDelay")
	defer checkBlockDelaySpan.End()

	tl := tracelog.NewWithContext(checkBlockDelaySpanCtx)
	monitor.DelayBlockNumber.WithLabelValues(task.GetEnv(), task.GetChain().ToString()+"full_forward").Set(float64(maxBlockNumber))

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

func (task *ForwardTask) GetForwardBlockRange(ctx context.Context, lastBlockNumber uint64, forwardTask *FullForwardTaskData) (wait bool, from, to, maxBlock uint64) {
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
	return false, from, to, maxBlock
}

func (task *ForwardTask) GetChainCfg() *config.NacosTronChainConfig {
	return config.GetDefaultNacosChainCrawlerConfig().GetTronChainConfig()
}

func (task *ForwardTask) GetBlockInterval() time.Duration {
	interval := time.Duration(task.GetChainCfg().ForwardTask.BlockInterval) * time.Millisecond
	if interval > 0 {
		return interval
	}
	return DefaultBlockInterval
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

	blockNumber, err := task.tronClient.GetBlockNumber(blockNumberSpanCtx)
	if err != nil {
		return 0, err
	}
	// 更新监控指标
	monitor.LatestBlockNumber.WithLabelValues(task.GetEnv(), task.GetChain().ToString()+"full_forward").Set(float64(blockNumber))
	return blockNumber, nil
}

func (task *ForwardTask) GetTaskName() string {
	return task.BaseTask.GetTaskName()
}

func (task *ForwardTask) GetChain() consts.Chain {
	return task.chainInfo.Chain
}

func (task *ForwardTask) GetEnv() string {
	return task.cfg.Env
}
