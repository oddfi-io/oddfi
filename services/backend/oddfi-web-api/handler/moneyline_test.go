package handler

import (
	"fmt"
	"testing"
	"time"

	"oddfi-web-api/model"
)

func TestDownsampleMoneylineAutoKeepsPrematchAtMost100AndLiveFull(t *testing.T) {
	points := make([]model.MoneylineHistoryPoint, 0, 125)
	for i := 0; i < 120; i++ {
		points = append(points, model.MoneylineHistoryPoint{CapturedAt: fmt.Sprintf("pre-%03d", i), StateID: 1})
	}
	for i := 0; i < 5; i++ {
		points = append(points, model.MoneylineHistoryPoint{CapturedAt: fmt.Sprintf("live-%03d", i), StateID: 22})
	}

	got := downsampleMoneylineAuto(points)
	if len(got) != 105 {
		t.Fatalf("len = %d, want 105", len(got))
	}
	if got[0].CapturedAt != "pre-000" {
		t.Fatalf("first = %s, want pre-000", got[0].CapturedAt)
	}
	if got[99].StateID != 1 {
		t.Fatalf("last prematch state = %d, want 1", got[99].StateID)
	}
	if got[100].CapturedAt != "live-000" || got[104].CapturedAt != "live-004" {
		t.Fatalf("live tail = %s...%s, want live-000...live-004", got[100].CapturedAt, got[104].CapturedAt)
	}
}

func TestBuildMoneylineHistoryResponseGroupsAndFormats(t *testing.T) {
	capturedAt := time.Date(2026, 5, 13, 10, 0, 0, 123000000, time.UTC)
	fixtureStart := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	fixture := &model.FixtureDB{ID: 19683229, StateID: 1, StartingAt: fixtureStart}
	snapshots := []model.MoneylineSnapshotDB{
		{Label: "Home", Value: 2.5, Probability: 40, NormalizedPct: 39.8, StateID: 1, CapturedAt: capturedAt},
		{Label: "Draw", Value: 3.125, Probability: 32, NormalizedPct: 31.7, StateID: 1, CapturedAt: capturedAt},
		{Label: "Away", Value: 2, Probability: 50, NormalizedPct: 28.5, StateID: 1, CapturedAt: capturedAt},
	}

	got := buildMoneylineHistoryResponse(snapshots, fixture, "auto")
	if got.Fixture == nil || got.Fixture.ID != fixture.ID || got.Fixture.StartingAt != fixtureStart.Format(time.DateTime) {
		t.Fatalf("fixture = %+v, want id/start populated", got.Fixture)
	}
	if len(got.Home) != 1 || got.Home[0].Value != "2.50" {
		t.Fatalf("home = %+v, want value 2.50", got.Home)
	}
	if len(got.Draw) != 1 || got.Draw[0].Value != "3.125" {
		t.Fatalf("draw = %+v, want value 3.125", got.Draw)
	}
	if len(got.Away) != 1 || got.Away[0].Value != "2.00" {
		t.Fatalf("away = %+v, want value 2.00", got.Away)
	}
}
