import { describe, it, expect } from "vitest";
import { toOdds, toOddsDisplay, formatOdds, formatContractOdds, formatOddWei } from "./odds";

describe("toOdds", () => {
  it("converts 0.5 probability to 2.00 odds", () => {
    expect(toOdds("0.5")).toBe("2.00");
  });

  it("converts 0.25 probability to 4.00 odds", () => {
    expect(toOdds("0.25")).toBe("4.00");
  });

  it("converts 0.01 to high odds", () => {
    expect(toOdds("0.01")).toBe("100.00");
  });

  it("converts 0.99 to low odds", () => {
    expect(toOdds("0.99")).toBe("1.01");
  });

  it("returns '--' for empty string", () => {
    expect(toOdds("")).toBe("--");
  });

  it("returns '--' for probability 0", () => {
    expect(toOdds("0")).toBe("--");
  });

  it("returns '--' for probability 1", () => {
    expect(toOdds("1")).toBe("--");
  });

  it("returns '--' for negative probability", () => {
    expect(toOdds("-0.5")).toBe("--");
  });

  it("returns '--' for probability > 1", () => {
    expect(toOdds("1.5")).toBe("--");
  });

  it("handles typical market probability 0.35", () => {
    expect(toOdds("0.35")).toBe("2.85");
  });
});

describe("toOddsDisplay", () => {
  it("appends 'x' suffix for valid odds", () => {
    expect(toOddsDisplay("0.5")).toBe("2.00x");
  });

  it("returns '--' for invalid probability", () => {
    expect(toOddsDisplay("0")).toBe("--");
    expect(toOddsDisplay("")).toBe("--");
    expect(toOddsDisplay("1")).toBe("--");
  });

  it("appends 'x' to high odds", () => {
    expect(toOddsDisplay("0.01")).toBe("100.00x");
  });

  it("appends 'x' to low odds", () => {
    expect(toOddsDisplay("0.99")).toBe("1.01x");
  });
});

describe("formatOdds", () => {
  it("trims 4-decimal backend value to 2 decimals (regression: 巴黎 vs 阿森纳 1x2 '2.4400')", () => {
    expect(formatOdds("2.4400")).toBe("2.44");
    expect(formatOdds("3.2700")).toBe("3.27");
    expect(formatOdds("1.8100")).toBe("1.81");
  });

  it("keeps 2-decimal value as-is", () => {
    expect(formatOdds("1.93")).toBe("1.93");
    expect(formatOdds("1.91")).toBe("1.91");
  });

  it("pads 1-decimal value to 2 decimals", () => {
    expect(formatOdds("2.5")).toBe("2.50");
    expect(formatOdds("3")).toBe("3.00");
  });

  it("truncates 3+ decimal value to 2 decimals (lib/decimal.ts 全局设置 ROUND_DOWN，金融向下截断惯例)", () => {
    expect(formatOdds("2.344")).toBe("2.34");
    expect(formatOdds("2.345")).toBe("2.34");
    expect(formatOdds("2.349")).toBe("2.34");
    expect(formatOdds("2.350")).toBe("2.35");
    expect(formatOdds("2.999")).toBe("2.99");
  });

  it("returns '—' for missing / placeholder / invalid input", () => {
    expect(formatOdds(undefined)).toBe("—");
    expect(formatOdds(null)).toBe("—");
    expect(formatOdds("")).toBe("—");
    expect(formatOdds("   ")).toBe("—");
    expect(formatOdds("—")).toBe("—");
    expect(formatOdds("--")).toBe("—");
    expect(formatOdds("abc")).toBe("—");
  });

  it("accepts number input", () => {
    expect(formatOdds(2.44)).toBe("2.44");
    expect(formatOdds(3)).toBe("3.00");
  });
});

describe("formatContractOdds", () => {
  it("converts contract integer string to 2-decimal display", () => {
    expect(formatContractOdds("22900")).toBe("2.29");
    expect(formatContractOdds("33600")).toBe("3.36");
    expect(formatContractOdds("10100")).toBe("1.01");
  });

  it("handles min odds boundary", () => {
    expect(formatContractOdds("10000")).toBe("1.00");
  });

  it("handles large odds", () => {
    expect(formatContractOdds("1000000")).toBe("100.00");
    // formatAmount truncates rather than rounds (preserves precision），999999 → 99.99
    expect(formatContractOdds("999999")).toBe("99.99");
  });

  it("accepts number input", () => {
    expect(formatContractOdds(22900)).toBe("2.29");
  });

  it("returns '—' for null / undefined / NaN / negative", () => {
    expect(formatContractOdds(null)).toBe("—");
    expect(formatContractOdds(undefined)).toBe("—");
    expect(formatContractOdds("not-a-number")).toBe("—");
    expect(formatContractOdds(-1)).toBe("—");
    expect(formatContractOdds(NaN)).toBe("—");
  });

  it("trims whitespace", () => {
    expect(formatContractOdds("  22900  ")).toBe("2.29");
  });

  it("handles zero (degenerate odds, theoretically possible if backend pushes pre-init data)", () => {
    expect(formatContractOdds("0")).toBe("0.00");
  });
});

describe("formatOddWei (DD-119 P2)", () => {
  it("converts 18-decimal ODD wei → 2dp 主单位（无千分位，输入框安全）", () => {
    expect(formatOddWei("80000000000000000000000")).toBe("80000.00");
    expect(formatOddWei("2000000000000000000")).toBe("2.00");
  });

  it("zero wei → '0.00'", () => {
    expect(formatOddWei("0")).toBe("0.00");
  });

  it("sub-0.01 wei 截断为 '0.00'（formatAmount 截断不四舍五入）", () => {
    expect(formatOddWei("1")).toBe("0.00");
  });

  it("非法输入（空 / 非数字）→ '0.00' 兜底", () => {
    expect(formatOddWei("")).toBe("0.00");
    expect(formatOddWei("not-a-number")).toBe("0.00");
  });
});
