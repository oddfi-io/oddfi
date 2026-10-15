package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"everything_finance/org/web-api/internal/handler"
	"everything_finance/org/web-api/internal/service"

	"github.com/gin-gonic/gin"
)

// ===========================
// Mock ReferralService
// ===========================

type mockReferralService struct {
	generateCodeFunc    func(ctx context.Context, userID uint64, eoa string) error
	bindReferralFunc    func(ctx context.Context, req service.BindReferralRequest) (*service.BindReferralResponse, error)
	getMyReferralFunc   func(ctx context.Context, userID uint64) (*service.MyReferralInfoResponse, error)
	listReferredFunc    func(ctx context.Context, userID uint64, business string, page, size int) (*service.ListReferredResponse, error)
}

func (m *mockReferralService) GenerateCodeForUser(ctx context.Context, userID uint64, eoa string) error {
	if m.generateCodeFunc != nil {
		return m.generateCodeFunc(ctx, userID, eoa)
	}
	return nil
}

func (m *mockReferralService) BindReferral(ctx context.Context, req service.BindReferralRequest) (*service.BindReferralResponse, error) {
	if m.bindReferralFunc != nil {
		return m.bindReferralFunc(ctx, req)
	}
	return &service.BindReferralResponse{ReferrerEoa: "0xref", ReferrerCode: "0xABCDEF", BoundAt: 1000000}, nil
}

func (m *mockReferralService) GetMyReferralInfo(ctx context.Context, userID uint64) (*service.MyReferralInfoResponse, error) {
	if m.getMyReferralFunc != nil {
		return m.getMyReferralFunc(ctx, userID)
	}
	return &service.MyReferralInfoResponse{
		MyCode:    "0xABC123",
		ShareLink: "https://app.oddfi.com/invest?ref=0xABC123",
		Referrer:  nil,
		Stats:     service.ReferralStats{InvitedCount: 0, TotalRewardOdd: "0"},
	}, nil
}

func (m *mockReferralService) ListReferred(ctx context.Context, userID uint64, business string, page, size int) (*service.ListReferredResponse, error) {
	if m.listReferredFunc != nil {
		return m.listReferredFunc(ctx, userID, business, page, size)
	}
	return &service.ListReferredResponse{List: []service.ReferredUserItem{}, Total: 0}, nil
}

// ===========================
// 测试辅助
// ===========================

// setupTestRouter 构造带 user_id context 的 Gin 测试路由
func setupTestRouter(svc service.ReferralService, userID uint64) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := handler.NewReferralHandler(svc)

	// 模拟 JWT middleware 注入 user_id
	authMiddleware := func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Set("address", "0xtest")
		c.Next()
	}

	g := r.Group("/api/v1/referral")
	g.Use(authMiddleware)
	g.GET("/me", h.GetMyReferralInfo)
	g.POST("/bind", h.BindReferral)
	g.GET("/list", h.GetReferredList)

	return r
}

