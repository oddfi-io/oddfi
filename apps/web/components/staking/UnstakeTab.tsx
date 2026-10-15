// [TEMP:staking] Temporary — will be replaced when backend staking API is ready
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StakingPosition, HistoryRecord } from "./types";
import PositionCard from "./PositionCard";
import HistorySection from "./HistorySection";
import Skeleton from "@/components/ui/Skeleton";

interface UnstakeTabProps {
  positions: StakingPosition[];
  history: HistoryRecord[];
  isConnected: boolean;
  onUnstake: (position: StakingPosition) => void;
  /** 正在 unstake 的 positionId（用于 PositionCard 显示自身 spinner） */
  pendingUnstakeId?: string;
  /** 质押刚成功、等待链下索引回填新仓位（在列表顶部显示骨架占位） */
  syncing?: boolean;
}

type SubTab = "staking" | "history";

export default function UnstakeTab({
  positions,
  history,
  isConnected,
  onUnstake,
  pendingUnstakeId,
  syncing = false,
}: UnstakeTabProps) {
  const t = useTranslations("staking");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("staking");

  const emptyState = (
    <div className="text-center py-16">
      <p className="text-secondary text-[16px]">{t("connectWalletToView")}</p>
    </div>
  );

  // 同步占位：footprint 对齐 PositionCard，等新仓位入库期间顶部展示
  const syncingPlaceholder = (
    <div className="border border-divider-light rounded-8">
      <div className="flex flex-col gap-[16px] px-[16px] py-[20px]">
        <Skeleton className="h-[26px] w-[160px]" />
        <div className="border-t border-divider-light" />
        <div className="flex items-start gap-[16px]">
          <Skeleton className="h-[18px] w-[100px]" />
          <Skeleton className="h-[18px] w-[80px]" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-[16px] md:gap-[20px]">
      {/* Sub-tabs 行 */}
      <div className="flex items-center gap-[24px]">
        <button
          type="button"
          onClick={() => setActiveSubTab("staking")}
          className={`text-[16px] transition-colors ${
            activeSubTab === "staking" ? "font-bold text-primary" : "font-medium text-secondary"
          }`}
          style={{ touchAction: "manipulation" }}
        >
          {t("tabMyStaking")}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("history")}
          className={`text-[16px] transition-colors ${
            activeSubTab === "history" ? "font-bold text-primary" : "font-medium text-secondary"
          }`}
          style={{ touchAction: "manipulation" }}
        >
          {t("tabHistory")}
        </button>
      </div>

      {/* 内容区 */}
      {activeSubTab === "staking" && (
        <div className="flex flex-col gap-[14px] md:gap-[16px]">
          {/* UserStakeStats 暂时隐藏：Figma 设计稿未覆盖此区域，等设计师补稿后再启用。
              组件 + 测试保留在 components/staking/UserStakeStats.tsx 供后续接入。 */}
          {!isConnected ? (
            emptyState
          ) : positions.length === 0 && !syncing ? (
            <div className="text-center py-16">
              <p className="text-secondary text-[16px]">{t("noActivePositions")}</p>
              <p className="text-secondary text-[14px] mt-[4px] opacity-60">{t("stakeToEarn")}</p>
            </div>
          ) : (
            <>
              {syncing && syncingPlaceholder}
              {positions.map((pos) => (
                <PositionCard
                  key={pos.id}
                  position={pos}
                  onUnstake={() => onUnstake(pos)}
                  pendingUnstakeId={pendingUnstakeId}
                />
              ))}
            </>
          )}
        </div>
      )}

      {activeSubTab === "history" &&
        (isConnected ? <HistorySection records={history} /> : emptyState)}
    </div>
  );
}
