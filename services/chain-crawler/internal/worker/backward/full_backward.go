package backward

import (
	"chain_crawler/internal/repository"
	"chain_crawler/internal/utils"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/kafka"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/web3chain"
	"context"
	"encoding/json"
	"fmt"
	"runtime/debug"
	"time"

	"github.com/avast/retry-go"
)

const (
	FullBackwardTaskNamePrefix = "full_backward"
	MaxFullBackwardBatchSize   = 32
	MaxFullBackwardRunTimes    = 2 // 为了防止超长的区块回溯请求阻塞队列，一次执行最多循环3次，最大处理的区块数为 步长*MaxFullBackwardRunTimes，所有的任务轮了一遍之后再继续
)

type Provider[T any] interface {
	GetRepository() repository.Repository
	GetBlockData(ctx context.Context, startBlock uint64, endBlock uint64) ([]T, error)
	SendBlockDataToKafka(ctx context.Context, results []T) error
}

type FullBackwardTaskData struct {
	Chain        consts.Chain      `json:"chain"`
	StartBlock   uint64            `json:"start_block"`
	EndBlock     uint64            `json:"end_block"`
	CurrentBlock uint64            `json:"current_block"` // 当前处理到的区块(还未处理的)
	BlockStep    uint64            `json:"block_step"`
	Extension    map[string]string `json:"extension,omitempty"` // 回溯任务参数，会在发送Kafka消息时放入Kafka的header中
}

func (data *FullBackwardTaskData) Encode() string {
	bs, _ := json.Marshal(data)
	return string(bs)
}

type FullBackwardTask[T any] struct {
	chain    web3chain.Chain
	provider Provider[T]
	task     string
}

func NewFullBackwardTask[T any](taskName string, chain web3chain.Chain, provider Provider[T]) *FullBackwardTask[T] {
	return &FullBackwardTask[T]{
		task:     taskName,
		chain:    chain,
		provider: provider,
	}
}

func (fet *FullBackwardTask[T]) GetChain() consts.Chain {
	return fet.chain.Chain
}

func (fet *FullBackwardTask[T]) DoBackwardTask(ctx context.Context, confirmedBlockNumber uint64) (notWait bool, err error) {

	// 为区块链查询创建 span，追踪查询时间
	backwardTaskSpanCtx, backwardTaskSpan := tracelog.StartSpan(ctx, "blockchain", "DoBackwardTask")
	defer backwardTaskSpan.End()

	tl := tracelog.NewWithContext(backwardTaskSpanCtx)
	defer func() {
		if r := recover(); r != nil {
			tl.Errorw("DoBackwardTask panic", "error", r, "stack", string(debug.Stack()))
			err = fmt.Errorf("panic error: %s", r)
		}
	}()

	var tasks []repository.ScheduleTask
	tasks, err = fet.provider.GetRepository().QueryTask(ctx, repository.QueryTaskParams{
		TaskStartWith: GetFullBackwardTaskNameChain(fet.GetChain()),
		StateList:     []repository.TaskState{repository.TaskStatePending, repository.TaskStateProcessing},
		OrderBy:       "updated_at asc",
		Limit:         MaxFullBackwardBatchSize,
	})
	if err != nil {
		tl.Errorw("DoBackwardTask QueryTask failed", "chain", fet.GetChain(), "error", err.Error())
		return false, err
	}

	var noWait bool
	for _, task := range tasks {
		nw, err := fet.doBackwardTask(ctx, &task, confirmedBlockNumber)
		if err != nil {
			tl.Errorw("DoBackwardTask doBackwardTask failed", "chain", fet.GetChain(), "taskId", task.ID, "task", task.Task, "error", err.Error())
			return false, err
		}
		if nw {
			noWait = true
		}
	}
	return noWait, nil
}

