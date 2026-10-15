"use client";

import { useEffect, useState } from "react";
import { DEFAULT_COUNTRIES, DEFAULT_PLAYERS } from "./mockData";
import { type Watchlist } from "./watchMatch";

export {
  buildWatchMatcher,
  matchesWatchlist,
  type Watchlist,
} from "./watchMatch";

const STORAGE_KEY = "oddfi-agent-watchlist";

const DEFAULT_WATCHLIST: Watchlist = {
  countries: DEFAULT_COUNTRIES,
  players: DEFAULT_PLAYERS,
};

// ── 模块级单例（多组件同步 + localStorage 持久化）──
let current: Watchlist = DEFAULT_WATCHLIST;
let listeners: Array<(w: Watchlist) => void> = [];
let didLoad = false;

function loadFromStorage(): Watchlist {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Watchlist>;
      return { ...DEFAULT_WATCHLIST, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_WATCHLIST;
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

export function useWatchlist() {
  const [wl, setWl] = useState<Watchlist>(current);

  useEffect(() => {
    if (!didLoad) {
      current = loadFromStorage();
      didLoad = true;
      notify();
    } else {
      setWl(current);
    }
    listeners.push(setWl);
    return () => {
      listeners = listeners.filter((l) => l !== setWl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<Watchlist>) => {
    current = { ...current, ...patch };
    persist();
    notify();
  };

  return [wl, update] as const;
}
