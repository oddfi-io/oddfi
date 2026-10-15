"use client";

import { useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  useMarketsLayoutStore,
  useLayoutState,
  selectSelectedFixtureId,
  selectSelectedTournament,
  selectSelectedTimeFilter,
  selectSelectedLeagueCountryId,
  selectSelectedTeamFilter,
} from "@/stores/marketsLayoutStore";
import { useMarketData } from "@/hooks/useMarketData";
import { useIsTripleOdds, useResponsiveMode } from "@/hooks/useResponsiveMode";
import { MatchListSkeleton } from "@/components/game-markets/MatchList";
import TimelineMatchList from "@/components/game-markets/TimelineMatchList";
import MarketsToolbar from "@/components/game-markets/MarketsToolbar";
import ContentTypeTabs from "@/components/game-markets/ContentTypeTabs";
import MatchDetailColumnHost from "@/components/game-markets/MatchDetailColumnHost";
import SearchModal from "@/components/game-markets/SearchModal";
import H5SearchOverlay from "@/components/game-markets/H5SearchOverlay";
import TournamentTabs from "@/components/game-markets/TournamentTabs";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import BetSlipPanel from "./BetSlipPanel";
import type { OddsFilter } from "@/types/betting";

export default function MarketsPageClient() {
  const locale = useLocale();
  const layoutState = useLayoutState();
  const selectedFixtureId = useMarketsLayoutStore(selectSelectedFixtureId);
  const selectFixture = useMarketsLayoutStore((s) => s.selectFixture);

  const tournament = useMarketsLayoutStore(selectSelectedTournament);
  const timeFilter = useMarketsLayoutStore(selectSelectedTimeFilter);
  const calendarDate = useMarketsLayoutStore((s) => s.calendarDate);
  const selectedLeagueCountryId = useMarketsLayoutStore(selectSelectedLeagueCountryId);
  const selectedTeamFilter = useMarketsLayoutStore(selectSelectedTeamFilter);

  const mode = useResponsiveMode();
  const isTripleOdds = useIsTripleOdds();
  const [filter, setFilter] = useState<OddsFilter>("winner");
  const [searchOpen, setSearchOpen] = useState(false);
  const [h5SearchOpen, setH5SearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    fixtures,
    isLoading,
    isError,
    teams,
    leagueCountries,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMarketData({
    tournament,
    timeFilter,
    calendarDate,
    selectedLeagueCountryId,
    selectedTeamFilter,
  });

  const scrollHostRef = useRef<HTMLDivElement | null>(null);

  const handleSearchSelect = (fixtureId: number) => {
    setSearchQuery("");
    selectFixture(fixtureId);
  };

  // Layout state flags
  const hasDetail = layoutState === "detail" || layoutState === "betslip";
  const hasBetslip = layoutState === "betslip" || layoutState === "betslip-only";
  // dock 形态需要右栏作为 chat 容器，即使没有 betslip。
  const isChatDocked = useAiChatSessionStore((s) => s.mode === "dock");
  const hasRightColumn = hasBetslip || isChatDocked;
  const hasPanel = hasDetail || hasRightColumn;

  const detailWidth = mode === "ultra" && layoutState === "detail" ? "640px" : "520px";

  const gridStyle: React.CSSProperties | undefined =
    hasDetail && hasRightColumn
      ? mode === "standard"
        ? { gridTemplateColumns: "278px 34px minmax(0,1fr) 14px 440px" }
        : { gridTemplateColumns: "minmax(0,1fr) 12px 520px 12px 440px" }
      : hasDetail
        ? { gridTemplateColumns: `1fr 12px ${detailWidth}` }
        : hasRightColumn
          ? { gridTemplateColumns: "1fr 12px 440px" }
          : undefined;

  return (
    <main className="min-w-0 px-4 pt-0 lg:pl-6 lg:pr-0 lg:pt-0 lg:h-full lg:overflow-hidden">
      <div
        className={hasPanel ? "lg:grid lg:h-full" : "lg:h-full lg:overflow-y-auto"}
        style={gridStyle}
      >
        <div
          ref={scrollHostRef}
          className={
            hasPanel ? "min-w-0 lg:overflow-y-auto flex flex-col gap-4" : "flex flex-col gap-4"
          }
        >
          {/* H5: Content type tabs + Tournament tabs — flush, no gap */}
          <div className="lg:hidden">
            <ContentTypeTabs />
            <TournamentTabs />
          </div>

          <MarketsToolbar
            teams={teams}
            leagueCountries={leagueCountries}
            fixturesLoading={isLoading}
            filter={filter}
            onFilterChange={setFilter}
            layoutState={layoutState}
            isTripleOdds={isTripleOdds}
            onSearchClick={() => setH5SearchOpen(true)}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
          {isLoading ? (
            <MatchListSkeleton />
          ) : (
            <TimelineMatchList
              fixtures={fixtures}
              locale={locale}
              timeFilter={timeFilter}
              searchQuery={searchQuery}
              oddsFilter={filter}
              isError={isError}
              isTripleOdds={isTripleOdds}
              fetchNextPage={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              scrollHostRef={scrollHostRef}
            />
          )}
        </div>

        {hasDetail && selectedFixtureId !== null && (
          <div
            key={selectedFixtureId}
            className="hidden lg:block min-w-0 animate-slide-in-right lg:overflow-y-auto lg:overscroll-contain scrollbar-hide"
            style={{ gridColumn: 3 }}
          >
            <MatchDetailColumnHost fixtureId={selectedFixtureId} />
          </div>
        )}

        {hasRightColumn && (
          // 整列 id 是 float→dock 归位的 target rect（覆盖任意垂直位置拖右边缘都吸附）。
          // min-h-0 防止 grid item 被内容撑超 viewport，配合 h-full 让 column = grid cell 高度。
          <div
            id="ai-chat-dock-column"
            className="hidden lg:flex lg:flex-col gap-6 min-w-0 min-h-0 lg:h-full animate-slide-in-right"
            style={{ gridColumn: hasDetail ? 5 : 3 }}
          >
            <BetSlipPanel />
          </div>
        )}
      </div>

      {/* PC 端搜索弹窗 */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        fixtures={fixtures}
        locale={locale}
        onSelectFixture={handleSearchSelect}
      />

      {/* H5 端全屏搜索覆盖层 */}
      <H5SearchOverlay
        isOpen={h5SearchOpen}
        onClose={() => setH5SearchOpen(false)}
        fixtures={fixtures}
        locale={locale}
      />
    </main>
  );
}
