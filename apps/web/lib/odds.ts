import { formatUnits } from "viem";
import { div, formatAmount } from "./decimal";

/**
 * 概率 → 欧式赔率
 * e.g. "0.35" → "2.86"
 */
export function toOdds(probability: string): string {
  const p = Number(probability);
  if (!probability || p <= 0 || p >= 1) return "--";
  return formatAmount(div("1", probability), 2);
}

/**
 * 概率 → 带 x 后缀的赔率展示
 * e.g. "0.35" → "2.86x"
 */
export function toOddsDisplay(probability: string): string {
  const odds = toOdds(probability);
  if (odds === "--") return "--";
  return `${odds}x`;
}

/**
 * 后端 raw 赔率字符串 → 2 位小数展示。
 * 后端不同 market 返回精度不一（1x2 / Goal Line 可能 4 位，Asian Handicap 多为 2 位），
 * 展示侧统一收敛到 2 位。空值 / 占位 / 非法输入一律返回 "—"。
 */
export function formatOdds(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const s = typeof value === "string" ? value.trim() : value;
  if (s === "" || s === "—" || s === "--") return "—";
  try {
    return formatAmount(s, 2);
  } catch {
    return "—";
  }
}

/**
 * DD-118: 合约万分位整数字符串 → 2 位小数展示。
 *   "22900" → "2.29"
 *   "10100" → "1.01"
 *
 * 与 formatOdds 区分开 —— formatOdds 接的是后端 REST 已经做过转换的浮点字符串（"2.29"），
 * 直接传整数字符串给 formatOdds 会得到 "22900.00"，这是已知坑（已被 BUG/test 覆盖）。
 */
export function formatContractOdds(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "—";
  const n = typeof raw === "string" ? Number(raw.trim()) : raw;
  if (!Number.isFinite(n) || n < 0) return "—";
  // 万分位 / 10000；odds 范围 < 9999.9999，远在 IEEE-754 安全区。
  return formatAmount(div(String(n), "10000"), 2);
}

/**
 * DD-119 红灯锁定（signal===3 = 停止接单）的展示约定，供所有赔率格统一复用，
 * 视觉对齐详情页投注盘口（MatchBettingMarkets）：占位 "--" + 置灰 + 不可点。
 */
export const ODDS_LOCKED_TEXT = "--";
export const ODDS_LOCKED_CLASS = "bg-tertiary text-tertiary cursor-not-allowed";

/**
 * DD-119 P2: ODD wei 字符串 → ODD 主单位 2 位小数（formatAmount，无千分位，输入框安全）；非法输入返回 "0.00"。
 * 链上 previewSignal 返回的 acceptedAmount / maxAcceptableAmount 均为 ODD_WAD（18 位）。
 * 供 SignalLightIndicator + BetCard 部分成交文案复用（原为 SignalLightIndicator 私有函数）。
 */
export function formatOddWei(weiStr: string): string {
  try {
    return formatAmount(formatUnits(BigInt(weiStr), 18), 2);
  } catch {
    return "0.00";
  }
}
