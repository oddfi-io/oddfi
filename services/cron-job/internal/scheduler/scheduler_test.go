package scheduler

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"oddfi-cron-job/internal/logger"
)

// TestTask 测试用任务
type TestTask struct {
	name      string
	schedule  string
	execCount int32
	executeFn func(ctx context.Context) error
}

func (t *TestTask) Name() string                { return t.name }
func (t *TestTask) Schedule() string            { return t.schedule }
func (t *TestTask) Execute(ctx context.Context) error {
	atomic.AddInt32(&t.execCount, 1)
	return t.executeFn(ctx)
}

func TestMain(m *testing.M) {
	// 初始化日志（测试环境使用console编码）
	_ = logger.Init("debug", "console")
	m.Run()
}

func TestScheduler_RegisterTask(t *testing.T) {
	sched := NewScheduler()

	testTask := &TestTask{
		name:     "test_task",
		schedule: "@every 1s",
		executeFn: func(ctx context.Context) error {
			return nil
		},
	}

	if err := sched.RegisterTask(testTask); err != nil {
		t.Fatalf("Failed to register task: %v", err)
	}

	if sched.GetTaskCount() != 1 {
		t.Errorf("Expected 1 task, got %d", sched.GetTaskCount())
	}
}

func TestScheduler_StartStop(t *testing.T) {
	sched := NewScheduler()

	testTask := &TestTask{
		name:     "test_task",
		schedule: "@every 1s",
		executeFn: func(ctx context.Context) error {
			time.Sleep(100 * time.Millisecond)
			return nil
		},
	}

	sched.MustRegisterTask(testTask)

	// 启动调度器
	if err := sched.Start(); err != nil {
		t.Fatalf("Failed to start scheduler: %v", err)
	}

	// 等待任务执行
	time.Sleep(2 * time.Second)

	// 检查任务执行次数
	count := atomic.LoadInt32(&testTask.execCount)
	if count < 1 {
		t.Errorf("Expected task to execute at least once, got %d", count)
	}

	// 停止调度器
	sched.Stop()
}

func TestScheduler_DuplicateTask(t *testing.T) {
	sched := NewScheduler()

	testTask := &TestTask{
		name:     "test_task",
		schedule: "@every 1s",
		executeFn: func(ctx context.Context) error {
			return nil
		},
	}

	// 第一次注册应该成功
	if err := sched.RegisterTask(testTask); err != nil {
		t.Fatalf("Failed to register task: %v", err)
	}

	// 第二次注册应该失败
	if err := sched.RegisterTask(testTask); err == nil {
		t.Error("Expected error when registering duplicate task")
	}
}

func TestScheduler_GracefulShutdown(t *testing.T) {
	sched := NewScheduler()

	longTask := &TestTask{
		name:     "long_task",
		schedule: "@every 100ms",
		executeFn: func(ctx context.Context) error {
			time.Sleep(500 * time.Millisecond)
			return nil
		},
	}

	sched.MustRegisterTask(longTask)

	// 启动调度器
	sched.Start()

	// 等待一段时间让任务开始执行
	time.Sleep(200 * time.Millisecond)

	// 停止调度器（应该等待任务完成）
	done := make(chan struct{})
	go func() {
		sched.Stop()
		close(done)
	}()

	select {
	case <-done:
		// 正常完成
	case <-time.After(3 * time.Second):
		t.Error("Scheduler did not stop gracefully within timeout")
	}
}
