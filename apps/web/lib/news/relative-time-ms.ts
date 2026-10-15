// unix-ms 版「N 分钟前」，delegate 到 `lib/format/relative-time-core.ts::relativeFromTs`。
// 阈值文案与 ISO 版完全对齐（< 1m / Xm / Xh / Xd / ≥ 30d yyyy-MM-dd HH:mm）。

import { relativeFromTs } from "@/lib/format/relative-time-core";

export function formatRelativeTimeMs(tsMs: number, now: number = Date.now()): string {
  if (!Number.isFinite(tsMs)) return "";
  return relativeFromTs(tsMs, now);
}
