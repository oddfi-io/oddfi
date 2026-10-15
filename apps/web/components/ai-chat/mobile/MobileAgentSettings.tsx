"use client";

/**
 * MobileAgentSettings — H5 Agent 设置视图（DD-135 · Figma 7973:128451 / 7973:128811 / 7973:131900）。
 *
 * 在 MobileAiChatSheet 内以二级视图承载（DD-135 D1：替换 chat/news 内容，与 PC 中央列切换同构）。
 * 整页是**一张大卡片**（Figma 7973:128811：bg-secondary + py-16）。验收调整（2026-06-06）：
 * 卡片不再自画 border/圆角/8px 间隙，而是负 margin 顶满 sheet —— 边框与圆角由 MobileBottomSheet
 * 自身的 border-secondary(#212124) + rounded-t-16 承担（同色同圆角，消除双层 chrome 与缝隙）。
 * -mt-[12px] 吃掉 drag handle 行高（handle sticky z-10 仍浮在卡片上方可拖拽）；
 * rounded-t-[14px] = sheet 外圆角 16 - border 2，贴合 sheet 内缘不露方角。
 * 标题行 / chips / 内容 / 底部按钮全部在卡片内，分区用通栏 divider：
 *   - 标题行（7973:129454）：24px sparkle + 「Agent 设置」16/24 Medium + 右侧 IconBtn 关闭（回聊天视图）
 *   - AgentSettingsChips：5 chips 横向滚动切换
 *   - 内容区：基础 tab 走 H5 专属 MobileAgentBasics（疑点 2 布局差异大）；
 *     行为/推送/记忆/用量复用 PC Step2-5（variant="plain" 去嵌套 card chrome），
 *     draft 来自 useAgentConfigDraft，与 PC 行为零漂移
 *   - 底部（7973:131900）：重置（secondary 底 + border）/ 保存（白底黑字）各 flex-1 h-48 rounded-12
 *
 * 切 chips 不丢未保存 draft；关闭设置回 chat 的 draft 丢弃语义与 PC 切走一致（不强制确认）。
 */

import { XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { useAgentConfigDraft } from "@/hooks/useAgentConfigDraft";
import type { ConfigTab } from "@/components/ai-agent/AgentConfigTabs";
import { Step2Behavior } from "@/components/ai-agent/create-agent/Step2Behavior";
import { Step3Notify } from "@/components/ai-agent/create-agent/Step3Notify";
import { Step4Memory } from "@/components/ai-agent/create-agent/Step4Memory";
import { Step5Usage } from "@/components/ai-agent/create-agent/Step5Usage";

import { AgentSettingsChips } from "./AgentSettingsChips";
import { MobileAgentBasics } from "./MobileAgentBasics";

const FOOTER_BTN_BASE =
  "flex h-[48px] flex-1 cursor-pointer items-center justify-center rounded-[12px] px-[16px] text-[14px] font-medium leading-[18px] transition";

interface MobileAgentSettingsProps {
  activeTab: ConfigTab;
  onTabChange: (tab: ConfigTab) => void;
  /** 关闭设置视图 → 回到聊天视图。 */
  onClose: () => void;
}

export function MobileAgentSettings({ activeTab, onTabChange, onClose }: MobileAgentSettingsProps) {
  const t = useTranslations("aiAgent.wizard");
  const { draft, dirty, patchDraft, handleSave, handleReset } = useAgentConfigDraft();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-primary">
      {/* 设置大卡片（Figma 7973:128811）— 顶满 sheet，边框/圆角复用 sheet 自身 chrome（见文件头注释） */}
      <div className="-mt-[12px] flex min-h-0 flex-1 flex-col gap-[16px] rounded-t-[14px] bg-secondary py-[16px]">
        {/* 标题行 + chips（Figma 7973:129454 · px-16 gap-16） */}
        <header className="flex shrink-0 flex-col gap-[16px] px-[16px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[8px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/ai-agent/sparkle-24.svg"
                alt=""
                width={24}
                height={24}
                className="block shrink-0"
              />
              <h2 className="text-[16px] font-medium leading-[24px] text-primary">
                {t("settingsTitle")}
              </h2>
            </div>
            {/* 关闭（44px 热区包 24px 视觉，镜像抽屉关闭钮规范） */}
            <button
              type="button"
              aria-label="Close settings"
              onClick={onClose}
              style={{ touchAction: "manipulation" }}
              className="-mr-[10px] flex size-[44px] cursor-pointer items-center justify-center border-0 bg-transparent"
            >
              <span className="flex size-[24px] items-center justify-center rounded-[6px] bg-fill-input-modal transition-colors hover:bg-fill-hover">
                <XIcon size={16} className="text-primary" />
              </span>
            </button>
          </div>
          <AgentSettingsChips activeTab={activeTab} onSelect={onTabChange} />
        </header>

        {/* chips 下通栏 divider（各 tab 内容顶部统一由此分隔） */}
        {/* @figma-hardcoded: divider 通栏 #212124 line/border-secondary — pending design token */}
        <div aria-hidden className="h-px w-full shrink-0 bg-[#212124]" />

        {/* 内容区（卡片内滚动；各 tab plain 变体自带 px-16 分区 + 通栏 divider）。
            overflow-x-hidden 防御：overflow-y-auto 会把 overflow-x 计算成 auto，
            任何子元素横向溢出都会让整页可横滚（DD-135 验收实测），显式锁死 */}
        <div data-scroll-content className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {activeTab === "basics" && <MobileAgentBasics draft={draft} onChange={patchDraft} />}
          {activeTab === "behavior" && (
            <Step2Behavior variant="plain" draft={draft} onChange={patchDraft} />
          )}
          {activeTab === "notify" && (
            <Step3Notify variant="plain" draft={draft} onChange={patchDraft} />
          )}
          {activeTab === "memory" && (
            <Step4Memory variant="plain" draft={draft} onChange={patchDraft} />
          )}
          {activeTab === "usage" && <Step5Usage variant="plain" />}
        </div>

        {/* 底部按钮组（Figma 7973:131900 · gap-8 px-16，卡片内底部） */}
        <footer className="flex shrink-0 items-center gap-[8px] px-[16px]">
          <button
            type="button"
            onClick={handleReset}
            style={{ touchAction: "manipulation" }}
            className={`${FOOTER_BTN_BASE} border border-divider bg-secondary text-primary hover:bg-tertiary`}
          >
            {t("actions.reset")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty}
            style={{ touchAction: "manipulation" }}
            className={`${FOOTER_BTN_BASE} border-0 bg-white text-static-black hover:opacity-90 disabled:cursor-not-allowed disabled:bg-tertiary disabled:text-tertiary`}
          >
            {t("actions.save")}
          </button>
        </footer>
      </div>
    </div>
  );
}
