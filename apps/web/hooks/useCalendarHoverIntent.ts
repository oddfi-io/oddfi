"use client";

/**
 * Hover intent hook（DD-091 §3.5(7)）。
 *
 * 行为：
 *   - 触屏设备（'ontouchstart' / maxTouchPoints > 0）→ 完全禁用 hover 行为
 *   - mouseenter → 200ms 计时器 → setActive(id)
 *   - mouseleave card + popover 双区 → 80ms 延迟 → setActive(null)
 *   - 重新进入时清掉 leave 计时器
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { HOVER_ENTER_MS, HOVER_LEAVE_MS } from "@/lib/calendar/constants";

function detectTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || (navigator?.maxTouchPoints ?? 0) > 0;
}

export interface HoverBindings<T> {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  __id: T;
}

export interface UseCalendarHoverIntentReturn<T> {
  /** 当前被 hover 的 id（200ms 触发后），无 hover 时为 null */
  activeId: T | null;
  /** 触屏设备完全关闭 hover 行为，组件可据此跳过 popover 渲染 */
  isTouchDevice: boolean;
  /** 给 trigger（如 MatchCard）绑定 mouseenter/leave */
  bindTrigger: (id: T) => { onMouseEnter: () => void; onMouseLeave: () => void };
  /** 给 popover 自身绑定（鼠标移到 popover 上时不应消失） */
  bindPopover: () => { onMouseEnter: () => void; onMouseLeave: () => void };
}

export function useCalendarHoverIntent<T>(): UseCalendarHoverIntentReturn<T> {
  const [activeId, setActiveId] = useState<T | null>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchDevice = useRef(detectTouchDevice());

  const clearEnter = () => {
    if (enterTimer.current !== null) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
  };
  const clearLeave = () => {
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  // 卸载清理
  useEffect(() => {
    return () => {
      clearEnter();
      clearLeave();
    };
  }, []);

  const bindTrigger = useCallback((id: T) => {
    if (isTouchDevice.current) {
      return { onMouseEnter: () => {}, onMouseLeave: () => {} };
    }
    return {
      onMouseEnter: () => {
        clearLeave();
        clearEnter();
        enterTimer.current = setTimeout(() => setActiveId(id), HOVER_ENTER_MS);
      },
      onMouseLeave: () => {
        clearEnter();
        leaveTimer.current = setTimeout(() => setActiveId(null), HOVER_LEAVE_MS);
      },
    };
  }, []);

  const bindPopover = useCallback(() => {
    if (isTouchDevice.current) {
      return { onMouseEnter: () => {}, onMouseLeave: () => {} };
    }
    return {
      onMouseEnter: () => clearLeave(),
      onMouseLeave: () => {
        leaveTimer.current = setTimeout(() => setActiveId(null), HOVER_LEAVE_MS);
      },
    };
  }, []);

  return {
    activeId,
    isTouchDevice: isTouchDevice.current,
    bindTrigger,
    bindPopover,
  };
}
