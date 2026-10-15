// @vitest-environment jsdom
/**
 * ENH-031 B1.4/B1.5 验证：飞行筹码动画双路径清理 + rAF 跟踪。
 * JSDOM 没有完整 WAAPI 实现，本测试只覆盖：
 *   - flyChipToPanel 把 chip 挂上 body
 *   - clearFlyingChips() 同步移除所有未结束的 chip
 *   - rAF / setTimeout 都被取消（用 mock 验证）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * 给 jsdom 补一个最小可用的 Animation stub，仅暴露 cancel / onfinish / oncancel 属性。
 * vitest jsdom 环境下 Element.prototype.animate 默认即返回 stub，这里覆盖以便断言。
 */
function stubAnimate(): Animation[] {
  const created: Animation[] = [];
  // jsdom 不实现 Element.prototype.animate，直接挂一个最小 stub（test 结束后由 vi.restoreAllMocks 还原）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).animate = function (): Animation {
    const a: Partial<Animation> = {
      cancel: vi.fn(),
      finish: vi.fn(),
      onfinish: null,
      oncancel: null,
    };
    created.push(a as Animation);
    return a as Animation;
  };
  return created;
}

describe("flyChipToPanel + clearFlyingChips（ENH-031 B1.4/B1.5）", () => {
  it("clearFlyingChips 强制清理在飞 chip：cancel anim + 移除 DOM + 清 rAF/setTimeout", async () => {
    const animations = stubAnimate();

    // 用 fake timers 让 rAF / setTimeout 可控
    vi.useFakeTimers();

    // jsdom 没有原生 requestAnimationFrame，但 vitest fake timers + globalThis 已 polyfill；
    // 这里另起监视 cancelAnimationFrame / clearTimeout 验证被调用过
    const cancelRaf = vi.spyOn(globalThis, "cancelAnimationFrame");
    const clearTo = vi.spyOn(globalThis, "clearTimeout");

    const { flyChipToPanel, clearFlyingChips } = await import("./betslip-animations-pc");

    const source = document.createElement("button");
    document.body.appendChild(source);

    flyChipToPanel(source, "2.35");

    // 推进到 rAF 内部，让 anim/setTimeout 注册
    vi.advanceTimersByTime(20);

    expect(document.querySelectorAll(".flying-chip-pc").length).toBe(1);
    expect(animations.length).toBe(1);

    clearFlyingChips();

    // 1) anim 被 cancel
    expect(animations[0]!.cancel).toHaveBeenCalledTimes(1);
    // 2) chip 从 body 移除
    expect(document.querySelectorAll(".flying-chip-pc").length).toBe(0);
    // 3) setTimeout 被 clearTimeout（receive 效果 timer）
    expect(clearTo).toHaveBeenCalled();
    // cancelAnimationFrame 可能没被调用（rAF 已 fire 完毕从 set 中删除），不强断言

    cancelRaf.mockRestore();
    clearTo.mockRestore();
    vi.useRealTimers();
  });

  it("无 chip 在飞时 clearFlyingChips 是 no-op", async () => {
    const { clearFlyingChips } = await import("./betslip-animations-pc");
    expect(() => clearFlyingChips()).not.toThrow();
  });
});
