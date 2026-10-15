package repository

import (
	"context"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/model"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// PresaleHoldingRepository 预售持仓聚合数据访问接口
type PresaleHoldingRepository interface {
	// UpsertInvest 认购持仓 upsert（source=1），在事务内调用
	// 加权平均成本价公式：new_avg = (old_total×old_avg + delta×price) / (old_total + delta)
	// 用 MySQL ON DUPLICATE KEY UPDATE 单语句实现，避免 SELECT-then-UPDATE 竞态
	UpsertInvest(ctx context.Context, tx *gorm.DB, userID uint64, roundID string, deltaOdd, deltaUsd, price decimal.Decimal) error

	// UpsertReferral 邀请奖励持仓 upsert（source=2）
	// invested_usd / locked_price_avg 不动（邀励是凭空发的，无成本价语义，恒为 0）
	UpsertReferral(ctx context.Context, tx *gorm.DB, referrerUserID uint64, roundID string, deltaOdd decimal.Decimal) error

	// ListByUser 聚合用户所有轮次持仓（position 接口用）
	ListByUser(ctx context.Context, userID uint64) ([]*model.PresaleHolding, error)

	// SumReferralOdd 汇总用户所有轮次邀请奖励 ODD（source=2）
	// 用于 GET /referral/me 接口的 stats.totalRewardOdd 字段
	// 从 presale_holding 聚合而非 presale_deposit，因为 holding 是经过 migrate-round 修订后的最终真相
	SumReferralOdd(ctx context.Context, userID uint64) (decimal.Decimal, error)
}

type presaleHoldingRepo struct {
	db *gorm.DB
}

func NewPresaleHoldingRepo(db *gorm.DB) PresaleHoldingRepository {
	return &presaleHoldingRepo{db: db}
}

func (r *presaleHoldingRepo) UpsertInvest(ctx context.Context, tx *gorm.DB, userID uint64, roundID string, deltaOdd, deltaUsd, price decimal.Decimal) error {
	db := tx
	if db == nil {
		db = r.db
	}
	nowMs := time.Now().UnixMilli()

	// 加权平均成本价公式通过 ON DUPLICATE KEY UPDATE 在单语句内计算：
	// locked_price_avg = (old_total * old_avg + VALUES(total_odd) * VALUES(locked_price_avg))
	//                  / (old_total + VALUES(total_odd))
	// 其中 VALUES(locked_price_avg) = 本次 price（下注时轮次价格快照）
	// 此公式保证无论并发多少次 upsert，最终的加权平均成本价都正确
	// 表名走 model.TableName() 以兼容 dev/prod 表名分离
	tbl := (model.PresaleHolding{}).TableName()
	err := db.WithContext(ctx).Exec(
		fmt.Sprintf(`INSERT INTO %s
		    (user_id, round_id, source, total_odd, invested_usd, locked_price_avg, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
		    locked_price_avg = (total_odd * locked_price_avg + VALUES(total_odd) * VALUES(locked_price_avg))
		                     / (total_odd + VALUES(total_odd)),
		    total_odd        = total_odd + VALUES(total_odd),
		    invested_usd     = invested_usd + VALUES(invested_usd),
		    updated_at       = VALUES(updated_at)`, tbl),
		userID, roundID, model.HoldingSourceInvest,
		deltaOdd, deltaUsd, price,
		nowMs, nowMs,
	).Error
	if err != nil {
		return fmt.Errorf("[PresaleHoldingRepo] upsert invest holding user=%d round=%s: %w", userID, roundID, err)
	}
	return nil
}

func (r *presaleHoldingRepo) UpsertReferral(ctx context.Context, tx *gorm.DB, referrerUserID uint64, roundID string, deltaOdd decimal.Decimal) error {
	db := tx
	if db == nil {
		db = r.db
	}
	nowMs := time.Now().UnixMilli()

	// referral 行只累加 total_odd，invested_usd / locked_price_avg 恒为 0
	tbl := (model.PresaleHolding{}).TableName()
	err := db.WithContext(ctx).Exec(
		fmt.Sprintf(`INSERT INTO %s
		    (user_id, round_id, source, total_odd, invested_usd, locked_price_avg, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, 0, ?, ?)
		ON DUPLICATE KEY UPDATE
		    total_odd  = total_odd + VALUES(total_odd),
		    updated_at = VALUES(updated_at)`, tbl),
		referrerUserID, roundID, model.HoldingSourceReferral,
		deltaOdd, nowMs, nowMs,
	).Error
	if err != nil {
		return fmt.Errorf("[PresaleHoldingRepo] upsert referral holding user=%d round=%s: %w", referrerUserID, roundID, err)
	}
	return nil
}

func (r *presaleHoldingRepo) ListByUser(ctx context.Context, userID uint64) ([]*model.PresaleHolding, error) {
	var holdings []*model.PresaleHolding
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("round_id ASC, source ASC").
		Find(&holdings).Error; err != nil {
		return nil, fmt.Errorf("[PresaleHoldingRepo] list holdings for user %d: %w", userID, err)
	}
	return holdings, nil
}

func (r *presaleHoldingRepo) SumReferralOdd(ctx context.Context, userID uint64) (decimal.Decimal, error) {
	// 聚合 source=2（邀请奖励）的 total_odd，跨所有轮次求和
	// 使用 presale_holding 而非 presale_deposit，因为 holding 是最终真相（deposit 可能被 migrate-round 修订）
	var result struct {
		Total decimal.Decimal `gorm:"column:total"`
	}
	err := r.db.WithContext(ctx).
		Model(&model.PresaleHolding{}).
		Select("COALESCE(SUM(total_odd), 0) AS total").
		Where("user_id = ? AND source = ?", userID, model.HoldingSourceReferral).
		Scan(&result).Error
	if err != nil {
		return decimal.Zero, fmt.Errorf("[PresaleHoldingRepo] sum referral odd for user %d: %w", userID, err)
	}
	return result.Total, nil
}
