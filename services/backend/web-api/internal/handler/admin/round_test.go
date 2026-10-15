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
	"everything_finance/org/web-api/internal/service"
)

// ─── mock service ────────────────────────────────────────────────────────────

type mockRoundSvc struct{ mock.Mock }

func (m *mockRoundSvc) ListRounds(ctx context.Context) ([]*model.PresaleRound, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.PresaleRound), args.Error(1)
}

func (m *mockRoundSvc) GetRound(ctx context.Context, id string) (*model.PresaleRound, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

func (m *mockRoundSvc) GetRoundTx(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	args := m.Called(tx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

func (m *mockRoundSvc) PauseRound(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	args := m.Called(tx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

func (m *mockRoundSvc) ResumeRound(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	args := m.Called(tx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

func (m *mockRoundSvc) ReopenRound(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	args := m.Called(tx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

func (m *mockRoundSvc) CloseRound(tx *gorm.DB, id string) (*model.PresaleRound, error) {
	args := m.Called(tx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

func (m *mockRoundSvc) UpdateReferralPct(tx *gorm.DB, id string, pct decimal.Decimal) (*model.PresaleRound, error) {
	args := m.Called(tx, id, pct)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

func (m *mockRoundSvc) UpdateRound(tx *gorm.DB, id string, req *service.UpdateRoundRequest) (*model.PresaleRound, error) {
	args := m.Called(tx, id, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleRound), args.Error(1)
}

// ─── router setup ─────────────────────────────────────────────────────────────

func setupRoundRouter(svc service.PresaleAdminRoundService, db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := admin.NewRoundHandler(svc)

	// 注入 tx 到 ctx（模拟 admin_audit middleware）
	// 使用 InjectTx 而非 WithTx，避免对 zero-value *gorm.DB 调用 Begin() 崩溃
	withTx := func(c *gin.Context) {
		if db != nil {
			ctx := gormtx.InjectTx(c.Request.Context(), db)
			c.Request = c.Request.WithContext(ctx)
		}
		// 注入 operator
		c.Set(middleware.CtxAdminOperatorID, "lark:test_operator")
		c.Set(middleware.CtxAdminOperatorRole, "operator")
		c.Next()
	}

	r.GET("/rounds", h.ListHandler())
	r.GET("/rounds/:id", h.GetHandler())
	r.POST("/rounds/:id/pause", withTx, h.PauseHandler())
	r.POST("/rounds/:id/resume", withTx, h.ResumeHandler())
	r.POST("/rounds/:id/reopen", withTx, h.ReopenHandler())
	r.POST("/rounds/:id/close", withTx, h.CloseHandler())
	r.PATCH("/rounds/:id/referral-pct", withTx, h.UpdateReferralPctHandler())
	r.PATCH("/rounds/:id", withTx, h.UpdateRoundHandler())

	return r
}

func sampleRound() *model.PresaleRound {
	return &model.PresaleRound{
		ID:     "r1",
		Status: model.RoundStatusActive,
		Name:   "Round 1",
	}
}

// ─── GET /rounds ──────────────────────────────────────────────────────────────

func TestRoundHandler_List(t *testing.T) {
	svc := new(mockRoundSvc)
	svc.On("ListRounds", mock.Anything).Return([]*model.PresaleRound{sampleRound()}, nil)

	r := setupRoundRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/rounds", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, float64(0), resp["code"])
}

func TestRoundHandler_List_Error(t *testing.T) {
	svc := new(mockRoundSvc)
	svc.On("ListRounds", mock.Anything).Return(nil, errors.New("db error"))

	r := setupRoundRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/rounds", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ─── GET /rounds/:id ─────────────────────────────────────────────────────────

func TestRoundHandler_Get(t *testing.T) {
	svc := new(mockRoundSvc)
	svc.On("GetRound", mock.Anything, "r1").Return(sampleRound(), nil)

	r := setupRoundRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/rounds/r1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRoundHandler_Get_NotFound(t *testing.T) {
	svc := new(mockRoundSvc)
	svc.On("GetRound", mock.Anything, "nonexist").Return(nil, service.ErrAdminRoundNotFound)

	r := setupRoundRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/rounds/nonexist", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ─── POST /rounds/:id/pause ───────────────────────────────────────────────────

func TestRoundHandler_Pause_Success(t *testing.T) {
	svc := new(mockRoundSvc)
	db := &gorm.DB{}
	paused := sampleRound()
	paused.Status = model.RoundStatusPaused

	svc.On("GetRoundTx", mock.Anything, "r1").Return(sampleRound(), nil)
	svc.On("PauseRound", mock.Anything, "r1").Return(paused, nil)

	r := setupRoundRouter(svc, db)
	body := bytes.NewBufferString(`{"note":"pause for maintenance"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/rounds/r1/pause", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRoundHandler_Pause_InvalidStateTransition(t *testing.T) {
	svc := new(mockRoundSvc)
	db := &gorm.DB{}

	svc.On("GetRoundTx", mock.Anything, "r1").Return(sampleRound(), nil)
	svc.On("PauseRound", mock.Anything, "r1").Return(nil, service.ErrInvalidStateTransition)

	r := setupRoundRouter(svc, db)
	body := bytes.NewBufferString(`{"note":"pause again invalid"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/rounds/r1/pause", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)
}

// ─── Adversarial ─────────────────────────────────────────────────────────────

func TestRoundHandler_Adversarial_GarbageBody(t *testing.T) {
	svc := new(mockRoundSvc)
	db := &gorm.DB{}
	// GetRoundTx will NOT be called since body parsing happens after tx injection
	// but ShouldBindBodyWith for these routes happens in admin_audit middleware
	// For handler test, garbage JSON means the gin binding will fail
	svc.On("GetRoundTx", mock.Anything, mock.Anything).Return(sampleRound(), nil).Maybe()
	svc.On("UpdateRoundHandler", mock.Anything, mock.Anything, mock.Anything).Return(sampleRound(), nil).Maybe()

	r := setupRoundRouter(svc, db)
	body := bytes.NewBufferString(`{not valid json!!!`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/rounds/r1", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	// Should not be 200 — invalid JSON should be rejected
	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestRoundHandler_Adversarial_InvalidDecimalField(t *testing.T) {
	svc := new(mockRoundSvc)
	db := &gorm.DB{}
	svc.On("GetRoundTx", mock.Anything, "r1").Return(sampleRound(), nil)

	r := setupRoundRouter(svc, db)
	// priceUsd 传非数字字符串
	body := bytes.NewBufferString(`{"priceUsd":"not_a_number","note":"test note here"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/rounds/r1", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
