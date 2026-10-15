package service_test

import (
	"context"
	"errors"
	"testing"

	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// ─── mock audit repo ──────────────────────────────────────────────────────────

type mockAdminAuditRepo struct{ mock.Mock }

func (m *mockAdminAuditRepo) Create(tx *gorm.DB, entry *model.PresaleAdminAudit) error {
	args := m.Called(tx, entry)
	return args.Error(0)
}

func (m *mockAdminAuditRepo) List(ctx context.Context, f repository.PresaleAdminAuditFilter) ([]model.PresaleAdminAudit, int64, error) {
	args := m.Called(ctx, f)
	return args.Get(0).([]model.PresaleAdminAudit), args.Get(1).(int64), args.Error(2)
}

func (m *mockAdminAuditRepo) CountByTargetAndAction(ctx context.Context, targetType, targetID, action string) (int64, error) {
	args := m.Called(ctx, targetType, targetID, action)
	return args.Get(0).(int64), args.Error(1)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func confirmedDeposit(txHash, roundID string) *model.PresaleDeposit {
	return &model.PresaleDeposit{
		ID:             1,
		TxHash:         txHash,
		RoundID:        roundID,
		UserID:         100,
		Status:         model.PresaleDepositStatusConfirmed,
		AmountUsdt:     decimal.NewFromInt(100),
		PriceUsd:       decimal.NewFromFloat(0.1),
		SharesOdd:      decimal.NewFromInt(1000),
		BlockTimestamp: 5000,
	}
}

func targetRound(id string) *model.PresaleRound {
	return &model.PresaleRound{
		ID:                id,
		PriceUsd:          decimal.NewFromFloat(0.2),
		ReferralRewardPct: decimal.NewFromInt(10),
		StartTs:           1000,
		EndTs:             9000,
	}
}

// ─── ListDeposits ─────────────────────────────────────────────────────────────

func TestPresaleAdminDepositService_ListDeposits(t *testing.T) {
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	auditRepo := new(mockAdminAuditRepo)

	items := []*model.PresaleDeposit{confirmedDeposit("0xabc", "r1")}
	depRepo.On("AdminList", mock.Anything, mock.Anything).Return(items, int64(1), nil)

	svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
	result, total, err := svc.ListDeposits(context.Background(), repository.PresaleDepositFilter{})

	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, int64(1), total)
}

// ─── GetDeposit ──────────────────────────────────────────────────────────────

func TestPresaleAdminDepositService_GetDeposit(t *testing.T) {
	cases := []struct {
		name      string
		mockRet   *model.PresaleDeposit
		mockErr   error
		expectErr bool
		errIs     error
	}{
		{"success", confirmedDeposit("0xabc", "r1"), nil, false, nil},
		{"not_found", nil, repository.ErrDepositNotFound, true, service.ErrAdminDepositNotFound},
		{"db_error", nil, errors.New("db error"), true, nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			depRepo := new(mockAdminDepositRepo)
			roundRepo := new(mockAdminRoundRepo)
			holdingRepo := new(mockPresaleHoldingRepo)
			auditRepo := new(mockAdminAuditRepo)

			depRepo.On("AdminGetByTxHash", mock.Anything, "0xabc").Return(tc.mockRet, tc.mockErr)

			svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
			_, err := svc.GetDeposit(context.Background(), "0xabc")

			if tc.expectErr {
				assert.Error(t, err)
				if tc.errIs != nil {
					assert.True(t, errors.Is(err, tc.errIs))
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// ─── MigrateRound ────────────────────────────────────────────────────────────

func TestPresaleAdminDepositService_MigrateRound_Success(t *testing.T) {
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	auditRepo := new(mockAdminAuditRepo)
	tx := &gorm.DB{}
	ctx := context.Background()

	dep := confirmedDeposit("0xabc", "r1")
	tgt := targetRound("r2")

	// 迁移次数未超限
	auditRepo.On("CountByTargetAndAction", ctx, "deposit", "0xabc", "migrate_round_id").Return(int64(0), nil)
	depRepo.On("AdminGetForUpdate", tx, "0xabc").Return(dep, nil)
	roundRepo.On("GetByIDTx", tx, "r2").Return(tgt, nil)

	// 旧轮次：扣减 holding + sold_odd
	holdingRepo.On("UpsertInvest", ctx, tx, uint64(100), "r1", mock.Anything, mock.Anything, mock.Anything).Return(nil)
	roundRepo.On("AdjustSoldOdd", tx, "r1", mock.Anything, mock.Anything).Return(nil)

	// 新轮次：增量 holding + sold_odd
	holdingRepo.On("UpsertInvest", ctx, tx, uint64(100), "r2", mock.Anything, mock.Anything, mock.Anything).Return(nil)
	roundRepo.On("AdjustSoldOdd", tx, "r2", mock.Anything, mock.Anything).Return(nil)

	depRepo.On("UpdateMigrateFields", tx, uint64(1), mock.Anything).Return(nil)

	svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
	result, err := svc.MigrateRound(ctx, tx, "0xabc", "r2", 5)

	assert.NoError(t, err)
	assert.Equal(t, "r1", result.OldRoundID)
	assert.Equal(t, "r2", result.NewRoundID)
	// 新价格 0.2，金额 100 → 500 shares（使用 decimal.Equal 比较，不受内部 exp 影响）
	assert.True(t, decimal.NewFromInt(500).Equal(result.NewSharesOdd), "expected 500 shares, got %s", result.NewSharesOdd)
	assert.True(t, decimal.NewFromInt(1000).Equal(result.OldSharesOdd), "expected 1000 old shares, got %s", result.OldSharesOdd)
}

func TestPresaleAdminDepositService_MigrateRound_Idempotent(t *testing.T) {
	// 已在目标轮次，直接返回当前快照
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	auditRepo := new(mockAdminAuditRepo)
	tx := &gorm.DB{}
	ctx := context.Background()

	dep := confirmedDeposit("0xabc", "r2")
	auditRepo.On("CountByTargetAndAction", ctx, "deposit", "0xabc", "migrate_round_id").Return(int64(0), nil)
	depRepo.On("AdminGetForUpdate", tx, "0xabc").Return(dep, nil)

	svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
	result, err := svc.MigrateRound(ctx, tx, "0xabc", "r2", 5)

	assert.NoError(t, err)
	assert.Equal(t, "r2", result.OldRoundID)
	assert.Equal(t, "r2", result.NewRoundID)
	assert.Equal(t, result.OldSharesOdd, result.NewSharesOdd)
}

func TestPresaleAdminDepositService_MigrateRound_LimitExceeded(t *testing.T) {
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	auditRepo := new(mockAdminAuditRepo)
	ctx := context.Background()
	tx := &gorm.DB{}

	// 已迁移 3 次（达到上限）
	auditRepo.On("CountByTargetAndAction", ctx, "deposit", "0xabc", "migrate_round_id").Return(int64(3), nil)

	svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
	_, err := svc.MigrateRound(ctx, tx, "0xabc", "r2", 5)

	assert.Error(t, err)
	assert.True(t, errors.Is(err, service.ErrMigrateRoundLimitExceeded))
}

func TestPresaleAdminDepositService_MigrateRound_DepositNotConfirmed(t *testing.T) {
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	auditRepo := new(mockAdminAuditRepo)
	ctx := context.Background()
	tx := &gorm.DB{}

	// deposit 还是 pending 状态，不允许迁移
	dep := confirmedDeposit("0xabc", "r1")
	dep.Status = model.PresaleDepositStatusPending

	auditRepo.On("CountByTargetAndAction", ctx, "deposit", "0xabc", "migrate_round_id").Return(int64(0), nil)
	depRepo.On("AdminGetForUpdate", tx, "0xabc").Return(dep, nil)

	svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
	_, err := svc.MigrateRound(ctx, tx, "0xabc", "r2", 5)

	assert.Error(t, err)
	assert.True(t, errors.Is(err, service.ErrInvalidStateTransition))
}

func TestPresaleAdminDepositService_MigrateRound_BlockTimestampOutOfRange(t *testing.T) {
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	auditRepo := new(mockAdminAuditRepo)
	ctx := context.Background()
	tx := &gorm.DB{}

	dep := confirmedDeposit("0xabc", "r1")
	// 目标轮次 [1000, 9000] ms，tolerance 5min = 300000ms，
	// 所以合法范围是 [1000-300000, 9000+300000] = [-299000, 309000]
	// 需要一个远超上限的 timestamp，如 10_000_000
	dep.BlockTimestamp = 10_000_000
	tgt := targetRound("r2")

	auditRepo.On("CountByTargetAndAction", ctx, "deposit", "0xabc", "migrate_round_id").Return(int64(0), nil)
	depRepo.On("AdminGetForUpdate", tx, "0xabc").Return(dep, nil)
	roundRepo.On("GetByIDTx", tx, "r2").Return(tgt, nil)

	svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
	_, err := svc.MigrateRound(ctx, tx, "0xabc", "r2", 5)

	assert.Error(t, err)
	assert.True(t, errors.Is(err, service.ErrBlockTimestampOutOfRange))
}

func TestPresaleAdminDepositService_MigrateRound_TargetRoundNotFound(t *testing.T) {
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	auditRepo := new(mockAdminAuditRepo)
	ctx := context.Background()
	tx := &gorm.DB{}

	dep := confirmedDeposit("0xabc", "r1")
	auditRepo.On("CountByTargetAndAction", ctx, "deposit", "0xabc", "migrate_round_id").Return(int64(0), nil)
	depRepo.On("AdminGetForUpdate", tx, "0xabc").Return(dep, nil)
	roundRepo.On("GetByIDTx", tx, "nonexist").Return(nil, repository.ErrRoundNotFound)

	svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
	_, err := svc.MigrateRound(ctx, tx, "0xabc", "nonexist", 5)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "target round not found")
}

// ─── Adversarial ─────────────────────────────────────────────────────────────

func TestPresaleAdminDepositService_Adversarial_AnomalyDeposit(t *testing.T) {
	// anomaly 状态的 deposit 不允许 migrate
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	auditRepo := new(mockAdminAuditRepo)
	ctx := context.Background()
	tx := &gorm.DB{}

	dep := confirmedDeposit("0xabc", "r1")
	dep.Status = model.PresaleDepositStatusAnomaly

	auditRepo.On("CountByTargetAndAction", ctx, "deposit", "0xabc", "migrate_round_id").Return(int64(0), nil)
	depRepo.On("AdminGetForUpdate", tx, "0xabc").Return(dep, nil)

	svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
	_, err := svc.MigrateRound(ctx, tx, "0xabc", "r2", 5)

	assert.Error(t, err)
	assert.True(t, errors.Is(err, service.ErrInvalidStateTransition))
}

func TestPresaleAdminDepositService_Adversarial_ConcurrentMigrate_LockEnforced(t *testing.T) {
	// 测试 GetForUpdate 被调用（行锁），确保并发安全由 DB 行锁保障
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	auditRepo := new(mockAdminAuditRepo)
	ctx := context.Background()
	tx := &gorm.DB{}

	auditRepo.On("CountByTargetAndAction", ctx, "deposit", "0xabc", "migrate_round_id").Return(int64(0), nil)
	// AdminGetForUpdate 被调用（而不是 AdminGetByTxHash）确保行锁
	depRepo.On("AdminGetForUpdate", tx, "0xabc").Return(nil, errors.New("lock wait timeout"))

	svc := service.NewPresaleAdminDepositService(depRepo, roundRepo, holdingRepo, auditRepo)
	_, err := svc.MigrateRound(ctx, tx, "0xabc", "r2", 5)

	assert.Error(t, err)
	// AdminGetByTxHash (无锁版) 不应该被调用
	depRepo.AssertNotCalled(t, "AdminGetByTxHash")
}

// interface compliance
var _ repository.PresaleAdminAuditRepository = (*mockAdminAuditRepo)(nil)
