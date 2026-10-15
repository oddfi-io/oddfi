/**
 * DD-146 TierSale 购买状态机核心（纯异步，deps 全可注入便于单测）。
 *
 * 蓝本：lib/betting/submit-onchain-bet.ts（approve→waitReceipt→place→waitReceipt）
 *      + lib/betting/ensure-betting-allowance.ts（空 tx_hash 短路 = 已授权）。
 *
 * 关键差异（DD-146 §3.2）：
 * - approve 的是 **USDT**（不是 ODD）；buy 入参是 **ODD 数量**（odd_amount_wei）。
 * - receipt 判定用 `"success" / "reverted"` 字符串（receipt-poller 口径），不用 Lark 文档的 1/0。
 * - poll 超时（ReceiptTimeoutError）由上层捕获进「对账态」，**禁止盲重发**（防双买）。
 *
 *   approving → approve_confirming → buying → buy_confirming → success
 *                 (RPC poll)                    (RPC poll)
 */

import { approveTierSale, buyTierSale } from "./api";
import { waitForReceipt } from "@/lib/onchain/receipt-poller";
import { cmp, sub, div } from "@/lib/decimal";
import type { OnchainTxRes } from "@/types/onchain-betting";
import type { WaitForReceiptResult } from "@/lib/onchain/receipt-poller";

export type TierSaleBuyState =
  | "approving"
  | "approve_confirming"
  | "buying"
  | "buy_confirming"
  | "success";

/** approve 链上 receipt = reverted（USDT 授权失败，不进 buy）。 */
export class TierSaleApproveRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[TierSaleBuy] Approve reverted on chain: ${txHash}`);
    this.name = "TierSaleApproveRevertedError";
  }
}

/** buy 链上 receipt = reverted（未授权 / 余额不足 / 售罄等，可换 nonce 重试）。 */
export class TierSaleBuyRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[TierSaleBuy] Buy reverted on chain: ${txHash}`);
    this.name = "TierSaleBuyRevertedError";
  }
}

export interface TierSaleBuyInput {
  /** 购买 ODD 数量 wei（取自 estimate 的 odd_amount_wei，下单的权威数值）。 */
  oddAmountWei: string;
  /** 授权 USDT 额度 wei（取 fresh estimate 的 usdt_cost × 1e18）；后端实际授满额，此值仅参与足额短路判定。 */
  usdtApproveWei: string;
  /** 幂等 nonce（一次购买意图锁定，retry 复用）。 */
  nonce: string;
  /** UI 状态机回调。 */
  onState?: (state: TierSaleBuyState) => void;
}

export interface TierSaleBuyResult {
  /** 空串 = 已授权短路（无 approve tx）。 */
  approveTxHash: string;
  buyTxHash: `0x${string}`;
  orderId: number;
}

interface Deps {
  approveTierSale: (amountWei: string) => Promise<OnchainTxRes>;
  buyTierSale: (req: { odd_amount_wei: string; nonce: string }) => Promise<OnchainTxRes>;
  waitForReceipt: (hash: `0x${string}`) => Promise<WaitForReceiptResult>;
}

const defaultDeps: Deps = {
  approveTierSale,
  buyTierSale,
  waitForReceipt: (hash) => waitForReceipt(hash),
};

/**
 * 滑点闸：estimate 与下单瞬间的 USDT 花费漂移是否超过容差。
 *
 * |fresh - prev| / prev > toleranceBps/10000 → 超阈值，上层中止并提示「价格变动请重新确认」。
 * 全程 decimal.ts，禁原生 float。prev 为 "0" / 非法时按未超阈处理（无基准，交由 estimate 自身校验）。
 *
 * @param prevUsdtCost 用户上次看到的 usdt_cost（十进制串）
 * @param freshUsdtCost re-estimate 返回的 usdt_cost（十进制串）
 * @param toleranceBps 容差（万分位），默认 100 = 1%
 */
export function isSlippageExceeded(
  prevUsdtCost: string,
  freshUsdtCost: string,
  toleranceBps = 100
): boolean {
  if (!prevUsdtCost || cmp(prevUsdtCost, "0") <= 0) return false;
  const diff = sub(freshUsdtCost, prevUsdtCost);
  const absDiff = cmp(diff, "0") < 0 ? sub("0", diff) : diff;
  const ratio = div(absDiff, prevUsdtCost);
  return cmp(ratio, div(String(toleranceBps), "10000")) > 0;
}

/**
 * 执行一笔 TierSale 购买（approve→poll→buy→poll）。
 *
 * 抛出：
 * - TierSaleApproveRevertedError / TierSaleBuyRevertedError —— 链上 receipt = reverted
 * - ReceiptTimeoutError（receipt-poller）—— RPC 轮询超时（上层进对账态，禁止盲重发）
 * - 其它（后端 4xx/5xx、网络错误）由 approveTierSale / buyTierSale 原样抛
 */
export async function submitTierSaleBuy(
  input: TierSaleBuyInput,
  deps: Deps = defaultDeps
): Promise<TierSaleBuyResult> {
  // Step 1: approve USDT（后端代签；已授权时短路返回空 tx_hash）
  input.onState?.("approving");
  const approveRes = await deps.approveTierSale(input.usdtApproveWei);
  const approveTxHash = (approveRes.tx_hash ?? "").trim();

  // Step 2: 等 approve receipt（空 tx_hash = 已授权，跳过等待）
  if (approveTxHash) {
    input.onState?.("approve_confirming");
    const approveReceipt = await deps.waitForReceipt(approveTxHash as `0x${string}`);
    if (approveReceipt.status === "reverted") {
      throw new TierSaleApproveRevertedError(approveTxHash);
    }
  }

  // Step 3: buy（ODD 数量 + 幂等 nonce）
  input.onState?.("buying");
  const buyRes = await deps.buyTierSale({
    odd_amount_wei: input.oddAmountWei,
    nonce: input.nonce,
  });
  const buyTxHash = buyRes.tx_hash as `0x${string}`;

  // Step 4: 等 buy receipt
  input.onState?.("buy_confirming");
  const buyReceipt = await deps.waitForReceipt(buyTxHash);
  if (buyReceipt.status === "reverted") {
    throw new TierSaleBuyRevertedError(buyTxHash);
  }

  input.onState?.("success");
  return { approveTxHash, buyTxHash, orderId: buyRes.order_id };
}
