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

// ─── mock repos ──────────────────────────────────────────────────────────────

type mockAdminOpsEventRepo struct{ mock.Mock }

func (m *mockAdminOpsEventRepo) AdminGetByID(ctx context.Context, id uint64) (*model.PresaleOpsEvent, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleOpsEvent), args.Error(1)
}

func (m *mockAdminOpsEventRepo) AdminGetForUpdate(tx *gorm.DB, id uint64) (*model.PresaleOpsEvent, error) {
	args := m.Called(tx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleOpsEvent), args.Error(1)
}

func (m *mockAdminOpsEventRepo) AdminList(ctx context.Context, f repository.PresaleOpsEventFilter) ([]*model.PresaleOpsEvent, int64, error) {
	args := m.Called(ctx, f)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*model.PresaleOpsEvent), args.Get(1).(int64), args.Error(2)
}

func (m *mockAdminOpsEventRepo) UpdateResolve(tx *gorm.DB, id uint64, operatorID, note, status string) error {
	args := m.Called(tx, id, operatorID, note, status)
	return args.Error(0)
}

type mockAdminDepositRepo struct{ mock.Mock }

func (m *mockAdminDepositRepo) AdminGetByTxHash(ctx context.Context, txHash string) (*model.PresaleDeposit, error) {
	args := m.Called(ctx, txHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleDeposit), args.Error(1)
}

func (m *mockAdminDepositRepo) AdminGetByTxHashTx(tx *gorm.DB, txHash string) (*model.PresaleDeposit, error) {
	args := m.Called(tx, txHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleDeposit), args.Error(1)
}

func (m *mockAdminDepositRepo) AdminGetForUpdate(tx *gorm.DB, txHash string) (*model.PresaleDeposit, error) {
	args := m.Called(tx, txHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleDeposit), args.Error(1)
}

func (m *mockAdminDepositRepo) AdminList(ctx context.Context, f repository.PresaleDepositFilter) ([]*model.PresaleDeposit, int64, error) {
	args := m.Called(ctx, f)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*model.PresaleDeposit), args.Get(1).(int64), args.Error(2)
}

func (m *mockAdminDepositRepo) UpdateMigrateFields(tx *gorm.DB, depositID uint64, fields map[string]any) error {
	args := m.Called(tx, depositID, fields)
	return args.Error(0)
}

type mockPresaleHoldingRepo struct{ mock.Mock }

func (m *mockPresaleHoldingRepo) UpsertInvest(ctx context.Context, tx *gorm.DB, userID uint64, roundID string, deltaOdd, deltaUsd, price decimal.Decimal) error {
	args := m.Called(ctx, tx, userID, roundID, deltaOdd, deltaUsd, price)
	return args.Error(0)
}

func (m *mockPresaleHoldingRepo) UpsertReferral(ctx context.Context, tx *gorm.DB, referrerUserID uint64, roundID string, deltaOdd decimal.Decimal) error {
	args := m.Called(ctx, tx, referrerUserID, roundID, deltaOdd)
	return args.Error(0)
}

func (m *mockPresaleHoldingRepo) ListByUser(ctx context.Context, userID uint64) ([]*model.PresaleHolding, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.PresaleHolding), args.Error(1)
}

func (m *mockPresaleHoldingRepo) SumReferralOdd(ctx context.Context, userID uint64) (decimal.Decimal, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(decimal.Decimal), args.Error(1)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func pendingOpsEvent(id uint64) *model.PresaleOpsEvent {
	amount := decimal.NewFromInt(100)
	depID := uint64(999)
	return &model.PresaleOpsEvent{
		ID:        id,
		EventType: model.AnomalyOverflow,
		DepositID: &depID,
		AmountUsdt: &amount,
		Status:    model.OpsEventStatusPending,
	}
}

// ─── ListAnomaly ─────────────────────────────────────────────────────────────

func TestPresaleAdminAnomalyService_ListAnomaly(t *testing.T) {
	evtRepo := new(mockAdminOpsEventRepo)
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)

	items := []*model.PresaleOpsEvent{pendingOpsEvent(1)}
	evtRepo.On("AdminList", mock.Anything, mock.Anything).Return(items, int64(1), nil)

	svc := service.NewPresaleAdminAnomalyService(evtRepo, depRepo, roundRepo, holdingRepo)
	result, total, err := svc.ListAnomaly(context.Background(), repository.PresaleOpsEventFilter{})

	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, int64(1), total)
}

// ─── GetAnomaly ──────────────────────────────────────────────────────────────

