import type { PortfolioHistoryParams } from "@/types/auth";

/**
 * 将 PortfolioHistoryParams 转换为 ky searchParams。
 * 过滤掉 undefined / null / 空串，保留 0（合法数值）。
 */
export function toSearchParams(
  params?: PortfolioHistoryParams
): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v as string | number;
  }
  return Object.keys(out).length ? out : undefined;
}
