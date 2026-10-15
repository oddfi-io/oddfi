package scheduler

import (
	"context"
	"sync"
	"time"

	"oddfi-cron-job/internal/logger"
	"oddfi-cron-job/internal/task"
	"oddfi-cron-job/internal/tasks"

	"github.com/robfig/cron/v3"
)

// Scheduler 定时任务调度器
type Scheduler struct {
	cron         *cron.Cron
	taskRegistry *tasks.Registry
	taskResults  []task.TaskResult
	mu           sync.RWMutex
	wg           sync.WaitGroup
	ctx          context.Context
	cancel       context.CancelFunc
}

// SchedulerOption 调度器选项
type SchedulerOption func(*Scheduler)

// WithLocation 设置时区
func WithLocation(loc *time.Location) SchedulerOption {
	return func(s *Scheduler) {
		s.cron = cron.New(cron.WithLocation(loc))
	}
}

// NewScheduler 创建新的调度器
func NewScheduler(opts ...SchedulerOption) *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())

	s := &Scheduler{
		cron:         cron.New(cron.WithSeconds()),
		taskRegistry: tasks.NewRegistry(),
		ctx:          ctx,
		cancel:       cancel,
		taskResults:  make([]task.TaskResult, 0),
	}

	// 应用选项
	for _, opt := range opts {
		opt(s)
	}

	return s
}

// RegisterTask 注册任务
func (s *Scheduler) RegisterTask(t task.Task) error {
	// 先注册到注册中心
	if err := s.taskRegistry.Register(t); err != nil {
		return err
	}

	// 添加到cron调度器
	s.cron.AddFunc(t.Schedule(), func() {
		s.executeTask(t)
	})

	logger.Infof("Task registered: %s, schedule: %s", t.Name(), t.Schedule())
	return nil
}

// Register 实现了 tasks.TaskRegistrar 接口，用于注册任务到 Registry 和 cron
func (s *Scheduler) Register(t task.Task) error {
	return s.MustRegisterTask(t)
}

// MustRegisterTask 注册任务，失败则panic
func (s *Scheduler) MustRegisterTask(t task.Task) error {
	if err := s.RegisterTask(t); err != nil {
		panic(err)
	}
	return nil
}

// executeTask 执行任务（并发安全）
func (s *Scheduler) executeTask(t task.Task) {
	// 如果上下文已取消，不执行
	select {
	case <-s.ctx.Done():
		return
	default:
	}

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		start := time.Now()
		result := task.TaskResult{
			TaskName:   t.Name(),
			ExecutedAt: start,
		}

		// 创建带超时的上下文
		ctx, cancel := context.WithTimeout(s.ctx, 5*time.Minute)
		defer cancel()

		// 执行任务
		err := t.Execute(ctx)
		result.Duration = time.Since(start)
		result.Success = err == nil
		result.Error = err

		// 记录结果
		s.recordResult(result)

		// 记录日志
		if err != nil {
			logger.Errorf("Task failed: %s, error: %v, duration: %v",
				t.Name(), err, result.Duration)
		} else {
			logger.Infof("Task completed: %s, duration: %v",
				t.Name(), result.Duration)
		}
	}()
}

// recordResult 记录任务执行结果
func (s *Scheduler) recordResult(result task.TaskResult) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 只保留最近100条记录
	if len(s.taskResults) >= 100 {
		s.taskResults = s.taskResults[1:]
	}
	s.taskResults = append(s.taskResults, result)
}

// Start 启动调度器
func (s *Scheduler) Start() error {
	logger.Infof("Starting scheduler with %d tasks", s.taskRegistry.Len())

	// 启动cron
	s.cron.Start()

	// 立即执行所有任务一次（可选）
	// s.RunAllNow()

	return nil
}

// Stop 停止调度器（优雅关闭）
func (s *Scheduler) Stop() {
	logger.Infof("Stopping scheduler...")

	// 停止cron（不再接受新任务）
	s.cron.Stop()

	// 取消上下文，通知正在执行的任务
	s.cancel()

	// 等待所有任务完成（最多等待30秒）
	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		logger.Infof("All tasks finished gracefully")
	case <-time.After(30 * time.Second):
		logger.Warnf("Timeout waiting for tasks to finish")
	}

	logger.Infof("Scheduler stopped")
}

// RunAllNow 立即执行所有任务（用于测试）
func (s *Scheduler) RunAllNow() {
	tasks := s.taskRegistry.List()
	for _, t := range tasks {
		s.executeTask(t)
	}
}

// GetTaskRegistry 获取任务注册中心
func (s *Scheduler) GetTaskRegistry() *tasks.Registry {
	return s.taskRegistry
}

// GetResults 获取任务执行历史
func (s *Scheduler) GetResults() []task.TaskResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	results := make([]task.TaskResult, len(s.taskResults))
	copy(results, s.taskResults)
	return results
}

// GetTaskCount 获取任务数量
func (s *Scheduler) GetTaskCount() int {
	return s.taskRegistry.Len()
}
