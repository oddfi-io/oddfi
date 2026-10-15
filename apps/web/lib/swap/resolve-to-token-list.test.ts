import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveToTokenList, resolveDefaultToToken } from "./resolve-to-token-list";
import { BSC_TOKENS, TOKEN_BY_SYMBOL } from "@/lib/token-registry";
import { PLATFORM_TOKEN } from "@/lib/platform-token";

// BSC 链 ID = 56，非 BSC 链 ID = 42161 (Arbitrum), 137 (Polygon)

describe("resolveToTokenList", () => {
  it("BSC BNB（非 ODD）→ 包含其他 BSC 代币，不含 BNB 自身", () => {
    const bnb = BSC_TOKENS.find((t) => t.symbol === "BNB")!;
    const list = resolveToTokenList(bnb);
    // 不含自身
    expect(list.some((t) => t.address === bnb.address)).toBe(false);
    // 含 ODD（平台币）
    expect(list.some((t) => t.symbol === "ODD")).toBe(true);
    // 含 USDT
    expect(list.some((t) => t.symbol === "USDT")).toBe(true);
  });

  it("BSC ODD（反向）→ 不含 ODD 自身，含 BNB/USDT", () => {
    const odd = TOKEN_BY_SYMBOL.ODD;
    const list = resolveToTokenList(odd);
    expect(list.some((t) => t.symbol === "ODD")).toBe(false);
    expect(list.some((t) => t.symbol === "BNB")).toBe(true);
    expect(list.some((t) => t.symbol === "USDT")).toBe(true);
  });

  it("Arbitrum USDC → list = [PLATFORM_TOKEN]", () => {
    const arbUsdc = {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`,
      decimals: 6,
      iconUrl: "",
      tier: 7,
      chainId: 42161,
    };
    const list = resolveToTokenList(arbUsdc);
    expect(list).toHaveLength(1);
    expect(list[0].symbol).toBe(PLATFORM_TOKEN.symbol);
  });

  it("Polygon POL → list = [PLATFORM_TOKEN]", () => {
    const pol = {
      symbol: "POL",
      name: "POL",
      address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      decimals: 18,
      iconUrl: "",
      tier: 9,
      isNative: true,
      chainId: 137,
    };
    const list = resolveToTokenList(pol);
    expect(list).toHaveLength(1);
    expect(list[0].symbol).toBe(PLATFORM_TOKEN.symbol);
  });
});

/**
 * DD-094: testnet 模式下使用 BSC_TESTNET_TOKENS 池，剔除 ZERO_ADDR 占位。
 */
describe("resolveToTokenList DD-094 testnet 路由", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "testnet");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("testnet USDT (97) → 包含 ODD，不含 USDT 自身，不含 ZERO_ADDR 代币", async () => {
    const { resolveToTokenList: fn } = await import("./resolve-to-token-list");
    const { BSC_TESTNET_TOKENS } = await import("@/lib/token-registry");
    const usdtTestnet = BSC_TESTNET_TOKENS.find((t) => t.symbol === "USDT")!;
    const list = fn(usdtTestnet);
    const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
    expect(list.some((t) => t.symbol === "ODD")).toBe(true);
    expect(list.some((t) => t.symbol === "USDT")).toBe(false);
    expect(list.some((t) => t.address === ZERO_ADDR)).toBe(false);
  });

  it("testnet ODD (97) → 包含 USDT，不含 ODD 自身", async () => {
    const { resolveToTokenList: fn } = await import("./resolve-to-token-list");
    const { BSC_TESTNET_TOKENS } = await import("@/lib/token-registry");
    const oddTestnet = BSC_TESTNET_TOKENS.find((t) => t.symbol === "ODD")!;
    const list = fn(oddTestnet);
    expect(list.some((t) => t.symbol === "USDT")).toBe(true);
    expect(list.some((t) => t.symbol === "ODD")).toBe(false);
  });
});

describe("resolveDefaultToToken", () => {
  it("BSC BNB（非 ODD）→ 默认 PLATFORM_TOKEN（ODD）", () => {
    const bnb = BSC_TOKENS.find((t) => t.symbol === "BNB")!;
    const defaultTo = resolveDefaultToToken(bnb);
    expect(defaultTo.symbol).toBe(PLATFORM_TOKEN.symbol);
  });

  it("BSC ODD（反向）→ 默认 USDT", () => {
    const odd = TOKEN_BY_SYMBOL.ODD;
    const defaultTo = resolveDefaultToToken(odd);
    expect(defaultTo.symbol).toBe("USDT");
  });

  it("Arbitrum USDC → 默认 PLATFORM_TOKEN", () => {
    const arbUsdc = {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`,
      decimals: 6,
      iconUrl: "",
      tier: 7,
      chainId: 42161,
    };
    const defaultTo = resolveDefaultToToken(arbUsdc);
    expect(defaultTo.symbol).toBe(PLATFORM_TOKEN.symbol);
  });

  it("Polygon POL → 默认 PLATFORM_TOKEN", () => {
    const pol = {
      symbol: "POL",
      name: "POL",
      address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      decimals: 18,
      iconUrl: "",
      tier: 9,
      isNative: true,
      chainId: 137,
    };
    const defaultTo = resolveDefaultToToken(pol);
    expect(defaultTo.symbol).toBe(PLATFORM_TOKEN.symbol);
  });
});
