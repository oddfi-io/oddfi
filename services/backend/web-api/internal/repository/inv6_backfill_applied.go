package repository

import (
	"context"
	"fmt"

	"everything_finance/org/web-api/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Inv6BackfillAppliedRepository 是 BUG-001 INV-6 回填工具的去重表访问接口。
//
// 关键语义：MarkApplied 是 INSERT IGNORE — 如果 deposit_id 已存在（前次已回填）
// 返回 (false, nil)，调用方必须基于此 skip 整条事务（不再 UPDATE deposit、不再
// UpsertReferral holding）。
type Inv6BackfillAppliedRepository interface {
	// MarkApplied 尝试登记一条回填记录，返回 (inserted, err)。
	//   inserted=true  → 本次首次回填，继续后续 UPDATE/UpsertReferral
	//   inserted=false → 该 deposit_id 已有回填记录，应整条事务 skip
	// tx 必须非 nil（强制在外层事务内调用，与 deposit UPDATE / holding UpsertReferral 同事务）
	MarkApplied(ctx context.Context, tx *gorm.DB, row *model.Inv6BackfillApplied) (bool, error)

	// CountTotal 用于运维报告（dry-run 输出 / 跑完后审计）
	CountTotal(ctx context.Context) (int64, error)
}

type inv6BackfillAppliedRepo struct {
	db *gorm.DB
}

func NewInv6BackfillAppliedRepo(db *gorm.DB) Inv6BackfillAppliedRepository {
	return &inv6BackfillAppliedRepo{db: db}
}

func (r *inv6BackfillAppliedRepo) MarkApplied(ctx context.Context, tx *gorm.DB, row *model.Inv6BackfillApplied) (bool, error) {
	if tx == nil {
		return false, fmt.Errorf("[Inv6BackfillApplied] MarkApplied must run inside a transaction")
	}
	// ON CONFLICT DO NOTHING 等价于 MySQL INSERT IGNORE
	// rows_affected=1 → 本次插入成功；=0 → 已存在（前次已回填）
	res := tx.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(row)
	if res.Error != nil {
		return false, fmt.Errorf("[Inv6BackfillApplied] insert ignore deposit_id=%d: %w", row.DepositID, res.Error)
	}
	return res.RowsAffected == 1, nil
}

func (r *inv6BackfillAppliedRepo) CountTotal(ctx context.Context) (int64, error) {
	var n int64
	if err := r.db.WithContext(ctx).Model(&model.Inv6BackfillApplied{}).Count(&n).Error; err != nil {
		return 0, fmt.Errorf("[Inv6BackfillApplied] count: %w", err)
	}
	return n, nil
}
