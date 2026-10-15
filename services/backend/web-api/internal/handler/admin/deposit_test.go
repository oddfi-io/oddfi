package admin_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/handler/admin"
	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/gormtx"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"
)

// ─── mock deposit service ─────────────────────────────────────────────────────

type mockDepositSvc struct{ mock.Mock }

func (m *mockDepositSvc) ListDeposits(ctx context.Context, f repository.PresaleDepositFilter) ([]*model.PresaleDeposit, int64, error) {
	args := m.Called(ctx, f)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*model.PresaleDeposit), args.Get(1).(int64), args.Error(2)
}

func (m *mockDepositSvc) GetDeposit(ctx context.Context, txHash string) (*model.PresaleDeposit, error) {
	args := m.Called(ctx, txHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleDeposit), args.Error(1)
}

func (m *mockDepositSvc) GetDepositTx(tx *gorm.DB, txHash string) (*model.PresaleDeposit, error) {
	args := m.Called(tx, txHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleDeposit), args.Error(1)
}

func (m *mockDepositSvc) MigrateRound(ctx context.Context, tx *gorm.DB, txHash, targetRoundID string, toleranceMin int) (*service.MigrateRoundResult, error) {
	args := m.Called(ctx, tx, txHash, targetRoundID, toleranceMin)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.MigrateRoundResult), args.Error(1)
}

// ─── mock config service (subset needed by DepositHandler) ───────────────────

type mockDepositCfgSvc struct{ mock.Mock }

func (m *mockDepositCfgSvc) GetConfig(ctx context.Context) (*model.PresaleConfig, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleConfig), args.Error(1)
}

func (m *mockDepositCfgSvc) GetConfigTx(tx *gorm.DB) (*model.PresaleConfig, error) {
	args := m.Called(tx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleConfig), args.Error(1)
}

func (m *mockDepositCfgSvc) UpdateConfig(tx *gorm.DB, req *service.UpdateConfigRequest) (*service.UpdateConfigResult, error) {
	args := m.Called(tx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.UpdateConfigResult), args.Error(1)
}

// ─── router setup ────────────────────────────────────────────────────────────

func setupDepositRouter(svc service.PresaleAdminDepositService, cfgSvc service.PresaleAdminConfigService, db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := admin.NewDepositHandler(svc, cfgSvc)

	withTx := func(c *gin.Context) {
		if db != nil {
			ctx := gormtx.InjectTx(c.Request.Context(), db)
			c.Request = c.Request.WithContext(ctx)
		}
		c.Set(middleware.CtxAdminOperatorID, "lark:test_operator")
		c.Set(middleware.CtxAdminOperatorRole, "operator")
		c.Next()
	}

	r.GET("/deposits", h.ListHandler())
	r.GET("/deposits/:txHash", h.GetHandler())
	r.POST("/deposits/:txHash/migrate-round", withTx, h.MigrateRoundHandler())
	return r
}

func sampleDeposit() *model.PresaleDeposit {
	usd := decimal.NewFromInt(100)
	return &model.PresaleDeposit{
		TxHash:     "0xabc",
		RoundID:    "r1",
		Status:     model.PresaleDepositStatusConfirmed,
		AmountUsdt: usd,
	}
}

func sampleConfig() *model.PresaleConfig {
	return &model.PresaleConfig{
		ID:                   1,
		BoundaryToleranceMin: 5,
	}
}

// ─── GET /deposits ────────────────────────────────────────────────────────────

