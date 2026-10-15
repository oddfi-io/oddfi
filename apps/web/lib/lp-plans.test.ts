import { describe, it, expect } from "vitest";
import { LP_PLAN_OPTIONS, getLpPlan } from "./lp-plans";

// Source-of-truth: oddfi-ODD/src/shared/constants/LiquidityConstants.sol GLOBAL_PLAN_0..4
// (cbbf577 天对齐：SECONDS_PER_DAY=86400，单位为天)
const EXPECTED = [
  { planId: 0, lockDays: 7, weightBps: 5000, apyBoost: "0.5x" },
  { planId: 1, lockDays: 14, weightBps: 10000, apyBoost: "1.0x" },
  { planId: 2, lockDays: 28, weightBps: 18000, apyBoost: "1.8x" },
  { planId: 3, lockDays: 60, weightBps: 25000, apyBoost: "2.5x" },
  { planId: 4, lockDays: 90, weightBps: 35000, apyBoost: "3.5x" },
];

describe("LP_PLAN_OPTIONS", () => {
  it("contains exactly 5 plan tiers (matches contract LiquidityConstants)", () => {
    expect(LP_PLAN_OPTIONS).toHaveLength(5);
  });

  EXPECTED.forEach((expected) => {
    it(`planId=${expected.planId}: lockDays=${expected.lockDays}, weightBps=${expected.weightBps}`, () => {
      const plan = LP_PLAN_OPTIONS[expected.planId];
      expect(plan.planId).toBe(expected.planId);
      expect(plan.lockDays).toBe(expected.lockDays);
      expect(plan.weightBps).toBe(expected.weightBps);
      expect(plan.apyBoost).toBe(expected.apyBoost);
    });
  });

  it("planIds are 0..4 in order", () => {
    expect(LP_PLAN_OPTIONS.map((p) => p.planId)).toEqual([0, 1, 2, 3, 4]);
  });

  it("lockDays matches contract day-based values (7 < 14 < 28 < 60 < 90)", () => {
    expect(LP_PLAN_OPTIONS.map((p) => p.lockDays)).toEqual([7, 14, 28, 60, 90]);
    const days = LP_PLAN_OPTIONS.map((p) => p.lockDays);
    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBeGreaterThan(days[i - 1]);
    }
  });

  it("weightBps strictly increases (5000 < 10000 < 18000 < 25000 < 35000)", () => {
    const bps = LP_PLAN_OPTIONS.map((p) => p.weightBps);
    for (let i = 1; i < bps.length; i++) {
      expect(bps[i]).toBeGreaterThan(bps[i - 1]);
    }
  });
});

describe("getLpPlan", () => {
  EXPECTED.forEach((expected) => {
    it(`planId=${expected.planId} returns plan with lockDays=${expected.lockDays}`, () => {
      const plan = getLpPlan(expected.planId)!;
      expect(plan).toBeDefined();
      expect(plan.lockDays).toBe(expected.lockDays);
    });
  });

  it("unknown planId returns undefined (no NPE)", () => {
    expect(getLpPlan(99)).toBeUndefined();
    expect(getLpPlan(-1)).toBeUndefined();
  });
});
