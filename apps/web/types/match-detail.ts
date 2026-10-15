/**
 * DD-104: Match Detail 详情列 wire 类型（snake_case，与后端 1:1 镜像）。
 *
 * 后端 commit: 873beed (origin/dev · oddfi-backend)
 *
 * 注意零值陷阱（后端 assemble.go extractStandingsRank / extractSeasonGoals）：
 *   standingsRank / seasonGoals 找不到时返回 {home:0, away:0} 而非 null。
 *   前端 adapter 层必须将全零值转为 null（见 lib/match-detail-adapter.ts）。
 *
 * 复用 types/moneyline.ts 中已有的子类型，不重定义：
 *   TopScorer / FormPercentage / MatchOutcome / PeriodGoals / WinProbability /
 *   H2HSummary / SportmonksStandingRow / StandingsScope / StandingsTrend /
 *   SportmonksLineupEntry / LineupFormation / H2HAverageGoals / H2HForm
 */

import type {
  TopScorer,
  WinProbability,
  H2HSummary,
  H2HAverageGoals,
  H2HForm,
  SportmonksStandingRow,
  StandingsTrend,
  LineupFormation,
} from "@/types/moneyline";

// ─── Team（wire） ──────────────────────────────────────────────────────────

export interface MatchDetailTeamWire {
  participant_id: number;
  name: string;
  short_code: string;
  /** 队徽 URL（SportMonks team.image_path） */
  image_path: string;
  /** 球衣 URL（可选，仅 league.has_jerseys=true 时由后端提供） */
  jersey_path?: string;
}

// ─── Overview（wire） ──────────────────────────────────────────────────────

export interface MatchDetailOverviewWire {
  homeTeam: MatchDetailTeamWire;
  awayTeam: MatchDetailTeamWire;
  /** ISO8601 字符串 */
  startingAt: string;
  starting_at_timestamp: number;
  venue: {
    name: string;
    city: string;
    capacity: number;
    image_path: string;
    /** null 表示无法计算距离 */
    distance_km: number | null;
  };
  /**
   * 本赛季进球数。
   * ⚠️ 零值陷阱：{home:0, away:0} 表示后端未找到数据（非真实 0 球），
   * adapter 层将全零值转为 null。
   */
  seasonGoals: { home: number; away: number };
  /** Go 指针字段 → JSON 可 null */
  topScorers: { home: TopScorer | null; away: TopScorer | null };
  /**
   * 联赛排名。
   * ⚠️ 零值陷阱：{home:0, away:0} 表示后端未找到数据，
   * adapter 层将全零值转为 null。
   */
  standingsRank: { home: number; away: number };
  formPercentage: { home: number; away: number };
  recentResults: { home: string[]; away: string[] };
  periodGoals: Array<{ period: number; home_avg: number; away_avg: number }>;
  /** Go 指针字段 → JSON 可 null */
  winProbability: WinProbability | null;
  h2hSummary: H2HSummary;
  referee: { name: string };
  managers: { home: { name: string }; away: { name: string } };
}

// ─── H2H（wire） ───────────────────────────────────────────────────────────

export interface MatchDetailH2HWire {
  /** H2H 数据样本场次数量 */
  h2h_sample_size: number;
  /**
   * 历史 H2H 进球均值。
   * 字段名与后端 873beed 对齐（非 averageGoals）。
   * h2hSummary（主客胜负统计）来自 overview 接口，H2H 接口不返回该字段。
   */
  h2hAverageGoals: H2HAverageGoals;
  /** Go 指针字段 → JSON 可 null */
  topScorers: { home: TopScorer | null; away: TopScorer | null };
  /**
   * 近期表现（胜率 + 比赛列表）。
   * 字段名与后端 873beed 对齐（非 form）。
   */
  h2hForm: H2HForm;
}

// ─── Standings（wire） ─────────────────────────────────────────────────────

export interface MatchDetailStandingsRowWire extends Omit<SportmonksStandingRow, "result"> {
  /** 队徽 URL */
  team_logo: string;
  /** 球队缩写 */
  short_code: string;
  /**
   * 排名趋势。后端有时返回空串 ""（无变化），adapter 将其归一为 null。
   * Omit + 重定义以覆盖 SportmonksStandingRow 中的 StandingsTrend | null。
   */
  result: StandingsTrend | null | "";
}

/**
 * 后端一次返回所有 scope，scope query 参数被后端忽略。
 * hook 内部按 scope 从 byScope 字典中 pick 当前列表。
 */
export interface MatchDetailStandingsWire {
  league_name: string;
  season_name: string;
  standings: {
    overall: MatchDetailStandingsRowWire[];
    home: MatchDetailStandingsRowWire[];
    away: MatchDetailStandingsRowWire[];
  };
}

// ─── Lineups（wire） ───────────────────────────────────────────────────────

export interface MatchDetailLineupsWire {
  /**
   * 阵容数据。
   * 赛前 ≥ 1h 时为 null（前端需空态处理）。
   */
  lineups: { home: LineupFormation; away: LineupFormation } | null;
  /**
   * 阵容预计公布时间，格式 "YYYY-MM-DD HH:mm:ss"（后端无时区，视作 UTC）。
   * lineups 为 null 时使用此字段展示空态文案。
   */
  available_at: string;
}
