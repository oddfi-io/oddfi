/**
 * Match time formatting utilities.
 *
 * 输入支持 ISO 字符串（无时区后缀时按 UTC 补齐）或 unix 时间戳（秒 / 毫秒自动判断）。
 * 输出统一按用户当前时区，函数内部不指定 timeZone。
 */

type DateInput = string | number;

// SportMonks v3 偶发返回 "2026-04-28 20:00:00"（空格分隔、无 Z）这类字符串，
// JS 引擎会按本地时间解析；后端给的是 UTC 值，需补齐 Z 强制按 UTC 解析。
function normalizeUtc(iso: string): string {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) return iso;
  const t = iso.includes("T") ? iso : iso.replace(" ", "T");
  return `${t}Z`;
}

/** 把 ISO 字符串或 unix 时间戳（秒/毫秒）解析为 Date。秒级用 1e12 阈值判断。 */
export function parseMatchTime(input: DateInput): Date {
  if (typeof input === "number") {
    return new Date(input < 1e12 ? input * 1000 : input);
  }
  return new Date(normalizeUtc(input));
}

/**
 * 解析赛事开赛**绝对时刻**为 unix 秒（BUG-071 唯一权威时刻源）。
 *
 * 优先用 `starting_at_timestamp`（已验证 = UTC）；缺失时 fallback 到 `starting_at`
 * 字符串（normalizeUtc 补 Z）。分桶（`dayKey`）与卡片显示（`formatKickoffDisplay`）
 * 必须共用本函数取时刻，保证「分桶口径 === 显示口径」，不再裸切 `starting_at.slice(0,10)`。
 *
 * @returns unix 秒；两路都失败（字符串不可解析）时返回 NaN，调用方负责兜底。
 */
export function resolveKickoffSeconds(input: {
  starting_at: string;
  starting_at_timestamp?: number | null;
}): number {
  const ts = input.starting_at_timestamp;
  if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) return ts;
  return parseMatchTime(input.starting_at).getTime() / 1000;
}

/** "Thu, Mar 26" — weekday short + month short + day */
export function formatMatchDate(input: DateInput, locale: string): string {
  try {
    return parseMatchTime(input).toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return typeof input === "string" ? input : "";
  }
}

/** "3:00 PM" — hour + minute + hour12 */
export function formatMatchTime(input: DateInput, locale: string): string {
  try {
    return parseMatchTime(input).toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/** "Mar 26, 3:00 PM" — month + day + hour + minute (compact, for carousel) */
export function formatMatchDateTime(input: DateInput, locale: string): string {
  try {
    return parseMatchTime(input).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return typeof input === "string" ? input : "";
  }
}
