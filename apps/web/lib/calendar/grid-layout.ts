/**
 * Calendar 网格派位工具：把 SportmonksFixture 映射到 (gridRow, gridCol)。
 *
 * 网格规格（PC）：
 *   - 总尺寸：72px (Y 轴) + 35×192px (date columns) × 48px (X 轴) + 14×56px (hour rows)
 *   - gridRow=1 → DateAxis；gridRow=2..15 → 14 hour rows
 *   - gridCol=1 → TimeAxis；gridCol=2..36 → 35 date columns
 */
import type { SportmonksFixture } from "@/types/api";
import { Y_TIMES_UTC } from "./constants";
import type { TimezoneMode } from "./timezone";
import { formatKickoffInTz } from "./timezone";

export interface CellPosition {
  /** CSS Grid 1-based row index（已含 +2 偏移：跳过 axis） */
  gridRow: number;
  /** CSS Grid 1-based col index（已含 +2 偏移：跳过 axis） */
  gridCol: number;
}

/**
 * 把 fixture 派位到网格 cell。
 *
 * @param dates ISO date 数组（match days，按时区视图派出，**不含**休赛日）
 * @returns null 表示该 fixture 在当前时区下落到非 match day 或非 Y_TIMES_UTC 时段（应不渲染）
 */
export function getCellPosition(
  fixture: SportmonksFixture,
  tz: TimezoneMode,
  dates: string[]
): CellPosition | null {
  const { date, hour } = formatKickoffInTz(fixture.starting_at_timestamp, tz);
  const colIndex = dates.indexOf(date);
  if (colIndex < 0) return null;

  const rowIndex = Y_TIMES_UTC.indexOf(hour as (typeof Y_TIMES_UTC)[number]);
  if (rowIndex < 0) return null;

  return { gridRow: rowIndex + 2, gridCol: colIndex + 2 };
}

/**
 * 同时段叠卡聚合：按 (date, hour) 分组 fixtures。
 * 返回 Map<key="row-col", SportmonksFixture[]>，组件按 list.length 选 Card / Pair 渲染。
 */
export function groupFixturesByCell(
  fixtures: SportmonksFixture[],
  tz: TimezoneMode,
  dates: string[]
): Map<string, SportmonksFixture[]> {
  const map = new Map<string, SportmonksFixture[]>();
  for (const f of fixtures) {
    const pos = getCellPosition(f, tz, dates);
    if (!pos) continue;
    const key = `${pos.gridRow}-${pos.gridCol}`;
    const list = map.get(key);
    if (list) list.push(f);
    else map.set(key, [f]);
  }
  return map;
}

/**
 * 取目标 stage 在 dates 数组中的起始列 index（用于 scrollTo 滚动定位）。
 * 返回 -1 表示该 stage 没有对应的 match days（不应发生）。
 */
export function getStageStartCol(
  stageId: string,
  dates: { date_iso: string; stage_id: string }[]
): number {
  return dates.findIndex((d) => d.stage_id === stageId);
}
