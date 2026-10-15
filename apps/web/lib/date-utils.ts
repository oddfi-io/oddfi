/**
 * UTC date utilities for SportMonks API queries.
 */

/** Get today's date in UTC as YYYY-MM-DD */
export function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get a date N days from today in UTC as YYYY-MM-DD */
export function getDateOffsetUTC(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Get a date N days from a base date string (YYYY-MM-DD) in UTC */
export function getDateFromBaseUTC(base: string, offsetDays: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Compute how many days `date` is from `today` (both YYYY-MM-DD UTC) */
export function dateDiffDays(date: string, today: string): number {
  const d = new Date(date + "T00:00:00Z");
  const t = new Date(today + "T00:00:00Z");
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

/**
 * Format a date string relative to today.
 * `todayLabel` / `tomorrowLabel` are i18n-translated strings passed from the component layer.
 * `locale` is used for toLocaleDateString formatting of weekday/month.
 *
 * BUG-071（REV 采纳 #B2）：`date` / `today` 入参语义是**目标时区的本地运营日**
 * `YYYY-MM-DD`（由 timezone.ts 的 dayKey/todayKey 产出），不是 UTC 日历日。
 * 函数内 `T00:00:00Z` + `timeZone:"UTC"` + getUTC* 仅用于**从这串本地日历日里稳定取
 * 星期/月份/日**——对一个无时区的 `YYYY-MM-DD`，固定锚到 UTC 午夜取字段不会引入任何
 * 偏移漂移（不是把它当成 UTC 时刻再转换）。分桶 key 改本地后，diff 两端同口径，
 * 标签与卡片显示时区一致。⛔ 勿把入参重新理解为 UTC 时刻去做 tz 转换。
 */
export function formatDateLabel(
  date: string,
  today: string,
  todayLabel: string,
  tomorrowLabel: string,
  locale: string
): string {
  const diffDays = dateDiffDays(date, today);
  const d = new Date(date + "T00:00:00Z");

  if (diffDays === 0) return todayLabel;
  if (diffDays === 1) return tomorrowLabel;
  if (diffDays > 0 && diffDays < 7) {
    const weekday = d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
    const month = d.toLocaleDateString(locale, { month: "short", timeZone: "UTC" });
    const day = d.getUTCDate();
    return `${weekday}, ${month} ${day}`;
  }
  // Beyond 7 days
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}
