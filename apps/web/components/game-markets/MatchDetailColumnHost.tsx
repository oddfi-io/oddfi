"use client";

/**
 * DD-102 · 市场页详情列宿主（替代旧 MatchDetailPanel）。
 *
 * 与 MatchDetailPanel 的关系：
 *   - 数据获取 (useQuery + refetchInterval=15s) 完全一致，保持 fixture 数据契约
 *   - 渲染层切换为 `MatchDetailColumn`（Moneyline + Overview + Betting 三段堆叠）
 *
 * 旧 `MatchDetailPanel` 保留不删（其他页面/快速回滚兼容）。
 */
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getMarketFixtureDetail } from "@/lib/api";
import { useMarketsLayoutStore } from "@/stores/marketsLayoutStore";
import MatchDetailColumn from "@/components/match-detail/MatchDetailColumn";

function ColumnSkeleton() {
  return (
    <div className="flex flex-col gap-[16px]">
      <div className="bg-primary border border-secondary rounded-16 h-[280px] animate-pulse" />
      <div className="bg-primary border border-secondary rounded-16 h-[420px] animate-pulse" />
      <div className="bg-primary border border-secondary rounded-16 h-[240px] animate-pulse" />
    </div>
  );
}

interface Props {
  fixtureId: number;
}

export default function MatchDetailColumnHost({ fixtureId }: Props) {
  const locale = useLocale();
  const t = useTranslations("markets");
  const closeDetail = useMarketsLayoutStore((s) => s.closeDetail);

  const {
    data: fixture,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["market-fixture", fixtureId, locale],
    queryFn: () => getMarketFixtureDetail(fixtureId, "statis", { locale }).then((arr) => arr?.[0]),
    enabled: fixtureId > 0,
    staleTime: 15_000,
    refetchInterval: 15_000,
    // ENH-031 B2.1：与 15s poll 叠加会让"切 Tab 回来"瞬间触发 2 次 fetch（focus + interval）
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <ColumnSkeleton />;

  if (isError || !fixture) {
    return (
      <div className="bg-primary border border-secondary rounded-16 px-[16px] py-[24px]">
        <div className="rounded-12 bg-secondary px-6 py-10 text-center text-secondary text-sm">
          {t("loadError")}
        </div>
      </div>
    );
  }

  // 市场页详情列样式（Figma 6123:92531）：
  //   - 整体包卡片（rounded-16 + border-secondary + bg-primary）
  //   - 顶部 fixture title（无 league 副标），右侧 maximize/close
  //   - 隐藏 Part 1 Moneyline 趋势区
  //   - Part 2 紧凑双列排版（左 VenueCard / 右 active tab 内容 / 底部 tabs）
  //   - 保留 Part 3 下注盘
  return (
    <MatchDetailColumn
      fixture={fixture}
      locale={locale}
      onClose={closeDetail}
      wrapInCard
      hidePart1
      compactPart2
      showLiveStreamBelowTimeline
    />
  );
}
