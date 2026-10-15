import { describe, it, expect } from "vitest";
import { pickTopFixtures } from "./MatchCarousel";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";

/** Helper to create a minimal fixture with optional odds */
function makeFx(id: number, oddsCount: number, hasOdds = true): SportmonksFixture {
  return {
    id,
    league_id: 8,
    stage_id: 0,
    name: `Team A vs Team B #${id}`,
    starting_at: "2026-03-17 15:00:00",
    starting_at_timestamp: 1773858000,
    state_id: 1,
    has_odds: hasOdds,
    participants: [],
    odds: Array.from(
      { length: oddsCount },
      (_, i): SportmonksOddsEntry => ({
        id: id * 1000 + i,
        fixture_id: id,
        market_id: 1,
        bookmaker_id: 1,
        label: "Home",
        value: "2.00",
        name: null,
        market_description: "Fulltime Result",
        probability: "50%",
        total: null,
        handicap: null,
        sort_order: i,
        winning: false,
        stopped: false,
      })
    ),
  };
}

describe("pickTopFixtures", () => {
  it("returns empty array when no fixtures have odds", () => {
    const fixtures = [makeFx(1, 0, false), makeFx(2, 0)];
    expect(pickTopFixtures(fixtures)).toEqual([]);
  });

  it("returns up to 5 fixtures sorted by odds count", () => {
    const fixtures = [
      makeFx(1, 3),
      makeFx(2, 10),
      makeFx(3, 7),
      makeFx(4, 1),
      makeFx(5, 5),
      makeFx(6, 8),
      makeFx(7, 2),
    ];
    const result = pickTopFixtures(fixtures);
    expect(result).toHaveLength(5);
    expect(result.map((f) => f.id)).toEqual([2, 6, 3, 5, 1]);
  });

  it("respects custom count parameter", () => {
    const fixtures = [makeFx(1, 5), makeFx(2, 3), makeFx(3, 7)];
    const result = pickTopFixtures(fixtures, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(3);
    expect(result[1].id).toBe(1);
  });

  it("filters out fixtures with has_odds=false", () => {
    const fixtures = [makeFx(1, 5, false), makeFx(2, 3)];
    const result = pickTopFixtures(fixtures);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("does not mutate the input array", () => {
    const fixtures = [makeFx(1, 5), makeFx(2, 10)];
    const copy = [...fixtures];
    pickTopFixtures(fixtures);
    expect(fixtures.map((f) => f.id)).toEqual(copy.map((f) => f.id));
  });
});
