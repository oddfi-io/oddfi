package service

import (
	"testing"
	"time"

	"oddfi-web-spider/model"
	"oddfi-web-spider/utils"
)

func TestBuildMoneylineSnapshotsNormalizesThreeWayProbability(t *testing.T) {
	capturedAt := time.Date(2026, 5, 13, 10, 0, 0, 123000000, time.UTC)
	raw := &model.APIFixture{
		ID:      19683229,
		StateID: 1,
		Odds: []model.APIOdd{
			{MarketID: 1, BookmakerID: 20, Label: "Away", Value: "4.00", Probability: "25%"},
			{MarketID: 1, BookmakerID: 20, Label: "Home", Value: "2.00", Probability: "50%"},
			{MarketID: 1, BookmakerID: 20, Label: "Draw", Value: "3.00", Probability: "33.333"},
			{MarketID: 6, BookmakerID: 20, Label: "Home", Value: "1.90"},
		},
	}

	got, complete, err := buildMoneylineSnapshots(raw, capturedAt)
	if err != nil {
		t.Fatalf("buildMoneylineSnapshots error: %v", err)
	}
	if !complete {
		t.Fatal("complete = false, want true")
	}
	if len(got) != 3 {
		t.Fatalf("len = %d, want 3", len(got))
	}
	wantLabels := []string{utils.MoneylineLabelHome, utils.MoneylineLabelDraw, utils.MoneylineLabelAway}
	for i, label := range wantLabels {
		if got[i].Label != label {
			t.Fatalf("snapshot[%d].Label = %s, want %s", i, got[i].Label, label)
		}
	}
	if got[0].NormalizedPct != 46.154 || got[1].NormalizedPct != 30.769 || got[2].NormalizedPct != 23.077 {
		t.Fatalf("normalized pct = %.3f %.3f %.3f, want 46.154 30.769 23.077", got[0].NormalizedPct, got[1].NormalizedPct, got[2].NormalizedPct)
	}
	if !got[0].CapturedAt.Equal(capturedAt) {
		t.Fatalf("captured_at = %v, want %v", got[0].CapturedAt, capturedAt)
	}
}

func TestInitialMoneylinePollAtStaggersStartupWithinHalfCadence(t *testing.T) {
	now := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
	fixture := model.Fixture{
		ID:         19683229,
		StateID:    1,
		StartingAt: now.Add(48 * time.Hour),
	}

	got := initialMoneylinePollAt(now, fixture)
	if got.Before(now) {
		t.Fatalf("initial poll = %v, should not be before now %v", got, now)
	}
	if got.Sub(now) >= 10*time.Minute {
		t.Fatalf("initial poll offset = %v, want less than 10m", got.Sub(now))
	}
}

func TestBuildMoneylineSnapshotsSkipsIncompleteTriplet(t *testing.T) {
	raw := &model.APIFixture{
		ID:      19683229,
		StateID: 1,
		Odds: []model.APIOdd{
			{MarketID: 1, BookmakerID: 20, Label: "Home", Value: "2.00"},
			{MarketID: 1, BookmakerID: 20, Label: "Away", Value: "4.00"},
		},
	}

	got, complete, err := buildMoneylineSnapshots(raw, time.Now())
	if err != nil {
		t.Fatalf("buildMoneylineSnapshots error: %v", err)
	}
	if complete {
		t.Fatal("complete = true, want false")
	}
	if got != nil {
		t.Fatalf("snapshots = %+v, want nil", got)
	}
}
