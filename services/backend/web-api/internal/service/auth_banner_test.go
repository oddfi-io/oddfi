package service

import (
	"context"
	"testing"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"

	"github.com/shopspring/decimal"
)

type bannerRepoStub struct {
	repository.UserRepo
	createBannerBetOrderFn      func(ctx context.Context, userID uint64, req *model.BannerBetPlaceRequest, stake decimal.Decimal, odds decimal.Decimal) (*model.BannerBetPlaceResponse, error)
	getBannerBetHoldingByUserID func(ctx context.Context, userID uint64) (*model.BannerBetHoldingResponse, error)
	getAssetLedgersByUserIDFn   func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error)
	getBetHoldingByOrdersFn     func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error)
	getBannerBetByOrdersFn      func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error)
	getClaimedBetIDsFn          func(ctx context.Context, userID uint64, betIDs []uint64) (map[uint64]struct{}, error)
	getWithdrawRecordsByOrders  func(ctx context.Context, userID uint64, orderSns []string) ([]model.WithdrawRecord, error)
}

// CreateBannerBetOrder 测试桩转发到注入函数，便于断言 service 层入参。
func (s *bannerRepoStub) CreateBannerBetOrder(ctx context.Context, userID uint64, req *model.BannerBetPlaceRequest, stake decimal.Decimal, odds decimal.Decimal) (*model.BannerBetPlaceResponse, error) {
	return s.createBannerBetOrderFn(ctx, userID, req, stake, odds)
}

// GetBannerBetHoldingByUserID 测试桩转发查询逻辑。
func (s *bannerRepoStub) GetBannerBetHoldingByUserID(ctx context.Context, userID uint64) (*model.BannerBetHoldingResponse, error) {
	return s.getBannerBetHoldingByUserID(ctx, userID)
}

// GetAssetLedgersByUserID 测试桩转发资产流水查询。
func (s *bannerRepoStub) GetAssetLedgersByUserID(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
	return s.getAssetLedgersByUserIDFn(ctx, userID, param, needBalance)
}

// GetBetHoldingByOrders 测试桩转发普通注单详情查询。
func (s *bannerRepoStub) GetBetHoldingByOrders(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
	return s.getBetHoldingByOrdersFn(ctx, orders)
}

// GetBannerBetHoldingByOrders 测试桩转发 Banner 注单详情查询。
func (s *bannerRepoStub) GetBannerBetHoldingByOrders(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
	return s.getBannerBetByOrdersFn(ctx, orders)
}

// GetClaimedBetIDsByUserIDAndBetIDs 测试桩默认返回空，便于 History 用例只关注各自断言的过滤逻辑。
func (s *bannerRepoStub) GetClaimedBetIDsByUserIDAndBetIDs(ctx context.Context, userID uint64, betIDs []uint64) (map[uint64]struct{}, error) {
	if s.getClaimedBetIDsFn == nil {
		return map[uint64]struct{}{}, nil
	}
	return s.getClaimedBetIDsFn(ctx, userID, betIDs)
}

// GetWithdrawRecordsByUserIDAndOrderSns 测试桩默认返回空，避免非提现 History 用例被无关依赖打断。
func (s *bannerRepoStub) GetWithdrawRecordsByUserIDAndOrderSns(ctx context.Context, userID uint64, orderSns []string) ([]model.WithdrawRecord, error) {
	if s.getWithdrawRecordsByOrders == nil {
		return []model.WithdrawRecord{}, nil
	}
	return s.getWithdrawRecordsByOrders(ctx, userID, orderSns)
}

