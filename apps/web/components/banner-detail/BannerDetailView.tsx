"use client";

import { useMemo } from "react";
import type { TemplateId, BannerItemDetail } from "@/types/home-banner";
import { useMarketBanners } from "@/hooks/useMarketBanners";
import { useBannerDetail } from "@/hooks/useBannerDetail";
import { useBetSlipPanel } from "@/hooks/useBetSlipPanel";
import { useBetSelectionToggle } from "@/hooks/useBetSelectionToggle";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { BANNER_DETAIL_FIXTURES } from "@/lib/banner-detail-fixtures";
import { bannerItemToBetSelection } from "@/lib/banner-bet-mapper";
import Breadcrumb from "./Breadcrumb";
import BannerTabs from "./BannerTabs";
import FilterBar from "./FilterBar";
import TrendChartSection from "./TrendChartSection";
import OddsCardGrid from "./OddsCardGrid";
import CountryOddsCard from "./cards/CountryOddsCard";
import PlayerOddsCard from "./cards/PlayerOddsCard";
import ScrollSelectorPanel from "./ScrollSelectorPanel";
import BetSlip from "@/components/bet-slip/BetSlip";

interface Props {
  bannerCode: TemplateId;
}

/**
 * Banner 详情主视图（DD-085 §3.4）
 *
 * 数据流：
 *  - 元数据（title/decoration_key/tag_text）从 useMarketBanners list 取（已 cache 30s）
 *  - 完整 items 从 useBannerDetail(bannerCode) 拉真接口
 *  - trend / countdown 从 BANNER_DETAIL_FIXTURES 取（mock，待 Phase 3 后端补 trend）
 *
 * 模式分发：B1/B3/B4/B5 → OddsCardGrid + 卡片；B2 → ScrollerModeView（Batch 7）
 * 激活态：selectionCount > 0 → compact=true 切单列 / 上下结构
 */
export default function BannerDetailView({ bannerCode }: Props) {
  const { data: banners, isLoading: listLoading } = useMarketBanners();
  const { data: items, isLoading: detailLoading } = useBannerDetail(bannerCode);
  // 共用 click handler — 飞行筹码 + 闪屏 + 面板脉冲 + 余额跳动
  // mode "add" 与 markets 的 "toggle" 区别：banner 项重复点击不会被移除（走独立 placeBannerBet）
  const placeBetClick = useBetSelectionToggle("add");
  // BetSlip 面板本地开关（X 关闭 / Bet 重开 / count=0 重置 — 协议见 useBetSlipPanel）
  const { isOpen: showBetSlip, open: openPanel, close: closePanel } = useBetSlipPanel();

  const compact = showBetSlip;
  const mode = useResponsiveMode();
  const isMobile = mode === "h5";
  const fixture = BANNER_DETAIL_FIXTURES[bannerCode];

  const meta = banners?.find((b) => b.template_id === bannerCode);

  // 按 implied_probability 降序排（rank 1 = 最高概率）
  const sortedItems = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) => (b.implied_probability ?? 0) - (a.implied_probability ?? 0));
  }, [items]);

  const handleBet = (item: BannerItemDetail, e: React.MouseEvent) => {
    if (!meta) return;
    const sel = bannerItemToBetSelection(item, bannerCode, meta.banner_id, meta.title);
    placeBetClick(e, sel);
    // 显式重开面板，覆盖"X 关闭后再点 Bet"场景（addSelection 幂等不会触发 count 变化）
    openPanel();
  };

  const isLoading = listLoading || detailLoading;
  if (isLoading) {
    return <div className="p-6 text-secondary">Loading…</div>;
  }
  if (!meta || !items) {
    return <div className="p-6 text-secondary">Banner not found</div>;
  }

  return (
    <div className="flex h-full lg:overflow-hidden">
      <div className="flex flex-1 min-w-0 flex-col gap-6 px-4 py-3 lg:px-6 lg:py-4 lg:overflow-y-auto">
        <Breadcrumb />
        <BannerTabs current={bannerCode} />
        <TrendChartSection
          title={meta.title || fixture.fallbackTitle}
          bannerCode={bannerCode}
          fixture={fixture}
          endTime={meta.end_time}
          compact={compact}
          mobile={isMobile}
        />
        <FilterBar />

        {bannerCode === "total_goals" ? (
          <ScrollSelectorPanel
            items={items}
            onBet={handleBet}
            compact={compact}
            mobile={isMobile}
          />
        ) : (
          <OddsCardGrid columns={compact ? 1 : 2}>
            {sortedItems.map((item, idx) => {
              if (bannerCode === "top_wins_the_world_cup") {
                return (
                  <CountryOddsCard
                    key={item.selection_id}
                    rank={idx + 1}
                    item={item}
                    onBet={handleBet}
                    mobile={isMobile}
                  />
                );
              }
              // 金球 / 金靴 / 金手套 → PlayerOddsCard
              return (
                <PlayerOddsCard
                  key={item.selection_id}
                  rank={idx + 1}
                  item={item}
                  onBet={handleBet}
                  mobile={isMobile}
                />
              );
            })}
          </OddsCardGrid>
        )}
      </div>

      {/* BetSlip 侧栏（DD-085 §3.5 决策 #1）— 440w 固定宽，独立滚动 */}
      {showBetSlip && (
        <div className="hidden w-[440px] shrink-0 lg:block lg:overflow-y-auto lg:overscroll-contain">
          <BetSlip onClose={closePanel} />
        </div>
      )}
    </div>
  );
}
