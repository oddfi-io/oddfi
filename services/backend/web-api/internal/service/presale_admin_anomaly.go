// Package service — 预售异常事件 admin 业务层（DD-003 v3.1 B5）。
//
// Resolve 三种分支：
//   - convert_to_deposit：将 anomaly deposit 改为 confirmed + 更新 holding + 调整 round.sold_odd
//   - partial_credit：overflow 场景，deposit 改 confirmed + 更新 holding（不重算份额）
//   - reject：拒绝处理，仅更新 ops_event 状态
//
// 前置校验：ops_event.Status ∈ {pending, notified}，否则返回 ErrInvalidStateTransition。
package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"

	"github.com/shopspring/decimal"
)

// Resolution 是 anomaly/resolve 的处理方式枚举。
type Resolution string

const (
	ResolutionConvertToDeposit Resolution = "convert_to_deposit"
	ResolutionPartialCredit    Resolution = "partial_credit"
	ResolutionReject           Resolution = "reject"
)

// ResolveRequest 是 POST /internal/admin/presale/anomaly/:id/resolve 的 DTO。
type ResolveRequest struct {
	Resolution    string
	TargetRoundID *string
	Note          string
}

// ErrAnomalyNotFound 表示异常事件不存在。
var ErrAnomalyNotFound = errors.New("presale anomaly event not found")

// ErrInvalidResolution 表示 anomaly resolve 传入的 resolution 不在 enum 内。
// 由 admin handler 映射为 400 INVALID_RESOLUTION，避免裸 error 落 500。
var ErrInvalidResolution = errors.New("invalid resolution")

// PresaleAdminAnomalyService 封装异常事件查询 + resolve 3 种分支。
type PresaleAdminAnomalyService interface {
	// ListAnomaly 分页查询异常事件
	ListAnomaly(ctx context.Context, f repository.PresaleOpsEventFilter) ([]*model.PresaleOpsEvent, int64, error)

	// GetAnomaly 按 id 查询单条
	GetAnomaly(ctx context.Context, id uint64) (*model.PresaleOpsEvent, error)

	// GetAnomalyTx 在共享事务内查询（before 快照用）
	GetAnomalyTx(tx *gorm.DB, id uint64) (*model.PresaleOpsEvent, error)

	// Resolve 处理异常事件（3 种 resolution）
	Resolve(tx *gorm.DB, id uint64, req *ResolveRequest, operatorID string) (*model.PresaleOpsEvent, error)
}

type presaleAdminAnomalyService struct {
	eventRepo   repository.AdminPresaleOpsEventRepository
	depRepo     repository.AdminPresaleDepositRepository
	roundRepo   repository.AdminPresaleRoundRepository
	holdingRepo repository.PresaleHoldingRepository
}

// NewPresaleAdminAnomalyService 构造默认实现。
func NewPresaleAdminAnomalyService(
	eventRepo repository.AdminPresaleOpsEventRepository,
	depRepo repository.AdminPresaleDepositRepository,
	roundRepo repository.AdminPresaleRoundRepository,
	holdingRepo repository.PresaleHoldingRepository,
) PresaleAdminAnomalyService {
	return &presaleAdminAnomalyService{
		eventRepo:   eventRepo,
		depRepo:     depRepo,
		roundRepo:   roundRepo,
		holdingRepo: holdingRepo,
	}
}

func (s *presaleAdminAnomalyService) ListAnomaly(ctx context.Context, f repository.PresaleOpsEventFilter) ([]*model.PresaleOpsEvent, int64, error) {
	items, total, err := s.eventRepo.AdminList(ctx, f)
	if err != nil {
		return nil, 0, fmt.Errorf("[PresaleAdminAnomalyService] list: %w", err)
	}
	return items, total, nil
}

func (s *presaleAdminAnomalyService) GetAnomaly(ctx context.Context, id uint64) (*model.PresaleOpsEvent, error) {
	evt, err := s.eventRepo.AdminGetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrOpsEventNotFound) {
			return nil, ErrAnomalyNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminAnomalyService] get anomaly %d: %w", id, err)
	}
	return evt, nil
}

