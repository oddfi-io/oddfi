// 比赛/球队语义色 — 详情列子卡片单一数据源
// ASSETS.md 已查（关键词：colors / match / team / home / away / outcome），无替代品
// 设计师确认 Token 后，全局搜 @figma-hardcoded 替换即可

import type { MatchOutcome } from "@/types/moneyline";

// @figma-hardcoded: #3b82f6 home-blue — pending design token
export const HOME_BLUE = "#3b82f6";
// @figma-hardcoded: #f97316 away-orange — pending design token
export const AWAY_ORANGE = "#f97316";

// 比赛结果配色 — 两套色板：
//   Panel 实色背景（H2H/Standings/Lineups）→ Tailwind class（走 design token）
//   Venue frosted 浮层 → 半透明优化的 hex（D 用半透明白，保持与 text-white/N 层级一致）
export const OUTCOME_BG_CLASS: Record<MatchOutcome, string> = {
  W: "bg-fn-green",
  L: "bg-fn-red",
  D: "bg-tertiary",
};

export const OUTCOME_HEX: Record<MatchOutcome, string> = {
  W: "#2DB270",
  L: "#ED4C52",
  D: "rgba(255,255,255,0.5)",
};
