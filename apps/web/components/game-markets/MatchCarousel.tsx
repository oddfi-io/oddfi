"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { SportmonksFixture } from "@/types/api";
import type { BetSelection } from "@/types/betting";

import { useBetSlipStore, selectIsSelected } from "@/stores/betSlipStore";
import { useOddsDirection } from "@/hooks/useOddsDirection";
import { formatMatchDateTime } from "@/lib/format-utils";
import { makeSelectionId } from "@/lib/selection-id";

interface MatchCarouselProps {
  fixtures: SportmonksFixture[];
  locale: string;
}

const AUTO_PLAY_INTERVAL = 5000;

/** Pick top 5 fixtures with odds, sorted by odds count (most popular) */
export function pickTopFixtures(fixtures: SportmonksFixture[], count = 5): SportmonksFixture[] {
  return [...fixtures]
    .filter((f) => f.has_odds && f.odds && f.odds.length > 0)
    .sort((a, b) => (b.odds?.length ?? 0) - (a.odds?.length ?? 0))
    .slice(0, count);
}

// ─── CarouselOddsBtn ───────────────────────────────────────────────────────
// Subscribes to its own isSelected state via Zustand selector

function CarouselOddsBtn({
  label,
  value,
  selId,
  onClick,
}: {
  label: string;
  value: string;
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
      className={`rounded-8 py-2 text-center text-sm min-h-[44px] transition-colors
        ${flashClass}
        ${
          isDisabled
            ? "opacity-50 cursor-default"
            : isSelected
              ? "bg-tag-orange ring-1 ring-fn-orange"
              : "hover:bg-white/[0.15] cursor-pointer"
        }`}
      style={!isSelected ? { background: "rgba(48,79,254,0.6)" } : undefined}
    >
      <span className="text-white/60 text-xs">{label}</span>
      <span className={`ml-2 font-semibold ${isSelected ? "text-brand-default" : "text-white"}`}>
        {value}
        {direction === "up" && <span className="text-[10px] text-green ml-0.5">▲</span>}
        {direction === "down" && <span className="text-[10px] text-red ml-0.5">▼</span>}
      </span>
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function MatchCarousel({ fixtures, locale }: MatchCarouselProps) {
  const top = pickTopFixtures(fixtures);
  const [current, setCurrent] = useState(0);
  const toggleSelection = useBetSlipStore((s) => s.toggleSelection);

  const next = useCallback(() => {
    if (top.length === 0) return;
    setCurrent((c) => (c + 1) % top.length);
  }, [top.length]);

  const prev = useCallback(() => {
    if (top.length === 0) return;
    setCurrent((c) => (c - 1 + top.length) % top.length);
  }, [top.length]);

  // Auto-play
  useEffect(() => {
    if (top.length <= 1) return;
    const timer = setInterval(next, AUTO_PLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [next, top.length]);

  if (top.length === 0) return null;

  const fixture = top[current];
  const home = fixture.participants.find((p) => p.meta.location === "home");
  const away = fixture.participants.find((p) => p.meta.location === "away");

  // Get 1X2 odds entries (need market_id for selection ID)
  const ftOdds = fixture.odds?.filter((o) => o.market_id === 1) ?? [];
  const homeEntry = ftOdds.find((o) => o.label === "Home");
  const drawEntry = ftOdds.find((o) => o.label === "Draw");
  const awayEntry = ftOdds.find((o) => o.label === "Away");

  // Build BetSelections (ID format matches OddsSection: fixtureId-market_id-label)
  function makeSel(
    entry: typeof homeEntry,
    displayLabel: string
  ): { sel: BetSelection; id: string } | null {
    if (!entry) return null;
    const id = makeSelectionId(fixture.id, entry.market_id, entry.label);
    return {
      id,
      sel: {
        id,
        oddId: entry.id,
        fixtureId: fixture.id,
        fixtureName: fixture.name,
        leagueName: fixture.league?.name ?? "",
        marketType: "1x2",
        marketDescription: entry.market_description,
        selection: entry.label,
        displayLabel,
        odds: entry.value,
        homeLogo: home?.image_path || undefined,
        awayLogo: away?.image_path || undefined,
      },
    };
  }

  const homeSel = makeSel(homeEntry, home?.name ?? "—");
  const drawSel = makeSel(drawEntry, "Draw");
  const awaySel = makeSel(awayEntry, away?.name ?? "—");

  const oddsData = [
    { label: "1", value: homeEntry?.value ?? "—", selId: homeSel?.id ?? null, sel: homeSel?.sel },
    {
      label: "XIcon",
      value: drawEntry?.value ?? "—",
      selId: drawSel?.id ?? null,
      sel: drawSel?.sel,
    },
    { label: "2", value: awayEntry?.value ?? "—", selId: awaySel?.id ?? null, sel: awaySel?.sel },
  ];

  return (
    <div className="relative rounded-12 overflow-hidden bg-btn-primary">
      {/* Match info: navigate to fixture detail */}
      <Link
        href={`/${locale}/markets/fixture/${fixture.id}`}
        className="block px-6 pt-5 pb-2 relative z-10"
      >
        <p className="text-xs text-white/70 mb-3">
          {formatMatchDateTime(fixture.starting_at, locale)}
        </p>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {home?.image_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={home.image_path}
                alt=""
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            )}
            <span className="text-base font-semibold text-white truncate">{home?.name ?? "—"}</span>
          </div>

          <span className="text-sm font-bold text-white/50 shrink-0">vs</span>

          <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
            <span className="text-base font-semibold text-white truncate text-right">
              {away?.name ?? "—"}
            </span>
            {away?.image_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={away.image_path}
                alt=""
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            )}
          </div>
        </div>
      </Link>

      {/* Odds buttons: toggle BetSlip selection */}
      <div className="grid grid-cols-3 gap-2 px-6 pb-5 relative z-10">
        {oddsData.map((o) => (
          <CarouselOddsBtn
            key={o.label}
            label={o.label}
            value={o.value}
            selId={o.selId}
            onClick={o.sel ? () => toggleSelection(o.sel!) : undefined}
          />
        ))}
      </div>

      {/* Nav arrows */}
      {top.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors"
            onClick={prev}
          >
            <CaretLeftIcon size={18} className="text-white" />
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors"
            onClick={next}
          >
            <CaretRightIcon size={18} className="text-white" />
          </button>
        </>
      )}

      {/* Dots */}
      {top.length > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 flex">
          {top.map((_, i) => (
            <button
              key={i}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setCurrent(i)}
            >
              <span
                className={`block w-2 h-2 rounded-full transition-colors ${
                  i === current ? "bg-white" : "bg-white/30"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MatchCarouselSkeleton() {
  return (
    <div className="rounded-12 overflow-hidden bg-btn-primary">
      <div className="px-6 py-5 space-y-4">
        <div className="h-3 w-32 rounded bg-white/20 animate-pulse" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 animate-pulse" />
            <div className="h-5 w-24 rounded bg-white/20 animate-pulse" />
          </div>
          <div className="h-4 w-6 rounded bg-white/20 animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-5 w-24 rounded bg-white/20 animate-pulse" />
            <div className="w-10 h-10 rounded-full bg-white/20 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-8 bg-white/20 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
