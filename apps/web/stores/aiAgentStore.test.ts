// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_AGENT_CONFIG, useAiAgentStore, type AgentConfig } from "./aiAgentStore";

const STORAGE_KEY = "oddfi_ai_agent_config_v1";

function resetStore() {
  localStorage.clear();
  useAiAgentStore.setState({
    hasCreatedAgent: false,
    hasSeenGlobalOnboarding: false,
    config: DEFAULT_AGENT_CONFIG,
    hydrated: false,
  });
}

describe("aiAgentStore", () => {
  beforeEach(resetStore);

  it("setConfig persists to localStorage", () => {
    const cfg: AgentConfig = { ...DEFAULT_AGENT_CONFIG, name: "Goku" };
    useAiAgentStore.getState().setConfig(cfg);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.config.name).toBe("Goku");
    expect(raw.hasCreatedAgent).toBe(false);
  });

  it("patchConfig merges partial fields", () => {
    useAiAgentStore.getState().patchConfig({ name: "x", riskPreference: 7 });
    const c = useAiAgentStore.getState().config;
    expect(c.name).toBe("x");
    expect(c.riskPreference).toBe(7);
    expect(c.tone).toBe("rational"); // unchanged
  });

  it("markCreated flips hasCreatedAgent and persists", () => {
    useAiAgentStore.getState().markCreated();
    expect(useAiAgentStore.getState().hasCreatedAgent).toBe(true);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.hasCreatedAgent).toBe(true);
  });

  it("hydrate rehydrates from persisted snapshot", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hasCreatedAgent: true,
        config: { ...DEFAULT_AGENT_CONFIG, name: "loaded" },
      })
    );
    useAiAgentStore.getState().hydrate();
    const s = useAiAgentStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.hasCreatedAgent).toBe(true);
    expect(s.config.name).toBe("loaded");
  });

  it("resetAgent clears both flags + restores defaults", () => {
    useAiAgentStore.getState().markCreated();
    useAiAgentStore.getState().markSeenGlobalOnboarding();
    useAiAgentStore.getState().patchConfig({ name: "to-reset" });
    useAiAgentStore.getState().resetAgent();
    const s = useAiAgentStore.getState();
    expect(s.hasCreatedAgent).toBe(false);
    expect(s.hasSeenGlobalOnboarding).toBe(false);
    expect(s.config.name).toBe("Oddfi-Agent");
  });

  it("markSeenGlobalOnboarding sets flag and persists", () => {
    useAiAgentStore.getState().markSeenGlobalOnboarding();
    expect(useAiAgentStore.getState().hasSeenGlobalOnboarding).toBe(true);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.hasSeenGlobalOnboarding).toBe(true);
  });

  it("hydrate reads hasSeenGlobalOnboarding from storage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hasCreatedAgent: false,
        hasSeenGlobalOnboarding: true,
        config: { ...DEFAULT_AGENT_CONFIG, name: "loaded" },
      })
    );
    useAiAgentStore.getState().hydrate();
    const s = useAiAgentStore.getState();
    expect(s.hasSeenGlobalOnboarding).toBe(true);
  });

  it("hydrate guard: second call is a no-op", () => {
    useAiAgentStore.getState().hydrate();
    // set a value after first hydrate, then call again — should not overwrite
    useAiAgentStore.setState({ hasCreatedAgent: true });
    useAiAgentStore.getState().hydrate();
    expect(useAiAgentStore.getState().hasCreatedAgent).toBe(true);
  });

  it("DEFAULT_AGENT_CONFIG starts with empty memorySummary + countries + players (locale defaults injected by UI)", () => {
    expect(DEFAULT_AGENT_CONFIG.memorySummary).toEqual([]);
    expect(DEFAULT_AGENT_CONFIG.countries).toEqual([]);
    expect(DEFAULT_AGENT_CONFIG.players).toEqual([]);
  });

  it("DD-109 D6：DEFAULT_AGENT_CONFIG.name 默认为 'Oddfi-Agent'", () => {
    expect(DEFAULT_AGENT_CONFIG.name).toBe("Oddfi-Agent");
  });

  it("DD-112：DEFAULT_AGENT_CONFIG.avatarRef = codex-pets DEFAULT_PET_ID", () => {
    expect(DEFAULT_AGENT_CONFIG.avatarRef).toBe("cr7-striker");
  });

  it("DD-112：旧 localStorage avatarRef='avatar-3' hydrate 时回落到 cr7-striker", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hasCreatedAgent: true,
        hasSeenGlobalOnboarding: false,
        config: { ...DEFAULT_AGENT_CONFIG, avatarRef: "avatar-3" },
      })
    );
    useAiAgentStore.getState().hydrate();
    expect(useAiAgentStore.getState().config.avatarRef).toBe("cr7-striker");
  });

  it("DD-112：已知 codex-pet id（如 goku）hydrate 后保留", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hasCreatedAgent: true,
        hasSeenGlobalOnboarding: false,
        config: { ...DEFAULT_AGENT_CONFIG, avatarRef: "goku" },
      })
    );
    useAiAgentStore.getState().hydrate();
    expect(useAiAgentStore.getState().config.avatarRef).toBe("goku");
  });

  it("clearMemorySummary empties the array and persists", () => {
    // 先注入一些内容再清空，验证 clear 路径
    useAiAgentStore.getState().patchConfig({ memorySummary: ["a", "b"] });
    expect(useAiAgentStore.getState().config.memorySummary).toEqual(["a", "b"]);
    useAiAgentStore.getState().clearMemorySummary();
    expect(useAiAgentStore.getState().config.memorySummary).toEqual([]);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.config.memorySummary).toEqual([]);
  });
});
