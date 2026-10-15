import { describe, it, expect } from "vitest";
import { computeMinOddsBps } from "./min-odds";

describe("computeMinOddsBps — DD-117 §3.4 决策矩阵", () => {
  // ─── 可信路径 ────────────────────────────────────────────────────────────
  it("可信：lockedOdds 非零 + !degraded → 用 lockedOdds × (1-slippage)", () => {
    // 22900 × 0.99 = 22671
    expect(
      computeMinOddsBps({
        lockedOddsBps: "22900",
        baseOddsBps: 19500,
        slippageBps: 100,
        degraded: false,
      })
    ).toBe("22671");
  });

  it("可信：slippage=0 → min_odds = lockedOdds", () => {
    expect(
      computeMinOddsBps({
        lockedOddsBps: "18500",
        baseOddsBps: 19500,
        slippageBps: 0,
      })
    ).toBe("18500");
  });

  it("可信：slippage=500 (5%) → 22900 × 0.95 = 21755", () => {
    expect(
      computeMinOddsBps({
        lockedOddsBps: "22900",
        baseOddsBps: 19500,
        slippageBps: 500,
      })
    ).toBe("21755");
  });

  // ─── 兜底路径 ────────────────────────────────────────────────────────────
  it("兜底：lockedOdds 为 null → 用 baseOdds × (1-slippage)", () => {
    // 19500 × 0.99 = 19305
    expect(
      computeMinOddsBps({
        lockedOddsBps: null,
        baseOddsBps: 19500,
        slippageBps: 100,
      })
    ).toBe("19305");
  });

  it("兜底：degraded=true → 即使 lockedOdds 非空也走 baseOdds", () => {
    expect(
      computeMinOddsBps({
        lockedOddsBps: "22900",
        baseOddsBps: 19500,
        slippageBps: 100,
        degraded: true,
      })
    ).toBe("19305");
  });

  it("兜底：lockedOdds === '0' → 走 baseOdds", () => {
    expect(
      computeMinOddsBps({
        lockedOddsBps: "0",
        baseOddsBps: 19500,
        slippageBps: 100,
      })
    ).toBe("19305");
  });

  it("兜底：lockedOdds 非数字 → 走 baseOdds（防御性）", () => {
    expect(
      computeMinOddsBps({
        lockedOddsBps: "abc",
        baseOddsBps: 19500,
        slippageBps: 100,
      })
    ).toBe("19305");
  });

  // ─── 精度 / 边界 ─────────────────────────────────────────────────────────
  it("bigint floor 语义：22899 × 0.99 = 226700100/10000 = 22670（向下取整）", () => {
    expect(
      computeMinOddsBps({
        lockedOddsBps: "22899",
        baseOddsBps: 0,
        slippageBps: 100,
      })
    ).toBe("22670");
  });

  it("slippageBps=10000 (100%) → min_odds=0", () => {
    expect(
      computeMinOddsBps({
        lockedOddsBps: "22900",
        baseOddsBps: 19500,
        slippageBps: 10000,
      })
    ).toBe("0");
  });
});
