/**
 * `RevertKind` → i18n key + 占位符值 的映射。
 *
 * 设计取舍：UI 层 (BetSummary) 拿到 `BetRevertedError` 后调用
 * `decodeRevertedTx` → `DecodedRevert`，再走本模块的映射函数取 i18n key 和
 * 占位符 args，最后用 next-intl `t(key, args)` 渲染 toast。
 *
 * 把"展示用 ODD 数值字符串"格式化集中在这里（合约层全是 wei），UI 不再关心
 * BigInt / 1e18 换算。
 */
import { formatUnits } from "viem";
import type { DecodedRevert, RevertKind } from "@/lib/onchain/revert-decoder";

/** 仅返回相对 `betSlip.error.*` 的 sub-key，调用方拼前缀 */
export function revertKindToI18nKey(kind: RevertKind): string {
  switch (kind) {
    case "bet-amount-below-min":
      return "betAmountBelowMin";
    case "pool-liquidity-insufficient":
      return "poolLiquidityInsufficient";
    case "market-locked":
      return "marketLocked";
    case "market-not-open":
      return "marketNotOpen";
    case "market-closed":
      return "marketClosed";
    case "invalid-quote-guard":
      return "invalidQuoteGuard";
    case "daily-limit-exceeded":
      return "dailyLimitExceeded";
    case "open-position-exceeded":
      return "openPositionExceeded";
    case "match-payout-exceeded":
      return "matchPayoutExceeded";
    case "erc20-insufficient-allowance":
      return "erc20InsufficientAllowance";
    case "erc20-insufficient-balance":
      return "erc20InsufficientBalance";
    case "contract-panic":
      return "contractPanic";
    case "unknown":
      return "txRevertedUnknown";
  }
}

/** 18 decimals wei → 不带尾部 0 的 ODD 字符串（"50000000000000000000" → "50"） */
function weiToOdd(v: unknown): string {
  if (typeof v !== "bigint") return String(v ?? "");
  // formatUnits 自带去尾零："50.000000000000000000" → "50"
  const s = formatUnits(v, 18);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/**
 * 把 `DecodedRevert.args` 按 kind 映射成 i18n 占位符 record。
 *
 * 注意：placeholders 的 key 名要与 messages/*.json 中 `betSlip.error.*` 文案
 * 占位符一致；改一处必须改两处。
 */
export function formatRevertArgs(decoded: DecodedRevert): Record<string, string | number> {
  const a = decoded.args;
  switch (decoded.kind) {
    case "bet-amount-below-min":
      return { amount: weiToOdd(a[0]), minimum: weiToOdd(a[1]) };
    case "pool-liquidity-insufficient":
      return { requested: weiToOdd(a[0]), available: weiToOdd(a[1]) };
    case "market-locked":
    case "market-not-open":
    case "market-closed":
      return { marketId: String(a[0] ?? "") };
    case "daily-limit-exceeded":
      return { attempted: weiToOdd(a[1]), remaining: weiToOdd(a[2]) };
    case "open-position-exceeded":
      return { attempted: weiToOdd(a[1]), allowed: weiToOdd(a[2]) };
    case "match-payout-exceeded":
      return { attempted: weiToOdd(a[2]), allowed: weiToOdd(a[3]) };
    case "erc20-insufficient-allowance":
      return { allowance: weiToOdd(a[1]), needed: weiToOdd(a[2]) };
    case "erc20-insufficient-balance":
      return { balance: weiToOdd(a[1]), needed: weiToOdd(a[2]) };
    case "invalid-quote-guard":
    case "unknown":
    default:
      return {};
  }
}
