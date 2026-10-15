package service_test

// presale_round_cron_test.go
//
// TestRoundCron 验证 RoundCronService.Tick 状态机推进：
//   - upcoming → active（now ≥ start_ts）
//   - active → ended（now ≥ end_ts）
//   - active → ended（sold_out：sold_odd ≥ supply_odd）
//   - manual_override=1 的轮次跳过（ListAutoAdvanceable 不返回该轮次）

import (
	"context"
	"errors"
	"testing"
	"time"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ===========================
// mock PresaleRoundRepository
// ===========================

type mockRoundRepo struct {
	advanceCalls      []advanceCall
	autoAdvanceRounds []*model.PresaleRound
	autoAdvanceErr    error
	advanceErr        map[string]error
}

type advanceCall struct {
	ID         string
	FromStatus string
	ToStatus   string
}

func newMockRoundRepo(rounds []*model.PresaleRound) *mockRoundRepo {
	return &mockRoundRepo{
		autoAdvanceRounds: rounds,
		advanceErr:        make(map[string]error),
	}
}

func (m *mockRoundRepo) GetByID(_ context.Context, _ string) (*model.PresaleRound, error) {
	return nil, errors.New("not implemented")
}
func (m *mockRoundRepo) List(_ context.Context) ([]*model.PresaleRound, error) {
	return nil, errors.New("not implemented")
}
func (m *mockRoundRepo) ListActive(_ context.Context) ([]*model.PresaleRound, error) {
	return nil, errors.New("not implemented")
}
func (m *mockRoundRepo) ListAutoAdvanceable(_ context.Context, _ int64) ([]*model.PresaleRound, error) {
	return m.autoAdvanceRounds, m.autoAdvanceErr
}
func (m *mockRoundRepo) AdvanceStatus(_ context.Context, id, fromStatus, toStatus string) error {
	m.advanceCalls = append(m.advanceCalls, advanceCall{id, fromStatus, toStatus})
	if err, ok := m.advanceErr[id]; ok {
		return err
	}
	return nil
}
func (m *mockRoundRepo) IncrSoldAndRaised(_ context.Context, _ *gorm.DB, _ string, _, _ decimal.Decimal) error {
	return errors.New("not implemented")
}
func (m *mockRoundRepo) FindUpcomingNearest(_ context.Context) (*model.PresaleRound, error) {
	return nil, errors.New("not implemented")
}
func (m *mockRoundRepo) TotalRaisedUsd(_ context.Context) (decimal.Decimal, error) {
	return decimal.Zero, errors.New("not implemented")
}

var _ repository.PresaleRoundRepository = (*mockRoundRepo)(nil)

// ===========================
// helpers
// ===========================

func nowMs() int64 { return time.Now().UnixMilli() }

func roundActive(id string, startTs, endTs int64, soldOdd, supplyOdd decimal.Decimal) *model.PresaleRound {
	return &model.PresaleRound{
		ID:        id,
		Status:    model.RoundStatusActive,
		StartTs:   startTs,
		EndTs:     endTs,
		SoldOdd:   soldOdd,
		SupplyOdd: supplyOdd,
	}
}

func roundUpcoming(id string, startTs int64) *model.PresaleRound {
	return &model.PresaleRound{
		ID:        id,
		Status:    model.RoundStatusUpcoming,
		StartTs:   startTs,
		EndTs:     startTs + int64(7*24*time.Hour/time.Millisecond),
		SoldOdd:   decimal.Zero,
		SupplyOdd: decimal.NewFromInt(10_000_000),
	}
}

// ===========================
// tests
// ===========================

func TestRoundCron_UpcomingToActive(t *testing.T) {
	now := nowMs()
	r := roundUpcoming("round-1", now-60_000)
	repo := newMockRoundRepo([]*model.PresaleRound{r})
	svc := service.NewRoundCronService(repo)

	if err := svc.Tick(context.Background()); err != nil {
		t.Fatalf("Tick returned unexpected error: %v", err)
	}
	if len(repo.advanceCalls) != 1 {
		t.Fatalf("expected 1 AdvanceStatus call, got %d", len(repo.advanceCalls))
	}
	c := repo.advanceCalls[0]
	if c.ID != "round-1" {
		t.Errorf("expected round-1, got %s", c.ID)
	}
	if c.FromStatus != model.RoundStatusUpcoming {
		t.Errorf("expected fromStatus=%s, got %s", model.RoundStatusUpcoming, c.FromStatus)
	}
	if c.ToStatus != model.RoundStatusActive {
		t.Errorf("expected toStatus=%s, got %s", model.RoundStatusActive, c.ToStatus)
	}
}

func TestRoundCron_ActiveToEnded_ByTime(t *testing.T) {
	now := nowMs()
	r := roundActive("round-2", now-3_600_000, now-1_000, decimal.NewFromInt(1000), decimal.NewFromInt(10_000_000))
	repo := newMockRoundRepo([]*model.PresaleRound{r})
	svc := service.NewRoundCronService(repo)

	if err := svc.Tick(context.Background()); err != nil {
		t.Fatalf("Tick returned unexpected error: %v", err)
	}
	if len(repo.advanceCalls) != 1 {
		t.Fatalf("expected 1 AdvanceStatus call, got %d", len(repo.advanceCalls))
	}
	c := repo.advanceCalls[0]
	if c.ID != "round-2" {
		t.Errorf("expected round-2, got %s", c.ID)
	}
	if c.FromStatus != model.RoundStatusActive {
		t.Errorf("expected fromStatus=%s, got %s", model.RoundStatusActive, c.FromStatus)
	}
	if c.ToStatus != model.RoundStatusEnded {
		t.Errorf("expected toStatus=%s, got %s", model.RoundStatusEnded, c.ToStatus)
	}
}

func TestRoundCron_ActiveToEnded_SoldOut(t *testing.T) {
	now := nowMs()
	supply := decimal.NewFromInt(10_000_000)
	// sold == supply，end_ts 未到
	r := roundActive("round-3", now-3_600_000, now+3_600_000, supply, supply)
	repo := newMockRoundRepo([]*model.PresaleRound{r})
	svc := service.NewRoundCronService(repo)

	if err := svc.Tick(context.Background()); err != nil {
		t.Fatalf("Tick returned unexpected error: %v", err)
	}
	if len(repo.advanceCalls) != 1 {
		t.Fatalf("expected 1 AdvanceStatus call, got %d", len(repo.advanceCalls))
	}
	if repo.advanceCalls[0].ToStatus != model.RoundStatusEnded {
		t.Errorf("expected toStatus=ended (sold_out), got %s", repo.advanceCalls[0].ToStatus)
	}
}

func TestRoundCron_ManualOverride_Skipped(t *testing.T) {
	// manual_override=1 轮次不出现在 ListAutoAdvanceable 返回值 → 空列表 → 无 AdvanceStatus 调用
	repo := newMockRoundRepo([]*model.PresaleRound{})
	svc := service.NewRoundCronService(repo)

	if err := svc.Tick(context.Background()); err != nil {
		t.Fatalf("Tick returned unexpected error: %v", err)
	}
	if len(repo.advanceCalls) != 0 {
		t.Errorf("expected 0 AdvanceStatus calls for manual_override=1, got %d", len(repo.advanceCalls))
	}
}

func TestRoundCron_MultipleRounds(t *testing.T) {
	now := nowMs()
	r1 := roundUpcoming("round-A", now-60_000)
	r2 := roundActive("round-B", now-7_200_000, now-30_000, decimal.NewFromInt(500), decimal.NewFromInt(10_000_000))
	repo := newMockRoundRepo([]*model.PresaleRound{r1, r2})
	svc := service.NewRoundCronService(repo)

	if err := svc.Tick(context.Background()); err != nil {
		t.Fatalf("Tick returned unexpected error: %v", err)
	}
	if len(repo.advanceCalls) != 2 {
		t.Fatalf("expected 2 AdvanceStatus calls, got %d", len(repo.advanceCalls))
	}
	byID := make(map[string]string)
	for _, c := range repo.advanceCalls {
		byID[c.ID] = c.ToStatus
	}
	if byID["round-A"] != model.RoundStatusActive {
		t.Errorf("round-A: expected toStatus=active, got %s", byID["round-A"])
	}
	if byID["round-B"] != model.RoundStatusEnded {
		t.Errorf("round-B: expected toStatus=ended, got %s", byID["round-B"])
	}
}

func TestRoundCron_AdvanceError_DoesNotBlock(t *testing.T) {
	now := nowMs()
	r1 := roundUpcoming("round-X", now-60_000)
	r2 := roundUpcoming("round-Y", now-60_000)
	repo := newMockRoundRepo([]*model.PresaleRound{r1, r2})
	repo.advanceErr["round-X"] = errors.New("db error")
	svc := service.NewRoundCronService(repo)

	// Tick 不应因单轮 advance 失败而返错
	if err := svc.Tick(context.Background()); err != nil {
		t.Fatalf("Tick should not return error on single advance failure, got: %v", err)
	}

	called := make(map[string]bool)
	for _, c := range repo.advanceCalls {
		called[c.ID] = true
	}
	if !called["round-Y"] {
		t.Error("round-Y should still be advanced after round-X failure")
	}
}
