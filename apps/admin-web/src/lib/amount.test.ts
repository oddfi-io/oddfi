import { describe, it, expect } from "vitest";
import { formatAmount, isValidDecimal, progressPct } from "./amount";

describe("formatAmount", () => {
  it("returns em-dash for null input", () => {
    expect(formatAmount(null)).toBe("—");
  });

  it("returns em-dash for undefined input", () => {
    expect(formatAmount(undefined)).toBe("—");
  });

  it("returns em-dash for empty string", () => {
    expect(formatAmount("")).toBe("—");
  });

  it("returns em-dash for non-numeric string", () => {
    expect(formatAmount("abc")).toBe("—");
  });

  it("formats a large integer with thousands separator and 2 decimals", () => {
    expect(formatAmount("12000000")).toBe("12,000,000.00");
  });

  it("formats a large number input", () => {
    expect(formatAmount(12000000)).toBe("12,000,000.00");
  });

  it("preserves precision for small decimal string without parseFloat rounding", () => {
    expect(formatAmount("0.01")).toBe("0.01");
  });

  it("formats a string decimal with correct 2-decimal rounding via decimal.js (no float drift)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in native float; decimal.js must give 0.30
    expect(formatAmount("0.30")).toBe("0.30");
  });

  it("handles integer string with decimals option", () => {
    expect(formatAmount("1234567", { decimals: 4 })).toBe("1,234,567.0000");
  });

  it("appends suffix when provided", () => {
    expect(formatAmount("1000", { suffix: "USDT" })).toBe("1,000.00 USDT");
  });

  it("formats a negative amount", () => {
    expect(formatAmount("-9999.99")).toBe("-9,999.99");
  });

  it("formats zero", () => {
    expect(formatAmount("0")).toBe("0.00");
  });

  it("handles very large decimal string without precision loss", () => {
    // decimal.js can handle 38-digit integers (backend DECIMAL(38,18))
    expect(formatAmount("99999999999999999999.99")).toBe("99,999,999,999,999,999,999.99");
  });

  it("formats number 0 as 0.00", () => {
    expect(formatAmount(0)).toBe("0.00");
  });
});

describe("isValidDecimal", () => {
  it.each([
    ["123", true],
    ["0.01", true],
    ["-50.5", true],
    ["1e10", true],
    ["", false],
    ["abc", false],
    ["NaN", false],
    ["Infinity", false],
  ])("isValidDecimal(%s) === %s", (input, expected) => {
    expect(isValidDecimal(input)).toBe(expected);
  });
});

describe("progressPct", () => {
  it("returns percentage of sold/supply", () => {
    expect(progressPct("50", "200")).toBe(25);
  });

  it("returns 0 when supply is zero", () => {
    expect(progressPct("50", "0")).toBe(0);
  });

  it("returns 0 when supply is negative", () => {
    expect(progressPct("50", "-100")).toBe(0);
  });

  it("caps at 100 when sold > supply", () => {
    expect(progressPct("300", "100")).toBe(100);
  });

  it("returns 0 for invalid inputs", () => {
    expect(progressPct("abc", "100")).toBe(0);
    expect(progressPct("50", "xyz")).toBe(0);
  });
});
