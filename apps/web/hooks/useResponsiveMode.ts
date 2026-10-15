"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import {
  useLayoutState,
  useMarketsLayoutStore,
  selectSidebarCollapsed,
} from "@/stores/marketsLayoutStore";

// ─── Responsive Mode ─────────────────────────────────────────────────────

export type ResponsiveMode = "h5" | "standard" | "wide" | "ultra";

// Module-level singletons — avoid re-creating matchMedia on every render
const queries = {
  wide: "(min-width: 1600px)",
  ultra: "(min-width: 1920px)",
  desktop: "(min-width: 1024px)",
} as const;

let mqWide: MediaQueryList | null = null;
let mqUltra: MediaQueryList | null = null;
let mqDesktop: MediaQueryList | null = null;

function ensureMql() {
  if (typeof window === "undefined") return;
  if (!mqWide) mqWide = window.matchMedia(queries.wide);
  if (!mqUltra) mqUltra = window.matchMedia(queries.ultra);
  if (!mqDesktop) mqDesktop = window.matchMedia(queries.desktop);
}

function subscribe(callback: () => void) {
  ensureMql();
  mqWide?.addEventListener("change", callback);
  mqUltra?.addEventListener("change", callback);
  mqDesktop?.addEventListener("change", callback);
  return () => {
    mqWide?.removeEventListener("change", callback);
    mqUltra?.removeEventListener("change", callback);
    mqDesktop?.removeEventListener("change", callback);
  };
}

function getSnapshot(): ResponsiveMode {
  ensureMql();
  if (mqUltra?.matches) return "ultra";
  if (mqWide?.matches) return "wide";
  if (mqDesktop?.matches) return "standard";
  return "h5";
}

function getServerSnapshot(): ResponsiveMode {
  return "standard"; // SSR assumes desktop
}

export function useResponsiveMode(): ResponsiveMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ─── Viewport Width (for dynamic triple-odds calculation) ───────────────

function subscribeResize(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

function getViewportWidth(): number {
  if (typeof window === "undefined") return 1280;
  return window.innerWidth;
}

// ─── Triple Odds Decision ────────────────────────────────────────────────

/**
 * Determines if MatchCard should render triple odds (1X2 + HC + Total).
 *
 * When no panels are open: wide/ultra always show triple odds.
 * When panels are open: dynamically calculates if the remaining content area
 * is wide enough (≥ 720px) to fit a triple-odds card.
 */
const TRIPLE_ODDS_MIN_WIDTH = 720;

export function useIsTripleOdds(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const mode = useResponsiveMode();
  const layoutState = useLayoutState();
  const sidebarCollapsed = useMarketsLayoutStore(selectSidebarCollapsed);
  const vw = useSyncExternalStore(subscribeResize, getViewportWidth, () => 1280);

  if (!hydrated) return false; // SSR + first frame: single odds
  if (mode === "h5") return false;

  // No panels → mode-based (wide/ultra always triple)
  if (layoutState === "default") {
    return mode === "wide" || mode === "ultra";
  }

  // Calculate available content width for match list
  const sidebar = sidebarCollapsed ? 50 : 200;
  const chrome = sidebar + 88; // + outer padding (40) + inner padding (48)

  let panelTaken: number;
  if (layoutState === "detail") {
    const detailW = mode === "ultra" ? 640 : 520;
    panelTaken = 12 + detailW; // gap + detail
  } else if (layoutState === "betslip-only") {
    panelTaken = 12 + 440; // gap + betslip
  } else {
    // "betslip" — both panels open
    panelTaken =
      mode === "standard"
        ? 278 + 34 + 14 + 440 // standard special grid columns
        : 12 + 520 + 12 + 440; // wide/ultra: gap + detail + gap + betslip
  }

  return vw - chrome - panelTaken >= TRIPLE_ODDS_MIN_WIDTH;
}
