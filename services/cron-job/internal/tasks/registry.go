package tasks

import (
	"sync"

	"oddfi-cron-job/internal/task"
)

// Registry 任务注册中心
type Registry struct {
	tasks map[string]task.Task
	mu    sync.RWMutex
}

// NewRegistry 创建新的任务注册中心
func NewRegistry() *Registry {
	return &Registry{
		tasks: make(map[string]task.Task),
	}
}

// Register 注册一个任务
func (r *Registry) Register(t task.Task) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := t.Name()
	if _, exists := r.tasks[name]; exists {
		return ErrTaskAlreadyRegistered
	}

	r.tasks[name] = t
	return nil
}

// MustRegister 注册任务，如果失败则panic
func (r *Registry) MustRegister(t task.Task) {
	if err := r.Register(t); err != nil {
		panic(err)
	}
}

// Get 获取任务
func (r *Registry) Get(name string) (task.Task, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	t, exists := r.tasks[name]
	return t, exists
}

// List 获取所有任务
func (r *Registry) List() []task.Task {
	r.mu.RLock()
	defer r.mu.RUnlock()

	tasks := make([]task.Task, 0, len(r.tasks))
	for _, t := range r.tasks {
		tasks = append(tasks, t)
	}
	return tasks
}

// Len 返回任务数量
func (r *Registry) Len() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.tasks)
}

// Clear 清空所有任务
func (r *Registry) Clear() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tasks = make(map[string]task.Task)
}

// ErrTaskAlreadyRegistered 任务已注册错误
var ErrTaskAlreadyRegistered = &TaskError{"task already registered"}

// TaskError 任务错误
type TaskError struct {
	msg string
}

func (e *TaskError) Error() string {
	return e.msg
}