// TestBannerBetPlaceSuccess 验证 Banner 下单会做字段归一化并正确传给 repo。
func TestBannerBetPlaceSuccess(t *testing.T) {
	var gotUserID uint64
	var gotReq *model.BannerBetPlaceRequest
	var gotStake decimal.Decimal
	var gotOdds decimal.Decimal

	svc := &authService{
		userRepo: &bannerRepoStub{
			createBannerBetOrderFn: func(ctx context.Context, userID uint64, req *model.BannerBetPlaceRequest, stake decimal.Decimal, odds decimal.Decimal) (*model.BannerBetPlaceResponse, error) {
				gotUserID = userID
				gotReq = req
				gotStake = stake
				gotOdds = odds
				return &model.BannerBetPlaceResponse{
					BetID:       88,
					Status:      "SUCCESS",
					BannerCode:  req.BannerCode,
					MarketID:    req.MarketID,
					SelectionID: req.SelectionID,
					Stake:       stake,
					Odds:        odds,
					Payout:      stake.Mul(odds),
				}, nil
			},
			getBannerBetHoldingByUserID: func(ctx context.Context, userID uint64) (*model.BannerBetHoldingResponse, error) {
				return nil, nil
			},
		},
	}

	resp, err := svc.BannerBetPlace(context.Background(), 1001, &model.BannerBetPlaceRequest{
		BannerCode:  " b1 ",
		MarketID:    11,
		SelectionID: 22,
		Market:      " champion_winner ",
		Selection:   " Argentina ",
		Stake:       "12.50",
		Odds:        "3.20",
		RefID:       " banner-ref-1 ",
	})
	if err != nil {
		t.Fatalf("BannerBetPlace() error = %v", err)
	}
	if resp == nil || resp.BetID != 88 {
		t.Fatalf("BannerBetPlace() unexpected resp = %+v", resp)
	}
	if gotUserID != 1001 {
		t.Fatalf("got user id = %d, want 1001", gotUserID)
	}
	if gotReq == nil {
		t.Fatal("repo request should not be nil")
	}
	if gotReq.BannerCode != "B1" {
		t.Fatalf("got banner code = %q, want B1", gotReq.BannerCode)
	}
	if gotReq.Market != "champion_winner" {
		t.Fatalf("got market = %q, want champion_winner", gotReq.Market)
	}
	if gotReq.Selection != "Argentina" {
		t.Fatalf("got selection = %q, want Argentina", gotReq.Selection)
	}
	if gotReq.RefID != "banner-ref-1" {
		t.Fatalf("got ref id = %q, want banner-ref-1", gotReq.RefID)
	}
	if !gotStake.Equal(decimal.RequireFromString("12.50")) {
		t.Fatalf("got stake = %s, want 12.50", gotStake)
	}
	if !gotOdds.Equal(decimal.RequireFromString("3.20")) {
		t.Fatalf("got odds = %s, want 3.20", gotOdds)
	}
}

// TestBannerBetPlaceRejectsInvalidBannerCode 验证非法 Banner 编码会被直接拦截。
func TestBannerBetPlaceRejectsInvalidBannerCode(t *testing.T) {
	svc := &authService{}

	_, err := svc.BannerBetPlace(context.Background(), 1001, &model.BannerBetPlaceRequest{
		BannerCode:  "B8",
		MarketID:    11,
		SelectionID: 22,
		Market:      "champion_winner",
		Selection:   "Argentina",
		Stake:       "12.50",
		Odds:        "3.20",
		RefID:       "banner-ref-1",
	})
	if err == nil || err.Error() != "invalid banner_code" {
		t.Fatalf("expected invalid banner_code error, got %v", err)
	}
}

// TestGetBannerBetHolding 验证查询接口会正确透传 repo 结果。
func TestGetBannerBetHolding(t *testing.T) {
	svc := &authService{
		userRepo: &bannerRepoStub{
			createBannerBetOrderFn: func(ctx context.Context, userID uint64, req *model.BannerBetPlaceRequest, stake decimal.Decimal, odds decimal.Decimal) (*model.BannerBetPlaceResponse, error) {
				return nil, nil
			},
			getBannerBetHoldingByUserID: func(ctx context.Context, userID uint64) (*model.BannerBetHoldingResponse, error) {
				return &model.BannerBetHoldingResponse{
					UserID: userID,
					Results: []model.BannerBetHoldingItem{
						{BetID: 1, BannerCode: "B2", Selection: "RONALDO"},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBannerBetHolding(context.Background(), 1001)
	if err != nil {
		t.Fatalf("GetBannerBetHolding() error = %v", err)
	}
	if resp == nil || resp.UserID != 1001 || len(resp.Results) != 1 {
		t.Fatalf("GetBannerBetHolding() unexpected resp = %+v", resp)
	}
}

// TestGetAssetLedgerWithBannerBet 验证 banner_single 流水会带回真实注单详情。
func TestGetAssetLedgerWithBannerBet(t *testing.T) {
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeBannerSingle,
							RefID:        "77",
						},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				return &model.BetHoldingResponse{}, nil
			},
			getBannerBetByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{
							Id:         77,
							Type:       model.AssetTypeBannerSingle,
							MarketType: "champion_winner",
							Selection:  "Argentina",
							Odds:       "3.25",
						},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetAssetLedger(context.Background(), 1001, model.AssetLedgerRequest{})
	if err != nil {
		t.Fatalf("GetAssetLedger() error = %v", err)
	}
	if resp == nil || len(resp.AssetLedgers) != 1 {
		t.Fatalf("GetAssetLedger() unexpected resp = %+v", resp)
	}
	if resp.AssetLedgers[0].EventInfo == nil {
		t.Fatal("expected banner event info to be attached")
	}
	if resp.AssetLedgers[0].EventInfo.Selection != "Argentina" {
		t.Fatalf("got selection = %q, want Argentina", resp.AssetLedgers[0].EventInfo.Selection)
	}
}
