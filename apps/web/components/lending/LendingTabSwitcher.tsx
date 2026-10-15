"use client";

import { useTranslations } from "next-intl";
import type { LendingTab } from "@/types/lending";

interface LendingTabSwitcherProps {
  activeTab: LendingTab;
  onTabChange: (tab: LendingTab) => void;
  isH5?: boolean;
}

const tabKeys: LendingTab[] = ["borrow", "repay"];

export default function LendingTabSwitcher({
  activeTab,
  onTabChange,
  isH5 = false,
}: LendingTabSwitcherProps) {
  const t = useTranslations("lending");
  const labelMap: Record<LendingTab, string> = {
    borrow: t("tabBorrow"),
    repay: t("tabRepay"),
  };

  return (
    <div
      className={`flex items-center rounded-full border border-secondary bg-fill-input p-[4px] ${
        isH5 ? "w-[343px] h-[44px]" : "w-[306px] h-[48px]"
      }`}
    >
      {tabKeys.map((key) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`flex-1 h-full rounded-full text-[14px] font-semibold transition-colors min-h-[44px] ${
              isActive ? "bg-btn-primary-white text-static-black" : "bg-transparent text-secondary"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            {labelMap[key]}
          </button>
        );
      })}
    </div>
  );
}
