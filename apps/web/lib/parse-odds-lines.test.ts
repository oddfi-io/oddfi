import { describe, it, expect } from "vitest";
import { parseOddsLines } from "./parse-odds-lines";
import type { SportmonksOddsEntry } from "@/types/api";

function makeOdds(overrides: Partial<SportmonksOddsEntry> = {}): SportmonksOddsEntry {
  return {
    id: 1,
    fixture_id: 100,
    market_id: 1,
    bookmaker_id: 1,
    label: "Home",
    value: "1.90",
    name: null,
    market_description: "Asian Handicap",
    probability: "52.63",
    total: null,
    handicap: null,
    sort_order: 1,
    winning: false,
    stopped: false,
    ...overrides,
  };
}

describe("parseOddsLines — asian_handicap", () => {
  it("pairs Home and Away odds by opposite handicap values (real API format)", () => {
    const odds = [
      makeOdds({ id: 1, label: "1", value: "1.85", handicap: "-0.5" }),
      makeOdds({ id: 2, label: "2", value: "2.05", handicap: "+0.5" }),
      makeOdds({ id: 3, label: "1", value: "1.70", handicap: "-1.0" }),
      makeOdds({ id: 4, label: "2", value: "2.20", handicap: "+1.0" }),
    ];

    const lines = parseOddsLines(odds, "asian_handicap");

    expect(lines).toHaveLength(2);
    expect(lines[0].lineValue).toBe("-1.0");
    expect(lines[0].homeOdds).toBe("1.70");
    expect(lines[0].awayOdds).toBe("2.20");
    expect(lines[0].homeHandicap).toBe("-1.0");
    expect(lines[0].awayHandicap).toBe("+1.0");
    expect(lines[1].lineValue).toBe("-0.5");
    expect(lines[1].homeOdds).toBe("1.85");
    expect(lines[1].awayOdds).toBe("2.05");
  });

  it("pairs by same handicap value when both sides share it (legacy format)", () => {
    const odds = [
      makeOdds({ id: 1, label: "Home", value: "1.85", handicap: "-0.5" }),
      makeOdds({ id: 2, label: "Away", value: "2.05", handicap: "-0.5" }),
    ];

    const lines = parseOddsLines(odds, "asian_handicap");

    expect(lines).toHaveLength(1);
    expect(lines[0].homeOdds).toBe("1.85");
    expect(lines[0].awayOdds).toBe("2.05");
    expect(lines[0].awayHandicap).toBe("-0.5");
  });

  it("sorts lines by numeric value ascending", () => {
    const odds = [
      makeOdds({ id: 1, label: "1", value: "2.00", handicap: "0.5" }),
      makeOdds({ id: 2, label: "2", value: "1.80", handicap: "-0.5" }),
      makeOdds({ id: 3, label: "1", value: "1.90", handicap: "-0.5" }),
      makeOdds({ id: 4, label: "2", value: "2.00", handicap: "0.5" }),
    ];

    const lines = parseOddsLines(odds, "asian_handicap");

    expect(lines[0].lineValue).toBe("-0.5");
    expect(lines[1].lineValue).toBe("0.5");
  });

  it("handles missing Away side gracefully", () => {
    const odds = [makeOdds({ id: 1, label: "1", value: "1.85", handicap: "-0.5" })];

    const lines = parseOddsLines(odds, "asian_handicap");

    expect(lines).toHaveLength(1);
    expect(lines[0].homeOdds).toBe("1.85");
    expect(lines[0].awayOdds).toBe("—");
  });
});

