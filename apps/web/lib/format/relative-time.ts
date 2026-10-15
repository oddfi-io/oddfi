import { formatLocalDateTime, relativeFromTs } from "./relative-time-core";

// 后端 created_at 统一为 ISO 8601 UTC（例 "2026-04-18T09:15:22Z"）。
// 若后端偶发漏掉 Z 后缀，按 UTC 补齐，避免被解析为本地时间。
function normalizeUtc(iso: string): string {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) return iso;
  return `${iso}Z`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** UTC ISO → 本地时区 `yyyy-MM-dd HH:mm`（24h）。空串/非法返回空串。 */
export function formatAbsoluteDateTime(isoUtc: string | null | undefined): string {
  if (!isoUtc) return "";
  const ts = Date.parse(normalizeUtc(isoUtc));
  if (Number.isNaN(ts)) return "";
  return formatLocalDateTime(ts);
}

/** UTC ISO → 本地时区 `yyyy-MM-dd`。空串/非法返回空串。 */
export function formatDateLineLocal(isoUtc: string | null | undefined): string {
  if (!isoUtc) return "";
  const ts = Date.parse(normalizeUtc(isoUtc));
  if (Number.isNaN(ts)) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** UTC ISO → 本地时区 `HH:mm:ss`（24h）。空串/非法返回空串。 */
export function formatTimeLineLocal(isoUtc: string | null | undefined): string {
  if (!isoUtc) return "";
  const ts = Date.parse(normalizeUtc(isoUtc));
  if (Number.isNaN(ts)) return "";
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** UTC ISO → 本地时区 `yyyy-MM-dd HH:mm:ss`（24h，带秒）。空串/非法返回空串。 */
export function formatMatchTimeLocal(isoUtc: string | null | undefined): string {
  const date = formatDateLineLocal(isoUtc);
  if (!date) return "";
  return `${date} ${formatTimeLineLocal(isoUtc)}`;
}

/** UTC ISO → 相对时间文案。阈值见 `relative-time-core.ts::relativeFromTs`。 */
export function formatRelativeTime(isoUtc: string, now: number = Date.now()): string {
  if (!isoUtc) return "";
  const ts = Date.parse(normalizeUtc(isoUtc));
  if (Number.isNaN(ts)) return "";
  return relativeFromTs(ts, now);
}
