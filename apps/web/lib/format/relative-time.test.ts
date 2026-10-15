import { describe, expect, it } from "vitest";
import {
  formatAbsoluteDateTime,
  formatDateLineLocal,
  formatRelativeTime,
  formatTimeLineLocal,
} from "./relative-time";

const NOW = Date.parse("2026-04-19T12:00:00Z");

describe("formatRelativeTime", () => {
  it("< 1 minute 返回 Less than 1m", () => {
    expect(formatRelativeTime("2026-04-19T11:59:30Z", NOW)).toBe("Less than 1m");
    expect(formatRelativeTime("2026-04-19T12:00:00Z", NOW)).toBe("Less than 1m");
  });

  it("恰好 1 分钟边界返回 1m ago", () => {
    expect(formatRelativeTime("2026-04-19T11:59:00Z", NOW)).toBe("1m ago");
  });

  it("< 1 小时返回 Xm ago", () => {
    expect(formatRelativeTime("2026-04-19T11:45:00Z", NOW)).toBe("15m ago");
    expect(formatRelativeTime("2026-04-19T11:01:00Z", NOW)).toBe("59m ago");
  });

  it("恰好 1 小时边界返回 1h ago", () => {
    expect(formatRelativeTime("2026-04-19T11:00:00Z", NOW)).toBe("1h ago");
  });

  it("< 24 小时返回 Xh ago", () => {
    expect(formatRelativeTime("2026-04-19T00:00:00Z", NOW)).toBe("12h ago");
    expect(formatRelativeTime("2026-04-18T13:00:00Z", NOW)).toBe("23h ago");
  });

  // DD-115 — 24h ~ 30d 走 "Xd ago"，超过 30 天才回退绝对时间
  it("恰好 24 小时边界返回 1d ago", () => {
    expect(formatRelativeTime("2026-04-18T12:00:00Z", NOW)).toBe("1d ago");
  });

  it("< 30 天返回 Xd ago", () => {
    expect(formatRelativeTime("2026-04-17T12:00:00Z", NOW)).toBe("2d ago");
    expect(formatRelativeTime("2026-03-21T12:00:00Z", NOW)).toBe("29d ago");
  });

  it("≥ 30 天返回 yyyy-MM-dd HH:mm 本地时间", () => {
    const iso = "2026-03-19T09:15:00Z";
    const d = new Date(Date.parse(iso));
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    expect(formatRelativeTime(iso, NOW)).toBe(expected);
  });

  it("缺省 Z 后缀时按 UTC 解析", () => {
    // 不加 Z 在 Node 中仍按 UTC 解析 ISO 带 T 的字符串，但为防御边界行为补 Z。
    expect(formatRelativeTime("2026-04-19T11:45:00", NOW)).toBe("15m ago");
  });

  it("空串或非法时间返回空串", () => {
    expect(formatRelativeTime("", NOW)).toBe("");
    expect(formatRelativeTime("not-a-date", NOW)).toBe("");
  });
});

describe("formatDateLineLocal", () => {
  it("UTC ISO 转本地 yyyy-MM-dd", () => {
    const iso = "2026-04-18T09:15:22Z";
    const d = new Date(Date.parse(iso));
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(formatDateLineLocal(iso)).toBe(expected);
  });

  it("空串/undefined/非法输入返回空串", () => {
    expect(formatDateLineLocal("")).toBe("");
    expect(formatDateLineLocal(undefined)).toBe("");
    expect(formatDateLineLocal(null)).toBe("");
    expect(formatDateLineLocal("not-a-date")).toBe("");
  });
});

describe("formatAbsoluteDateTime", () => {
  it("UTC ISO 转本地 yyyy-MM-dd HH:mm（24h）", () => {
    const iso = "2026-04-29T10:09:32.33Z";
    const d = new Date(Date.parse(iso));
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    expect(formatAbsoluteDateTime(iso)).toBe(expected);
  });

  it("缺省 Z 后缀时按 UTC 解析", () => {
    const iso = "2026-04-29T10:09:32";
    const expectedRaw = `${iso}Z`;
    const d = new Date(Date.parse(expectedRaw));
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    expect(formatAbsoluteDateTime(iso)).toBe(expected);
  });

  it("空串/undefined/非法输入返回空串", () => {
    expect(formatAbsoluteDateTime("")).toBe("");
    expect(formatAbsoluteDateTime(undefined)).toBe("");
    expect(formatAbsoluteDateTime(null)).toBe("");
    expect(formatAbsoluteDateTime("not-a-date")).toBe("");
  });
});

describe("formatTimeLineLocal", () => {
  it("UTC ISO 转本地 HH:mm:ss", () => {
    const iso = "2026-04-18T09:15:22Z";
    const d = new Date(Date.parse(iso));
    const expected = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    expect(formatTimeLineLocal(iso)).toBe(expected);
  });

  it("空串/undefined/非法输入返回空串", () => {
    expect(formatTimeLineLocal("")).toBe("");
    expect(formatTimeLineLocal(undefined)).toBe("");
    expect(formatTimeLineLocal(null)).toBe("");
    expect(formatTimeLineLocal("not-a-date")).toBe("");
  });
});
