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

// ─── mock repo ───────────────────────────────────────────────────────────────

type mockAdminRoundRepo struct{ mock.Mock }

func (m *mockAdminRoundRepo) GetByIDTx(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	args := m.Called(tx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

func (m *mockAdminRoundRepo) GetForUpdate(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	args := m.Called(tx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

func (m *mockAdminRoundRepo) UpdateFields(tx *gorm.DB, id string, fields map[string]any) error {
	args := m.Called(tx, id, fields)
	return args.Error(0)
}

func (m *mockAdminRoundRepo) UpdateReferralPct(tx *gorm.DB, id string, pct decimal.Decimal) error {
	args := m.Called(tx, id, pct)
	return args.Error(0)
}

func (m *mockAdminRoundRepo) AdminList(ctx context.Context) ([]*model.PresaleRound, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.PresaleRound), args.Error(1)
}

func (m *mockAdminRoundRepo) AdjustSoldOdd(tx *gorm.DB, roundID string, deltaOdd, deltaUsd decimal.Decimal) error {
	args := m.Called(tx, roundID, deltaOdd, deltaUsd)
	return args.Error(0)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func activeRound(id string) *model.PresaleRound {
	return &model.PresaleRound{
		ID:                id,
		Status:            model.RoundStatusActive,
		SoldOdd:           decimal.NewFromInt(100),
		SupplyOdd:         decimal.NewFromInt(1000),
		StartTs:           1000,
		EndTs:             9000,
		ReferralRewardPct: decimal.NewFromInt(10),
	}
}

// ─── ListRounds ──────────────────────────────────────────────────────────────

func TestPresaleAdminRoundService_ListRounds(t *testing.T) {
	cases := []struct {
		name      string
		mockRet   []*model.PresaleRound
		mockErr   error
		expectErr bool
		expectLen int
	}{
		{"success", []*model.PresaleRound{activeRound("r1"), activeRound("r2")}, nil, false, 2},
		{"db_error", nil, errors.New("db error"), true, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := new(mockAdminRoundRepo)
			repo.On("AdminList", mock.Anything).Return(tc.mockRet, tc.mockErr)
			svc := service.NewPresaleAdminRoundService(repo)

			rounds, err := svc.ListRounds(context.Background())
			if tc.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Len(t, rounds, tc.expectLen)
			}
		})
	}
}

// ─── PauseRound ──────────────────────────────────────────────────────────────

func TestPresaleAdminRoundService_PauseRound(t *testing.T) {
	cases := []struct {
		name        string
		roundStatus string
		getErr      error
		updateErr   error
		expectErr   bool
		errIs       error
	}{
		{"success_active_to_paused", model.RoundStatusActive, nil, nil, false, nil},
		{"fail_already_paused", model.RoundStatusPaused, nil, nil, true, service.ErrInvalidStateTransition},
		{"fail_ended", model.RoundStatusEnded, nil, nil, true, service.ErrInvalidStateTransition},
		{"fail_round_not_found", "", repository.ErrRoundNotFound, nil, true, service.ErrAdminRoundNotFound},
		{"fail_update_error", model.RoundStatusActive, nil, errors.New("db error"), true, nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := new(mockAdminRoundRepo)
			tx := &gorm.DB{}

			if tc.getErr != nil {
				repo.On("GetForUpdate", tx, "r1").Return(nil, tc.getErr)
			} else {
				r := activeRound("r1")
				r.Status = tc.roundStatus
				repo.On("GetForUpdate", tx, "r1").Return(r, nil)
				if tc.roundStatus == model.RoundStatusActive {
					repo.On("UpdateFields", tx, "r1", mock.Anything).Return(tc.updateErr)
				}
			}

			svc := service.NewPresaleAdminRoundService(repo)
			result, err := svc.PauseRound(tx, "r1")

			if tc.expectErr {
				assert.Error(t, err)
				if tc.errIs != nil {
					assert.True(t, errors.Is(err, tc.errIs), "expected error to wrap %v, got %v", tc.errIs, err)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, model.RoundStatusPaused, result.Status)
				assert.True(t, result.ManualOverride)
			}
			repo.AssertExpectations(t)
		})
	}
}

// ─── ResumeRound ─────────────────────────────────────────────────────────────

func TestPresaleAdminRoundService_ResumeRound(t *testing.T) {
	cases := []struct {
		name        string
		roundStatus string
		expectErr   bool
	}{
		{"success_paused_to_active", model.RoundStatusPaused, false},
		{"fail_active", model.RoundStatusActive, true},
		{"fail_ended", model.RoundStatusEnded, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := new(mockAdminRoundRepo)
			tx := &gorm.DB{}
			r := activeRound("r1")
			r.Status = tc.roundStatus
			repo.On("GetForUpdate", tx, "r1").Return(r, nil)
			if !tc.expectErr {
				repo.On("UpdateFields", tx, "r1", mock.Anything).Return(nil)
			}

			svc := service.NewPresaleAdminRoundService(repo)
			result, err := svc.ResumeRound(tx, "r1")

			if tc.expectErr {
				assert.Error(t, err)
				assert.True(t, errors.Is(err, service.ErrInvalidStateTransition))
			} else {
				assert.NoError(t, err)
				assert.Equal(t, model.RoundStatusActive, result.Status)
			}
		})
	}
}

// ─── ReopenRound ─────────────────────────────────────────────────────────────

