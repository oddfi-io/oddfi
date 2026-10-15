package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/response"
	"everything_finance/org/web-api/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type bannerAuthServiceStub struct {
	service.AuthService
	bannerBetPlaceFn      func(ctx context.Context, userId uint64, req *model.BannerBetPlaceRequest) (*model.BannerBetPlaceResponse, error)
	getBannerBetHoldingFn func(ctx context.Context, userId uint64) (*model.BannerBetHoldingResponse, error)
	getBetHistoryFn       func(ctx context.Context, userId uint64, param model.GetBetHistoryRequest) (*model.BetHistoryResponse, error)
	cancelBalanceFn       func(ctx context.Context, userId uint64, betids []uint64) (*model.ModifyBalanceRespnse, error)
	claimBetFn            func(ctx context.Context, userId uint64, betid uint64, expectedAmount decimal.Decimal) (*model.BetClaimResponse, error)
}

// BannerBetPlace 测试桩转发到注入函数，便于验证 handler 是否正确调用 service。
func (s *bannerAuthServiceStub) BannerBetPlace(ctx context.Context, userId uint64, req *model.BannerBetPlaceRequest) (*model.BannerBetPlaceResponse, error) {
	return s.bannerBetPlaceFn(ctx, userId, req)
}

// GetBannerBetHolding 测试桩转发 Banner 持仓查询。
func (s *bannerAuthServiceStub) GetBannerBetHolding(ctx context.Context, userId uint64) (*model.BannerBetHoldingResponse, error) {
	return s.getBannerBetHoldingFn(ctx, userId)
}

// GetBetHistory 测试桩转发 History 查询，便于验证 handler 的参数归一化。
func (s *bannerAuthServiceStub) GetBetHistory(ctx context.Context, userId uint64, param model.GetBetHistoryRequest) (*model.BetHistoryResponse, error) {
	return s.getBetHistoryFn(ctx, userId, param)
}

// CancelBalance 测试桩用于验证撤单 handler 只使用鉴权上下文里的用户身份。
func (s *bannerAuthServiceStub) CancelBalance(ctx context.Context, userId uint64, betids []uint64) (*model.ModifyBalanceRespnse, error) {
	return s.cancelBalanceFn(ctx, userId, betids)
}

// ClaimBet 测试桩用于验证领取 handler 会把失败状态透传给前端。
func (s *bannerAuthServiceStub) ClaimBet(ctx context.Context, userId uint64, betid uint64, expectedAmount decimal.Decimal) (*model.BetClaimResponse, error) {
	return s.claimBetFn(ctx, userId, betid, expectedAmount)
}

// TestBannerBetPlaceUnauthorized 验证未登录请求会被鉴权拦截。
func TestBannerBetPlaceUnauthorized(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	reqBody := []byte(`{"banner_code":"B1","market_id":1,"selection_id":2,"market":"champion_winner","selection":"Argentina","stake":"10","odds":"2.5","ref_id":"banner-ref"}`)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/account/banner_bet_place", bytes.NewReader(reqBody))
	ctx.Request.Header.Set("Content-Type", "application/json")

	h := NewAuthHandler(&bannerAuthServiceStub{})
	h.BannerBetPlace(ctx)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}

	var resp response.Response
	if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Code != response.CodeUnauthorized {
		t.Fatalf("response code = %d, want %d", resp.Code, response.CodeUnauthorized)
	}
}

// TestBannerBetPlaceSuccess 验证 handler 能正确绑定请求并返回成功响应。
func TestBannerBetPlaceSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	reqBody := []byte(`{"banner_code":"B1","market_id":1,"selection_id":2,"market":"champion_winner","selection":"Argentina","stake":"10","odds":"2.5","ref_id":"banner-ref"}`)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/account/banner_bet_place", bytes.NewReader(reqBody))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("user_id", uint64(1001))

	h := NewAuthHandler(&bannerAuthServiceStub{
		bannerBetPlaceFn: func(ctx context.Context, userId uint64, req *model.BannerBetPlaceRequest) (*model.BannerBetPlaceResponse, error) {
			if userId != 1001 {
				t.Fatalf("got user id = %d, want 1001", userId)
			}
			return &model.BannerBetPlaceResponse{
				BetID:       9,
				Status:      "SUCCESS",
				BannerCode:  req.BannerCode,
				MarketID:    req.MarketID,
				SelectionID: req.SelectionID,
				Stake:       decimal.RequireFromString(req.Stake),
				Odds:        decimal.RequireFromString(req.Odds),
				Payout:      decimal.RequireFromString("25"),
			}, nil
		},
	})
	h.BannerBetPlace(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var resp response.Response
	if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Code != response.CodeSuccess {
		t.Fatalf("response code = %d, want %d", resp.Code, response.CodeSuccess)
	}
}

// TestBannerBetHoldingSuccess 验证 Banner 持仓查询接口的成功链路。
func TestBannerBetHoldingSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/account/banner_bet_holding", nil)
	ctx.Set("user_id", uint64(1001))

	h := NewAuthHandler(&bannerAuthServiceStub{
		getBannerBetHoldingFn: func(ctx context.Context, userId uint64) (*model.BannerBetHoldingResponse, error) {
			return &model.BannerBetHoldingResponse{
				UserID: userId,
				Results: []model.BannerBetHoldingItem{
					{BetID: 7, BannerCode: "B3", Selection: "Messi"},
				},
			}, nil
		},
	})
	h.BannerBetHolding(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}
