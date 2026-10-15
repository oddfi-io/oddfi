"use client";

/**
 * OverviewTabs — Figma 节点 5107:182998 / 5107:183004 / 5107:183010
 * DD-104 Batch 2：activeTab 上提受控，内部 useState 已删除
 * DD-104 Batch 4：删除 overview prop，改为 fixtureId + overview domain 子集透传
 *
 * 视觉规范：
 *   - Tab 行 32px 高，3 等分宽度
 *   - 每个 Tab：16×16 SVG icon + 12px Roboto-Regular lowercase 文字
 *   - active：白色文字（#e0e0e0） + 底部 2px 白色横线
 *   - inactive：opacity-80（图标 + 文字一起淡），无底线
 */

import type { WinProbability, H2HSummary } from "@/types/match-detail-domain";
import { HeadToHeadTab } from "./tabs/HeadToHeadTab";
import { StandingsTab } from "./tabs/StandingsTab";
import { LineupsTab } from "./tabs/LineupsTab";

export type TabId = "h2h" | "standings" | "lineups";

interface OverviewTabsProps {
  fixtureId: number;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** From MatchOverviewDomain — passed through from Batch 3 overview hook */
  winProbability?: WinProbability | null;
  /**
   * H2H 主客胜负统计，来自 overview 接口（H2H 接口不返回该字段）。
   * 透传至 HeadToHeadTab → H2HCardWinProb。
   */
  h2hSummary?: H2HSummary | null;
  homeShortCode?: string;
  awayShortCode?: string;
  locale?: string;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "h2h", label: "Head-to-Head", icon: "/images/match-detail/tab-h2h.svg" },
  { id: "standings", label: "Standings", icon: "/images/match-detail/tab-standings.svg" },
  { id: "lineups", label: "Lineups", icon: "/images/match-detail/tab-lineups.svg" },
];

export function OverviewTabs({
  fixtureId,
  activeTab,
  onTabChange,
  winProbability,
  h2hSummary,
  homeShortCode,
  awayShortCode,
  locale,
}: OverviewTabsProps) {
  return (
    <div className="flex flex-col" data-figma-node="5107:182998">
      {/* Tab 切换器 — 32px 高 3 等分 */}
      <div className="flex h-[32px] w-full">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              style={{ touchAction: "manipulation" }}
              className={[
                "relative flex flex-1 items-center justify-center gap-[6px]",
                "text-[12px] leading-[14px] lowercase text-[#e0e0e0]",
                active ? "opacity-100" : "opacity-80 hover:opacity-100",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tab.icon} alt="" aria-hidden="true" className="block size-[16px]" />
              <span>{tab.label}</span>
              {/* 底部 2px 白色 active 指示器 */}
              <span
                aria-hidden="true"
                className="absolute left-0 right-0 bottom-0 border-t-2 border-[#e0e0e0]"
                style={{ opacity: active ? 1 : 0 }}
              />
            </button>
          );
        })}
      </div>

      {/* Tab 内容 — 全挂载 + enabled 控制（保持 mount 状态避免动画丢失） */}
      <div className="mt-3">
        <div style={{ display: activeTab === "h2h" ? undefined : "none" }}>
          <HeadToHeadTab
            fixtureId={fixtureId}
            enabled={activeTab === "h2h"}
            winProbability={winProbability}
            h2hSummary={h2hSummary}
            homeShortCode={homeShortCode}
            awayShortCode={awayShortCode}
          />
        </div>
        <div style={{ display: activeTab === "standings" ? undefined : "none" }}>
          <StandingsTab fixtureId={fixtureId} enabled={activeTab === "standings"} />
        </div>
        <div style={{ display: activeTab === "lineups" ? undefined : "none" }}>
          <LineupsTab fixtureId={fixtureId} enabled={activeTab === "lineups"} locale={locale} />
        </div>
      </div>
    </div>
  );
}