func TestPresaleAdminRoundService_ReopenRound(t *testing.T) {
	repo := new(mockAdminRoundRepo)
	tx := &gorm.DB{}
	r := activeRound("r1")
	r.Status = model.RoundStatusEnded
	repo.On("GetForUpdate", tx, "r1").Return(r, nil)
	repo.On("UpdateFields", tx, "r1", mock.Anything).Return(nil)

	svc := service.NewPresaleAdminRoundService(repo)
	result, err := svc.ReopenRound(tx, "r1")

	assert.NoError(t, err)
	assert.Equal(t, model.RoundStatusActive, result.Status)
	repo.AssertExpectations(t)
}

// ─── CloseRound ──────────────────────────────────────────────────────────────

func TestPresaleAdminRoundService_CloseRound(t *testing.T) {
	cases := []struct {
		name        string
		roundStatus string
		expectErr   bool
	}{
		{"success_active", model.RoundStatusActive, false},
		{"success_paused", model.RoundStatusPaused, false},
		{"fail_ended", model.RoundStatusEnded, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := new(mockAdminRoundRepo)
			tx := &gorm.DB{}
			r := activeRound("r1")
			r.Status = tc.roundStatus
			repo.On("GetForUpdate", tx, "r1").Return(r, nil)
			if !tc.expectErr {
				repo.On("UpdateFields", tx, "r1", mock.Anything).Return(nil)
			}

			svc := service.NewPresaleAdminRoundService(repo)
			result, err := svc.CloseRound(tx, "r1")

			if tc.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, model.RoundStatusEnded, result.Status)
			}
		})
	}
}

// ─── UpdateReferralPct ───────────────────────────────────────────────────────

func TestPresaleAdminRoundService_UpdateReferralPct(t *testing.T) {
	cases := []struct {
		name      string
		pct       string
		expectErr bool
	}{
		{"success_10pct", "10", false},
		{"success_zero", "0", false},
		{"success_100pct", "100", false},
		{"fail_negative", "-1", true},
		{"fail_over_100", "101", true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := new(mockAdminRoundRepo)
			tx := &gorm.DB{}
			r := activeRound("r1")
			repo.On("GetForUpdate", tx, "r1").Return(r, nil)

			pct, _ := decimal.NewFromString(tc.pct)
			if !pct.IsNegative() && !pct.GreaterThan(decimal.NewFromInt(100)) {
				repo.On("UpdateReferralPct", tx, "r1", pct).Return(nil)
			}

			svc := service.NewPresaleAdminRoundService(repo)
			result, err := svc.UpdateReferralPct(tx, "r1", pct)

			if tc.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, pct, result.ReferralRewardPct)
			}
		})
	}
}

// ─── UpdateRound ─────────────────────────────────────────────────────────────

func TestPresaleAdminRoundService_UpdateRound(t *testing.T) {
	cases := []struct {
		name      string
		req       service.UpdateRoundRequest
		expectErr bool
	}{
		{
			name:      "success_update_price",
			req:       service.UpdateRoundRequest{PriceUsd: ptrDecimal("0.5")},
			expectErr: false,
		},
		{
			name:      "fail_zero_price",
			req:       service.UpdateRoundRequest{PriceUsd: ptrDecimal("0")},
			expectErr: true,
		},
		{
			name:      "fail_supply_less_than_sold",
			req:       service.UpdateRoundRequest{SupplyOdd: ptrDecimal("50")}, // sold=100
			expectErr: true,
		},
		{
			name:      "fail_end_ts_before_start",
			req:       service.UpdateRoundRequest{EndTs: ptrInt64(500)}, // start=1000
			expectErr: true,
		},
		{
			name:      "noop_empty_request",
			req:       service.UpdateRoundRequest{},
			expectErr: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := new(mockAdminRoundRepo)
			tx := &gorm.DB{}
			r := activeRound("r1")
			repo.On("GetForUpdate", tx, "r1").Return(r, nil)

			// 只有有实质改动 + 合法才调 UpdateFields
			req := tc.req
			if req.PriceUsd != nil && !req.PriceUsd.IsZero() {
				repo.On("UpdateFields", tx, "r1", mock.Anything).Return(nil)
			}

			svc := service.NewPresaleAdminRoundService(repo)
			_, err := svc.UpdateRound(tx, "r1", &req)

			if tc.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// ─── Adversarial ─────────────────────────────────────────────────────────────

func TestPresaleAdminRoundService_Adversarial_StateLoop(t *testing.T) {
	// 已 paused 的轮次再次 pause 必须失败
	repo := new(mockAdminRoundRepo)
	tx := &gorm.DB{}
	r := activeRound("r1")
	r.Status = model.RoundStatusPaused
	repo.On("GetForUpdate", tx, "r1").Return(r, nil)

	svc := service.NewPresaleAdminRoundService(repo)
	_, err := svc.PauseRound(tx, "r1")
	assert.Error(t, err)
	assert.True(t, errors.Is(err, service.ErrInvalidStateTransition))
}

func TestPresaleAdminRoundService_Adversarial_NotFound(t *testing.T) {
	// 不存在的轮次返回 ErrAdminRoundNotFound
	repo := new(mockAdminRoundRepo)
	tx := &gorm.DB{}
	repo.On("GetForUpdate", tx, "nonexist").Return(nil, repository.ErrRoundNotFound)

	svc := service.NewPresaleAdminRoundService(repo)
	_, err := svc.PauseRound(tx, "nonexist")
	assert.True(t, errors.Is(err, service.ErrAdminRoundNotFound))
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func ptrDecimal(s string) *decimal.Decimal {
	d, _ := decimal.NewFromString(s)
	return &d
}

func ptrInt64(v int64) *int64 {
	return &v
}
