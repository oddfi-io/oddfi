// Package repository — presale_ops_event admin 专用方法（DD-003 v3.1 B5）。
package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/model"

	"gorm.io/gorm"
)

// PresaleOpsEventFilter admin 异常事件列表查询条件。
type PresaleOpsEventFilter struct {
	EventType string
	Status    string
	FromTs    int64
	ToTs      int64
	Page      int
	Size      int
}

// AdminPresaleOpsEventRepository admin 专用异常事件操作接口。
type AdminPresaleOpsEventRepository interface {
	// AdminGetByID 按 ID 查询单条异常事件
	AdminGetByID(ctx context.Context, id uint64) (*model.PresaleOpsEvent, error)

	// AdminGetForUpdate 在事务内加行锁读取（resolve 防并发）
	AdminGetForUpdate(tx *gorm.DB, id uint64) (*model.PresaleOpsEvent, error)

	// AdminList 分页查询异常事件（多条件）
	AdminList(ctx context.Context, f PresaleOpsEventFilter) ([]*model.PresaleOpsEvent, int64, error)

	// UpdateResolve 更新 resolve 结果（resolved_by / resolve_note / status / resolved_at）
	UpdateResolve(tx *gorm.DB, id uint64, operatorID, note, status string) error
}

type adminPresaleOpsEventRepo struct {
	db *gorm.DB
}

// NewAdminPresaleOpsEventRepo 构造 admin 专用 ops_event repo。
func NewAdminPresaleOpsEventRepo(db *gorm.DB) AdminPresaleOpsEventRepository {
	return &adminPresaleOpsEventRepo{db: db}
}

func (r *adminPresaleOpsEventRepo) AdminGetByID(ctx context.Context, id uint64) (*model.PresaleOpsEvent, error) {
	var evt model.PresaleOpsEvent
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&evt).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOpsEventNotFound
		}
		return nil, fmt.Errorf("[AdminPresaleOpsEventRepo] get by id %d: %w", id, err)
	}
	return &evt, nil
}

func (r *adminPresaleOpsEventRepo) AdminGetForUpdate(tx *gorm.DB, id uint64) (*model.PresaleOpsEvent, error) {
	var evt model.PresaleOpsEvent
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", id).First(&evt).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOpsEventNotFound
		}
		return nil, fmt.Errorf("[AdminPresaleOpsEventRepo] get for update %d: %w", id, err)
	}
	return &evt, nil
}

func (r *adminPresaleOpsEventRepo) AdminList(ctx context.Context, f PresaleOpsEventFilter) ([]*model.PresaleOpsEvent, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.PresaleOpsEvent{})

	if f.EventType != "" {
		q = q.Where("event_type = ?", f.EventType)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.FromTs > 0 {
		q = q.Where("created_at >= ?", f.FromTs)
	}
	if f.ToTs > 0 {
		q = q.Where("created_at < ?", f.ToTs)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("[AdminPresaleOpsEventRepo] count: %w", err)
	}

	page := f.Page
	if page <= 0 {
		page = 1
	}
	size := f.Size
	if size <= 0 || size > 100 {
		size = 20
	}
	offset := (page - 1) * size

	var items []*model.PresaleOpsEvent
	if err := q.Order("created_at DESC").Offset(offset).Limit(size).Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("[AdminPresaleOpsEventRepo] list: %w", err)
	}
	return items, total, nil
}

func (r *adminPresaleOpsEventRepo) UpdateResolve(tx *gorm.DB, id uint64, operatorID, note, status string) error {
	now := time.Now().UnixMilli()
	result := tx.Model(&model.PresaleOpsEvent{}).Where("id = ?", id).Updates(map[string]any{
		"status":       status,
		"resolved_by":  operatorID,
		"resolve_note": note,
		"resolved_at":  now,
		"updated_at":   now,
	})
	if result.Error != nil {
		return fmt.Errorf("[AdminPresaleOpsEventRepo] update resolve %d: %w", id, result.Error)
	}
	return nil
}
