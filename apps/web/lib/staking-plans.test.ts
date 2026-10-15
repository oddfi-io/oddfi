import { describe, it, expect } from "vitest";
import { STAKING_PLANS, getPlanById, isValidPlanId } from "./staking-plans";

// DD-149 三镜像一致性守卫（防前端侧手滑漂移）：
//   - lockDays  必须 == 合约 StakingConstants（cbbf577）真实锁仓天数
//   - lockHoursKey 必须 == 后端 config_*.yaml staking_plans.lock_hours（透传 key）
// ⚠️ 诚实边界：后端 yaml 不在前端仓库，本断言只能校验「前端表 == 期望硬编码值」，
//   无法校验后端当前值；后端侧漂移靠 backend-handoff.md 交接 + 联调发现。
const EXPECTED = [
  { planId: 0, lockDays: 7, lockHoursKey: 8, multiplier: 0.5 },
  { planId: 1, lockDays: 30, lockHoursKey: 16, multiplier: 1.0 },
  { planId: 2, lockDays: 60, lockHoursKey: 24, multiplier: 1.8 },
  { planId: 3, lockDays: 90, lockHoursKey: 32, multiplier: 4.0 },
  { planId: 4, lockDays: 180, lockHoursKey: 40, multiplier: 8.0 },
  { planId: 5, lockDays: 360, lockHoursKey: 48, multiplier: 15.0 },
];

describe("STAKING_PLANS — 三镜像一致性", () => {
  it("exactly 6 plans, planIds 0..5 in order", () => {
    expect(STAKING_PLANS).toHaveLength(6);
    expect(STAKING_PLANS.map((p) => p.planId)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("lockDays == 合约真值 (7/30/60/90/180/360)", () => {
    expect(STAKING_PLANS.map((p) => p.lockDays)).toEqual([7, 30, 60, 90, 180, 360]);
  });

  it("lockHoursKey == 后端 config staking_plans.lock_hours (8/16/24/32/40/48)", () => {
    expect(STAKING_PLANS.map((p) => p.lockHoursKey)).toEqual([8, 16, 24, 32, 40, 48]);
  });

  EXPECTED.forEach((e) => {
    it(`planId=${e.planId}: lockDays=${e.lockDays}, lockHoursKey=${e.lockHoursKey}, ${e.multiplier}x`, () => {
      const plan = STAKING_PLANS[e.planId];
      expect(plan.planId).toBe(e.planId);
      expect(plan.lockDays).toBe(e.lockDays);
      expect(plan.lockHoursKey).toBe(e.lockHoursKey);
      expect(plan.multiplier).toBe(e.multiplier);
    });
  });

  it("lockDays 与 lockHoursKey 不可混淆（值域不重叠，误传可被运行时区分）", () => {
    const days = new Set(STAKING_PLANS.map((p) => p.lockDays as number));
    const keys = STAKING_PLANS.map((p) => p.lockHoursKey as number);
    for (const k of keys) expect(days.has(k)).toBe(false);
  });
});

describe("getPlanById / isValidPlanId", () => {
  it("getPlanById returns matching plan", () => {
    expect(getPlanById(5).lockDays).toBe(360);
    expect(getPlanById(2).lockHoursKey).toBe(24);
  });

  it("getPlanById falls back to plan 0 on unknown id", () => {
    expect(getPlanById(99).planId).toBe(0);
  });

  it("isValidPlanId guards range 0..5", () => {
    expect(isValidPlanId(0)).toBe(true);
    expect(isValidPlanId(5)).toBe(true);
    expect(isValidPlanId(6)).toBe(false);
    expect(isValidPlanId(-1)).toBe(false);
    expect(isValidPlanId(1.5)).toBe(false);
  });
});
