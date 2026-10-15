"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { PillSwitcher, type PillSwitcherItem } from "@/components/ui/PillSwitcher";
import { useCreateAgentWizard, type WizardTab } from "@/hooks/useCreateAgentWizard";
import { Step1Basics } from "./create-agent/Step1Basics";
import { Step2Behavior } from "./create-agent/Step2Behavior";
import { Step3Notify } from "./create-agent/Step3Notify";
import { Step4Memory } from "./create-agent/Step4Memory";

interface CreateAgentWizardProps {
  onFinished: () => void;
  onCancel: () => void;
}

const TAB_KEYS: WizardTab[] = ["basics", "behavior", "notify", "memory"];

/**
 * CreateAgent 4-tab wizard 主控（DD-106 v3 · Figma 6566:138597）。
 *
 * 与 v2 渐进式 step bar 的区别：
 *   - tab 可自由跳转，但当前 tab 必填项未填完会被 setActiveTab 阻断（hook 内校验）+ toast
 *   - 底部按钮从「上一步 / 下一步」改为「重置 / 保存」
 *   - draft 切换 tab 时自动隐式保存（hook 内即时同步 setDraft）
 */
export function CreateAgentWizard({ onFinished, onCancel }: CreateAgentWizardProps) {
  const wizard = useCreateAgentWizard();
  const t = useTranslations("aiAgent.wizard");

  // Figma 6566:138627 顶部 4 tab，标签走 i18n
  const tabItems = useMemo<PillSwitcherItem<WizardTab>[]>(
    () => TAB_KEYS.map((key) => ({ key, label: t(`tabs.${key}`) })),
    [t]
  );

  const handleTabChange = (next: WizardTab) => {
    const ok = wizard.setActiveTab(next);
    if (!ok) {
      toast.info("Please complete the current step before switching");
    }
  };

  const handleSave = () => {
    if (!wizard.isAllTabsValid) {
      toast.info("Please complete all steps before saving");
      return;
    }
    wizard.finish();
    onFinished();
  };

  return (
    <div className="relative flex min-h-[100svh] w-full flex-col items-center bg-primary px-6 pb-12 pt-16">
      {/* Figma 6404:87406：32×32 圆形描边 X 按钮，关闭 wizard */}
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        // @figma-hardcoded: border #212124 line/border-secondary — pending design token
        className="absolute right-6 top-6 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-solid border-[#212124] bg-transparent text-secondary transition hover:border-secondary hover:text-primary"
      >
        <XIcon size={16} weight="bold" />
      </button>

      <div className="flex w-full max-w-[600px] flex-col items-center gap-6">
        <header className="flex w-full flex-col items-center gap-6">
          <div className="flex items-center gap-1">
            <h1 className="text-[18px] font-bold leading-[26px] text-primary">{t("title")}</h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/ai-agent/intro-sparkle.svg"
              alt=""
              width={32}
              height={32}
              className="block"
            />
          </div>
          <PillSwitcher
            items={tabItems}
            value={wizard.activeTab}
            onChange={handleTabChange}
            ariaLabel="Wizard tabs"
          />
        </header>

        <section className="w-full">
          {wizard.activeTab === "basics" && (
            <Step1Basics draft={wizard.draft} onChange={wizard.setDraft} />
          )}
          {wizard.activeTab === "behavior" && (
            <Step2Behavior draft={wizard.draft} onChange={wizard.setDraft} />
          )}
          {wizard.activeTab === "notify" && (
            <Step3Notify draft={wizard.draft} onChange={wizard.setDraft} />
          )}
          {wizard.activeTab === "memory" && (
            <Step4Memory draft={wizard.draft} onChange={wizard.setDraft} />
          )}
        </section>

        {/* Figma 6566:138622 底部「重置 / 保存」，两按钮均 160×48 */}
        <footer className="flex w-full flex-col items-center gap-2 pt-2">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={wizard.resetDraft}
              // @figma-hardcoded: border #212124 fill/button/tertiary-btn-default — pending design token
              className="flex h-12 w-40 cursor-pointer items-center justify-center rounded-xl border border-solid border-[#212124] bg-transparent px-4 text-sm font-medium text-primary transition hover:bg-tertiary"
            >
              {t("actions.reset")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!wizard.isAllTabsValid}
              title={
                wizard.isAllTabsValid
                  ? undefined
                  : "Complete all required fields across the 4 tabs to unlock save"
              }
              className="flex h-12 w-40 cursor-pointer items-center justify-center rounded-xl border-0 bg-white px-4 text-sm font-medium text-static-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-tertiary disabled:text-tertiary"
            >
              {t("actions.save")}
            </button>
          </div>
          {!wizard.isAllTabsValid && (
            <p className="text-[12px] leading-[18px] text-tertiary">{t("hint.completeAll")}</p>
          )}
        </footer>
      </div>
    </div>
  );
}
