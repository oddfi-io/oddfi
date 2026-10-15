import { describe, it, expect } from "vitest";
import {
  buildTimeAxis,
  formatKickoffInTz,
  getBrowserTimezone,
  dayKey,
  todayKey,
  formatKickoffDisplay,
} from "./timezone";

describe("buildTimeAxis", () => {
  it("returns 15 cells in UTC mode matching PRD Y_TIMES_UTC", () => {
    const axis = buildTimeAxis("UTC");
    expect(axis).toHaveLength(15);
    expect(axis[0]).toEqual({ hour: "15", label: "15:00", isNextDay: false });
    expect(axis[8]).toEqual({ hour: "23", label: "23:00", isNextDay: false });
    expect(axis[9]).toEqual({ hour: "00", label: "00:00", isNextDay: true });
    expect(axis[13]).toEqual({ hour: "04", label: "04:00", isNextDay: true });
    expect(axis[14]).toEqual({ hour: "05", label: "05:00", isNextDay: true });
  });

  it("shifts hours correctly for Asia/Shanghai (UTC+8, no DST)", () => {
    // 2026-07 期间 Asia/Shanghai 全年固定 UTC+8（无夏令时）
    const axis = buildTimeAxis("Asia/Shanghai");
    expect(axis).toHaveLength(15);
    // UTC 15:00 → CST 23:00
    expect(axis[0].hour).toBe("23");
    // UTC 16:00 → CST 00:00 (次日)
    expect(axis[1].hour).toBe("00");
    // UTC 04:00 → CST 12:00
    expect(axis[13].hour).toBe("12");
  });

  it("shifts hours correctly for America/New_York (EDT in 2026-07, UTC-4)", () => {
    // 2026-07 期间 America/New_York = EDT = UTC-4
    const axis = buildTimeAxis("America/New_York");
    expect(axis).toHaveLength(15);
    // UTC 15:00 → EDT 11:00
    expect(axis[0].hour).toBe("11");
    // UTC 23:00 → EDT 19:00
    expect(axis[8].hour).toBe("19");
  });

  it("shifts hours correctly for Europe/London (BST in 2026-06, UTC+1)", () => {
    // 锚点 2026-06-11 在 BST（UTC+1）
    const axis = buildTimeAxis("Europe/London");
    expect(axis).toHaveLength(15);
    // UTC 15:00 → BST 16:00
    expect(axis[0].hour).toBe("16");
    // UTC 23:00 → BST 00:00 (次日)
    expect(axis[8].hour).toBe("00");
  });
});

describe("formatKickoffInTz — DST boundary cases", () => {
  it("converts 2026-06-11 19:00 UTC to UTC mode (no shift)", () => {
    // Mexico vs South Africa kickoff
    const ts = 1781204400; // 2026-06-11T19:00:00Z
    const parts = formatKickoffInTz(ts, "UTC");
    expect(parts).toEqual({ date: "2026-06-11", hour: "19", minute: "00" });
  });

  it("converts 2026-06-11 19:00 UTC to Asia/Shanghai (next day 03:00)", () => {
    const ts = 1781204400;
    const parts = formatKickoffInTz(ts, "Asia/Shanghai");
    expect(parts).toEqual({ date: "2026-06-12", hour: "03", minute: "00" });
  });

  it("converts 2026-07-19 19:00 UTC (Final) to America/New_York EDT (15:00 same day)", () => {
    // Sun Jul 19 2026 19:00 UTC = EDT 15:00 same day
    const ts = Date.parse("2026-07-19T19:00:00Z") / 1000;
    const parts = formatKickoffInTz(ts, "America/New_York");
    expect(parts.date).toBe("2026-07-19");
    expect(parts.hour).toBe("15");
  });

  it("respects DST: 2026-12-08 15:00 UTC in America/New_York is EST (10:00, UTC-5)", () => {
    // 12 月份 EST，相比 7 月 EDT 少 1 小时
    const ts = Date.parse("2026-12-08T15:00:00Z") / 1000;
    const parts = formatKickoffInTz(ts, "America/New_York");
    expect(parts.hour).toBe("10");
  });

  it("respects DST: 2026-07-08 15:00 UTC in Europe/London is BST (16:00, UTC+1)", () => {
    const ts = Date.parse("2026-07-08T15:00:00Z") / 1000;
    const parts = formatKickoffInTz(ts, "Europe/London");
    expect(parts.hour).toBe("16");
  });

  it("respects DST: 2026-12-08 15:00 UTC in Europe/London is GMT (15:00, UTC+0)", () => {
    const ts = Date.parse("2026-12-08T15:00:00Z") / 1000;
    const parts = formatKickoffInTz(ts, "Europe/London");
    expect(parts.hour).toBe("15");
  });
});

