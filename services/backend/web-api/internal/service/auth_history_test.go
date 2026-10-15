package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"everything_finance/org/web-api/internal/model"

	"github.com/shopspring/decimal"
)

// TestGetBetHistorySettledLostByStatusAlias 覆盖线上前端可能传 status=settled 的兼容路径，
// 同时防止 result=lost 再次被无条件过滤，导致输单在结算页查不到。
func TestGetBetHistorySettledLostByStatusAlias(t *testing.T) {
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeSingle,
							RefID:        "11",
							CreatedAt:    time.Now(),
						},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 1 || orders[0] != 11 {
					t.Fatalf("orders = %v, want [11]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{
							Id:           11,
							OddID:        10001,
							Stake:        decimal.RequireFromString("10"),
							Status:       "LOST",
							Type:         model.AssetTypeSingle,
							Odds:         "2.10",
							Payout:       "21",
							ActualPayout: "0",
							FixtureName:  "Team A vs Team B",
						},
					},
				}, nil
			},
			getBannerBetByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				return &model.BetHoldingResponse{}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Status:  "settled",
		Result:  "lost",
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 1 || len(resp.AssetLedgers) != 1 {
		t.Fatalf("got total=%d len=%d, want 1", resp.Total, len(resp.AssetLedgers))
	}
	if resp.AssetLedgers[0].EventInfo == nil {
		t.Fatal("event_info should not be nil")
	}
	if resp.AssetLedgers[0].EventInfo.Status != "LOST" {
		t.Fatalf("status = %q, want LOST", resp.AssetLedgers[0].EventInfo.Status)
	}
	if resp.AssetLedgers[0].EventInfo.ActualPayout != "0" {
		t.Fatalf("actual_payout = %q, want 0", resp.AssetLedgers[0].EventInfo.ActualPayout)
	}
}

