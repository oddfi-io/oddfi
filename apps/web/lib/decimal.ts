import Decimal from "decimal.js";

// Configure Decimal.js
Decimal.set({ precision: 28, rounding: Decimal.ROUND_DOWN });

// ============================================================
// Basic arithmetic — use these instead of native float ops
// ============================================================

export const add = (a: string, b: string): string =>
  new Decimal(a || "0").plus(new Decimal(b || "0")).toString();

export const sub = (a: string, b: string): string =>
  new Decimal(a || "0").minus(new Decimal(b || "0")).toString();

export const mul = (a: string, b: string): string =>
  new Decimal(a || "0").times(new Decimal(b || "0")).toString();

export const div = (a: string, b: string): string => {
  if (!b || new Decimal(b).isZero()) return "0";
  return new Decimal(a || "0").div(new Decimal(b)).toString();
};

// ============================================================
// Display formatting
// ============================================================

export const formatAmount = (val: string | number, decimals = 2): string =>
  new Decimal(val || "0").toFixed(decimals);

/** formatAmount + thousand separators — for UI display only, never for inputs/calculations */
export const formatDisplayAmount = (val: string | number, decimals = 2): string => {
  const fixed = new Decimal(val || "0").toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec ? `${formatted}.${dec}` : formatted;
};

export const formatPercent = (val: string | number, decimals = 1): string =>
  `${new Decimal(val || "0").times(100).toFixed(decimals)}%`;

export const formatPrice = (val: string | number): string => new Decimal(val || "0").toFixed(2);

/**
 * Smart balance formatter: strips trailing zeros.
 * "1.000000" → "1", "0.001230" → "0.00123", "1.234500" → "1.2345"
 */
export const formatBalance = (val: string | number, maxDecimals = 6): string => {
  const d = new Decimal(val || "0");
  if (d.isZero()) return "0";
  const fixed = d.toFixed(maxDecimals);
  if (fixed.includes(".")) {
    return fixed.replace(/0+$/, "").replace(/\.$/, "");
  }
  return fixed;
};

/**
 * 自适应金额显示（value-scaled precision）—— 大额观感保持整数，小额保留有效位，
 * 避免"有余额却被取整成 0"的误导（曾在认购汇总区把 0.2267 ODD 显示成 0）。
 *   - ≥ 1      → 整数 + 千分位（2,000 / 5）
 *   - ≥ 0.01   → 2 位小数（0.22，与邀请记录一致）
 *   - ≥ 0.0001 → 4 位小数（0.0045）
 *   - 0 < v    → "<0.0001"（极小值不抹成 0）
 *   - 0 / 空    → "0"
 * 取整沿用全局 ROUND_DOWN（token 余额不虚高）。
 * UX 参考：value-scaled precision — https://javierlo.com/blog/ux-of-decimals
 */
export const formatAdaptiveAmount = (val: string | number): string => {
  const d = new Decimal(val || "0");
  if (d.isZero()) return "0";
  const abs = d.abs();
  if (abs.gte(1)) return formatDisplayAmount(val, 0);
  if (abs.gte("0.01")) return formatAmount(val, 2);
  if (abs.gte("0.0001")) return formatAmount(val, 4);
  return "<0.0001";
};

export const formatCompact = (val: string | number): string => {
  const n = new Decimal(val || "0");
  if (n.gte(1_000_000)) return `$${n.div(1_000_000).toFixed(1)}M`;
  if (n.gte(1_000)) return `$${n.div(1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

// ============================================================
// Trade calculations
// ============================================================

/**
 * Calculate estimated shares when buying
 * Buy: spend `amount` USDT, each share costs `price` → get amount/price shares
 */
export const calcEstimatedShares = (amount: string, price: string): string => {
  if (!amount || !price || new Decimal(price || "0").isZero()) return "0";
  return new Decimal(amount).div(new Decimal(price)).toFixed(2);
};

/**
 * Calculate estimated return if outcome resolves YES (shares → USDT at $1/share)
 */
export const calcEstimatedReturn = (shares: string): string => {
  if (!shares) return "0";
  return new Decimal(shares).toFixed(2);
};

/**
 * Calculate profit/loss ratio
 */
export const calcProfitRatio = (shares: string, cost: string): string => {
  if (!cost || new Decimal(cost || "0").isZero()) return "0";
  return new Decimal(shares).minus(new Decimal(cost)).div(new Decimal(cost)).times(100).toFixed(1);
};

// ============================================================
// Currency conversion
// ============================================================

/** @deprecated 硬编码 1:1 汇率。组件内使用 useCurrencyDisplay().convert()，数据映射层用 convertOdd(amount, rate)。 */
export const oddToUsd = (oddAmount: string): string => new Decimal(oddAmount || "0").toFixed(2);

/**
 * 将 ODD 金额按给定汇率转为 USD（纯函数，用于非 Hook 场景，如 useMemo 数据映射）。
 * rate 为 null/空字符串时返回 ODD 原值（降级），由调用方决定展示单位。
 */
export const convertOdd = (oddAmount: string, rate: string | null): string => {
  if (rate == null || rate === "") return oddAmount || "0";
  try {
    const r = new Decimal(rate);
    if (!r.gt(0)) return oddAmount || "0";
    return new Decimal(oddAmount || "0").times(r).toString();
  } catch {
    return oddAmount || "0";
  }
};

// ============================================================
// Validation helpers
// ============================================================

export const isValidAmount = (val: string): boolean => {
  if (!val) return false;
  try {
    const d = new Decimal(val);
    return d.gt(0);
  } catch {
    return false;
  }
};

export const isGt = (a: string, b: string): boolean => {
  try {
    return new Decimal(a || "0").gt(new Decimal(b || "0"));
  } catch {
    return false;
  }
};

/** Compare two decimal strings: returns -1, 0, or 1 (safe sort comparator) */
export const cmp = (a: string, b: string): number =>
  new Decimal(a || "0").comparedTo(new Decimal(b || "0"));
