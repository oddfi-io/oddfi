"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";

// ─── Slide Tab (一级 Tab) ────────────────────────────────────────────────────
// PC: C2 [2116:112931] — Bets / Transactions
// H5: H4 [2116:117811]

export type PortfolioTab = "bets" | "transactions";

interface PortfolioTabsProps {
  activeTab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
}

const TABS: { key: PortfolioTab; i18nKey: string }[] = [
  { key: "bets", i18nKey: "tabBets" },
  { key: "transactions", i18nKey: "tabHistory" },
];

function PortfolioTabs({ activeTab, onTabChange }: PortfolioTabsProps) {
  const t = useTranslations("portfolio");

  return (
    <div className="flex items-center gap-[24px] lg:gap-[32px] border-b border-divider">
      {TABS.map(({ key, i18nKey }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            className={`relative pb-[12px] text-[16px] lg:text-[18px] font-bold leading-[24px] lg:leading-[26px] border-0 bg-transparent cursor-pointer min-h-[44px] touch-manipulation transition-colors ${
              isActive ? "text-primary" : "text-tertiary hover:text-secondary"
            }`}
            style={{ fontFamily: "'Orbitron', sans-serif" }}
            onClick={() => onTabChange(key)}
          >
            {t(i18nKey)}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default memo(PortfolioTabs);