// TestGetBetHistoryEnableClaimForClaimableSettledBets 验证 History 顶层 enable_claim 的领取入口语义。
// 它必须同时满足结算可领取状态、actual_payout 为正数、且没有 claim_prize 幂等流水，避免前端对已领取或不可赔付注单展示领取按钮。
func TestGetBetHistoryEnableClaimForClaimableSettledBets(t *testing.T) {
	settledAt := time.Date(2026, 4, 20, 12, 0, 0, 0, time.UTC)
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{BusinessType: model.AssetTypeSingle, RefID: "41", CreatedAt: time.Date(2026, 4, 20, 10, 0, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeSingle, RefID: "42", CreatedAt: time.Date(2026, 4, 20, 10, 1, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeSingle, RefID: "43", CreatedAt: time.Date(2026, 4, 20, 10, 2, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeParlay, RefID: "44", CreatedAt: time.Date(2026, 4, 20, 10, 3, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeSingle, RefID: "45", CreatedAt: time.Date(2026, 4, 20, 10, 4, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeSingle, RefID: "46", CreatedAt: time.Date(2026, 4, 20, 10, 5, 0, 0, time.UTC)},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 6 {
					t.Fatalf("orders = %v, want 6 ids", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{Id: 41, Status: "WON", Type: model.AssetTypeSingle, FixtureName: "Claimable Won", ActualPayout: "12.5", SettledAt: &settledAt},
						{Id: 42, Status: "WON", Type: model.AssetTypeSingle, FixtureName: "Already Claimed", ActualPayout: "8", SettledAt: &settledAt},
						{Id: 43, Status: "LOST", Type: model.AssetTypeSingle, FixtureName: "Lost Bet", ActualPayout: "0", SettledAt: &settledAt},
						{Id: 44, Status: "PUSH", Type: model.AssetTypeParlay, FixtureName: "Push Bet", ActualPayout: "10", SettledAt: &settledAt},
						{Id: 45, Status: "VOID", Type: model.AssetTypeSingle, FixtureName: "Zero Payout", ActualPayout: "0", SettledAt: &settledAt},
						{Id: 46, Status: "LIVE", Type: model.AssetTypeSingle, FixtureName: "Live Bet", ActualPayout: "9"},
					},
				}, nil
			},
			getClaimedBetIDsFn: func(ctx context.Context, userID uint64, betIDs []uint64) (map[uint64]struct{}, error) {
				if userID != 1001 {
					t.Fatalf("userID = %d, want 1001", userID)
				}
				got := make(map[uint64]struct{}, len(betIDs))
				for _, betID := range betIDs {
					got[betID] = struct{}{}
				}
				for _, wantBetID := range []uint64{41, 42, 44} {
					if _, ok := got[wantBetID]; !ok {
						t.Fatalf("claim candidates = %v, missing %d", betIDs, wantBetID)
					}
				}
				if len(got) != 3 {
					t.Fatalf("claim candidates = %v, want [41 42 44]", betIDs)
				}
				return map[uint64]struct{}{42: {}}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Tab:     "settled",
		Result:  "all",
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 5 || len(resp.AssetLedgers) != 5 {
		t.Fatalf("got total=%d len=%d, want 5", resp.Total, len(resp.AssetLedgers))
	}

	got := make(map[string]bool, len(resp.AssetLedgers))
	for _, ledger := range resp.AssetLedgers {
		got[ledger.RefID] = ledger.EnableClaim
		if ledger.EventInfo == nil {
			t.Fatalf("event_info should not be nil for ref_id=%s", ledger.RefID)
		}
	}
	want := map[string]bool{
		"41": true,
		"42": false,
		"43": false,
		"44": true,
		"45": false,
	}
	for refID, wantEnableClaim := range want {
		if got[refID] != wantEnableClaim {
			t.Fatalf("ref_id=%s enable_claim=%v, want %v; all=%v", refID, got[refID], wantEnableClaim, got)
		}
	}
	if _, exists := got["46"]; exists {
		t.Fatalf("live bet should be filtered from settled tab, got=%v", got)
	}

	body, err := json.Marshal(resp.AssetLedgers[0])
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}
	if !strings.Contains(string(body), `"enable_claim":`) {
		t.Fatalf("json body %s does not contain enable_claim", body)
	}
}

// TestGetBetHistoryUppercasesStatus 验证 History 响应会把 event_info.status 统一转成大写。
// 数据库里 active 注单通常是小写 live，统一响应格式可以避免前端同时兼容 live/LIVE 两套分支。
func TestGetBetHistoryUppercasesStatus(t *testing.T) {
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeSingle,
							RefID:        "12",
							CreatedAt:    time.Now(),
						},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 1 || orders[0] != 12 {
					t.Fatalf("orders = %v, want [12]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{
							Id:          12,
							Status:      "live",
							Type:        model.AssetTypeSingle,
							FixtureName: "Team A vs Team C",
						},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 1 || len(resp.AssetLedgers) != 1 {
		t.Fatalf("got total=%d len=%d, want 1", resp.Total, len(resp.AssetLedgers))
	}
	if resp.AssetLedgers[0].EventInfo == nil {
		t.Fatal("event_info should not be nil")
	}
	if resp.AssetLedgers[0].EventInfo.Status != "LIVE" {
		t.Fatalf("status = %q, want LIVE", resp.AssetLedgers[0].EventInfo.Status)
	}
}

// TestGetBetHistoryNormalizesFixtureTimeAndNullSettledAt 验证 History 出参时间格式稳定。
// fixture_time 早期数据混有无时区字符串，返回前必须补成 UTC/RFC3339；未结算 settled_at 也要显式返回 null，方便前端表格列稳定渲染。
func TestGetBetHistoryNormalizesFixtureTimeAndNullSettledAt(t *testing.T) {
	utcPlus8 := time.FixedZone("UTC+8", 8*60*60)
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeSingle,
							RefID:        "13",
							CreatedAt:    time.Date(2026, 4, 29, 4, 0, 0, 0, utcPlus8),
						},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 1 || orders[0] != 13 {
					t.Fatalf("orders = %v, want [13]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{
							Id:          13,
							Status:      "live",
							Type:        model.AssetTypeSingle,
							FixtureName: "Team A vs Team D",
							FixtureTime: "2026-04-28 20:00:00",
						},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 1 || len(resp.AssetLedgers) != 1 {
		t.Fatalf("got total=%d len=%d, want 1", resp.Total, len(resp.AssetLedgers))
	}
	got := resp.AssetLedgers[0]
	if got.CreatedAt.Location() != time.UTC {
		t.Fatalf("created_at location = %v, want UTC", got.CreatedAt.Location())
	}
	if got.EventInfo == nil {
		t.Fatal("event_info should not be nil")
	}
	if got.EventInfo.FixtureTime != "2026-04-28T20:00:00Z" {
		t.Fatalf("fixture_time = %q, want 2026-04-28T20:00:00Z", got.EventInfo.FixtureTime)
	}
	if got.EventInfo.SettledAt != nil {
		t.Fatalf("settled_at = %v, want nil before json marshal", got.EventInfo.SettledAt)
	}

	body, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}
	for _, want := range []string{
		`"created_at":"2026-04-28T20:00:00Z"`,
		`"fixture_time":"2026-04-28T20:00:00Z"`,
		`"settled_at":null`,
	} {
		if !strings.Contains(string(body), want) {
			t.Fatalf("json body %s does not contain %s", body, want)
		}
	}
}

// TestGetBetHistoryNormalizesSettledAtToUTC 确认已结算时间不会按数据库/本地时区原样透出。
// settled_at 是前端结算列的基准时间，统一转成 Z 后可以避免不同浏览器对 offset 和无 offset 字符串的解析差异。
func TestGetBetHistoryNormalizesSettledAtToUTC(t *testing.T) {
	utcPlus8 := time.FixedZone("UTC+8", 8*60*60)
	settledAt := time.Date(2026, 4, 29, 4, 30, 0, 0, utcPlus8)
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeSingle,
							RefID:        "14",
							CreatedAt:    time.Date(2026, 4, 29, 5, 0, 0, 0, utcPlus8),
						},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 1 || orders[0] != 14 {
					t.Fatalf("orders = %v, want [14]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{
							Id:          14,
							Status:      "WON",
							Type:        model.AssetTypeSingle,
							FixtureName: "Team A vs Team E",
							FixtureTime: "2026-04-29T04:00:00+08:00",
							SettledAt:   &settledAt,
						},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	got := resp.AssetLedgers[0]
	if got.EventInfo == nil || got.EventInfo.SettledAt == nil {
		t.Fatal("settled event_info should include settled_at")
	}
	if got.EventInfo.FixtureTime != "2026-04-28T20:00:00Z" {
		t.Fatalf("fixture_time = %q, want 2026-04-28T20:00:00Z", got.EventInfo.FixtureTime)
	}
	if got.EventInfo.SettledAt.Location() != time.UTC {
		t.Fatalf("settled_at location = %v, want UTC", got.EventInfo.SettledAt.Location())
	}

	body, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}
	if !strings.Contains(string(body), `"settled_at":"2026-04-28T20:30:00Z"`) {
		t.Fatalf("json body %s does not contain UTC settled_at", body)
	}
}

// TestGetBetHistoryBetOutcomeTypes 验证 History 新增的 bet_won / bet_lost 枚举。
// 这两个枚举不是流水表原生 business_type，必须先查下注流水，再用注单结算状态过滤。
func TestGetBetHistoryBetOutcomeTypes(t *testing.T) {
	settledAt := time.Date(2026, 4, 20, 15, 0, 0, 0, time.UTC)

	for _, tc := range []struct {
		name       string
		historyTyp string
		wantRefID  string
		wantStatus string
	}{
		{name: "won", historyTyp: model.HistoryTypeBetWon, wantRefID: "21", wantStatus: "WON"},
		{name: "lost", historyTyp: model.HistoryTypeBetLost, wantRefID: "22", wantStatus: "LOST"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc := &authService{
				userRepo: &bannerRepoStub{
					getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
						return &model.AssetLedgersResponse{
							AssetLedgers: []model.AssetLedgerResponse{
								{
									BusinessType: model.AssetTypeSingle,
									RefID:        "21",
									CreatedAt:    time.Date(2026, 4, 1, 10, 0, 0, 0, time.UTC),
								},
								{
									BusinessType: model.AssetTypeParlay,
									RefID:        "22",
									CreatedAt:    time.Date(2026, 4, 1, 11, 0, 0, 0, time.UTC),
								},
							},
						}, nil
					},
					getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
						if len(orders) != 2 || orders[0] != 21 || orders[1] != 22 {
							t.Fatalf("orders = %v, want [21 22]", orders)
						}
						return &model.BetHoldingResponse{
							Results: []model.BetHoldingResult{
								{
									Id:           21,
									Status:       "WON",
									Type:         model.AssetTypeSingle,
									FixtureName:  "Team A vs Team B",
									ActualPayout: "20",
									SettledAt:    &settledAt,
								},
								{
									Id:           22,
									Status:       "LOST",
									Type:         model.AssetTypeParlay,
									FixtureName:  "Team C vs Team D",
									ActualPayout: "0",
									SettledAt:    &settledAt,
								},
							},
						}, nil
					},
				},
			}

			resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
				OrderBy:   "created_at",
				Sort:      "desc",
				Type:      tc.historyTyp,
				BeginDate: "2026-04-20",
				EndDate:   "2026-04-20",
				Page:      1,
			})
			if err != nil {
				t.Fatalf("GetBetHistory() error = %v", err)
			}
			if resp.Total != 1 || len(resp.AssetLedgers) != 1 {
				t.Fatalf("got total=%d len=%d, want 1", resp.Total, len(resp.AssetLedgers))
			}
			if resp.AssetLedgers[0].RefID != tc.wantRefID {
				t.Fatalf("ref_id = %q, want %q", resp.AssetLedgers[0].RefID, tc.wantRefID)
			}
			if resp.AssetLedgers[0].EventInfo == nil {
				t.Fatal("event_info should not be nil")
			}
			if resp.AssetLedgers[0].EventInfo.Status != tc.wantStatus {
				t.Fatalf("status = %q, want %q", resp.AssetLedgers[0].EventInfo.Status, tc.wantStatus)
			}
		})
	}
}

