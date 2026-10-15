// 金额格式化。后端金额字段全是 string（DECIMAL(38,18)）。
// 禁止 parseFloat / 原生 toFixed —— 一律 decimal.js 保精度。
// 契约：api-conventions.md「金额计算」，03-pages.md §9。
import Decimal from "decimal.js";

// 格式化为带千分位的展示字符串。非法输入返回原值占位，不静默吞成 0。
export function formatAmount(
  value: string | number | null | undefined,
  options?: { decimals?: number; suffix?: string },
): string {
  if (value == null || value === "") return "—";
  const { decimals = 2, suffix } = options ?? {};
  let dec: Decimal;
  try {
    dec = new Decimal(value);
  } catch {
    console.warn("[amount] formatAmount received invalid decimal —", value);
    return "—";
  }
  // toFixed 走 decimal.js（非原生 Number.toFixed），保精度。
  const fixed = dec.toFixed(decimals);
  const [intPart, fracPart] = fixed.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = fracPart != null ? `${sign}${grouped}.${fracPart}` : `${sign}${grouped}`;
  return suffix ? `${body} ${suffix}` : body;
}

// 校验字符串是否为合法 decimal（供表单 validator / 输入预校验复用）。
export function isValidDecimal(value: string): boolean {
  if (value == null || value.trim() === "") return false;
  try {
    const d = new Decimal(value);
    return d.isFinite();
  } catch {
    return false;
  }
}

// 计算募集进度百分比（soldOdd / supplyOdd），返回 0–100 的 number（仅用于进度条宽度，非金额）。
export function progressPct(sold: string, supply: string): number {
  if (!isValidDecimal(sold) || !isValidDecimal(supply)) return 0;
  const supplyDec = new Decimal(supply);
  if (supplyDec.isZero() || supplyDec.isNegative()) return 0;
  const pct = new Decimal(sold).div(supplyDec).mul(100);
  return Math.min(100, Math.max(0, pct.toNumber()));
}
