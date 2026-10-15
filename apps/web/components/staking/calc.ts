// [TEMP:staking] Temporary — will be replaced when backend staking API is ready

import { mul, div, add } from "@/lib/decimal";
import type { NetworkStats, StakeEstimate } from "./types";

/**
 * Calculate estimated APY for a given multiplier.
 *
 * Formula:
 *   totalWeight = totalStaked * avgWeightMult
 *   estApy = (avgDailyMargin * mult / totalWeight) * 365 * 100
 */
export function calcEstApy(stats: NetworkStats, multiplier: number): string {
  const mult = String(multiplier);
  const totalWeight = mul(stats.totalStaked, stats.avgWeightMult);
  const dailyRate = div(mul(stats.avgDailyMargin, mult), totalWeight);
  return mul(mul(dailyRate, "365"), "100");
}

/**
 * Calculate full estimate for a user staking `amount` OFI for `lockDays` at `multiplier`.
 *
 * Formula:
 *   userWeight = amount * mult
 *   newTotalWeight = totalWeight + userWeight
 *   dailyEarn = avgDailyMargin * userWeight / newTotalWeight
 *   totalEarn = dailyEarn * lockDays
 *   totalEarnUsd = totalEarn * oddPrice
 */
export function calcEstimate(
  stats: NetworkStats,
  amount: string,
  multiplier: number,
  lockDays: number
): StakeEstimate {
  const mult = String(multiplier);
  const totalWeight = mul(stats.totalStaked, stats.avgWeightMult);
  const userWeight = mul(amount, mult);
  const newTotalWeight = add(totalWeight, userWeight);

  const dailyEarn = div(mul(stats.avgDailyMargin, userWeight), newTotalWeight);
  // DD-149：周期单位改天，合计 = 日收益 × 天数（金额走 decimal.ts，不用原生浮点）
  const totalEarn = mul(dailyEarn, String(lockDays));
  const totalEarnUsd = mul(totalEarn, stats.oddPrice);
  const apy = calcEstApy(stats, multiplier);

  // 解锁时间偏移（时间戳毫秒，非金额，可用原生数）：天 × 86400 秒
  const unlockDate = new Date();
  unlockDate.setTime(unlockDate.getTime() + lockDays * 86400 * 1000);

  return {
    apy,
    dailyEarn,
    totalEarn,
    totalEarnUsd,
    unlockDate: unlockDate.toISOString(),
  };
}

/**
 * Format OFI amount for display: comma-separated with 2 decimals.
 */
export function formatOfi(val: string): string {
  const num = parseFloat(val || "0");
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
