/**
 * SportMonks v3 fixture state_id 分类。
 *
 * 单一权威源：1:1 镜像后端 `oddfi-web-spider/utils/moneyline_lifecycle.go` 的 4 分类
 * （PENDING / LIVE / TERMINAL / ANOMALY）。后端只透传裸 state_id、不下发派生 status，
 * 状态徽章 / 列表归类完全由此表决定，任何偏差都会让赛事在列表中错位或消失（BUG-029）。
 *
 * 前端只有 3 个展示桶（live / upcoming / finished），映射规则：
 *   LIVE     → live      （进行中，含阶段间 break）
 *   PENDING  → upcoming  （未开赛）
 *   TERMINAL → finished  （已终结）
 *   ANOMALY  → finished  （异常态，全部丢弃 · 用户决策）
 *
 * state 名核验自 SportMonks v3 官方 fixtureStates（非训练数据推断）：
 *   2=1st Half, 22=2nd Half（坐实旧表 4=2nd Half 系 v2 残留错位）。
 */

/** LIVE（进行中）state_id — 后端 moneylineLiveStates */
export const LIVE_STATE_IDS = new Set([
  2, // 1st Half
  3, // Half-Time
  4, // Break（regular time finished，阶段间休息）
  6, // Extra Time
  9, // Penalty Shootout
  21, // Extra Time Break
  22, // 2nd Half
  23, // （官方文档未列；后端归 LIVE）
  25, // Penalties Break
]);

/** PENDING（未开赛）state_id — 后端 moneylinePendingStates */
export const UPCOMING_STATE_IDS = new Set([
  1, // Not Started
  13, // To Be Announced
  26, // Pending
]);

/** TERMINAL（已终结）state_id — 后端 moneylineTerminalStates */
export const TERMINAL_STATE_IDS = new Set([
  5, // Full-Time
  7, // After Extra Time
  8, // FT After Penalties
  12, // Cancelled
  14, // Walk Over
  15, // Abandoned
  17, // Awarded
  20, // Deleted
]);

/** ANOMALY（异常态）state_id — 后端 moneylineAnomalyStates；前端归 finished 丢弃 */
export const ANOMALY_STATE_IDS = new Set([
  10, // Postponed
  11, // Suspended
  16, // Delayed
  18, // Interrupted
  19, // Awaiting Updates
]);

/**
 * Finished（已结束）state_id = TERMINAL ∪ ANOMALY。
 * 显式合并供 disjoint 单测与文档锚定；`getFixtureStatus` 实际走 else 分支兜底。
 */
export const FINISHED_STATE_IDS = new Set([...TERMINAL_STATE_IDS, ...ANOMALY_STATE_IDS]);

export type FixtureStatus = "live" | "upcoming" | "finished";

export function getFixtureStatus(stateId: number): FixtureStatus {
  if (LIVE_STATE_IDS.has(stateId)) return "live";
  if (UPCOMING_STATE_IDS.has(stateId)) return "upcoming";
  return "finished"; // TERMINAL ∪ ANOMALY ∪ unknown id 全部归 finished
}

/**
 * 仅 LIVE 态映射到 markets i18n key 用于周期标签展示。
 * 4 / 21 / 25 三个阶段间 break 复用 `periodBRK`，不新增 i18n key；
 * 23（未知 live 态）不给 label。
 */
const STATE_PERIOD_KEYS: Record<number, string> = {
  2: "period1H",
  3: "periodHT",
  4: "periodBRK",
  6: "periodET",
  9: "periodPEN",
  21: "periodBRK",
  22: "period2H",
  25: "periodBRK",
};

/** Returns the i18n message key for the current period, or null if not a labelled live state. */
export function getStatePeriodKey(stateId: number): string | null {
  return STATE_PERIOD_KEYS[stateId] ?? null;
}
