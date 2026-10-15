"use client";

/**
 * AI Agent 首配线性 wizard（DD-109）。
 *
 * 三步线性流程（basics → behavior → notify），与 `CreateAgentWizard.tsx` 的 4-tab 自由跳形态并存：
 *   - 复用 `useCreateAgentWizard` hook（同一 draft + 校验语义）
 *   - 限定 LINEAR_STEPS = ['basics', 'behavior', 'notify']，memory tab 不进首配
 *   - 第 3 步点「生成我的画像」CTA → wizard.finish() 写 store + markCreated → 父组件弹 PersonaCreatingModal
 *   - 右上 X 关闭：D1 决策 — 保存当前 draft（已填项 + 未填项落 DEFAULT）+ markCreated → 父组件跳 tabs
 *
 * 备注：activeTab 默认初始化为 'basics'（hook 内部初始值），所以 linearIndex 总能找到。
 *       即便 wizard.activeTab 异常落到 'memory'，fallback 用 Math.max(0, ...) 兜底回 0。
 */

import { useTranslations } from "next-intl";
import { XIcon } from "@phosphor-icons/react";

import { useCreateAgentWizard, type WizardTab } from "@/hooks/useCreateAgentWizard";
import { Step1Basics } from "./create-agent/Step1Basics";
import { Step2Behavior } from "./create-agent/Step2Behavior";
import { Step3Notify } from "./create-agent/Step3Notify";
import { WizardStepper } from "./onboarding/WizardStepper";

const LINEAR_STEPS: readonly WizardTab[] = ["basics", "behavior", "notify"] as const;

interface CreateAgentWizardLinearProps {
  /** 第 3 步完成后用户点「生成画像」CTA → 父组件应弹 PersonaCreatingModal。 */
  onCreatePersona: () => void;
  /** 右上 X 关闭 → 父组件应跳到常态化 tabs（已通过 finish 持久化）。 */
  onClose: () => void;
}

export function CreateAgentWizardLinear({
  onCreatePersona,
  onClose,
}: CreateAgentWizardLinearProps) {
  const wizard = useCreateAgentWizard();
  const t = useTranslations("aiAgent.wizard");

  const rawIndex = LINEAR_STEPS.indexOf(wizard.activeTab as WizardTab);
  const safeIndex = Math.max(0, rawIndex) as 0 | 1 | 2;
  const isLastStep = safeIndex === 2;

  const goNext = () => {
    if (!wizard.isActiveTabValid) return;
    if (isLastStep) {
      // 第 3 步完成 → 持久化 draft + markCreated → 弹画像 modal
      wizard.finish();
      onCreatePersona();
      return;
    }
    wizard.setActiveTab(LINEAR_STEPS[safeIndex + 1]);
  };

  const goPrev = () => {
    if (safeIndex === 0) return;
    wizard.setActiveTab(LINEAR_STEPS[safeIndex - 1]);
  };

  const handleClose = () => {
    // D1: 关闭即视为「完成」 — 保存当前 draft（含 DEFAULT_AGENT_CONFIG 兜底字段）+ markCreated
    wizard.finish();
    onClose();
  };

  const stepLabels: [string, string, string] = [
    t("tabs.basics"),
    t("tabs.behavior"),
    t("tabs.notify"),
  ];

  const nextLabel = isLastStep ? t("actions.createPersona") : t("actions.next");

  return (
    <div className="relative flex min-h-[100svh] w-full flex-col items-center bg-primary px-6 pb-12 pt-16">
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="absolute right-6 top-6 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-secondary bg-transparent text-secondary transition hover:text-primary"
      >
        <XIcon size={16} weight="bold" />
      </button>

      <div className="flex w-full max-w-[600px] flex-col items-center gap-6">
        <WizardStepper title={t("title")} stepLabels={stepLabels} currentIndex={safeIndex} />

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
        </section>

        <footer className="flex w-full items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={safeIndex === 0}
            className="flex h-12 w-40 cursor-pointer items-center justify-center rounded-xl border border-secondary bg-transparent px-4 text-sm font-medium text-primary transition hover:bg-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("actions.prev")}
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!wizard.isActiveTabValid}
            className="flex h-12 w-40 cursor-pointer items-center justify-center rounded-xl border-0 bg-white px-4 text-sm font-medium text-static-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-tertiary disabled:text-tertiary"
          >
            {nextLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
