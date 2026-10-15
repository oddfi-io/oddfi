"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import MatchCard from "./MatchCard";
import SearchEmptyState from "./SearchEmptyState";
import { getFixtureStatus } from "@/lib/fixture-state";
import type { SportmonksFixture } from "@/types/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface H5SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  fixtures: SportmonksFixture[];
  locale: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function H5SearchOverlay({
  isOpen,
  onClose,
  fixtures,
  locale,
}: H5SearchOverlayProps) {
  const t = useTranslations("markets");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query and focus input when overlay opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Popular events: take first 3 live/upcoming fixtures
  const popularFixtures = useMemo(() => {
    return fixtures
      .filter((f) => {
        const status = getFixtureStatus(f.state_id);
        return status === "live" || status === "upcoming";
      })
      .slice(0, 3);
  }, [fixtures]);

  // Search results: filter by team name or league name
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return fixtures
      .filter((f) => {
        const status = getFixtureStatus(f.state_id);
        return status === "live" || status === "upcoming";
      })
      .filter(
        (f) =>
          f.participants.some((p) => p.name.toLowerCase().includes(q)) ||
          f.league?.name?.toLowerCase().includes(q)
      );
  }, [fixtures, query]);

  const handleClear = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (fixtureId: number) => {
      onClose();
      router.push(`/${locale}/markets/fixture/${fixtureId}`);
    },
    [onClose, router, locale]
  );

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // Determine which state to show
  const hasQuery = query.trim().length > 0;
  const hasResults = searchResults.length > 0;

  return (
    // Full-screen overlay — only visible on H5 (lg:hidden)
    <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-primary overflow-hidden">
      {/* ── Search bar row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-6 shrink-0">
        {/* Input */}
        <div className="flex flex-1 items-center gap-2 h-9 px-3 rounded-8 bg-fill-input border-[0.5px] border-dt-hover backdrop-blur-[15px]">
          <MagnifyingGlassIcon size={20} className="text-secondary shrink-0" />

          {/* Brand divider */}
          <div className="w-px h-3 bg-fn-brand shrink-0" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            spellCheck={false}
            inputMode="search"
            enterKeyHint="search"
            className="flex-1 min-w-0 bg-transparent text-sm text-primary placeholder:text-tertiary outline-none"
          />

          {/* Clear button */}
          {hasQuery && (
            <button
              type="button"
              onClick={handleClear}
              style={{ touchAction: "manipulation" }}
              className="shrink-0 flex items-center justify-center size-[18px] rounded-full bg-fill-input-modal"
              aria-label="Clear search"
            >
              <XIcon size={12} className="text-secondary" />
            </button>
          )}
        </div>

        {/* Cancel text button */}
        <button
          type="button"
          onClick={handleCancel}
          style={{ touchAction: "manipulation" }}
          className="shrink-0 min-h-[44px] flex items-center text-[13px] leading-[18px] text-brand-default"
        >
          {t("searchCancel")}
        </button>
      </div>

      {/* ── Content area — scrollable ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[env(safe-area-inset-bottom)]">
        {!hasQuery ? (
          /* State 1: Initial — show popular events */
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium text-primary">{t("searchPopularEvents")}</p>
            <div className="flex flex-col gap-3">
              {popularFixtures.map((f) => (
                <MatchCard
                  key={f.id}
                  fixture={f}
                  locale={locale}
                  onClick={() => handleSelect(f.id)}
                />
              ))}
            </div>
          </div>
        ) : hasResults ? (
          /* State 2: Typing with results */
          <div className="flex flex-col gap-3">
            {searchResults.map((f) => (
              <MatchCard
                key={f.id}
                fixture={f}
                locale={locale}
                onClick={() => handleSelect(f.id)}
              />
            ))}
          </div>
        ) : (
          /* State 3: No results */
          <SearchEmptyState />
        )}
      </div>
    </div>
  );
}
