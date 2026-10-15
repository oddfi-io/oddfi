/**
 * AI Chat 浮窗 viewport clamp / 默认定位 纯函数（DD-106 §3.5）。
 */
import {
  CHAT_MODAL_DEFAULT_INSET,
  CHAT_MODAL_MIN_HEIGHT,
  CHAT_MODAL_MIN_WIDTH,
  CHAT_MODAL_VIEWPORT_INSET,
} from "@/stores/aiChatLayoutStore";

export interface Viewport {
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface ResolvedLayout {
  position: Position;
  size: Size;
}

export interface LayoutInput {
  position: Position | null;
  size: Size;
}

/**
 * 给一个布局快照 + 视口尺寸，返回 clamp 后的 {position, size}。
 * - 尺寸 clamp 到 [MIN_W/MIN_H, vw-INSET / vh-INSET]
 * - position 为 null 时计算右下默认位置（贴右下，离边缘 24px）
 * - position 为越界值时回弹到视口内
 */
export function resolveLayout(input: LayoutInput, viewport: Viewport): ResolvedLayout {
  const maxW = Math.max(CHAT_MODAL_MIN_WIDTH, viewport.width - CHAT_MODAL_VIEWPORT_INSET);
  const maxH = Math.max(CHAT_MODAL_MIN_HEIGHT, viewport.height - CHAT_MODAL_VIEWPORT_INSET);

  const width = Math.min(maxW, Math.max(CHAT_MODAL_MIN_WIDTH, input.size.width));
  const height = Math.min(maxH, Math.max(CHAT_MODAL_MIN_HEIGHT, input.size.height));

  const inset = CHAT_MODAL_DEFAULT_INSET;
  const fallback: Position = {
    x: Math.max(inset, viewport.width - width - inset),
    y: Math.max(inset, viewport.height - height - inset),
  };

  const raw = input.position ?? fallback;
  const x = clamp(raw.x, 0, Math.max(0, viewport.width - width));
  const y = clamp(raw.y, 0, Math.max(0, viewport.height - height));

  return { position: { x, y }, size: { width, height } };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}
