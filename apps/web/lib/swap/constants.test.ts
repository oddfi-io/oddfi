import { describe, it, expect } from "vitest";
import { PANCAKE_ROUTER_V2, DEX_ROUTER, ROUTER_ABI, ERC20_ABI, getDeadline } from "./constants";
import { bsc } from "wagmi/chains";

describe("swap/constants", () => {
  it("PANCAKE_ROUTER_V2 should be a valid 0x address", () => {
    expect(PANCAKE_ROUTER_V2).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("DEX_ROUTER should map bsc.id to PANCAKE_ROUTER_V2", () => {
    expect(DEX_ROUTER[bsc.id]).toBe(PANCAKE_ROUTER_V2);
  });

  it("ROUTER_ABI should include getAmountsOut", () => {
    const method = ROUTER_ABI.find((m) => m.name === "getAmountsOut");
    expect(method).toBeDefined();
    expect(method?.stateMutability).toBe("view");
  });

  it("ROUTER_ABI should include all 3 swap functions", () => {
    const names = ROUTER_ABI.map((m) => m.name);
    expect(names).toContain("swapExactETHForTokens");
    expect(names).toContain("swapExactTokensForETH");
    expect(names).toContain("swapExactTokensForTokens");
  });

  it("ERC20_ABI should include balanceOf, allowance, approve, transfer", () => {
    const names = ERC20_ABI.map((m) => m.name);
    expect(names).toContain("balanceOf");
    expect(names).toContain("allowance");
    expect(names).toContain("approve");
    expect(names).toContain("transfer");
  });

  it("getDeadline should return current time + 20 min as bigint", () => {
    const before = BigInt(Math.floor(Date.now() / 1000) + 19 * 60);
    const deadline = getDeadline();
    const after = BigInt(Math.floor(Date.now() / 1000) + 21 * 60);
    expect(deadline).toBeGreaterThanOrEqual(before);
    expect(deadline).toBeLessThanOrEqual(after);
  });
});
