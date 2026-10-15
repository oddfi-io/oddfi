"use client";

/**
 * Wizard Tab 5「用量」（DD-109 · Figma 6644:142722）。
 *
 * 全部硬编码 — V1 demo 演示，V2 接后端 credits API 时改造为读 store / fetch。
 * 内容：
 *   - Credits 用量：余额 347 / 本月消耗 512（2 个 stat card）
 *   - 低余额横幅：图标 + 描述 + 充值 / 升级 VIP 双按钮
 *   - 等级与 Credits 折扣表格：6 行（普通 → VIP 5），VIP 3 高亮 brand 当前用户
 *   - 底部说明：基础消耗 + 折扣公式
 */

import { useTranslations } from "next-intl";
import { WarningIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

interface Step5UsageProps {
  /**
   * "card"（默认）= PC 自带卡片 chrome；
   * "plain" = DD-135 H5 设置大卡片内嵌：去自身 chrome，分区 px-4，divider 用可见的 #212124。
   */
  variant?: "card" | "plain";
}

interface VipTier {
  key: string;
  name: string;
  rate: string;
  unit: string;
  save: string;
  /** 当前等级（brand 高亮整行） */
  isCurrent?: boolean;
  /** 「节省」列高亮 brand 色（非"-"且不是当前行） */
  saveHighlight?: boolean;
}

const VIP_TIERS: readonly VipTier[] = [
  { key: "normal", name: "Normal", rate: "1.00x", unit: "0.0100 USD", save: "-" },
  {
    key: "vip1",
    name: "VIP 1",
    rate: "0.95x",
    unit: "0.0095 USD",
    save: "5%",
    saveHighlight: true,
  },
  {
    key: "vip2",
    name: "VIP 2",
    rate: "0.90x",
    unit: "0.0090 USD",
    save: "10%",
    saveHighlight: true,
  },
  { key: "vip3", name: "VIP 3", rate: "0.85x", unit: "0.0085 USD", save: "15%", isCurrent: true },
  {
    key: "vip4",
    name: "VIP 4",
    rate: "0.80x",
    unit: "0.0080 USD",
    save: "20%",
    saveHighlight: true,
  },
  {
    key: "vip5",
    name: "VIP 5",
    rate: "0.70x",
    unit: "0.0070 USD",
    save: "30%",
    saveHighlight: true,
  },
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg bg-tertiary p-3 min-w-0">
      <p className="text-[12px] leading-[18px] text-secondary">{label}</p>
      <p className="text-[16px] font-bold leading-6 text-primary">{value}</p>
    </div>
  );
}

export function Step5Usage({ variant = "card" }: Step5UsageProps = {}) {
  const t = useTranslations("aiAgent.wizard.step5");
  const plain = variant === "plain";
  const sectionPx = plain ? "px-4" : "px-6";

  return (
    // @figma-hardcoded: border #212124 line/border-secondary — pending design token
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        !plain && "rounded-2xl border border-secondary bg-secondary py-6"
      )}
    >
      {/* ── Credits 用量 ── */}
      <div className={cn("flex flex-col gap-4", sectionPx)}>
        <h3 className="text-[16px] font-medium leading-6 text-primary">
          {t("creditsUsage.title")}
        </h3>
        <div className="flex gap-4">
          <StatCard label={t("creditsUsage.balance")} value="347" />
          <StatCard label={t("creditsUsage.monthlyConsumption")} value="512" />
        </div>

        {/* 低余额横幅 */}
        <div className="flex items-center justify-between rounded-lg bg-tertiary p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <WarningIcon size={18} weight="bold" className="text-primary" />
              <p className="text-[14px] font-bold leading-[18px] text-primary">
                {t("lowBalance.title")}
              </p>
            </div>
            <p className="text-[12px] leading-[18px] text-secondary">{t("lowBalance.desc")}</p>
          </div>
          {/* CTA 按钮：min-w 自适应（原固定 w-[78px] 在英文 locale 撑破换行）+ nowrap，文案随 locale 伸缩 */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="flex h-8 min-w-[64px] cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border-0 bg-fn-brand px-3 text-[12px] font-medium leading-[18px] text-static-black transition hover:opacity-90"
            >
              {t("lowBalance.deposit")}
            </button>
            <button
              type="button"
              className="flex h-8 min-w-[64px] cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border-0 bg-white px-3 text-[12px] font-medium leading-[18px] text-static-black transition hover:opacity-90"
            >
              {t("lowBalance.upgrade")}
            </button>
          </div>
        </div>
      </div>

      {/* @figma-hardcoded: #212124 divider line/border-secondary — pending design token（plain 时保证在 bg-secondary 大卡片上可见） */}
      <div className={cn("h-px w-full", plain ? "bg-[#212124]" : "bg-secondary")} />

      {/* ── 等级与 Credits 折扣 ── */}
      <div className={cn("flex flex-col gap-4", sectionPx)}>
        <div className="flex flex-col gap-1">
          <h3 className="text-[16px] font-medium leading-6 text-primary">{t("tiers.title")}</h3>
          <p className="text-[12px] leading-[18px] text-tertiary">{t("tiers.subtitle")}</p>
        </div>

        {/* 表格 */}
        <div className="flex flex-col overflow-clip rounded-xl border border-secondary text-[12px] leading-[18px]">
          {/* Header row */}
          <div className="flex h-10 items-center justify-between bg-tertiary px-4 text-secondary">
            <p className="min-w-0 flex-1">{t("tiers.tableHeader.level")}</p>
            <p className="min-w-0 flex-1">{t("tiers.tableHeader.rate")}</p>
            <p className="min-w-0 flex-1">{t("tiers.tableHeader.unit")}</p>
            <p className="w-[36px] shrink-0 text-right">{t("tiers.tableHeader.save")}</p>
          </div>
          {VIP_TIERS.map((tier) => (
            <div
              key={tier.key}
              className={[
                "flex h-12 items-center justify-between border-b border-secondary px-4 font-medium last:border-b-0",
                tier.isCurrent ? "bg-tag-brand text-brand-default" : "text-primary",
              ].join(" ")}
            >
              <p className="min-w-0 flex-1">
                {tier.name}
                {tier.isCurrent && <span className="ml-1">{t("tiers.you")}</span>}
              </p>
              <p className="min-w-0 flex-1">{tier.rate}</p>
              <p className="min-w-0 flex-1">{tier.unit}</p>
              <p
                className={[
                  "w-[36px] shrink-0 text-right",
                  !tier.isCurrent && tier.saveHighlight ? "text-brand-default" : "",
                ].join(" ")}
              >
                {tier.save}
              </p>
            </div>
          ))}
        </div>

        {/* 底部说明 */}
        <div className="flex flex-col gap-1 text-[12px] leading-[18px]">
          <p>
            <span className="text-primary">{t("footnote.baseLabel")}</span>
            <span className="text-secondary">{t("footnote.baseDesc")}</span>
          </p>
          <p className="text-secondary">
            {t("footnote.formulaPrefix")}
            <span className="text-brand-default">{t("footnote.formulaHighlight")}</span>
            {t("footnote.formulaSuffix")}
          </p>
        </div>
      </div>
    </div>
  );
}
