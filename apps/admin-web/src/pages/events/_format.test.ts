import { describe, it, expect } from "vitest";
import {
  yieldTier,
  settlePlTier,
  formatOdds,
  formatSignedOdds,
  formatRatioPercent,
  formatScore,
} from "./_format";

describe("yieldTier — 收益率三态色", () => {
  it.each<[number, "red" | "gold" | "green"]>([
    [0.51, "red"],
    [0.8, "red"],
    [0.31, "gold"],
    [0.5, "gold"], // 边界：>0.5 才红，0.5 落黄
    [0.3, "green"], // 边界：>0.3 才黄，0.3 落绿
    [0.1, "green"],
    [0, "green"],
  ])("ratio=%s → %s", (ratio, color) => {
    expect(yieldTier(ratio)?.color).toBe(color);
  });

  it("格式化为百分比文本", () => {
    expect(yieldTier(0.512)?.text).toBe("51.2%");
  });

  it("null/NaN → null（D6 预期态，展示「—」）", () => {
    expect(yieldTier(null)).toBeNull();
    expect(yieldTier(undefined)).toBeNull();
    expect(yieldTier(Number.NaN)).toBeNull();
  });
});

describe("settlePlTier — 盈亏正绿负红", () => {
  it("正数 → green", () => {
    expect(settlePlTier("1234.50")).toEqual({ color: "green", negative: false });
  });

  it("零 → green（无亏损即非红）", () => {
    expect(settlePlTier("0")).toEqual({ color: "green", negative: false });
  });

  it("负数 → red", () => {
    expect(settlePlTier("-88.00")).toEqual({ color: "red", negative: true });
  });

  it("null/空串/非法 decimal → null", () => {
    expect(settlePlTier(null)).toBeNull();
    expect(settlePlTier("")).toBeNull();
    expect(settlePlTier("abc")).toBeNull();
  });
});

describe("formatOdds", () => {
  it("数字原样展示", () => {
    expect(formatOdds(1.98)).toBe("1.98");
  });
  it("null → —", () => {
    expect(formatOdds(null)).toBe("—");
    expect(formatOdds(undefined)).toBe("—");
  });
});

describe("formatSignedOdds — 赔率差值带符号（联调 A schema diff：number）", () => {
  it("正数带 +", () => {
    expect(formatSignedOdds(0.05)).toBe("+0.05");
  });
  it("负数原样", () => {
    expect(formatSignedOdds(-0.12)).toBe("-0.12");
  });
  it("零无符号", () => {
    expect(formatSignedOdds(0)).toBe("0");
  });
  it("null → —", () => {
    expect(formatSignedOdds(null)).toBe("—");
  });
});

describe("formatScore — 终场比分对象（联调 A schema diff：{home,away} 非字符串）", () => {
  it("对象 → 'h : a'", () => {
    expect(formatScore({ home: 2, away: 1 })).toBe("2 : 1");
  });
  it("null → null（D6 未落库预期态）", () => {
    expect(formatScore(null)).toBeNull();
    expect(formatScore(undefined)).toBeNull();
  });
});

describe("formatRatioPercent — 压缩率带符号百分比", () => {
  it("负比率 = 压缩", () => {
    expect(formatRatioPercent(-0.09)).toBe("-9%");
  });
  it("正比率带 +", () => {
    expect(formatRatioPercent(0.125)).toBe("+12.5%");
  });
  it("null → —", () => {
    expect(formatRatioPercent(null)).toBe("—");
  });
});
