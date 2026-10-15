/**
 * Calendar 页（FIFA World Cup 26™ Match Schedule）类型契约。
 * 比赛对象本身复用 SportmonksFixture（types/api.ts），本文件只定义页面级元数据。
 */

export type CalendarStageId = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";

export type CalendarMarketStatus = "open" | "pre_open";

export interface CalendarStage {
  stage_id: CalendarStageId;
  /** 用于 i18n key 的内部 label，如 "Group Stage"；展示走 t(`calendarPage.stages.${stage_id}`) */
  label: string;
  /** ISO date "yyyy-mm-dd"（UTC 视图基准） */
  date_start: string;
  date_end: string;
  /** 涵盖天数 */
  days: number;
  /** 该阶段的比赛总数（数据派生） */
  match_count: number;
}

export interface CalendarDate {
  /** ISO date "yyyy-mm-dd" */
  date_iso: string;
  /** 该 match day 所属阶段；用于 SectionBanner 列对齐 */
  stage_id: CalendarStageId;
}

export interface CalendarTournament {
  tournament_id: string;
  name: string;
  tournament_window: { start: string; end: string };
  /** 12 个组名（淘汰赛阶段为 null group_id 的 fixture 不计入此数组） */
  groups: string[];
  /** 7 段，按时间顺序 */
  stages: CalendarStage[];
  /** 仅 match days，无休赛日 */
  dates: CalendarDate[];
}
