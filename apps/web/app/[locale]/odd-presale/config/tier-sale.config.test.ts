import { describe, it, expect } from "vitest";
import {
  deriveSaleState,
  tierPriceUsd,
  TIERS,
  TIER_COUNT,
  TOTAL_SALE_WEI,
  TIER_SIZE_WEI,
} from "./tier-sale.config";

const WAD = 10n ** 18n;
const odd = (n: number) => BigInt(n) * WAD;

describe("tierPriceUsd", () => {
  it("第 N 档 = N×$0.01", () => {
    expect(tierPriceUsd(1)).toBe("0.01");
    expect(tierPriceUsd(5)).toBe("0.05");
    expect(tierPriceUsd(10)).toBe("0.1");
  });
});

describe("TIERS 静态表", () => {
  it("10 档，数量恒 3,000,000", () => {
    expect(TIERS).toHaveLength(TIER_COUNT);
    expect(TIERS.every((t) => t.amountOdd === "3000000")).toBe(true);
  });
  it("累计售出上限 = tier × 3M；累计募资上限递增", () => {
    expect(TIERS[0].cumulativeSoldOdd).toBe("3000000");
    expect(TIERS[9].cumulativeSoldOdd).toBe("30000000");
    // 档1 募资 = 0.01×3M = 30000；档2 = 30000 + 0.02×3M = 90000
    expect(TIERS[0].cumulativeRaisedUsd).toBe("30000");
    expect(TIERS[1].cumulativeRaisedUsd).toBe("90000");
  });
});

describe("deriveSaleState（逐行镜像合约）", () => {
  it("totalSold=0 → 第 1 档，本档剩 3M，进度 0", () => {
    const s = deriveSaleState(0n);
    expect(s.currentTier).toBe(1);
    expect(s.currentTierSoldOdd).toBe("0");
    expect(s.currentTierRemainingOdd).toBe("3000000");
    expect(s.poolProgressPct).toBe("0");
    expect(s.soldOut).toBe(false);
  });

  it("档内（1.5M）→ 第 1 档，已售 1.5M / 剩 1.5M，进度 5", () => {
    const s = deriveSaleState(odd(1_500_000));
    expect(s.currentTier).toBe(1);
    expect(s.currentTierSoldOdd).toBe("1500000");
    expect(s.currentTierRemainingOdd).toBe("1500000");
    expect(s.poolProgressPct).toBe("5");
  });

  it("档边界（恰好 3M）→ 进第 2 档（合约 totalSold/TIER_SIZE+1）", () => {
    const s = deriveSaleState(TIER_SIZE_WEI);
    expect(s.currentTier).toBe(2);
    expect(s.currentTierSoldOdd).toBe("0");
    expect(s.currentTierRemainingOdd).toBe("3000000");
    expect(s.currentTierPriceUsd).toBe("0.02");
    expect(s.poolProgressPct).toBe("10");
  });

  it("跨档（12.78M）→ 第 5 档，本档已售 0.78M，进度 42.6（设计稿示例）", () => {
    const s = deriveSaleState(odd(12_780_000));
    expect(s.currentTier).toBe(5);
    expect(s.currentTierSoldOdd).toBe("780000");
    expect(s.currentTierRemainingOdd).toBe("2220000");
    expect(s.poolProgressPct).toBe("42.6");
  });

  it("售罄（30M）→ 第 10 档，soldOut，剩 0，进度 100", () => {
    const s = deriveSaleState(TOTAL_SALE_WEI);
    expect(s.currentTier).toBe(TIER_COUNT);
    expect(s.soldOut).toBe(true);
    expect(s.currentTierRemainingOdd).toBe("0");
    expect(s.poolProgressPct).toBe("100");
  });

  it("超额/负值兜底 clamp 到 [0, 30M]", () => {
    expect(deriveSaleState(odd(99_000_000)).soldOut).toBe(true);
    expect(deriveSaleState(-5n).currentTier).toBe(1);
  });
});
