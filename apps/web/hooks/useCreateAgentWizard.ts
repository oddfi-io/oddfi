"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DEFAULT_AGENT_CONFIG, type AgentConfig, useAiAgentStore } from "@/stores/aiAgentStore";

/**
 * CreateAgent wizard 内部状态机（DD-106 v3 · Figma 6566:138634 tab 化重构）。
 *
 * 设计意图：
 *   - draft 保存在 hook 内部，未点「保存」之前不污染 aiAgentStore
 *   - 4 个 tab 自由跳转，但 setActiveTab 会守门：当前 tab 必须 isActiveTabValid 才放行
 *   - 切换 tab 等价"自动保存"——draft 已即时同步（onChange → setDraft），无需显式 save
 *   - 「保存」按钮仅在所有 tab 均 valid 时启用，一次性写入 store + markCreated
 *   - 「重置」按钮把 draft 拍回 DEFAULT_AGENT_CONFIG（不影响已持久化的 config，未点保存前不外泄）
 */
export type WizardTab = "basics" | "behavior" | "notify" | "memory";

export const WIZARD_TABS: readonly WizardTab[] = ["basics", "behavior", "notify", "memory"];

function validateTab(tab: WizardTab, draft: AgentConfig): boolean {
  switch (tab) {
    case "basics":
      return draft.name.trim().length > 0 && draft.avatarRef.length > 0;
    case "behavior":
      return draft.riskPreference >= 0 && draft.riskPreference <= 10 && draft.minStake >= 0;
    case "notify":
      return draft.channels.some((c) => c.enabled);
    case "memory":
      // 记忆 tab 是展示性段落（memorySummary 来自 store，不进 draft），无必填字段，
      // 永远 valid —— 用户经过其他 3 tab valid 后即可保存。
      return true;
  }
}

export interface UseCreateAgentWizardResult {
  activeTab: WizardTab;
  draft: AgentConfig;
  /** 当前 tab 必填项是否齐全（用于"切走 / 保存"门控） */
  isActiveTabValid: boolean;
  /** 所有 tab 均 valid（保存按钮 enable 条件） */
  isAllTabsValid: boolean;
  setDraft: (patch: Partial<AgentConfig>) => void;
  /** 尝试切换 tab；当前 tab 未填完则阻断，返回 false */
  setActiveTab: (tab: WizardTab) => boolean;
  resetDraft: () => void;
  finish: () => void;
}

export function useCreateAgentWizard(): UseCreateAgentWizardResult {
  const persistedConfig = useAiAgentStore((s) => s.config);
  const hasCreatedAgent = useAiAgentStore((s) => s.hasCreatedAgent);
  const setConfig = useAiAgentStore((s) => s.setConfig);
  const markCreated = useAiAgentStore((s) => s.markCreated);
  const tCountries = useTranslations("aiAgent.wizard.step3.countries");
  const tPlayers = useTranslations("aiAgent.wizard.step3.players");

  const [activeTab, setActiveTabState] = useState<WizardTab>("basics");
  const [draft, setDraftState] = useState<AgentConfig>(() => {
    const base: AgentConfig = { ...DEFAULT_AGENT_CONFIG, ...persistedConfig };
    // 首次创建 wizard（未保存过 Agent）且对应字段为空 → 注入 locale defaults
    if (!hasCreatedAgent) {
      if (base.countries.length === 0) {
        const raw: unknown = tCountries.raw("defaultList");
        if (Array.isArray(raw) && raw.every((s) => typeof s === "string")) {
          base.countries = raw as string[];
        }
      }
      if (base.players.length === 0) {
        const raw: unknown = tPlayers.raw("defaultList");
        if (Array.isArray(raw) && raw.every((s) => typeof s === "string")) {
          base.players = raw as string[];
        }
      }
    }
    return base;
  });

  const setDraft = useCallback((patch: Partial<AgentConfig>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const isActiveTabValid = useMemo(() => validateTab(activeTab, draft), [activeTab, draft]);

  const isAllTabsValid = useMemo(() => WIZARD_TABS.every((t) => validateTab(t, draft)), [draft]);

  const setActiveTab = useCallback(
    (next: WizardTab): boolean => {
      if (next === activeTab) return true;
      if (!validateTab(activeTab, draft)) return false;
      setActiveTabState(next);
      return true;
    },
    [activeTab, draft]
  );

  const resetDraft = useCallback(() => {
    setDraftState({ ...DEFAULT_AGENT_CONFIG });
  }, []);

  const finish = useCallback(() => {
    setConfig(draft);
    markCreated();
  }, [draft, markCreated, setConfig]);

  return {
    activeTab,
    draft,
    isActiveTabValid,
    isAllTabsValid,
    setDraft,
    setActiveTab,
    resetDraft,
    finish,
  };
}
