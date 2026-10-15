/**
 * BetSlip H5 Animation Engine
 *
 * Pure imperative DOM animations — no React dependency.
 * All FAB animations use composite:"add" to preserve Tailwind's -translate-x-1/2 centering.
 */

// ─── Rapid-click detection ─────────────────────────────────────────────────
let lastFlyTime = 0;
const RAPID_THRESHOLD = 300;

export function isRapidAdd(): boolean {
  return Date.now() - lastFlyTime < RAPID_THRESHOLD;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFab(): HTMLElement | null {
  return document.getElementById("betslip-fab");
}

function getBadge(): HTMLElement | null {
  return document.getElementById("betslip-fab-badge");
}

/** Read --fn-brand CSS var and convert to rgba() string */
export function getBrandRgba(alpha: number): string {
  const hex = getComputedStyle(document.documentElement)
    .getPropertyValue("--fn-brand")
    .trim()
    .replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Fallback target when FAB is off-screen (during entry transition) */
function getFabTarget(): { x: number; y: number } {
  const badge = getBadge();
  if (badge) {
    const r = badge.getBoundingClientRect();
    // If badge is within viewport, use its center
    if (r.top < window.innerHeight && r.bottom > 0) {
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }
  // Fallback: bottom-center of viewport
  return { x: window.innerWidth / 2, y: window.innerHeight - 44 };
}

// ─── Odds button flash white ────────────────────────────────────────────────

export function flashOddsBtn(el: Element): void {
  // Find the brand-colored odds text — either the element itself or its child
  const target = el.querySelector(".text-brand-default") ?? (el as HTMLElement);
  if (!(target instanceof HTMLElement)) return;

  target.animate(
    [
      { color: "#ffffff", offset: 0 },
      { color: "#ffffff", offset: 0.5 },
      { color: "", offset: 1 },
    ],
    { duration: 120, easing: "linear" }
  );
}

/**
 * 赔率刷新 dimming 动画 — WAAPI 实现（参考 markets-replica_V2.html `.odd.dimming`）。
 *
 * 原型行为：赔率变动格 opacity 渐暗到 0.2（约 1s）→ 直接刷出新值复原，**文字颜色不变**
 * （恒 mint，不再涨绿/跌红）。React 中拿到回调时值已更新，故用 0.2→1 淡入模拟「刷出新赔率」。
 * 目标是 odds 数字元素（`.text-brand-default`）或传入的 ref 自身。
 */
export function dimOdds(el: Element): void {
  const target = el.querySelector(".text-brand-default") ?? (el as HTMLElement);
  if (!(target instanceof HTMLElement)) return;
  target.animate([{ opacity: 0.2 }, { opacity: 1 }], {
    duration: 1000,
    easing: "ease",
  });
}

/**
 * @deprecated 赔率更新动画已从 color-flash（涨绿/跌红）改为 dimming（不分方向，参考
 * markets-replica_V2.html）。`direction` 参数仅为兼容现有调用点保留，内部走 {@link dimOdds}。
 * 新代码请直接调用 `dimOdds(el)`。
 */
export function flashOddsDirection(el: Element, direction?: "up" | "down"): void {
  void direction; // 兼容旧调用签名（5 处仍传 direction）；dimming 不分方向，忽略它
  dimOdds(el);
}

// ─── FAB bounce (chip arrival) ──────────────────────────────────────────────

export function bounceFab(): void {
  const fab = getFab();
  if (!fab) return;

  fab.animate(
    [
      { transform: "scale(1)", offset: 0 },
      { transform: "scale(1.12)", offset: 0.25 },
      { transform: "scale(0.96)", offset: 0.5 },
      { transform: "scale(1.04)", offset: 0.7 },
      { transform: "scale(0.99)", offset: 0.85 },
      { transform: "scale(1)", offset: 1 },
    ],
    { duration: 250, easing: "ease-out", composite: "add" as CompositeOperation }
  );
}

// ─── FAB shake (rapid add) ──────────────────────────────────────────────────

export function shakeFab(): void {
  const fab = getFab();
  if (!fab) return;

  fab.animate(
    [
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(3px)", offset: 0.25 },
      { transform: "translateX(-3px)", offset: 0.5 },
      { transform: "translateX(3px)", offset: 0.75 },
      { transform: "translateX(0)", offset: 1 },
    ],
    { duration: 150, easing: "ease-in-out", composite: "add" as CompositeOperation }
  );
}

// ─── FAB shrink (non-last removal) ──────────────────────────────────────────

export function shrinkFab(): void {
  const fab = getFab();
  if (!fab) return;

  fab.animate(
    [
      { transform: "scale(1)", offset: 0 },
      { transform: "scale(0.95)", offset: 0.5 },
      { transform: "scale(1)", offset: 1 },
    ],
    { duration: 150, easing: "ease-out", composite: "add" as CompositeOperation }
  );
}

// ─── FAB glow ───────────────────────────────────────────────────────────────

export function glowFab(): void {
  const fab = getFab();
  if (!fab) return;

  fab.animate(
    [
      { boxShadow: `0 0 0px ${getBrandRgba(0)}` },
      { boxShadow: `0 0 10px ${getBrandRgba(0.3)}` },
      { boxShadow: `0 0 0px ${getBrandRgba(0)}` },
    ],
    { duration: 250, easing: "ease-out" }
  );
}

// ─── FAB ripple ─────────────────────────────────────────────────────────────

export function rippleFab(): void {
  const fab = getFab();
  if (!fab) return;

  const ripple = document.createElement("div");
  ripple.className = "fab-ripple-effect";
  fab.appendChild(ripple);

  const anim = ripple.animate(
    [
      { width: "0px", height: "0px", opacity: 0.15 },
      { width: "40px", height: "40px", opacity: 0 },
    ],
    { duration: 350, easing: "ease-out", fill: "forwards" }
  );

  anim.onfinish = () => ripple.remove();
}

// ─── Flying chip ────────────────────────────────────────────────────────────

export function flyChipToFab(sourceEl: Element, oddsText: string): void {
  lastFlyTime = Date.now();

  const chip = document.createElement("div");
  chip.className = "flying-chip";
  chip.textContent = oddsText;
  document.body.appendChild(chip);

  // Source position
  const sourceRect = sourceEl.getBoundingClientRect();
  const startX = sourceRect.left + sourceRect.width / 2 - 20;
  const startY = sourceRect.top + sourceRect.height / 2 - 10;

  // Target position (FAB badge)
  const target = getFabTarget();
  const endX = target.x - 20;
  const endY = target.y - 10;

  // Control point — upward arc
  const cpX = (startX + endX) / 2;
  const cpY = Math.min(startY, endY) - 60;

  // Build keyframes
  const DURATION = 300;
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

  // FAB receive effects at 75% of flight
  setTimeout(() => {
    bounceFab();
    glowFab();
    rippleFab();
    if (navigator.vibrate) navigator.vibrate(20);
  }, DURATION * 0.75);

  anim.onfinish = () => chip.remove();
}
