import { parseUnits, formatUnits } from "viem";
import { isGt, isValidAmount, formatBalance } from "@/lib/decimal";

/**
 * 将用户输入金额抹平到不超余额（不改变中间输入态）。
 *
 * - 空串 / 中间态（"0.", ".", "0.0"）/ "0" 原样返回，避免干扰键入节奏
 * - 余额 = 0n 时原样返回，交由上层 insufficientBalance UI 兜底
 * - raw > balance 时返回 `formatBalance(max, 6)`，与 MAX 按钮输出完全一致
 * - parseUnits 失败（过多小数位等）时原样返回
 */
export function clampAmountToBalance(raw: string, balanceWei: bigint, decimals: number): string {
  if (raw === "") return raw;
  if (!isValidAmount(raw)) return raw;
  if (balanceWei === 0n) return raw;
  try {
    const maxStr = formatUnits(balanceWei, decimals);
    if (isGt(raw, maxStr)) {
      return formatBalance(maxStr, 6);
    }
    return raw;
  } catch {
    return raw;
  }
}

/**
 * 判断 auto-switch + quote 的前置条件是否满足。
 *
 * 要求：
 * - amount 是合法正数
 * - parseUnits(amount, decimals) 成功
 * - 解析结果 ≤ balance（理论上 clamp 已处理，此处是二次保护）
 */
export function shouldTriggerSwitchAndQuote(
  amount: string,
  balanceWei: bigint,
  decimals: number
): boolean {
  if (!isValidAmount(amount)) return false;
  try {
    const raw = parseUnits(amount, decimals);
    if (raw === 0n) return false;
    if (raw > balanceWei) return false;
    return true;
  } catch {
    return false;
  }
}
