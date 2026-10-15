/**
 * ENH-040 多腿下注前置：一次性确保 betting allowance ≥ 总下注额（含税）。
 *
 * 背景：后端 BUG-002 修复后 betting approve 一律授 maxUint256（一次授权覆盖所有腿）。
 * 把 approve 前置成一次、再并行 place_bet → 所有腿 place_bet 200 ~同时返回 → 一起进 MyBets，
 * 消除「每腿各等自己 approve 上链回执」导致的逐条进 MyBets（approve 回执逐腿错开）。
 *
 * 测试 seam：deps 全注入，默认绑定 lib/api.ts + receipt-poller。
 */

import { parseUnits } from "viem";
import { onchainApprove } from "@/lib/api";
import { waitForReceipt } from "@/lib/onchain/receipt-poller";
import { ApproveRevertedError } from "./submit-onchain-bet";
import type { OnchainApproveReq, OnchainTxRes } from "@/types/onchain-betting";
import type { WaitForReceiptResult } from "@/lib/onchain/receipt-poller";

interface Deps {
  onchainApprove: (req: OnchainApproveReq) => Promise<OnchainTxRes>;
  waitForReceipt: (hash: `0x${string}`) => Promise<WaitForReceiptResult>;
}

const defaultDeps: Deps = {
  onchainApprove,
  waitForReceipt: (hash) => waitForReceipt(hash),
};

/**
 * approve 金额 = 总 stake × 1.01（覆盖 1% 下注税），bigint ceiling division。
 * 与 submit-onchain-bet.withTax 同口径：宁多勿少，避免截断后 allowance < 需求。
 * 注：后端实际授 MAX（amount_wei 仅参与后端「allowance 短路」的足额判定），
 * 传总额而非单腿额，确保短路判定覆盖本次全部腿的需求（旧精确额残留场景不误短路）。
 */
function withTax(stakeWei: bigint): bigint {
  return (stakeWei * 101n + 99n) / 100n;
}

/**
 * 行为：
 * - 后端读链发现 allowance 已足额（首次授权后恒 MAX）→ 短路不发 tx，回落空/旧 tx_hash：
 *   · 空 tx_hash → 视为已授权，跳过等回执（瞬时返回）；
 *   · 旧 tx_hash（已上链）→ waitForReceipt 首轮即命中，快速返回。
 * - 全新代理钱包首次 → 真发一笔 MAX approve，等其回执（~1 个块）。
 * - 回执 reverted → 抛 ApproveRevertedError（上层 handleOnchainFailure 友好映射）。
 * - 回执超时 → waitForReceipt 抛 ReceiptTimeoutError（同上层处理）。
 *
 * @param totalStakeOdd 所有腿下注额之和（ODD 十进制字符串，由 decimal.add 求和）
 */
export async function ensureBettingAllowance(
  totalStakeOdd: string,
  deps: Deps = defaultDeps
): Promise<void> {
  const approveWei = withTax(parseUnits(totalStakeOdd as `${number}`, 18));
  const res = await deps.onchainApprove({ target: "betting", amount_wei: approveWei.toString() });
  const txHash = (res.tx_hash ?? "").trim();
  // 后端 allowance 短路且无历史 approve 订单 → 空 tx_hash，视为已授权，无需等回执。
  if (!txHash) return;
  const receipt = await deps.waitForReceipt(txHash as `0x${string}`);
  if (receipt.status === "reverted") {
    throw new ApproveRevertedError(txHash);
  }
}
