// LiquidityPool planId → lock duration / weight multiplier mapping
// source: oddfi-ODD/src/shared/constants/LiquidityConstants.sol GLOBAL_PLAN_0..4（cbbf577，天对齐）
//   planId 0: 7 天,  weight 5000  bps (0.5x)
//   planId 1: 14 天, weight 10000 bps (1.0x base)
//   planId 2: 28 天, weight 18000 bps (1.8x)
//   planId 3: 60 天, weight 25000 bps (2.5x)
//   planId 4: 90 天, weight 35000 bps (3.5x)
// unlockAt = block.timestamp + lockDays * 86400（SECONDS_PER_DAY=86400，真实天）
//
// ⚠️ 三镜像须人工同步：真值在合约，后端 config_*.yaml(global_plans) 与本表都是人工镜像。
//   金库链路前端直传 planId（不依赖 lock_hours 反查），故 LP 改值无后端透传 key 顾虑。
// apyBoost 是展示倍率；真实 APY 来自链上 reward rate / total weight（apy 字段为估算，见 DD-149 §7）。
export const LP_PLAN_OPTIONS = [
  { planId: 0, lockDays: 7, weightBps: 5000, apyBoost: "0.5x", apy: "29" },
  { planId: 1, lockDays: 14, weightBps: 10000, apyBoost: "1.0x", apy: "58" },
  { planId: 2, lockDays: 28, weightBps: 18000, apyBoost: "1.8x", apy: "105" },
  { planId: 3, lockDays: 60, weightBps: 25000, apyBoost: "2.5x", apy: "146" },
  { planId: 4, lockDays: 90, weightBps: 35000, apyBoost: "3.5x", apy: "204" },
] as const;

export type LpPlanId = (typeof LP_PLAN_OPTIONS)[number]["planId"];

export function getLpPlan(planId: number): (typeof LP_PLAN_OPTIONS)[number] | undefined {
  return LP_PLAN_OPTIONS.find((p) => p.planId === planId);
}
