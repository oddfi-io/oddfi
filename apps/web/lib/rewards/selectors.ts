/**
 * Reward Hub 派生选择器（纯函数）—— DD-150。
 * P0 必测（selectors.test.ts co-location）：进度计算 / 状态过滤错误会直接污染整页展示。
 */

import type { RewardRecord, RewardStatus, TaskGroup } from "./types";

/** 任务组进度：已完成（status === 'done'）数 / 总数 */
export function getGroupProgress(group: TaskGroup): { done: number; total: number } {
  const total = group.tasks.length;
  const done = group.tasks.filter((t) => t.status === "done").length;
  return { done, total };
}

/** 按状态过滤奖励记录（PillSwitcher 待领取 / 已领取 / 已过期） */
export function getRewardsByStatus(records: RewardRecord[], status: RewardStatus): RewardRecord[] {
  return records.filter((r) => r.status === status);
}
