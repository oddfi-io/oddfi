"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { AgentConfig } from "@/stores/aiAgentStore";
import { useAiAgentStore } from "@/stores/aiAgentStore";

interface Step4MemoryProps {
  /** 未使用：memorySummary 是即时生效的破坏性操作，不走 wizard draft（DD-106 §3.3），保留可选位仅为与 Step1-3 调用形态对齐。 */
  draft?: AgentConfig;
  /** 未使用：同上，本 step 直接读写 aiAgentStore。 */
  onChange?: (patch: Partial<AgentConfig>) => void;
  /**
   * "card"（默认）= PC 自带卡片 chrome；
   * "plain" = DD-135 H5 设置大卡片内嵌：去自身 chrome，分区 px-4，按钮 flex-1 平分（设计稿 7973:130879）。
   */
  variant?: "card" | "plain";
}

/**
 * Wizard Tab 4 「记忆」（DD-106 v3 · Figma 6566:138824）。
 *
 * 与其他 step 不同：本段不通过 wizard draft 传递 —— memorySummary 是 store 内的
 * 「AI 学到的认知」字段（V1 用 demo 4 条，V2 接后端 AI 总结），用户「清除记忆」是
 * 立即生效的破坏性操作，不应作为 wizard 草稿。
 *
 * Layout：
 *   - 标题/副标题 group
 *   - 记忆摘要 box（bg #1a1a1c + border #212124，列出 memorySummary）
 *   - 操作 row：查看完整记忆（占位 toast）+ 清除记忆（双击确认 pattern）
 */
export function Step4Memory({ variant = "card" }: Step4MemoryProps) {
  const t = useTranslations("aiAgent.wizard.step4");
  const plain = variant === "plain";
  const memorySummary = useAiAgentStore((s) => s.config.memorySummary);
  const patchConfig = useAiAgentStore((s) => s.patchConfig);
  const clearMemorySummary = useAiAgentStore((s) => s.clearMemorySummary);
  const [confirming, setConfirming] = useState(false);

  // DD-109：任何场景下进入 memory tab 时，若 store 内 memorySummary 为空 → 注入 locale 默认（demo 数据）。
  // V2 后端接入后改为「只在首次注入」并由后端 AI 推到 store，前端不再回填。
  useEffect(() => {
    if (memorySummary.length > 0) return;
    const raw: unknown = t.raw("defaultSummary");
    if (Array.isArray(raw) && raw.every((s) => typeof s === "string")) {
      patchConfig({ memorySummary: raw as string[] });
    }
    // mount-only：仅在挂载时注入；用户「清除记忆」+ 切走 → 切回会重新回填，是 V1 demo 预期行为
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3s 内未二次点击则自动复位「确认清除？」状态
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const handleClear = () => {
    if (confirming) {
      clearMemorySummary();
      toast.success("Memory cleared");
      setConfirming(false);
      return;
    }
    setConfirming(true);
  };

  return (
    // @figma-hardcoded: border #212124 line/border-secondary — pending design token
    <div
      className={cn(
        "flex w-full flex-col",
        !plain && "rounded-2xl border border-solid border-[#212124] bg-secondary py-6"
      )}
    >
      <div className={cn("flex flex-col gap-4", plain ? "px-4" : "px-6")}>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-medium leading-6 text-primary">{t("title")}</h3>
          <p className="text-xs leading-[18px] text-tertiary">{t("subtitle")}</p>
        </div>

        {/* 记忆摘要 box · Figma 6566:138828 */}
        {/* @figma-hardcoded: bg #1a1a1c memory-card-bg，比 bg-secondary (#111114) 略亮一档，pending design token */}
        <div className="flex flex-col gap-3 rounded-lg border border-solid border-[#212124] bg-[#1a1a1c] p-6">
          <p className="text-xs leading-[18px] text-secondary">{t("summaryTitle")}</p>
          {memorySummary.length === 0 ? (
            <p className="text-sm leading-[18px] text-tertiary">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {memorySummary.map((item, i) => (
                <li key={i} className="text-sm leading-[18px] text-primary">
                  • {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 操作 row · Figma 6566:138835 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => toast.info("Full memory view coming soon")}
            // @figma-hardcoded: bg #212124 fill/button/tertiary-btn-default
            className={cn(
              "flex h-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-[#212124] px-4 text-sm font-medium leading-[18px] text-primary transition hover:bg-tertiary",
              plain ? "flex-1" : "w-[120px]"
            )}
          >
            {t("viewFull")}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={memorySummary.length === 0}
            // @figma-hardcoded: bg fill/tag/red (rgba(237,76,82,0.1)) = bg-tag-red token
            className={cn(
              "flex h-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-tag-red px-4 text-sm font-medium leading-[18px] text-red transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
              plain ? "flex-1" : "w-[120px]"
            )}
          >
            {confirming ? t("clearConfirm") : t("clear")}
          </button>
        </div>
      </div>
    </div>
  );
}
