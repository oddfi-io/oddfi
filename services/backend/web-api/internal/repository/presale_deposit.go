package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"everything_finance/org/web-api/internal/model"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrDepositNotFound = errors.New("presale deposit not found")

// PresaleDepositRepository 预售入账记录数据访问接口
type PresaleDepositRepository interface {
	// CreateOrGet 幂等写入：uk_(tx_hash, log_index) 冲突时返回已有记录
	// 双轨会师核心：前端 report-tx 和 Worker 扫块都调此方法，只有第一个调用方落库
	// 返回值：(record, created=true表示本次新建, err)
	CreateOrGet(ctx context.Context, tx *gorm.DB, deposit *model.PresaleDeposit) (*model.PresaleDeposit, bool, error)

	// GetByTxHash 前端轮询用，按 tx_hash + user_id 查单笔
	GetByTxHash(ctx context.Context, txHash string, userID uint64) (*model.PresaleDeposit, error)

	// ListByUser 用户历史入账，支持 status 筛选（空字符串=不筛选），按 block_timestamp 倒序
	ListByUser(ctx context.Context, userID uint64, status string, page, size int) ([]*model.PresaleDeposit, int64, error)

	// ConfirmDeposit 在事务内将 pending → confirmed，设置 confirmed_at
	// 设计为接收外部事务，让调用方（confirm-tx service）统一管理事务边界
	ConfirmDeposit(ctx context.Context, tx *gorm.DB, depositID uint64, confirmedAt int64) error

	// MarkAnomaly 将 deposit 置为 anomaly 并写 anomaly_reason
	MarkAnomaly(ctx context.Context, tx *gorm.DB, depositID uint64, reason string) error

	// ListPendingByBlockThreshold 供 Worker 扫已达到确认块数的 pending 订单推进状态
	ListPendingByBlockThreshold(ctx context.Context, safeBlockNumber uint64) ([]*model.PresaleDeposit, error)

	// ListByReferrerUserID 查邀请人（referrerUserID）为这批被邀请人（referredIDs）所触发的
	// 已 confirmed 入账记录，用于 GET /referral/list 接口的 deposits 明细字段。
	// 两次查询 + 内存聚合策略：先查 binds 拿 referredIDs，再批量查 deposits，避免大 JOIN。
	// referredIDs 为空时直接返回空切片（caller 已分页，无需防御）。
	ListByReferrerUserID(ctx context.Context, referrerUserID uint64, referredIDs []uint64) ([]*model.PresaleDeposit, error)

	// UpdateReferrerIfNull 是 BUG-001 回填工具专用：仅当 referrer_user_id IS NULL 时
	// 才更新 referrer/pct/reward 四元组（乐观锁兜底防 race condition）。
	// 返回 (updated, err)：updated=false 说明该 deposit 已被并发更新（应整条事务回滚）。
	// 必须在事务内调用（tx 非 nil），与 inv6_backfill_applied / UpsertReferral / audit 同事务。
	UpdateReferrerIfNull(
		ctx context.Context, tx *gorm.DB, depositID uint64,
		referrerUserID uint64, referrerEoa string,
		pct, rewardOdd decimal.Decimal,
	) (bool, error)
}

type presaleDepositRepo struct {
	db *gorm.DB
}

func NewPresaleDepositRepo(db *gorm.DB) PresaleDepositRepository {
	return &presaleDepositRepo{db: db}
}

func (r *presaleDepositRepo) CreateOrGet(ctx context.Context, tx *gorm.DB, deposit *model.PresaleDeposit) (*model.PresaleDeposit, bool, error) {
	// 使用 OnConflict DoNothing：uk_(tx_hash, log_index) 冲突时静默跳过，不更新任何字段
	// 然后 SELECT 回已有记录，调用方通过 created 判断是本次新建还是已存在
	db := tx
	if db == nil {
		db = r.db
	}

	result := db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(deposit)
	if result.Error != nil {
		return nil, false, fmt.Errorf("[PresaleDepositRepo] create deposit tx=%s log=%d: %w", deposit.TxHash, deposit.LogIndex, result.Error)
	}

	if result.RowsAffected == 1 {
		// 成功插入新记录
		return deposit, true, nil
	}

	// 冲突未插入，SELECT 回已有记录
	var existing model.PresaleDeposit
	if err := db.WithContext(ctx).
		Where("tx_hash = ? AND log_index = ?", deposit.TxHash, deposit.LogIndex).
		First(&existing).Error; err != nil {
		return nil, false, fmt.Errorf("[PresaleDepositRepo] get existing deposit tx=%s log=%d: %w", deposit.TxHash, deposit.LogIndex, err)
	}
	return &existing, false, nil
}

func (r *presaleDepositRepo) GetByTxHash(ctx context.Context, txHash string, userID uint64) (*model.PresaleDeposit, error) {
	var deposit model.PresaleDeposit
	if err := r.db.WithContext(ctx).
		Where("tx_hash = ? AND user_id = ?", txHash, userID).
		First(&deposit).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDepositNotFound
		}
		return nil, fmt.Errorf("[PresaleDepositRepo] get by tx_hash %s user %d: %w", txHash, userID, err)
	}
	return &deposit, nil
}