func (s *presaleAdminAnomalyService) GetAnomalyTx(tx *gorm.DB, id uint64) (*model.PresaleOpsEvent, error) {
	evt, err := s.eventRepo.AdminGetForUpdate(tx, id)
	if err != nil {
		if errors.Is(err, repository.ErrOpsEventNotFound) {
			return nil, ErrAnomalyNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminAnomalyService] get anomaly tx %d: %w", id, err)
	}
	return evt, nil
}

// Resolve 处理异常事件，根据 resolution 类型走不同分支。
func (s *presaleAdminAnomalyService) Resolve(tx *gorm.DB, id uint64, req *ResolveRequest, operatorID string) (*model.PresaleOpsEvent, error) {
	// 加行锁防并发 resolve 同一事件
	event, err := s.eventRepo.AdminGetForUpdate(tx, id)
	if err != nil {
		if errors.Is(err, repository.ErrOpsEventNotFound) {
			return nil, ErrAnomalyNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminAnomalyService] get anomaly for resolve %d: %w", id, err)
	}

	// 只允许处理 pending / notified（resolved/rejected 已终态）
	if event.Status != model.OpsEventStatusPending && event.Status != model.OpsEventStatusNotified {
		return nil, fmt.Errorf("%w: anomaly event status=%s cannot be resolved", ErrInvalidStateTransition, event.Status)
	}

	// 根据 resolution 走不同业务分支
	switch Resolution(req.Resolution) {
	case ResolutionConvertToDeposit:
		if err := s.convertToDeposit(tx, event, req.TargetRoundID); err != nil {
			return nil, fmt.Errorf("[PresaleAdminAnomalyService] convert_to_deposit: %w", err)
		}
	case ResolutionPartialCredit:
		if err := s.partialCredit(tx, event); err != nil {
			return nil, fmt.Errorf("[PresaleAdminAnomalyService] partial_credit: %w", err)
		}
	case ResolutionReject:
		// 仅更新状态，无其他业务操作
	default:
		return nil, fmt.Errorf("%w: %s", ErrInvalidResolution, req.Resolution)
	}

	// 确定最终状态
	finalStatus := model.OpsEventStatusResolved
	if Resolution(req.Resolution) == ResolutionReject {
		finalStatus = model.OpsEventStatusRejected
	}

	if err := s.eventRepo.UpdateResolve(tx, id, operatorID, req.Note, finalStatus); err != nil {
		return nil, fmt.Errorf("[PresaleAdminAnomalyService] update resolve status: %w", err)
	}

	now := time.Now().UnixMilli()
	event.Status = finalStatus
	event.ResolvedBy = &operatorID
	event.ResolvedAt = &now
	event.ResolveNote = &req.Note

	return event, nil
}

