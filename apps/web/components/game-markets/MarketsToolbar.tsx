"use client";

import { useState } from "react";
import HomeBannerCarousel from "@/components/home-banner/HomeBannerCarousel";
import HomeBannerSkeleton from "@/components/home-banner/HomeBannerSkeleton";
import LeagueChips from "./LeagueChips";
import SearchBar from "./SearchBar";
import SearchInput from "./SearchInput";
import MarketFilter from "./MarketFilter";
import type { OddsFilter } from "@/types/betting";
import type { TeamOption, LeagueCountryOption } from "@/hooks/useMarketData";

interface MarketsToolbarProps {
  teams?: TeamOption[];
  leagueCountries?: LeagueCountryOption[];
  fixturesLoading: boolean;
  filter: OddsFilter;
  onFilterChange: (value: OddsFilter) => void;
  layoutState: "default" | "detail" | "betslip" | "betslip-only";
  isTripleOdds?: boolean;
  onSearchClick?: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

/** Full toolbar skeleton: banners + chips + search/filter placeholders */
export function MarketsToolbarSkeleton() {
  return (
    <div className="space-y-4">
      {/* HomeBanner skeleton */}
      <HomeBannerSkeleton />
      {/* Chips + Search row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* ChipsSkeleton inline (private in LeagueChips) */}
        <div className="flex gap-3">
          {[72, 80, 64, 88, 72].map((w, i) => (
            <div
              key={i}
              className="h-10 rounded-full bg-white/[0.06] animate-pulse"
              style={{ width: w }}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-between lg:justify-end gap-4">
          <div className="h-[40px] w-[40px] lg:w-[200px] rounded-full bg-white/[0.06] animate-pulse" />
          <div className="h-[40px] w-[90px] rounded-12 bg-white/[0.06] animate-pulse" />
          <div className="h-[40px] w-[40px] rounded-full bg-white/[0.06] animate-pulse lg:hidden" />
        </div>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function MarketsToolbar({
  teams,
  leagueCountries,
  fixturesLoading,
  filter,
  onFilterChange,
  layoutState,
  isTripleOdds = false,
  onSearchClick,
  searchQuery,
  onSearchQueryChange,
}: MarketsToolbarProps) {
  const isBetslip = layoutState === "betslip";
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const chips = (
    <LeagueChips teams={teams} leagueCountries={leagueCountries} isLoading={fixturesLoading} />
  );

  const searchAndFilter = (
    <>
      <SearchInput
        value={searchQuery}
        onChange={onSearchQueryChange}
        onClear={() => onSearchQueryChange("")}
      />
      {!isTripleOdds && <MarketFilter value={filter} onChange={onFilterChange} />}
    </>
  );

  return (
    <div className="space-y-4">
      {!isBetslip && <HomeBannerCarousel />}

      {isBetslip ? (
        // ─── 三列模式: chips 第一行，搜索+盘口 第二行（搜索展开时隐藏盘口）───
        <div className="flex flex-col gap-3">
          {chips}
          <div className="flex items-center gap-4">
            <SearchInput
              value={searchQuery}
              onChange={onSearchQueryChange}
              onClear={() => onSearchQueryChange("")}
              onExpandChange={setIsSearchExpanded}
            />
            {!isSearchExpanded && !isTripleOdds && (
              <MarketFilter value={filter} onChange={onFilterChange} />
            )}
          </div>
        </div>
      ) : (
        // ─── 默认 / 两列模式: 搜索在一级 tab 行右侧 ─────────────────────
        <div className="flex flex-col gap-4">
          <LeagueChips
            teams={teams}
            leagueCountries={leagueCountries}
            isLoading={fixturesLoading}
            rightSlot={searchAndFilter}
          />
          {/* H5: MarketFilter + SearchBar below chips */}
          <div className="flex lg:hidden shrink-0 items-center justify-between gap-4">
            {!isTripleOdds && <MarketFilter value={filter} onChange={onFilterChange} />}
            <SearchBar onClick={onSearchClick} />
          </div>
        </div>
      )}
    </div>
  );
}
