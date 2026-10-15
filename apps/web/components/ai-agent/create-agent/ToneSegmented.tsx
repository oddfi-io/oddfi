"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { AgentTone } from "@/stores/aiAgentStore";

interface ToneSegmentedProps {
  value: AgentTone;
  onChange: (next: AgentTone) => void;
  /** 容器覆写（DD-135 H5 设置页用 h-[40px]，设计稿 7973:128837）。 */
  className?: string;
}

const TONE_KEYS: AgentTone[] = ["rational", "companion", "aggressive", "strict"];

/**
 * AI 类型 segmented（DD-106 v3 · Figma 6566:138613）。
 *
 * 视觉与 [[SegmentedChips]] / [[PillSwitcher]] 都不同：
 *   - 容器：h-48 rounded-8 + border `#212124` + p-1 + gap-2
 *   - 按钮：rounded-6 flex-1
 *   - 选中态：`bg-tag-brand`（mint 10% 半透明）+ 文字 `text-brand-default`
 *   - 未选中：透明背景 + `text-secondary`
 *
 * 文案走 i18n（aiAgent.wizard.step1.tones）。
 */
export function ToneSegmented({ value, onChange, className }: ToneSegmentedProps) {
  const t = useTranslations("aiAgent.wizard.step1.tones");
  return (
    <div
      role="radiogroup"
      aria-label="AI tone"
      // @figma-hardcoded: border #212124 line/border-secondary — pending design token
      // overflow-x-auto 兜底：4 个 tone 一屏均分优先（设计稿 7973:128835），长文案 locale 放不下时手势横滚，
      // 禁止把内容溢出传给父级（DD-135 验收：H5 设置页曾因此整页横滚）
      className={cn(
        "scrollbar-hide flex h-12 w-full items-center gap-[2px] overflow-x-auto rounded-lg border border-solid border-[#212124] p-1",
        className
      )}
    >
      {TONE_KEYS.map((key) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            style={{ touchAction: "manipulation" }}
            className={cn(
              // min-w-fit + px-2（原 px-6）：flex-1 均分但不被压到文字截断；4×(文字+16px) ≤ 容器宽时一屏全显
              "flex h-full min-w-fit flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border-0 bg-transparent px-2 py-[6px] text-sm font-medium leading-[18px] transition",
              active && "bg-tag-brand text-brand-default",
              !active && "text-secondary hover:text-primary"
            )}
          >
            {t(key)}
          </button>
        );
      })}
    </div>
  );
}
