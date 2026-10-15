/**
 * DD-105 链上下注单 leg 状态机：
 *
 *   approving → approve_confirming → betting → bet_confirming → success
 *                 (RPC poll)                       (RPC poll)
 *
 * 仅处理一笔下注。并行多笔由调用方循环调用（合约本身也是单 outcome）。
 *
 * 错误模型：
 * - ApproveRevertedError / BetRevertedError —— 链上 receipt status=reverted
 * - ReceiptTimeoutError（来自 receipt-poller）—— RPC 轮询超时
 * - 其他（后端 4xx、网络错误）由 onchainApprove / onchainPlaceBet 原样抛
 *
 * 测试 seam：第二个参数 `deps` 全部可注入，默认绑定 lib/api.ts + receipt-poller。
 */

import { parseUnits } from "viem";
import { onchainApprove, onchainPlaceBet } from "@/lib/api";
import { waitForReceipt } from "@/lib/onchain/receipt-poller";
import type { OnchainApproveReq, OnchainPlaceBetReq, OnchainTxRes } from "@/types/onchain-betting";
import type { WaitForReceiptResult } from "@/lib/onchain/receipt-poller";

export type OnchainBetState =
  | "approving"
  | "approve_confirming"
  | "betting"
  | "bet_confirming"
  | "success";

export interface OnchainBetInput {
  fixtureId: number;
  matchId: string;
  marketType: number;
  outcome: number;
  line: number;
  /** Stake in ODD as decimal string, e.g. "100" or "100.5" */
  stakeOdd: string;
  /** Decimal odds string from selection, e.g. "1.85" — 仅作为 minOddsBpsOverride 缺省时的兜底输入 */
  decimalOdds: string;
  /**
   * DD-117 — 由上游 min_odds 决策（computeMinOddsBps）计算好的万分位整数字符串。
   * 提供时优先使用，否则回退到 decimalOdds 派生（无滑点保护）。
   */
  minOddsBpsOverride?: string;
  /**
   * DD-119 P2 — 部分成交可接受下限（ODD wei 字符串）。
   * 缺省 = 全额（min_accepted = amount，全有或全无，维持原行为）。
   * 当 previewSignal 判定 partialFill 时，上游传入 acceptedAmount，允许合约部分成交并退回剩余。
   */
  minAcceptedWeiOverride?: string;
  /** 业务幂等 seq；从 useIdempotentRefId().getOrCreate() 取 */
  seq: string;
  /** UI 状态机回调（可选） */
  onState?: (state: OnchainBetState) => void;
  /**
   * DD-140 A1 — 延迟收据模式：true 时 place_bet relay 返回 200（tx 已提交、拿到
   * order_id）即 resolve，**不在前台等 place_bet receipt**。bet 是否上链确认 / revert
   * 由 usePendingOnchainBets 后台跟踪。用于"链上下单提交即入 MyBets"，释放 bet slip。
   * 缺省 false：保留原全程阻塞行为（approve→receipt→place_bet→receipt）。
   */
  deferReceipt?: boolean;
}

export interface OnchainBetResult {
  approveTxHash: `0x${string}`;
  betTxHash: `0x${string}`;
  /** 后端 onchain_tx_orders.order_id —— 供乐观态跟踪 getOnchainOrder（DD-140） */
  orderId: number;
}

export class ApproveRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[OnchainBet] Approve reverted on chain: ${txHash}`);
    this.name = "ApproveRevertedError";
  }
}

export class BetRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[OnchainBet] place_bet reverted on chain: ${txHash}`);
    this.name = "BetRevertedError";
  }
}

interface Deps {
  onchainApprove: (req: OnchainApproveReq) => Promise<OnchainTxRes>;
  onchainPlaceBet: (req: OnchainPlaceBetReq) => Promise<OnchainTxRes>;
  waitForReceipt: (hash: `0x${string}`) => Promise<WaitForReceiptResult>;
}

const defaultDeps: Deps = {
  onchainApprove,
  onchainPlaceBet,
  waitForReceipt: (hash) => waitForReceipt(hash),
};

/**
 * 把 ODD 十进制字符串转 wei (×1e18) 字符串。
 * 用 viem.parseUnits，不走 decimal.ts（后者面向显示，bigint 路径更直接）。
 */
