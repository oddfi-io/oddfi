import { describe, it, expect } from "vitest";
import {
  add,
  sub,
  mul,
  div,
  formatAmount,
  formatPercent,
  formatPrice,
  formatBalance,
  formatAdaptiveAmount,
  formatCompact,
  calcEstimatedShares,
  calcEstimatedReturn,
  calcProfitRatio,
  isValidAmount,
  isGt,
  cmp,
} from "./decimal";

// ============================================================
// Basic arithmetic
// ============================================================

describe("add", () => {
  it("adds two positive numbers", () => {
    expect(add("1.1", "2.2")).toBe("3.3");
  });

  it("handles empty string as 0", () => {
    expect(add("", "5")).toBe("5");
    expect(add("5", "")).toBe("5");
  });

  it("adds negative numbers", () => {
    expect(add("-1", "3")).toBe("2");
  });

  it("handles large numbers without precision loss", () => {
    expect(add("999999999999999999", "1")).toBe("1000000000000000000");
  });

  it("lessons: §5 — 0.1 + 0.2 must equal 0.3 exactly", () => {
    expect(add("0.1", "0.2")).toBe("0.3");
  });
});

describe("sub", () => {
  it("subtracts two numbers", () => {
    expect(sub("5", "3")).toBe("2");
  });

  it("returns negative when b > a", () => {
    expect(sub("3", "5")).toBe("-2");
  });

  it("handles empty strings as 0", () => {
    expect(sub("", "5")).toBe("-5");
    expect(sub("5", "")).toBe("5");
  });

  it("lessons: §5 — precision: 0.3 - 0.1 must equal 0.2", () => {
    expect(sub("0.3", "0.1")).toBe("0.2");
  });

  it("subtracts large decimals", () => {
    expect(sub("1000000.123456", "0.000001")).toBe("1000000.123455");
  });
});

describe("mul", () => {
  it("multiplies two numbers", () => {
    expect(mul("3", "4")).toBe("12");
  });

  it("handles empty strings as 0", () => {
    expect(mul("", "5")).toBe("0");
    expect(mul("5", "")).toBe("0");
  });

  it("multiplies decimals without float error", () => {
    expect(mul("0.1", "0.2")).toBe("0.02");
  });

  it("multiplies negative numbers", () => {
    expect(mul("-3", "4")).toBe("-12");
  });

  it("handles zero", () => {
    expect(mul("0", "12345")).toBe("0");
  });
});

describe("div", () => {
  it("divides two numbers", () => {
    expect(div("10", "3")).toBe("3.333333333333333333333333333");
  });

  it("returns '0' when dividing by zero", () => {
    expect(div("10", "0")).toBe("0");
  });

  it("returns '0' when divisor is empty string", () => {
    expect(div("10", "")).toBe("0");
  });

  it("handles empty dividend as 0", () => {
    expect(div("", "5")).toBe("0");
  });

  it("divides decimals precisely", () => {
    expect(div("1", "3")).toBe("0.3333333333333333333333333333");
  });

  it("regression: SENTRY-001 — division by zero must not throw", () => {
    expect(() => div("100", "0")).not.toThrow();
    expect(div("100", "0")).toBe("0");
  });
});

// ============================================================
// Display formatting
// ============================================================

describe("formatAmount", () => {
  it("formats to 2 decimal places by default", () => {
    expect(formatAmount("1.2345")).toBe("1.23");
  });

  it("pads with zeros when needed", () => {
    expect(formatAmount("1")).toBe("1.00");
  });

  it("respects custom decimal places", () => {
    expect(formatAmount("1.23456", 4)).toBe("1.2345");
  });

  it("handles zero", () => {
    expect(formatAmount("0")).toBe("0.00");
  });

  it("handles empty string as 0", () => {
    expect(formatAmount("")).toBe("0.00");
  });

  it("handles number input", () => {
    expect(formatAmount(1.5)).toBe("1.50");
  });

  it("lessons: §5 — must use formatAmount for financial display, rounds down", () => {
    // Decimal.js is configured with ROUND_DOWN
    expect(formatAmount("1.999")).toBe("1.99");
  });
});

