"use client";

import {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useCallback,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { CaretRightIcon, CalendarBlankIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import {
  useMarketsLayoutStore,
  selectSelectedTimeFilter,
  selectSelectedTeamFilter,
} from "@/stores/marketsLayoutStore";
import type { TimeFilter } from "@/stores/marketsLayoutStore";
import type { TeamOption, LeagueCountryOption } from "@/hooks/useMarketData";
import LiveDotIcon from "@/components/icons/LiveDotIcon";
import LeagueCountryChips from "./LeagueCountryChips";

// ─── Time filter chip configs ────────────────────────────────────────────

const TIME_CHIPS: { key: TimeFilter; labelKey: string; iconType?: "dot" | "calendar" }[] = [
  { key: "all", labelKey: "chipAll" },
  { key: "live", labelKey: "chipLive", iconType: "dot" },
  { key: "today", labelKey: "chipToday" },
  { key: "tomorrow", labelKey: "chipTomorrow" },
  { key: "calendar", labelKey: "chipCalendar", iconType: "calendar" },
];

const MAX_VISIBLE_TEAMS = 10;

// ─── Chip ────────────────────────────────────────────────────────────────

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  label: string;
  iconType?: "dot" | "calendar";
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { label, iconType, isActive, disabled, onClick, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ touchAction: "manipulation" }}
      {...rest}
      className={`flex-shrink-0 h-[40px] min-w-[72px] px-[12px] py-[9px] rounded-full flex items-center justify-center gap-1
        text-[12px] font-medium transition-colors min-h-[44px]
        ${
          disabled
            ? "bg-fill-input border border-secondary text-tertiary cursor-not-allowed opacity-50"
            : isActive
              ? "bg-tag-brand border border-dt-hover text-brand-default"
              : "bg-fill-input border border-secondary text-secondary hover:bg-white/[0.08]"
        }`}
    >
      {iconType === "dot" && <LiveDotIcon size={12} />}
      {iconType === "calendar" && <CalendarBlankIcon size={14} weight="bold" />}
      <span>{label}</span>
    </button>
  );
});

// ─── Skeleton chips (CLS prevention) ─────────────────────────────────────

function ChipsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-10 w-16 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0"
        />
      ))}
    </>
  );
}

// ─── Scrollable row with fade overlay ────────────────────────────────────

export function ScrollableRow({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFade();
    el.addEventListener("scroll", updateFade, { passive: true });
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFade);
      ro.disconnect();
    };
  }, [updateFade]);

  const scrollRight = useCallback(() => {
    scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  }, []);

  return (
    <div className="relative min-w-0">
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide lg:pr-[50px]">
        {children}
      </div>

      {/* Right fade overlay + scroll arrow — PC only */}
      {showFade && (
        <div className="absolute right-0 top-0 bottom-0 hidden lg:flex items-center pointer-events-none">
          <div
            className="w-[70px] h-[40px]"
            style={{
              background:
                "linear-gradient(270deg, color(display-p3 0.0157 0.0235 0.0471) 0%, color(display-p3 0.0157 0.0235 0.0471 / 0) 100%)",
            }}
          />
          <div className="absolute right-0 h-[46px] w-[16px] bg-primary" />
          <button
            type="button"
            aria-label="Scroll chips right"
            onClick={scrollRight}
            className="absolute right-0 min-h-[44px] min-w-[44px]
              flex items-center justify-center
              size-8 rounded-full bg-fill-input
              pointer-events-auto transition-colors hover:bg-white/[0.12]"
          >
            <CaretRightIcon size={14} className="text-primary" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────

interface LeagueChipsProps {
  teams?: TeamOption[];
  /** DD-083: Other Tab 国家分组 chip 数据源 */
  leagueCountries?: LeagueCountryOption[];
  isLoading?: boolean;
  /** PC: rendered to the right of time filter row (search/filter controls) */
  rightSlot?: ReactNode;
}

export default function LeagueChips({
  teams = [],
  leagueCountries = [],
  isLoading = false,
  rightSlot,
}: LeagueChipsProps) {
  const t = useTranslations("markets");

  const selectedTimeFilter = useMarketsLayoutStore(selectSelectedTimeFilter);
  const selectedTeamFilter = useMarketsLayoutStore(selectSelectedTeamFilter);
  const setSelectedTimeFilter = useMarketsLayoutStore((s) => s.setSelectedTimeFilter);
  const setSelectedTeamFilter = useMarketsLayoutStore((s) => s.setSelectedTeamFilter);

  const handleTimeChipClick = useCallback(
    (key: TimeFilter) => {
      if (key === "calendar") return; // Calendar disabled — product design pending
      setSelectedTimeFilter(key);
    },
    [setSelectedTimeFilter]
  );

  // DD-market-chips：teams 来源换后端，仍保留 "待定" 渲染层兜底过滤 + MAX_VISIBLE_TEAMS 截断
  const visibleTeams = teams.filter((team) => team.name !== "待定").slice(0, MAX_VISIBLE_TEAMS);
  const showTeamRow = teams.length > 0;

  return (
    <div className="flex flex-col gap-[8px]">
      {/* Row 1: Time filter chips + optional right slot (search/filter on PC) */}
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <ScrollableRow>
            {TIME_CHIPS.map((chip) => (
              <Chip
                key={chip.key}
                label={t(chip.labelKey as Parameters<typeof t>[0])}
                iconType={chip.iconType}
                isActive={selectedTimeFilter === chip.key}
                disabled={chip.key === "calendar"}
                onClick={() => handleTimeChipClick(chip.key)}
              />
            ))}
          </ScrollableRow>
        </div>
        {rightSlot && <div className="shrink-0 hidden lg:flex items-center gap-4">{rightSlot}</div>}
      </div>

      {/* Row 1.5: Country filter chips — DD-083, Other Tab 激活时由 leagueCountries 驱动 */}
      {leagueCountries.length > 0 && <LeagueCountryChips leagueCountries={leagueCountries} />}

      {/* Row 2: Team filter chips (dynamic, from useMarketData.teams) */}
      <div className="min-h-[36px]">
        {isLoading ? (
          <div className="flex gap-3">
            <ChipsSkeleton count={4} />
          </div>
        ) : showTeamRow ? (
          <ScrollableRow>
            <Chip
              label={t("chipAllTeams")}
              isActive={selectedTeamFilter === null}
              onClick={() => setSelectedTeamFilter(null)}
            />
            {visibleTeams.map((team) => (
              <Chip
                key={team.team_id}
                label={team.name}
                isActive={selectedTeamFilter === team.team_id}
                onClick={() => setSelectedTeamFilter(team.team_id)}
              />
            ))}
          </ScrollableRow>
        ) : null}
      </div>
    </div>
  );
}
