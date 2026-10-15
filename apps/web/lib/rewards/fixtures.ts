/**
 * Reward Hub 本地 fixture —— DD-150（纯前端，无后端 / 无 MSW）。
 *
 * 数字遵循 mock-data.md「可信度」要求，避免占位符。
 * 文案不在此（走 i18n，见 messages/*.json `rewards` namespace）；
 * 这里只存结构：id / 状态 / 金额 / 时间，组件用 id 取 i18n key 渲染标签。
 *
 * endTime 为 UTC「YYYY-MM-DD HH:mm:ss」静态字符串（喂 useCountdown）。
 * 用静态字面量而非 `new Date()`：fixture 须稳定可复现，且项目禁止运行时 Date 漂移。
 */

import type { RewardRecord, TaskGroup } from "./types";

/**
 * 任务组 fixture。
 * 状态刻意混合，覆盖 TaskItemRow 全部视觉态：
 *   done / verifying×click（按钮） / verifying×input（输入框） / default。
 */
export const TASK_GROUPS: TaskGroup[] = [
  {
    id: "newbie",
    iconName: "gift",
    totalReward: "250",
    poolStat: "5,930",
    endTime: "2026-07-22 23:59:59",
    showDays: true,
    tasks: [
      { id: "newbie-follow-x", status: "done", verifyKind: "click", reward: "50" },
      { id: "newbie-join-tg", status: "verifying", verifyKind: "click", reward: "50" },
      { id: "newbie-first-bet", status: "default", verifyKind: "click", reward: "100" },
      { id: "newbie-retweet", status: "verifying", verifyKind: "input", reward: "30" },
      { id: "newbie-like", status: "default", verifyKind: "click", reward: "20" },
    ],
  },
  {
    id: "dailySocial",
    iconName: "megaphone",
    totalReward: "100",
    poolStat: "5,930",
    endTime: "2026-06-23 23:59:59",
    showDays: false,
    tasks: [
      { id: "daily-tweet", status: "done", verifyKind: "input", reward: "50" },
      { id: "daily-bet", status: "default", verifyKind: "click", reward: "50" },
    ],
  },
];

/**
 * 奖励记录 fixture。
 * 三种状态各有样本，供 PillSwitcher（待领取 / 已领取 / 已过期）切换演示。
 */
export const REWARD_RECORDS: RewardRecord[] = [
  { id: "rec-shoutout-0612", status: "claimable", amount: "100", date: "2026-06-12" },
  { id: "rec-firstbet-0611", status: "claimable", amount: "80", date: "2026-06-11" },
  { id: "rec-connect-0610", status: "claimed", amount: "50", date: "2026-06-10" },
  { id: "rec-deposit-0609", status: "claimed", amount: "120", date: "2026-06-09" },
  { id: "rec-daily-0605", status: "expired", amount: "50", date: "2026-06-05" },
];
