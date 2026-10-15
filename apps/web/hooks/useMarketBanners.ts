"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { getMarketBanners } from "@/lib/api";
import type { HomeBannerData } from "@/types/home-banner";

// 单 banner 展示行数上限
// B1/B3/B4/B5 = 4 行赔率行；B2 = 2×2 stats grid（4 张卡）
// 后端可能返回完整列表（夺冠盘 11 国、C 罗进球 0~8 共 9 档），前端统一截 top-N
export const MAX_ITEMS_PER_BANNER = 4;

/**
 * 纯函数：过滤 is_active + 按 sort_order 升序 + 每个 banner 的 items 截到展示上限
 * 抽出便于单测，避免依赖 TanStack Query 测试基建
 */
export function normalizeBanners(data: HomeBannerData[]): HomeBannerData[] {
  return data
    .filter((b) => b.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((b) => ({ ...b, items: b.items.slice(0, MAX_ITEMS_PER_BANNER) }));
}

/**
 * 首页 Banner 数据 hook
 *
 * 返回排序后的活跃 banner 列表，且每个 banner 的 items 截到展示上限
 * 后端契约：GET /api/v1/market/banners?lang=xx → market-api.oddfi.io
 *
 * locale 透传后端 lang：项目 locale 列表（zh/en/pt/ja/hi/es/tr/de/fr）已是后端短码，
 * 切换语言时 queryKey 变化触发自动重拉（与 useMarketData 同款）
 */
export function useMarketBanners() {
  const locale = useLocale();
  return useQuery<HomeBannerData[]>({
    queryKey: ["home-banner", "list", locale] as const,
    queryFn: async () => normalizeBanners(await getMarketBanners(locale)),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
