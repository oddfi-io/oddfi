"use client";

/**
 * Calendar 时区偏好持久化（DD-091 §3.5(6)）。
 *
 * 行为：
 *   - SSR 阶段：calendarStore.tzPref 默认 'UTC'（避免 hydration mismatch）
 *   - 首次 client 渲染（mount）：读 localStorage.calendar_tz_pref，若有
 *     则同步到 store；toggle 时双写 store + localStorage
 *
 * 复用：lib/calendar/constants.TZ_PREF_KEY
 */
import { useEffect } from "react";
import { TZ_PREF_KEY } from "@/lib/calendar/constants";
import { useCalendarStore, selectTzPref, type CalendarTzPref } from "@/stores/calendarStore";

function readPref(): CalendarTzPref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TZ_PREF_KEY);
    if (raw === "UTC" || raw === "local") return raw;
  } catch {
    // localStorage 不可用（隐私模式 / 沙盒）→ 默认 UTC
  }
  return null;
}

function writePref(p: CalendarTzPref) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TZ_PREF_KEY, p);
  } catch {
    // ignore
  }
}

export interface UseCalendarTimezoneReturn {
  tzPref: CalendarTzPref;
  toggleTz: () => void;
  setTz: (p: CalendarTzPref) => void;
}

export function useCalendarTimezone(): UseCalendarTimezoneReturn {
  const tzPref = useCalendarStore(selectTzPref);
  const setStorePref = useCalendarStore((s) => s.setTzPref);

  // 客户端 hydrate：读 localStorage 同步到 store（仅 mount 一次）
  useEffect(() => {
    const saved = readPref();
    if (saved && saved !== tzPref) {
      setStorePref(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTz = (p: CalendarTzPref) => {
    writePref(p);
    setStorePref(p);
  };

  const toggleTz = () => {
    setTz(tzPref === "UTC" ? "local" : "UTC");
  };

  return { tzPref, toggleTz, setTz };
}
