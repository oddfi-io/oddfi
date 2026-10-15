// Package service — 预售入账 admin 业务层（DD-003 v3.1 B5）。
//
// MigrateRound 7 步事务：
//  1. 取 deposit（行锁），校验 status=confirmed
//  2. 校验 targetRoundID 存在
//  3. 校验 block_timestamp ∈ [target.start_ts - tolerance, target.end_ts + tolerance]
//  4. 用目标轮价格重算 shares_odd / referral_reward_odd
//  5a. 回滚旧轮次 holding（减量）
//  5b. 扣减旧轮次 round.sold_odd / raised_usd
//  6a. 应用新轮次 holding（upsert）
//  6b. 累加新轮次 round.sold_odd / raised_usd
//  7. 更新 deposit 字段
//
// 幂等：deposit.RoundID 已等于 targetRoundID 时直接返回当前快照。
// 次数限制：同一 deposit 最多 MigrateRoundMaxCount 次（通过 audit 记录计数，admin 侧校验）。
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

// MigrateRoundMaxCount 同一 deposit 允许的最大迁移次数。
const MigrateRoundMaxCount = 3

// ErrAdminDepositNotFound 表示 deposit 不存在（admin 层包装）。
var ErrAdminDepositNotFound = errors.New("presale deposit not found")

// ErrMigrateRoundLimitExceeded 表示迁移次数已达上限。
var ErrMigrateRoundLimitExceeded = errors.New("migrate round limit exceeded")

// ErrBlockTimestampOutOfRange 表示 block_timestamp 不在目标轮次容差范围内。
var ErrBlockTimestampOutOfRange = errors.New("block timestamp not in target round range")

// ErrTargetRoundNotFound 表示 migrate-round / anomaly resolve 指定的目标轮次不存在。
// 由 admin handler 映射为 404 TARGET_ROUND_NOT_FOUND，避免裸 error 落 500。
var ErrTargetRoundNotFound = errors.New("target round not found")

// MigrateRoundResult 是 MigrateRound 的输出。
type MigrateRoundResult struct {
	Deposit      *model.PresaleDeposit
	OldRoundID   string
	NewRoundID   string
	OldSharesOdd decimal.Decimal
	NewSharesOdd decimal.Decimal
}

// PresaleAdminDepositService 封装入账查询 + migrate-round 事务逻辑。
type PresaleAdminDepositService interface {
	// ListDeposits 分页查询入账记录（admin filter）
	ListDeposits(ctx context.Context, f repository.PresaleDepositFilter) ([]*model.PresaleDeposit, int64, error)

	// GetDeposit 按 txHash 查询单笔（admin，不限 user_id）
	GetDeposit(ctx context.Context, txHash string) (*model.PresaleDeposit, error)

	// GetDepositTx 在共享事务内按 txHash 查询（before 快照用，不加行锁）
	GetDepositTx(tx *gorm.DB, txHash string) (*model.PresaleDeposit, error)

	// MigrateRound 把一笔 confirmed deposit 从旧轮次迁移到目标轮次（7 步事务）
	MigrateRound(ctx context.Context, tx *gorm.DB, txHash, targetRoundID string, toleranceMin int) (*MigrateRoundResult, error)
}

type presaleAdminDepositService struct {
	depRepo     repository.AdminPresaleDepositRepository
	roundRepo   repository.AdminPresaleRoundRepository
	holdingRepo repository.PresaleHoldingRepository
	auditRepo   repository.PresaleAdminAuditRepository
}

// NewPresaleAdminDepositService 构造默认实现。
func NewPresaleAdminDepositService(
	depRepo repository.AdminPresaleDepositRepository,
	roundRepo repository.AdminPresaleRoundRepository,
	holdingRepo repository.PresaleHoldingRepository,
	auditRepo repository.PresaleAdminAuditRepository,
) PresaleAdminDepositService {
	return &presaleAdminDepositService{
		depRepo:     depRepo,
		roundRepo:   roundRepo,
		holdingRepo: holdingRepo,
		auditRepo:   auditRepo,
	}
}