func (fet *FullBackwardTask[T]) doBackwardTask(ctx context.Context, task *repository.ScheduleTask, confirmedBlockNumber uint64) (noWait bool, err error) {

	// 为区块链查询创建 span，追踪查询时间
	doBackwardTaskSpanCtx, doBackwardTaskSpan := tracelog.StartSpan(ctx, "blockchain", "doBackwardTask")
	defer doBackwardTaskSpan.End()

	tl := tracelog.NewWithContext(doBackwardTaskSpanCtx)
	var taskData = &FullBackwardTaskData{}
	if err = json.Unmarshal([]byte(task.Data), taskData); err != nil {
		tl.Errorw("doBackwardTask Unmarshal failed", "chain", fet.GetChain(), "taskId", task.ID, "task", task.Task, "error", err.Error())
		return false, err
	}
	if taskData.Chain != fet.GetChain() {
		tl.Errorw("doBackwardTask chain mismatch", "taskId", task.ID, "task", task.Task, "expected_chain", fet.GetChain(), "actual_chain", taskData.Chain)
		return false, fmt.Errorf("invalid chain:%s", taskData.Chain)
	}
	if taskData.CurrentBlock < taskData.StartBlock {
		taskData.CurrentBlock = taskData.StartBlock
	}
	tl.Infow("doBackwardTask start", "chain", fet.GetChain(), "taskId", task.ID, "task", task.Task, "currentBlock", taskData.CurrentBlock, "endBlock", taskData.EndBlock, "state", task.State, "confirmedBlockNumber", confirmedBlockNumber)

	var results []T
	blockStep := taskData.BlockStep
	if blockStep <= 0 {
		blockStep = utils.GetDefaultBlockStep(fet.GetChain())
	}
	startBlock := taskData.CurrentBlock

	// 如果当前区块已经大于最新的确认区块，则不处理，等待下次轮询
	if confirmedBlockNumber > 0 && startBlock > confirmedBlockNumber {
		return false, nil
	}

	runTimes := 1
	for (confirmedBlockNumber == 0 || startBlock <= confirmedBlockNumber) && startBlock <= taskData.EndBlock && runTimes <= MaxFullBackwardRunTimes {
		endBlock := startBlock + blockStep - 1
		if endBlock > taskData.EndBlock {
			endBlock = taskData.EndBlock
		}
		if endBlock > confirmedBlockNumber {
			endBlock = confirmedBlockNumber
		}
		batchCount := endBlock - startBlock + 1

		tl.Infow("doBackwardTask processing blocks", "chain", fet.GetChain(), "startBlock", startBlock, "endBlock", endBlock, "count", batchCount, "taskId", task.ID, "task", task.Task)
		if err = retry.Do(func() error {
			results, err = fet.provider.GetBlockData(doBackwardTaskSpanCtx, startBlock, endBlock)
			if err != nil {
				tl.Errorw("doBackwardTask GetBlockData failed", "chain", fet.GetChain(), "startBlock", startBlock, "endBlock", endBlock, "taskId", task.ID, "task", task.Task, "error", err)
				return err
			}
			return nil
		},
			retry.Attempts(3),
			retry.Delay(time.Second),
			retry.OnRetry(func(n uint, err error) {
				tl.Infow("doBackwardTask retrying", "attempt", n+1, "chain", fet.GetChain(), "startBlock", startBlock, "endBlock", endBlock, "taskId", task.ID, "task", task.Task, "error", err.Error())
			})); err != nil {
			return false, err
		}

		// 发送数据到 Kafka
		// 将 header 从 task data 中获取并存储到 context 中
		ctxWithHeaders := doBackwardTaskSpanCtx
		if len(taskData.Extension) > 0 {
			ctxWithHeaders = kafka.WithKafkaHeaders(doBackwardTaskSpanCtx, taskData.Extension)
		}
		if err = retry.Do(func() error {
			if err = fet.provider.SendBlockDataToKafka(ctxWithHeaders, results); err != nil {
				tl.Errorw("doBackwardTask SendBlockDataToKafka failed", "chain", fet.GetChain(), "startBlock", startBlock, "endBlock", endBlock, "taskId", task.ID, "task", task.Task, "error", err.Error())
			}
			return nil
		},
			retry.Attempts(3),
			retry.Delay(time.Second),
			retry.OnRetry(func(n uint, err error) {
				tl.Infow("doBackwardTask sendKafkaWithRetry retrying", "attempt", n+1, "chain", fet.GetChain(), "startBlock", startBlock, "endBlock", endBlock, "taskId", task.ID, "task", task.Task, "error", err.Error())
			})); err != nil {
			return false, err
		}

		startBlock += batchCount
		runTimes++
	}

	taskData.CurrentBlock = startBlock // 更新到下一个区块
	state := repository.TaskStateProcessing
	if taskData.CurrentBlock > taskData.EndBlock {
		state = repository.TaskStateDone
		taskData.CurrentBlock = taskData.EndBlock + 1
	}

	oldState := task.State
	data, _ := json.Marshal(taskData)
	task.Data = string(data)
	task.State = state
	if _, err = fet.provider.GetRepository().UpdateTaskWithState(doBackwardTaskSpanCtx, *task, oldState); err != nil {
		tl.Errorw("doBackwardTask UpdateTaskWithState failed", "chain", fet.GetChain(), "taskId", task.ID, "task", task.Task, "state", state, "error", err.Error())
		return false, err
	}
	tl.Infow("doBackwardTask updateTask", "chain", fet.GetChain(), "taskId", task.ID, "task", task.Task, "state", state)
	time.Sleep(time.Millisecond * 100) // 避免mysql读写延时，导致的task查询到的数据不一致问题
	return state != repository.TaskStateDone, nil
}

func GetFullBackwardTaskName(chain consts.Chain, startBlock, endBlock uint64) string {
	if startBlock == endBlock {
		return fmt.Sprintf("%s_%s_%d", FullBackwardTaskNamePrefix, chain, startBlock)
	}
	return fmt.Sprintf("%s_%s_%d_%d", FullBackwardTaskNamePrefix, chain, startBlock, endBlock)
}

func GetFullBackwardTaskNameChain(chain consts.Chain) string {
	return fmt.Sprintf("%s_%s", FullBackwardTaskNamePrefix, chain)
}
