"use client";

/**
 * 对决信息区（详情列 Part 2 · Figma 6123:92531 / 5107:183112）。
 *
 * 数据：自取 useMatchDetailOverview。loading → Skeleton；缺数据时仍渲染
 * OverviewHeader + MatchTimeline（用 fixtureXxx 兜底基础信息），仅跳过
 * 依赖 overview 的 VenueCard / 三合一 tab / Toggle。
 *
 * 排版分两套：
 *   默认           OverviewHeader / Timeline / VenueCard / Toggle / OverviewTabs
 *   compactBody    OverviewHeader / Timeline / 双列(VenueCard | active tab) / 底部 tab / Toggle
 *
 * jerseyPath 始终从 fixtureXxx 透传（4 个 match-detail 接口不下发球衣字段）。
 */
import { memo, useMemo, useState } from "react";
import type { MatchTeam } from "@/types/match-detail-domain";
import { useMatchDetailOverview } from "@/hooks/useMatchDetailOverview";
import OverviewHeader from "./overview/OverviewHeader";
import MatchTimeline from "./overview/MatchTimeline";
import LiveStreamSection from "./live-stream/LiveStreamSection";
import VenueCard from "./overview/VenueCard";
import { OverviewTabs } from "./overview/OverviewTabs";
import type { TabId } from "./overview/OverviewTabs";
import MatchOverviewToggle from "./MatchOverviewToggle";
import { HeadToHeadTab } from "./overview/tabs/HeadToHeadTab";
import { StandingsTab } from "./overview/tabs/StandingsTab";
import { LineupsTab } from "./overview/tabs/LineupsTab";
import UnderlineTabs, { type UnderlineTabItem } from "@/components/ui/UnderlineTabs";

export function MatchOverviewPanelSkeleton() {
  return (
    // @figma-hardcoded: #111114 overview-panel-bg — pending design token
    <div
      className="rounded-[16px] overflow-hidden flex flex-col animate-pulse"
      style={{ backgroundColor: "#111114" }}
      data-testid="overview-panel-skeleton"
    >
      <div className="h-[57px] mx-[16px] my-[8px] rounded-[8px] bg-white/10" />
      <div className="h-[101px] mx-[16px] mb-[8px] rounded-[8px] bg-white/10" />
      <div className="h-[236px] mx-[16px] mb-[8px] rounded-[8px] bg-white/10" />
    </div>
  );
}

interface Props {
  fixtureId: number;
  locale: string;
  stateId?: number;
  collapsed: boolean;
  onToggle: () => void;
  /** 紧凑布局：VenueCard 与 tab 内容并排，tabs 移到底部（市场页详情列样式） */
  compactBody?: boolean;
  /** DD-126：市场页详情列在 MatchTimeline 下方展示直播卡片（无直播时 LiveStreamSection 自身返回 null）。 */
  showLiveStream?: boolean;
  /** overview 接口失败时 OverviewHeader/MatchTimeline 的兜底基础信息（从 fixture 抽出）。 */
  fixtureHomeTeam: MatchTeam;
  fixtureAwayTeam: MatchTeam;
  fixtureStartingAt: string;
  fixtureStartingAtTimestamp: number;
}

type CompactTabKey = "h2h" | "standings" | "lineups";

const COMPACT_TABS: UnderlineTabItem<CompactTabKey>[] = [
  { key: "h2h", label: "Head to head", icon: "/images/match-detail/tab-h2h.svg" },
  { key: "standings", label: "Standings", icon: "/images/match-detail/tab-standings.svg" },
  { key: "lineups", label: "Lineups", icon: "/images/match-detail/tab-lineups.svg" },
];

// @figma-hardcoded: #111114 overview-panel-bg — pending design token
const PANEL_CLASS = "rounded-[16px] overflow-hidden flex flex-col";
const PANEL_STYLE: React.CSSProperties = { backgroundColor: "#111114" };

