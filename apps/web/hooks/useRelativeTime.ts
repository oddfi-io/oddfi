import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/format/relative-time";

/**
 * 订阅 60s tick 将 UTC ISO 时间戳渲染成用户本地时区的相对文案。
 * 展示规则见 formatRelativeTime。
 */
export function useRelativeTime(isoUtc: string | null | undefined): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!isoUtc) return "";
  return formatRelativeTime(isoUtc);
}
