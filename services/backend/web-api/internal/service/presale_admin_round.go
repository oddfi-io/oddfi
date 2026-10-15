// Package service — 预售轮次 admin 业务层（DD-003 v3.1 B5）。
//
// 状态机合法转换：
//
//	pause:  active  → paused  （manual_override=1）
//	resume: paused  → active  （manual_override=1）
//	reopen: ended   → active  （manual_override=1）
//	close:  active|paused → ended（manual_override=1）
//
// 所有写操作接收 *gorm.DB tx（由 admin_audit middleware 在 ctx 中开启，handler 负责 gormtx.From 取出）。
package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"

	"github.com/shopspring/decimal"
)

// adminRoundValidTransitions 合法状态转换表（action → 允许的当前状态列表）。
var adminRoundValidTransitions = map[string][]string{
	"pause":  {model.RoundStatusActive},
	"resume": {model.RoundStatusPaused},
	"reopen": {model.RoundStatusEnded},
	"close":  {model.RoundStatusActive, model.RoundStatusPaused},
}

// ErrInvalidStateTransition 表示非法状态机转换。
var ErrInvalidStateTransition = errors.New("invalid state transition")

// ErrRoundNotFound 表示轮次不存在（admin 层包装）。
var ErrAdminRoundNotFound = errors.New("presale round not found")

// UpdateRoundRequest 是 PATCH /internal/admin/presale/rounds/:id 的 DTO（全字段可选）。
type UpdateRoundRequest struct {
	PriceUsd          *decimal.Decimal
	SupplyOdd         *decimal.Decimal
	EndTs             *int64
	MinPerOrderUsd    *decimal.Decimal
	MaxPerWalletUsd   *decimal.Decimal
	TgeReleasePct     *decimal.Decimal
	LinearReleaseDays *int
}

// PresaleAdminRoundService 封装 admin 轮次业务逻辑。
type PresaleAdminRoundService interface {
	// ListRounds 列出全部轮次（admin 视图）
	ListRounds(ctx context.Context) ([]*model.PresaleRound, error)

	// GetRound 获取单轮次详情
	GetRound(ctx context.Context, id string) (*model.PresaleRound, error)

	// GetRoundTx 在共享事务内读取轮次（不加行锁，before 快照用）
	GetRoundTx(tx *gorm.DB, id string) (*model.PresaleRound, error)

	// PauseRound active → paused
	PauseRound(tx *gorm.DB, id string) (*model.PresaleRound, error)

	// ResumeRound paused → active
	ResumeRound(tx *gorm.DB, id string) (*model.PresaleRound, error)

	// ReopenRound ended → active
	ReopenRound(tx *gorm.DB, id string) (*model.PresaleRound, error)

	// CloseRound active|paused → ended
	CloseRound(tx *gorm.DB, id string) (*model.PresaleRound, error)

	// UpdateReferralPct 更新邀请奖励比例
	UpdateReferralPct(tx *gorm.DB, id string, pct decimal.Decimal) (*model.PresaleRound, error)

	// UpdateRound 更新 round 字段（super_admin 专用）
	UpdateRound(tx *gorm.DB, id string, req *UpdateRoundRequest) (*model.PresaleRound, error)
}

type presaleAdminRoundService struct {
	repo repository.AdminPresaleRoundRepository
}

// NewPresaleAdminRoundService 构造默认实现。
func NewPresaleAdminRoundService(repo repository.AdminPresaleRoundRepository) PresaleAdminRoundService {
	return &presaleAdminRoundService{repo: repo}
}

func (s *presaleAdminRoundService) ListRounds(ctx context.Context) ([]*model.PresaleRound, error) {
	rounds, err := s.repo.AdminList(ctx)
	if err != nil {
		return nil, fmt.Errorf("[PresaleAdminRoundService] list rounds: %w", err)
	}
	return rounds, nil
}

func (s *presaleAdminRoundService) GetRound(ctx context.Context, id string) (*model.PresaleRound, error) {
	// admin 读取不需要 tx，走普通查询（接口只读，无审计中间件）
	// 通过 GetByIDTx 用 nil tx 不对，这里直接通过 AdminList 过滤
	// 实际上 admin 专用 repo 的 GetByIDTx 需要 tx，直接用 AdminGetByID
	// 此处复用 GetRoundTx with a non-tx read — 改用专门的无 tx 版本
	rounds, err := s.repo.AdminList(ctx)
	if err != nil {
		return nil, fmt.Errorf("[PresaleAdminRoundService] get round %s: %w", id, err)
	}
	for _, r := range rounds {
		if r.ID == id {
			return r, nil
		}
	}
	return nil, ErrAdminRoundNotFound
}

func (s *presaleAdminRoundService) GetRoundTx(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	round, err := s.repo.GetByIDTx(tx, id)
	if err != nil {
		if errors.Is(err, repository.ErrRoundNotFound) {
			return nil, ErrAdminRoundNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminRoundService] get round tx %s: %w", id, err)
	}
	return round, nil
}

func (s *presaleAdminRoundService) PauseRound(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	return s.applyTransition(tx, id, "pause", model.RoundStatusPaused)
}

func (s *presaleAdminRoundService) ResumeRound(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	return s.applyTransition(tx, id, "resume", model.RoundStatusActive)
}

func (s *presaleAdminRoundService) ReopenRound(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	return s.applyTransition(tx, id, "reopen", model.RoundStatusActive)
}

