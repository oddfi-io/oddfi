"use client";

import { useTranslations } from "next-intl";
import { RocketLaunchIcon } from "@phosphor-icons/react";
import { add, mul, formatDisplayAmount } from "@/lib/decimal";
import {
  TIER_SIZE_ODD,
  TIER_COUNT,
  TOTAL_SALE_ODD,
  tierPriceUsd,
} from "../config/tier-sale.config";
import type { UseTierSaleStateResult } from "../hooks/useTierSaleState";

/**
 * DD-146 VaultInfoCard — 左栏「购买 ODD」标题 + 建池条件 + 金库信息卡（Figma 8604:53586）。
 *
 * 接 useTierSaleState（链上派生）：已售出 ODD / 当前档位 / 距建池还差 / 建池进度。
 * 「金库池余额(累计募资)」= 按阶梯定价对已售 ODD 积分得到的累计募资 USD（cumulativeRaisedUsd）。
 * 金额一律 decimal 字符串（禁原生 float）；展示用 formatDisplayAmount 千分位。
 */

/**
 * 按 10 档阶梯定价，对已售 ODD 积分得累计募资 USD。
 * 逐档：第 k 档卖出量 × (k×$0.01)，最后一档取剩余部分。纯字符串运算，可单测。
 */
export function cumulativeRaisedUsd(totalSoldOdd: string): string {
  let remaining = Number(totalSoldOdd);
  if (!(remaining > 0)) return "0";
  let raised = "0";
  for (let tier = 1; tier <= TIER_COUNT && remaining > 0; tier++) {
    const inTier = Math.min(remaining, TIER_SIZE_ODD);
    raised = add(raised, mul(tierPriceUsd(tier), String(inTier)));
    remaining -= inTier;
  }
  return raised;
}

export default function VaultInfoCard({
  saleState,
}: {
  saleState: UseTierSaleStateResult["saleState"];
}) {
  const t = useTranslations("token");

  const soldOdd = saleState?.totalSoldOdd ?? "0";
  const raisedUsd = cumulativeRaisedUsd(soldOdd);
  // 距建池还差 = 全量发售(30M) - 已售
  const toPoolGap = saleState ? String(Math.max(0, TOTAL_SALE_ODD - Number(soldOdd))) : "0";
  const progressPct = saleState ? Number(saleState.poolProgressPct) : 0;
  const fillPct = Math.max(0, Math.min(100, progressPct));

  return (
    <div className="flex w-full flex-col gap-6 md:flex-1">
      {/* 标题 */}
      <div className="flex items-center gap-5">
        <RocketLaunchIcon weight="fill" className="size-9 shrink-0 text-brand-default" />
        <h2 className="text-center font-orbitron text-[32px] font-bold tracking-[-1px] text-primary md:text-[48px] md:leading-[64px] md:tracking-[-1.44px]">
          {t("vault.title")}
        </h2>
      </div>

      {/* 建池条件 */}
      <p className="text-[16px] font-medium leading-[24px] text-secondary md:text-[18px] md:leading-[26px]">
        {t.rich("vault.subtitle", {
          amount: formatDisplayAmount(String(TOTAL_SALE_ODD), 0),
          pct: saleState ? `${saleState.poolProgressPct}%` : "--",
          mint: (chunks) => <span className="text-brand-default">{chunks}</span>,
        })}
      </p>

      {/* 金库信息卡 */}
      <div className="panel-gradient-border flex w-full flex-col gap-6 rounded-3xl p-6">
        <h3 className="text-[20px] font-bold leading-7 text-primary">{t("vault.infoTitle")}</h3>

        <div className="flex w-full flex-col gap-4">
          <InfoRow
            label={t("vault.poolBalance")}
            value={`$${formatDisplayAmount(raisedUsd, 0)}`}
            highlight
          />
          <InfoRow label={t("vault.soldOdd")} value={formatDisplayAmount(soldOdd, 0)} />
          <InfoRow
            label={t("vault.currentTier")}
            value={
              saleState
                ? t("vault.currentTierValue", {
                    n: saleState.currentTier,
                    price: saleState.currentTierPriceUsd,
                  })
                : "--"
            }
          />
          <InfoRow
            label={t("vault.toPoolGap")}
            value={t("vault.toPoolGapValue", { amount: formatDisplayAmount(toPoolGap, 0) })}
          />

          {/* 建池进度 */}
          <div className="flex w-full flex-col gap-3">
            <div className="flex w-full items-center justify-between text-[14px]">
              <span className="text-secondary">{t("vault.poolProgress")}</span>
              <span className="font-medium text-primary">
                {progressPct}% / <span className="text-secondary">100%</span>
              </span>
            </div>
            <div className="h-[5px] w-full overflow-hidden rounded-[100px] bg-tertiary">
              {/* @figma-hardcoded: linear-gradient(178deg,#4ae7dd 42%,#eaea32 92%) pool-progress-fill — pending design token */}
              <div
                className="h-full rounded-[100px] transition-[width] duration-300"
                style={{
                  width: `${fillPct}%`,
                  backgroundImage: "linear-gradient(178deg, #4ae7dd 42%, #eaea32 92%)",
                }}
              />
            </div>
            <p className="text-[12px] font-medium leading-[18px] text-secondary">
              {t("vault.note")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <span className="text-[14px] text-secondary">{label}</span>
      <span
        className={`text-[16px] font-medium leading-6 ${highlight ? "text-brand-default" : "text-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}
