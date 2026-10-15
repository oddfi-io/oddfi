import { describe, expect, it } from "vitest";
import { formatRelativeTimeMs } from "./relative-time-ms";
import { formatRelativeTime } from "@/lib/format/relative-time";

const NOW = Date.parse("2026-05-20T10:00:00Z");

describe("formatRelativeTimeMs", () => {
  it("< 1m → Less than 1m", () => {
    expect(formatRelativeTimeMs(NOW - 30_000, NOW)).toBe("Less than 1m");
    expect(formatRelativeTimeMs(NOW - 59_000, NOW)).toBe("Less than 1m");
  });

  it("< 1h → Xm ago", () => {
    expect(formatRelativeTimeMs(NOW - 5 * 60_000, NOW)).toBe("5m ago");
    expect(formatRelativeTimeMs(NOW - 59 * 60_000, NOW)).toBe("59m ago");
  });

  it("< 24h → Xh ago", () => {
    expect(formatRelativeTimeMs(NOW - 2 * 3600_000, NOW)).toBe("2h ago");
    expect(formatRelativeTimeMs(NOW - 23 * 3600_000, NOW)).toBe("23h ago");
  });

  // DD-115 — 24h ~ 30d 走 "Xd ago"；≥ 30d 才回退绝对时间
  it("< 30d → Xd ago", () => {
    expect(formatRelativeTimeMs(NOW - 25 * 3600_000, NOW)).toBe("1d ago");
    expect(formatRelativeTimeMs(NOW - 29 * 24 * 3600_000, NOW)).toBe("29d ago");
  });

  it("≥ 30d → yyyy-MM-dd HH:mm 本地时区", () => {
    const result = formatRelativeTimeMs(NOW - 31 * 24 * 3600_000, NOW);
    expect(result).toMatch(/^2026-04-19 \d{2}:\d{2}$/);
  });

  it("非法值 → 空串", () => {
    expect(formatRelativeTimeMs(NaN, NOW)).toBe("");
    expect(formatRelativeTimeMs(Infinity, NOW)).toBe("");
  });

  it("与 ISO 版输出在 < 24h 阈值完全对齐", () => {
    // 同一时刻 — ms 版与 ISO 版必须给出相同文案
    const tsMs = NOW - 7 * 60_000;
    const iso = new Date(tsMs).toISOString();
    expect(formatRelativeTimeMs(tsMs, NOW)).toBe(formatRelativeTime(iso, NOW));
  });

  it("与 ISO 版输出在 ≥ 24h 阈值完全对齐", () => {
    const tsMs = NOW - 36 * 3600_000;
    const iso = new Date(tsMs).toISOString();
    expect(formatRelativeTimeMs(tsMs, NOW)).toBe(formatRelativeTime(iso, NOW));
  });
});
