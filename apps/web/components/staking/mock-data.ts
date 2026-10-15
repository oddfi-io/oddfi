// [TEMP:staking] Temporary — will be replaced when backend staking API is ready

import type { NetworkStats, StakingPosition, HistoryRecord, LockDays } from "./types";

// DD-149：mock 周期由原 hours(8/16/24/32/40/48) 映射为真实 lockDays(7/30/60/90/180/360)，
// 保持与 multiplier 的 planId 对应（48h↔360天/15x，32h↔90天/4x，24h↔60天/1.8x，16h↔30天/1x）。

export const NETWORK_STATS: NetworkStats = {
  totalStaked: "2840000",
  avgWeightMult: "1.6",
  avgDailyMargin: "6886",
  rewardPool: "248,296",
  oddPrice: "0.10",
};

export const MIN_STAKE = "100";
export const MOCK_BALANCE = "12500";

export const ACTIVE_POSITIONS: StakingPosition[] = [
  {
    id: "pos-001",
    amount: "5000",
    multiplier: 15.0,
    lockDays: 360 as LockDays,
    status: "ready",
    stakedAt: "2026-05-11T08:00:00Z",
    unlockAt: "2026-05-13T08:00:00Z",
    earned: "342.50",
  },
  {
    id: "pos-003",
    amount: "8000",
    multiplier: 4.0,
    lockDays: 90 as LockDays,
    status: "active",
    stakedAt: "2026-05-11T10:00:00Z",
    unlockAt: "2026-05-12T18:00:00Z",
    earned: "256.80",
  },
];

export const HISTORY_RECORDS: HistoryRecord[] = [
  {
    id: "hist-001",
    action: "unstake",
    amount: "3000",
    lockDays: 60 as LockDays,
    multiplier: 1.8,
    date: "2026-05-10T09:00:00Z",
    reward: "210.50",
  },
  {
    id: "hist-002",
    action: "stake",
    amount: "8000",
    lockDays: 360 as LockDays,
    multiplier: 15.0,
    date: "2026-05-09T15:00:00Z",
  },
  {
    id: "hist-003",
    action: "early_unstake",
    amount: "1500",
    lockDays: 30 as LockDays,
    multiplier: 1.0,
    date: "2026-05-08T11:00:00Z",
    reward: "32.10",
  },
  {
    id: "hist-004",
    action: "stake",
    amount: "5000",
    lockDays: 360 as LockDays,
    multiplier: 15.0,
    date: "2026-05-07T20:00:00Z",
  },
];
