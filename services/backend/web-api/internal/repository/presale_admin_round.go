// Package repository — presale_round admin 专用方法（DD-003 v3.1 B5）。
//
// 这些方法在已有 PresaleRoundRepository 接口之外，
// 仅供 admin internal endpoint 使用，单独定义接口以保持清晰边界。
package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/model"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// AdminPresaleRoundRepository admin 专用轮次操作接口。
type AdminPresaleRoundRepository interface {
	// GetByIDTx 在已有事务内读轮次（不加行锁，用于 before 快照）
	GetByIDTx(tx *gorm.DB, id string) (*model.PresaleRound, error)

	// GetForUpdate 加行锁读取轮次（SELECT … FOR UPDATE），防并发状态机冲突
	GetForUpdate(tx *gorm.DB, id string) (*model.PresaleRound, error)

	// UpdateFields 按 map 更新轮次指定字段（tx 内）
	UpdateFields(tx *gorm.DB, id string, fields map[string]any) error

	// UpdateReferralPct 仅更新 referral_reward_pct 字段（tx 内）
	UpdateReferralPct(tx *gorm.DB, id string, pct decimal.Decimal) error

	// AdminList 列出全部轮次（含 ended），admin 列表接口用
	AdminList(ctx context.Context) ([]*model.PresaleRound, error)

	// AdjustSoldOdd 原子调整 sold_odd + raised_usd（migrate-round 时补偿旧轮次、增量新轮次）
	// delta 可以是负数（减量），无容量上限约束（admin 操作）
	AdjustSoldOdd(tx *gorm.DB, roundID string, deltaOdd, deltaUsd decimal.Decimal) error
}

type adminPresaleRoundRepo struct {
	db *gorm.DB
}

// NewAdminPresaleRoundRepo 构造 admin 专用 round repo。
func NewAdminPresaleRoundRepo(db *gorm.DB) AdminPresaleRoundRepository {
	return &adminPresaleRoundRepo{db: db}
}

func (r *adminPresaleRoundRepo) GetByIDTx(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	var round model.PresaleRound
	if err := tx.Where("id = ?", id).First(&round).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRoundNotFound
		}
		return nil, fmt.Errorf("[AdminPresaleRoundRepo] get by id tx %s: %w", id, err)
	}
	return &round, nil
}

func (r *adminPresaleRoundRepo) GetForUpdate(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	var round model.PresaleRound
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", id).First(&round).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRoundNotFound
		}
		return nil, fmt.Errorf("[AdminPresaleRoundRepo] get for update %s: %w", id, err)
	}
	return &round, nil
}

func (r *adminPresaleRoundRepo) UpdateFields(tx *gorm.DB, id string, fields map[string]any) error {
	fields["updated_at"] = time.Now().UnixMilli()
	result := tx.Model(&model.PresaleRound{}).Where("id = ?", id).Updates(fields)
	if result.Error != nil {
		return fmt.Errorf("[AdminPresaleRoundRepo] update fields %s: %w", id, result.Error)
	}
	return nil
}

func (r *adminPresaleRoundRepo) UpdateReferralPct(tx *gorm.DB, id string, pct decimal.Decimal) error {
	result := tx.Model(&model.PresaleRound{}).Where("id = ?", id).Updates(map[string]any{
		"referral_reward_pct": pct,
		"updated_at":          time.Now().UnixMilli(),
	})
	if result.Error != nil {
		return fmt.Errorf("[AdminPresaleRoundRepo] update referral_pct %s: %w", id, result.Error)
	}
	return nil
}

func (r *adminPresaleRoundRepo) AdminList(ctx context.Context) ([]*model.PresaleRound, error) {
	var rounds []*model.PresaleRound
	if err := r.db.WithContext(ctx).Order("sort_order asc").Find(&rounds).Error; err != nil {
		return nil, fmt.Errorf("[AdminPresaleRoundRepo] admin list: %w", err)
	}
	return rounds, nil
}

func (r *adminPresaleRoundRepo) AdjustSoldOdd(tx *gorm.DB, roundID string, deltaOdd, deltaUsd decimal.Decimal) error {
	// admin 专用：无容量上限校验（迁移时 admin 有权超量调整）
	tbl := (model.PresaleRound{}).TableName()
	result := tx.Exec(
		fmt.Sprintf(`UPDATE %s SET sold_odd = sold_odd + ?, raised_usd = raised_usd + ?, updated_at = ? WHERE id = ?`, tbl),
		deltaOdd, deltaUsd, time.Now().UnixMilli(), roundID,
	)
	if result.Error != nil {
		return fmt.Errorf("[AdminPresaleRoundRepo] adjust sold_odd round=%s: %w", roundID, result.Error)
	}
	return nil
}
