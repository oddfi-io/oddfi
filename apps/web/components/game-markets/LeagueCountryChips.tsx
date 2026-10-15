"use client";

import { useTranslations } from "next-intl";
import type { LeagueCountryOption } from "@/hooks/useMarketData";
import { useMarketsLayoutStore, selectSelectedLeagueCountryId } from "@/stores/marketsLayoutStore";
import { Chip, ScrollableRow } from "./LeagueChips";

interface LeagueCountryChipsProps {
  leagueCountries: LeagueCountryOption[];
}

export default function LeagueCountryChips({ leagueCountries }: LeagueCountryChipsProps) {
  const t = useTranslations("markets");
  const selectedCountryId = useMarketsLayoutStore(selectSelectedLeagueCountryId);
  const setSelectedCountryId = useMarketsLayoutStore((s) => s.setSelectedLeagueCountryId);

  if (leagueCountries.length === 0) return null;

  // DD-market-chips：国家名由后端 market_chips 直接提供（含白名单外国家的英文 league 名兜底），
  // 不再经前端 getRegionByCountryId 白名单映射（白名单外不再静默丢弃）。
  return (
    <div className="min-h-[36px]">
      <ScrollableRow>
        <Chip
          label={t("chipAllCountries")}
          isActive={selectedCountryId === null}
          onClick={() => setSelectedCountryId(null)}
        />
        {leagueCountries.map((c) => (
          <Chip
            key={c.countryId}
            label={c.name}
            isActive={selectedCountryId === c.countryId}
            onClick={() => setSelectedCountryId(c.countryId)}
          />
        ))}
      </ScrollableRow>
    </div>
  );
}
