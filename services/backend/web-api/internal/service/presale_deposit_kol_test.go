package service_test

// presale_deposit_kol_test.go
//
// REQ-004 · ReportTx 路径 KOL 自定义返佣比例覆盖单测。
// 验证：bind 有效（INV-6 通过）+ kolRepo 命中 → 用 KOL pct；未命中 / repo 出错 → fallback 轮次 pct。

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/core/types"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"
)

// mockKolRepo 测试用 KOL repo：可注入命中 pct 或错误
type mockKolRepo struct {
	hits map[string]decimal.Decimal // eoa(lower) → pct
	err  error                      // 非 nil 时所有 GetByEoa 返此错误（覆盖 hits）
}

func (m *mockKolRepo) List(_ context.Context, _ string, _, _ int) ([]*model.PresaleKolReferralPct, int64, error) {
	return nil, 0, nil
}
func (m *mockKolRepo) Upsert(_ context.Context, _ *model.PresaleKolReferralPct) error { return nil }
func (m *mockKolRepo) UpsertTx(_ context.Context, _ *gorm.DB, _ *model.PresaleKolReferralPct) error {
	return nil
}
func (m *mockKolRepo) Update(_ context.Context, _ string, _ decimal.Decimal, _ *string, _ int64) error {
	return nil
}
func (m *mockKolRepo) UpdateTx(_ context.Context, _ *gorm.DB, _ string, _ decimal.Decimal, _ *string, _ int64) error {
	return nil
}
func (m *mockKolRepo) Delete(_ context.Context, _ string) (bool, error) { return false, nil }
func (m *mockKolRepo) DeleteTx(_ context.Context, _ *gorm.DB, _ string) (bool, error) {
	return false, nil
}
func (m *mockKolRepo) GetByEoa(_ context.Context, eoa string) (*model.PresaleKolReferralPct, error) {
	if m.err != nil {
		return nil, m.err
	}
	pct, ok := m.hits[eoa]
	if !ok {
		return nil, repository.ErrKolNotFound
	}
	return &model.PresaleKolReferralPct{ReferrerEoa: eoa, ReferralPct: pct}, nil
}

var _ repository.KolReferralPctRepository = (*mockKolRepo)(nil)

// buildSvcWithBscAndKol 扩展 buildSvcWithBsc：额外注入 kolRepo
func buildSvcWithBscAndKol(
	bscClient service.BscClient,
	depositRepo repository.PresaleDepositRepository,
	roundRepo repository.PresaleRoundRepository,
	holdingRepo repository.PresaleHoldingRepository,
	opsRepo repository.PresaleOpsEventRepository,
	bindRepo repository.UserReferralBindRepository,
	kolRepo repository.KolReferralPctRepository,
) service.PresaleDepositService {
	cfg := makePresaleCfgWithVault()
	return service.NewPresaleDepositService(
		cfg, nil,
		depositRepo, roundRepo, holdingRepo, opsRepo, bindRepo,
		kolRepo, // REQ-004 注入
		nil, bscClient,
	)
}

// TestReportTx_KolReferral 验证 KOL 自定义比例覆盖 / 回落 round 比例 / repo 错误兜底
func TestReportTx_KolReferral(t *testing.T) {
	const userID = uint64(4001)
	const referrerID = uint64(8888)
	// referrerEoa 必须小写（bind 存储约定）
	const referrerEoa = "0x0000000000000000000000000000000000abcdef"

	// header.Time 转 blockTs（service 路径 INV-6 用）
	headerTime := uint64(time.Now().Unix())
	blockTs := int64(headerTime) * 1000

	// makeActiveRound 默认 ReferralRewardPct = 10
	roundDefaultPct := decimal.NewFromInt(10)
	kolPct := decimal.RequireFromString("8.0")

	cases := []struct {
		name         string
		kolRepo      *mockKolRepo
		expectPctStr string
	}{
		{
			name:         "KOL hit covers round pct",
			kolRepo:      &mockKolRepo{hits: map[string]decimal.Decimal{referrerEoa: kolPct}},
			expectPctStr: "8",
		},
		{
			name:         "KOL miss (ErrKolNotFound) fallback round pct",
			kolRepo:      &mockKolRepo{hits: map[string]decimal.Decimal{}}, // 无命中
			expectPctStr: roundDefaultPct.String(),
		},
		{
			name:         "KOL repo error (non-NotFound) fallback round pct",
			kolRepo:      &mockKolRepo{err: errors.New("db timeout")},
			expectPctStr: roundDefaultPct.String(),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			receipt := makeUsdtTransferReceipt(svcUserEoa, svcVaultAddr, svcUsdtAddr,
				types.ReceiptStatusSuccessful, 100)
			bsc := &mockSvcBscClient{
				receipt: receipt,
				header:  &types.Header{Time: headerTime},
			}

			depositRepo := newMockDepositRepo()
			roundRepo := newMockRoundRepoFull(makeActiveRound("r1"))
			bindRepo := newMockBindRepo(&model.UserReferralBind{
				UserID:         userID,
				ReferrerUserID: referrerID,
				ReferrerEoa:    referrerEoa,
				BoundAt:        blockTs - 60_000, // 安全早于 blockTs
			})

			svc := buildSvcWithBscAndKol(bsc, depositRepo, roundRepo,
				&mockHoldingRepo{}, &mockOpsRepo{}, bindRepo, tc.kolRepo)

			_, err := svc.ReportTx(context.Background(), userID,
				svcUserEoa, service.ReportTxRequest{TxHash: "0xdeadbeef"})
			if err != nil {
				t.Fatalf("ReportTx: %v", err)
			}
			if len(depositRepo.createdDeposits) != 1 {
				t.Fatalf("want 1 deposit, got %d", len(depositRepo.createdDeposits))
			}
			dep := depositRepo.createdDeposits[0]

			if dep.ReferrerUserID == nil || *dep.ReferrerUserID != referrerID {
				t.Fatalf("referrer not bound: %v", dep.ReferrerUserID)
			}
			if dep.ReferralRewardPct == nil {
				t.Fatal("ReferralRewardPct nil")
			}
			if dep.ReferralRewardPct.String() != tc.expectPctStr {
				t.Errorf("ReferralRewardPct: want %s, got %s",
					tc.expectPctStr, dep.ReferralRewardPct.String())
			}
			// INV-7 联动验证：reward = sharesOdd × pct / 100。
			// makeUsdtTransferReceipt(_, _, _, _, 100) → amount=100 USDT；
			// makeActiveRound PriceUsd=0.05 → sharesOdd = 100/0.05 = 2000；
			// reward = 2000 × pct / 100 = 20 × pct。
			expectReward := decimal.NewFromInt(20).Mul(*dep.ReferralRewardPct)
			if !dep.ReferralRewardOdd.Equal(expectReward) {
				t.Errorf("ReferralRewardOdd: want %s, got %s",
					expectReward.String(), dep.ReferralRewardOdd.String())
			}
		})
	}
}
