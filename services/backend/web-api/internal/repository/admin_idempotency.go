// Package repository — admin_idempotency 表的访问。
//
// DD-003 v3.1 §4.3 设计要点：
//   - 所有写操作必须在 admin_audit middleware 提供的 tx 内进行（同 tx 与 audit / business 原子）
//   - LookupByKey 在 tx 内做 SELECT FOR UPDATE 防并发
//   - 90 天 TTL，cron 清理只动本表，不动 audit
package repository

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"everything_finance/org/web-api/internal/model"
)

// AdminIdempotencyRepository 是幂等表读写接口。
type AdminIdempotencyRepository interface {
	// LookupForUpdate 在 tx 内 SELECT FOR UPDATE 查 key；
	// 返回 (existing, true) 表示命中；(nil, false, nil) 表示未命中；error 为系统错误。
	LookupForUpdate(tx *gorm.DB, key string) (*model.AdminIdempotency, bool, error)

	// Create 在 tx 内 INSERT；调用方应当先 LookupForUpdate 确认无冲突。
	Create(tx *gorm.DB, row *model.AdminIdempotency) error

	// UpdateResponse 在 tx 内回填 response_status / response_snapshot / audit_id。
	UpdateResponse(tx *gorm.DB, id uint64, status int, snapshot string, auditID uint64) error

	// CleanExpired 删除 expires_at < now 的行（cron 调用，不走 tx）。
	CleanExpired(ctx context.Context, nowMs int64) (int64, error)
}

type adminIdempotencyRepo struct {
	db *gorm.DB
}

// NewAdminIdempotencyRepository 构造 repo。db 为业务 GORM 实例。
func NewAdminIdempotencyRepository(db *gorm.DB) AdminIdempotencyRepository {
	return &adminIdempotencyRepo{db: db}
}

func (r *adminIdempotencyRepo) LookupForUpdate(tx *gorm.DB, key string) (*model.AdminIdempotency, bool, error) {
	if tx == nil {
		return nil, false, fmt.Errorf("[AdminIdempotency] LookupForUpdate requires non-nil tx")
	}
	var row model.AdminIdempotency
	err := tx.Where("idempotency_key = ?", key).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("[AdminIdempotency] lookup: %w", err)
	}
	return &row, true, nil
}

func (r *adminIdempotencyRepo) Create(tx *gorm.DB, row *model.AdminIdempotency) error {
	if tx == nil {
		return fmt.Errorf("[AdminIdempotency] Create requires non-nil tx")
	}
	if row == nil {
		return fmt.Errorf("[AdminIdempotency] row is nil")
	}
	return tx.Create(row).Error
}

func (r *adminIdempotencyRepo) UpdateResponse(tx *gorm.DB, id uint64, status int, snapshot string, auditID uint64) error {
	if tx == nil {
		return fmt.Errorf("[AdminIdempotency] UpdateResponse requires non-nil tx")
	}
	updates := map[string]any{
		"response_status":   status,
		"response_snapshot": snapshot,
	}
	if auditID > 0 {
		updates["audit_id"] = auditID
	}
	return tx.Model(&model.AdminIdempotency{}).
		Where("id = ?", id).
		Updates(updates).Error
}

func (r *adminIdempotencyRepo) CleanExpired(ctx context.Context, nowMs int64) (int64, error) {
	res := r.db.WithContext(ctx).
		Where("expires_at < ?", nowMs).
		Delete(&model.AdminIdempotency{})
	if res.Error != nil {
		return 0, fmt.Errorf("[AdminIdempotency] clean expired: %w", res.Error)
	}
	return res.RowsAffected, nil
}
