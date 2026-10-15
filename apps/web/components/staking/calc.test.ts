import { describe, it, expect } from "vitest";
import { calcEstimate, calcEstApy } from "./calc";
import type { NetworkStats } from "./types";

// 干净取值让 decimal 结果可精确断言：
//   totalWeight = 1000 * 1 = 1000
//   userWeight  = 1000 * 1 = 1000  → newTotalWeight = 2000
//   dailyEarn   = 100 * 1000 / 2000 = 50
const STATS: NetworkStats = {
  totalStaked: "1000",
  avgWeightMult: "1",
  avgDailyMargin: "100",
  rewardPool: "0",
  oddPrice: "1",
};

describe("calcEstimate — DD-149 按天口径", () => {
  it("totalEarn = dailyEarn × lockDays（天，不再 ÷24）", () => {
    const est = calcEstimate(STATS, "1000", 1.0, 30);
    expect(est.dailyEarn).toBe("50");
    // 按天：50 × 30 = 1500（旧 bug ÷24 会得 62.5）
    expect(est.totalEarn).toBe("1500");
    expect(est.totalEarnUsd).toBe("1500");
  });

  it("lockDays 翻倍 → totalEarn 线性翻倍", () => {
    const e30 = calcEstimate(STATS, "1000", 1.0, 30);
    const e60 = calcEstimate(STATS, "1000", 1.0, 60);
    expect(Number(e60.totalEarn)).toBeCloseTo(Number(e30.totalEarn) * 2, 6);
  });

  it("unlockDate 偏移 = lockDays × 86400 秒（真实天）", () => {
    const before = Date.now();
    const est = calcEstimate(STATS, "1000", 1.0, 7);
    const offsetMs = new Date(est.unlockDate).getTime() - before;
    const expectedMs = 7 * 86400 * 1000;
    // 允许执行耗时几秒的抖动
    expect(Math.abs(offsetMs - expectedMs)).toBeLessThan(5000);
  });
});

describe("calcEstApy — 与锁仓单位无关（DD-149 不改 APY 口径）", () => {
  it("apy = avgDailyMargin × mult / totalWeight × 365 × 100", () => {
    // (100 * 1 / 1000) * 365 * 100 = 3650
    expect(calcEstApy(STATS, 1.0)).toBe("3650");
  });
});