// parseResponse 解析统一响应体
func parseResponse(t *testing.T, body *bytes.Buffer) map[string]interface{} {
	t.Helper()
	var resp map[string]interface{}
	if err := json.NewDecoder(body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return resp
}

// ===========================
// GET /api/v1/referral/me 测试
// ===========================

// TestReferralHandler_GetMyReferralInfo_HappyPath 验证正常返回邀请码和统计信息
func TestReferralHandler_GetMyReferralInfo_HappyPath(t *testing.T) {
	svc := &mockReferralService{}
	r := setupTestRouter(svc, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/referral/me", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	resp := parseResponse(t, w.Body)
	if code, _ := resp["code"].(float64); code != 0 {
		t.Errorf("expected code=0, got %v", resp["code"])
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data to be object, got %T", resp["data"])
	}
	if data["myCode"] != "0xABC123" {
		t.Errorf("myCode = %v, want 0xABC123", data["myCode"])
	}
	if data["referrer"] != nil {
		t.Errorf("referrer should be nil for unbound user, got %v", data["referrer"])
	}
}

// TestReferralHandler_GetMyReferralInfo_ServiceError 验证 service 错误时返回 500
func TestReferralHandler_GetMyReferralInfo_ServiceError(t *testing.T) {
	svc := &mockReferralService{
		getMyReferralFunc: func(_ context.Context, _ uint64) (*service.MyReferralInfoResponse, error) {
			return nil, service.ErrCodeGenExhausted // 任意内部错误
		},
	}
	r := setupTestRouter(svc, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/referral/me", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", w.Code)
	}
}

// ===========================
// POST /api/v1/referral/bind 测试
// ===========================

// TestReferralHandler_BindReferral_HappyPath 验证正常绑定返回 200 + referrerEoa
func TestReferralHandler_BindReferral_HappyPath(t *testing.T) {
	svc := &mockReferralService{}
	r := setupTestRouter(svc, 1)

	body, _ := json.Marshal(map[string]string{
		"code":     "0xABCDEF",
		"source":   "link",
		"business": "presale",
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/referral/bind", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d body=%s", w.Code, w.Body.String())
	}
	resp := parseResponse(t, w.Body)
	if code, _ := resp["code"].(float64); code != 0 {
		t.Errorf("expected code=0, got %v", resp["code"])
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data object, got %T", resp["data"])
	}
	if data["referrerEoa"] == "" {
		t.Errorf("referrerEoa should not be empty")
	}
}

// TestReferralHandler_BindReferral_SelfReferral 验证自邀返回 40004
func TestReferralHandler_BindReferral_SelfReferral(t *testing.T) {
	svc := &mockReferralService{
		bindReferralFunc: func(_ context.Context, _ service.BindReferralRequest) (*service.BindReferralResponse, error) {
			return nil, service.ErrSelfReferral
		},
	}
	r := setupTestRouter(svc, 1)

	body, _ := json.Marshal(map[string]string{"code": "0xABCDEF", "source": "manual", "business": "presale"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/referral/bind", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
	resp := parseResponse(t, w.Body)
	if code, _ := resp["code"].(float64); int(code) != 40004 {
		t.Errorf("expected code=40004, got %v", resp["code"])
	}
}

// TestReferralHandler_BindReferral_InvalidCode 验证不存在的邀请码返回 40404
func TestReferralHandler_BindReferral_InvalidCode(t *testing.T) {
	svc := &mockReferralService{
		bindReferralFunc: func(_ context.Context, _ service.BindReferralRequest) (*service.BindReferralResponse, error) {
			return nil, service.ErrInvalidReferralCode
		},
	}
	r := setupTestRouter(svc, 1)

	body, _ := json.Marshal(map[string]string{"code": "0xNOPE00", "source": "manual", "business": "presale"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/referral/bind", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", w.Code)
	}
	resp := parseResponse(t, w.Body)
	if code, _ := resp["code"].(float64); int(code) != 40404 {
		t.Errorf("expected code=40404, got %v", resp["code"])
	}
}

// TestReferralHandler_BindReferral_AlreadyBound 验证已绑定返回 40903
func TestReferralHandler_BindReferral_AlreadyBound(t *testing.T) {
	svc := &mockReferralService{
		bindReferralFunc: func(_ context.Context, _ service.BindReferralRequest) (*service.BindReferralResponse, error) {
			return nil, service.ErrAlreadyBound
		},
	}
	r := setupTestRouter(svc, 1)

	body, _ := json.Marshal(map[string]string{"code": "0xABCDEF", "source": "link", "business": "presale"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/referral/bind", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Errorf("expected status 409, got %d", w.Code)
	}
	resp := parseResponse(t, w.Body)
	if code, _ := resp["code"].(float64); int(code) != 40903 {
		t.Errorf("expected code=40903, got %v", resp["code"])
	}
}

// TestReferralHandler_BindReferral_MissingCode 验证缺少 code 字段时返回 400
func TestReferralHandler_BindReferral_MissingCode(t *testing.T) {
	svc := &mockReferralService{}
	r := setupTestRouter(svc, 1)

	body, _ := json.Marshal(map[string]string{"source": "link", "business": "presale"}) // 缺少 code
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/referral/bind", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for missing code, got %d", w.Code)
	}
}

// ===========================
// GET /api/v1/referral/list 测试
// ===========================

// TestReferralHandler_GetReferredList_HappyPath 验证列表接口正常返回
func TestReferralHandler_GetReferredList_HappyPath(t *testing.T) {
	svc := &mockReferralService{}
	r := setupTestRouter(svc, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/referral/list?page=1&size=20", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	resp := parseResponse(t, w.Body)
	if code, _ := resp["code"].(float64); code != 0 {
		t.Errorf("expected code=0, got %v", resp["code"])
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data object, got %T", resp["data"])
	}
	if _, exists := data["list"]; !exists {
		t.Errorf("response data should have 'list' field")
	}
	if _, exists := data["total"]; !exists {
		t.Errorf("response data should have 'total' field")
	}
}

// TestReferralHandler_GetReferredList_ServiceError 验证列表接口 service 错误时返回 500
func TestReferralHandler_GetReferredList_ServiceError(t *testing.T) {
	svc := &mockReferralService{
		listReferredFunc: func(_ context.Context, _ uint64, _ string, _, _ int) (*service.ListReferredResponse, error) {
			return nil, service.ErrCodeGenExhausted // 任意内部错误
		},
	}
	r := setupTestRouter(svc, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/referral/list", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", w.Code)
	}
}
