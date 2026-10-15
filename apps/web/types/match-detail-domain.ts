/**
 * DD-104: Match Detail 详情列 domain 类型（camelCase，consumer 用）。
 *
 * 后端 commit: 873beed (origin/dev · oddfi-backend)
 *
 * wire 类型 → domain 类型的转换由 lib/match-detail-adapter.ts 完成。
 * 零值语义：seasonGoals / standingsRank 全零 → adapter 转为 null → UI 显示 '—'。
 *
 * 复用 types/moneyline.ts 中已有的子类型，不重定义：
 *   TopScorer / PeriodGoals / WinProbability / H2HSummary /
 *   H2HAverageGoals / H2HForm / StandingsTrend / SportmonksLineupEntry /
 *   LineupFormation / StandingsScope
 */

import type {
  TopScorer,
  WinProbability,
  H2HSummary,
  H2HAverageGoals,
  H2HForm,
  StandingsTrend,
  SportmonksLineupEntry,
  LineupFormation,
} from "@/types/moneyline";

// ─── Shared sub-types ─────────────────────────────────────────────────────

/** 主队 / 客队语义标记，对应 SportMonks participant.meta.location */
export type TeamSide = "home" | "away";

export interface MatchTeam {
  participantId: number;
  name: string;
  shortCode: string;
  imagePath: string;
  /**
   * 球衣 URL（team_kits[type=home/away]）。加载失败时 Jersey 组件会自动切到本地灰度占位。
   * SportMonks 国家队的 _home.png/_away.png 在 CDN 上多为 404，由 onError 兜底处理。
   */
  jerseyPath?: string;
}

export interface MatchVenue {
  name: string;
  city: string;
  capacity: number;
  imagePath: string;
  distanceKm: number | null;
}

export type MatchOutcomeDomain = "W" | "D" | "L";

export interface PeriodGoalDomain {
  period: number;
  homeAvg: number;
  awayAvg: number;
}

// ─── Overview domain ──────────────────────────────────────────────────────

export interface MatchOverviewDomain {
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  kickoff: { iso: string; timestamp: number };
  venue: MatchVenue;
  /**
   * 本赛季进球数。
   * adapter 将后端零值按 home/away 独立归 null → UI 逐字段显示 '—'。
   * home=0 → home:null；away=0 → away:null；互不影响。
   */
  seasonGoals: { home: number | null; away: number | null };
  topScorers: { home: TopScorer | null; away: TopScorer | null };
  /**
   * 联赛排名。
   * adapter 将后端零值按 home/away 独立归 null → UI 逐字段显示 '—'。
   * home=0 → home:null；away=0 → away:null；互不影响。
   */
  standingsRank: { home: number | null; away: number | null };
  formPercentage: { home: number; away: number };
  recentResults: { home: MatchOutcomeDomain[]; away: MatchOutcomeDomain[] };
  periodGoals: PeriodGoalDomain[];
  winProbability: WinProbability | null;
  h2hSummary: H2HSummary;
  referee: { name: string };
  managers: { home: { name: string }; away: { name: string } };
}

// ─── H2H domain ───────────────────────────────────────────────────────────

export interface MatchH2HDomain {
  h2hSampleSize: number;
  /**
   * 历史 H2H 进球均值（来自 H2H 接口 h2hAverageGoals 字段）。
   * h2hSummary（主客胜负统计）由 overview 接口提供，透传至 HeadToHeadTab.winProbability 旁。
   */
  h2hAverageGoals: H2HAverageGoals;
  topScorers: { home: TopScorer | null; away: TopScorer | null };
  /** 近期表现（来自 H2H 接口 h2hForm 字段） */
  h2hForm: H2HForm;
}

// ─── Standings domain ─────────────────────────────────────────────────────

export interface MatchStandingsRowDomain {
  participantId: number;
  position: number;
  result: StandingsTrend | null;
  points: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalDifference: number;
  teamName: string;
  teamLogo: string;
  shortCode: string;
}

/**
 * 后端一次返回全部 scope，adapter 按 scope 拆分后存入 byScope。
 * hook 消费时按当前 scope 取对应列表。
 */
export interface MatchStandingsDomain {
  leagueName: string;
  seasonName: string;
  byScope: {
    overall: MatchStandingsRowDomain[];
    home: MatchStandingsRowDomain[];
    away: MatchStandingsRowDomain[];
  };
}

// ─── Lineups domain ───────────────────────────────────────────────────────

export interface MatchLineupsDomain {
  /** null 表示赛前 ≥ 1h，阵容尚未公布 */
  lineups: { home: LineupFormation; away: LineupFormation } | null;
  /** 阵容预计公布时间（已解析为 JS Date） */
  availableAt: Date;
}

// Re-export sub-types that consumers may need
export type {
  TopScorer,
  WinProbability,
  H2HSummary,
  H2HAverageGoals,
  H2HForm,
  SportmonksLineupEntry,
  LineupFormation,
};
