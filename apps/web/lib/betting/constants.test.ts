import { describe, it, expect } from "vitest";
import {
  MIN_BET_ODD,
  isStakeBelowMin,
  toOddAmount,
  isOnchainTestFixture,
  isTestFixtureId,
  isAnyTestFixture,
} from "./constants";

describe("betting constants", () => {
  it("MIN_BET_ODD locks to contract BettingConstants.MIN_BET_AMOUNT (100 ODD)", () => {
    expect(MIN_BET_ODD).toBe(100);
  });
});

describe("isStakeBelowMin", () => {
  it("returns false for empty / invalid / zero (handled by separate gate)", () => {
    expect(isStakeBelowMin("")).toBe(false);
    expect(isStakeBelowMin(undefined)).toBe(false);
    expect(isStakeBelowMin(null)).toBe(false);
    expect(isStakeBelowMin("abc")).toBe(false);
    expect(isStakeBelowMin("0")).toBe(false);
    expect(isStakeBelowMin("0.0")).toBe(false);
  });

  it("returns true for amounts in (0, MIN_BET_ODD)", () => {
    expect(isStakeBelowMin("0.01")).toBe(true);
    expect(isStakeBelowMin("50")).toBe(true);
    expect(isStakeBelowMin("99.99")).toBe(true);
  });

  it("returns false at boundary MIN_BET_ODD and above", () => {
    expect(isStakeBelowMin("100")).toBe(false);
    expect(isStakeBelowMin("100.0")).toBe(false);
    expect(isStakeBelowMin("100.01")).toBe(false);
    expect(isStakeBelowMin("1000")).toBe(false);
  });

  it("returns false for negative inputs (defensive)", () => {
    expect(isStakeBelowMin("-50")).toBe(false);
  });
});

describe("toOddAmount", () => {
  it("canConvert=false → 原样返回（amount 已是 ODD）", () => {
    expect(toOddAmount("50", false, "1.5")).toBe("50");
    expect(toOddAmount("100", false, null)).toBe("100");
  });

  it("canConvert=true + rate 有效 → div(amount, rate)", () => {
    // 50 USD / 0.5 USD-per-ODD = 100 ODD
    expect(toOddAmount("50", true, "0.5")).toBe("100");
  });

  it("canConvert=true 但 rate 缺失 → 原值（不做错误换算）", () => {
    expect(toOddAmount("50", true, null)).toBe("50");
    expect(toOddAmount("50", true, undefined)).toBe("50");
  });

  it("空 / undefined / null 输入 → '0'", () => {
    expect(toOddAmount("", false, null)).toBe("0");
    expect(toOddAmount(undefined, false, null)).toBe("0");
    expect(toOddAmount(null, true, "1")).toBe("0");
  });
});

describe("isOnchainTestFixture (DD-138)", () => {
  it("命中 99301/99302 系链上测试赛事（base × 1e10 + round_start_unix）", () => {
    // 实测 dev 返回的真实 fixture id（2026-06-07 轮次）
    expect(isOnchainTestFixture(993011780822200)).toBe(true);
    expect(isOnchainTestFixture(993021780822200)).toBe(true);
  });

  it("区间边界：闭下界 / 开上界", () => {
    expect(isOnchainTestFixture(99301e10)).toBe(true);
    expect(isOnchainTestFixture(99303e10)).toBe(false);
    expect(isOnchainTestFixture(99301e10 - 1)).toBe(false);
  });

  it("区间两端为安全整数（防 JSON.parse 精度坍缩误判）", () => {
    expect(Number.isSafeInteger(99301e10)).toBe(true);
    expect(Number.isSafeInteger(99303e10)).toBe(true);
  });

  it("旧演示测试赛事 99200001 不命中（语义相反：它走中心化，链上测试走链上）", () => {
    expect(isOnchainTestFixture(99200001)).toBe(false);
    expect(isTestFixtureId(99200001)).toBe(true);
  });

  it("链上测试赛事不得进入 TEST_FIXTURE_IDS 黑名单（守护：闭环必须走链上）", () => {
    expect(isTestFixtureId(993011780822200)).toBe(false);
    expect(isTestFixtureId(993021780822200)).toBe(false);
  });

  it("普通真实赛事不命中", () => {
    expect(isOnchainTestFixture(19609127)).toBe(false);
    expect(isOnchainTestFixture(0)).toBe(false);
  });

  it("isAnyTestFixture：链上测试 + 演示测试都命中，普通赛事不命中", () => {
    expect(isAnyTestFixture(993011780822200)).toBe(true); // 链上测试
    expect(isAnyTestFixture(99200001)).toBe(true); // 演示测试
    expect(isAnyTestFixture(19609127)).toBe(false); // 普通真实赛事
  });
});
