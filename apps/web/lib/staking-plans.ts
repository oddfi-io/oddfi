// Staking plan registry — single source of truth (DD-107 Batch 1 · DD-149 天对齐)
//
// source: 合约 oddfi-ODD cbbf577（SECONDS_PER_DAY=86400，真实天）。
//   StakingConstants.STAKE_PLAN_*_LOCK_DAYS = 7/30/60/90/180/360 天。
//   unlockAt = block.timestamp + lockDays * 86400。
//
// ⚠️ 三镜像须人工同步：锁仓常量真值在合约，后端 config_*.yaml(staking_plans) 与本表
//   都是它的人工镜像。合约 _stakePlan 为 internal pure 不可 eth_call，无法运行时直读，
//   故保持硬编码。治本见 ADR-0007（迁 planId 直传 / 合约 view）。
//
// ⛔ 关键不变量：lockHoursKey 必须与后端 config_*.yaml staking_plans.lock_hours 逐项一致，
//   否则 PlanIDByLockHours 反查 miss → INVALID_STAKE_PLAN（全员质押失败）。
//   lockHoursKey 是后端反查 planId 的「透传 key」（非真实锁仓时长，勿当周期用）。
//   改动任一侧必须双向同步（见 .progress/designs/DD-149/backend-handoff.md）。

/** 展示用真实锁仓天数（branded，与 LockHoursKey 不可互换） */
export type LockDays = (7 | 30 | 60 | 90 | 180 | 360) & { readonly __brand: "lockDays" };
/** 后端反查 planId 的透传 key（== config_*.yaml staking_plans.lock_hours，opaque，勿当周期用） */
export type LockHoursKey = (8 | 16 | 24 | 32 | 40 | 48) & { readonly __brand: "lockHoursKey" };

export interface StakingPlan {
  /** planId in contract (0..5) */
  planId: number;
  /** 真实锁仓天数：展示 + 解锁/收益计算 */
  lockDays: LockDays;
  /** 后端透传 key（仅发后端，opaque，非真实时长） */
  lockHoursKey: LockHoursKey;
  /** Weight multiplier (e.g. 0.5, 1.0, 1.8, 4.0, 8.0, 15.0) */
  multiplier: number;
  /** UI display label, e.g. "0.5x" */
  label: string;
}

export const STAKING_PLANS: StakingPlan[] = [
  {
    planId: 0,
    lockDays: 7 as LockDays,
    lockHoursKey: 8 as LockHoursKey,
    multiplier: 0.5,
    label: "0.5x",
  },
  {
    planId: 1,
    lockDays: 30 as LockDays,
    lockHoursKey: 16 as LockHoursKey,
    multiplier: 1.0,
    label: "1.0x",
  },
  {
    planId: 2,
    lockDays: 60 as LockDays,
    lockHoursKey: 24 as LockHoursKey,
    multiplier: 1.8,
    label: "1.8x",
  },
  {
    planId: 3,
    lockDays: 90 as LockDays,
    lockHoursKey: 32 as LockHoursKey,
    multiplier: 4.0,
    label: "4.0x",
  },
  {
    planId: 4,
    lockDays: 180 as LockDays,
    lockHoursKey: 40 as LockHoursKey,
    multiplier: 8.0,
    label: "8.0x",
  },
  {
    planId: 5,
    lockDays: 360 as LockDays,
    lockHoursKey: 48 as LockHoursKey,
    multiplier: 15.0,
    label: "15.0x",
  },
];

const PLAN_BY_ID = new Map<number, StakingPlan>(STAKING_PLANS.map((p) => [p.planId, p]));

export function getPlanById(planId: number): StakingPlan {
  return PLAN_BY_ID.get(planId) ?? STAKING_PLANS[0];
}

export function isValidPlanId(planId: number): boolean {
  return Number.isInteger(planId) && planId >= 0 && planId < STAKING_PLANS.length;
}
