package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"everything_finance/org/web-api/internal/handler"
	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ===========================
// Mock PresaleConfigService
// ===========================

type mockPresaleConfigService struct {
	getConfigFunc func(ctx context.Context) (*service.ConfigResponse, error)
}

func (m *mockPresaleConfigService) GetConfig(ctx context.Context) (*service.ConfigResponse, error) {
	if m.getConfigFunc != nil {
		return m.getConfigFunc(ctx)
	}
	return &service.ConfigResponse{
		Vault: service.VaultInfo{
			DepositAddress:       "0xinvaultaddr",
			Chain:                "BSC",
			ChainID:              56,
			Asset:                "USDT",
			UsdtAddress:          "0x55d398326f99059fF775485246999027B3197955",
			MinSubscribeUsd:      "1000",
			TotalRaisedUsd:       "8420000",
			TotalTargetUsd:       "20000000",
			TgeTs:                1749571200000,
			TgeOpenPriceUsd:      "0.1",
			Audit:                "CertiK",
			BoundaryToleranceMin: 5,
		},
		Rounds: []service.RoundInfo{
			{
				ID:                "seed",
				Name:              "种子轮",
				RoundType:         "private",
				Price:             "0.03",
				Supply:            "10000000",
				Sold:              "3450000",
				Raised:            "103500",
				TargetRaiseUsd:    "300000",
				SoldPercent:       34.5,
				TgeReleasePct:     "10",
				LinearReleaseDays: 90,
				ReferralRewardPct: "10.0000",
				TgeDiscountPct:    "70",
				StartTs:           1747843200000,
				EndTs:             1749571200000,
				Status:            model.RoundStatusActive,
			},
		},
		ServerTs: 1747900000000,
	}, nil
}

// ===========================
// Mock PresaleDepositService
// ===========================

type mockPresaleDepositService struct {
	reportTxFunc    func(ctx context.Context, userID uint64, eoa string, req service.ReportTxRequest) (*service.ReportTxResponse, error)
	getByTxHashFunc func(ctx context.Context, userID uint64, txHash string) (*service.DepositDetail, error)
	listByUserFunc  func(ctx context.Context, userID uint64, status string, page, size int) (*service.DepositListResponse, error)
	getPositionFunc func(ctx context.Context, userID uint64) (*service.PositionResponse, error)
}

func (m *mockPresaleDepositService) ReportTx(ctx context.Context, userID uint64, eoa string, req service.ReportTxRequest) (*service.ReportTxResponse, error) {
	if m.reportTxFunc != nil {
		return m.reportTxFunc(ctx, userID, eoa, req)
	}
	return &service.ReportTxResponse{DepositID: "123", Status: "pending", RoundID: "seed"}, nil
}

func (m *mockPresaleDepositService) GetByTxHash(ctx context.Context, userID uint64, txHash string) (*service.DepositDetail, error) {
	if m.getByTxHashFunc != nil {
		return m.getByTxHashFunc(ctx, userID, txHash)
	}
	refEoa := "0xref"
	confirmedAt := int64(1747900100000)
	return &service.DepositDetail{
		DepositID:         "123",
		TxHash:            txHash,
		Status:            "confirmed",
		RoundID:           "seed",
		AmountUsdt:        "1000",
		PriceUsd:          "0.03",
		SharesOdd:         "33333.333333",
		ReferrerEoa:       &refEoa,
		ReferralRewardOdd: "3333.333333",
		BlockNumber:       39581234,
		BlockTimestamp:    1747900000000,
		Source:            "frontend",
		ConfirmedAt:       &confirmedAt,
		CreatedAt:         1747900000000,
	}, nil
}

func (m *mockPresaleDepositService) ListByUser(ctx context.Context, userID uint64, status string, page, size int) (*service.DepositListResponse, error) {
	if m.listByUserFunc != nil {
		return m.listByUserFunc(ctx, userID, status, page, size)
	}
	return &service.DepositListResponse{
		List:  []service.DepositListItem{},
		Total: 0,
		Page:  page,
		Size:  size,
	}, nil
}

func (m *mockPresaleDepositService) GetPosition(ctx context.Context, userID uint64) (*service.PositionResponse, error) {
	if m.getPositionFunc != nil {
		return m.getPositionFunc(ctx, userID)
	}
	return &service.PositionResponse{
		Holdings:         "33333.33",
		HoldingsBySource: map[string]string{"invest": "30000", "referral": "3333.33"},
		InvestedUsd:      "1000",
		LockedPriceAvg:   "0.03333",
		PerRound: []service.PerRoundItem{
			{RoundID: "seed", TotalOdd: "30000", InvestedUsd: "900", LockedPriceAvg: "0.03", ReferralOdd: "3333.33"},
		},
	}, nil
}

