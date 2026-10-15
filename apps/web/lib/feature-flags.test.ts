// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * DD-144: lend / swap 上线收敛 flag SSOT。默认关闭（下架待回归），只认 "1"。
 * 常量在模块加载期定型，每个用例 resetModules + dynamic import。
 */
describe("lib/feature-flags", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("未设置 env → lend/swap 默认关闭", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEND_ENABLED", "");
    vi.stubEnv("NEXT_PUBLIC_SWAP_ENABLED", "");
    const { IS_LEND_ENABLED, IS_SWAP_ENABLED } = await import("./feature-flags");
    expect(IS_LEND_ENABLED).toBe(false);
    expect(IS_SWAP_ENABLED).toBe(false);
  });

  it("NEXT_PUBLIC_LEND_ENABLED=1 → IS_LEND_ENABLED=true（恢复路径）", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEND_ENABLED", "1");
    const { IS_LEND_ENABLED } = await import("./feature-flags");
    expect(IS_LEND_ENABLED).toBe(true);
  });

  it("NEXT_PUBLIC_SWAP_ENABLED=1 → IS_SWAP_ENABLED=true（恢复路径）", async () => {
    vi.stubEnv("NEXT_PUBLIC_SWAP_ENABLED", "1");
    const { IS_SWAP_ENABLED } = await import("./feature-flags");
    expect(IS_SWAP_ENABLED).toBe(true);
  });

  it("拼写错误（true / yes / on / 0）→ 一律关闭，只认 '1'", async () => {
    for (const bad of ["true", "yes", "on", "0"]) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_LEND_ENABLED", bad);
      vi.stubEnv("NEXT_PUBLIC_SWAP_ENABLED", bad);
      const m = await import("./feature-flags");
      expect(m.IS_LEND_ENABLED, `lend with "${bad}"`).toBe(false);
      expect(m.IS_SWAP_ENABLED, `swap with "${bad}"`).toBe(false);
    }
  });

  it("两个 flag 互相独立", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEND_ENABLED", "1");
    vi.stubEnv("NEXT_PUBLIC_SWAP_ENABLED", "");
    const { IS_LEND_ENABLED, IS_SWAP_ENABLED } = await import("./feature-flags");
    expect(IS_LEND_ENABLED).toBe(true);
    expect(IS_SWAP_ENABLED).toBe(false);
  });
});

describe("isNavItemLaunchHidden", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("默认（flag off）隐藏 lend/swap，其他项保留", async () => {
    const { isNavItemLaunchHidden } = await import("./feature-flags");
    expect(isNavItemLaunchHidden("lend")).toBe(true);
    expect(isNavItemLaunchHidden("swap")).toBe(true);
    for (const key of ["markets", "stake", "pools", "referral", "oddPresale"]) {
      expect(isNavItemLaunchHidden(key), key).toBe(false);
    }
  });

  it("flag 启用后对应项不再隐藏（各自独立）", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEND_ENABLED", "1");
    const { isNavItemLaunchHidden } = await import("./feature-flags");
    expect(isNavItemLaunchHidden("lend")).toBe(false);
    expect(isNavItemLaunchHidden("swap")).toBe(true);
  });
});

describe("isDisabledFeatureRoute", () => {
  const LOCALES = new Set(["en", "zh", "ja", "ko"]);

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("默认关闭时拦截 /lend、/swap 及子路径（含合法 locale 前缀）", async () => {
    const { isDisabledFeatureRoute } = await import("./feature-flags");
    for (const p of ["/lend", "/swap", "/lend/", "/swap/detail", "/en/lend", "/zh/swap/x"]) {
      expect(isDisabledFeatureRoute(p, LOCALES), p).toBe(true);
    }
  });

  it("非 lend/swap 路由不拦截", async () => {
    const { isDisabledFeatureRoute } = await import("./feature-flags");
    for (const p of ["/", "/markets", "/stake", "/en/markets", "/lender", "/swapper"]) {
      expect(isDisabledFeatureRoute(p, LOCALES), p).toBe(false);
    }
  });

  it("非法 locale 前缀不误判（/xx/lend 放行）", async () => {
    const { isDisabledFeatureRoute } = await import("./feature-flags");
    expect(isDisabledFeatureRoute("/xx/lend", LOCALES)).toBe(false);
  });

  it("功能启用后对应路由不再拦截", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEND_ENABLED", "1");
    const { isDisabledFeatureRoute } = await import("./feature-flags");
    expect(isDisabledFeatureRoute("/lend", LOCALES)).toBe(false);
    // swap 仍关闭 → 仍拦截
    expect(isDisabledFeatureRoute("/swap", LOCALES)).toBe(true);
  });
});
