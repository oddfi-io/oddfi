/**
 * AI Agent 配置持久化（DD-106 §3.3）。
 *
 * Storage key: oddfi_ai_agent_config_v1
 *
 * V1 仅 localStorage；头像 dataURL 在 Batch 8 接 IndexedDB 后改存 avatarRef -> IDB key。
 */
import { create } from "zustand";

import { CODEX_PETS, DEFAULT_PET_ID } from "@/lib/codex-pets/registry";

const STORAGE_KEY = "oddfi_ai_agent_config_v1";

/** 已知 codex-pets id 集合，用于旧 localStorage 兼容兜底。 */
const KNOWN_PET_IDS: ReadonlySet<string> = new Set(CODEX_PETS.map((p) => p.id));

export type AgentTone = "rational" | "companion" | "aggressive" | "strict";

export interface AgentSound {
  id: "ding" | "bell" | "crisp" | "guqin" | "comm" | null;
  enabled: boolean;
}

export interface AgentPushChannel {
  id: string;
  enabled: boolean;
}

/** Figma 6404:87954 推送类型：登录召唤 / 赛前分析 / 临场更新 / 复盘 / 高优事件突破上限 */
export type AgentChannelId =
  | "login-greet"
  | "pre-match"
  | "kickoff"
  | "recap"
  | "high-priority-override";

export const VALID_CHANNEL_IDS: ReadonlySet<AgentChannelId> = new Set([
  "login-greet",
  "pre-match",
  "kickoff",
  "recap",
  "high-priority-override",
]);

export interface AgentConfig {
  name: string;
  avatarRef: string; // preset id ("avatar-1"…) 或 IndexedDB key
  tone: AgentTone;
  riskPreference: number; // 0..10
  minStake: number;
  allowAutoBet: boolean;
  countries: string[];
  players: string[];
  channels: AgentPushChannel[];
  sound: AgentSound;
  memorySummary: string[];
  schemaVersion: 3;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  name: "Oddfi-Agent",
  avatarRef: DEFAULT_PET_ID,
  tone: "rational",
  riskPreference: 5,
  minStake: 0,
  allowAutoBet: false,
  // 默认 [] —— 由 useCreateAgentWizard hook 按 locale 注入 i18n defaultList
  countries: [],
  players: [],
  channels: [
    { id: "login-greet", enabled: true },
    { id: "pre-match", enabled: true },
    { id: "kickoff", enabled: true },
    { id: "recap", enabled: true },
    { id: "high-priority-override", enabled: true },
  ],
  sound: { id: "ding", enabled: true },
  memorySummary: [],
  schemaVersion: 3,
};

interface Persisted {
  hasCreatedAgent: boolean;
  hasSeenGlobalOnboarding: boolean;
  config: AgentConfig;
}

function loadFromStorage(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (!parsed.config) return null;
    const merged: AgentConfig = { ...DEFAULT_AGENT_CONFIG, ...parsed.config };
    const prevVersion = parsed.config.schemaVersion as number | undefined;
    if (prevVersion !== 3) {
      // v1 → v3 / v2 → v3 迁移：channels / keywords 旧字段全丢弃，
      // countries + players 留空，由 wizard hook 按 locale 重新注入 defaultList
      merged.channels = DEFAULT_AGENT_CONFIG.channels;
      merged.countries = [];
      merged.players = [];
      merged.schemaVersion = 3;
    } else {
      merged.channels = merged.channels.filter((c) =>
        VALID_CHANNEL_IDS.has(c.id as AgentChannelId)
      );
    }
    // DD-112：avatarRef 取值域从 "avatar-N" 切到 codex-pets id，未知 id 回落默认
    if (!KNOWN_PET_IDS.has(merged.avatarRef)) {
      merged.avatarRef = DEFAULT_PET_ID;
    }
    return {
      hasCreatedAgent: !!parsed.hasCreatedAgent,
      hasSeenGlobalOnboarding: !!parsed.hasSeenGlobalOnboarding,
      config: merged,
    };
  } catch {
    return null;
  }
}

function saveToStorage(persisted: Persisted) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    /* quota exceeded — non-critical */
  }
}

interface AgentState {
  hasCreatedAgent: boolean;
  hasSeenGlobalOnboarding: boolean;
  config: AgentConfig;
  hydrated: boolean;
}

interface AgentActions {
  setConfig: (config: AgentConfig) => void;
  patchConfig: (patch: Partial<AgentConfig>) => void;
  markCreated: () => void;
  resetAgent: () => void;
  /** 清空 memorySummary（DD-106 v3 · Step4Memory「清除记忆」按钮）。 */
  clearMemorySummary: () => void;
  /** 全局首次引导弹窗已展示，持久化标记避免重复弹出。 */
  markSeenGlobalOnboarding: () => void;
  hydrate: () => void;
}

export type AiAgentStore = AgentState & AgentActions;

export const useAiAgentStore = create<AiAgentStore>((set, get) => ({
  hasCreatedAgent: false,
  hasSeenGlobalOnboarding: false,
  config: DEFAULT_AGENT_CONFIG,
  hydrated: false,

  setConfig: (config) => {
    const { hasCreatedAgent, hasSeenGlobalOnboarding } = get();
    saveToStorage({ hasCreatedAgent, hasSeenGlobalOnboarding, config });
    set({ config });
  },

  patchConfig: (patch) => {
    const config = { ...get().config, ...patch };
    const { hasCreatedAgent, hasSeenGlobalOnboarding } = get();
    saveToStorage({ hasCreatedAgent, hasSeenGlobalOnboarding, config });
    set({ config });
  },

  markCreated: () => {
    const { hasSeenGlobalOnboarding, config } = get();
    saveToStorage({ hasCreatedAgent: true, hasSeenGlobalOnboarding, config });
    set({ hasCreatedAgent: true });
  },

  resetAgent: () => {
    saveToStorage({
      hasCreatedAgent: false,
      hasSeenGlobalOnboarding: false,
      config: DEFAULT_AGENT_CONFIG,
    });
    set({ hasCreatedAgent: false, hasSeenGlobalOnboarding: false, config: DEFAULT_AGENT_CONFIG });
  },

  clearMemorySummary: () => {
    const config = { ...get().config, memorySummary: [] };
    const { hasCreatedAgent, hasSeenGlobalOnboarding } = get();
    saveToStorage({ hasCreatedAgent, hasSeenGlobalOnboarding, config });
    set({ config });
  },

  markSeenGlobalOnboarding: () => {
    const { hasCreatedAgent, config } = get();
    saveToStorage({ hasCreatedAgent, hasSeenGlobalOnboarding: true, config });
    set({ hasSeenGlobalOnboarding: true });
  },

  hydrate: () => {
    if (get().hydrated) return;
    const persisted = loadFromStorage();
    if (persisted) {
      set({
        hasCreatedAgent: persisted.hasCreatedAgent,
        hasSeenGlobalOnboarding: persisted.hasSeenGlobalOnboarding,
        config: persisted.config,
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },
}));
