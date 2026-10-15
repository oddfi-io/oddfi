"use client";

import { useTranslations } from "next-intl";

import NumberedSection from "@/components/ui/NumberedSection";
import NumberInput from "@/components/ui/NumberInput";
import Toggle from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";
import type { AgentConfig } from "@/stores/aiAgentStore";

import { RiskSlider } from "./RiskSlider";

interface Step2BehaviorProps {
  draft: AgentConfig;
  onChange: (patch: Partial<AgentConfig>) => void;
  /**
   * "card"（默认）= PC 自带卡片 chrome（bg-secondary + border + py-6 + px-6 分区）；
   * "plain" = DD-135 H5 设置大卡片内嵌：去自身 chrome，分区 px-4（设计稿 px-16）。
   */
  variant?: "card" | "plain";
}

/**
 * Wizard Tab 2 「行为」（DD-106 v3 · Figma 6566:138689）。
 *
 * 三段被同一 form card（bg-secondary + border #212124 + py-6）包裹，section 间用通栏 divider 分隔：
 *   1. 风险偏好 → RiskSlider 卡片
 *   2. 通常单注金额 → number input（bg-fill-input-modal）
 *   3. 节制器（Tilt 反向劝阻）→ 标题/副标题 row 布局 + 右侧 Toggle
 *
 * 字段映射：minStake 复用为「通常单注金额」语义；allowAutoBet 复用为「节制器」开关
 *（store schema 不变，只 UI copy 跟 Figma；详见 DD-106 §3.3 字段语义注脚）。
 */
export function Step2Behavior({ draft, onChange, variant = "card" }: Step2BehaviorProps) {
  const t = useTranslations("aiAgent.wizard.step2");
  const plain = variant === "plain";
  const sectionPx = plain ? "px-4" : "px-6";
  return (
    // @figma-hardcoded: border #212124 line/border-secondary — pending design token
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        !plain && "rounded-2xl border border-solid border-[#212124] bg-secondary py-6"
      )}
    >
      <div className={sectionPx}>
        <NumberedSection
          index={1}
          hideIndex={plain}
          title={t("risk.title")}
          subtitle={t("risk.subtitle")}
        >
          <RiskSlider
            value={draft.riskPreference}
            onChange={(riskPreference) => onChange({ riskPreference })}
          />
        </NumberedSection>
      </div>

      {/* @figma-hardcoded: divider 通栏（无水平 margin），色 #212124 与 card border 同源 */}
      <div aria-hidden className="h-px w-full bg-[#212124]" />

      <div className={sectionPx}>
        <NumberedSection
          index={2}
          hideIndex={plain}
          title={t("stake.title")}
          subtitle={t("stake.subtitle")}
        >
          <NumberInput
            value={draft.minStake}
            onChange={(minStake) => onChange({ minStake })}
            integerOnly
            min={0}
            placeholder="1000"
            ariaLabel={t("stake.ariaLabel")}
            // Figma 6566:138729: bg fill/fill/input2 (#212124)
            className="bg-fill-input-modal"
          />
          <p className="text-xs leading-[18px] text-tertiary">{t("stake.hint")}</p>
        </NumberedSection>
      </div>

      <div aria-hidden className="h-px w-full bg-[#212124]" />

      {/*
        节制器 row：Figma 6566:138732 标题/副标题在左，Switch 在右，垂直居中。
        不复用 NumberedSection（它是 vertical title → subtitle → children，与设计稿 row 布局不符）。
      */}
      <section className={cn("flex items-center justify-between", sectionPx)}>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-medium leading-6 text-primary">{t("control.title")}</h3>
          <p className="text-xs leading-[18px] text-tertiary">{t("control.subtitle")}</p>
        </div>
        <Toggle
          checked={draft.allowAutoBet}
          onChange={(allowAutoBet) => onChange({ allowAutoBet })}
          ariaLabel={t("control.ariaLabel")}
        />
      </section>
    </div>
  );
}
