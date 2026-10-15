"use client";

import { useSyncExternalStore } from "react";

const PHONE_BREAKPOINT = 768; // md breakpoint, aligned with Tailwind

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${PHONE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(`(max-width: ${PHONE_BREAKPOINT - 1}px)`).matches;
}

function getServerSnapshot() {
  return false; // SSR defaults to desktop
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
