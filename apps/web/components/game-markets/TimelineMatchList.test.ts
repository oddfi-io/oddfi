import { describe, it, expect } from "vitest";
import { partitionFixtures } from "./TimelineMatchList";
import type { SportmonksFixture } from "@/types/api";

function makeFx(id: number, stateId: number, startingAt: string): SportmonksFixture {
  return {
    id,
    league_id: 8,
    stage_id: 0,
    name: `Fixture ${id}`,
    starting_at: startingAt,
    starting_at_timestamp: 0,
    state_id: stateId,
    has_odds: true,
    odds: [],
    participants: [],
  } as SportmonksFixture;
}

describe("partitionFixtures", () => {
  it("splits fixtures into live and upcomingByDate, drops finished", () => {
    const fixtures = [
      makeFx(1, 1, "2026-06-11 15:00:00"), // upcoming
      makeFx(2, 2, "2026-06-11 12:00:00"), // live (1st Half)
      makeFx(3, 5, "2026-06-11 10:00:00"), // finished — dropped
      makeFx(4, 1, "2026-06-12 20:00:00"), // upcoming next day
      makeFx(5, 4, "2026-06-11 18:00:00"), // live (Break)
      makeFx(6, 22, "2026-06-11 20:00:00"), // live (2nd Half) — BUG-029 致命路径钉子
    ];

    const { live, upcomingByDate } = partitionFixtures(fixtures, "UTC");

    // state_id=22 必须进 live 区，不能被 finished 桶丢弃（BUG-029 根因）
    expect(live.map((f) => f.id)).toEqual([2, 5, 6]);
    expect(Array.from(upcomingByDate.keys())).toEqual(["2026-06-11", "2026-06-12"]);
    expect(upcomingByDate.get("2026-06-11")?.map((f) => f.id)).toEqual([1]);
    expect(upcomingByDate.get("2026-06-12")?.map((f) => f.id)).toEqual([4]);
  });

  it("sorts live fixtures by starting_at ascending", () => {
    const fixtures = [
      makeFx(1, 2, "2026-06-11 18:00:00"),
      makeFx(2, 4, "2026-06-11 12:00:00"),
      makeFx(3, 2, "2026-06-11 15:00:00"),
    ];
    const { live } = partitionFixtures(fixtures, "UTC");
    expect(live.map((f) => f.id)).toEqual([2, 3, 1]);
  });

  it("returns upcomingByDate keys sorted ascending", () => {
    const fixtures = [
      makeFx(1, 1, "2026-06-13 15:00:00"),
      makeFx(2, 1, "2026-06-11 15:00:00"),
      makeFx(3, 1, "2026-06-12 15:00:00"),
    ];
    const { upcomingByDate } = partitionFixtures(fixtures, "UTC");
    expect(Array.from(upcomingByDate.keys())).toEqual(["2026-06-11", "2026-06-12", "2026-06-13"]);
  });

  it("handles empty input", () => {
    const { live, upcomingByDate } = partitionFixtures([], "UTC");
    expect(live).toEqual([]);
    expect(upcomingByDate.size).toBe(0);
  });

  it("handles all-finished input as empty", () => {
    const fixtures = [
      makeFx(1, 5, "2026-06-11 15:00:00"),
      makeFx(2, 8, "2026-06-12 15:00:00"),
      makeFx(3, 12, "2026-06-13 15:00:00"),
    ];
    const { live, upcomingByDate } = partitionFixtures(fixtures, "UTC");
    expect(live).toEqual([]);
    expect(upcomingByDate.size).toBe(0);
  });

  it("sorts within-date by kickoff time ascending (BUG-071 #N-1：数值时刻比，非裸字符串)", () => {
    const fixtures = [
      makeFx(1, 1, "2026-06-11 10:00:00"),
      makeFx(2, 1, "2026-06-11 15:00:00"),
      makeFx(3, 1, "2026-06-11 12:00:00"),
    ];
    const { upcomingByDate } = partitionFixtures(fixtures, "UTC");
    expect(upcomingByDate.get("2026-06-11")?.map((f) => f.id)).toEqual([1, 3, 2]);
  });
});

// ─── BUG-071 · 本地时区分桶（跨午夜 + 多 tz） ────────────────────────────────

