"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  useMarketsLayoutStore,
  selectSidebarCollapsed,
  selectSelectedFixtureId,
} from "@/stores/marketsLayoutStore";
import { useBetSlipStore, selectSelectionCount } from "@/stores/betSlipStore";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import LeagueSidebar from "@/components/game-markets/LeagueSidebar";
import MobileBetSlipFAB from "@/components/bet-slip/MobileBetSlipFAB";
import GlobalDepositSheet from "@/components/deposit/GlobalDepositSheet";

export default function MarketsLayout({ children }: { children: React.ReactNode }) {
  const mode = useResponsiveMode();
  const pathname = usePathname();
  // Calendar / Bracket 页内容高度超过视口，需放开父级高度限制让整页可滚展示完整内容
  const isCalendarRoute = pathname?.includes("/markets/calendar") ?? false;
  const isBracketRoute = pathname?.includes("/markets/bracket") ?? false;
  const isFullPageRoute = isCalendarRoute || isBracketRoute;
  const sidebarCollapsed = useMarketsLayoutStore(selectSidebarCollapsed);
  const selectedFixtureId = useMarketsLayoutStore(selectSelectedFixtureId);
  const selectionCount = useBetSlipStore(selectSelectionCount);
  const setSidebarCollapsed = useMarketsLayoutStore((s) => s.setSidebarCollapsed);
  const closeDetail = useMarketsLayoutStore((s) => s.closeDetail);
  const toggleSidebar = useMarketsLayoutStore((s) => s.toggleSidebar);

  // Sidebar auto-collapse:
  // - Standard: collapse when detail opens (sidebar ↔ detail mutually exclusive)
  // - Wide/Ultra: collapse only when both panels open (detail + betslip)
  useEffect(() => {
    if (selectedFixtureId === null) return;

    if (mode === "standard") {
      setSidebarCollapsed(true);
    } else if (selectionCount > 0) {
      setSidebarCollapsed(true);
    } else {
      const pref = useMarketsLayoutStore.getState().sidebarUserPreference;
      setSidebarCollapsed(pref);
    }
  }, [selectedFixtureId, selectionCount, mode, setSidebarCollapsed]);

  // Standard mode: expanding sidebar → close detail
  const handleSidebarToggle = useCallback(() => {
    const { sidebarCollapsed: isCollapsed, selectedFixtureId: fixtureId } =
      useMarketsLayoutStore.getState();
    const willExpand = isCollapsed;

    toggleSidebar();

    if (mode === "standard" && willExpand && fixtureId !== null) {
      closeDetail();
    }
  }, [mode, toggleSidebar, closeDetail]);

  const gridCols = sidebarCollapsed ? "50px 1fr" : "200px 1fr";

  // 2026-05-18 调整：去掉外层 lg:pt-[20px] + 全局 pt 由 80→64 后，shell/sidebar 高度基准由 100px→64px，
  //                  使侧栏 divider 紧贴 topnav 下沿、并占满到视口底
  const shellHeightClass = isFullPageRoute
    ? "min-h-[calc(100vh-82px)] lg:min-h-[calc(100vh-64px)]"
    : "min-h-[calc(100vh-82px)] lg:min-h-0 lg:h-[calc(100vh-64px)]";
  const shellOverflowClass = isFullPageRoute ? "" : "overflow-clip";
  const sidebarColClass = isFullPageRoute
    ? "hidden lg:block lg:sticky lg:top-[64px] lg:h-[calc(100vh-64px)] overflow-hidden"
    : "hidden lg:block overflow-hidden";
  // mainColClass 加 lg:pt-[32px]：让 banner 与 topnav 留 32px 间距（sidebar 列仍 0 padding 保持 divider 贴顶）
  const mainColClass = isFullPageRoute
    ? "min-w-0 lg:pt-[32px]"
    : "min-w-0 overflow-y-auto lg:overflow-y-hidden lg:h-full lg:pt-[32px]";

  return (
    <div className="lg:px-[20px]">
      <div
        className={`flex flex-col lg:grid rounded-[20px] lg:rounded-none shadow-shell bg-primary lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.4,0,0.2,1)] ${shellHeightClass} ${shellOverflowClass}`}
        style={{ gridTemplateColumns: gridCols }}
      >
        {/* Column 1: League sidebar — desktop only（calendar / bracket 路径下 sticky） */}
        <div className={sidebarColClass}>
          <LeagueSidebar collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} />
        </div>

        {/* Column 2: Main content — MarketsPageClient manages internal 1/2/3 column layout */}
        <div className={mainColClass}>{children}</div>
      </div>

      {/* Mobile: floating Bet Slip button + bottom sheet */}
      <MobileBetSlipFAB />

      {/* Global deposit modal — survives BetSlip sheet close */}
      <GlobalDepositSheet />
    </div>
  );
}
