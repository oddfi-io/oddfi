/**
 * DD-102 Moneyline 详情列数据类型定义。
 *
 * 字段命名严格遵循 SportMonks entity / 后端 oddfi-web-api response 契约。
 * 历史快照类型（MoneylineHistory*）对齐 GET /api/v1/moneyline/history/{fixtureId}。
 */

import { LIVE_STATE_IDS } from "@/lib/fixture-state";

// ─── Moneyline 趋势图（前端 UI 内部表示） ─────────────────────────────────

export interface MoneylineTrendPoint {
  time: string; // ISO 8601 timestamp
  value: number; // 百分比 0-100（由后端 normalized_pct 适配而来）
}

export interface MoneylineTrend {
  home: MoneylineTrendPoint[];
  draw: MoneylineTrendPoint[];
  away: MoneylineTrendPoint[];
}

// ─── Moneyline History API 响应（oddfi-web-api commit 0ffc071） ────────────

/** GET /api/v1/moneyline/history/{fixtureId} 单点 */
export interface MoneylineHistoryPoint {
  /** RFC3339Nano 采集时刻 */
  captured_at: string;
  /** decimal odds 字符串（"2.150"），与赔率展示直接绑定 */
  value: string;
  /** SportMonks 原始隐含概率 % */
  probability: number;
  /** 三方 over-round 消除后的归一化概率 %（折线 y 值） */
  normalized_pct: number;
  /** 采集瞬间的 fixture state_id */
  state_id: number;
}

export interface MoneylineHistoryFixture {
  id: number;
  state_id: number;
  /** 后端格式："YYYY-MM-DD HH:mm:ss" (time.DateTime) */
  starting_at: string;
}

export interface MoneylineHistoryResponse {
  home: MoneylineHistoryPoint[];
  draw: MoneylineHistoryPoint[];
  away: MoneylineHistoryPoint[];
  fixture: MoneylineHistoryFixture | null;
}

/**
 * 赛中 state_id 集合（命中即触发更高频轮询：30s vs 赛前 60s）。
 *
 * 单一权威源收敛（BUG-029）：直接 re-export `lib/fixture-state.ts` 的 `LIVE_STATE_IDS`，
 * 杜绝两张 LIVE 表各自维护再次漂移。二者集合本就相同（后端 moneylineLiveStates）。
 */
export const MONEYLINE_LIVE_STATES: ReadonlySet<number> = LIVE_STATE_IDS;

// ─── Overview 顶部 ────────────────────────────────────────────────────────

export interface OverviewTeam {
  participant_id: number;
  name: string;
  short_code: string;
  /** 队徽 URL（SportMonks team.image_path） */
  image_path: string;
  /**
   * 球衣 URL（可选）。
   * SportMonks 仅在 `league.has_jerseys` 为 true 时由 fixture team kit 接口提供；
   * 未提供时 OverviewHeader 回退到 /images/jerseys/{home,away}-default.svg 模板。
   */
  jersey_path?: string;
}

export interface OverviewVenue {
  name: string;
  city: string;
  capacity: number;
  image_path?: string;
}

// ─── Venue Slide 1 · Goals Scored + Top Scorers ──────────────────────────

export interface SeasonGoalsStats {
  home: number;
  away: number;
}

export interface TopScorer {
  participant_id: number;
  player_id: number;
  player_name: string; // "Haaland, Erling"
  jersey_number: number;
  position: string; // "Forward"
  goals: number;
}

// ─── Venue Slide 2 · League Position + Form ───────────────────────────────

export interface StandingsRank {
  home: number;
  away: number;
}

export interface FormPercentage {
  home: number; // 0-100
  away: number;
}

export type MatchOutcome = "W" | "D" | "L";

export interface RecentResults {
  home: MatchOutcome[]; // 长度 5
  away: MatchOutcome[];
}

// ─── Venue Slide 3 · Average Goals Per Period ─────────────────────────────

export interface PeriodGoals {
  period: 15 | 30 | 45 | 60 | 75 | 90;
  home_avg: number;
  away_avg: number;
}

// ─── Venue Slide 4 · Win Probability + H2H ────────────────────────────────

export interface WinProbability {
  home: number;
  draw: number;
  away: number;
}

export interface H2HSummary {
  home_wins: number;
  draws: number;
  away_wins: number;
}

// ─── Venue Slide 5 · Kickoff + Referee + Managers ─────────────────────────

export interface Referee {
  name: string;
}

export interface Manager {
  name: string;
}

export interface ManagersPair {
  home: Manager;
  away: Manager;
}

// ─── H2H Tab Card 2/3 · Average Goals + Top Scorers ──────────────────────

export interface AverageGoalsRow {
  home: number; // 小数
  away: number;
}

export interface H2HAverageGoals {
  scored: AverageGoalsRow;
  conceded: AverageGoalsRow;
}

// ─── H2H Tab Card 3/3 · Form ──────────────────────────────────────────────

export interface FormMatchRow {
  outcome: MatchOutcome;
  opponent_short: string; // "BRE"
  is_home: boolean; // vs / @
  score_home: number;
  score_away: number;
}

export interface H2HForm {
  home_percentage: number;
  away_percentage: number;
  home_matches: FormMatchRow[]; // 5 场
  away_matches: FormMatchRow[];
}

// ─── Standings ────────────────────────────────────────────────────────────

export type StandingsScope = "overall" | "home" | "away";
export type StandingsTrend = "up" | "down" | "equal";

export interface SportmonksStandingRow {
  participant_id: number;
  position: number;
  result: StandingsTrend | null;
  points: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goal_difference: number;
  team_name: string;
}

export type StandingsByScope = Record<StandingsScope, SportmonksStandingRow[]>;

// ─── Lineups ──────────────────────────────────────────────────────────────

export interface SportmonksLineupEntry {
  player_id: number;
  team_id: number;
  position_id: number;
  formation_field: string; // "1:1" 行:列
  type_id: 11 | 12; // 11=starter, 12=substitute
  formation_position: number;
  player_name: string;
  jersey_number: number;
}

export interface LineupFormation {
  team_id: number;
  team_name: string;
  formation: string; // "4-2-3-1"
  players: SportmonksLineupEntry[];
}

// ─── Teaser（AI 提示文案统计数值） ────────────────────────────────────────

export interface TeaserStats {
  /** 偏向哪一方（show team's short code） */
  teamCode: string;
  /** 平台用户下注百分比，0-100 整数 */
  userBetPct: number;
  /** 该方赔率推导的隐含百分比 */
  impliedPct: number;
  /** 当前赔率字符串，如 "2.25" */
  odds: string;
}