function stakeToWei(stakeOdd: string): bigint {
  return parseUnits(stakeOdd as `${number}`, 18);
}

/**
 * approve 金额 = stake × 1.01（覆盖 1% 下注税）。
 * bigint ceiling division（×101 + 99 / 100）：宁多勿少，避免 100.0000…0001 stake
 * 截断后 allowance < stake×1.01 导致 place_bet 链上 revert。
 * (REV-DD105-v1 M-03)
 */
function withTax(stakeWei: bigint): bigint {
  return (stakeWei * 101n + 99n) / 100n;
}

/**
 * decimal odds "1.85" → "18500" 万分位整数字符串（min_odds 合约滑点下限）。
 * 用 viem.parseUnits（bigint，精确）替代 Number(...) * 10000（JS 浮点），
 * 避免 1.9999 → 19998.999... → floor=19998 这类边界精度漂移。
 * (REV-DD105-v1 C-01)
 */
function decimalOddsToBasisPoints(decimalOdds: string): string {
  // 边界检查保留：parseUnits 对 "abc" / 负号 / 空串会抛或得意外结果
  const v = Number(decimalOdds);
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`[OnchainBet] Invalid decimal odds: ${decimalOdds}`);
  }
  // 超过 4 位小数 viem 会向下截断，与 Math.floor 语义一致
  return parseUnits(decimalOdds as `${number}`, 4).toString();
}

export async function submitOnchainBet(
  input: OnchainBetInput,
  deps: Deps = defaultDeps
): Promise<OnchainBetResult> {
  const stakeWei = stakeToWei(input.stakeOdd);
  const approveWei = withTax(stakeWei);
  const stakeWeiStr = stakeWei.toString();
  const minOdds = input.minOddsBpsOverride ?? decimalOddsToBasisPoints(input.decimalOdds);

  // Step 1: approve（后端代签）
  input.onState?.("approving");
  const approveRes = await deps.onchainApprove({
    // DD-127：后端契约由裸 spender 地址改为白名单用途枚举；下注固定 "betting"，后端解析为 BettingPool。
    target: "betting",
    amount_wei: approveWei.toString(),
    // DD-141：approve 改由后端按请求内容派生幂等键，前端不再传 idempotency_key。
  });
  const approveTxHash = approveRes.tx_hash as `0x${string}`;

  // Step 2: 等 approve receipt
  input.onState?.("approve_confirming");
  const approveReceipt = await deps.waitForReceipt(approveTxHash);
  if (approveReceipt.status === "reverted") {
    throw new ApproveRevertedError(approveTxHash);
  }

  // Step 3: place_bet（后端代签，带 approve_tx_hash）
  input.onState?.("betting");
  const betRes = await deps.onchainPlaceBet({
    match_id: input.matchId,
    market_type: input.marketType,
    line: input.line,
    outcome: input.outcome,
    amount_wei: stakeWeiStr,
    // DD-119 P2：partial 时传 acceptedAmount（允许部分成交）；否则全额（原全有全无行为）
    min_accepted_amount_wei: input.minAcceptedWeiOverride ?? stakeWeiStr,
    min_odds: minOdds,
    approve_tx_hash: approveTxHash,
    // DD-141：随机幂等 nonce = 业务 seq（useIdempotentRefId 产出的 UUID）。
    // 挂起期/自动 retry 复用同一 seq → 同 nonce → 后端只上链一次；明确响应后 clear 换新 seq → 允许重复下注。
    nonce: input.seq,
  });
  const betTxHash = betRes.tx_hash as `0x${string}`;
  const orderId = betRes.order_id;

  // DD-140 A1：延迟收据模式 —— place_bet relay 200 即交付，bet receipt 由后台跟踪，不阻塞 bet slip
  if (input.deferReceipt) {
    return { approveTxHash, betTxHash, orderId };
  }

  // Step 4: 等 place_bet receipt（默认全程阻塞模式）
  input.onState?.("bet_confirming");
  const betReceipt = await deps.waitForReceipt(betTxHash);
  if (betReceipt.status === "reverted") {
    throw new BetRevertedError(betTxHash);
  }

  input.onState?.("success");
  return { approveTxHash, betTxHash, orderId };
}
