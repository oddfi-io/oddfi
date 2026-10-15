package handler

import (
	"testing"

	"oddfi-web-api/model"
)

func TestSortLiquidityFixturesByBetCountThenStartTime(t *testing.T) {
	fixtures := []model.Fixture{
		{ID: 3, StartAtTimeStamp: 300},
		{ID: 1, StartAtTimeStamp: 200},
		{ID: 2, StartAtTimeStamp: 100},
	}
	counts := map[int]int64{
		1: 5,
		2: 5,
		3: 9,
	}

	sortLiquidityFixtures(fixtures, counts)

	got := []int{fixtures[0].ID, fixtures[1].ID, fixtures[2].ID}
	want := []int{3, 2, 1}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("sorted ids = %v, want %v", got, want)
		}
	}
}

func TestFilterLiquidityFixturesByNameUsesFixtureName(t *testing.T) {
	fixtures := []model.Fixture{
		{ID: 1, Name: "Arsenal vs Chelsea", Participants: []model.APIParticipant{{Name: "Unrelated"}}},
		{ID: 2, Name: "Liverpool vs Tottenham", Participants: []model.APIParticipant{{Name: "Chelsea"}}},
	}

	got := filterLiquidityFixturesByName(fixtures, "arsenal")
	if len(got) != 1 || got[0].ID != 1 {
		t.Fatalf("filtered fixtures = %+v, want fixture 1", got)
	}
}

func TestPaginateLiquidityFixtures(t *testing.T) {
	fixtures := []model.Fixture{{ID: 1}, {ID: 2}, {ID: 3}}

	got, pagination := paginateLiquidityFixtures(fixtures, 1, 2)

	if len(got) != 2 || got[0].ID != 1 || got[1].ID != 2 {
		t.Fatalf("page fixtures = %+v, want first two", got)
	}
	if pagination.Count != 2 || pagination.PerPage != 2 || pagination.CurrentPage != 1 || !pagination.HasMore {
		t.Fatalf("pagination = %+v, want count=2 per_page=2 current_page=1 has_more=true", pagination)
	}
}
