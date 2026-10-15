/**
 * DD-146 TierSale 阶梯定价静态配置 + sale-state 纯派生。
 *
 * 镜像合约 `oddfi-ODD/src/modules/token/TierSale.sol`（已读源码核实，非训练数据推断）：
 *   TIER_COUNT=10 · TIER_SIZE=3_000_000 ODD · TOTAL_SALE_ODD=30_000_000 ODD
 *   getCurrentTier(): totalSold>=TOTAL → 10；否则 totalSold/TIER_SIZE + 1
 *   getRemainingByTier(t): totalSold>=tierEnd → 0；totalSold<=tierStart → TIER_SIZE；否则 tierEnd-totalSold
 *   soldOut(): totalSold == TOTAL
 *   第 N 档单价 = N × $0.01（PRICE_DENOMINATOR=100 → tier/100）
 *
 * sale-state 由前端直读链上 `totalSold()`（public view）后本地派生（DD §8.4④），零后端依赖。
 * 金额一律 bigint(wei) / decimal 字符串承接，禁原生 float（api-conventions.md §金额）。
 */

import { formatUnits } from "viem";
import { add, mul, div } from "@/lib/decimal";

export const TIER_COUNT = 10;
export const TIER_SIZE_ODD = 3_000_000;
export const TOTAL_SALE_ODD = 30_000_000;
/** 建池阈值 = 全部售罄（30M）。 */
export const POOL_THRESHOLD_ODD = TOTAL_SALE_ODD;

const WAD = 10n ** 18n;
export const TIER_SIZE_WEI = BigInt(TIER_SIZE_ODD) * WAD;
export const TOTAL_SALE_WEI = BigInt(TOTAL_SALE_ODD) * WAD;

/** 第 N 档单价（USD 十进制串，N×$0.01）。tier 1..10 → "0.01".."0.1"。 */
export function tierPriceUsd(tier: number): string {
  return div(String(tier), "100");
}

export interface TierRow {
  /** 档位 1..10。 */
  tier: number;
  /** 单价 USD 十进制串。 */
  priceUsd: string;
  /** 本档数量 ODD（整数串）。 */
  amountOdd: string;
  /** 截至本档结束的累计售出上限 ODD = tier × 3,000,000。 */
  cumulativeSoldOdd: string;
  /** 截至本档结束的累计募资上限 USD = Σ_{k=1..tier} k×0.01×3,000,000。 */
  cumulativeRaisedUsd: string;
}

/** 10 档静态表（档位 / 单价 / 数量 / 累计售出上限 / 累计募资上限）。 */
export const TIERS: TierRow[] = Array.from({ length: TIER_COUNT }, (_, i) => {
  const tier = i + 1;
  const amountOdd = String(TIER_SIZE_ODD);
  let cumulativeRaised = "0";
  for (let k = 1; k <= tier; k++) {
    cumulativeRaised = add(cumulativeRaised, mul(tierPriceUsd(k), amountOdd));
  }
  return {
    tier,
    priceUsd: tierPriceUsd(tier),
    amountOdd,
    cumulativeSoldOdd: String(tier * TIER_SIZE_ODD),
    cumulativeRaisedUsd: cumulativeRaised,
  };
});

export interface SaleState {
  /** 全局累计已售 ODD（人类可读整数串）。 */
  totalSoldOdd: string;
  /** 当前档位 1..10。 */
  currentTier: number;
  /** 当前档单价 USD 串。 */
  currentTierPriceUsd: string;
  /** 当前档已售 ODD（人类可读串）。 */
  currentTierSoldOdd: string;
  /** 当前档剩余 ODD（人类可读串）。 */
  currentTierRemainingOdd: string;
  /** 建池进度 % 串（totalSold / 30M × 100，保留一位小数）。 */
  poolProgressPct: string;
  /** 是否售罄（totalSold == 30M）。 */
  soldOut: boolean;
}

/**
 * 由链上 `totalSold()`（wei）派生完整 sale-state，逐行镜像合约语义。
 * @param totalSoldWei 链上 totalSold() 返回的 wei（bigint）。
 */
export function deriveSaleState(totalSoldWei: bigint): SaleState {
  const clamped =
    totalSoldWei > TOTAL_SALE_WEI ? TOTAL_SALE_WEI : totalSoldWei < 0n ? 0n : totalSoldWei;
  const soldOut = clamped >= TOTAL_SALE_WEI;

  // getCurrentTier()：售罄 → 10；否则 totalSold/TIER_SIZE + 1
  const currentTier = soldOut ? TIER_COUNT : Number(clamped / TIER_SIZE_WEI) + 1;

  // 当前档 [tierStart, tierEnd)
  const tierStart = BigInt(currentTier - 1) * TIER_SIZE_WEI;
  const tierEnd = BigInt(currentTier) * TIER_SIZE_WEI;
  const currentTierSoldWei = soldOut ? TIER_SIZE_WEI : clamped - tierStart;
  const currentTierRemainingWei = soldOut ? 0n : tierEnd - clamped;

  const totalSoldOdd = formatUnits(clamped, 18);
  // poolProgressPct = totalSold / 30M × 100，保留 1 位小数
  const pctRaw = mul(div(totalSoldOdd, String(TOTAL_SALE_ODD)), "100");
  const poolProgressPct = (Math.round(Number(pctRaw) * 10) / 10).toString();

  return {
    totalSoldOdd,
    currentTier,
    currentTierPriceUsd: tierPriceUsd(currentTier),
    currentTierSoldOdd: formatUnits(currentTierSoldWei, 18),
    currentTierRemainingOdd: formatUnits(currentTierRemainingWei, 18),
    poolProgressPct,
    soldOut,
  };
}
