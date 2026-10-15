"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import BetRow from "./BetRow";
import SortHeader from "@/components/portfolio/common/SortHeader";
import type { PortfolioBet } from "@/types/portfolio";
import type { BetsSortColumn, BetsSortState } from "./bets-sort";

// ─── ActiveBetsTable (PC) ────────────────────────────────────────────────────
// Figma C4 [1683:79889] — Table header: border-b border-divider, h-72
// Figma C5 [1689:80484] — Table rows

interface ActiveBetsTableProps {
  bets: PortfolioBet[];
  sort?: BetsSortState;
  onSortChange?: (column: BetsSortColumn) => void;
}

function ActiveBetsTable({ bets, sort, onSortChange }: ActiveBetsTableProps) {
  const t = useTranslations("portfolio");
  const activeColumn = sort?.orderBy;
  const sortDir = sort?.sort ?? "desc";
  const handleToggle = (col: BetsSortColumn) => onSortChange?.(col);

  return (
    <div className="w-full border border-secondary rounded-16 overflow-hidden">
      {/* Table Header — Figma: border-b border-secondary h-[72px] */}
      <div className="border-b border-secondary flex items-center h-[72px]">
        <div className="w-[444px] shrink-0 px-[44px]">
          <span className="text-[14px] font-normal text-secondary leading-[19px]">
            {t("colMarket")}
          </span>
        </div>
        <SortHeader<BetsSortColumn>
          label={t("colBet")}
          column="amount"
          activeColumn={activeColumn}
          sort={sortDir}
          onToggle={handleToggle}
          className="flex-1"
        />
        <SortHeader<BetsSortColumn>
          label={t("colPayout")}
          column="payout"
          activeColumn={activeColumn}
          sort={sortDir}
          onToggle={handleToggle}
          className="flex-1"
        />
        <SortHeader<BetsSortColumn>
          label={t("colBetTime")}
          column="created_at"
          activeColumn={activeColumn}
          sort={sortDir}
          onToggle={handleToggle}
          className="flex-1"
        />
        <div className="flex-1 px-[16px]" />
      </div>

      {/* Rows */}
      {bets.map((bet, i) => (
        <BetRow key={bet.id} bet={bet} isLast={i === bets.length - 1} />
      ))}
    </div>
  );
}

export default memo(ActiveBetsTable);
