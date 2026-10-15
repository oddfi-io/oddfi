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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/handler/admin"
	"everything_finance/org/web-api/internal/middleware"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/gormtx"
	"everything_finance/org/web-api/internal/service"
)

// ─── mock config service ──────────────────────────────────────────────────────

type mockConfigSvc struct{ mock.Mock }

func (m *mockConfigSvc) GetConfig(ctx context.Context) (*model.PresaleConfig, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleConfig), args.Error(1)
}

func (m *mockConfigSvc) GetConfigTx(tx *gorm.DB) (*model.PresaleConfig, error) {
	args := m.Called(tx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleConfig), args.Error(1)
}

func (m *mockConfigSvc) UpdateConfig(tx *gorm.DB, req *service.UpdateConfigRequest) (*service.UpdateConfigResult, error) {
	args := m.Called(tx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.UpdateConfigResult), args.Error(1)
}

// ─── router setup ────────────────────────────────────────────────────────────

func setupConfigRouter(svc service.PresaleAdminConfigService, db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := admin.NewConfigHandler(svc)

	withTx := func(c *gin.Context) {
		if db != nil {
			ctx := gormtx.InjectTx(c.Request.Context(), db)
			c.Request = c.Request.WithContext(ctx)
		}
		c.Set(middleware.CtxAdminOperatorID, "lark:test_operator")
		c.Set(middleware.CtxAdminOperatorRole, "operator")
		c.Next()
	}

	r.GET("/config", h.GetHandler())
	r.PATCH("/config", withTx, h.UpdateHandler())
	return r
}

// ─── GET /config ──────────────────────────────────────────────────────────────

func TestConfigHandler_Get(t *testing.T) {
	svc := new(mockConfigSvc)
	svc.On("GetConfig", mock.Anything).Return(sampleConfig(), nil)

	r := setupConfigRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/config", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, float64(0), resp["code"])
}

func TestConfigHandler_Get_Error(t *testing.T) {
	svc := new(mockConfigSvc)
	svc.On("GetConfig", mock.Anything).Return(nil, errors.New("db error"))

	r := setupConfigRouter(svc, nil)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/config", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ─── PATCH /config ────────────────────────────────────────────────────────────

func TestConfigHandler_Update_Success(t *testing.T) {
	svc := new(mockConfigSvc)
	db := &gorm.DB{}

	svc.On("GetConfigTx", mock.Anything).Return(sampleConfig(), nil)
	svc.On("UpdateConfig", mock.Anything, mock.Anything).Return(&service.UpdateConfigResult{
		Config: sampleConfig(),
	}, nil)

	r := setupConfigRouter(svc, db)
	body := bytes.NewBufferString(`{"tgeTs":10000000,"note":"update tge ts"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/config", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestConfigHandler_Update_WithWarning(t *testing.T) {
	svc := new(mockConfigSvc)
	db := &gorm.DB{}

	svc.On("GetConfigTx", mock.Anything).Return(sampleConfig(), nil)
	svc.On("UpdateConfig", mock.Anything, mock.Anything).Return(&service.UpdateConfigResult{
		Config:  sampleConfig(),
		Warning: "vault_address changed: restart presale-worker",
	}, nil)

	r := setupConfigRouter(svc, db)
	body := bytes.NewBufferString(`{"vaultAddress":"0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","note":"vault update note"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/config", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NotEmpty(t, resp["warning"])
}

func TestConfigHandler_Update_InvalidDecimal(t *testing.T) {
	svc := new(mockConfigSvc)
	db := &gorm.DB{}

	r := setupConfigRouter(svc, db)
	body := bytes.NewBufferString(`{"tgeOpenPriceUsd":"not_a_number","note":"bad decimal"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/config", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestConfigHandler_Update_ServiceError(t *testing.T) {
	svc := new(mockConfigSvc)
	db := &gorm.DB{}

	svc.On("GetConfigTx", mock.Anything).Return(sampleConfig(), nil)
	svc.On("UpdateConfig", mock.Anything, mock.Anything).Return(nil, errors.New("invalid vault address"))

	r := setupConfigRouter(svc, db)
	body := bytes.NewBufferString(`{"vaultAddress":"notanaddress","note":"bad vault addr"}`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/config", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ─── Adversarial ─────────────────────────────────────────────────────────────

func TestConfigHandler_Adversarial_GarbageBody(t *testing.T) {
	svc := new(mockConfigSvc)
	db := &gorm.DB{}

	r := setupConfigRouter(svc, db)
	body := bytes.NewBufferString(`{not valid json!!!`)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/config", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

// interface compliance
var _ service.PresaleAdminConfigService = (*mockConfigSvc)(nil)
