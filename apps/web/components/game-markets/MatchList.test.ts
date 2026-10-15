import { describe, it, expect } from "vitest";
import { groupByLeague } from "./MatchList";
import { getFixtureStatus } from "@/lib/fixture-state";
import type { SportmonksFixture } from "@/types/api";

const makeFx = (id: number, leagueId: number, stateId = 1): SportmonksFixture =>
  ({
    id,
    league_id: leagueId,
    stage_id: 0,
    name: `Fixture ${id}`,
    starting_at: "2026-03-17 15:00:00",
    starting_at_timestamp: 1773858000,
    state_id: stateId,
    has_odds: true,
    odds: [],
    participants: [],
  }) as SportmonksFixture;

describe("groupByLeague", () => {
  it("groups fixtures by league_id preserving insertion order", () => {
    const fixtures = [makeFx(1, 8), makeFx(2, 82), makeFx(3, 8), makeFx(4, 301)];

    const result = groupByLeague(fixtures);

    expect(result.size).toBe(3);
    expect(result.get(8)?.map((f) => f.id)).toEqual([1, 3]);
    expect(result.get(82)?.map((f) => f.id)).toEqual([2]);
    expect(result.get(301)?.map((f) => f.id)).toEqual([4]);
  });

  it("returns empty map for empty input", () => {
    expect(groupByLeague([]).size).toBe(0);
  });

  it("handles single fixture", () => {
    const result = groupByLeague([makeFx(1, 8)]);
    expect(result.size).toBe(1);
    expect(result.get(8)?.length).toBe(1);
  });
});

describe("MatchList filtering logic", () => {
  it("getFixtureStatus filters finished matches", () => {
    // state_id=5 is Full Time (finished)
    expect(getFixtureStatus(5)).toBe("finished");
    // state_id=1 is Not Started (upcoming)
    expect(getFixtureStatus(1)).toBe("upcoming");
    // state_id=2 is 1st Half (live)
    expect(getFixtureStatus(2)).toBe("live");
    // BUG-029: state_id=22 is 2nd Half (live) — 旧表误判 finished 整场消失
    expect(getFixtureStatus(22)).toBe("live");
  });

  it("live fixtures should sort before upcoming", () => {
    const fixtures = [
      makeFx(1, 8, 1), // upcoming (Not Started)
      makeFx(2, 8, 2), // live (1st Half)
      makeFx(3, 8, 5), // finished (Full Time)
      makeFx(4, 8, 1), // upcoming
      makeFx(5, 8, 4), // live (Break)
      makeFx(6, 8, 22), // live (2nd Half) — BUG-029 钉子
    ];

    // Simulate the filtering: exclude finished
    const filtered = fixtures.filter((f) => {
      const status = getFixtureStatus(f.state_id);
      return status === "live" || status === "upcoming";
    });
    expect(filtered).toHaveLength(5);
    expect(filtered.map((f) => f.id)).toEqual([1, 2, 4, 5, 6]);

    // Simulate the sorting: live first, then upcoming
    const live = filtered.filter((f) => getFixtureStatus(f.state_id) === "live");
    const upcoming = filtered.filter((f) => getFixtureStatus(f.state_id) === "upcoming");
    const sorted = [...live, ...upcoming];

    expect(sorted.map((f) => f.id)).toEqual([2, 5, 6, 1, 4]);
  });

  it("all finished fixtures result in empty list", () => {
    const fixtures = [
      makeFx(1, 8, 5), // Full Time
      makeFx(2, 8, 8), // After Extra Time
      makeFx(3, 8, 12), // Cancelled
    ];

    const filtered = fixtures.filter((f) => {
      const status = getFixtureStatus(f.state_id);
      return status === "live" || status === "upcoming";
    });
    expect(filtered).toHaveLength(0);
  });
});