// convertToDeposit 将 anomaly deposit 改为 confirmed，同时更新 holding + round.sold_odd。
func (s *presaleAdminAnomalyService) convertToDeposit(tx *gorm.DB, event *model.PresaleOpsEvent, targetRoundID *string) error {
	if targetRoundID == nil || *targetRoundID == "" {
		return fmt.Errorf("[PresaleAdminAnomalyService] targetRoundId required for convert_to_deposit")
	}

	// 校验目标轮次存在
	target, err := s.roundRepo.GetByIDTx(tx, *targetRoundID)
	if err != nil {
		if errors.Is(err, repository.ErrRoundNotFound) {
			return fmt.Errorf("%w: %s", ErrTargetRoundNotFound, *targetRoundID)
		}
		return fmt.Errorf("[PresaleAdminAnomalyService] get target round: %w", err)
	}

	if event.AmountUsdt == nil || event.AmountUsdt.IsZero() {
		return fmt.Errorf("[PresaleAdminAnomalyService] anomaly event has no amount_usdt")
	}

	amountUsdt := *event.AmountUsdt
	sharesOdd := amountUsdt.Div(target.PriceUsd)

	// 从关联 deposit 获取 user_id
	var userID uint64
	if event.DepositID != nil {
		var dep model.PresaleDeposit
		if err := tx.Where("id = ?", *event.DepositID).First(&dep).Error; err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("[PresaleAdminAnomalyService] get deposit for convert event=%d deposit=%d: %w",
					event.ID, *event.DepositID, err)
			}
		} else {
			userID = dep.UserID
		}
	}

	if userID == 0 {
		// unclaimed 场景（无 user_id），本期简化：仅标记事件为 resolved，不落 deposit
		return nil
	}

	// 将关联 deposit 改为 confirmed
	if event.DepositID != nil {
		now := time.Now().UnixMilli()
		if err := tx.Model(&model.PresaleDeposit{}).Where("id = ?", *event.DepositID).
			Updates(map[string]any{
				"status":       model.PresaleDepositStatusConfirmed,
				"round_id":     *targetRoundID,
				"price_usd":    target.PriceUsd,
				"shares_odd":   sharesOdd,
				"confirmed_at": now,
				"updated_at":   now,
			}).Error; err != nil {
			return fmt.Errorf("[PresaleAdminAnomalyService] update deposit to confirmed: %w", err)
		}
	}

	// 更新 invest holding（upsert）
	if !sharesOdd.IsZero() {
		if err := s.holdingRepo.UpsertInvest(tx.Statement.Context, tx, userID, *targetRoundID, sharesOdd, amountUsdt, target.PriceUsd); err != nil {
			return fmt.Errorf("[PresaleAdminAnomalyService] upsert invest holding: %w", err)
		}
		// 同步更新 round.sold_odd / raised_usd（admin 操作，无容量上限校验）
		if err := s.roundRepo.AdjustSoldOdd(tx, *targetRoundID, sharesOdd, amountUsdt); err != nil {
			return fmt.Errorf("[PresaleAdminAnomalyService] adjust round sold_odd: %w", err)
		}
	}

	return nil
}

// partialCredit 处理 overflow 部分入账。
// 将关联 deposit 从 anomaly 改为 confirmed，更新 holding（不重算份额）。
func (s *presaleAdminAnomalyService) partialCredit(tx *gorm.DB, event *model.PresaleOpsEvent) error {
	if event.DepositID == nil {
		return nil // 无关联 deposit，noop
	}

	now := time.Now().UnixMilli()
	if err := tx.Model(&model.PresaleDeposit{}).Where("id = ?", *event.DepositID).
		Updates(map[string]any{
			"status":       model.PresaleDepositStatusConfirmed,
			"confirmed_at": now,
			"updated_at":   now,
		}).Error; err != nil {
		return fmt.Errorf("[PresaleAdminAnomalyService] partial_credit update deposit: %w", err)
	}

	// 查 deposit 详情以更新 holding
	var dep model.PresaleDeposit
	if err := tx.Where("id = ?", *event.DepositID).First(&dep).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil // deposit 已不存在，noop
		}
		return fmt.Errorf("[PresaleAdminAnomalyService] get deposit for partial_credit: %w", err)
	}

	if dep.UserID > 0 && !dep.SharesOdd.IsZero() {
		if err := s.holdingRepo.UpsertInvest(tx.Statement.Context, tx, dep.UserID, dep.RoundID, dep.SharesOdd, dep.AmountUsdt, dep.PriceUsd); err != nil {
			return fmt.Errorf("[PresaleAdminAnomalyService] partial_credit upsert holding: %w", err)
		}
		if err := s.roundRepo.AdjustSoldOdd(tx, dep.RoundID, dep.SharesOdd, dep.AmountUsdt); err != nil {
			return fmt.Errorf("[PresaleAdminAnomalyService] partial_credit adjust round sold_odd: %w", err)
		}
		// 若有邀请人，更新 referral holding
		if dep.ReferrerUserID != nil && !dep.ReferralRewardOdd.IsZero() {
			if err := s.holdingRepo.UpsertReferral(tx.Statement.Context, tx, *dep.ReferrerUserID, dep.RoundID, dep.ReferralRewardOdd); err != nil {
				return fmt.Errorf("[PresaleAdminAnomalyService] partial_credit upsert referral holding: %w", err)
			}
		}
	}

	return nil
}

// 确保 decimal 包被使用
var _ = decimal.Zero
