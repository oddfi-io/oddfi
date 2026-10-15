// 相对时间派生核心（被 ISO 版 `relative-time.ts` 与 unix-ms 版 `news/relative-time-ms.ts` 共用）
// 阈值在此单点维护，避免两份分支文案漂移。

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatLocalDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * 时间戳 → 相对当前时间的本地化文案。
 * - < 1m  → "Less than 1m"
 * - < 1h  → "Xm ago"
 * - < 24h → "Xh ago"
 * - < 30d → "Xd ago"
 * - ≥ 30d → "yyyy-MM-dd HH:mm"（本地时区 24h）
 */
export function relativeFromTs(ts: number, now: number): string {
  const diffMs = now - ts;
  if (diffMs < 60_000) return "Less than 1m";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;

  return formatLocalDateTime(ts);
}
