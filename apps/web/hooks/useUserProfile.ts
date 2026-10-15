"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "oddfi_user_profile_v1";
const CHANGE_EVENT = "oddfi:user-profile-changed";

function dispatchChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export interface SocialConnection {
  username: string;
}

export interface UserProfile {
  username: string;
  socials: {
    x?: SocialConnection | null;
    telegram?: SocialConnection | null;
  };
  updatedAt: number;
}

type ProfileMap = Record<string, UserProfile>;

function normalizeKey(address: string): string {
  return address.toLowerCase();
}

function readAll(): ProfileMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProfileMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: ProfileMap): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function loadProfile(address: string): UserProfile | null {
  if (!address) return null;
  const all = readAll();
  return all[normalizeKey(address)] ?? null;
}

export function saveProfile(
  address: string,
  patch: Partial<Omit<UserProfile, "updatedAt">>
): UserProfile | null {
  if (!address) return null;
  const key = normalizeKey(address);
  const all = readAll();
  const prev = all[key];
  const next: UserProfile = {
    username: patch.username ?? prev?.username ?? "",
    socials: patch.socials ?? prev?.socials ?? {},
    updatedAt: Date.now(),
  };
  all[key] = next;
  if (!writeAll(all)) return null;
  dispatchChange();
  return next;
}

interface UseUserProfileResult {
  profile: UserProfile | null;
  save: (patch: Partial<Omit<UserProfile, "updatedAt">>) => UserProfile | null;
  isHydrated: boolean;
}

export function useUserProfile(address: string | undefined): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!address) {
      setProfile(null);
      setIsHydrated(true);
      return;
    }
    setProfile(loadProfile(address));
    setIsHydrated(true);

    if (typeof window === "undefined") return;

    // 同窗口同步：useUserProfile 在不同组件多处订阅时，任一处 save() 后其它处也立即刷新
    const handleChange = () => setProfile(loadProfile(address));
    // 跨标签页同步：localStorage 在另一 tab 写入时触发原生 storage 事件
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setProfile(loadProfile(address));
    };
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [address]);

  const save = useCallback(
    (patch: Partial<Omit<UserProfile, "updatedAt">>) => {
      if (!address) return null;
      const next = saveProfile(address, patch);
      if (next) setProfile(next);
      return next;
    },
    [address]
  );

  return { profile, save, isHydrated };
}
