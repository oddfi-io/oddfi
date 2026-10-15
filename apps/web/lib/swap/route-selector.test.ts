import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { selectSwapRoute } from "@/lib/swap/route-selector";

describe("selectSwapRoute", () => {
  it("BSC (56) → pancake", () => {
    expect(selectSwapRoute(56)).toBe("pancake");
  });

  it("Arbitrum (42161) → relay", () => {
    expect(selectSwapRoute(42161)).toBe("relay");
  });

  it("Ethereum (1) → relay", () => {
    expect(selectSwapRoute(1)).toBe("relay");
  });

  it("Polygon (137) → relay", () => {
    expect(selectSwapRoute(137)).toBe("relay");
  });

  it("Base (8453) → relay", () => {
    expect(selectSwapRoute(8453)).toBe("relay");
  });

  it("未知链 Optimism (10) → relay（non-core）", () => {
    expect(selectSwapRoute(10)).toBe("relay");
  });
});

/**
 * DD-094: testnet 开放 swap，BSC Testnet (97) 为 core chain → pancake，其他链 → relay。
 */
describe("selectSwapRoute DD-094 testnet 路由", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "testnet");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("testnet：BSC Testnet (97) → pancake（core chain）", async () => {
    const { selectSwapRoute: fn } = await import("@/lib/swap/route-selector");
    expect(fn(97)).toBe("pancake");
  });

  it("testnet：BSC (56) → relay（非 core chain，testnet core 为 97）", async () => {
    const { selectSwapRoute: fn } = await import("@/lib/swap/route-selector");
    expect(fn(56)).toBe("relay");
  });

  it("testnet：Arbitrum (42161) → relay", async () => {
    const { selectSwapRoute: fn } = await import("@/lib/swap/route-selector");
    expect(fn(42161)).toBe("relay");
  });
});
