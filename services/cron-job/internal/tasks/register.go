package tasks

import (
	"oddfi-cron-job/internal/config"
	"oddfi-cron-job/internal/logger"
	"oddfi-cron-job/internal/task"

	"oddfi-cron-job/internal/tasks/execute/price"
	"oddfi-cron-job/internal/tasks/execute/withdrawal"
)

// TaskRegistrar 任务注册器接口，用于解耦循环导入
type TaskRegistrar interface {
	Register(t task.Task) error
}

// RegisterAll 注册所有任务
func RegisterAll(registrar TaskRegistrar, cfg *config.Config) error {
	tasks := []task.Task{
		price.NewPriceTask(),           // 价格获取任务（每分钟）
		withdrawal.NewWithdrawalTask(), // 提现处理任务（每5分钟）
	}

	for _, t := range tasks {
		if err := registrar.Register(t); err != nil {
			logger.Errorf("RegisterAll failed: %s, error: %v", t.Name(), err)
			return err
		}
	}

	return nil
}