describe("formatPercent", () => {
  it("converts decimal to percentage with 1 decimal", () => {
    expect(formatPercent("0.5")).toBe("50.0%");
  });

  it("handles zero", () => {
    expect(formatPercent("0")).toBe("0.0%");
  });

  it("handles number input", () => {
    expect(formatPercent(0.123)).toBe("12.3%");
  });

  it("respects custom decimals", () => {
    expect(formatPercent("0.12345", 2)).toBe("12.34%");
  });

  it("handles empty string as 0", () => {
    expect(formatPercent("")).toBe("0.0%");
  });
});

describe("formatPrice", () => {
  it("formats to 2 decimal places", () => {
    expect(formatPrice("1.2345")).toBe("1.23");
  });

  it("pads with zeros", () => {
    expect(formatPrice("5")).toBe("5.00");
  });

  it("handles empty string", () => {
    expect(formatPrice("")).toBe("0.00");
  });

  it("handles number input", () => {
    expect(formatPrice(99.9)).toBe("99.90");
  });
});

describe("formatBalance", () => {
  it("strips trailing zeros", () => {
    expect(formatBalance("1.000000")).toBe("1");
  });

  it("strips partial trailing zeros", () => {
    expect(formatBalance("1.234500")).toBe("1.2345");
  });

  it("returns '0' for zero value", () => {
    expect(formatBalance("0")).toBe("0");
  });

  it("preserves significant decimals", () => {
    expect(formatBalance("0.001230")).toBe("0.00123");
  });

  it("handles empty string as 0", () => {
    expect(formatBalance("")).toBe("0");
  });

  it("respects custom maxDecimals", () => {
    expect(formatBalance("1.123456789", 4)).toBe("1.1234");
  });

  it("handles number input", () => {
    expect(formatBalance(1.5)).toBe("1.5");
  });
});

describe("formatAdaptiveAmount", () => {
  it("large values: integer with thousand separators", () => {
    expect(formatAdaptiveAmount("2000")).toBe("2,000");
    expect(formatAdaptiveAmount("12345.6")).toBe("12,345"); // ROUND_DOWN
  });

  it("values ≥ 1 drop decimals, round down (never overstate balance)", () => {
    expect(formatAdaptiveAmount("5.6")).toBe("5");
    expect(formatAdaptiveAmount("1")).toBe("1");
  });

  it("0.01–1 keeps 2 decimals (matches referral list display)", () => {
    expect(formatAdaptiveAmount("0.05")).toBe("0.05");
    expect(formatAdaptiveAmount("0.2266666666666667")).toBe("0.22");
  });

  it("0.0001–0.01 keeps 4 decimals", () => {
    expect(formatAdaptiveAmount("0.0045")).toBe("0.0045");
    expect(formatAdaptiveAmount("0.0099999")).toBe("0.0099");
  });

  it("sub-0.0001 shows '<0.0001' instead of collapsing to 0", () => {
    expect(formatAdaptiveAmount("0.00005")).toBe("<0.0001");
  });

  it("zero / empty / NaN render as '0'", () => {
    expect(formatAdaptiveAmount("0")).toBe("0");
    expect(formatAdaptiveAmount("")).toBe("0");
    expect(formatAdaptiveAmount(0)).toBe("0");
  });

  it("regression: BUG-001 referral reward 0.2267 ODD must not show as 0", () => {
    expect(formatAdaptiveAmount("0.2266666666666667")).not.toBe("0");
  });
});

