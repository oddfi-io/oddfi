import { describe, it, expect } from "vitest";
import { bsc, mainnet, polygon, arbitrum, base } from "wagmi/chains";
import {
  isSupportedChain,
  isCoreChain,
  CORE_CHAIN,
  SUPPORTED_CHAINS,
  CHAIN_RPC,
  BALANCE_READ_CHAINS,
  BALANCE_CHAIN_RPC,
  ALL_CHAINS,
  ALL_CHAIN_RPC,
} from "./chains";

describe("isSupportedChain", () => {
  it("returns true for BSC mainnet (56)", () => {
    expect(isSupportedChain(56)).toBe(true);
  });

  it("returns true for Ethereum mainnet (1) — Phase 2 supported chain", () => {
    expect(isSupportedChain(1)).toBe(true);
  });

  it("returns true for Polygon (137)", () => {
    expect(isSupportedChain(137)).toBe(true);
  });

  it("returns true for Arbitrum (42161)", () => {
    expect(isSupportedChain(42161)).toBe(true);
  });

  it("returns true for Base (8453)", () => {
    expect(isSupportedChain(8453)).toBe(true);
  });

  it("returns false for BSC testnet (97)", () => {
    expect(isSupportedChain(97)).toBe(false);
  });

  it("returns false for unknown chainId 0", () => {
    expect(isSupportedChain(0)).toBe(false);
  });
});

describe("CORE_CHAIN", () => {
  it("is BSC", () => {
    expect(CORE_CHAIN.id).toBe(bsc.id);
  });
});

describe("isCoreChain", () => {
  it("returns true for BSC mainnet (56)", () => {
    expect(isCoreChain(56)).toBe(true);
  });

  it("returns false for Ethereum (1)", () => {
    expect(isCoreChain(1)).toBe(false);
  });

  it("returns false for Arbitrum (42161)", () => {
    expect(isCoreChain(42161)).toBe(false);
  });

  it("returns false for Base (8453)", () => {
    expect(isCoreChain(8453)).toBe(false);
  });

  it("returns false for Polygon (137)", () => {
    expect(isCoreChain(137)).toBe(false);
  });

  it("returns false for unknown chainId 0", () => {
    expect(isCoreChain(0)).toBe(false);
  });
});

describe("SUPPORTED_CHAINS", () => {
  it("contains 5 chains (Phase 2 — BSC + ETH + Polygon + Arbitrum + Base)", () => {
    expect(SUPPORTED_CHAINS).toHaveLength(5);
  });

  it("BSC is the first chain", () => {
    expect(SUPPORTED_CHAINS[0].id).toBe(bsc.id);
  });
});

describe("CHAIN_RPC", () => {
  it("has an entry for BSC chainId", () => {
    expect(Object.prototype.hasOwnProperty.call(CHAIN_RPC, bsc.id)).toBe(true);
  });
});

describe("BALANCE_READ_CHAINS", () => {
  it("contains 5 chains (BSC + ETH + Polygon + Arbitrum + Base)", () => {
    expect(BALANCE_READ_CHAINS).toHaveLength(5);
  });

  it("BSC is included", () => {
    expect(BALANCE_READ_CHAINS.some((c) => c.id === bsc.id)).toBe(true);
  });

  it("includes Ethereum mainnet", () => {
    expect(BALANCE_READ_CHAINS.some((c) => c.id === mainnet.id)).toBe(true);
  });

  it("includes Polygon", () => {
    expect(BALANCE_READ_CHAINS.some((c) => c.id === polygon.id)).toBe(true);
  });

  it("includes Arbitrum", () => {
    expect(BALANCE_READ_CHAINS.some((c) => c.id === arbitrum.id)).toBe(true);
  });

  it("includes Base", () => {
    expect(BALANCE_READ_CHAINS.some((c) => c.id === base.id)).toBe(true);
  });
});

describe("BALANCE_CHAIN_RPC", () => {
  it("has an entry for BSC chainId", () => {
    expect(Object.prototype.hasOwnProperty.call(BALANCE_CHAIN_RPC, bsc.id)).toBe(true);
  });

  it("has an entry for Ethereum chainId", () => {
    expect(Object.prototype.hasOwnProperty.call(BALANCE_CHAIN_RPC, mainnet.id)).toBe(true);
  });

  it("has an entry for Arbitrum chainId", () => {
    expect(Object.prototype.hasOwnProperty.call(BALANCE_CHAIN_RPC, arbitrum.id)).toBe(true);
  });

  it("has an entry for Base chainId", () => {
    expect(Object.prototype.hasOwnProperty.call(BALANCE_CHAIN_RPC, base.id)).toBe(true);
  });

  it("has an entry for Polygon chainId", () => {
    expect(Object.prototype.hasOwnProperty.call(BALANCE_CHAIN_RPC, polygon.id)).toBe(true);
  });
});

describe("ALL_CHAINS", () => {
  it("contains at least 5 chains (deduped union of SUPPORTED + BALANCE_READ)", () => {
    expect(ALL_CHAINS.length).toBeGreaterThanOrEqual(5);
  });

  it("has no duplicate chainIds", () => {
    const ids = ALL_CHAINS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("ALL_CHAIN_RPC", () => {
  it("has entries for all BALANCE_READ_CHAINS", () => {
    for (const chain of BALANCE_READ_CHAINS) {
      expect(Object.prototype.hasOwnProperty.call(ALL_CHAIN_RPC, chain.id)).toBe(true);
    }
  });
});
