package admin_test

import (
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
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
)

// ─── mock audit repo ─────────────────────────────────────────────────────────

type mockAuditRepo struct{ mock.Mock }

func (m *mockAuditRepo) Create(tx *gorm.DB, entry *model.PresaleAdminAudit) error {
	args := m.Called(tx, entry)
	return args.Error(0)
}

func (m *mockAuditRepo) List(ctx context.Context, f repository.PresaleAdminAuditFilter) ([]model.PresaleAdminAudit, int64, error) {
	args := m.Called(ctx, f)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]model.PresaleAdminAudit), args.Get(1).(int64), args.Error(2)
}

func (m *mockAuditRepo) CountByTargetAndAction(ctx context.Context, targetType, targetID, action string) (int64, error) {
	args := m.Called(ctx, targetType, targetID, action)
	return args.Get(0).(int64), args.Error(1)
}

// ─── router setup ────────────────────────────────────────────────────────────

func setupAuditRouter(repo repository.PresaleAdminAuditRepository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := admin.NewAuditHandler(repo)
	r.GET("/audit", h.ListHandler())
	return r
}

// ─── GET /audit ───────────────────────────────────────────────────────────────

func TestAuditHandler_List(t *testing.T) {
	repo := new(mockAuditRepo)
	logs := []model.PresaleAdminAudit{
		{ID: 1, Operator: "lark:op1", Action: "pause", TargetType: "round", TargetID: "r1"},
	}
	repo.On("List", mock.Anything, mock.Anything).Return(logs, int64(1), nil)

	r := setupAuditRouter(repo)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/audit", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, float64(0), resp["code"])
	data := resp["data"].(map[string]any)
	assert.Equal(t, float64(1), data["total"])
}

func TestAuditHandler_List_Error(t *testing.T) {
	repo := new(mockAuditRepo)
	repo.On("List", mock.Anything, mock.Anything).Return(nil, int64(0), errors.New("db error"))

	r := setupAuditRouter(repo)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/audit", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestAuditHandler_List_QueryParams(t *testing.T) {
	repo := new(mockAuditRepo)
	// 验证 filter 参数正确传递
	repo.On("List", mock.Anything, repository.PresaleAdminAuditFilter{
		Operator:   "lark:op1",
		Action:     "pause",
		TargetType: "round",
		TargetID:   "r1",
		StartTime:  0,
		EndTime:    0,
		Limit:      10,
		Offset:     5,
	}).Return([]model.PresaleAdminAudit{}, int64(0), nil)

	r := setupAuditRouter(repo)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/audit?operator=lark:op1&action=pause&target_type=round&target_id=r1&limit=10&offset=5", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	repo.AssertExpectations(t)
}

// interface compliance
var _ repository.PresaleAdminAuditRepository = (*mockAuditRepo)(nil)
