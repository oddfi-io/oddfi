/**
 * Tournament 元数据派生：从 SportmonksFixture[] 计算 7 段 stages + 35 个 match dates。
 *
 * 设计：
 *   - 数据驱动（不写死 stages 的 date_start / date_end）— 一旦后端 schedule 调整，重跑
 *     `scripts/fetch-wc-fixtures.ts` 即同步元数据
 *   - 12 个组名固定 ['Group A'..'Group L']（接口不返回组归属，PRD 静态约束）
 */
import type { SportmonksFixture } from "@/types/api";
import type {
  CalendarDate,
  CalendarStage,
  CalendarStageId,
  CalendarTournament,
} from "@/types/calendar";
import { STAGE_LABEL, STAGE_ORDER, TOURNAMENT_ID } from "./constants";
import { getStageId } from "./derivers";

const TOURNAMENT_NAME = "FIFA World Cup 26™ Match Schedule";
const FIXED_GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

/**
 * 取 ISO date 部分 "yyyy-mm-dd"。fixture.starting_at 形如 "2026-06-11 19:00:00"。
 * 注意：此处按 UTC 视图取日期；切到 IANA 时区时由 `lib/calendar/timezone.ts`
 * 重派列（不是改 tournament-meta）。
 */
function getDateIsoUtc(fixture: SportmonksFixture): string {
  // starting_at 格式 "2026-06-11 19:00:00"（UTC，无时区标记），取前 10 字符即可
  return fixture.starting_at.slice(0, 10);
}

/**
 * 从 fixtures 派生整届赛事元数据。
 */
export function deriveTournamentMeta(fixtures: SportmonksFixture[]): CalendarTournament {
  if (fixtures.length === 0) {
    throw new Error("[deriveTournamentMeta] fixtures empty");
  }

  // 按 stage_id 分组
  const byStage = new Map<CalendarStageId, SportmonksFixture[]>();
  for (const f of fixtures) {
    const sid = getStageId(f);
    const list = byStage.get(sid);
    if (list) list.push(f);
    else byStage.set(sid, [f]);
  }

  // 7 段 — 按固定顺序生成，缺失阶段跳过（防御）
  const stages: CalendarStage[] = [];
  for (const stageId of STAGE_ORDER) {
    const list = byStage.get(stageId);
    if (!list || list.length === 0) continue;
    const dates = [...new Set(list.map(getDateIsoUtc))].sort();
    stages.push({
      stage_id: stageId,
      label: STAGE_LABEL[stageId],
      date_start: dates[0],
      date_end: dates[dates.length - 1],
      days: dates.length,
      match_count: list.length,
    });
  }

  // 全部 match days（去重 + 排序）
  const dateSet = new Set(fixtures.map(getDateIsoUtc));
  const sortedDates = [...dateSet].sort();
  const dates: CalendarDate[] = sortedDates.map((iso) => ({
    date_iso: iso,
    stage_id: getStageIdForDate(iso, stages),
  }));

  const allDates = sortedDates;
  return {
    tournament_id: TOURNAMENT_ID,
    name: TOURNAMENT_NAME,
    tournament_window: {
      start: allDates[0],
      end: allDates[allDates.length - 1],
    },
    groups: FIXED_GROUPS,
    stages,
    dates,
  };
}

/** 给定日期 ISO，找其所属 stage（用日期范围判定） */
function getStageIdForDate(iso: string, stages: CalendarStage[]): CalendarStageId {
  for (const s of stages) {
    if (iso >= s.date_start && iso <= s.date_end) return s.stage_id;
  }
  // 兜底：早于首段 → group；晚于尾段 → final
  return stages[0].stage_id;
}