func TestDepositHandler_List(t *testing.T) {
	svc := new(mockDepositSvc)
	cfgSvc := new(mockDepositCfgSvc)
	svc.On("ListDeposits", mock.Anything, mock.Anything).Return([]*model.PresaleDeposit{sampleDeposit()}, int64(1), nil)

	r := setupDepositRouter(svc, cfgSvc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/deposits", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, float64(0), resp["code"])
}

func TestDepositHandler_List_Error(t *testing.T) {
	svc := new(mockDepositSvc)
	cfgSvc := new(mockDepositCfgSvc)
	svc.On("ListDeposits", mock.Anything, mock.Anything).Return(nil, int64(0), errors.New("db error"))

	r := setupDepositRouter(svc, cfgSvc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/deposits", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ─── GET /deposits/:txHash ────────────────────────────────────────────────────

func TestDepositHandler_Get(t *testing.T) {
	svc := new(mockDepositSvc)
	cfgSvc := new(mockDepositCfgSvc)
	svc.On("GetDeposit", mock.Anything, "0xabc").Return(sampleDeposit(), nil)

	r := setupDepositRouter(svc, cfgSvc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/deposits/0xabc", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestDepositHandler_Get_NotFound(t *testing.T) {
	svc := new(mockDepositSvc)
	cfgSvc := new(mockDepositCfgSvc)
	svc.On("GetDeposit", mock.Anything, "0xmissing").Return(nil, service.ErrAdminDepositNotFound)

	r := setupDepositRouter(svc, cfgSvc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/deposits/0xmissing", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ─── POST /deposits/:txHash/migrate-round ─────────────────────────────────────

func TestDepositHandler_MigrateRound_Success(t *testing.T) {
	svc := new(mockDepositSvc)
	cfgSvc := new(mockDepositCfgSvc)
	db := &gorm.DB{}

	dep := sampleDeposit()
	result := &service.MigrateRoundResult{
		Deposit:      dep,
		OldRoundID:   "r1",
		NewRoundID:   "r2",
		OldSharesOdd: decimal.NewFromInt(500),
		NewSharesOdd: decimal.NewFromInt(400),
	}

	cfgSvc.On("GetConfigTx", mock.Anything).Return(sampleConfig(), nil)
	svc.On("GetDepositTx", mock.Anything, "0xabc").Return(dep, nil)
	svc.On("MigrateRound", mock.Anything, mock.Anything, "0xabc", "r2", 5).Return(result, nil)

	r := setupDepositRouter(svc, cfgSvc, db)
	body := bytes.NewBufferString(`{"targetRoundId":"r2","note":"admin migration"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/deposits/0xabc/migrate-round", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]any)
	assert.Equal(t, "r1", data["oldRoundId"])
	assert.Equal(t, "r2", data["newRoundId"])
}

func TestDepositHandler_MigrateRound_MissingBody(t *testing.T) {
	svc := new(mockDepositSvc)
	cfgSvc := new(mockDepositCfgSvc)
	db := &gorm.DB{}

	cfgSvc.On("GetConfigTx", mock.Anything).Return(sampleConfig(), nil)
	svc.On("GetDepositTx", mock.Anything, mock.Anything).Return(sampleDeposit(), nil).Maybe()

	r := setupDepositRouter(svc, cfgSvc, db)
	// targetRoundId required — empty body should fail binding
	body := bytes.NewBufferString(`{}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/deposits/0xabc/migrate-round", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDepositHandler_MigrateRound_LimitExceeded(t *testing.T) {
	svc := new(mockDepositSvc)
	cfgSvc := new(mockDepositCfgSvc)
	db := &gorm.DB{}

	cfgSvc.On("GetConfigTx", mock.Anything).Return(sampleConfig(), nil)
	svc.On("GetDepositTx", mock.Anything, "0xabc").Return(sampleDeposit(), nil)
	svc.On("MigrateRound", mock.Anything, mock.Anything, "0xabc", "r2", 5).Return(nil, service.ErrMigrateRoundLimitExceeded)

	r := setupDepositRouter(svc, cfgSvc, db)
	body := bytes.NewBufferString(`{"targetRoundId":"r2","note":"too many migrations"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/deposits/0xabc/migrate-round", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

// ─── Adversarial ─────────────────────────────────────────────────────────────

func TestDepositHandler_Adversarial_GarbageBody(t *testing.T) {
	svc := new(mockDepositSvc)
	cfgSvc := new(mockDepositCfgSvc)
	db := &gorm.DB{}

	cfgSvc.On("GetConfigTx", mock.Anything).Return(sampleConfig(), nil)

	r := setupDepositRouter(svc, cfgSvc, db)
	body := bytes.NewBufferString(`{not valid json!!!`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/deposits/0xabc/migrate-round", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

// interface compliance
var _ service.PresaleAdminDepositService = (*mockDepositSvc)(nil)
var _ service.PresaleAdminConfigService = (*mockDepositCfgSvc)(nil)
