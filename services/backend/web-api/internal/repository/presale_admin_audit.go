// Package repository — presale_admin_audit 表的访问。
//
// DD-003 v3.1 设计要点：
//   - 写：admin_audit middleware 在 tx 内调用 Create（tx 来自 gormtx.From(ctx)）
//   - 读：admin 查询 audit 日志走 List + filter
//   - 永不 DELETE（合规留存 5-7 年）
package repository

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
)

// PresaleAdminAuditFilter 是查询过滤条件。
type PresaleAdminAuditFilter struct {
	Operator   string // 精确匹配 lark_user_id
	Action     string // 精确匹配 action 类型
	TargetType string
	TargetID   string
	StartTime  int64 // 毫秒，含
	EndTime    int64 // 毫秒，不含
	Limit      int
	Offset     int
}

// PresaleAdminAuditRepository 是 audit 表读写接口。
type PresaleAdminAuditRepository interface {
	// Create 在 caller 提供的 tx 上 INSERT；caller 负责 commit/rollback。
	Create(tx *gorm.DB, entry *model.PresaleAdminAudit) error

	// List 分页查询（带 filter），不走 tx，直接走主 db。
	List(ctx context.Context, f PresaleAdminAuditFilter) ([]model.PresaleAdminAudit, int64, error)

	// CountByTargetAndAction 用于 migrate-round 等"历史限 N 次"业务校验。
	CountByTargetAndAction(ctx context.Context, targetType, targetID, action string) (int64, error)
}

type presaleAdminAuditRepo struct {
	db *gorm.DB
}

// NewPresaleAdminAuditRepository 构造 audit repo。db 为业务 GORM 实例。
func NewPresaleAdminAuditRepository(db *gorm.DB) PresaleAdminAuditRepository {
	return &presaleAdminAuditRepo{db: db}
}

func (r *presaleAdminAuditRepo) Create(tx *gorm.DB, entry *model.PresaleAdminAudit) error {
	if tx == nil {
		return fmt.Errorf("[PresaleAdminAudit] Create requires non-nil tx (middleware must wrap with gormtx)")
	}
	if entry == nil {
		return fmt.Errorf("[PresaleAdminAudit] entry is nil")
	}
	return tx.Create(entry).Error
}

func (r *presaleAdminAuditRepo) List(ctx context.Context, f PresaleAdminAuditFilter) ([]model.PresaleAdminAudit, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.PresaleAdminAudit{})

	if f.Operator != "" {
		q = q.Where("operator = ?", f.Operator)
	}
	if f.Action != "" {
		q = q.Where("action = ?", f.Action)
	}
	if f.TargetType != "" {
		q = q.Where("target_type = ?", f.TargetType)
	}
	if f.TargetID != "" {
		q = q.Where("target_id = ?", f.TargetID)
	}
	if f.StartTime > 0 {
		q = q.Where("created_at >= ?", f.StartTime)
	}
	if f.EndTime > 0 {
		q = q.Where("created_at < ?", f.EndTime)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("[PresaleAdminAudit] count: %w", err)
	}

	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}

	var items []model.PresaleAdminAudit
	if err := q.Order("created_at DESC, id DESC").
		Limit(limit).Offset(offset).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("[PresaleAdminAudit] list: %w", err)
	}
	return items, total, nil
}

func (r *presaleAdminAuditRepo) CountByTargetAndAction(ctx context.Context, targetType, targetID, action string) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.PresaleAdminAudit{}).
		Where("target_type = ? AND target_id = ? AND action = ?", targetType, targetID, action).
		Count(&count).Error; err != nil {
		return 0, fmt.Errorf("[PresaleAdminAudit] count by target+action: %w", err)
	}
	return count, nil
}
