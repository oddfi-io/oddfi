package tasks

import (
	"context"
	"testing"

	"oddfi-cron-job/internal/logger"
)

type MockTask struct {
	name     string
	schedule string
}

func (m *MockTask) Name() string          { return m.name }
func (m *MockTask) Schedule() string      { return m.schedule }
func (m *MockTask) Execute(ctx context.Context) error {
	return nil
}

func TestMain(m *testing.M) {
	_ = logger.Init("debug", "console")
	m.Run()
}

func TestRegistry_Register(t *testing.T) {
	reg := NewRegistry()

	task1 := &MockTask{name: "task1", schedule: "*/5 * * * *"}
	task2 := &MockTask{name: "task2", schedule: "0 * * * *"}

	// 注册任务1
	if err := reg.Register(task1); err != nil {
		t.Errorf("Failed to register task1: %v", err)
	}

	// 重复注册应该失败
	if err := reg.Register(task1); err == nil {
		t.Error("Expected error when registering duplicate task")
	}

	// 注册任务2
	if err := reg.Register(task2); err != nil {
		t.Errorf("Failed to register task2: %v", err)
	}

	// 检查数量
	if reg.Len() != 2 {
		t.Errorf("Expected 2 tasks, got %d", reg.Len())
	}

	// 获取任务
	registered, ok := reg.Get("task1")
	if !ok {
		t.Error("Task1 not found")
	}
	if registered.Name() != "task1" {
		t.Errorf("Expected task name 'task1', got '%s'", registered.Name())
	}
}

func TestRegistry_List(t *testing.T) {
	reg := NewRegistry()

	taskList := []*MockTask{
		{name: "task1", schedule: "*/5 * * * *"},
		{name: "task2", schedule: "0 * * * *"},
		{name: "task3", schedule: "0 0 * * *"},
	}

	for _, task := range taskList {
		reg.MustRegister(task)
	}

	all := reg.List()
	if len(all) != 3 {
		t.Errorf("Expected 3 tasks, got %d", len(all))
	}
}

func TestRegistry_Clear(t *testing.T) {
	reg := NewRegistry()
	reg.MustRegister(&MockTask{name: "task1", schedule: "* * * * *"})

	reg.Clear()
	if reg.Len() != 0 {
		t.Errorf("Expected empty registry after clear, got %d", reg.Len())
	}
}
