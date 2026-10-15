import { describe, it, expect } from "vitest";
import { mergeAndDedupFixtures, filterEndedFixtures, filterTestFixtures } from "./useUclWcFixtures";
import type { SportmonksFixture } from "@/types/api";

function makeFx(
  id: number,
  startingAtTimestamp: number,
  participants: string[] = []
): SportmonksFixture {
  return {
    id,
    league_id: 2,
    stage_id: 0,
    name: `Fixture ${id}`,
    starting_at: "",
    starting_at_timestamp: startingAtTimestamp,
    state_id: 1,
    has_odds: true,
    odds: [],
    participants: participants.map((name) => ({ name })),
  } as unknown as SportmonksFixture;
}

describe("mergeAndDedupFixtures", () => {
  it("happy path: merges UCL + WC pages and sorts by starting_at_timestamp asc", () => {
    const uclPage = [makeFx(1, 1762848000), makeFx(2, 1763020800)];
    const wcPage = [makeFx(10, 1762761600), makeFx(11, 1762934400)];
    const result = mergeAndDedupFixtures([uclPage, wcPage]);

    expect(result.map((f) => f.id)).toEqual([10, 1, 11, 2]);
    expect(result.map((f) => f.starting_at_timestamp)).toEqual([
      1762761600, 1762848000, 1762934400, 1763020800,
    ]);
  });

  it("dedupes fixtures with the same id (first occurrence wins)", () => {
    const pageA = [makeFx(1, 1762848000, ["Real Madrid"])];
    const pageB = [makeFx(1, 1762848000, ["Different Team"])];
    const result = mergeAndDedupFixtures([pageA, pageB]);

    expect(result).toHaveLength(1);
    expect(result[0].participants[0].name).toBe("Real Madrid");
  });

  it("client-side search matches participant names case-insensitively", () => {
    const fixtures = [
      makeFx(1, 1, ["Real Madrid", "Manchester City"]),
      makeFx(2, 2, ["Bayern Munich", "PSG"]),
      makeFx(3, 3, ["Real Sociedad", "Arsenal"]),
    ];
    const result = mergeAndDedupFixtures([fixtures], "real");

    expect(result.map((f) => f.id)).toEqual([1, 3]);
  });

  it("search with whitespace-only string returns full list (treated as empty)", () => {
    const fixtures = [makeFx(1, 1, ["Brazil"]), makeFx(2, 2, ["Argentina"])];
    const result = mergeAndDedupFixtures([fixtures], "   ");

    expect(result.map((f) => f.id)).toEqual([1, 2]);
  });

  it("ignores undefined / not-yet-loaded pages", () => {
    const result = mergeAndDedupFixtures([undefined, [makeFx(1, 1)], undefined]);
    expect(result.map((f) => f.id)).toEqual([1]);
  });

  it("returns empty array when all pages undefined", () => {
    expect(mergeAndDedupFixtures([undefined, undefined])).toEqual([]);
  });

  it("preserves stable sort for fixtures with identical timestamps", () => {
    const fixtures = [makeFx(2, 100), makeFx(1, 100), makeFx(3, 100)];
    const result = mergeAndDedupFixtures([fixtures]);

    // Array.prototype.sort 在 V8 中是稳定排序，相同 timestamp 保持插入顺序
    expect(result.map((f) => f.id)).toEqual([2, 1, 3]);
  });
});

describe("filterEndedFixtures", () => {
  // 比赛时长 = 7200s（2h），完赛阈值 starting_at_timestamp + 7200 <= now
  const NOW_SEC = 1762800000;

  it("过滤完全结束的 fixture（start + 7200 <= now）", () => {
    const fixtures = [
      makeFx(1, NOW_SEC - 7200), // start + 7200 = now → 已完赛，过滤
      makeFx(2, NOW_SEC - 7201), // start + 7200 = now - 1 → 已完赛，过滤
      makeFx(3, NOW_SEC), // start = now → live，保留
    ];

    const result = filterEndedFixtures(fixtures, NOW_SEC);
    expect(result.map((f) => f.id)).toEqual([3]);
  });

  it("保留 live match（开赛中但未到 +7200）", () => {
    const fixtures = [
      makeFx(1, NOW_SEC - 7199), // start + 7200 = now + 1 → live，保留
      makeFx(2, NOW_SEC - 3600), // start + 7200 = now + 3600 → live，保留
      makeFx(3, NOW_SEC), // 刚开赛 → 保留
    ];

    const result = filterEndedFixtures(fixtures, NOW_SEC);
    expect(result.map((f) => f.id)).toEqual([1, 2, 3]);
  });

  it("保留未开赛的 fixture", () => {
    const fixtures = [
      makeFx(1, NOW_SEC + 1), // 1 秒后开赛
      makeFx(2, NOW_SEC + 86400), // 1 天后开赛
    ];

    const result = filterEndedFixtures(fixtures, NOW_SEC);
    expect(result.map((f) => f.id)).toEqual([1, 2]);
  });

  it("空数组直接返空", () => {
    expect(filterEndedFixtures([], NOW_SEC)).toEqual([]);
  });

  it("混合场景：保留 live + 未开赛，过滤已完赛", () => {
    const fixtures = [
      makeFx(10, NOW_SEC - 100000), // 已完赛
      makeFx(20, NOW_SEC - 1800), // live（开赛 30 分钟）
      makeFx(30, NOW_SEC + 3600), // 1 小时后开赛
      makeFx(40, NOW_SEC - 8000), // 已完赛
    ];

    const result = filterEndedFixtures(fixtures, NOW_SEC);
    expect(result.map((f) => f.id)).toEqual([20, 30]);
  });
});

describe("filterTestFixtures", () => {
  it("过滤黑名单 fixture id（99200001）", () => {
    const fixtures = [
      makeFx(99200001, 1762800000),
      makeFx(123, 1762800000),
      makeFx(456, 1762800000),
    ];
    const result = filterTestFixtures(fixtures);
    expect(result.map((f) => f.id)).toEqual([123, 456]);
  });

  it("过滤含 mock_activity 字段的 fixture", () => {
    const f1 = makeFx(123, 1) as SportmonksFixture & {
      mock_activity?: { activity_id: string };
    };
    f1.mock_activity = {
      activity_id: "test",
      // 其他字段缩略，不影响 truthy 判断
    } as SportmonksFixture["mock_activity"];

    const f2 = makeFx(456, 1);
    const result = filterTestFixtures([f1, f2]);
    expect(result.map((f) => f.id)).toEqual([456]);
  });

  it("无 mock_activity 且不在黑名单 → 全部保留", () => {
    const fixtures = [makeFx(1, 1), makeFx(2, 1), makeFx(3, 1)];
    const result = filterTestFixtures(fixtures);
    expect(result).toHaveLength(3);
  });

  it("空数组直接返空", () => {
    expect(filterTestFixtures([])).toEqual([]);
  });
});
