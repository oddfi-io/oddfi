// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * DD-079: network-mode 是切换唯一入口，env 误写必须回落到安全值（mainnet）。
 * 因为常量在模块加载期就被 freeze，每个用例必须 resetModules + dynamic import。
 */
describe("lib/network-mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("NEXT_PUBLIC_NETWORK_MODE=testnet → ACTIVE_NETWORK=testnet, IS_TESTNET=true, CORE_CHAIN=bscTestnet", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "testnet");
    const { ACTIVE_NETWORK, IS_TESTNET, ACTIVE_CORE_CHAIN } = await import("./network-mode");
    expect(ACTIVE_NETWORK).toBe("testnet");
    expect(IS_TESTNET).toBe(true);
    expect(ACTIVE_CORE_CHAIN.id).toBe(97);
  });

  it("NEXT_PUBLIC_NETWORK_MODE=mainnet → mainnet", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "mainnet");
    const { ACTIVE_NETWORK, IS_TESTNET, ACTIVE_CORE_CHAIN } = await import("./network-mode");
    expect(ACTIVE_NETWORK).toBe("mainnet");
    expect(IS_TESTNET).toBe(false);
    expect(ACTIVE_CORE_CHAIN.id).toBe(56);
  });

  it("未设置 env → 默认回落 mainnet", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "");
    const { ACTIVE_NETWORK, IS_TESTNET } = await import("./network-mode");
    expect(ACTIVE_NETWORK).toBe("mainnet");
    expect(IS_TESTNET).toBe(false);
  });

  it("env 拼写错误（如 TESTNET / prod / 随意字符串）→ 默认回落 mainnet", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "TESTNET");
    const m1 = await import("./network-mode");
    expect(m1.IS_TESTNET).toBe(false);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "prod");
    const m2 = await import("./network-mode");
    expect(m2.IS_TESTNET).toBe(false);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "gibberish");
    const m3 = await import("./network-mode");
    expect(m3.IS_TESTNET).toBe(false);
  });
});