describe("formatCompact", () => {
  it("formats millions with M suffix", () => {
    expect(formatCompact("1500000")).toBe("$1.5M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCompact("50000")).toBe("$50K");
  });

  it("formats small values as plain dollar amount", () => {
    expect(formatCompact("99")).toBe("$99");
  });

  it("formats exactly 1M", () => {
    expect(formatCompact("1000000")).toBe("$1.0M");
  });

  it("formats exactly 1K", () => {
    expect(formatCompact("1000")).toBe("$1K");
  });

  it("handles empty string as $0", () => {
    expect(formatCompact("")).toBe("$0");
  });

  it("handles number input", () => {
    expect(formatCompact(2500000)).toBe("$2.5M");
  });
});

// ============================================================
// Trade calculations
// ============================================================

describe("calcEstimatedShares", () => {
  it("calculates shares: amount / price", () => {
    expect(calcEstimatedShares("100", "0.5")).toBe("200.00");
  });

  it("returns '0' when amount is empty", () => {
    expect(calcEstimatedShares("", "0.5")).toBe("0");
  });

  it("returns '0' when price is empty", () => {
    expect(calcEstimatedShares("100", "")).toBe("0");
  });

  it("returns '0' when price is zero", () => {
    expect(calcEstimatedShares("100", "0")).toBe("0");
  });

  it("formats result to 2 decimal places", () => {
    expect(calcEstimatedShares("100", "3")).toBe("33.33");
  });
});

describe("calcEstimatedReturn", () => {
  it("returns shares value formatted to 2 decimals", () => {
    expect(calcEstimatedReturn("150.555")).toBe("150.55");
  });

  it("returns '0' for empty string", () => {
    expect(calcEstimatedReturn("")).toBe("0");
  });

  it("formats integer shares", () => {
    expect(calcEstimatedReturn("100")).toBe("100.00");
  });
});

describe("calcProfitRatio", () => {
  it("calculates positive profit ratio", () => {
    // (200 - 100) / 100 * 100 = 100.0
    expect(calcProfitRatio("200", "100")).toBe("100.0");
  });

  it("calculates negative profit ratio", () => {
    // (50 - 100) / 100 * 100 = -50.0
    expect(calcProfitRatio("50", "100")).toBe("-50.0");
  });

  it("returns '0' when cost is zero", () => {
    expect(calcProfitRatio("100", "0")).toBe("0");
  });

  it("returns '0' when cost is empty", () => {
    expect(calcProfitRatio("100", "")).toBe("0");
  });

  it("calculates break-even", () => {
    expect(calcProfitRatio("100", "100")).toBe("0.0");
  });
});

// ============================================================
// Validation helpers
// ============================================================

describe("isValidAmount", () => {
  it("returns true for positive number string", () => {
    expect(isValidAmount("1.5")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidAmount("")).toBe(false);
  });

  it("returns false for '0'", () => {
    expect(isValidAmount("0")).toBe(false);
  });

  it("returns false for negative number", () => {
    expect(isValidAmount("-1")).toBe(false);
  });

  it("returns false for non-numeric string", () => {
    expect(isValidAmount("abc")).toBe(false);
  });

  it("returns true for very small positive number", () => {
    expect(isValidAmount("0.000001")).toBe(true);
  });
});

describe("isGt", () => {
  it("returns true when a > b", () => {
    expect(isGt("2", "1")).toBe(true);
  });

  it("returns false when a < b", () => {
    expect(isGt("1", "2")).toBe(false);
  });

  it("returns false when a equals b", () => {
    expect(isGt("1", "1")).toBe(false);
  });

  it("handles empty strings as 0", () => {
    expect(isGt("", "0")).toBe(false);
    expect(isGt("1", "")).toBe(true);
  });

  it("returns false for invalid input", () => {
    expect(isGt("abc", "1")).toBe(false);
  });
});

describe("cmp", () => {
  it("returns 1 when a > b", () => {
    expect(cmp("2", "1")).toBe(1);
  });

  it("returns -1 when a < b", () => {
    expect(cmp("1", "2")).toBe(-1);
  });

  it("returns 0 when a equals b", () => {
    expect(cmp("1", "1")).toBe(0);
  });

  it("handles empty strings as 0", () => {
    expect(cmp("", "0")).toBe(0);
  });

  it("works with decimal values", () => {
    expect(cmp("1.01", "1.001")).toBe(1);
    expect(cmp("0.001", "0.01")).toBe(-1);
  });
});