// TestGetBetHistoryBetCancelType 验证 bet_cancel 会映射到 cancel_bet 流水，
// 并通过 ref_id 回查原注单详情，保证 History 筛选后仍能展示赛事信息。
func TestGetBetHistoryBetCancelType(t *testing.T) {
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeCancelBet,
							RefID:        "31",
							CreatedAt:    time.Now(),
						},
						{
							BusinessType: model.AssetTypeSingle,
							RefID:        "32",
							CreatedAt:    time.Now(),
						},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 1 || orders[0] != 31 {
					t.Fatalf("orders = %v, want [31]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{
							Id:          31,
							Status:      "CANCELLED",
							Type:        model.AssetTypeSingle,
							FixtureName: "Team E vs Team F",
						},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Type:    model.HistoryTypeBetCancel,
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 1 || len(resp.AssetLedgers) != 1 {
		t.Fatalf("got total=%d len=%d, want 1", resp.Total, len(resp.AssetLedgers))
	}
	if resp.AssetLedgers[0].BusinessType != model.AssetTypeCancelBet {
		t.Fatalf("business_type = %q, want %q", resp.AssetLedgers[0].BusinessType, model.AssetTypeCancelBet)
	}
	if resp.AssetLedgers[0].EventInfo == nil {
		t.Fatal("event_info should not be nil")
	}
	if resp.AssetLedgers[0].EventInfo.Status != "CANCELLED" {
		t.Fatalf("status = %q, want CANCELLED", resp.AssetLedgers[0].EventInfo.Status)
	}
}

