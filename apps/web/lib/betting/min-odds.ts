/**
 * DD-117 §3.4 — min_odds 决策。
 *
 * 输入均为万分位整数（合约单位）：lockedOdds、baseOdds、slippageBps（如 100 = 1%）。
 * 输出为应传给 place_bet 的 min_odds 万分位整数字符串。
 *
 * 决策矩阵（按优先级）：
 *  1. 可信路径：lockedOdds 非空 + !degraded + lockedOdds !== "0"
 *     → min_odds = floor(lockedOdds × (10000 - slippageBps) / 10000)
 *  2. 兜底路径：其他所有情况（idle/loading/error/degraded/lockedOdds=0）
 *     → min_odds = floor(baseOdds × (10000 - slippageBps) / 10000)
 *
 * 单位一致性：lockedOdds 与 baseOdds 都是万分位整数（同维度），slippage 也是万分位，
 * 计算结果仍是万分位整数字符串，不需要 wei 换算（wei 是 ODD 金额，赔率是无单位比率）。
 *
 * 全部走 bigint，避免 JS 浮点漂移（22900 × 0.99 = 22671 而非 22670.9999…）。
 */

const BASIS = 10000n;

export interface MinOddsInput {
  /** 后端 preview-signal 的 lockedOdds 字段；degraded=true 时为 "0" */
  lockedOddsBps: string | null | undefined;
  /** OnchainMarket.base_odds[outcome]，必填，作为兜底来源 */
  baseOddsBps: number;
  /** 滑点万分位整数，如 100 = 1% */
  slippageBps: number;
  /** 后端 RPC 降级标志 */
  degraded?: boolean;
}

export function computeMinOddsBps(input: MinOddsInput): string {
  const factor = BASIS - BigInt(input.slippageBps);
  if (factor <= 0n) {
    // 100% 滑点 → min_odds=0；保留为安全下限（合约会拒绝 0）
    return "0";
  }

  const locked = input.lockedOddsBps;
  const useLocked =
    !!locked && !input.degraded && locked !== "0" && /^\d+$/.test(locked) && BigInt(locked) > 0n;

  const source = useLocked ? BigInt(locked as string) : BigInt(input.baseOddsBps);
  const result = (source * factor) / BASIS;
  return result.toString();
}
