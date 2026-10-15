package repository

import (
	"context"
	"errors"
	"fmt"

	"everything_finance/org/web-api/internal/model"

	"gorm.io/gorm"
)

var ErrOpsEventNotFound = errors.New("presale ops event not found")

// PresaleOpsEventRepository 预售异常事件数据访问接口
type PresaleOpsEventRepository interface {
	// Create 落异常事件（在事务内调用，与 deposit anomaly 更新同一事务）
	Create(ctx context.Context, tx *gorm.DB, event *model.PresaleOpsEvent) error

	// ListPending 查 pending 状态的待处理事件，供 Lark 推送 cron 调用
	ListPending(ctx context.Context, limit int) ([]*model.PresaleOpsEvent, error)

	// UpdateStatus 更新事件状态（notified/resolved/rejected）
	UpdateStatus(ctx context.Context, tx *gorm.DB, id uint64, status string) error
}

type presaleOpsEventRepo struct {
	db *gorm.DB
}

func NewPresaleOpsEventRepo(db *gorm.DB) PresaleOpsEventRepository {
	return &presaleOpsEventRepo{db: db}
}

func (r *presaleOpsEventRepo) Create(ctx context.Context, tx *gorm.DB, event *model.PresaleOpsEvent) error {
	db := tx
	if db == nil {
		db = r.db
	}
	if err := db.WithContext(ctx).Create(event).Error; err != nil {
		return fmt.Errorf("[PresaleOpsEventRepo] create ops event type=%s: %w", event.EventType, err)
	}
	return nil
}

func (r *presaleOpsEventRepo) ListPending(ctx context.Context, limit int) ([]*model.PresaleOpsEvent, error) {
	var events []*model.PresaleOpsEvent
	if err := r.db.WithContext(ctx).
		Where("status = ?", model.OpsEventStatusPending).
		Order("created_at ASC").
		Limit(limit).
		Find(&events).Error; err != nil {
		return nil, fmt.Errorf("[PresaleOpsEventRepo] list pending ops events: %w", err)
	}
	return events, nil
}

func (r *presaleOpsEventRepo) UpdateStatus(ctx context.Context, tx *gorm.DB, id uint64, status string) error {
	db := tx
	if db == nil {
		db = r.db
	}
	result := db.WithContext(ctx).
		Model(&model.PresaleOpsEvent{}).
		Where("id = ?", id).
		Update("status", status)
	if result.Error != nil {
		return fmt.Errorf("[PresaleOpsEventRepo] update status for event %d: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrOpsEventNotFound
	}
	return nil
}
