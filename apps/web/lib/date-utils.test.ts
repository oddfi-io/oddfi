import { describe, it, expect, vi, afterEach } from "vitest";
import { getTodayUTC, getDateOffsetUTC, getDateFromBaseUTC } from "./date-utils";

describe("getTodayUTC", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD format", () => {
    const result = getTodayUTC();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns correct date for a known timestamp", () => {
    vi.useFakeTimers();
    // 2026-03-25T10:30:00Z
    vi.setSystemTime(new Date("2026-03-25T10:30:00Z"));
    expect(getTodayUTC()).toBe("2026-03-25");
  });

  it("uses UTC, not local time", () => {
    vi.useFakeTimers();
    // 2026-03-25T23:30:00Z — still March 25 in UTC even if March 26 in UTC+8
    vi.setSystemTime(new Date("2026-03-25T23:30:00Z"));
    expect(getTodayUTC()).toBe("2026-03-25");
  });
});

describe("getDateOffsetUTC", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today when offset is 0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T10:00:00Z"));
    expect(getDateOffsetUTC(0)).toBe("2026-03-25");
  });

  it("returns correct date for positive offset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T10:00:00Z"));
    expect(getDateOffsetUTC(3)).toBe("2026-03-28");
  });

  it("handles month boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T10:00:00Z"));
    expect(getDateOffsetUTC(3)).toBe("2026-04-02");
  });

  it("handles negative offset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T10:00:00Z"));
    expect(getDateOffsetUTC(-1)).toBe("2026-03-24");
  });
});

describe("getDateFromBaseUTC", () => {
  it("returns the base date when offset is 0", () => {
    expect(getDateFromBaseUTC("2026-03-26", 0)).toBe("2026-03-26");
  });

  it("returns next day for offset 1", () => {
    expect(getDateFromBaseUTC("2026-03-26", 1)).toBe("2026-03-27");
  });

  it("handles month boundary", () => {
    expect(getDateFromBaseUTC("2026-03-31", 1)).toBe("2026-04-01");
  });

  it("handles year boundary", () => {
    expect(getDateFromBaseUTC("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap year", () => {
    expect(getDateFromBaseUTC("2028-02-28", 1)).toBe("2028-02-29");
    expect(getDateFromBaseUTC("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("handles negative offset", () => {
    expect(getDateFromBaseUTC("2026-03-26", -1)).toBe("2026-03-25");
  });

  it("handles large offset (7 days)", () => {
    expect(getDateFromBaseUTC("2026-03-26", 7)).toBe("2026-04-02");
  });
});
