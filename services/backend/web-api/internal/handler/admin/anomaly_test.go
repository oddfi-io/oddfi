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

// ─── mock anomaly service ────────────────────────────────────────────────────

type mockAnomalySvc struct{ mock.Mock }

func (m *mockAnomalySvc) ListAnomaly(ctx context.Context, f repository.PresaleOpsEventFilter) ([]*model.PresaleOpsEvent, int64, error) {
	args := m.Called(ctx, f)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*model.PresaleOpsEvent), args.Get(1).(int64), args.Error(2)
}

func (m *mockAnomalySvc) GetAnomaly(ctx context.Context, id uint64) (*model.PresaleOpsEvent, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleOpsEvent), args.Error(1)
}

func (m *mockAnomalySvc) GetAnomalyTx(tx *gorm.DB, id uint64) (*model.PresaleOpsEvent, error) {
	args := m.Called(tx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleOpsEvent), args.Error(1)
}

func (m *mockAnomalySvc) Resolve(tx *gorm.DB, id uint64, req *service.ResolveRequest, operatorID string) (*model.PresaleOpsEvent, error) {
	args := m.Called(tx, id, req, operatorID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleOpsEvent), args.Error(1)
}

// ─── router setup ────────────────────────────────────────────────────────────

func setupAnomalyRouter(svc service.PresaleAdminAnomalyService, db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := admin.NewAnomalyHandler(svc)

	withTx := func(c *gin.Context) {
		if db != nil {
			ctx := gormtx.InjectTx(c.Request.Context(), db)
			c.Request = c.Request.WithContext(ctx)
		}
		c.Set(middleware.CtxAdminOperatorID, "lark:test_operator")
		c.Set(middleware.CtxAdminOperatorRole, "operator")
		c.Next()
	}

	r.GET("/anomaly", h.ListHandler())
	r.GET("/anomaly/:id", h.GetHandler())
	r.POST("/anomaly/:id/resolve", withTx, h.ResolveHandler())
	return r
}

func sampleOpsEvent(id uint64) *model.PresaleOpsEvent {
	amt := decimal.NewFromInt(100)
	depID := uint64(999)
	return &model.PresaleOpsEvent{
		ID:         id,
		EventType:  model.AnomalyOverflow,
		DepositID:  &depID,
		AmountUsdt: &amt,
		Status:     model.OpsEventStatusPending,
	}
}

// ─── GET /anomaly ────────────────────────────────────────────────────────────

func TestAnomalyHandler_List(t *testing.T) {
	svc := new(mockAnomalySvc)
	svc.On("ListAnomaly", mock.Anything, mock.Anything).Return([]*model.PresaleOpsEvent{sampleOpsEvent(1)}, int64(1), nil)

	r := setupAnomalyRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/anomaly", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, float64(0), resp["code"])
}

func TestAnomalyHandler_List_Error(t *testing.T) {
	svc := new(mockAnomalySvc)
	svc.On("ListAnomaly", mock.Anything, mock.Anything).Return(nil, int64(0), errors.New("db error"))

	r := setupAnomalyRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/anomaly", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ─── GET /anomaly/:id ────────────────────────────────────────────────────────

func TestAnomalyHandler_Get(t *testing.T) {
	svc := new(mockAnomalySvc)
	svc.On("GetAnomaly", mock.Anything, uint64(1)).Return(sampleOpsEvent(1), nil)

	r := setupAnomalyRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/anomaly/1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAnomalyHandler_Get_NotFound(t *testing.T) {
	svc := new(mockAnomalySvc)
	svc.On("GetAnomaly", mock.Anything, uint64(9999)).Return(nil, service.ErrAnomalyNotFound)

	r := setupAnomalyRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/anomaly/9999", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAnomalyHandler_Get_InvalidID(t *testing.T) {
	svc := new(mockAnomalySvc)

	r := setupAnomalyRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/anomaly/not_a_number", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ─── POST /anomaly/:id/resolve ────────────────────────────────────────────────

func TestAnomalyHandler_Resolve_Reject(t *testing.T) {
	svc := new(mockAnomalySvc)
	db := &gorm.DB{}

	evt := sampleOpsEvent(1)
	resolved := sampleOpsEvent(1)
	resolved.Status = model.OpsEventStatusRejected

	svc.On("GetAnomalyTx", mock.Anything, uint64(1)).Return(evt, nil)
	svc.On("Resolve", mock.Anything, uint64(1), mock.Anything, "lark:test_operator").Return(resolved, nil)

	r := setupAnomalyRouter(svc, db)
	body := bytes.NewBufferString(`{"resolution":"reject","note":"user confirmed refund"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/anomaly/1/resolve", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAnomalyHandler_Resolve_AlreadyResolved(t *testing.T) {
	svc := new(mockAnomalySvc)
	db := &gorm.DB{}

	evt := sampleOpsEvent(1)
	evt.Status = model.OpsEventStatusResolved
	svc.On("GetAnomalyTx", mock.Anything, uint64(1)).Return(evt, nil)
	svc.On("Resolve", mock.Anything, uint64(1), mock.Anything, "lark:test_operator").Return(nil, service.ErrInvalidStateTransition)

	r := setupAnomalyRouter(svc, db)
	body := bytes.NewBufferString(`{"resolution":"reject","note":"already resolved event"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/anomaly/1/resolve", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestAnomalyHandler_Resolve_MissingResolution(t *testing.T) {
	svc := new(mockAnomalySvc)
	db := &gorm.DB{}

	// resolution is required — empty resolution should fail binding
	r := setupAnomalyRouter(svc, db)
	body := bytes.NewBufferString(`{"note":"some note without resolution field"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/anomaly/1/resolve", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ─── Adversarial ─────────────────────────────────────────────────────────────

func TestAnomalyHandler_Adversarial_GarbageBody(t *testing.T) {
	svc := new(mockAnomalySvc)
	db := &gorm.DB{}

	r := setupAnomalyRouter(svc, db)
	body := bytes.NewBufferString(`{not valid json!!!`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/anomaly/1/resolve", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestAnomalyHandler_Adversarial_InvalidIDInResolve(t *testing.T) {
	svc := new(mockAnomalySvc)
	db := &gorm.DB{}

	r := setupAnomalyRouter(svc, db)
	body := bytes.NewBufferString(`{"resolution":"reject","note":"test adversarial note"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/anomaly/not-a-number/resolve", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// interface compliance
var _ service.PresaleAdminAnomalyService = (*mockAnomalySvc)(nil)