// TestGetBetHistoryBetBannerType 验证 type=bet_banner 只返回 Banner 下注流水。
// Banner 对外用 bet_banner 这个业务枚举，内部仍映射 asset_ledger.business_type=banner_single。
func TestGetBetHistoryBetBannerType(t *testing.T) {
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeBannerSingle,
							RefID:        "77",
							CreatedAt:    time.Now(),
						},
						{
							BusinessType: model.AssetTypeSingle,
							RefID:        "78",
							CreatedAt:    time.Now(),
						},
					},
				}, nil
			},
			getBannerBetByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 1 || orders[0] != 77 {
					t.Fatalf("banner orders = %v, want [77]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{
							Id:          77,
							Status:      "live",
							Type:        model.AssetTypeBannerSingle,
							FixtureName: "B1",
							MarketType:  "champion_winner",
							Selection:   "Argentina",
						},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Type:    model.HistoryTypeBetBanner,
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 1 || len(resp.AssetLedgers) != 1 {
		t.Fatalf("got total=%d len=%d, want 1", resp.Total, len(resp.AssetLedgers))
	}
	if resp.AssetLedgers[0].BusinessType != model.AssetTypeBannerSingle {
		t.Fatalf("business_type = %q, want %q", resp.AssetLedgers[0].BusinessType, model.AssetTypeBannerSingle)
	}
	if resp.AssetLedgers[0].EventInfo == nil {
		t.Fatal("event_info should not be nil")
	}
	if resp.AssetLedgers[0].EventInfo.Status != "LIVE" {
		t.Fatalf("status = %q, want LIVE", resp.AssetLedgers[0].EventInfo.Status)
	}
	if resp.AssetLedgers[0].EventInfo.Selection != "Argentina" {
		t.Fatalf("selection = %q, want Argentina", resp.AssetLedgers[0].EventInfo.Selection)
	}
}

