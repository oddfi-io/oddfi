// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * DD-113: 认购模式 flag SSOT。flag 误写必须回落到关闭态。
 * 因常量在模块加载期 freeze，每个用例 resetModules + dynamic import。
 */
describe("lib/subscription-mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("NEXT_PUBLIC_SUBSCRIPTION_MODE=1 → IS_SUBSCRIPTION_MODE=true", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "1");
    const { IS_SUBSCRIPTION_MODE } = await import("./subscription-mode");
    expect(IS_SUBSCRIPTION_MODE).toBe(true);
  });

  it("未设置 env → 默认关闭", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "");
    const { IS_SUBSCRIPTION_MODE } = await import("./subscription-mode");
    expect(IS_SUBSCRIPTION_MODE).toBe(false);
  });

  it("拼写错误（true / yes / on / 0）→ 一律关闭，只认 '1'", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "true");
    const m1 = await import("./subscription-mode");
    expect(m1.IS_SUBSCRIPTION_MODE).toBe(false);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "yes");
    const m2 = await import("./subscription-mode");
    expect(m2.IS_SUBSCRIPTION_MODE).toBe(false);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_MODE", "0");
    const m3 = await import("./subscription-mode");
    expect(m3.IS_SUBSCRIPTION_MODE).toBe(false);
  });
});
