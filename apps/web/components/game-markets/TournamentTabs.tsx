"use client";

// ─── Tournament Tabs (Figma 2463:115888) ───────────────────────────────────
// H5 only (lg:hidden). Mirrors LeagueSidebar's tournament selection.
// World Cup | UEFA | Other — positioned between ContentTypeTabs and Banner.

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useMarketsLayoutStore, selectSelectedTournament } from "@/stores/marketsLayoutStore";
import {
  VISIBLE_TOURNAMENT_CONFIGS,
  type TournamentKey,
} from "@/config/featured/tournament-stages";

export default function TournamentTabs() {
  const t = useTranslations("markets");
  const selectedTournament = useMarketsLayoutStore(selectSelectedTournament);
  const setSelectedTournament = useMarketsLayoutStore((s) => s.setSelectedTournament);

  const handleSelect = useCallback(
    (key: TournamentKey) => setSelectedTournament(key),
    [setSelectedTournament]
  );

  return (
    <div className="flex items-center gap-[24px] h-[40px] px-[16px] border-b border-divider-light lg:hidden">
      {VISIBLE_TOURNAMENT_CONFIGS.map((tc) => {
        const isActive = selectedTournament === tc.key;
        const label = t.has(tc.labelKey) ? t(tc.labelKey) : tc.labelKey;
        return (
          <button
            key={tc.key}
            type="button"
            onClick={() => handleSelect(tc.key)}
            style={{ touchAction: "manipulation" }}
            className={`relative h-full flex items-center text-[12px] font-medium leading-[18px] min-h-[44px] whitespace-nowrap transition-colors ${
              isActive ? "text-brand-default" : "text-tertiary"
            }`}
          >
            {label}
            {isActive && (
              <span className="absolute bottom-0 left-[-2px] right-[-2px] h-[2px] rounded-full bg-fn-orange" />
            )}
          </button>
        );
      })}
    </div>
  );
}
