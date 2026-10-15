"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";

// ─── Switcher (二级 Tab) ─────────────────────────────────────────────────────
// PC: C3 [2116:112935] — Active / Settled
// H5: H5 [2116:118114]

export type BetsView = "active" | "settled";

interface BetsSwitcherProps {
  activeView: BetsView;
  onViewChange: (view: BetsView) => void;
}

const VIEWS: { key: BetsView; i18nKey: string }[] = [
  { key: "active", i18nKey: "viewActive" },
  { key: "settled", i18nKey: "viewSettled" },
];

function BetsSwitcher({ activeView, onViewChange }: BetsSwitcherProps) {
  const t = useTranslations("portfolio");

  return (
    // @figma-hardcoded: #111114 fill/fill/input1 — pending design token
    <div className="flex items-center p-[4px] rounded-100 bg-[#111114] border border-secondary h-auto w-fit">
      {VIEWS.map(({ key, i18nKey }) => {
        const isActive = activeView === key;
        return (
          <button
            key={key}
            className={`w-[120px] h-[28px] lg:h-[36px] rounded-100 text-[12px] lg:text-[14px] font-bold leading-[19px] border-0 cursor-pointer touch-manipulation transition-all ${
              isActive
                ? "bg-white text-[#04060c]"
                : "bg-transparent text-secondary hover:text-primary"
            }`}
            onClick={() => onViewChange(key)}
          >
            {t(i18nKey)}
          </button>
        );
      })}
    </div>
  );
}

export default memo(BetsSwitcher);