func TestPresaleAdminAnomalyService_GetAnomaly(t *testing.T) {
	cases := []struct {
		name      string
		mockRet   *model.PresaleOpsEvent
		mockErr   error
		expectErr bool
		errIs     error
	}{
		{"success", pendingOpsEvent(1), nil, false, nil},
		{"not_found", nil, repository.ErrOpsEventNotFound, true, service.ErrAnomalyNotFound},
		{"db_error", nil, errors.New("db error"), true, nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			evtRepo := new(mockAdminOpsEventRepo)
			depRepo := new(mockAdminDepositRepo)
			roundRepo := new(mockAdminRoundRepo)
			holdingRepo := new(mockPresaleHoldingRepo)

			evtRepo.On("AdminGetByID", mock.Anything, uint64(1)).Return(tc.mockRet, tc.mockErr)

			svc := service.NewPresaleAdminAnomalyService(evtRepo, depRepo, roundRepo, holdingRepo)
			_, err := svc.GetAnomaly(context.Background(), 1)

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

// ─── Resolve — reject ────────────────────────────────────────────────────────

func TestPresaleAdminAnomalyService_Resolve_Reject(t *testing.T) {
	evtRepo := new(mockAdminOpsEventRepo)
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	tx := &gorm.DB{}

	evt := pendingOpsEvent(1)
	evtRepo.On("AdminGetForUpdate", tx, uint64(1)).Return(evt, nil)
	evtRepo.On("UpdateResolve", tx, uint64(1), "op1", "user requested refund and confirmed", model.OpsEventStatusRejected).Return(nil)

	svc := service.NewPresaleAdminAnomalyService(evtRepo, depRepo, roundRepo, holdingRepo)
	result, err := svc.Resolve(tx, 1, &service.ResolveRequest{
		Resolution: "reject",
		Note:       "user requested refund and confirmed",
	}, "op1")

	assert.NoError(t, err)
	assert.Equal(t, model.OpsEventStatusRejected, result.Status)
	evtRepo.AssertExpectations(t)
}

// ─── Resolve — invalid state ─────────────────────────────────────────────────

func TestPresaleAdminAnomalyService_Resolve_AlreadyResolved(t *testing.T) {
	evtRepo := new(mockAdminOpsEventRepo)
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	tx := &gorm.DB{}

	evt := pendingOpsEvent(1)
	evt.Status = model.OpsEventStatusResolved // 已终态
	evtRepo.On("AdminGetForUpdate", tx, uint64(1)).Return(evt, nil)

	svc := service.NewPresaleAdminAnomalyService(evtRepo, depRepo, roundRepo, holdingRepo)
	_, err := svc.Resolve(tx, 1, &service.ResolveRequest{
		Resolution: "reject",
		Note:       "some note here that is long",
	}, "op1")

	assert.Error(t, err)
	assert.True(t, errors.Is(err, service.ErrInvalidStateTransition))
}

// ─── Adversarial ─────────────────────────────────────────────────────────────

func TestPresaleAdminAnomalyService_Adversarial_UnsupportedResolution(t *testing.T) {
	evtRepo := new(mockAdminOpsEventRepo)
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	tx := &gorm.DB{}

	evt := pendingOpsEvent(1)
	evtRepo.On("AdminGetForUpdate", tx, uint64(1)).Return(evt, nil)

	svc := service.NewPresaleAdminAnomalyService(evtRepo, depRepo, roundRepo, holdingRepo)
	_, err := svc.Resolve(tx, 1, &service.ResolveRequest{
		Resolution: "sql_injection_; DROP TABLE presale_deposit; --",
		Note:       "adversarial note attempt",
	}, "attacker")

	assert.Error(t, err)
	assert.True(t, errors.Is(err, service.ErrInvalidResolution),
		"want ErrInvalidResolution sentinel, got: %v", err)
}

func TestPresaleAdminAnomalyService_Adversarial_NotFound(t *testing.T) {
	evtRepo := new(mockAdminOpsEventRepo)
	depRepo := new(mockAdminDepositRepo)
	roundRepo := new(mockAdminRoundRepo)
	holdingRepo := new(mockPresaleHoldingRepo)
	tx := &gorm.DB{}

	evtRepo.On("AdminGetForUpdate", tx, uint64(9999)).Return(nil, repository.ErrOpsEventNotFound)

	svc := service.NewPresaleAdminAnomalyService(evtRepo, depRepo, roundRepo, holdingRepo)
	_, err := svc.Resolve(tx, 9999, &service.ResolveRequest{Resolution: "reject", Note: "test note here"}, "op1")
	assert.True(t, errors.Is(err, service.ErrAnomalyNotFound))
}

// interface compliance checks
var _ repository.AdminPresaleOpsEventRepository = (*mockAdminOpsEventRepo)(nil)
var _ repository.AdminPresaleDepositRepository = (*mockAdminDepositRepo)(nil)
var _ repository.PresaleHoldingRepository = (*mockPresaleHoldingRepo)(nil)
