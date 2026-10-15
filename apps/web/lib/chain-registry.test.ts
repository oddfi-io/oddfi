import { describe, it, expect } from "vitest";
import { getChainMeta, DEFAULT_CHAIN_META } from "./chain-registry";

describe("chain-registry", () => {
  it("returns BSC meta for chainId 56", () => {
    const meta = getChainMeta(56);
    expect(meta.chainId).toBe(56);
    expect(meta.name).toBe("BNB Chain");
    expect(meta.slug).toBe("smartchain");
    expect(meta.iconUrl).toBe("/images/chains/bsc.svg");
  });

  it("returns Ethereum meta for chainId 1", () => {
    const meta = getChainMeta(1);
    expect(meta.chainId).toBe(1);
    expect(meta.name).toBe("Ethereum");
    expect(meta.slug).toBe("ethereum");
    expect(meta.iconUrl).toBe("/images/chains/ethereum.svg");
  });

  it("returns Arbitrum meta for chainId 42161", () => {
    const meta = getChainMeta(42161);
    expect(meta.chainId).toBe(42161);
    expect(meta.name).toBe("Arbitrum");
    expect(meta.slug).toBe("arbitrum");
    expect(meta.iconUrl).toBe("/images/chains/arbitrum.png");
  });

  it("returns Base meta for chainId 8453", () => {
    const meta = getChainMeta(8453);
    expect(meta.chainId).toBe(8453);
    expect(meta.name).toBe("Base");
    expect(meta.slug).toBe("base");
    expect(meta.iconUrl).toBe("/images/chains/base.svg");
  });

  it("returns Polygon meta for chainId 137", () => {
    const meta = getChainMeta(137);
    expect(meta.chainId).toBe(137);
    expect(meta.name).toBe("Polygon");
    expect(meta.slug).toBe("polygon");
    expect(meta.iconUrl).toBe("/images/chains/polygon.png");
  });

  it("returns default (BSC) for unknown chainId", () => {
    const meta = getChainMeta(999);
    expect(meta).toEqual(DEFAULT_CHAIN_META);
  });

  it("returns default for undefined chainId", () => {
    const meta = getChainMeta(undefined);
    expect(meta).toEqual(DEFAULT_CHAIN_META);
  });

  it("DEFAULT_CHAIN_META has local iconUrl", () => {
    expect(DEFAULT_CHAIN_META.iconUrl).toMatch(/^\/images\/chains\//);
  });
});