func (m *mockPresaleDepositService) ConfirmDeposit(_ context.Context, _ *gorm.DB, _ uint64, _ int64) error {
	return nil
}

func (m *mockPresaleDepositService) FindRound(_ context.Context, _ int64) (*model.PresaleRound, error) {
	return nil, nil
}

func (m *mockPresaleDepositService) NotifyDepositConfirmed(_ *model.PresaleDeposit) {}

// ===========================
// 测试路由辅助
// ===========================

// setupPresaleRouter 构造带 JWT context 的测试路由
func setupPresaleRouter(
	configSvc service.PresaleConfigService,
	depositSvc service.PresaleDepositService,
	userID uint64,
) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := handler.NewPresaleHandler(configSvc, depositSvc)

	// 模拟 JWT middleware 注入 user_id + address
	authMW := func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Set("address", "0xuseraddr")
		c.Next()
	}

	// 公开接口：不注入 auth
	r.GET("/api/v1/presale/config", h.GetConfig)

	// JWT 保护接口
	deposit := r.Group("/api/v1/presale/deposit")
	deposit.Use(authMW)
	deposit.POST("/report-tx", h.ReportTx)
	deposit.GET("/list", h.ListDeposits)
	deposit.GET("/:txHash", h.GetDepositByTxHash)

	position := r.Group("/api/v1/presale")
	position.Use(authMW)
	position.GET("/position", h.GetPosition)

	return r
}

// parsePresaleResponse 解析统一响应体
func parsePresaleResponse(t *testing.T, body *bytes.Buffer) map[string]interface{} {
	t.Helper()
	var resp map[string]interface{}
	if err := json.NewDecoder(body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response body: %v — body: %s", err, body.String())
	}
	return resp
}

// ===========================
// GET /api/v1/presale/config 测试
// ===========================

// TestPresaleHandler_GetConfig_HappyPath 验证公开 config 接口返回 200 + 正确字段
func TestPresaleHandler_GetConfig_HappyPath(t *testing.T) {
	r := setupPresaleRouter(&mockPresaleConfigService{}, &mockPresaleDepositService{}, 0)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/presale/config", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	resp := parsePresaleResponse(t, w.Body)
	if code, _ := resp["code"].(float64); code != 0 {
		t.Errorf("expected code=0, got %v", resp["code"])
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("data is not an object: %T", resp["data"])
	}
	vault, ok := data["vault"].(map[string]interface{})
	if !ok {
		t.Fatalf("vault is not an object")
	}
	if vault["depositAddress"] != "0xinvaultaddr" {
		t.Errorf("vault.depositAddress = %v, want 0xinvaultaddr", vault["depositAddress"])
	}
	rounds, ok := data["rounds"].([]interface{})
	if !ok || len(rounds) == 0 {
		t.Fatalf("rounds should be non-empty array")
	}
	round := rounds[0].(map[string]interface{})
	if round["id"] != "seed" {
		t.Errorf("round.id = %v, want seed", round["id"])
	}
	if round["tgeDiscountPct"] != "70" {
		t.Errorf("round.tgeDiscountPct = %v, want 70", round["tgeDiscountPct"])
	}
}

