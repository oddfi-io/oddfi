"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { LendingTab } from "@/types/lending";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import LendingTabSwitcher from "./LendingTabSwitcher";
import BorrowTab from "./BorrowTab";
import RepayTab from "./RepayTab";

export default function LendingPage() {
  const t = useTranslations("lending");
  const [activeTab, setActiveTab] = useState<LendingTab>("borrow");
  const mode = useResponsiveMode();
  const isH5 = mode === "h5";

  if (isH5) {
    return (
      <div className="flex flex-col items-center w-full">
        {/* H5 Header */}
        <div className="flex flex-col gap-[24px] items-center w-full pt-[48px]">
          <div className="flex flex-col gap-[20px] items-start px-[16px] w-full">
            <h1 className="font-orbitron font-bold text-[28px] text-white tracking-[-0.28px] leading-[36px] w-full">
              {t("title")}
            </h1>
            <p className="text-[14px] text-secondary leading-[19px] w-full">{t("description")}</p>
          </div>

          {/* H5 Tab Switcher */}
          <LendingTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} isH5 />
        </div>

        {/* H5 Content */}
        <div className="w-[343px] mt-[24px]">
          {activeTab === "borrow" ? <BorrowTab /> : <RepayTab />}
        </div>
      </div>
    );
  }

  // PC layout
  return (
    <div className="flex justify-center pt-[64px] px-[16px]">
      <div className="w-full max-w-[1200px] flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center gap-[28px] w-full">
          <div className="flex flex-col items-center gap-[16px] w-full">
            <h1 className="font-orbitron font-bold text-[32px] text-white tracking-[-0.32px] leading-[40px]">
              {t("title")}
            </h1>
            <p className="text-[14px] text-secondary leading-[19px] w-full max-w-[510px] text-center">
              {t("description")}
            </p>
          </div>

          {/* Tab Switcher */}
          <LendingTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Content */}
        <div className="w-full mt-[28px]">
          {activeTab === "borrow" ? (
            <div className="flex flex-col gap-[28px]">
              <h2 className="font-orbitron font-bold text-[24px] tracking-[-0.24px] leading-[32px] text-primary">
                {t("availablePositions")}
              </h2>
              <BorrowTab />
            </div>
          ) : (
            <div className="flex flex-col gap-[28px]">
              <h2 className="font-orbitron font-bold text-[24px] tracking-[-0.24px] leading-[32px] text-primary">
                {t("activeBorrows")}
              </h2>
              <RepayTab />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
