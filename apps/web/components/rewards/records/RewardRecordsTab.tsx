"use client";

import { useState } from "react";
import { InfoIcon, XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import EmptyState from "@/components/ui/EmptyState";
import { PillSwitcher } from "@/components/ui/PillSwitcher";
import { REWARD_RECORDS } from "@/lib/rewards/fixtures";
import { getRewardsByStatus } from "@/lib/rewards/selectors";
import type { RewardStatus } from "@/lib/rewards/types";
import { RewardRecordCard } from "./RewardRecordCard";

/**
 * RewardRecordsTab —— 我的奖励 Tab（Figma PC 9003:160075 · H5 9021:165675）。
 * PillSwitcher（待领取/已领取/已过期 + 数量）+ 到账说明 notice + 记录卡列表 / EmptyState。
 * status 切换为本地 useState；列表用 getRewardsByStatus 过滤（DD-150 §3.3/§3.4）。
 */
const STATUSES: RewardStatus[] = ["claimable", "claimed", "expired"];

export function RewardRecordsTab() {
  const t = useTranslations("rewards.records");
  const [status, setStatus] = useState<RewardStatus>("claimable");

  const visible = getRewardsByStatus(REWARD_RECORDS, status);

  return (
    <div className="flex flex-col gap-6">
      <PillSwitcher
        ariaLabel={t("switch.ariaLabel")}
        value={status}
        onChange={(k) => setStatus(k as RewardStatus)}
        containerClassName="max-w-[368px]"
        items={STATUSES.map((s) => ({
          key: s,
          label: (
            <span className="flex items-center gap-1.5">
              {t(`switch.${s}`)}
              <span>{getRewardsByStatus(REWARD_RECORDS, s).length}</span>
            </span>
          ),
        }))}
      />

      {/* 到账说明 notice */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-tag-yellow p-3">
        <div className="flex items-start gap-2">
          <InfoIcon className="h-5 w-5 shrink-0 text-fn-yellow" />
          <p className="text-sm font-medium leading-[18px] text-fn-yellow">{t("notice")}</p>
        </div>
        <XIcon className="hidden h-5 w-5 shrink-0 text-fn-yellow md:block" />
      </div>

      {/* 记录列表 / 空态 */}
      {visible.length > 0 ? (
        <div className="flex flex-col gap-4">
          {visible.map((record) => (
            <RewardRecordCard key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <EmptyState title={t("empty.title")} description={t("empty.desc")} />
      )}
    </div>
  );
}
