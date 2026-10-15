// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * DD-103: 早鸟模式 flag SSOT。flag 误写必须回落到关闭态（不影响 testnet/dev/pre）。
 * 因常量在模块加载期 freeze，每个用例 resetModules + dynamic import。
 */
describe("lib/early-bird-mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("NEXT_PUBLIC_EARLY_BIRD_MODE=1 → IS_EARLY_BIRD_MODE=true", async () => {
    vi.stubEnv("NEXT_PUBLIC_EARLY_BIRD_MODE", "1");
    const { IS_EARLY_BIRD_MODE } = await import("./early-bird-mode");
    expect(IS_EARLY_BIRD_MODE).toBe(true);
  });

  it("未设置 env → 默认关闭", async () => {
    vi.stubEnv("NEXT_PUBLIC_EARLY_BIRD_MODE", "");
    const { IS_EARLY_BIRD_MODE } = await import("./early-bird-mode");
    expect(IS_EARLY_BIRD_MODE).toBe(false);
  });

  it("拼写错误（true / yes / on / 0）→ 一律关闭，只认 '1'", async () => {
    vi.stubEnv("NEXT_PUBLIC_EARLY_BIRD_MODE", "true");
    const m1 = await import("./early-bird-mode");
    expect(m1.IS_EARLY_BIRD_MODE).toBe(false);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_EARLY_BIRD_MODE", "yes");
    const m2 = await import("./early-bird-mode");
    expect(m2.IS_EARLY_BIRD_MODE).toBe(false);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_EARLY_BIRD_MODE", "0");
    const m3 = await import("./early-bird-mode");
    expect(m3.IS_EARLY_BIRD_MODE).toBe(false);
  });

  it("DD-113 互斥：认购模式开启 → 早鸟强制关闭（即使 NEXT_PUBLIC_EARLY_BIRD_MODE=1）", async () => {
    vi.stubEnv("NEXT_PUBLIC_EARLY_BIRD_MODE", "1");
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "1");
    const { IS_EARLY_BIRD_MODE } = await import("./early-bird-mode");
    expect(IS_EARLY_BIRD_MODE).toBe(false);
  });

  it("DD-113 互斥：仅早鸟开启 → 早鸟正常启用", async () => {
    vi.stubEnv("NEXT_PUBLIC_EARLY_BIRD_MODE", "1");
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "");
    const { IS_EARLY_BIRD_MODE } = await import("./early-bird-mode");
    expect(IS_EARLY_BIRD_MODE).toBe(true);
  });
});
