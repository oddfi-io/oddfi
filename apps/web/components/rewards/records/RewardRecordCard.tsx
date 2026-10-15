"use client";

import { useState } from "react";
import { GiftIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { formatDisplayAmount } from "@/lib/decimal";
import { toastSuccess } from "@/lib/toast";
import type { RewardRecord, RewardStatus } from "@/lib/rewards/types";

/**
 * RewardRecordCard —— 奖励记录卡（Figma PC 9003:160132 · H5 9021:165711）。
 * 三态：claimable「领取」白底可点 / claimed「已领取」灰底 + 「已到账」薄荷 tag / expired「已过期」灰底。
 * 纯前端：claimable 点击「领取」→ 本地切 claimed + toast（DD-150 §3.3），不发请求；
 * 后端接入时由 props onClaim(id) 替换。响应式：PC 横向含图标；H5 纵向无图标。
 */
export function RewardRecordCard({ record }: { record: RewardRecord }) {
  const t = useTranslations("rewards.records");
  const [status, setStatus] = useState<RewardStatus>(record.status);

  const handleClaim = () => {
    setStatus("claimed");
    toastSuccess(t("toast.claimed"));
  };

  const title = t(`items.${record.id}.title`);
  const desc = t(`items.${record.id}.desc`);

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-fill-card1 p-4 md:flex-row md:items-center md:gap-4 md:rounded-3xl md:p-10">
      {/* 图标 + 标题 + 日期（PC 横向带图标；H5 纵向无图标） */}
      <div className="flex min-w-0 flex-1 items-center gap-6">
        {/* @figma-hardcoded: rgba(40,244,210,0.2) icon-box fill — pending design token */}
        <div className="hidden size-12 shrink-0 items-center justify-center rounded-lg bg-[rgba(40,244,210,0.2)] md:flex">
          <GiftIcon weight="fill" className="h-8 w-8 text-brand-default" />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3 md:gap-4">
            <span className="font-orbitron text-base font-bold leading-6 text-primary md:text-2xl md:leading-8 md:tracking-[-0.24px]">
              {title}
            </span>
            {status === "claimed" && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-tag-brand px-2 py-0.5 text-[11px] font-medium leading-4 text-brand-default">
                {t("credited")}
              </span>
            )}
          </div>
          <span className="text-xs font-medium leading-[18px] text-secondary md:text-base md:font-normal md:leading-6">
            {record.date} · {desc}
          </span>
        </div>
      </div>

      {/* 金额 + 按钮 */}
      <div className="flex items-center justify-between gap-6 md:justify-end">
        <span className="text-lg font-bold leading-[26px] text-brand-default md:text-xl md:leading-7">
          +{formatDisplayAmount(record.amount, 0)} <span className="text-tertiary">ODD</span>
        </span>
        {status === "claimable" ? (
          <button
            type="button"
            onClick={handleClaim}
            style={{ touchAction: "manipulation" }}
            className="flex h-10 w-[88px] shrink-0 items-center justify-center rounded-lg bg-white text-sm font-medium leading-[18px] text-static-black transition hover:brightness-95"
          >
            {t("actions.claim")}
          </button>
        ) : (
          <span className="flex h-10 w-[88px] shrink-0 items-center justify-center rounded-lg bg-tertiary text-sm font-medium leading-[18px] text-secondary">
            {status === "claimed" ? t("actions.claimed") : t("actions.expired")}
          </span>
        )}
      </div>
    </div>
  );
}