function MatchOverviewPanel({
  fixtureId,
  locale,
  stateId,
  collapsed,
  onToggle,
  compactBody = false,
  showLiveStream = false,
  fixtureHomeTeam,
  fixtureAwayTeam,
  fixtureStartingAt,
  fixtureStartingAtTimestamp,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("h2h");
  const { data: overview, isLoading } = useMatchDetailOverview(fixtureId, stateId);

  // overview 命中时合并其 team 字段（含 imagePath 等），jerseyPath 永远走 fixture 透传
  const homeTeam = useMemo<MatchTeam>(
    () =>
      overview ? { ...overview.homeTeam, jerseyPath: fixtureHomeTeam.jerseyPath } : fixtureHomeTeam,
    [overview, fixtureHomeTeam]
  );
  const awayTeam = useMemo<MatchTeam>(
    () =>
      overview ? { ...overview.awayTeam, jerseyPath: fixtureAwayTeam.jerseyPath } : fixtureAwayTeam,
    [overview, fixtureAwayTeam]
  );

  if (isLoading) return <MatchOverviewPanelSkeleton />;

  const startingAt = overview?.kickoff.iso ?? fixtureStartingAt;
  const startingAtTimestamp = overview?.kickoff.timestamp ?? fixtureStartingAtTimestamp;
  const hasOverview = !!overview;

  // 公共头：球衣 + 球员名 + 倒计时 timeline（不依赖 overview，永远渲染）
  const chrome = (
    <>
      <OverviewHeader
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        startingAt={startingAt}
        locale={locale}
      />
      <MatchTimeline
        startingAtTimestamp={startingAtTimestamp}
        homeShortCode={homeTeam.shortCode}
        awayShortCode={awayTeam.shortCode}
      />
      {/* DD-126：市场页详情列直播卡片紧跟时间线下方。无直播时 LiveStreamSection 自身返回 null。 */}
      {showLiveStream && (
        <LiveStreamSection fixtureId={fixtureId} startingAtTimestamp={startingAtTimestamp} />
      )}
    </>
  );

  if (compactBody) {
    return (
      <div className={PANEL_CLASS} style={PANEL_STYLE} data-figma-node="6123:92531">
        {chrome}
        {hasOverview && (
          <>
            {!collapsed && (
              <>
                <div className="flex" style={{ height: 140 }}>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <VenueCard domain={overview} compact />
                  </div>
                  <div className="flex-1 min-w-0 overflow-y-auto px-[8px] py-0">
                    {activeTab === "h2h" && (
                      <HeadToHeadTab
                        fixtureId={fixtureId}
                        enabled
                        winProbability={overview.winProbability}
                        h2hSummary={overview.h2hSummary}
                        homeShortCode={homeTeam.shortCode}
                        awayShortCode={awayTeam.shortCode}
                      />
                    )}
                    {activeTab === "standings" && <StandingsTab fixtureId={fixtureId} enabled />}
                    {activeTab === "lineups" && (
                      <LineupsTab fixtureId={fixtureId} enabled locale={locale} />
                    )}
                  </div>
                </div>
                <UnderlineTabs
                  tabs={COMPACT_TABS}
                  value={activeTab as CompactTabKey}
                  onChange={(key) => setActiveTab(key as TabId)}
                  size="md"
                  borderPosition="top"
                  ariaLabel="Match overview sections"
                />
              </>
            )}
            <MatchOverviewToggle collapsed={collapsed} onToggle={onToggle} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className={PANEL_CLASS} style={PANEL_STYLE} data-figma-node="5107:183112">
      {chrome}
      {hasOverview && (
        <>
          <VenueCard domain={overview} />
          <MatchOverviewToggle collapsed={collapsed} onToggle={onToggle} />
          {!collapsed && (
            <OverviewTabs
              fixtureId={fixtureId}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              winProbability={overview.winProbability}
              h2hSummary={overview.h2hSummary}
              homeShortCode={homeTeam.shortCode}
              awayShortCode={awayTeam.shortCode}
              locale={locale}
            />
          )}
        </>
      )}
    </div>
  );
}

// onToggle 需父级 useCallback 才能命中 memo（隔离 15s poll 全树重渲）
export default memo(MatchOverviewPanel);
