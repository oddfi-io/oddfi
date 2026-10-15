import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BSC_TOKENS,
  TOKEN_BY_SYMBOL,
  TOKEN_REGISTRY,
  getTokensForChain,
  WBNB_ADDRESS,
  SWAP_TOKENS,
  getTokenBySymbol,
} from "./token-registry";

const EXPECTED_SYMBOLS = ["BNB", "USDT", "USDC", "ODD"];

describe("BSC_TOKENS", () => {
  it("contains all 4 expected tokens", () => {
    const symbols = BSC_TOKENS.map((t) => t.symbol);
    EXPECTED_SYMBOLS.forEach((s) => expect(symbols).toContain(s));
    expect(BSC_TOKENS).toHaveLength(4);
  });

  it("all tokens have positive tier", () => {
    BSC_TOKENS.forEach((token) => {
      expect(token.tier).toBeGreaterThan(0);
    });
  });

  it("tier values are unique and descending (BNB highest)", () => {
    const tiers = BSC_TOKENS.map((t) => t.tier);
    const sorted = [...tiers].sort((a, b) => b - a);
    expect(tiers).toEqual(sorted);
    expect(new Set(tiers).size).toBe(tiers.length);
  });

  it("BNB is the only native token", () => {
    const natives = BSC_TOKENS.filter((t) => t.isNative);
    expect(natives).toHaveLength(1);
    expect(natives[0].symbol).toBe("BNB");
  });

  it("all non-native tokens have valid hex addresses", () => {
    BSC_TOKENS.filter((t) => !t.isNative).forEach((token) => {
      expect(token.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  it("all tokens have iconUrl set", () => {
    BSC_TOKENS.forEach((token) => {
      expect(token.iconUrl).toBeTruthy();
      expect(token.iconUrl).toMatch(/^(https:\/\/|\/?images\/)/);
    });
  });

  it("TOKEN_BY_SYMBOL lookup returns correct token", () => {
    expect(TOKEN_BY_SYMBOL.BNB.isNative).toBe(true);
    expect(TOKEN_BY_SYMBOL.USDT.symbol).toBe("USDT");
    expect(TOKEN_BY_SYMBOL.ODD.symbol).toBe("ODD");
  });

  it("all tokens have decimals defined", () => {
    BSC_TOKENS.forEach((token) => {
      expect(token.decimals).toBeGreaterThan(0);
    });
  });
});

describe("TOKEN_REGISTRY & getTokensForChain", () => {
  it("maps chainId 56 to BSC_TOKENS", () => {
    expect(TOKEN_REGISTRY[56]).toBe(BSC_TOKENS);
  });

  it("getTokensForChain(56) returns BSC tokens", () => {
    expect(getTokensForChain(56)).toBe(BSC_TOKENS);
  });

  it("getTokensForChain returns empty array for unknown chain", () => {
    expect(getTokensForChain(999)).toEqual([]);
  });
});

describe("Swap-specific exports", () => {
  it("WBNB_ADDRESS is a valid 0x address", () => {
    expect(WBNB_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("SWAP_TOKENS equals BSC_TOKENS (all BSC tokens available for swap)", () => {
    expect(SWAP_TOKENS).toBe(BSC_TOKENS);
    expect(SWAP_TOKENS).toHaveLength(4);
  });

  it("getTokenBySymbol finds USDT on BSC", () => {
    const token = getTokenBySymbol(56, "USDT");
    expect(token).toBeDefined();
    expect(token?.symbol).toBe("USDT");
  });

  it("getTokenBySymbol returns undefined for unknown symbol", () => {
    expect(getTokenBySymbol(56, "UNKNOWN")).toBeUndefined();
  });

  it("getTokenBySymbol returns undefined for unknown chain", () => {
    expect(getTokenBySymbol(999, "USDT")).toBeUndefined();
  });
});

/**
 * DD-079/DD-142: TOKEN_BY_SYMBOL 从 TOKEN_REGISTRY[CORE_CHAIN.id] 派生。
 * proxy 退役后两网均查真 ODD（mainnet 56 / testnet 97），不会因 mode 切换错表。
 */
describe("TOKEN_BY_SYMBOL mode 切换（DD-142 proxy 退役）", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("mainnet：TOKEN_BY_SYMBOL.ODD 指向 BSC 主网 ODD（chainId=56）", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "mainnet");
    const { TOKEN_BY_SYMBOL: MAINNET } = await import("./token-registry");
    expect(MAINNET.ODD).toBeDefined();
    expect(MAINNET.ODD.symbol).toBe("ODD");
    expect(MAINNET.ODD.chainId).toBe(56);
    expect(MAINNET.TODD).toBeUndefined();
  });

  it("testnet：TOKEN_BY_SYMBOL.ODD 指向 BSC Testnet ODD（chainId=97）", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "testnet");
    const { TOKEN_BY_SYMBOL: TESTNET } = await import("./token-registry");
    expect(TESTNET.ODD).toBeDefined();
    expect(TESTNET.ODD.symbol).toBe("ODD");
    expect(TESTNET.ODD.chainId).toBe(97);
    expect(TESTNET.TODD).toBeUndefined();
  });

  it("testnet：TOKEN_REGISTRY[97] 含 BNB/USDC/USDT/ODD 四条目", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_MODE", "testnet");
    const { TOKEN_REGISTRY: REG } = await import("./token-registry");
    const symbols = REG[97]?.map((t) => t.symbol) ?? [];
    expect(symbols).toEqual(expect.arrayContaining(["BNB", "USDC", "USDT", "ODD"]));
  });
});
