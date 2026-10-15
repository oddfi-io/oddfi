/**
 * DD-118: 链上赔率数据形态归一 + 单调比较工具。
 *
 * 后端两个数据源同一语义字段类型不同：
 *  - REST `getOnchainMarkets.base_odds` → `number[]`（如 [2.29, 3.36]）
 *  - WS  `odds_updated.data.baseOdds`   → `string[]` 万分位整数（如 ["22900","33600"]）
 *
 * Store 内统一为「合约万分位整数字符串」形态。REST 兜底走 restBaseOddsToContractStrings 转换。
 */

/**
 * REST 浮点赔率 → 合约万分位整数字符串。
 *
 * 舍入硬约束：Math.round（half-up），不可用 floor/trunc —— 否则 1.005 截断成 "10049"
 * 会让赔率系统性向下偏 0.0001。
 */
export function restBaseOddsToContractStrings(numbers: number[]): string[] {
  return numbers.map((n) => {
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`[restBaseOddsToContractStrings] invalid odds value: ${n}`);
    }
    return Math.round(n * 10000).toString();
  });
}

/**
 * 比较两个 quoteVersion。返回 a - b 的符号（>0 / 0 / <0）。
 *
 * 当前 quoteVersion 在 number(uint64) 安全范围内。封装单点比较函数是为了未来若后端切到
 * 字符串/BigInt 也只改这里。
 */
export function compareQuoteVersion(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`[compareQuoteVersion] non-finite input: a=${a} b=${b}`);
  }
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}
