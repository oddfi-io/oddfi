// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountdown, parseUtcEndTime } from "./useCountdown";

describe("parseUtcEndTime", () => {
  it("parses backend format YYYY-MM-DD HH:mm:ss as UTC", () => {
    const d = parseUtcEndTime("2026-07-22 23:59:59");
    expect(d?.toISOString()).toBe("2026-07-22T23:59:59.000Z");
  });

  it("respects already-iso ISO format with Z", () => {
    const d = parseUtcEndTime("2026-07-22T23:59:59Z");
    expect(d?.toISOString()).toBe("2026-07-22T23:59:59.000Z");
  });

  it("respects timezone offset suffix", () => {
    const d = parseUtcEndTime("2026-07-22T07:59:59+08:00");
    expect(d?.toISOString()).toBe("2026-07-21T23:59:59.000Z");
  });

  it("returns null for empty / invalid input", () => {
    expect(parseUtcEndTime("")).toBeNull();
    expect(parseUtcEndTime("not a date")).toBeNull();
  });
});

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ZERO when endTime is null", () => {
    const { result } = renderHook(() => useCountdown(null));
    expect(result.current).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
  });

  it("computes days/hours/minutes/seconds correctly for UTC backend format", () => {
    // 2026-04-27 12:00:00 → 2026-04-30 13:30:45 = 3d 1h 30m 45s
    const { result } = renderHook(() => useCountdown("2026-04-30 13:30:45"));
    expect(result.current.days).toBe(3);
    expect(result.current.hours).toBe(1);
    expect(result.current.minutes).toBe(30);
    expect(result.current.seconds).toBe(45);
    expect(result.current.isExpired).toBe(false);
  });

  it("returns isExpired=true when endTime is in the past", () => {
    const { result } = renderHook(() => useCountdown("2020-01-01 00:00:00"));
    expect(result.current.isExpired).toBe(true);
    expect(result.current.days).toBe(0);
  });

  it("ticks every second and decrements seconds", () => {
    const { result } = renderHook(() => useCountdown("2026-04-27 12:00:30"));
    expect(result.current.seconds).toBe(30);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.seconds).toBe(25);
  });

  it("accepts Date object directly", () => {
    const target = new Date("2026-04-27T13:00:00Z");
    const { result } = renderHook(() => useCountdown(target));
    expect(result.current.hours).toBe(1);
    expect(result.current.minutes).toBe(0);
  });
});
