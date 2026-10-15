"use client";

/**
 * Agent 配置 draft 状态机（DD-135 Batch 0 · 自 AgentConfigTabs 提取）。
 *
 * PC（AgentConfigTabs）与 H5（MobileAgentSettings）双调用方共享同一套
 * draft / dirty / 保存 / 重置语义，保证两端行为零漂移：
 *   - draft 单一来源，5 tab 共享；切 tab 不丢未保存 draft
 *   - 外部 store 变更（resetAgent / clearMemorySummary 等）→ 同步 draft
 *   - 重置仅动 draft（不直接写 store），需点「保存」才持久化；
 *     memorySummary 不进重置范围（清除记忆有独立按钮）；
 *     countries / players 从 i18n defaultList 恢复（DEFAULT_AGENT_CONFIG 里是空数组）
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useAiAgentStore, type AgentConfig, DEFAULT_AGENT_CONFIG } from "@/stores/aiAgentStore";

function isDirty(draft: AgentConfig, persisted: AgentConfig): boolean {
  return JSON.stringify(draft) !== JSON.stringify(persisted);
}

export interface AgentConfigDraft {
  draft: AgentConfig;
  /** draft 与持久化 config 是否有差异（保存按钮 disabled=!dirty）。 */
  dirty: boolean;
  patchDraft: (patch: Partial<AgentConfig>) => void;
  /** dirty 时把 draft 写入 aiAgentStore 并 toast；非 dirty 为 no-op。 */
  handleSave: () => void;
  /** 恢复默认值到 draft（不落库）。 */
  handleReset: () => void;
}

export function useAgentConfigDraft(): AgentConfigDraft {
  const tCountries = useTranslations("aiAgent.wizard.step3.countries");
  const tPlayers = useTranslations("aiAgent.wizard.step3.players");
  const persistedConfig = useAiAgentStore((s) => s.config);
  const setConfig = useAiAgentStore((s) => s.setConfig);

  const [draft, setDraft] = useState<AgentConfig>(persistedConfig);

  // 外部 store 变更（resetAgent / clearMemorySummary 等）→ 同步 draft
  useEffect(() => {
    setDraft(persistedConfig);
  }, [persistedConfig]);

  const dirty = useMemo(() => isDirty(draft, persistedConfig), [draft, persistedConfig]);

  const patchDraft = (patch: Partial<AgentConfig>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = () => {
    if (!dirty) return;
    setConfig(draft);
    toast.success("Saved");
  };

  const handleReset = () => {
    const rawCountries = tCountries.raw("defaultList");
    const rawPlayers = tPlayers.raw("defaultList");
    const countries = Array.isArray(rawCountries)
      ? rawCountries.filter((v): v is string => typeof v === "string")
      : [];
    const players = Array.isArray(rawPlayers)
      ? rawPlayers.filter((v): v is string => typeof v === "string")
      : [];
    setDraft({
      ...DEFAULT_AGENT_CONFIG,
      memorySummary: persistedConfig.memorySummary,
      countries,
      players,
    });
  };

  return { draft, dirty, patchDraft, handleSave, handleReset };
}
