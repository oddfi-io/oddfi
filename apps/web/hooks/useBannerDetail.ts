"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { getMarketBannerDetail } from "@/lib/api";
import type { BannerItemDetail, TemplateId } from "@/types/home-banner";

/**
 * Banner 详情 hook（DD-085）
 *
 * 后端契约：GET /api/v1/market/banners/{B1-B5}?lang=xx → 扁平 BannerItemDetail[]
 * 元数据（title/tag_text/decoration_key/subtitle）从 useMarketBanners list 接口取；
 * 本 hook 仅拉完整 items（list 接口被前端截到 4 行展示，detail 是全量）
 *
 * 模式与 useMarketBanners 一致（30s staleTime + 30s 轮询 + locale 透传后端 lang）
 */
export function useBannerDetail(code: TemplateId) {
  const locale = useLocale();
  return useQuery<BannerItemDetail[]>({
    queryKey: ["banner-detail", code, locale] as const,
    queryFn: () => getMarketBannerDetail(code, locale),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
