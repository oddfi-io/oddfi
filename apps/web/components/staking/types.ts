// [TEMP:staking] Temporary — will be replaced when backend staking API is ready

import type { StakePositionStatus } from "@/lib/staking-state";
import type { LockDays, LockHoursKey } from "@/lib/staking-plans";

export type { LockDays, LockHoursKey };

export interface StakingTier {
  lockDays: LockDays; // 展示用真实锁仓天数
  lockHoursKey: LockHoursKey; // 后端反查 planId 的透传 key（opaque，仅发后端）
  multiplier: number; // weight multiplier, e.g. 1.5
  label: string; // e.g. "1.5x"
}

export interface NetworkStats {
  totalStaked: string; // OFI decimal string
  avgWeightMult: string; // average weight multiplier
  avgDailyMargin: string; // daily platform margin distributed
  rewardPool: string; // total reward pool
  oddPrice: string; // OFI → USD price
}

export interface StakeEstimate {
  apy: string; // percentage string, e.g. "58.2"
  dailyEarn: string; // OFI per day
  totalEarn: string; // OFI over period
  totalEarnUsd: string; // USD value
  unlockDate: string; // ISO date string
}

export type PositionStatus = StakePositionStatus;

export interface StakingPosition {
  id: string;
  amount: string; // OFI staked
  multiplier: number;
  lockDays: LockDays;
  status: PositionStatus;
  stakedAt: string; // ISO date
  unlockAt: string; // ISO date
  earned: string; // OFI earned so far
}

export interface HistoryRecord {
  id: string;
  action: "stake" | "unstake" | "early_unstake";
  amount: string;
  lockDays: LockDays;
  multiplier: number;
  date: string; // ISO date
  reward?: string; // OFI earned (for unstake)
}