func (s *presaleAdminDepositService) ListDeposits(ctx context.Context, f repository.PresaleDepositFilter) ([]*model.PresaleDeposit, int64, error) {
	items, total, err := s.depRepo.AdminList(ctx, f)
	if err != nil {
		return nil, 0, fmt.Errorf("[PresaleAdminDepositService] list deposits: %w", err)
	}
	return items, total, nil
}

func (s *presaleAdminDepositService) GetDeposit(ctx context.Context, txHash string) (*model.PresaleDeposit, error) {
	dep, err := s.depRepo.AdminGetByTxHash(ctx, txHash)
	if err != nil {
		if errors.Is(err, repository.ErrDepositNotFound) {
			return nil, ErrAdminDepositNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminDepositService] get deposit %s: %w", txHash, err)
	}
	return dep, nil
}

func (s *presaleAdminDepositService) GetDepositTx(tx *gorm.DB, txHash string) (*model.PresaleDeposit, error) {
	dep, err := s.depRepo.AdminGetByTxHashTx(tx, txHash)
	if err != nil {
		if errors.Is(err, repository.ErrDepositNotFound) {
			return nil, ErrAdminDepositNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminDepositService] get deposit tx %s: %w", txHash, err)
	}
	return dep, nil
}

// MigrateRound 执行 7 步 migrate-round 事务。
func (s *presaleAdminDepositService) MigrateRound(ctx context.Context, tx *gorm.DB, txHash, targetRoundID string, toleranceMin int) (*MigrateRoundResult, error) {
	// M1 幂等限制：检查历史迁移次数（通过 audit 记录计数）
	if s.auditRepo != nil {
		count, err := s.auditRepo.CountByTargetAndAction(ctx, "deposit", txHash, "migrate_round_id")
		if err != nil {
			return nil, fmt.Errorf("[PresaleAdminDepositService] count migrate history %s: %w", txHash, err)
		}
		if count >= int64(MigrateRoundMaxCount) {
			return nil, fmt.Errorf("%w: deposit %s has been migrated %d times (max %d)", ErrMigrateRoundLimitExceeded, txHash, count, MigrateRoundMaxCount)
		}
	}

	// 步骤 1：取 deposit 并加行锁
	dep, err := s.depRepo.AdminGetForUpdate(tx, txHash)
	if err != nil {
		if errors.Is(err, repository.ErrDepositNotFound) {
			return nil, ErrAdminDepositNotFound
		}
		return nil, fmt.Errorf("[PresaleAdminDepositService] get deposit for update %s: %w", txHash, err)
	}

	// 只允许迁移 confirmed 状态的 deposit
	if dep.Status != model.PresaleDepositStatusConfirmed {
		return nil, fmt.Errorf("%w: deposit status must be confirmed, got: %s", ErrInvalidStateTransition, dep.Status)
	}

	// 幂等：已经在目标轮次则直接返回
	if dep.RoundID == targetRoundID {
		return &MigrateRoundResult{
			Deposit:      dep,
			OldRoundID:   dep.RoundID,
			NewRoundID:   targetRoundID,
			OldSharesOdd: dep.SharesOdd,
			NewSharesOdd: dep.SharesOdd,
		}, nil
	}

	// 步骤 2：校验目标轮次存在
	target, err := s.roundRepo.GetByIDTx(tx, targetRoundID)
	if err != nil {
		if errors.Is(err, repository.ErrRoundNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrTargetRoundNotFound, targetRoundID)
		}
		return nil, fmt.Errorf("[PresaleAdminDepositService] get target round %s: %w", targetRoundID, err)
	}

	// 步骤 3：校验 block_timestamp ∈ [target.start_ts - tolerance, target.end_ts + tolerance]
	toleranceMs := int64(toleranceMin) * 60 * 1000
	if dep.BlockTimestamp < target.StartTs-toleranceMs || dep.BlockTimestamp > target.EndTs+toleranceMs {
		return nil, fmt.Errorf("%w: block_timestamp=%d not in [%d-%d, %d+%d]",
			ErrBlockTimestampOutOfRange, dep.BlockTimestamp, target.StartTs, toleranceMs, target.EndTs, toleranceMs)
	}

	// 步骤 4：用目标轮价格重算份额
	oldRoundID := dep.RoundID
	oldSharesOdd := dep.SharesOdd
	oldReferralRewardOdd := dep.ReferralRewardOdd

	newSharesOdd := dep.AmountUsdt.Div(target.PriceUsd)
	var newReferralRewardOdd decimal.Decimal
	var newReferralRewardPct *decimal.Decimal
	if dep.ReferrerUserID != nil {
		// referral 奖励按目标轮次比例重算
		newReferralRewardOdd = newSharesOdd.Mul(target.ReferralRewardPct).Div(decimal.NewFromInt(100))
		pct := target.ReferralRewardPct
		newReferralRewardPct = &pct
	}

	// 步骤 5a：回滚旧轮次 invest holding（减量）
	oldSharesOddNeg := oldSharesOdd.Neg()
	oldAmountNeg := dep.AmountUsdt.Neg()
	if err := s.holdingRepo.UpsertInvest(ctx, tx, dep.UserID, oldRoundID, oldSharesOddNeg, oldAmountNeg, dep.PriceUsd); err != nil {
		return nil, fmt.Errorf("[PresaleAdminDepositService] subtract old invest holding: %w", err)
	}
	if dep.ReferrerUserID != nil && !oldReferralRewardOdd.IsZero() {
		// 步骤 5a（referral）：回滚旧轮次 referral holding
		if err := s.holdingRepo.UpsertReferral(ctx, tx, *dep.ReferrerUserID, oldRoundID, oldReferralRewardOdd.Neg()); err != nil {
			return nil, fmt.Errorf("[PresaleAdminDepositService] subtract old referral holding: %w", err)
		}
	}

	// 步骤 5b：扣减旧轮次 sold_odd / raised_usd
	if err := s.roundRepo.AdjustSoldOdd(tx, oldRoundID, oldSharesOddNeg, oldAmountNeg); err != nil {
		return nil, fmt.Errorf("[PresaleAdminDepositService] adjust old round sold_odd: %w", err)
	}

	// 步骤 6a：应用新轮次 invest holding（upsert）
	if err := s.holdingRepo.UpsertInvest(ctx, tx, dep.UserID, targetRoundID, newSharesOdd, dep.AmountUsdt, target.PriceUsd); err != nil {
		return nil, fmt.Errorf("[PresaleAdminDepositService] upsert new invest holding: %w", err)
	}
	if dep.ReferrerUserID != nil && !newReferralRewardOdd.IsZero() {
		// 步骤 6a（referral）：应用新轮次 referral holding
		if err := s.holdingRepo.UpsertReferral(ctx, tx, *dep.ReferrerUserID, targetRoundID, newReferralRewardOdd); err != nil {
			return nil, fmt.Errorf("[PresaleAdminDepositService] upsert new referral holding: %w", err)
		}
	}

	// 步骤 6b：累加新轮次 sold_odd / raised_usd
	if err := s.roundRepo.AdjustSoldOdd(tx, targetRoundID, newSharesOdd, dep.AmountUsdt); err != nil {
		return nil, fmt.Errorf("[PresaleAdminDepositService] adjust new round sold_odd: %w", err)
	}

	// 步骤 7：更新 deposit 字段
	now := time.Now().UnixMilli()
	updateFields := map[string]any{
		"round_id":            targetRoundID,
		"price_usd":           target.PriceUsd,
		"shares_odd":          newSharesOdd,
		"referral_reward_odd": newReferralRewardOdd,
		"updated_at":          now,
	}
	if newReferralRewardPct != nil {
		updateFields["referral_reward_pct"] = *newReferralRewardPct
	}
	if err := s.depRepo.UpdateMigrateFields(tx, dep.ID, updateFields); err != nil {
		return nil, fmt.Errorf("[PresaleAdminDepositService] update deposit migrate fields: %w", err)
	}

	// 更新内存快照供 handler 构造响应
	dep.RoundID = targetRoundID
	dep.PriceUsd = target.PriceUsd
	dep.SharesOdd = newSharesOdd
	dep.ReferralRewardOdd = newReferralRewardOdd
	dep.ReferralRewardPct = newReferralRewardPct
	dep.UpdatedAt = now

	return &MigrateRoundResult{
		Deposit:      dep,
		OldRoundID:   oldRoundID,
		NewRoundID:   targetRoundID,
		OldSharesOdd: oldSharesOdd,
		NewSharesOdd: newSharesOdd,
	}, nil
}
