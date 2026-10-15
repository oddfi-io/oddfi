"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";
import type { BetSelection } from "@/types/betting";
import { useBetSlipStore, selectIsSelected } from "@/stores/betSlipStore";
import { useMarketsLayoutStore } from "@/stores/marketsLayoutStore";
import { useOddsDirection } from "@/hooks/useOddsDirection";
import { getMarketFixtureDetail } from "@/lib/api";
import { mul } from "@/lib/decimal";
import {
  getTeamLogo,
  getTeamName,
  formatKickoff,
  get1X2Entry,
  getFirstLineEntries,
} from "@/lib/match-utils";
import { makeSelectionId } from "@/lib/selection-id";
import SportIcon from "@/components/ui/SportIcon";

// ─── Types ─────────────────────────────────────────────────────────────────

import type { OddsFilter } from "@/types/betting";

interface MatchRowProps {
  fixture: SportmonksFixture;
  filter: OddsFilter;
  locale: string;
  leagueName: string;
}

// ─── ClickableArea ─────────────────────────────────────────────────────────
// Desktop (>= lg): button click -> selectFixture (open inline panel)
// Mobile (< lg): Link -> route navigation

// Single wrapper that handles both desktop (panel) and mobile (route) interactions.
// Children are rendered ONCE to avoid React hydration mismatch.
// Desktop: onClick opens inline detail panel via store.
// Mobile: onClick navigates via router.push (since <Link> with contents would duplicate children).
// [H5-PENDING] Mobile click behavior may change with H5 design.
function ClickableArea({
  fixtureId,
  locale,
  children,
}: {
  fixtureId: number;
  locale: string;
  children: React.ReactNode;
}) {
  const selectFixture = useMarketsLayoutStore((s) => s.selectFixture);
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleClick = () => {
    // Check if desktop (lg breakpoint = 1024px)
    if (window.innerWidth >= 1024) {
      selectFixture(fixtureId);
    } else {
      // Prefetch fixture data so detail page renders instantly from cache
      queryClient.prefetchQuery({
        queryKey: ["market-fixture", fixtureId, locale],
        queryFn: () =>
          getMarketFixtureDetail(fixtureId, "statis", { locale }).then((arr) => arr?.[0]),
        staleTime: 15_000,
      });
      router.push(`/${locale}/markets/fixture/${fixtureId}`);
    }
  };

  return (
    <div
      className="contents cursor-pointer"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      role="button"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

// ─── ConnectedOddsBtn ──────────────────────────────────────────────────────
// Each button subscribes to its own isSelected state via Zustand selector

function ConnectedOddsBtn({
  value,
  sublabel,
  selId,
  onClick,
}: {
  value: string;
  sublabel?: string;
  selId: string | null;
  onClick?: () => void;
}) {
  const isSelected = useBetSlipStore(selId ? selectIsSelected(selId) : () => false);
  const isDisabled = !onClick || value === "—";
  const direction = useOddsDirection(value);

  const flashClass =
    direction === "up"
      ? "animate-[oddsFlashUp_1.5s_ease-out]"
      : direction === "down"
        ? "animate-[oddsFlashDown_1.5s_ease-out]"
        : "";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={`min-h-[44px] w-full rounded text-sm font-semibold
        flex flex-col items-center justify-center border transition-colors
        ${flashClass}
        ${
          isDisabled
            ? "bg-white/[0.04] border-white/[0.08] text-tertiary cursor-default"
            : isSelected
              ? "bg-fn-brand border-fn-brand text-static-black"
              : "bg-btn-secondary border-transparent text-brand-default cursor-pointer"
        }`}
    >
      {sublabel && (
        <span className="text-[10px] font-normal leading-tight opacity-70">{sublabel}</span>
      )}
      <span className="inline-flex items-center gap-0.5">
        {value}
        {direction === "up" && <span className="text-[10px] text-green">&#9650;</span>}
        {direction === "down" && <span className="text-[10px] text-red">&#9660;</span>}
      </span>
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function MatchRow({ fixture, filter, locale, leagueName }: MatchRowProps) {
  const odds = fixture.odds ?? [];
  const toggleSelection = useBetSlipStore((s) => s.toggleSelection);
  const selectFixture = useMarketsLayoutStore((s) => s.selectFixture);

  const fixtureId = fixture.id;
  const fixtureName = fixture.name;
  const homeName = getTeamName(fixture, "home");
  const awayName = getTeamName(fixture, "away");
  const oddsCount = odds.length;

  // Auto-select fixture when clicking odds in State A (no fixture selected)
  function handleOddsClick(sel: BetSelection) {
    const currentFixture = useMarketsLayoutStore.getState().selectedFixtureId;
    if (currentFixture === null) {
      selectFixture(fixtureId);
    }
    toggleSelection(sel);
  }

  // ─── BetSelection builders ─────────────────────────────────────────────

  function make1X2Sel(
    entry: SportmonksOddsEntry | undefined,
    displayLabel: string
  ): { sel: BetSelection; id: string } | null {
    if (!entry) return null;
    const id = makeSelectionId(fixtureId, entry.market_id, entry.label);
    return {
      id,
      sel: {
        id,
        oddId: entry.id,
        fixtureId,
        fixtureName,
        leagueName,
        marketType: "1x2",
        marketDescription: entry.market_description,
        selection: entry.label,
        displayLabel,
        odds: entry.value,
      },
    };
  }

  function makeLineSel(
    entry: SportmonksOddsEntry | undefined,
    marketId: number,
    displayLabel: string,
    lineValue?: string
  ): { sel: BetSelection; id: string } | null {
    if (!entry) return null;
    const id = makeSelectionId(fixtureId, marketId, entry.label, lineValue);
    return {
      id,
      sel: {
        id,
        oddId: entry.id,
        fixtureId,
        fixtureName,
        leagueName,
        marketType: marketId === 6 ? "asian_handicap" : "asian_total",
        marketDescription: entry.market_description,
        selection: entry.label,
        displayLabel,
        odds: entry.value,
        handicap: entry.handicap || undefined,
        total: entry.total || undefined,
      },
    };
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-[48px_1fr_repeat(3,72px)_40px] gap-2 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors border-t border-divider">
      {/* Kickoff time + Teams: desktop opens inline panel, mobile routes */}
      <ClickableArea fixtureId={fixtureId} locale={locale}>
        <span className="text-xs text-secondary font-medium">
          {formatKickoff(fixture.starting_at)}
        </span>

        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <SportIcon src={getTeamLogo(fixture, "home")} size={16} withBg />
            <span className="text-sm text-primary truncate">{homeName}</span>
          </div>
          <div className="flex items-center gap-2">
            <SportIcon src={getTeamLogo(fixture, "away")} size={16} withBg />
            <span className="text-sm text-primary truncate">{awayName}</span>
          </div>
        </div>
      </ClickableArea>

      {/* Odds columns: toggle BetSlip selection */}
      {filter === "winner" &&
        (() => {
          const homeEntry = get1X2Entry(odds, "Home");
          const drawEntry = get1X2Entry(odds, "Draw");
          const awayEntry = get1X2Entry(odds, "Away");
          const homeSel = make1X2Sel(homeEntry, homeName);
          const drawSel = make1X2Sel(drawEntry, "Draw");
          const awaySel = make1X2Sel(awayEntry, awayName);
          return (
            <>
              <ConnectedOddsBtn
                value={homeEntry?.value ?? "—"}
                selId={homeSel?.id ?? null}
                onClick={homeSel ? () => handleOddsClick(homeSel.sel) : undefined}
              />
              <ConnectedOddsBtn
                value={drawEntry?.value ?? "—"}
                selId={drawSel?.id ?? null}
                onClick={drawSel ? () => handleOddsClick(drawSel.sel) : undefined}
              />
              <ConnectedOddsBtn
                value={awayEntry?.value ?? "—"}
                selId={awaySel?.id ?? null}
                onClick={awaySel ? () => handleOddsClick(awaySel.sel) : undefined}
              />
            </>
          );
        })()}

      {filter === "handicap" &&
        (() => {
          const { home, away } = getFirstLineEntries(odds, 6, ["Home", "1"], ["Away", "2"]);
          const line = home?.handicap ?? "";
          const lineValue = home?.handicap ?? undefined;
          const homeSel = makeLineSel(home, 6, `${homeName} ${line}`, lineValue);
          const awaySel = makeLineSel(
            away,
            6,
            `${awayName} ${line ? mul(line, "-1") : ""}`,
            lineValue
          );
          return (
            <>
              <ConnectedOddsBtn
                value={home?.value ?? "—"}
                sublabel={line || undefined}
                selId={homeSel?.id ?? null}
                onClick={homeSel ? () => handleOddsClick(homeSel.sel) : undefined}
              />
              <div className="text-center text-xs text-secondary self-center">AH</div>
              <ConnectedOddsBtn
                value={away?.value ?? "—"}
                sublabel={line ? mul(line, "-1") : undefined}
                selId={awaySel?.id ?? null}
                onClick={awaySel ? () => handleOddsClick(awaySel.sel) : undefined}
              />
            </>
          );
        })()}

      {filter === "total" &&
        (() => {
          const { home, away } = getFirstLineEntries(odds, 7, ["Over"], ["Under"]);
          const line = home?.total ?? "";
          const lineValue = home?.total ?? undefined;
          const homeSel = makeLineSel(home, 7, `Over ${line}`, lineValue);
          const awaySel = makeLineSel(away, 7, `Under ${line}`, lineValue);
          return (
            <>
              <ConnectedOddsBtn
                value={home?.value ?? "—"}
                sublabel={line ? `O ${line}` : undefined}
                selId={homeSel?.id ?? null}
                onClick={homeSel ? () => handleOddsClick(homeSel.sel) : undefined}
              />
              <div className="text-center text-xs text-secondary self-center">O/U</div>
              <ConnectedOddsBtn
                value={away?.value ?? "—"}
                sublabel={line ? `U ${line}` : undefined}
                selId={awaySel?.id ?? null}
                onClick={awaySel ? () => handleOddsClick(awaySel.sel) : undefined}
              />
            </>
          );
        })()}

      {/* +N markets: reuses same responsive logic as ClickableArea */}
      <ClickableArea fixtureId={fixtureId} locale={locale}>
        <span className="flex items-center justify-center min-h-[44px] text-xs text-secondary hover:text-brand-default transition-colors">
          {oddsCount > 0 && `+${oddsCount}`}
        </span>
      </ClickableArea>
    </div>
  );
}
