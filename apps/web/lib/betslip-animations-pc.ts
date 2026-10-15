/**
 * BetSlip PC Animation Engine
 *
 * Pure imperative DOM animations — no React dependency.
 * Targets #betslip-panel / #betslip-multi-badge (PC side panel).
 * Completely isolated from H5 animations (betslip-animations.ts → FAB).
 */

// Re-export platform-agnostic helpers from H5 engine
export { flashOddsBtn, flashOddsDirection } from "./betslip-animations";
import { getBrandRgba } from "./betslip-animations";

// ─── Rapid-click detection (independent from H5) ──────────────────────────
let lastPcFlyTime = 0;
const RAPID_THRESHOLD = 300;

export function isPcRapidAdd(): boolean {
  return Date.now() - lastPcFlyTime < RAPID_THRESHOLD;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPanel(): HTMLElement | null {
  return document.getElementById("betslip-panel");
}

function getBadge(): HTMLElement | null {
  return document.getElementById("betslip-multi-badge");
}

/** Fallback target when badge is not yet rendered (panel opening transition) */
function getBadgeTarget(): { x: number; y: number } {
  const badge = getBadge();
  if (badge) {
    const r = badge.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }
  // Fallback: right edge, vertically centered in top area
  return { x: window.innerWidth - 220, y: 200 };
}

// ─── Panel pulse (chip arrival) ─────────────────────────────────────────────

export function panelPulse(): void {
  const panel = getPanel();
  if (!panel) return;

  panel.animate(
    [
      { boxShadow: `inset 0 0 0 0 ${getBrandRgba(0)}` },
      { boxShadow: `inset 0 0 30px 0 ${getBrandRgba(0.08)}` },
      { boxShadow: `inset 0 0 0 0 ${getBrandRgba(0)}` },
    ],
    { duration: 350, easing: "ease-out" }
  );
}

// ─── Panel shake (rapid add) ───────────────────────────────────────────��────

export function shakePanel(): void {
  const panel = getPanel();
  if (!panel) return;

  panel.animate(
    [
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(-3px)", offset: 0.25 },
      { transform: "translateX(3px)", offset: 0.5 },
      { transform: "translateX(-3px)", offset: 0.75 },
      { transform: "translateX(0)", offset: 1 },
    ],
    { duration: 150, easing: "ease-in-out" }
  );
}

// ─── Badge bounce ───────────────────────────────────────────────────────────

export function badgeBounce(): void {
  const badge = getBadge();
  if (!badge) return;

  badge.animate(
    [
      { transform: "scale(1)", offset: 0 },
      { transform: "scale(1.25)", offset: 0.4 },
      { transform: "scale(1)", offset: 1 },
    ],
    { duration: 250, easing: "ease-out" }
  );
}

// ─── Scroll to newest card ──────────────────────────────────────────────────

export function scrollToNewest(): void {
  const container = document.getElementById("betslip-cards-scroll");
  if (!container) return;

  // Wait for React to render the new card
  requestAnimationFrame(() => {
    const newest = container.querySelector("[data-newest='true']");
    if (newest) {
      newest.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

// ─── Flying chip → betslip panel badge ──────────────────────────────────────

/**
 * 跟踪所有在飞的 chip 动画，路由切换等场景调用 clearFlyingChips() 强制清理：
 * - WAAPI animation 的 onfinish 路径正常释放后已自移除
 * - cancel() 路径走 oncancel 双兜底（ENH-031 B1.4）
 * - 任何 rAF（pending start frame + onfinish 内的 panel/badge 效果延时）都登记 id，
 *   cancelAnimationFrame 时一并清掉，避免回调命中已 unmount DOM（ENH-031 B1.5）
 */
interface FlyingChipHandle {
  chip: HTMLDivElement;
  anim: Animation | null;
  rafIds: Set<number>;
  receiveTimerId: number | null;
}

const flyingChips = new Set<FlyingChipHandle>();

function disposeChip(handle: FlyingChipHandle): void {
  if (!flyingChips.has(handle)) return;
  flyingChips.delete(handle);
  handle.rafIds.forEach((id) => cancelAnimationFrame(id));
  handle.rafIds.clear();
  if (handle.receiveTimerId !== null) {
    clearTimeout(handle.receiveTimerId);
    handle.receiveTimerId = null;
  }
  if (handle.chip.isConnected) {
    handle.chip.remove();
  }
}

/** 路由切换 / panel unmount 时调用，强制清理所有在飞 chip。 */
export function clearFlyingChips(): void {
  // 拷贝快照避免迭代时变更
  Array.from(flyingChips).forEach((handle) => {
    handle.anim?.cancel();
    disposeChip(handle);
  });
}

export function flyChipToPanel(sourceEl: Element, oddsText: string): void {
  lastPcFlyTime = Date.now();

  const chip = document.createElement("div");
  chip.className = "flying-chip-pc";
  chip.textContent = oddsText;
  document.body.appendChild(chip);

  const handle: FlyingChipHandle = {
    chip,
    anim: null,
    rafIds: new Set(),
    receiveTimerId: null,
  };
  flyingChips.add(handle);

  // Source position
  const sourceRect = sourceEl.getBoundingClientRect();
  const startX = sourceRect.left + sourceRect.width / 2 - 20;
  const startY = sourceRect.top + sourceRect.height / 2 - 12;

  // Wait one frame so React can render the badge if panel just opened
  let startRafId = 0;
  startRafId = requestAnimationFrame(() => {
    handle.rafIds.delete(startRafId);
    // 已被外部取消则不再创建动画
    if (!flyingChips.has(handle)) return;
    const target = getBadgeTarget();
    const endX = target.x - 20;
    const endY = target.y - 12;

    // Control point — upward arc
    const cpX = (startX + endX) / 2;
    const cpY = Math.min(startY, endY) - 80;

    // Build keyframes
    const DURATION = 350;
    const STEPS = 90;
    const keyframes: Keyframe[] = [];

    const springDamping = 0.55;
    const springFreq = 3.5;

    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;

      // Ease-in-out progress
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      // Spring overshoot in last 40%
      let spring = eased;
      if (t > 0.6) {
        const st = (t - 0.6) / 0.4;
        const overshoot =
          Math.sin(st * Math.PI * springFreq) * Math.exp(-st * springFreq * springDamping);
        spring = eased + overshoot * 0.08;
      }

      // Quadratic bezier path
      const pathT = Math.min(1, Math.max(0, spring));
      const x =
        (1 - pathT) * (1 - pathT) * startX + 2 * (1 - pathT) * pathT * cpX + pathT * pathT * endX;
      const y =
        (1 - pathT) * (1 - pathT) * startY + 2 * (1 - pathT) * pathT * cpY + pathT * pathT * endY;

      // Scale: pop-in → shrink → spring bounce at landing
      let scale: number;
      if (t < 0.1) {
        const pt = t / 0.1;
        scale = pt < 0.6 ? (pt / 0.6) * 1.15 : 1.15 - ((pt - 0.6) / 0.4) * 0.15;
      } else if (t > 0.75) {
        const bt = (t - 0.75) / 0.25;
        scale = 0.5 + Math.sin(bt * Math.PI * 2.5) * Math.exp(-bt * 4) * 0.15;
      } else {
        const st = (t - 0.1) / 0.65;
        scale = 1 - st * 0.5;
      }

      const rotation = eased * 220;
      const opacity = t > 0.92 ? 1 - (t - 0.92) / 0.08 : 1;

      keyframes.push({
        left: `${x}px`,
        top: `${y}px`,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        opacity,
        offset: t,
      });
    }

    const anim = chip.animate(keyframes, {
      duration: DURATION,
      easing: "linear",
      fill: "forwards",
    });
    handle.anim = anim;

    // Panel receive effects at 75% of flight（用 window.setTimeout 拿到 number id，便于跨路由切换 clearTimeout）
    handle.receiveTimerId = window.setTimeout(() => {
      handle.receiveTimerId = null;
      panelPulse();
      badgeBounce();
    }, DURATION * 0.75);

    // 双路径清理（B1.4）：anim.cancel() 路径不会触发 onfinish，必须挂 oncancel
    anim.onfinish = () => disposeChip(handle);
    anim.oncancel = () => disposeChip(handle);
  });
  handle.rafIds.add(startRafId);
}
