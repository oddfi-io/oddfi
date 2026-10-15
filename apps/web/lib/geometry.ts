/**
 * 矩形几何工具（DD-108 §3.5 浮窗归位 overlap 检测核心）。
 *
 * 纯函数 + 与 DOM 解耦，便于独立单测。
 * REV-DD108-v1 C-2：从 components/ai-chat/AiChatModal.tsx 抽出，使关键归位逻辑可被测试覆盖。
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 两矩形重叠面积。无重叠返回 0。 */
export function rectOverlapArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

/** 矩形面积。坐标退化（right<=left / bottom<=top）返回 0。 */
export function rectArea(r: Rect): number {
  return Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
}
