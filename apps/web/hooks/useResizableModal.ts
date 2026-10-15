"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveLayout, type ResolvedLayout } from "@/lib/ai/layout-clamp";
import {
  CHAT_MODAL_DEFAULT_HEIGHT,
  CHAT_MODAL_DEFAULT_WIDTH,
  CHAT_MODAL_MIN_HEIGHT,
  CHAT_MODAL_MIN_WIDTH,
  useAiChatLayoutStore,
} from "@/stores/aiChatLayoutStore";

export const DRAG_HANDLE_CLASSNAME = "ai-chat-drag-handle";

interface RndDragData {
  x: number;
  y: number;
}

interface RndResizeRef {
  offsetWidth: number;
  offsetHeight: number;
}

/**
 * 封装 react-rnd 浮窗的尺寸/位置 props + viewport clamp + 持久化（DD-106 §3.5）。
 * AiChatModal 通过 spread `rndProps` 接入 <Rnd>，不直接依赖 react-rnd API，方便未来替换实现。
 */
export function useResizableModal() {
  const { position, size, hydrated, setLayout, hydrate } = useAiChatLayoutStore();
  const [viewport, setViewport] = useState<{ width: number; height: number }>({
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  });

  useEffect(() => {
    hydrate();
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hydrate]);

  const resolved: ResolvedLayout = useMemo(
    () => resolveLayout({ position, size }, viewport),
    [position, size, viewport]
  );

  // 视口缩小后越界 → 回写 clamp 后的位置，避免重新打开仍越界
  useEffect(() => {
    if (!hydrated) return;
    const dx = position && resolved.position.x !== position.x;
    const dy = position && resolved.position.y !== position.y;
    const dw = resolved.size.width !== size.width;
    const dh = resolved.size.height !== size.height;
    if (dx || dy || dw || dh) {
      setLayout({ position: resolved.position, size: resolved.size });
    }
    // 仅在 viewport 变化或 hydrate 完成时触发回写；不依赖 size/position 自身防循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, hydrated]);

  const handleDragStop = useCallback(
    (_e: unknown, d: RndDragData) => {
      setLayout({
        position: { x: d.x, y: d.y },
        size: resolved.size,
      });
    },
    [resolved.size, setLayout]
  );

  const handleResizeStop = useCallback(
    (_e: unknown, _dir: unknown, ref: RndResizeRef, _delta: unknown, newPosition: RndDragData) => {
      setLayout({
        position: { x: newPosition.x, y: newPosition.y },
        size: { width: ref.offsetWidth, height: ref.offsetHeight },
      });
    },
    [setLayout]
  );

  const rndProps = useMemo(
    () => ({
      size: resolved.size,
      position: resolved.position,
      minWidth: CHAT_MODAL_MIN_WIDTH,
      minHeight: CHAT_MODAL_MIN_HEIGHT,
      maxWidth: Math.max(CHAT_MODAL_MIN_WIDTH, viewport.width - 32),
      maxHeight: Math.max(CHAT_MODAL_MIN_HEIGHT, viewport.height - 32),
      bounds: "window" as const,
      dragHandleClassName: DRAG_HANDLE_CLASSNAME,
      enableResizing: { top: true, left: true, topLeft: true },
      onDragStop: handleDragStop,
      onResizeStop: handleResizeStop,
    }),
    [resolved.position, resolved.size, viewport, handleDragStop, handleResizeStop]
  );

  return {
    hydrated,
    rndProps,
    resolved,
    /** 暴露默认值便于初始化场景 */
    defaults: {
      width: CHAT_MODAL_DEFAULT_WIDTH,
      height: CHAT_MODAL_DEFAULT_HEIGHT,
    },
  };
}