// TestPresaleHandler_GetConfig_ServiceError 验证 config service 错误时返回 500
func TestPresaleHandler_GetConfig_ServiceError(t *testing.T) {
	configSvc := &mockPresaleConfigService{
		getConfigFunc: func(_ context.Context) (*service.ConfigResponse, error) {
			return nil, service.ErrCodeGenExhausted // 任意内部错误
		},
	}
	r := setupPresaleRouter(configSvc, &mockPresaleDepositService{}, 0)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/presale/config", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// ===========================
// POST /api/v1/presale/deposit/report-tx 测试
// ===========================

// TestPresaleHandler_ReportTx_HappyPath 验证正常上报返回 200 + depositId
func TestPresaleHandler_ReportTx_HappyPath(t *testing.T) {
	r := setupPresaleRouter(&mockPresaleConfigService{}, &mockPresaleDepositService{}, 1)

	body, _ := json.Marshal(map[string]interface{}{
		"txHash":             "0xabc123",
		"expectedRoundId":    "seed",
		"expectedAmountUsdt": "1000",
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presale/deposit/report-tx", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	resp := parsePresaleResponse(t, w.Body)
	if code, _ := resp["code"].(float64); code != 0 {
		t.Errorf("expected code=0, got %v", resp["code"])
	}
	data := resp["data"].(map[string]interface{})
	if data["depositId"] != "123" {
		t.Errorf("depositId = %v, want 123", data["depositId"])
	}
	if data["status"] != "pending" {
		t.Errorf("status = %v, want pending", data["status"])
	}
}

// TestPresaleHandler_ReportTx_InvalidTx 验证 ErrInvalidTx → 40006
func TestPresaleHandler_ReportTx_InvalidTx(t *testing.T) {
	depositSvc := &mockPresaleDepositService{
		reportTxFunc: func(_ context.Context, _ uint64, _ string, _ service.ReportTxRequest) (*service.ReportTxResponse, error) {
			return nil, service.ErrInvalidTx
		},
	}
	r := setupPresaleRouter(&mockPresaleConfigService{}, depositSvc, 1)

	body, _ := json.Marshal(map[string]string{"txHash": "0xbad"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presale/deposit/report-tx", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
	resp := parsePresaleResponse(t, w.Body)
	if code, _ := resp["code"].(float64); int(code) != 40006 {
		t.Errorf("expected code=40006, got %v", resp["code"])
	}
}

// TestPresaleHandler_ReportTx_TxNotToVault 验证 ErrTxNotToVault → 40007
func TestPresaleHandler_ReportTx_TxNotToVault(t *testing.T) {
	depositSvc := &mockPresaleDepositService{
		reportTxFunc: func(_ context.Context, _ uint64, _ string, _ service.ReportTxRequest) (*service.ReportTxResponse, error) {
			return nil, service.ErrTxNotToVault
		},
	}
	r := setupPresaleRouter(&mockPresaleConfigService{}, depositSvc, 1)

	body, _ := json.Marshal(map[string]string{"txHash": "0xbad"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presale/deposit/report-tx", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
	resp := parsePresaleResponse(t, w.Body)
	if code, _ := resp["code"].(float64); int(code) != 40007 {
		t.Errorf("expected code=40007, got %v", resp["code"])
	}
}

// TestPresaleHandler_ReportTx_TxNotUsdt 验证 ErrTxNotUsdt → 40008
func TestPresaleHandler_ReportTx_TxNotUsdt(t *testing.T) {
	depositSvc := &mockPresaleDepositService{
		reportTxFunc: func(_ context.Context, _ uint64, _ string, _ service.ReportTxRequest) (*service.ReportTxResponse, error) {
			return nil, service.ErrTxNotUsdt
		},
	}
	r := setupPresaleRouter(&mockPresaleConfigService{}, depositSvc, 1)

	body, _ := json.Marshal(map[string]string{"txHash": "0xbad"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presale/deposit/report-tx", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
	resp := parsePresaleResponse(t, w.Body)
	if code, _ := resp["code"].(float64); int(code) != 40008 {
		t.Errorf("expected code=40008, got %v", resp["code"])
	}
}

// TestPresaleHandler_ReportTx_WalletMismatch 验证 ErrDepositWalletMismatch → 40902
func TestPresaleHandler_ReportTx_WalletMismatch(t *testing.T) {
	depositSvc := &mockPresaleDepositService{
		reportTxFunc: func(_ context.Context, _ uint64, _ string, _ service.ReportTxRequest) (*service.ReportTxResponse, error) {
			return nil, service.ErrDepositWalletMismatch
		},
	}
	r := setupPresaleRouter(&mockPresaleConfigService{}, depositSvc, 1)

	body, _ := json.Marshal(map[string]string{"txHash": "0xbad"})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presale/deposit/report-tx", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d", w.Code)
	}
	resp := parsePresaleResponse(t, w.Body)
	if code, _ := resp["code"].(float64); int(code) != 40902 {
		t.Errorf("expected code=40902, got %v", resp["code"])
	}
}

// TestPresaleHandler_ReportTx_MissingTxHash 验证缺少 txHash 返回 400
func TestPresaleHandler_ReportTx_MissingTxHash(t *testing.T) {
	r := setupPresaleRouter(&mockPresaleConfigService{}, &mockPresaleDepositService{}, 1)

	body, _ := json.Marshal(map[string]string{"expectedRoundId": "seed"}) // 缺少 txHash
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/presale/deposit/report-tx", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing txHash, got %d", w.Code)
	}
}

// ===========================
// GET /api/v1/presale/deposit/:txHash 测试
// ===========================

// TestPresaleHandler_GetDepositByTxHash_HappyPath 验证单笔查询返回 200 + 正确状态
func TestPresaleHandler_GetDepositByTxHash_HappyPath(t *testing.T) {
	r := setupPresaleRouter(&mockPresaleConfigService{}, &mockPresaleDepositService{}, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/presale/deposit/0xabc123", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	resp := parsePresaleResponse(t, w.Body)
	data := resp["data"].(map[string]interface{})
	if data["status"] != "confirmed" {
		t.Errorf("status = %v, want confirmed", data["status"])
	}
	if data["amountUsdt"] != "1000" {
		t.Errorf("amountUsdt = %v, want 1000", data["amountUsdt"])
	}
}

// TestPresaleHandler_GetDepositByTxHash_NotFound 验证 ErrDepositTxNotFound → 40405
func TestPresaleHandler_GetDepositByTxHash_NotFound(t *testing.T) {
	depositSvc := &mockPresaleDepositService{
		getByTxHashFunc: func(_ context.Context, _ uint64, _ string) (*service.DepositDetail, error) {
			return nil, service.ErrDepositTxNotFound
		},
	}
	r := setupPresaleRouter(&mockPresaleConfigService{}, depositSvc, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/presale/deposit/0xnotfound", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
	resp := parsePresaleResponse(t, w.Body)
	if code, _ := resp["code"].(float64); int(code) != 40405 {
		t.Errorf("expected code=40405, got %v", resp["code"])
	}
}

// ===========================
// GET /api/v1/presale/deposit/list 测试
// ===========================

// TestPresaleHandler_ListDeposits_HappyPath 验证列表接口返回 200 + 分页结构
func TestPresaleHandler_ListDeposits_HappyPath(t *testing.T) {
	r := setupPresaleRouter(&mockPresaleConfigService{}, &mockPresaleDepositService{}, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/presale/deposit/list?page=1&size=20", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	resp := parsePresaleResponse(t, w.Body)
	data := resp["data"].(map[string]interface{})
	if _, ok := data["list"]; !ok {
		t.Error("response.data should have 'list' field")
	}
	if _, ok := data["total"]; !ok {
		t.Error("response.data should have 'total' field")
	}
}

// TestPresaleHandler_ListDeposits_ServiceError 验证 service 错误返回 500
func TestPresaleHandler_ListDeposits_ServiceError(t *testing.T) {
	depositSvc := &mockPresaleDepositService{
		listByUserFunc: func(_ context.Context, _ uint64, _ string, _, _ int) (*service.DepositListResponse, error) {
			return nil, service.ErrCodeGenExhausted // 任意内部错误
		},
	}
	r := setupPresaleRouter(&mockPresaleConfigService{}, depositSvc, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/presale/deposit/list", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// ===========================
// GET /api/v1/presale/position 测试
// ===========================

// TestPresaleHandler_GetPosition_HappyPath 验证持仓接口返回 200 + holdings 字段
func TestPresaleHandler_GetPosition_HappyPath(t *testing.T) {
	r := setupPresaleRouter(&mockPresaleConfigService{}, &mockPresaleDepositService{}, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/presale/position", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	resp := parsePresaleResponse(t, w.Body)
	data := resp["data"].(map[string]interface{})
	if data["holdings"] != "33333.33" {
		t.Errorf("holdings = %v, want 33333.33", data["holdings"])
	}
	bySource, ok := data["holdingsBySource"].(map[string]interface{})
	if !ok {
		t.Fatalf("holdingsBySource should be object")
	}
	if bySource["invest"] != "30000" {
		t.Errorf("holdingsBySource.invest = %v, want 30000", bySource["invest"])
	}
	if data["lockedPriceAvg"] != "0.03333" {
		t.Errorf("lockedPriceAvg = %v, want 0.03333", data["lockedPriceAvg"])
	}
}

// TestPresaleHandler_GetPosition_ServiceError 验证 service 错误返回 500
func TestPresaleHandler_GetPosition_ServiceError(t *testing.T) {
	depositSvc := &mockPresaleDepositService{
		getPositionFunc: func(_ context.Context, _ uint64) (*service.PositionResponse, error) {
			return nil, service.ErrCodeGenExhausted
		},
	}
	r := setupPresaleRouter(&mockPresaleConfigService{}, depositSvc, 1)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/presale/position", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}
