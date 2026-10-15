import { describe, it, expect } from "vitest";
import { getCellPosition, groupFixturesByCell, getStageStartCol } from "./grid-layout";
import type { SportmonksFixture } from "@/types/api";

function fakeFixture(unixSeconds: number, id = 1): SportmonksFixture {
  return {
    id,
    league_id: 732,
    stage_id: 77478590,
    stage_name: "",
    name: "",
    starting_at: "",
    starting_at_timestamp: unixSeconds,
    state_id: 1,
    has_odds: false,
    participants: [],
    odds: [],
    league: {} as never,
    statistics: [],
    enable_bet: false,
  } as SportmonksFixture;
}

describe("getCellPosition", () => {
  it("places 2026-06-11 19:00 UTC at (gridRow=6, gridCol=2) in UTC mode", () => {
    // 19:00 UTC → Y_TIMES index 4 → gridRow = 4 + 2 = 6
    // dates[0] = 2026-06-11 → colIndex 0 → gridCol = 0 + 2 = 2
    const fixture = fakeFixture(Date.parse("2026-06-11T19:00:00Z") / 1000);
    const dates = ["2026-06-11", "2026-06-12", "2026-06-13"];
    expect(getCellPosition(fixture, "UTC", dates)).toEqual({ gridRow: 6, gridCol: 2 });
  });

  it("returns null when fixture date not in dates[]", () => {
    const fixture = fakeFixture(Date.parse("2026-06-30T19:00:00Z") / 1000);
    const dates = ["2026-06-11"];
    expect(getCellPosition(fixture, "UTC", dates)).toBeNull();
  });

  it("returns null when fixture hour not in Y_TIMES_UTC", () => {
    // 09:00 UTC 不在 Y_TIMES_UTC（'15'~'04' 区间）
    const fixture = fakeFixture(Date.parse("2026-06-11T09:00:00Z") / 1000);
    const dates = ["2026-06-11"];
    expect(getCellPosition(fixture, "UTC", dates)).toBeNull();
  });

  it("re-bins to next column under Asia/Shanghai when UTC time crosses midnight", () => {
    // 2026-06-11 19:00 UTC → 2026-06-12 03:00 CST
    const fixture = fakeFixture(Date.parse("2026-06-11T19:00:00Z") / 1000);
    const dates = ["2026-06-11", "2026-06-12"];
    const pos = getCellPosition(fixture, "Asia/Shanghai", dates);
    expect(pos).toEqual({
      // hour '03' → Y_TIMES_UTC index 12 → gridRow 14
      gridRow: 14,
      // dates[1] = 2026-06-12 → gridCol 3
      gridCol: 3,
    });
  });

  it("returns null when re-binning lands on non-match day", () => {
    // 假设 2026-06-12 是休赛日（不在 dates）
    const fixture = fakeFixture(Date.parse("2026-06-11T19:00:00Z") / 1000);
    const dates = ["2026-06-11"]; // 缺 2026-06-12
    expect(getCellPosition(fixture, "Asia/Shanghai", dates)).toBeNull();
  });
});

describe("groupFixturesByCell", () => {
  it("groups same-cell fixtures together (FIFA 反默契 pair)", () => {
    const f1 = fakeFixture(Date.parse("2026-06-25T19:00:00Z") / 1000, 100);
    const f2 = fakeFixture(Date.parse("2026-06-25T19:00:00Z") / 1000, 101);
    const f3 = fakeFixture(Date.parse("2026-06-25T22:00:00Z") / 1000, 102);
    const dates = ["2026-06-25"];
    const map = groupFixturesByCell([f1, f2, f3], "UTC", dates);
    // 19:00 cell 2 fixtures
    const pair = [...map.values()].find((list) => list.length === 2);
    expect(pair).toBeDefined();
    expect(pair!.map((f) => f.id).sort()).toEqual([100, 101]);
    // 22:00 cell 1 fixture
    const single = [...map.values()].find((list) => list.length === 1);
    expect(single).toBeDefined();
    expect(single![0].id).toBe(102);
  });

  it("skips fixtures that fall outside grid", () => {
    const f1 = fakeFixture(Date.parse("2026-06-11T09:00:00Z") / 1000); // 09:00 不在轴
    const f2 = fakeFixture(Date.parse("2026-06-11T19:00:00Z") / 1000); // OK
    const dates = ["2026-06-11"];
    const map = groupFixturesByCell([f1, f2], "UTC", dates);
    expect([...map.values()].flat()).toHaveLength(1);
  });
});

describe("getStageStartCol", () => {
  it("returns first index of date matching stage_id", () => {
    const dates = [
      { date_iso: "2026-06-11", stage_id: "group" },
      { date_iso: "2026-06-12", stage_id: "group" },
      { date_iso: "2026-06-29", stage_id: "r32" },
    ];
    expect(getStageStartCol("group", dates)).toBe(0);
    expect(getStageStartCol("r32", dates)).toBe(2);
  });

  it("returns -1 when stage not found", () => {
    expect(getStageStartCol("final", [])).toBe(-1);
  });
});