describe("getBrowserTimezone", () => {
  it("returns IANA tz string in browser context", () => {
    // Vitest runs in node — Intl.DateTimeFormat 也支持
    const tz = getBrowserTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});

// ─── BUG-071 · 唯一事实源 dayKey / todayKey / formatKickoffDisplay ──────────

describe("dayKey — 本地运营日分桶口径（BUG-071 根因修复）", () => {
  // 2026-06-14 16:00 UTC：UTC 视角是 06-14，GMT+8 已跨到 06-15（正是 BUG-071 错位场景）
  const ts_0614_16Z = Date.parse("2026-06-14T16:00:00Z") / 1000;
  // 2026-06-14 04:00 UTC：两个时区都还在 06-14
  const ts_0614_04Z = Date.parse("2026-06-14T04:00:00Z") / 1000;

  it("UTC 16:00 在 Asia/Shanghai(+8) 归入本地次日（06-15），不再误入 UTC 当天桶", () => {
    expect(dayKey(ts_0614_16Z, "UTC")).toBe("2026-06-14");
    expect(dayKey(ts_0614_16Z, "Asia/Shanghai")).toBe("2026-06-15");
  });

  it("同一 UT 时刻分桶随 tz 变化：America/New_York(-4) 仍是 06-14", () => {
    expect(dayKey(ts_0614_16Z, "America/New_York")).toBe("2026-06-14");
  });

  it("UTC 04:00 在 GMT+8 与 UTC 都属 06-14（不跨日）", () => {
    expect(dayKey(ts_0614_04Z, "UTC")).toBe("2026-06-14");
    expect(dayKey(ts_0614_04Z, "Asia/Shanghai")).toBe("2026-06-14");
  });

  it("跨午夜两条赛事在同一本地时区分到不同桶（今天 23:00 vs 次日 00:30，GMT+8）", () => {
    // 本地 06-15 23:00 = UTC 15:00；本地 06-16 00:30 = UTC 15:30（GMT+8）
    const todayNight = Date.parse("2026-06-15T15:00:00Z") / 1000;
    const tomorrowEarly = Date.parse("2026-06-15T16:30:00Z") / 1000;
    expect(dayKey(todayNight, "Asia/Shanghai")).toBe("2026-06-15");
    expect(dayKey(tomorrowEarly, "Asia/Shanghai")).toBe("2026-06-16");
  });

  it("缺失 / NaN 时刻返回空串而非崩溃（REV-v1-B #B3）", () => {
    expect(dayKey(NaN, "Asia/Shanghai")).toBe("");
    expect(dayKey(Infinity, "UTC")).toBe("");
  });

  it("垃圾 tz 兜底 UTC，不抛 RangeError（REV-v1-B #B5）", () => {
    expect(dayKey(ts_0614_16Z, "Not/AZone")).toBe("2026-06-14");
  });
});

describe("todayKey", () => {
  it("与 dayKey 同口径（同函数同 tz）", () => {
    const now = Date.parse("2026-06-15T02:00:00Z") / 1000;
    expect(todayKey(now, "Asia/Shanghai")).toBe(dayKey(now, "Asia/Shanghai"));
    expect(todayKey(now, "Asia/Shanghai")).toBe("2026-06-15");
  });
});

describe("formatKickoffDisplay — 卡片显示与分桶同源（REV 采纳 #B1）", () => {
  const ts = Date.parse("2026-06-14T16:00:00Z") / 1000; // GMT+8 = 06-15 00:00

  it("显示时区与 dayKey 一致：GMT+8 下日期落在本地 06-15", () => {
    const { date, time } = formatKickoffDisplay(ts, "Asia/Shanghai", "en-US");
    // 本地 06-15 00:00
    expect(date).toContain("Jun 15");
    expect(time).toMatch(/12:00\s?AM/i);
  });

  it("UTC 视角同一时刻是 06-14 16:00", () => {
    const { date, time } = formatKickoffDisplay(ts, "UTC", "en-US");
    expect(date).toContain("Jun 14");
    expect(time).toMatch(/4:00\s?PM/i);
  });

  it("缺失时刻返回空串占位，不崩（B3）", () => {
    expect(formatKickoffDisplay(NaN, "UTC", "en-US")).toEqual({ date: "", time: "" });
  });

  it("垃圾 tz 兜底 UTC，不抛（B5）", () => {
    const { date } = formatKickoffDisplay(ts, "Not/AZone", "en-US");
    expect(date).toContain("Jun 14");
  });
});
