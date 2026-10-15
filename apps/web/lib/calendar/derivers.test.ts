import { describe, it, expect } from "vitest";
import {
  getMarketStatus,
  getStageId,
  getTeamShortCode,
  getHomeAway,
  buildStageOrdinalMap,
} from "./derivers";
import type { SportmonksFixture, SportmonksParticipant } from "@/types/api";

function fakeFixture(overrides: Partial<SportmonksFixture> = {}): SportmonksFixture {
  return {
    id: 1,
    league_id: 732,
    stage_id: 77478590,
    stage_name: "",
    name: "Mexico vs South Africa",
    starting_at: "2026-06-11 19:00:00",
    starting_at_timestamp: 1781204400,
    state_id: 1,
    has_odds: false,
    participants: [],
    odds: [],
    league: {} as never,
    statistics: [],
    enable_bet: false,
    ...overrides,
  } as SportmonksFixture;
}

describe("getMarketStatus", () => {
  it("returns 'open' only when both has_odds && enable_bet are true", () => {
    expect(getMarketStatus(fakeFixture({ has_odds: true, enable_bet: true }))).toBe("open");
  });

  it("returns 'pre_open' when has_odds is false", () => {
    expect(getMarketStatus(fakeFixture({ has_odds: false, enable_bet: true }))).toBe("pre_open");
  });

  it("returns 'pre_open' when enable_bet is false", () => {
    expect(getMarketStatus(fakeFixture({ has_odds: true, enable_bet: false }))).toBe("pre_open");
  });

  it("returns 'pre_open' when both are false (default mock state)", () => {
    expect(getMarketStatus(fakeFixture())).toBe("pre_open");
  });
});

describe("getStageId", () => {
  it("maps known SportMonks stage_id to CalendarStageId", () => {
    expect(getStageId(fakeFixture({ stage_id: 77478590 }))).toBe("group");
    expect(getStageId(fakeFixture({ stage_id: 77479086 }))).toBe("r32");
    expect(getStageId(fakeFixture({ stage_id: 77479087 }))).toBe("r16");
    expect(getStageId(fakeFixture({ stage_id: 77479088 }))).toBe("qf");
    expect(getStageId(fakeFixture({ stage_id: 77479089 }))).toBe("sf");
    expect(getStageId(fakeFixture({ stage_id: 77479090 }))).toBe("final");
    expect(getStageId(fakeFixture({ stage_id: 77479091 }))).toBe("third");
  });

  it("falls back to 'group' for unknown stage_id", () => {
    expect(getStageId(fakeFixture({ stage_id: 99999 }))).toBe("group");
  });
});

describe("getTeamShortCode", () => {
  it("uses short_code when present", () => {
    const p = { short_code: "ARG", name: "Argentina" } as SportmonksParticipant;
    expect(getTeamShortCode(p)).toBe("ARG");
  });

  it("derives from name when short_code missing", () => {
    const p = { short_code: "", name: "Argentina" } as SportmonksParticipant;
    expect(getTeamShortCode(p)).toBe("ARG");
  });

  it("returns fallback when participant undefined", () => {
    expect(getTeamShortCode(undefined, "TBD")).toBe("TBD");
  });
});

describe("getHomeAway", () => {
  it("identifies home and away by meta.location", () => {
    const fixture = fakeFixture({
      participants: [
        { id: 1, name: "Argentina", meta: { location: "home" } } as never,
        { id: 2, name: "Peru", meta: { location: "away" } } as never,
      ],
    });
    const { home, away } = getHomeAway(fixture);
    expect(home?.name).toBe("Argentina");
    expect(away?.name).toBe("Peru");
  });

  it("returns undefined for missing locations (defensive)", () => {
    const fixture = fakeFixture({ participants: [] });
    const { home, away } = getHomeAway(fixture);
    expect(home).toBeUndefined();
    expect(away).toBeUndefined();
  });
});

describe("buildStageOrdinalMap", () => {
  it("assigns 1-indexed ordinals per stage by kickoff order", () => {
    const fixtures = [
      fakeFixture({ id: 10, stage_id: 77478590, starting_at_timestamp: 300 }),
      fakeFixture({ id: 11, stage_id: 77478590, starting_at_timestamp: 100 }),
      fakeFixture({ id: 12, stage_id: 77478590, starting_at_timestamp: 200 }),
      fakeFixture({ id: 20, stage_id: 77479086, starting_at_timestamp: 50 }),
      fakeFixture({ id: 21, stage_id: 77479086, starting_at_timestamp: 60 }),
    ];
    const map = buildStageOrdinalMap(fixtures);
    // group: id 11 (t=100) → M1, id 12 (t=200) → M2, id 10 (t=300) → M3
    expect(map.get(11)).toBe(1);
    expect(map.get(12)).toBe(2);
    expect(map.get(10)).toBe(3);
    // r32: id 20 → M1, id 21 → M2 — ordinal 是 per-stage 不跨段累计
    expect(map.get(20)).toBe(1);
    expect(map.get(21)).toBe(2);
  });

  it("returns empty map for empty fixtures", () => {
    expect(buildStageOrdinalMap([]).size).toBe(0);
  });
});
