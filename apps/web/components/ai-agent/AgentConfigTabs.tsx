"use client";

/**
 * AI Agent 常态化配置内容区（DD-121 优化版）。
 *
 * 历史背景：本组件原为全屏覆盖层（左侧栏点击 5 tab → 蒙层弹出 + 右上 X 关闭）。
 * 优化后：变成 AiChatMainView 中央列的内容视图，左侧栏作为二级导航控制 activeTab，
 *        覆盖层 / X 关闭按钮 / PillSwitcher 内置切换器全部移除。
 *
 * 数据模型：
 *   - activeTab 由父组件（AiChatMainView）controlled 注入
 *   - draft 状态机已提取至 hooks/useAgentConfigDraft（DD-135：PC/H5 双调用方共享，
 *     切 tab 不丢未保存 draft，保存/重置语义两端一致）
 */

import { useTranslations } from "next-intl";

import { useAgentConfigDraft } from "@/hooks/useAgentConfigDraft";
import { Step1Basics } from "./create-agent/Step1Basics";
import { Step2Behavior } from "./create-agent/Step2Behavior";
import { Step3Notify } from "./create-agent/Step3Notify";
import { Step4Memory } from "./create-agent/Step4Memory";
import { Step5Usage } from "./create-agent/Step5Usage";

export type ConfigTab = "basics" | "behavior" | "notify" | "memory" | "usage";

interface AgentConfigTabsProps {
  activeTab: ConfigTab;
}

const FOOTER_BTN_BASE =
  "flex h-12 w-[180px] cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-medium transition";

// 页面标题文案与左侧导航（aiChat.sidebar）保持一致：notify tab 在导航里叫 "Notification"/"通知"，
// 而 aiAgent.wizard.tabs.notify 为 "Notify"/"推送"，故标题统一改用导航文案源。
const NAV_LABEL_KEY: Record<ConfigTab, string> = {
  basics: "basics",
  behavior: "behavior",
  notify: "notification",
  memory: "memory",
  usage: "usage",
};

export function AgentConfigTabs({ activeTab }: AgentConfigTabsProps) {
  const t = useTranslations("aiAgent.wizard");
  const tNav = useTranslations("aiChat.sidebar");
  const { draft, dirty, patchDraft, handleSave, handleReset } = useAgentConfigDraft();

  return (
    <div className="flex w-full flex-col items-center bg-primary px-6 pb-12 pt-12">
      <div className="flex w-full max-w-[600px] flex-col items-center gap-6">
        <header className="flex w-full flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/ai-agent/sparkle.svg"
              alt=""
              width={32}
              height={32}
              className="block shrink-0"
            />
            <h1 className="text-[20px] font-bold leading-[28px] text-primary">
              {tNav(NAV_LABEL_KEY[activeTab])}
            </h1>
          </div>
        </header>

        <section className="w-full">
          {activeTab === "basics" && <Step1Basics draft={draft} onChange={patchDraft} />}
          {activeTab === "behavior" && <Step2Behavior draft={draft} onChange={patchDraft} />}
          {activeTab === "notify" && <Step3Notify draft={draft} onChange={patchDraft} />}
          {activeTab === "memory" && <Step4Memory draft={draft} onChange={patchDraft} />}
          {activeTab === "usage" && <Step5Usage />}
        </section>

        {/* Figma 6644:141905 · 180×48 · gap 16 */}
        <footer className="flex w-full items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className={`${FOOTER_BTN_BASE} border border-divider bg-transparent text-primary hover:bg-tertiary`}
          >
            {t("actions.reset")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty}
            className={`${FOOTER_BTN_BASE} border-0 bg-white text-static-black hover:opacity-90 disabled:cursor-not-allowed disabled:bg-tertiary disabled:text-tertiary`}
          >
            {t("actions.save")}
          </button>
        </footer>
      </div>
    </div>
  );
}