// TestGetBetHistoryBetTypeIncludesAllBetStatuses 验证 type=bet 是“全部下注”筛选，
// 只按下注流水类型命中普通/Banner 下注，不再借助 WON/LOST 间接聚合，避免未结算、PUSH、VOID 注单在 Portfolio 历史页被漏掉。
func TestGetBetHistoryBetTypeIncludesAllBetStatuses(t *testing.T) {
	settledAt := time.Date(2026, 4, 21, 12, 0, 0, 0, time.UTC)
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{BusinessType: model.AssetTypeSingle, RefID: "101", CreatedAt: time.Date(2026, 4, 21, 10, 0, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeParlay, RefID: "102", CreatedAt: time.Date(2026, 4, 21, 10, 1, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeSingle, RefID: "103", CreatedAt: time.Date(2026, 4, 21, 10, 2, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeSingle, RefID: "104", CreatedAt: time.Date(2026, 4, 21, 10, 3, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeParlay, RefID: "105", CreatedAt: time.Date(2026, 4, 21, 10, 4, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeSingle, RefID: "106", CreatedAt: time.Date(2026, 4, 21, 10, 5, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeBannerSingle, RefID: "201", CreatedAt: time.Date(2026, 4, 21, 10, 6, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeCancelBet, RefID: "301", CreatedAt: time.Date(2026, 4, 21, 10, 7, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeClaimPrize, RefID: "103", CreatedAt: time.Date(2026, 4, 21, 10, 8, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeWithDraw, RefID: "w1", CreatedAt: time.Date(2026, 4, 21, 10, 9, 0, 0, time.UTC)},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				wantOrders := []uint64{101, 102, 103, 104, 105, 106}
				if len(orders) != len(wantOrders) {
					t.Fatalf("orders = %v, want %v", orders, wantOrders)
				}
				for i, want := range wantOrders {
					if orders[i] != want {
						t.Fatalf("orders = %v, want %v", orders, wantOrders)
					}
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{Id: 101, Status: "live", Type: model.AssetTypeSingle, FixtureName: "Live Match", ActualPayout: "0"},
						{Id: 102, Status: "pending", Type: model.AssetTypeParlay, FixtureName: "Pending Match", ActualPayout: "0"},
						{Id: 103, Status: "WON", Type: model.AssetTypeSingle, FixtureName: "Won Match", ActualPayout: "0", SettledAt: &settledAt},
						{Id: 104, Status: "LOST", Type: model.AssetTypeSingle, FixtureName: "Lost Match", ActualPayout: "0", SettledAt: &settledAt},
						{Id: 105, Status: "PUSH", Type: model.AssetTypeParlay, FixtureName: "Push Match", ActualPayout: "0", SettledAt: &settledAt},
						{Id: 106, Status: "VOID", Type: model.AssetTypeSingle, FixtureName: "Void Match", ActualPayout: "0", SettledAt: &settledAt},
					},
				}, nil
			},
			getBannerBetByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 1 || orders[0] != 201 {
					t.Fatalf("banner orders = %v, want [201]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{Id: 201, Status: "live", Type: model.AssetTypeBannerSingle, FixtureName: "Banner Live", ActualPayout: "0"},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Type:    model.HistoryTypeBet,
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 7 || len(resp.AssetLedgers) != 7 {
		t.Fatalf("got total=%d len=%d, want 7", resp.Total, len(resp.AssetLedgers))
	}

	got := make(map[string]string, len(resp.AssetLedgers))
	for _, ledger := range resp.AssetLedgers {
		if ledger.EventInfo == nil {
			t.Fatalf("event_info should not be nil for ref_id=%s", ledger.RefID)
		}
		got[ledger.RefID] = ledger.EventInfo.Status
	}
	for refID, wantStatus := range map[string]string{
		"101": "LIVE",
		"102": "PENDING",
		"103": "WON",
		"104": "LOST",
		"105": "PUSH",
		"106": "VOID",
		"201": "LIVE",
	} {
		if got[refID] != wantStatus {
			t.Fatalf("ref_id=%s status=%q, want %q; all=%v", refID, got[refID], wantStatus, got)
		}
	}
	if _, exists := got["301"]; exists {
		t.Fatalf("cancel_bet should not be returned by type=bet, got=%v", got)
	}
}

// TestGetBetHistoryBetTypeCombinesWithCancelAndClaim 验证新推荐组合 type=bet,bet_cancel,claim_prize 按并集返回。
// bet 只负责下注流水，撤单和领奖必须由各自枚举补入，避免前端“全部投注”既漏未结算下注又丢资金操作记录。
func TestGetBetHistoryBetTypeCombinesWithCancelAndClaim(t *testing.T) {
	settledAt := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{BusinessType: model.AssetTypeSingle, RefID: "501", CreatedAt: time.Date(2026, 4, 22, 10, 0, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeCancelBet, RefID: "502", CreatedAt: time.Date(2026, 4, 22, 10, 1, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeClaimPrize, RefID: "503", CreatedAt: time.Date(2026, 4, 22, 10, 2, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeWithDraw, RefID: "w2", CreatedAt: time.Date(2026, 4, 22, 10, 3, 0, 0, time.UTC)},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				wantOrders := []uint64{501, 502, 503}
				if len(orders) != len(wantOrders) {
					t.Fatalf("orders = %v, want %v", orders, wantOrders)
				}
				for i, want := range wantOrders {
					if orders[i] != want {
						t.Fatalf("orders = %v, want %v", orders, wantOrders)
					}
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{Id: 501, Status: "pending", Type: model.AssetTypeSingle, FixtureName: "Pending Bet", ActualPayout: "0"},
						{Id: 502, Status: "CANCELLED", Type: model.AssetTypeSingle, FixtureName: "Canceled Bet", ActualPayout: "0"},
						{Id: 503, Status: "WON", Type: model.AssetTypeSingle, FixtureName: "Claimed Bet", ActualPayout: "12", SettledAt: &settledAt},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Type:    model.HistoryTypeBet + "," + model.HistoryTypeBetCancel + "," + model.AssetTypeClaimPrize,
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 3 || len(resp.AssetLedgers) != 3 {
		t.Fatalf("got total=%d len=%d, want 3", resp.Total, len(resp.AssetLedgers))
	}

	got := make(map[string]string, len(resp.AssetLedgers))
	gotBusinessTypes := make(map[string]string, len(resp.AssetLedgers))
	for _, ledger := range resp.AssetLedgers {
		if ledger.EventInfo == nil {
			t.Fatalf("event_info should not be nil for ref_id=%s", ledger.RefID)
		}
		got[ledger.RefID] = ledger.EventInfo.Status
		gotBusinessTypes[ledger.RefID] = ledger.BusinessType
	}
	want := map[string]string{"501": "PENDING", "502": "CANCELLED", "503": "WON"}
	for refID, wantStatus := range want {
		if got[refID] != wantStatus {
			t.Fatalf("ref_id=%s status=%q, want %q; all=%v", refID, got[refID], wantStatus, got)
		}
	}
	if gotBusinessTypes["503"] != model.AssetTypeClaimPrize {
		t.Fatalf("ref_id=503 business_type=%q, want %q", gotBusinessTypes["503"], model.AssetTypeClaimPrize)
	}
	if _, exists := got["w2"]; exists {
		t.Fatalf("withdraw should not be returned by bet/cancel/claim combo, got=%v", got)
	}
}

// TestGetBetHistoryMultipleBetTypes 验证前端传 type=bet_cancel,bet_won,bet_lost 时按并集返回。
// cancel 使用流水创建时间过滤，won/lost 使用 settled_at 过滤，避免多选时不同业务时间混用导致漏数据。
func TestGetBetHistoryMultipleBetTypes(t *testing.T) {
	wonSettledAt := time.Date(2026, 4, 20, 15, 0, 0, 0, time.UTC)
	lostSettledAt := time.Date(2026, 4, 20, 14, 0, 0, 0, time.UTC)

	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeCancelBet,
							RefID:        "31",
							CreatedAt:    time.Date(2026, 4, 20, 13, 0, 0, 0, time.UTC),
						},
						{
							BusinessType: model.AssetTypeSingle,
							RefID:        "21",
							CreatedAt:    time.Date(2026, 4, 1, 10, 0, 0, 0, time.UTC),
						},
						{
							BusinessType: model.AssetTypeParlay,
							RefID:        "22",
							CreatedAt:    time.Date(2026, 4, 1, 11, 0, 0, 0, time.UTC),
						},
						{
							BusinessType: model.AssetTypeSingle,
							RefID:        "23",
							CreatedAt:    time.Date(2026, 4, 20, 12, 0, 0, 0, time.UTC),
						},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 4 || orders[0] != 31 || orders[1] != 21 || orders[2] != 22 || orders[3] != 23 {
					t.Fatalf("orders = %v, want [31 21 22 23]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{Id: 31, Status: "CANCELLED", Type: model.AssetTypeSingle, FixtureName: "Cancel Match"},
						{Id: 21, Status: "WON", Type: model.AssetTypeSingle, FixtureName: "Won Match", SettledAt: &wonSettledAt},
						{Id: 22, Status: "LOST", Type: model.AssetTypeParlay, FixtureName: "Lost Match", SettledAt: &lostSettledAt},
						{Id: 23, Status: "LIVE", Type: model.AssetTypeSingle, FixtureName: "Live Match"},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy:   "created_at",
		Sort:      "desc",
		Type:      model.HistoryTypeBetCancel + "," + model.HistoryTypeBetWon + "," + model.HistoryTypeBetLost,
		BeginDate: "2026-04-20",
		EndDate:   "2026-04-20",
		Page:      1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 3 || len(resp.AssetLedgers) != 3 {
		t.Fatalf("got total=%d len=%d, want 3", resp.Total, len(resp.AssetLedgers))
	}

	got := make(map[string]string, len(resp.AssetLedgers))
	for _, ledger := range resp.AssetLedgers {
		if ledger.EventInfo == nil {
			t.Fatalf("event_info should not be nil for ref_id=%s", ledger.RefID)
		}
		got[ledger.RefID] = ledger.EventInfo.Status
	}
	for refID, wantStatus := range map[string]string{"31": "CANCELLED", "21": "WON", "22": "LOST"} {
		if got[refID] != wantStatus {
			t.Fatalf("ref_id=%s status=%q, want %q; all=%v", refID, got[refID], wantStatus, got)
		}
	}
	if _, ok := got["23"]; ok {
		t.Fatalf("live bet should be filtered, got=%v", got)
	}
}

// TestGetBetHistoryHydratesCompletedStatusForBetAndClaim 验证下注和领取类流水会返回 History 顶层成功状态。
// 当前这些业务都是资产变动成功后才写入 asset_ledger，失败不会留下可展示流水，因此 History 顶层状态按 Completed 输出。
func TestGetBetHistoryHydratesCompletedStatusForBetAndClaim(t *testing.T) {
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeSingle,
							RefID:        "11",
							CreatedAt:    time.Date(2026, 4, 20, 10, 0, 0, 0, time.UTC),
						},
						{
							BusinessType: model.AssetTypeClaimPrize,
							RefID:        "11",
							CreatedAt:    time.Date(2026, 4, 20, 11, 0, 0, 0, time.UTC),
						},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 1 || orders[0] != 11 {
					t.Fatalf("orders = %v, want [11]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{
							Id:          11,
							Status:      "WON",
							Type:        model.AssetTypeSingle,
							FixtureName: "Team A vs Team B",
						},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 2 || len(resp.AssetLedgers) != 2 {
		t.Fatalf("got total=%d len=%d, want 2", resp.Total, len(resp.AssetLedgers))
	}
	for _, ledger := range resp.AssetLedgers {
		if ledger.Status != int8(model.HistoryLedgerStatusCompleted) {
			t.Fatalf("business_type=%s status=%d, want %d", ledger.BusinessType, ledger.Status, model.HistoryLedgerStatusCompleted)
		}
		if ledger.ErrorMsg != "" {
			t.Fatalf("business_type=%s error_msg=%q, want empty", ledger.BusinessType, ledger.ErrorMsg)
		}
	}
}

// TestGetBetHistoryHydratesEventInfoForClaimPrize 验证 claim_prize 流水会通过 ref_id 关联到原注单详情，
// 这样前端 History 在领取记录上能展示对应比赛信息（ref_id 写入时就是 user_bet_holding.id）。
func TestGetBetHistoryHydratesEventInfoForClaimPrize(t *testing.T) {
	settledAt := time.Date(2026, 4, 20, 12, 0, 0, 0, time.UTC)
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{
							BusinessType: model.AssetTypeClaimPrize,
							RefID:        "77",
							CreatedAt:    time.Date(2026, 4, 20, 13, 0, 0, 0, time.UTC),
						},
					},
				}, nil
			},
			getBetHoldingByOrdersFn: func(ctx context.Context, orders []uint64) (*model.BetHoldingResponse, error) {
				if len(orders) != 1 || orders[0] != 77 {
					t.Fatalf("orders = %v, want [77]", orders)
				}
				return &model.BetHoldingResponse{
					Results: []model.BetHoldingResult{
						{
							Id:           77,
							Status:       "WON",
							Type:         model.AssetTypeSingle,
							FixtureName:  "Lakers vs Celtics",
							MarketType:   "Moneyline",
							Selection:    "Lakers",
							ActualPayout: "25",
							SettledAt:    &settledAt,
						},
					},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 1 || len(resp.AssetLedgers) != 1 {
		t.Fatalf("got total=%d len=%d, want 1", resp.Total, len(resp.AssetLedgers))
	}
	ledger := resp.AssetLedgers[0]
	if ledger.BusinessType != model.AssetTypeClaimPrize {
		t.Fatalf("business_type = %q, want %q", ledger.BusinessType, model.AssetTypeClaimPrize)
	}
	if ledger.EventInfo == nil {
		t.Fatal("event_info should not be nil for claim_prize ledger")
	}
	if ledger.EventInfo.FixtureName != "Lakers vs Celtics" {
		t.Fatalf("fixture_name = %q, want Lakers vs Celtics", ledger.EventInfo.FixtureName)
	}
	if ledger.EventInfo.Status != "WON" {
		t.Fatalf("status = %q, want WON", ledger.EventInfo.Status)
	}
	if ledger.EventInfo.ActualPayout != "25" {
		t.Fatalf("actual_payout = %q, want 25", ledger.EventInfo.ActualPayout)
	}
}

// TestGetBetHistoryMapsWithdrawStatus 验证 History 使用前端展示枚举，而不是裸透 withdraw_record.status。
func TestGetBetHistoryMapsWithdrawStatus(t *testing.T) {
	svc := &authService{
		userRepo: &bannerRepoStub{
			getAssetLedgersByUserIDFn: func(ctx context.Context, userID uint64, param model.AssetLedgerRequest, needBalance bool) (*model.AssetLedgersResponse, error) {
				return &model.AssetLedgersResponse{
					AssetLedgers: []model.AssetLedgerResponse{
						{BusinessType: model.AssetTypeWithDraw, RefID: "w1", CreatedAt: time.Date(2026, 4, 20, 10, 0, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeWithDraw, RefID: "w2", CreatedAt: time.Date(2026, 4, 20, 11, 0, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeWithDraw, RefID: "w3", CreatedAt: time.Date(2026, 4, 20, 12, 0, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeWithDraw, RefID: "w4", CreatedAt: time.Date(2026, 4, 20, 13, 0, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeWithDraw, RefID: "w5", CreatedAt: time.Date(2026, 4, 20, 14, 0, 0, 0, time.UTC)},
						{BusinessType: model.AssetTypeWithDraw, RefID: "w6", CreatedAt: time.Date(2026, 4, 20, 15, 0, 0, 0, time.UTC)},
						{BusinessType: string(model.BusinessTypeCancelWithdraw), RefID: "w6", CreatedAt: time.Date(2026, 4, 20, 16, 0, 0, 0, time.UTC)},
					},
				}, nil
			},
			getWithdrawRecordsByOrders: func(ctx context.Context, userID uint64, orderSns []string) ([]model.WithdrawRecord, error) {
				if userID != 1001 {
					t.Fatalf("userID = %d, want 1001", userID)
				}
				wantOrders := []string{"w1", "w2", "w3", "w4", "w5", "w6"}
				if len(orderSns) != len(wantOrders) {
					t.Fatalf("orderSns = %v, want %v", orderSns, wantOrders)
				}
				for i := range wantOrders {
					if orderSns[i] != wantOrders[i] {
						t.Fatalf("orderSns = %v, want %v", orderSns, wantOrders)
					}
				}
				return []model.WithdrawRecord{
					{OrderSn: "w1", Status: 1},
					{OrderSn: "w2", Status: 2},
					{OrderSn: "w3", Status: 3},
					{OrderSn: "w4", Status: 4, Remark: " Risk control rejected "},
					{OrderSn: "w5", Status: 5, Remark: "Insufficient gas"},
					{OrderSn: "w6", Status: 6},
				}, nil
			},
		},
	}

	resp, err := svc.GetBetHistory(context.Background(), 1001, model.GetBetHistoryRequest{
		OrderBy: "created_at",
		Sort:    "desc",
		Page:    1,
	})
	if err != nil {
		t.Fatalf("GetBetHistory() error = %v", err)
	}
	if resp.Total != 7 || len(resp.AssetLedgers) != 7 {
		t.Fatalf("got total=%d len=%d, want 7", resp.Total, len(resp.AssetLedgers))
	}

	gotStatus := make(map[string]int8, len(resp.AssetLedgers))
	gotError := make(map[string]string, len(resp.AssetLedgers))
	for _, ledger := range resp.AssetLedgers {
		key := ledger.BusinessType + ":" + ledger.RefID
		gotStatus[key] = ledger.Status
		gotError[key] = ledger.ErrorMsg
	}

	wantStatus := map[string]int8{
		model.AssetTypeWithDraw + ":w1":                  int8(model.HistoryLedgerStatusReviewing),
		model.AssetTypeWithDraw + ":w2":                  int8(model.HistoryLedgerStatusProcessing),
		model.AssetTypeWithDraw + ":w3":                  int8(model.HistoryLedgerStatusCompleted),
		model.AssetTypeWithDraw + ":w4":                  int8(model.HistoryLedgerStatusFailed),
		model.AssetTypeWithDraw + ":w5":                  int8(model.HistoryLedgerStatusFailed),
		model.AssetTypeWithDraw + ":w6":                  int8(model.HistoryLedgerStatusCanceled),
		string(model.BusinessTypeCancelWithdraw) + ":w6": int8(model.HistoryLedgerStatusCanceled),
	}
	for key, want := range wantStatus {
		if gotStatus[key] != want {
			t.Fatalf("%s status=%d, want %d; all=%v", key, gotStatus[key], want, gotStatus)
		}
	}
	if gotError[model.AssetTypeWithDraw+":w4"] != "Risk control rejected" {
		t.Fatalf("w4 error_msg=%q, want Risk control rejected", gotError[model.AssetTypeWithDraw+":w4"])
	}
	if gotError[model.AssetTypeWithDraw+":w5"] != "Insufficient gas" {
		t.Fatalf("w5 error_msg=%q, want Insufficient gas", gotError[model.AssetTypeWithDraw+":w5"])
	}
	if gotError[model.AssetTypeWithDraw+":w3"] != "" {
		t.Fatalf("w3 error_msg=%q, want empty", gotError[model.AssetTypeWithDraw+":w3"])
	}
}
