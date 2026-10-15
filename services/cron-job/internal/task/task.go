package task

import (
	"context"
	"time"
)

// Task 定时任务接口
type Task interface {
	// Name 返回任务名称
	Name() string

	// Execute 执行任务逻辑
	Execute(ctx context.Context) error

	// Schedule 返回cron表达式
	Schedule() string
}

// TaskResult 任务执行结果
type TaskResult struct {
	TaskName   string
	Success    bool
	Error      error
	Duration   time.Duration
	ExecutedAt time.Time
}

// TaskListener 任务执行监听器（可选扩展）
type TaskListener interface {
	// OnBeforeExecute 任务执行前回调
	OnBeforeExecute(ctx context.Context, task Task) error

	// OnAfterExecute 任务执行后回调
	OnAfterExecute(result TaskResult) error
}