describe("partitionFixtures — 本地时区分桶（BUG-071 根因修复）", () => {
  // UTC 06-14：04:00 两区都属当天；16:00/20:00 在 GMT+8 已跨到次日（正是错位场景）
  const fixtures = [
    makeFx(1, 1, "2026-06-14 04:00:00"), // GMT+8 12:00 → 06-14
    makeFx(2, 1, "2026-06-14 16:00:00"), // GMT+8 00:00 → 06-15
    makeFx(3, 1, "2026-06-14 20:00:00"), // GMT+8 04:00 → 06-15
  ];

  it("UTC 口径：三场全在 06-14 桶（旧 slice(0,10) 行为）", () => {
    const { upcomingByDate } = partitionFixtures(fixtures, "UTC");
    expect(upcomingByDate.get("2026-06-14")?.map((f) => f.id)).toEqual([1, 2, 3]);
    expect(upcomingByDate.has("2026-06-15")).toBe(false);
  });

  it("Asia/Shanghai(+8) 口径：16:00/20:00 UTC 归入本地次日 06-15，与卡片显示对齐", () => {
    const { upcomingByDate } = partitionFixtures(fixtures, "Asia/Shanghai");
    expect(upcomingByDate.get("2026-06-14")?.map((f) => f.id)).toEqual([1]);
    expect(upcomingByDate.get("2026-06-15")?.map((f) => f.id)).toEqual([2, 3]);
  });

  it("America/New_York(-4) 口径：随负偏移分桶随之改变（同组 UTC 数据，桶按 tz 变）", () => {
    // NY: 04:00Z→00:00(06-14), 16:00Z→12:00(06-14), 20:00Z→16:00(06-14) — 全 06-14
    const { upcomingByDate } = partitionFixtures(fixtures, "America/New_York");
    expect(upcomingByDate.get("2026-06-14")?.map((f) => f.id)).toEqual([1, 2, 3]);
  });

  it("starting_at_timestamp 缺失时走 starting_at fallback（同样按本地 tz 分桶）", () => {
    // makeFx 固定 starting_at_timestamp=0 → resolveKickoffSeconds 走字符串 fallback
    const { upcomingByDate } = partitionFixtures(
      [makeFx(9, 1, "2026-06-14 16:00:00")],
      "Asia/Shanghai"
    );
    expect(upcomingByDate.get("2026-06-15")?.map((f) => f.id)).toEqual([9]);
  });

  it("生产主路径：带真实 starting_at_timestamp 时按 timestamp→dayKey 分桶（REV-v2 M-2）", () => {
    // 99% 生产数据走 starting_at_timestamp（>0）路径，resolveKickoffSeconds 的 ts>0 守卫绕过字符串 fallback。
    // 钉住核心修复链：timestamp → dayKey → 本地运营日。2026-06-14T16:00:00Z 在 GMT+8 = 06-15。
    const ts = Date.parse("2026-06-14T16:00:00Z") / 1000;
    const fx = {
      ...makeFx(11, 1, "ignored-when-timestamp-present"),
      starting_at_timestamp: ts,
    } as SportmonksFixture;
    const shanghai = partitionFixtures([fx], "Asia/Shanghai");
    expect(shanghai.upcomingByDate.get("2026-06-15")?.map((f) => f.id)).toEqual([11]);
    const utc = partitionFixtures([fx], "UTC");
    expect(utc.upcomingByDate.get("2026-06-14")?.map((f) => f.id)).toEqual([11]);
  });
});

// ─── 测试赛事统一分组（链上测试 + 99200001 演示，不按时间分桶） ───────────────

describe("partitionFixtures — test 组（链上测试 + 演示测试统一归类）", () => {
  it("链上测试赛事进 test 组，不进 live / 日期桶", () => {
    const fixtures = [
      makeFx(1, 1, "2026-06-07 10:00:00"), // upcoming 普通
      makeFx(993021780822200, 1, "2026-06-07 09:00:00"), // 链上测试（state_id=1 恒定）
      makeFx(2, 2, "2026-06-07 08:00:00"), // live 普通
      makeFx(993011780822200, 1, "2026-06-07 09:00:00"), // 链上测试
    ];

    const { test, live, upcomingByDate } = partitionFixtures(fixtures, "UTC");

    // base 99301 在前（链上同类按 id 升序，轮内顺序稳定）
    expect(test.map((f) => f.id)).toEqual([993011780822200, 993021780822200]);
    expect(live.map((f) => f.id)).toEqual([2]);
    expect(upcomingByDate.get("2026-06-07")?.map((f) => f.id)).toEqual([1]);
  });

  it("即使链上测试赛事 state_id 异常（live/finished 值）也固定进 test 组", () => {
    // 后端 state_id 恒为 1，但防御：分组只看 id 区间，state 变化不影响归类
    const fixtures = [
      makeFx(993011780822200, 2, "2026-06-07 09:00:00"),
      makeFx(993021780822200, 5, "2026-06-07 09:00:00"),
    ];
    const { test, live } = partitionFixtures(fixtures, "UTC");
    expect(test.length).toBe(2);
    expect(live).toEqual([]);
  });

  it("演示测试赛事 99200001 进 test 组，不再按日期分桶（用户需求 2026-06-15）", () => {
    const fixtures = [makeFx(99200001, 1, "2026-06-07 10:00:00")];
    const { test, upcomingByDate } = partitionFixtures(fixtures, "UTC");
    expect(test.map((f) => f.id)).toEqual([99200001]);
    expect(upcomingByDate.size).toBe(0);
  });

  it("链上测试 + 99200001 统一进 test 组：链上在前、演示在后", () => {
    const fixtures = [
      makeFx(99200001, 1, "2026-06-07 10:00:00"), // 演示测试
      makeFx(993021780822200, 1, "2026-06-07 09:00:00"), // 链上测试 base 99302
      makeFx(993011780822200, 1, "2026-06-07 09:00:00"), // 链上测试 base 99301
    ];
    const { test, upcomingByDate } = partitionFixtures(fixtures, "UTC");
    // 链上（99301 < 99302）在前，演示 99200001 在后
    expect(test.map((f) => f.id)).toEqual([993011780822200, 993021780822200, 99200001]);
    expect(upcomingByDate.size).toBe(0);
  });

  it("无测试赛事时 test 组为空，原有分组行为不变", () => {
    const { test } = partitionFixtures([makeFx(1, 1, "2026-06-07 10:00:00")], "UTC");
    expect(test).toEqual([]);
  });
});
