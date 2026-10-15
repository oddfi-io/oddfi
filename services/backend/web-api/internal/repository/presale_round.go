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

var (
	// ErrCapacityExceeded 表示本次累加会使 sold_odd 超出 supply_odd
	// 调用方收到此错误时应走 overflow anomaly 流程（进 presale_ops_event）
	ErrCapacityExceeded = errors.New("presale round capacity exceeded")
	ErrRoundNotFound    = errors.New("presale round not found")
)

// PresaleRoundRepository 预售轮次数据访问接口
type PresaleRoundRepository interface {
	// GetByID 取轮次配置，给 confirm-tx service 快照价格用
	GetByID(ctx context.Context, id string) (*model.PresaleRound, error)

	// List 返所有轮次（含 ended），给 config 接口用
	List(ctx context.Context) ([]*model.PresaleRound, error)

	// ListActive 只返 status ∈ {active, paused}，供 Worker 确认入账时找归属轮次
	ListActive(ctx context.Context) ([]*model.PresaleRound, error)

	// ListAutoAdvanceable cron 用：status=upcoming 且 now≥start_ts，或 status=active 且 now≥end_ts，
	// 且 manual_override=0（运营干预过的不自动推进）
	ListAutoAdvanceable(ctx context.Context, nowMs int64) ([]*model.PresaleRound, error)

	// AdvanceStatus cron 原子更新状态（带 manual_override=0 条件，防止覆盖运营操作）
	AdvanceStatus(ctx context.Context, id, fromStatus, toStatus string) error

	// IncrSoldAndRaised deposit 落 confirmed 时原子累加 sold_odd + raised_usd
	// 乐观条件 sold_odd + delta ≤ supply_odd：RowsAffected=0 时返回 ErrCapacityExceeded
	// tx 为外部事务，调用方统一管理事务边界
	IncrSoldAndRaised(ctx context.Context, tx *gorm.DB, roundID string, deltaOdd, deltaUsd decimal.Decimal) error

	// FindUpcomingNearest 找最近的 upcoming 轮次（按 start_ts ASC 取第一条）
	// 供 FindRound 边界容差超出时兜底；若无 upcoming 则返回 ErrRoundNotFound
	FindUpcomingNearest(ctx context.Context) (*model.PresaleRound, error)

	// TotalRaisedUsd 所有轮次 raised_usd 之和，给 config 接口的 totalRaisedUsd 字段用
	TotalRaisedUsd(ctx context.Context) (decimal.Decimal, error)
}

type presaleRoundRepo struct {
	db *gorm.DB
}

// NewPresaleRoundRepo 构造函数，接受外部 *gorm.DB（便于测试时注入 mock/sqlite）
func NewPresaleRoundRepo(db *gorm.DB) PresaleRoundRepository {
	return &presaleRoundRepo{db: db}
}

func (r *presaleRoundRepo) GetByID(ctx context.Context, id string) (*model.PresaleRound, error) {
	var round model.PresaleRound
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&round).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRoundNotFound
		}
		return nil, fmt.Errorf("[PresaleRoundRepo] get by id %s: %w", id, err)
	}
	return &round, nil
}

func (r *presaleRoundRepo) List(ctx context.Context) ([]*model.PresaleRound, error) {
	var rounds []*model.PresaleRound
	if err := r.db.WithContext(ctx).Order("sort_order asc").Find(&rounds).Error; err != nil {
		return nil, fmt.Errorf("[PresaleRoundRepo] list rounds: %w", err)
	}
	return rounds, nil
}

func (r *presaleRoundRepo) ListActive(ctx context.Context) ([]*model.PresaleRound, error) {
	var rounds []*model.PresaleRound
	if err := r.db.WithContext(ctx).
		Where("status IN ?", []string{model.RoundStatusActive, model.RoundStatusPaused}).
		Order("sort_order asc").
		Find(&rounds).Error; err != nil {
		return nil, fmt.Errorf("[PresaleRoundRepo] list active rounds: %w", err)
	}
	return rounds, nil
}