func (s *presaleAdminRoundService) CloseRound(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	return s.applyTransition(tx, id, "close", model.RoundStatusEnded)
}

// applyTransition 通用状态机转换：SELECT FOR UPDATE 加行锁，校验合法转换后 UPDATE。
func (s *presaleAdminRoundService) applyTransition(tx *gorm.DB, id, action, targetStatus string) (*model.PresaleRound, error) {
	round, err := s.repo.GetForUpdate(tx, id)
	if err != nil {
		if errors.Is(err, repository.ErrRoundNotFound) {
			return nil, ErrAdminRoundNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminRoundService] get for update %s: %w", id, err)
	}

	allowed := adminRoundValidTransitions[action]
	if !slices.Contains(allowed, round.Status) {
		return nil, fmt.Errorf("%w: cannot %s round in status=%s", ErrInvalidStateTransition, action, round.Status)
	}

	now := time.Now().UnixMilli()
	fields := map[string]any{
		"status":          targetStatus,
		"manual_override": true, // 运营手动干预，防止 cron 自动推进覆盖
		"updated_at":      now,
	}
	if err := s.repo.UpdateFields(tx, id, fields); err != nil {
		return nil, fmt.Errorf("[PresaleAdminRoundService] update fields %s: %w", id, err)
	}

	round.Status = targetStatus
	round.ManualOverride = true
	round.UpdatedAt = now
	return round, nil
}

// UpdateReferralPct 更新邀请奖励比例，校验 0~100 范围。
func (s *presaleAdminRoundService) UpdateReferralPct(tx *gorm.DB, id string, pct decimal.Decimal) (*model.PresaleRound, error) {
	round, err := s.repo.GetForUpdate(tx, id)
	if err != nil {
		if errors.Is(err, repository.ErrRoundNotFound) {
			return nil, ErrAdminRoundNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminRoundService] get round %s: %w", id, err)
	}
	if pct.IsNegative() || pct.GreaterThan(decimal.NewFromInt(100)) {
		return nil, fmt.Errorf("[PresaleAdminRoundService] referral_reward_pct=%s out of range [0,100]", pct.String())
	}
	if err := s.repo.UpdateReferralPct(tx, id, pct); err != nil {
		return nil, fmt.Errorf("[PresaleAdminRoundService] update referral_pct %s: %w", id, err)
	}
	round.ReferralRewardPct = pct
	round.UpdatedAt = time.Now().UnixMilli()
	return round, nil
}

// UpdateRound 更新 round 字段（price/supply/end_ts 等），全字段可选。
func (s *presaleAdminRoundService) UpdateRound(tx *gorm.DB, id string, req *UpdateRoundRequest) (*model.PresaleRound, error) {
	round, err := s.repo.GetForUpdate(tx, id)
	if err != nil {
		if errors.Is(err, repository.ErrRoundNotFound) {
			return nil, ErrAdminRoundNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminRoundService] get round %s: %w", id, err)
	}

	fields := map[string]any{}

	if req.PriceUsd != nil {
		if req.PriceUsd.IsNegative() || req.PriceUsd.IsZero() {
			return nil, fmt.Errorf("[PresaleAdminRoundService] price_usd must be > 0")
		}
		fields["price_usd"] = *req.PriceUsd
		round.PriceUsd = *req.PriceUsd
	}
	if req.SupplyOdd != nil {
		if req.SupplyOdd.IsNegative() || req.SupplyOdd.IsZero() {
			return nil, fmt.Errorf("[PresaleAdminRoundService] supply_odd must be > 0")
		}
		if req.SupplyOdd.LessThan(round.SoldOdd) {
			return nil, fmt.Errorf("[PresaleAdminRoundService] supply_odd cannot be less than sold_odd=%s", round.SoldOdd.String())
		}
		fields["supply_odd"] = *req.SupplyOdd
		round.SupplyOdd = *req.SupplyOdd
	}
	if req.EndTs != nil {
		if *req.EndTs <= round.StartTs {
			return nil, fmt.Errorf("[PresaleAdminRoundService] end_ts must be > start_ts")
		}
		fields["end_ts"] = *req.EndTs
		round.EndTs = *req.EndTs
	}
	if req.MinPerOrderUsd != nil {
		fields["min_per_order_usd"] = *req.MinPerOrderUsd
		round.MinPerOrderUsd = req.MinPerOrderUsd
	}
	if req.MaxPerWalletUsd != nil {
		fields["max_per_wallet_usd"] = *req.MaxPerWalletUsd
		round.MaxPerWalletUsd = req.MaxPerWalletUsd
	}
	if req.TgeReleasePct != nil {
		fields["tge_release_pct"] = *req.TgeReleasePct
		round.TgeReleasePct = *req.TgeReleasePct
	}
	if req.LinearReleaseDays != nil {
		fields["linear_release_days"] = *req.LinearReleaseDays
		round.LinearReleaseDays = uint(*req.LinearReleaseDays)
	}

	// 没有任何字段改动，noop
	if len(fields) == 0 {
		return round, nil
	}

	if err := s.repo.UpdateFields(tx, id, fields); err != nil {
		return nil, fmt.Errorf("[PresaleAdminRoundService] update round %s: %w", id, err)
	}
	round.UpdatedAt = time.Now().UnixMilli()
	return round, nil
}