func (r *presaleDepositRepo) ListByUser(ctx context.Context, userID uint64, status string, page, size int) ([]*model.PresaleDeposit, int64, error) {
	q := r.db.WithContext(ctx).Model(&model.PresaleDeposit{}).Where("user_id = ?", userID)
	if status != "" {
		q = q.Where("status = ?", status)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("[PresaleDepositRepo] count deposits for user %d: %w", userID, err)
	}

	var deposits []*model.PresaleDeposit
	offset := (page - 1) * size
	if err := q.Order("block_timestamp DESC").Offset(offset).Limit(size).Find(&deposits).Error; err != nil {
		return nil, 0, fmt.Errorf("[PresaleDepositRepo] list deposits for user %d: %w", userID, err)
	}
	return deposits, total, nil
}

func (r *presaleDepositRepo) ConfirmDeposit(ctx context.Context, tx *gorm.DB, depositID uint64, confirmedAt int64) error {
	db := tx
	if db == nil {
		db = r.db
	}
	result := db.WithContext(ctx).
		Model(&model.PresaleDeposit{}).
		Where("id = ? AND status = ?", depositID, model.PresaleDepositStatusPending).
		Updates(map[string]interface{}{
			"status":       model.PresaleDepositStatusConfirmed,
			"confirmed_at": confirmedAt,
			"updated_at":   time.Now().UnixMilli(),
		})
	if result.Error != nil {
		return fmt.Errorf("[PresaleDepositRepo] confirm deposit %d: %w", depositID, result.Error)
	}
	return nil
}

func (r *presaleDepositRepo) MarkAnomaly(ctx context.Context, tx *gorm.DB, depositID uint64, reason string) error {
	db := tx
	if db == nil {
		db = r.db
	}
	result := db.WithContext(ctx).
		Model(&model.PresaleDeposit{}).
		Where("id = ?", depositID).
		Updates(map[string]interface{}{
			"status":         model.PresaleDepositStatusAnomaly,
			"anomaly_reason": reason,
			"updated_at":     time.Now().UnixMilli(),
		})
	if result.Error != nil {
		return fmt.Errorf("[PresaleDepositRepo] mark anomaly deposit %d reason %s: %w", depositID, reason, result.Error)
	}
	return nil
}

func (r *presaleDepositRepo) ListPendingByBlockThreshold(ctx context.Context, safeBlockNumber uint64) ([]*model.PresaleDeposit, error) {
	var deposits []*model.PresaleDeposit
	if err := r.db.WithContext(ctx).
		Where("status = ? AND block_number <= ?", model.PresaleDepositStatusPending, safeBlockNumber).
		Order("block_number ASC, log_index ASC").
		Find(&deposits).Error; err != nil {
		return nil, fmt.Errorf("[PresaleDepositRepo] list pending deposits by block threshold %d: %w", safeBlockNumber, err)
	}
	return deposits, nil
}

func (r *presaleDepositRepo) ListByReferrerUserID(ctx context.Context, referrerUserID uint64, referredIDs []uint64) ([]*model.PresaleDeposit, error) {
	if len(referredIDs) == 0 {
		// 被邀请人列表为空，直接返回空切片，避免生成无效 SQL（IN ()）
		return []*model.PresaleDeposit{}, nil
	}
	var deposits []*model.PresaleDeposit
	// 查条件：referrer_user_id = referrerUserID 且 user_id IN (referredIDs) 且 status = confirmed
	// 双条件保证数据归属正确：referrer_user_id 快照在 deposit 落库时已固定，不会随绑定变更
	if err := r.db.WithContext(ctx).
		Where("referrer_user_id = ? AND user_id IN ? AND status = ?",
			referrerUserID, referredIDs, model.PresaleDepositStatusConfirmed).
		Order("block_timestamp DESC").
		Find(&deposits).Error; err != nil {
		return nil, fmt.Errorf("[PresaleDepositRepo] list deposits by referrer %d for %d referred users: %w",
			referrerUserID, len(referredIDs), err)
	}
	return deposits, nil
}

// UpdateReferrerIfNull 是 BUG-001 INV-6 历史回填工具专用方法。
//
// 乐观锁语义：WHERE referrer_user_id IS NULL 保证若该行已被人为/并发更新过，
// 本次 UPDATE rowsAffected=0，调用方应整条事务回滚（不写 holding、不写 audit）。
// 与外层 inv6_backfill_applied INSERT IGNORE 形成"应用层 + DB 行级"双重去重防线。
func (r *presaleDepositRepo) UpdateReferrerIfNull(
	ctx context.Context, tx *gorm.DB, depositID uint64,
	referrerUserID uint64, referrerEoa string,
	pct, rewardOdd decimal.Decimal,
) (bool, error) {
	if tx == nil {
		return false, fmt.Errorf("[PresaleDepositRepo] UpdateReferrerIfNull must run inside a transaction")
	}
	res := tx.WithContext(ctx).
		Model(&model.PresaleDeposit{}).
		Where("id = ? AND referrer_user_id IS NULL", depositID).
		Updates(map[string]interface{}{
			"referrer_user_id":    referrerUserID,
			"referrer_eoa":        referrerEoa,
			"referral_reward_pct": pct,
			"referral_reward_odd": rewardOdd,
		})
	if res.Error != nil {
		return false, fmt.Errorf("[PresaleDepositRepo] update referrer for deposit %d: %w", depositID, res.Error)
	}
	return res.RowsAffected == 1, nil
}