func (r *presaleRoundRepo) ListAutoAdvanceable(ctx context.Context, nowMs int64) ([]*model.PresaleRound, error) {
	// 找出 cron 需要自动推进的轮次：
	// 1. status=upcoming 且 now≥start_ts → 应推进到 active
	// 2. status=active 且 (now≥end_ts 或 sold_odd≥supply_odd) → 应推进到 ended
	// manual_override=0：运营干预过的轮次 cron 不碰
	var rounds []*model.PresaleRound
	if err := r.db.WithContext(ctx).
		Where("manual_override = 0 AND ((status = ? AND start_ts <= ?) OR (status = ? AND (end_ts <= ? OR sold_odd >= supply_odd)))",
			model.RoundStatusUpcoming, nowMs,
			model.RoundStatusActive, nowMs,
		).
		Order("sort_order asc").
		Find(&rounds).Error; err != nil {
		return nil, fmt.Errorf("[PresaleRoundRepo] list auto-advanceable rounds: %w", err)
	}
	return rounds, nil
}

func (r *presaleRoundRepo) AdvanceStatus(ctx context.Context, id, fromStatus, toStatus string) error {
	// WHERE 条件加 manual_override=0：防止 cron 覆盖运营在窗口期的手动操作
	result := r.db.WithContext(ctx).
		Model(&model.PresaleRound{}).
		Where("id = ? AND status = ? AND manual_override = 0", id, fromStatus).
		Updates(map[string]interface{}{
			"status":     toStatus,
			"updated_at": time.Now().UnixMilli(),
		})
	if result.Error != nil {
		return fmt.Errorf("[PresaleRoundRepo] advance status %s→%s for round %s: %w", fromStatus, toStatus, id, result.Error)
	}
	return nil
}

func (r *presaleRoundRepo) IncrSoldAndRaised(ctx context.Context, tx *gorm.DB, roundID string, deltaOdd, deltaUsd decimal.Decimal) error {
	// 乐观条件 sold_odd + delta ≤ supply_odd：单语句防超额，无需 SELECT-then-UPDATE 竞态
	// RowsAffected=0 有两种情况：轮次不存在 或 本次累加超出容量
	// 调用方已经通过 GetByID 确认轮次存在，所以 RowsAffected=0 即容量超限
	// 表名走 model.TableName() 以兼容 dev/prod 表名分离
	tbl := (model.PresaleRound{}).TableName()
	nowMs := time.Now().UnixMilli()
	result := tx.WithContext(ctx).Exec(
		fmt.Sprintf(`UPDATE %s
		    SET sold_odd   = sold_odd + ?,
		        raised_usd = raised_usd + ?,
		        updated_at = ?
		  WHERE id = ?
		    AND sold_odd + ? <= supply_odd`, tbl),
		deltaOdd, deltaUsd, nowMs, roundID, deltaOdd,
	)
	if result.Error != nil {
		return fmt.Errorf("[PresaleRoundRepo] incr sold and raised for round %s: %w", roundID, result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrCapacityExceeded
	}
	return nil
}

func (r *presaleRoundRepo) FindUpcomingNearest(ctx context.Context) (*model.PresaleRound, error) {
	// 找最近即将开始的 upcoming 轮次（start_ts ASC 取第一条）
	// 用于 FindRound 边界容差超出后的兜底：block_ts 在所有 active 窗口之前或空窗期时归属最近 upcoming
	var round model.PresaleRound
	if err := r.db.WithContext(ctx).
		Where("status = ?", model.RoundStatusUpcoming).
		Order("start_ts asc").
		First(&round).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRoundNotFound
		}
		return nil, fmt.Errorf("[PresaleRoundRepo] find upcoming nearest: %w", err)
	}
	return &round, nil
}

func (r *presaleRoundRepo) TotalRaisedUsd(ctx context.Context) (decimal.Decimal, error) {
	var total decimal.Decimal
	row := r.db.WithContext(ctx).
		Model(&model.PresaleRound{}).
		Select("COALESCE(SUM(raised_usd), 0)").
		Row()
	if err := row.Scan(&total); err != nil {
		return decimal.Zero, fmt.Errorf("[PresaleRoundRepo] total raised usd: %w", err)
	}
	return total, nil
}
