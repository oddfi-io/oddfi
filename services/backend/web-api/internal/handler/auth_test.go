package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// TestGetHistoryNormalizesBetType 验证 handler 会把逗号分隔的 type 参数归一化为标准枚举。
func TestGetHistoryNormalizesBetType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/account/portfolio/history?type=cancel_bet,bet_won,bet_lost,bet_banner&order_by=created_at&sort=desc&page_size=60", nil)
	ctx.Set("user_id", uint64(1001))

	h := NewAuthHandler(&bannerAuthServiceStub{
		getBetHistoryFn: func(ctx context.Context, userId uint64, param model.GetBetHistoryRequest) (*model.BetHistoryResponse, error) {
			if userId != 1001 {
				t.Fatalf("user id = %d, want 1001", userId)
			}
			wantType := model.HistoryTypeBetCancel + "," + model.HistoryTypeBetWon + "," + model.HistoryTypeBetLost + "," + model.HistoryTypeBetBanner
			if param.Type != wantType {
				t.Fatalf("type = %q, want %q", param.Type, wantType)
			}
			if param.PageSize != 50 {
				t.Fatalf("page_size = %d, want 50", param.PageSize)
			}
			return &model.BetHistoryResponse{AssetLedgers: []model.AssetLedgerResponse{}}, nil
		},
	})
	h.GetHistory(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

// TestBetCancelUsesAuthenticatedUserID 验证撤单请求不再要求前端传 user_id，并且资金操作使用鉴权上下文中的用户。
func TestBetCancelUsesAuthenticatedUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	reqBody := []byte(`{"bet_ids":[11,12]}`)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/account/bet_cancel", bytes.NewReader(reqBody))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("user_id", uint64(1001))

	called := false
	h := NewAuthHandler(&bannerAuthServiceStub{
		cancelBalanceFn: func(ctx context.Context, userId uint64, betids []uint64) (*model.ModifyBalanceRespnse, error) {
			called = true
			if userId != 1001 {
				t.Fatalf("user id = %d, want 1001", userId)
			}
			if len(betids) != 2 || betids[0] != 11 || betids[1] != 12 {
				t.Fatalf("bet ids = %v, want [11 12]", betids)
			}
			return &model.ModifyBalanceRespnse{
				Msg: "SUCCESS",
				Results: []model.BetResult{
					{BetID: 11, Status: "SUCCESS"},
					{BetID: 12, Status: "SUCCESS"},
				},
			}, nil
		},
	})
	h.BetCancle(ctx)

	if !called {
		t.Fatal("CancelBalance was not called")
	}
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

// TestBetClaimReturnsFailureStatus 验证领取失败时 handler 不会丢掉 repository 返回的失败状态。
func TestBetClaimReturnsFailureStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	reqBody := []byte(`{"bet_id":11,"amount":"99"}`)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/account/bet_claim", bytes.NewReader(reqBody))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("user_id", uint64(1001))

	h := NewAuthHandler(&bannerAuthServiceStub{
		claimBetFn: func(ctx context.Context, userId uint64, betid uint64, expectedAmount decimal.Decimal) (*model.BetClaimResponse, error) {
			if userId != 1001 {
				t.Fatalf("user id = %d, want 1001", userId)
			}
			if betid != 11 {
				t.Fatalf("bet id = %d, want 11", betid)
			}
			return &model.BetClaimResponse{
				BetID:  betid,
				Status: model.BetClaimStatusClaimAmountMismatch,
			}, errors.New(model.BetClaimStatusClaimAmountMismatch)
		},
	})
	h.BetClaim(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}

	var resp struct {
		Code    int                    `json:"code"`
		Message string                 `json:"message"`
		Data    model.BetClaimResponse `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Code != response.CodeInvalidParams {
		t.Fatalf("response code = %d, want %d", resp.Code, response.CodeInvalidParams)
	}
	if resp.Data.Status != model.BetClaimStatusClaimAmountMismatch {
		t.Fatalf("claim status = %q, want %q", resp.Data.Status, model.BetClaimStatusClaimAmountMismatch)
	}
}
