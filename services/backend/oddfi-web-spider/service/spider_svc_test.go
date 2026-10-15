package service

import (
	"strings"
	"testing"

	"oddfi-web-spider/model"
)

func TestBuildFixtureResultStateOnly(t *testing.T) {
	raw := model.APIFixture{
		ID:      1001,
		StateID: 1,
		State: model.APIState{
			ID:    1,
			State: "NS",
			Name:  "Not Started",
		},
	}

	result, ok := buildFixtureResult(raw)
	if !ok {
		t.Fatalf("expected fixture result to be built")
	}
	if result.FixtureID != raw.ID {
		t.Fatalf("unexpected fixture id: got %d want %d", result.FixtureID, raw.ID)
	}
	if result.StateID != 1 || result.StateCode != "NS" || result.StateName != "Not Started" {
		t.Fatalf("unexpected state payload: %+v", result)
	}
	if result.HomeScoreFull != 0 || result.AwayScoreFull != 0 || result.HomeScoreHalf != 0 || result.AwayScoreHalf != 0 {
		t.Fatalf("scores should stay zero when API does not return scores: %+v", result)
	}
	if result.RawScoreData != "[]" {
		t.Fatalf("expected empty raw score data, got %s", result.RawScoreData)
	}
	if !strings.Contains(result.RawStateDate, "\"id\":1") {
		t.Fatalf("expected raw state payload to contain state id, got %s", result.RawStateDate)
	}
	if result.SettlementStatus != "PENDING" {
		t.Fatalf("unexpected settlement status: %s", result.SettlementStatus)
	}
}

func TestBuildFixtureResultExtraTimeAndPenalties(t *testing.T) {
	raw := model.APIFixture{
		ID:      1002,
		StateID: 8,
		State: model.APIState{
			ID:    8,
			State: "FT_PEN",
			Name:  "Penalties",
		},
		Scores: []model.APIScore{
			newScore("1ST_HALF", "home", 1),
			newScore("1ST_HALF", "away", 0),
			newScore("2ND_HALF", "home", 1),
			newScore("2ND_HALF", "away", 1),
			newScore("CURRENT", "home", 2),
			newScore("CURRENT", "away", 2),
			newScore("EXTRA_TIME", "home", 2),
			newScore("EXTRA_TIME", "away", 2),
			newScore("PENALTIES", "home", 4),
			newScore("PENALTIES", "away", 3),
		},
	}

	result, ok := buildFixtureResult(raw)
	if !ok {
		t.Fatalf("expected fixture result to be built")
	}
	if result.HomeScoreHalf != 1 || result.AwayScoreHalf != 0 {
		t.Fatalf("unexpected half-time score: %+v", result)
	}
	if result.HomeScoreFull != 1 || result.AwayScoreFull != 1 {
		t.Fatalf("unexpected full-time score for FT_PEN: %+v", result)
	}
	if result.HomeScoreExtra == nil || result.AwayScoreExtra == nil || *result.HomeScoreExtra != 2 || *result.AwayScoreExtra != 2 {
		t.Fatalf("unexpected extra-time score: %+v", result)
	}
	if result.HomeScorePenalty == nil || result.AwayScorePenalty == nil || *result.HomeScorePenalty != 4 || *result.AwayScorePenalty != 3 {
		t.Fatalf("unexpected penalty score: %+v", result)
	}
	if !strings.Contains(result.RawScoreData, "\"description\":\"CURRENT\"") {
		t.Fatalf("expected raw score payload to be serialized, got %s", result.RawScoreData)
	}
}

func TestBuildFixtureResultWithoutStateOrScores(t *testing.T) {
	if _, ok := buildFixtureResult(model.APIFixture{ID: 1003}); ok {
		t.Fatalf("expected empty fixture payload to be skipped")
	}
}

func newScore(description, participant string, goals int) model.APIScore {
	score := model.APIScore{
		Description: description,
		Score: struct {
			Goals       int    `json:"goals"`
			Participant string `json:"participant"`
		}{
			Goals:       goals,
			Participant: participant,
		},
	}
	return score
}
