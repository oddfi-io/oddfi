package handler

import (
	"testing"
	"time"

	"oddfi-web-api/model"
)

func TestApplyFixturesEnableBetWritesBackToSlice(t *testing.T) {
	fixtures := []model.Fixture{
		{StateID: 1, Odds: []model.APIOdd{{ID: 1001}}},
		{StateID: 13, Odds: []model.APIOdd{{ID: 1002}}},
		{StateID: 2, Odds: []model.APIOdd{{ID: 1003}}, EnableBet: true},
		{StateID: 1, EnableBet: true},
	}

	applyFixturesEnableBet(fixtures)

	tests := []struct {
		name string
		got  bool
		want bool
	}{
		{name: "enabled state with odds", got: fixtures[0].EnableBet, want: true},
		{name: "another enabled state with odds", got: fixtures[1].EnableBet, want: true},
		{name: "disabled state resets previous value", got: fixtures[2].EnableBet, want: false},
		{name: "enabled state without odds stays disabled", got: fixtures[3].EnableBet, want: false},
	}

	for _, tt := range tests {
		if tt.got != tt.want {
			t.Fatalf("%s: EnableBet = %v, want %v", tt.name, tt.got, tt.want)
		}
	}
}

func TestApplyMockActivityUsesDocumentedContract(t *testing.T) {
	now := time.Date(2026, 4, 29, 12, 0, 0, 0, time.Local)
	closeAt := now.Add(123 * time.Second)
	fixture := model.Fixture{
		ID:               MockUCLFixtureID,
		StartingAt:       closeAt.Format(time.DateTime),
		StartAtTimeStamp: closeAt.Unix(),
	}

	applyMockActivity(&fixture, now)

	if fixture.MockActivity == nil {
		t.Fatal("MockActivity = nil, want populated")
	}
	got := fixture.MockActivity
	if got.ActivityID != MockUCLActivityID {
		t.Fatalf("ActivityID = %q, want %q", got.ActivityID, MockUCLActivityID)
	}
	if got.PeriodSec != 300 || got.BetCloseSec != 240 || got.SettleAtSec != 300 {
		t.Fatalf("period fields = (%d,%d,%d), want (300,240,300)", got.PeriodSec, got.BetCloseSec, got.SettleAtSec)
	}
	if got.Phase != "open" || got.RemainingSec != 123 {
		t.Fatalf("phase/remaining = (%q,%d), want (open,123)", got.Phase, got.RemainingSec)
	}
	if got.BetCloseAt != closeAt.Format(time.DateTime) {
		t.Fatalf("BetCloseAt = %q, want %q", got.BetCloseAt, closeAt.Format(time.DateTime))
	}
	wantSettleAt := closeAt.Add(60 * time.Second).Format(time.DateTime)
	if got.SettleAt != wantSettleAt {
		t.Fatalf("SettleAt = %q, want %q", got.SettleAt, wantSettleAt)
	}
}

func TestApplyMockActivityRemainingSecDuringSealedPhase(t *testing.T) {
	now := time.Date(2026, 4, 29, 12, 4, 10, 0, time.Local)
	closeAt := now.Add(-10 * time.Second)
	fixture := model.Fixture{
		ID:               MockUCLFixtureID,
		StartAtTimeStamp: closeAt.Unix(),
	}

	applyMockActivity(&fixture, now)

	if fixture.MockActivity == nil {
		t.Fatal("MockActivity = nil, want populated")
	}
	// 封盘期的 remaining_sec 要倒向结算点，而不是固定为 0，否则前端无法展示封盘等待结算倒计时。
	if fixture.MockActivity.Phase != "sealed" || fixture.MockActivity.RemainingSec != 50 {
		t.Fatalf("phase/remaining = (%q,%d), want (sealed,50)", fixture.MockActivity.Phase, fixture.MockActivity.RemainingSec)
	}
}
