"use client";

import { useEffect, useState } from "react";
import { DEFAULT_AVATAR_ID } from "./avatars";
import { DEFAULT_PERSONA, type PersonaId } from "./personas";

const STORAGE_KEY = "oddfi-agent-profile";

export interface AgentProfile {
  avatarId: string;
  nickname: string;
  nicknameCustomized: boolean;
  personaId: PersonaId;
}

const DEFAULT_PROFILE: AgentProfile = {
  avatarId: DEFAULT_AVATAR_ID,
  nickname: "Cat",
  nicknameCustomized: false,
  personaId: DEFAULT_PERSONA,
};

// 模块级单例 + 订阅者列表 — 多个组件订阅会同步更新
let current: AgentProfile = DEFAULT_PROFILE;
let listeners: Array<(p: AgentProfile) => void> = [];
let didLoad = false;

function loadFromStorage(): AgentProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AgentProfile>;
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PROFILE;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

function notify() {
  for (const l of listeners) l(current);
}

export function useAgentProfile() {
  const [profile, setProfile] = useState<AgentProfile>(current);

  useEffect(() => {
    if (!didLoad) {
      current = loadFromStorage();
      didLoad = true;
      notify();
    } else {
      setProfile(current);
    }
    listeners.push(setProfile);
    return () => {
      listeners = listeners.filter((l) => l !== setProfile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<AgentProfile>) => {
    current = { ...current, ...patch };
    persist();
    notify();
  };

  return [profile, update] as const;
}
