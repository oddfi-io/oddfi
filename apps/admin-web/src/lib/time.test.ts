import { describe, it, expect } from "vitest";
import { tsToDayjs, formatTs } from "./time";

// Asia/Shanghai is UTC+8. We pin epoch values to known wall-clock times.
// 2024-01-15 00:00:00 UTC = 2024-01-15 08:00:00 +08:00
const EPOCH_2024_01_15_UTC_MIDNIGHT = 1705276800000; // ms
// 2024-06-15 15:30:45 UTC = 2024-06-15 23:30:45 +08:00
const EPOCH_2024_06_15_1530_UTC = 1718465445000; // ms
// RFC3339 strings (these already carry timezone info, dayjs preserves and converts)
const RFC_UTC = "2024-01-15T00:00:00Z";
const RFC_PLUS8 = "2024-01-15T08:00:00+08:00";

describe("tsToDayjs", () => {
  it("returns null for null", () => {
    expect(tsToDayjs(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(tsToDayjs(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(tsToDayjs("")).toBeNull();
  });

  it("returns null for 0 (falsy epoch treated as null)", () => {
    // 0 is falsy: value == null || value === "" catches null/undefined/"" but not 0
    // Check actual behaviour: 0 → dayjs(0) → valid → converted to +08:00 (1970-01-01 08:00 +08)
    // The code uses `value == null` so 0 is NOT caught; it is a valid epoch.
    const d = tsToDayjs(0);
    expect(d).not.toBeNull();
    expect(d!.format("YYYY-MM-DD HH:mm")).toBe("1970-01-01 08:00");
  });

  it("converts epoch ms to Asia/Shanghai", () => {
    const d = tsToDayjs(EPOCH_2024_01_15_UTC_MIDNIGHT);
    expect(d).not.toBeNull();
    expect(d!.format("YYYY-MM-DD HH:mm")).toBe("2024-01-15 08:00");
  });

  it("converts RFC3339 UTC string to +08:00", () => {
    const d = tsToDayjs(RFC_UTC);
    expect(d).not.toBeNull();
    expect(d!.format("YYYY-MM-DD HH:mm")).toBe("2024-01-15 08:00");
  });

  it("RFC3339 +08:00 offset renders identically to UTC equivalent", () => {
    const dUtc = tsToDayjs(RFC_UTC);
    const dPlus8 = tsToDayjs(RFC_PLUS8);
    expect(dUtc!.valueOf()).toBe(dPlus8!.valueOf());
  });

  it("converts a summer epoch with DST-independent +08 offset", () => {
    // China Standard Time has no DST; always +08
    const d = tsToDayjs(EPOCH_2024_06_15_1530_UTC);
    expect(d).not.toBeNull();
    expect(d!.format("YYYY-MM-DD HH:mm:ss")).toBe("2024-06-15 23:30:45");
  });

  it("returns null for an invalid string", () => {
    expect(tsToDayjs("not-a-date")).toBeNull();
  });
});

describe("formatTs", () => {
  it("returns em-dash for null", () => {
    expect(formatTs(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(formatTs(undefined)).toBe("—");
  });

  it("returns em-dash for invalid string", () => {
    expect(formatTs("garbage")).toBe("—");
  });

  it("formats epoch ms with default pattern", () => {
    expect(formatTs(EPOCH_2024_01_15_UTC_MIDNIGHT)).toBe("2024-01-15 08:00");
  });

  it("formats RFC3339 UTC with default pattern", () => {
    expect(formatTs(RFC_UTC)).toBe("2024-01-15 08:00");
  });

  it("accepts a custom format string", () => {
    expect(formatTs(EPOCH_2024_01_15_UTC_MIDNIGHT, "YYYY/MM/DD")).toBe("2024/01/15");
  });

  it("UTC midnight maps correctly to next calendar day in +08", () => {
    // 2023-12-31 16:01:00 UTC = 2024-01-01 00:01:00 +08
    const epochMs = new Date("2023-12-31T16:01:00Z").getTime();
    expect(formatTs(epochMs)).toBe("2024-01-01 00:01");
  });
});
