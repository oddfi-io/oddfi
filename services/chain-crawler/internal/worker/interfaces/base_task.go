package interfaces

import (
	"chain_crawler/internal/repository"
	"chain_crawler/pkg/tracelog"
	"context"
	"time"
)

type BaseTask struct {
	taskCtx    context.Context
	cancel     context.CancelFunc
	shutdown   chan struct{}
	taskName   string
	repository repository.Repository
}

// NewBaseTask 创建基础任务
// 输入: parentCtx - 父级上下文（用于传递 trace 信息）, task - 任务名称, repository - 仓库接口
// 输出: *BaseTask - 基础任务实例
// 作用: 创建基础任务，从 parentCtx 创建带 trace 信息的任务上下文
func NewBaseTask(parentCtx context.Context, task string, repository repository.Repository) *BaseTask {
	newBaseTaskSpanCtx, newBaseTaskSpan := tracelog.StartSpan(parentCtx, "task", "NewBaseTask")
	defer newBaseTaskSpan.End()
	tl := tracelog.NewWithContext(newBaseTaskSpanCtx)
	tl.Infow("NewBaseTask success", "task", task)
	bt := &BaseTask{
		taskName:   task,
		repository: repository,
	}
	// 从 parentCtx 创建任务上下文，确保 trace 信息能够传递
	if parentCtx == nil {
		parentCtx = context.Background()
	}
	bt.taskCtx, bt.cancel = context.WithCancel(parentCtx)
	bt.shutdown = make(chan struct{}, 1)
	return bt
}

func (bt *BaseTask) Shutdown() {
	bt.cancel()
	<-bt.shutdown
}

func (bt *BaseTask) InShutdown() bool {
	select {
	case <-bt.taskCtx.Done():
		return true
	default:
		return false
	}
}

func (bt *BaseTask) GetTaskContext() context.Context {
	return bt.taskCtx
}

func (bt *BaseTask) GetRepository() repository.Repository {
	return bt.repository
}

func (bt *BaseTask) GetTaskName() string {
	return bt.taskName
}

func (bt *BaseTask) End() {
	bt.shutdown <- struct{}{}
}

func (bt *BaseTask) GetCurrentTask(ctx context.Context) (repository.ScheduleTask, error) {
	// 使用传入的 ctx 传递 trace 信息，同时确保任务生命周期控制
	queryCtx := ctx
	if queryCtx == nil {
		queryCtx = bt.taskCtx
	}

	// 为数据库查询创建 span，追踪查询时间
	querySpanCtx, querySpan := tracelog.StartSpan(queryCtx, "repository", "QueryTask")
	defer querySpan.End()
	// 使用 querySpanCtx 创建 logger，确保日志关联到 QueryTask span
	queryTl := tracelog.NewWithContext(querySpanCtx)
	tasks, err := bt.repository.QueryTask(querySpanCtx, repository.QueryTaskParams{
		Task: bt.taskName,
	})
	if err != nil {
		queryTl.Errorw("GetCurrentTask repository.QueryTask failed", "task", bt.GetTaskName(), "error", err.Error())
		return repository.ScheduleTask{}, err
	} else if len(tasks) > 0 {
		return tasks[0], nil
	}

	// 为数据库创建操作创建 span，追踪创建时间
	// 首次自动创建的任务需要手动修改State和Data才运行
	now := time.Now()
	taskInfo := repository.ScheduleTask{
		CreatedAt: now,
		UpdatedAt: now,
		Task:      bt.taskName,
		State:     repository.TaskStateDone, // 首次自动创建的任务需要手动修改State和Data才运行
		Data:      "",
	}
	createSpanCtx, createSpan := tracelog.StartSpan(queryCtx, "repository", "CreateTask")
	defer createSpan.End()
	// 使用 createSpanCtx 创建 logger，确保日志关联到 CreateTask span
	createTl := tracelog.NewWithContext(createSpanCtx)
	taskInfo.ID, err = bt.repository.CreateTask(createSpanCtx, taskInfo)
	if err != nil {
		createTl.Errorw("GetCurrentTask repository.CreateTask failed", "task", bt.GetTaskName(), "error", err.Error())
		return repository.ScheduleTask{}, err
	}
	return taskInfo, nil
}

func (bt *BaseTask) UpdateTaskWithState(ctx context.Context, task repository.ScheduleTask, preState repository.TaskState) (int64, error) {
	updateTaskWithStateSpanCtx, updateTaskWithStateSpan := tracelog.StartSpan(ctx, "repository", "UpdateTaskWithState")
	defer updateTaskWithStateSpan.End()
	tl := tracelog.NewWithContext(updateTaskWithStateSpanCtx)
	tl.Infow("UpdateTaskWithState success", "task", bt.GetTaskName(), "preState", preState)
	return bt.repository.UpdateTaskWithState(updateTaskWithStateSpanCtx, task, preState)
}

func (bt *BaseTask) UpdateTask(ctx context.Context, task repository.ScheduleTask) (int64, error) {
	// 为数据库查询创建 span，追踪查询时间
	updateSpanCtx, updateSpan := tracelog.StartSpan(ctx, "repository", "UpdateTask")
	defer updateSpan.End()
	return bt.repository.UpdateTask(updateSpanCtx, task)
}