describe("parseOddsLines — asian_total", () => {
  it("pairs Over and Under odds by total value", () => {
    const odds = [
      makeOdds({ id: 1, label: "Over", value: "1.95", total: "2.5", handicap: null }),
      makeOdds({ id: 2, label: "Under", value: "1.90", total: "2.5", handicap: null }),
    ];

    const lines = parseOddsLines(odds, "asian_total");

    expect(lines).toHaveLength(1);
    expect(lines[0].lineValue).toBe("2.5");
    expect(lines[0].homeOdds).toBe("1.95");
    expect(lines[0].awayOdds).toBe("1.90");
    expect(lines[0].homeHandicap).toBeUndefined();
    expect(lines[0].awayHandicap).toBeUndefined();
  });

  it("returns empty array for no matching odds", () => {
    const lines = parseOddsLines([], "asian_total");
    expect(lines).toEqual([]);
  });

  it("filters out entries with empty string total (testnet mock data)", () => {
    const odds = [
      makeOdds({ id: 1, label: "Over", value: "1.95", total: "", handicap: null }),
      makeOdds({ id: 2, label: "Under", value: "1.90", total: "", handicap: null }),
    ];
    const lines = parseOddsLines(odds, "asian_total");
    expect(lines).toHaveLength(0);
  });
});

describe("parseOddsLines — dedupe by lineValue (ENH-030)", () => {
  it("asian_handicap: 同盘口 Home + 1 双别名条目 → 输出去重保留首条", () => {
    // 后端真实场景：同 +0.5 盘口出现 Home 和 1 两种 label 别名（不同 bookmaker）
    const odds = [
      makeOdds({ id: 1, label: "Home", value: "1.95", handicap: "+0.5" }),
      makeOdds({ id: 2, label: "Away", value: "1.85", handicap: "-0.5" }),
      makeOdds({ id: 3, label: "1", value: "1.93", handicap: "+0.5" }),
      makeOdds({ id: 4, label: "2", value: "1.87", handicap: "-0.5" }),
    ];

    const lines = parseOddsLines(odds, "asian_handicap");

    // 去重后只剩 1 行 +0.5（避免 React duplicate key 报错）
    expect(lines).toHaveLength(1);
    expect(lines[0].lineValue).toBe("+0.5");
    // 保留首条（id=1 Home/1.95），后续重复条目被丢弃
    expect(lines[0].homeOdds).toBe("1.95");
  });

  it("asian_total: 同 lineValue 多条目 → 输出去重保留首条", () => {
    const odds = [
      makeOdds({ id: 1, label: "Over", value: "1.95", total: "2.5", handicap: null }),
      makeOdds({ id: 2, label: "Under", value: "1.90", total: "2.5", handicap: null }),
      makeOdds({ id: 3, label: "Over", value: "1.93", total: "2.5", handicap: null }),
      makeOdds({ id: 4, label: "Under", value: "1.88", total: "2.5", handicap: null }),
    ];

    const lines = parseOddsLines(odds, "asian_total");

    expect(lines).toHaveLength(1);
    expect(lines[0].lineValue).toBe("2.5");
    expect(lines[0].homeOdds).toBe("1.95");
  });
});

describe("parseOddsLines — empty string handicap/total filtering", () => {
  it("filters out asian_handicap entries with empty string handicap", () => {
    const odds = [
      makeOdds({ id: 1, label: "Home", value: "1.85", handicap: "" }),
      makeOdds({ id: 2, label: "Away", value: "2.05", handicap: "" }),
    ];
    const lines = parseOddsLines(odds, "asian_handicap");
    expect(lines).toHaveLength(0);
  });

  it("keeps valid entries when mixed with empty string entries", () => {
    const odds = [
      makeOdds({ id: 1, label: "Home", value: "1.85", handicap: "-0.5" }),
      makeOdds({ id: 2, label: "Away", value: "2.05", handicap: "+0.5" }),
      makeOdds({ id: 3, label: "Home", value: "1.90", handicap: "" }),
      makeOdds({ id: 4, label: "Away", value: "2.00", handicap: "" }),
    ];
    const lines = parseOddsLines(odds, "asian_handicap");
    expect(lines).toHaveLength(1);
    expect(lines[0].lineValue).toBe("-0.5");
  });
});
