// @vitest-environment jsdom
/**
 * DD-135 Batch 0 — useAgentConfigDraft 单测。
 * 覆盖：draft 初始同步、patchDraft → dirty、保存写 store（非 dirty no-op）、
 * 重置恢复默认（i18n defaultList 注入 + memorySummary 保留 + 不落库）、外部 store 变更同步 draft。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

// useTranslations 仅在 handleReset 里用 .raw("defaultList") 取数组
const RAW_LISTS: Record<string, string[]> = {
  "aiAgent.wizard.step3.countries": ["Brazil", "Argentina"],
  "aiAgent.wizard.step3.players": ["Messi"],
};
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => {
    const fn = (key: string) => key;
    fn.raw = (key: string) => (key === "defaultList" ? (RAW_LISTS[ns] ?? []) : undefined);
    return fn;
  },
}));

import { useAgentConfigDraft } from "./useAgentConfigDraft";
import { useAiAgentStore, DEFAULT_AGENT_CONFIG } from "@/stores/aiAgentStore";

describe("useAgentConfigDraft", () => {
  beforeEach(() => {
    localStorage.clear();
    useAiAgentStore.setState({
      hasCreatedAgent: false,
      hasSeenGlobalOnboarding: false,
      config: DEFAULT_AGENT_CONFIG,
      hydrated: true,
    });
    vi.clearAllMocks();
  });

  it("draft 初始等于持久化 config，dirty=false", () => {
    const { result } = renderHook(() => useAgentConfigDraft());
    expect(result.current.draft).toEqual(DEFAULT_AGENT_CONFIG);
    expect(result.current.dirty).toBe(false);
  });

  it("patchDraft 修改字段 → dirty=true，store 不变", () => {
    const { result } = renderHook(() => useAgentConfigDraft());
    act(() => result.current.patchDraft({ name: "Neo" }));
    expect(result.current.draft.name).toBe("Neo");
    expect(result.current.dirty).toBe(true);
    expect(useAiAgentStore.getState().config.name).toBe(DEFAULT_AGENT_CONFIG.name);
  });

  it("handleSave（dirty）→ draft 写入 store + toast.success", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() => useAgentConfigDraft());
    act(() => result.current.patchDraft({ name: "Neo" }));
    act(() => result.current.handleSave());
    expect(useAiAgentStore.getState().config.name).toBe("Neo");
    expect(result.current.dirty).toBe(false);
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it("handleSave（非 dirty）→ no-op，无 toast", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() => useAgentConfigDraft());
    act(() => result.current.handleSave());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("handleReset → draft 回默认（countries/players 注入 defaultList，memorySummary 保留），不落库", () => {
    useAiAgentStore.setState({
      config: {
        ...DEFAULT_AGENT_CONFIG,
        name: "Old",
        riskPreference: 9,
        memorySummary: ["likes Brazil"],
      },
    });
    const { result } = renderHook(() => useAgentConfigDraft());
    act(() => result.current.handleReset());
    expect(result.current.draft.name).toBe(DEFAULT_AGENT_CONFIG.name);
    expect(result.current.draft.riskPreference).toBe(DEFAULT_AGENT_CONFIG.riskPreference);
    expect(result.current.draft.countries).toEqual(["Brazil", "Argentina"]);
    expect(result.current.draft.players).toEqual(["Messi"]);
    expect(result.current.draft.memorySummary).toEqual(["likes Brazil"]);
    // 重置仅动 draft，store 仍是旧值（需点保存才持久化）
    expect(useAiAgentStore.getState().config.name).toBe("Old");
    expect(result.current.dirty).toBe(true);
  });

  it("外部 store 变更（clearMemorySummary 等价路径）→ draft 同步", () => {
    useAiAgentStore.setState({
      config: { ...DEFAULT_AGENT_CONFIG, memorySummary: ["a", "b"] },
    });
    const { result } = renderHook(() => useAgentConfigDraft());
    expect(result.current.draft.memorySummary).toEqual(["a", "b"]);
    act(() => useAiAgentStore.getState().clearMemorySummary());
    expect(result.current.draft.memorySummary).toEqual([]);
    expect(result.current.dirty).toBe(false);
  });
});
