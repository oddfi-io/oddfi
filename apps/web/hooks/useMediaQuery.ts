"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * 通用 media query 监听 hook（DD-106 D5）。
 *
 * 现有资产：`useIsPhone` 仅覆盖 768px 移动端断点，不满足 AI Agent 全屏页 1024px PC 断点诉求。
 * 因此新建本通用 hook，参数化 query 字符串，复用 SSR-safe 的 useSyncExternalStore 模式。
 *
 * SSR 默认返回 `false`，client 首次 effect 同步真值；分支决策都在 effect 之后渲染，避免 hydration 闪烁。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useMemo(
    () => (callback: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query]
  );

  const getSnapshot = useMemo(
    () => () => {
      if (typeof window === "undefined") return false;
      return window.matchMedia(query).matches;
    },
    [query]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
