package repository

import (
	"context"
	"time"

	"chain_crawler/pkg/tracelog"

	"gorm.io/gorm"
)

type TaskState int64

const (
	TaskStatePending    TaskState = 0
	TaskStateProcessing TaskState = 1
	TaskStateDone       TaskState = 2
	TaskStateFailed     TaskState = 3
)

type ScheduleTask struct {
	ID        uint      `gorm:"primarykey;idx_update_id,priority:2"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime;idx_update_id,priority:1"`
	Task      string    `gorm:"column:task;uniqueIndex:uniq_task;type:varchar(64)" json:"task" form:"task"`
	State     TaskState `gorm:"column:state;type:smallint" json:"state" form:"state"`
	Data      string    `gorm:"column:data;type:text" json:"data" form:"data"`
}

func (s ScheduleTask) IsPending() bool {
	return s.State == TaskStatePending
}

func (s ScheduleTask) IsProcessing() bool {
	return s.State == TaskStateProcessing
}

func (s ScheduleTask) IsDone() bool {
	return s.State == TaskStateDone
}

func (s ScheduleTask) IsFailed() bool {
	return s.State == TaskStateFailed
}

func (s ScheduleTask) TableName() string {
	return "schedule_task"
}

type QueryTaskParams struct {
	Task          string
	TaskStartWith string
	StateList     []TaskState
	OrderBy       string
	Limit         int
}

// CreateTask 创建新任务
// 输入: ctx - 上下文（包含 trace 信息）, task - 任务信息
// 输出: uint - 任务ID, error - 错误信息
// 作用: 在数据库中创建新任务，并创建 span 追踪创建时间
func (s *repositoryImpl) CreateTask(ctx context.Context, task ScheduleTask) (uint, error) {
	// 创建数据库操作 span，追踪创建时间
	_, span := tracelog.StartSpan(ctx, "database", "CreateTask")
	defer span.End()

	tl := tracelog.NewWithContext(ctx)
	task.CreatedAt = time.Now()
	tx := s.db.Begin()
	if err := tx.Create(&task).Error; err != nil {
		tx.Rollback()
		tl.Warnw("tx.Create failed", "error", err.Error())
		return task.ID, err
	}
	return task.ID, tx.Commit().Error
}
func (s *repositoryImpl) UpdateTask(ctx context.Context, task ScheduleTask) (int64, error) {
	// 创建数据库操作 span，追踪更新时间
	_, span := tracelog.StartSpan(ctx, "database", "UpdateTask")
	defer span.End()

	tl := tracelog.NewWithContext(ctx)
	tx := s.db.Begin()
	tx = tx.Model(task)
	if err := tx.Updates(&task).Error; err != nil {
		tx.Rollback()
		tl.Warnw("tx.Updates failed", "error", err.Error())
		return 0, err
	}
	result := tx.Commit()
	return result.RowsAffected, result.Error
}
func (s *repositoryImpl) UpdateTaskWithSelect(ctx context.Context, task ScheduleTask) (int64, error) {
	// 创建数据库操作 span，追踪更新时间
	updateTaskWithSelectSpanCtx, updateTaskWithSelectSpan := tracelog.StartSpan(ctx, "database", "UpdateTaskWithSelect")
	defer updateTaskWithSelectSpan.End()

	tl := tracelog.NewWithContext(updateTaskWithSelectSpanCtx)
	tx := s.db.Begin()
	tx = tx.Model(task)
	if err := tx.Select("task", "state", "data", "updated_at").Updates(&task).Error; err != nil {
		tx.Rollback()
		tl.Warnw("tx.Updates failed", "error", err.Error())
		return 0, err
	}
	result := tx.Commit()
	return result.RowsAffected, result.Error
}

func (s *repositoryImpl) UpdateTaskWithState(ctx context.Context, task ScheduleTask, taskState TaskState) (int64, error) {
	// 创建数据库操作 span，追踪更新时间
	updateTaskWithStateSpanCtx, updateTaskWithStateSpan := tracelog.StartSpan(ctx, "database", "UpdateTaskWithState")
	defer updateTaskWithStateSpan.End()

	tl := tracelog.NewWithContext(updateTaskWithStateSpanCtx)
	tx := s.db.Begin()
	tx = tx.Model(task)
	if err := tx.Where("state = ?", taskState).Updates(&task).Error; err != nil {
		tx.Rollback()
		tl.Warnw("tx.Updates failed", "error", err.Error())
		return 0, err
	}
	result := tx.Commit()
	return result.RowsAffected, result.Error
}

func (s *repositoryImpl) buildTaskWhere(tx *gorm.DB, params QueryTaskParams) *gorm.DB {
	if len(params.Task) > 0 {
		tx = tx.Where("task = ?", params.Task)
	}
	if len(params.TaskStartWith) > 0 {
		tx = tx.Where("task LIKE ?", params.TaskStartWith+"%")
	}
	if len(params.StateList) > 0 {
		tx = tx.Where("state IN ?", params.StateList)
	}
	if len(params.OrderBy) > 0 {
		tx = tx.Order(params.OrderBy)
	}
	if params.Limit > 0 {
		tx = tx.Limit(params.Limit)
	}
	return tx
}

// QueryTask 查询任务列表
// 输入: ctx - 上下文（包含 trace 信息）, params - 查询参数
// 输出: []ScheduleTask - 任务列表, error - 错误信息
// 作用: 根据查询参数从数据库查询任务列表，并创建 span 追踪查询时间
func (s *repositoryImpl) QueryTask(ctx context.Context, params QueryTaskParams) ([]ScheduleTask, error) {
	// 创建数据库查询 span，追踪查询时间
	_, span := tracelog.StartSpan(ctx, "database", "QueryTask")
	defer span.End()

	var tasks []ScheduleTask
	tx := s.buildTaskWhere(s.db, params)
	if err := tx.Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}
