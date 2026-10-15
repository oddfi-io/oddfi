"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import PoolsTab from "./PoolsTab";
import PositionsTab from "./PositionsTab";
import GlobalDepositSheet from "@/components/deposit/GlobalDepositSheet";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import ActivityBanner from "@/components/activity-banner/ActivityBanner";
import { useLpRefetchStore } from "@/stores/lpRefetchStore";

// Returns tab 暂时隐藏（DD-090 阶段 Returns 模块 mock，未接入合约）
type Tab = "pools" | "positions";

export default function PoolsPage() {
  const t = useTranslations("pools");
  const [activeTab, setActiveTab] = useState<Tab>("pools");

  // DD-130 问题2：加流动性成功后进入同步态 → 自动切到 Positions tab，
  // 由 PositionTable 显示占位 + 等新仓位入库（与 stake → My Staking 同机制）
  const syncing = useLpRefetchStore((s) => s.syncing);
  useEffect(() => {
    if (syncing) setActiveTab("positions");
  }, [syncing]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "pools", label: t("title") },
    { key: "positions", label: t("tabPositions") },
  ];

  return (
    <div className="min-h-screen bg-primary">
      <div className="mx-auto w-full max-w-[1200px] px-[16px] lg:px-0 pt-[40px] lg:pt-[64px] pb-[48px] lg:pb-[64px]">
        {/* 活动 Banner（DD-145）*/}
        <div className="mb-[28px] lg:mb-[32px]">
          <ActivityBanner tag={t("banner.tag")} lead={t("banner.lead")} body={t("banner.body")} />
        </div>

        {/* Header */}
        <h1 className="font-orbitron text-[28px] lg:text-[32px] font-bold text-primary leading-[40px]">
          {t("pageTitle")}
        </h1>
        <p className="text-[14px] text-secondary mt-[8px]">{t("pageSubtitle")}</p>

        {/* Tab Switcher — H5: full-width flex-1; PC: w-fit fixed 120px each */}
        <div className="mt-[32px] mb-[24px] lg:mb-[42px]">
          <SegmentedTabs
            tabs={tabs}
            value={activeTab}
            onChange={setActiveTab}
            containerClassName="lg:w-fit"
            itemClassName="lg:w-[120px] lg:flex-none"
            ariaLabel={t("pageTitle")}
          />
        </div>

        {/* Tab Content */}
        {activeTab === "pools" && <PoolsTab />}
        {activeTab === "positions" && <PositionsTab />}
      </div>

      <GlobalDepositSheet />
    </div>
  );
}
