/**
 * DD-105 链上领奖：
 *
 *   onchain_claim_payout(bet_id) → tx_hash → poll receipt
 *
 * 与 submit-onchain-bet 不同，claim 不需要 approve 步骤——后端 hot wallet 直接代签合约调用。
 *
 * `getOnchainBetId(record)` 是 onchain_bet_id 的单点访问层(DD-105 Batch 7 · 字段已落地):
 * 后端 fdf73a2 把 onchain_bet_id 放在 `LedgerRecord.bet_id *string` 顶层(不在 event_info 下),
 * 字段位置以后再改只动这一处。
 *
 * `isOnchainBetNotReadyError` 用于 catch 后端 ErrOnchainBetNotReady（事件索引未回填）的边界判定。
 * 该状态不算失败，UI 层应吐 "链上结算确认中，请稍后" 并保留按钮可用。
 */

import { HTTPError } from "ky";
import { onchainClaimPayout } from "@/lib/api";
import { waitForReceipt, type WaitForReceiptResult } from "@/lib/onchain/receipt-poller";
import type { OnchainClaimPayoutReq, OnchainTxRes } from "@/types/onchain-betting";
import type { LedgerRecord } from "@/types/auth";

export class OnchainClaimRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[OnchainClaim] Claim reverted on chain: ${txHash}`);
    this.name = "OnchainClaimRevertedError";
  }
}

export interface OnchainClaimInput {
  /** 后端 onchain_bet_id（0x 前缀或裸 64 位 hex，前端不做规整） */
  betId: string;
}

export interface OnchainClaimResult {
  txHash: `0x${string}`;
}

interface Deps {
  onchainClaimPayout: (req: OnchainClaimPayoutReq) => Promise<OnchainTxRes>;
  waitForReceipt: (hash: `0x${string}`) => Promise<WaitForReceiptResult>;
}

const defaultDeps: Deps = {
  onchainClaimPayout,
  waitForReceipt: (hash) => waitForReceipt(hash),
};

/**
 * 单点访问层:后端 fdf73a2 把 onchain_bet_id 放在 LedgerRecord 顶层 `bet_id *string`。
 * 接受完整 LedgerRecord 或 null/undefined(兼容老接口/链下行)。
 */
export function getOnchainBetId(
  record: Pick<LedgerRecord, "bet_id" | "business_type"> | null | undefined
): string | null {
  if (!record) return null;
  if (record.business_type !== "onchain_single") return null;
  return record.bet_id ?? null;
}

export async function submitOnchainClaim(
  input: OnchainClaimInput,
  deps: Deps = defaultDeps
): Promise<OnchainClaimResult> {
  // DD-141：claim 改由后端按 bet_id 派生幂等键（一笔注单只能领一次），前端不再传 idempotency_key。
  const res = await deps.onchainClaimPayout({
    bet_id: input.betId,
  });
  const txHash = res.tx_hash as `0x${string}`;

  const receipt = await deps.waitForReceipt(txHash);
  if (receipt.status === "reverted") {
    throw new OnchainClaimRevertedError(txHash);
  }
  return { txHash };
}

// ─── 错误分类（后端 ENH-007 guard） ─────────────────────────────────────────

/**
 * claim_payout 失败分类（决定 UI 动作）。后端 ENH-007 在 relay 代发前同步校验链上状态，
 * 已终态注单返回 HTTP 400 + 稳定 message 前缀（后端单测钉住），**无 tx 上链**——与
 * `OnchainClaimRevertedError`（已广播后链上 revert）是不同阶段的错误，走 HTTP 错误分类。
 *
 * - not-claimable-cashed-out：注单已提前兑现，无奖金可领 → 终态，刷新列表
 * - not-claimable-claimed：奖金已领取（重复操作）→ 终态，刷新列表
 * - not-claimable：其余不可领状态（refunded/lost/未来新枚举 state_<N> 兜底）→ 终态，刷新列表
 * - state-unverified：后端读链失败且降级配额耗尽（HTTP 503，retryable）→ 不刷新，可原地重试
 * - unknown：网络错误等其它情况
 */
export type ClaimErrorKind =
  | "not-claimable-cashed-out"
  | "not-claimable-claimed"
  | "not-claimable"
  | "state-unverified"
  | "unknown";

const NOT_CLAIMABLE_MARKER = "onchain bet not claimable";
const ALREADY_CASHED_OUT_MARKER = "state=cashed_out";
const ALREADY_CLAIMED_MARKER = "state=won_claimed";
const STATE_UNVERIFIED_MARKER = "state unverified";

/**
 * 统一从 responseJSON.message（lib/api.ts beforeError 已挂载）+ error.message 子串匹配，
 * 与 classifyCashoutError 同构。`isOnchainBetNotReadyError` / instanceof 分支由调用方
 * （useOnchainClaim.onError）先行拦截，本函数只兜 guard 新错误码。
 */
export function classifyClaimError(error: unknown): ClaimErrorKind {
  if (!error) return "unknown";

  let msg = "";
  if (error instanceof HTTPError) {
    const json = (error as { responseJSON?: { message?: string; code?: unknown } }).responseJSON;
    msg = `${json?.message ?? ""} ${String(json?.code ?? "")}`;
  }
  if (error instanceof Error) {
    msg += ` ${error.message}`;
  }
  const lower = msg.toLowerCase();

  // 先细后粗：cashed_out / won_claimed 单独成类（文案区分），其余 state 走泛用不可领
  if (lower.includes(NOT_CLAIMABLE_MARKER)) {
    if (lower.includes(ALREADY_CASHED_OUT_MARKER)) return "not-claimable-cashed-out";
    if (lower.includes(ALREADY_CLAIMED_MARKER)) return "not-claimable-claimed";
    return "not-claimable";
  }
  if (lower.includes(STATE_UNVERIFIED_MARKER)) return "state-unverified";
  return "unknown";
}

/**
 * 判定后端 ErrOnchainBetNotReady（事件索引未回填）。
 * 该错误返回 HTTP 400，code=ErrOnchainBetNotReady 或 message 含 "not ready"。
 * UI 应展示 "链上结算确认中，请稍后" 而非通用错误。
 */
export function isOnchainBetNotReadyError(error: unknown): boolean {
  if (!error) return false;

  // ky HTTPError: 优先取 responseJSON.code
  if (error instanceof HTTPError) {
    const code = (error as { responseJSON?: { code?: string } }).responseJSON?.code;
    if (code === "ErrOnchainBetNotReady") return true;
  }

  // Fallback: 后端早期未返回 code 时按 message 子串匹配
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("not ready") || msg.includes("erronchainbetnotready");
  }
  return false;
}
