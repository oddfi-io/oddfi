/**
 * DD-130 链上质押 / 解押 状态机（仿 lib/betting/submit-onchain-bet.ts）。
 *
 *   stake:   staking   → stake_confirming   → success
 *   unstake: unstaking → unstake_confirming → success
 *
 * 与下注的差异：**无 approve 步**（后端 stake 内部自动 approve max）。
 *
 * 错误模型：
 * - StakeRevertedError / UnstakeRevertedError —— 链上 receipt status=reverted
 *   （含"未到期误调 unstake / 已终态再操作"等后端不校验、由合约 revert 的场景）
 * - ReceiptTimeoutError（receipt-poller）—— RPC 轮询超时
 * - 其他（后端 4xx：STAKE_AMOUNT_TOO_SMALL / INVALID_STAKE_PLAN / INSUFFICIENT_BALANCE /
 *   POSITION_NOT_OWNED）由 onchainStake / onchainUnstake 原样抛
 *
 * 测试 seam：deps 全部可注入，默认绑定 lib/api.ts + receipt-poller。
 */

import { parseUnits } from "viem";
import { onchainStake, onchainUnstake, onchainEarlyUnstake } from "@/lib/api";
import { waitForReceipt } from "@/lib/onchain/receipt-poller";
import type { OnchainStakeReq, OnchainUnstakeReq, OnchainTxRes } from "@/types/onchain-stake";
import type { WaitForReceiptResult } from "@/lib/onchain/receipt-poller";
import type { LockHoursKey } from "@/lib/staking-plans";

export type OnchainStakeState = "staking" | "stake_confirming" | "success";
export type OnchainUnstakeState = "unstaking" | "unstake_confirming" | "success";

export type UnstakeOp = "unstake" | "earlyUnstake";

export interface OnchainStakeInput {
  /**
   * 后端透传 key（branded LockHoursKey = 8/16/24/32/40/48），后端反查 plan_id。
   * DD-149：非真实锁仓时长（真实为 7/30/60/90/180/360 天），opaque，仅作反查键。
   */
  lockHours: LockHoursKey;
  /** 质押量 ODD 十进制字符串，如 "100" / "100.5" */
  stakeOdd: string;
  /** 业务幂等 seq；从 useIdempotentRefId().getOrCreate() 取 */
  seq: string;
  onState?: (state: OnchainStakeState) => void;
}

export interface OnchainUnstakeInput {
  positionId: string;
  /** unstake（到期，返本金+收益）| earlyUnstake（提前，仅本金） */
  op: UnstakeOp;
  onState?: (state: OnchainUnstakeState) => void;
}

export class StakeRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[OnchainStake] stake reverted on chain: ${txHash}`);
    this.name = "StakeRevertedError";
  }
}

export class UnstakeRevertedError extends Error {
  constructor(
    public txHash: string,
    public op: UnstakeOp
  ) {
    super(`[OnchainStake] ${op} reverted on chain: ${txHash}`);
    this.name = "UnstakeRevertedError";
  }
}

interface Deps {
  onchainStake: (req: OnchainStakeReq) => Promise<OnchainTxRes>;
  onchainUnstake: (req: OnchainUnstakeReq) => Promise<OnchainTxRes>;
  onchainEarlyUnstake: (req: OnchainUnstakeReq) => Promise<OnchainTxRes>;
  waitForReceipt: (hash: `0x${string}`) => Promise<WaitForReceiptResult>;
}

const defaultDeps: Deps = {
  onchainStake,
  onchainUnstake,
  onchainEarlyUnstake,
  waitForReceipt: (hash) => waitForReceipt(hash),
};

/** ODD 十进制串 → wei 字符串（×1e18），用 viem.parseUnits 精确转换 */
function stakeToWei(stakeOdd: string): string {
  return parseUnits(stakeOdd as `${number}`, 18).toString();
}

export async function submitOnchainStake(
  input: OnchainStakeInput,
  deps: Deps = defaultDeps
): Promise<{ txHash: `0x${string}` }> {
  const amountWei = stakeToWei(input.stakeOdd);

  input.onState?.("staking");
  const res = await deps.onchainStake({
    amount_wei: amountWei,
    lock_hours: input.lockHours,
    // DD-141：随机幂等 nonce = 业务 seq（useIdempotentRefId UUID）；retry 复用、新点击重生成。
    nonce: input.seq,
  });
  const txHash = res.tx_hash as `0x${string}`;

  input.onState?.("stake_confirming");
  const receipt = await deps.waitForReceipt(txHash);
  if (receipt.status === "reverted") {
    throw new StakeRevertedError(txHash);
  }

  input.onState?.("success");
  return { txHash };
}

export async function submitOnchainUnstake(
  input: OnchainUnstakeInput,
  deps: Deps = defaultDeps
): Promise<{ txHash: `0x${string}` }> {
  // DD-141：unstake / early_unstake 幂等键由后端按请求内容派生，前端不传字段。
  const req: OnchainUnstakeReq = {
    position_id: input.positionId,
  };

  input.onState?.("unstaking");
  const res =
    input.op === "earlyUnstake"
      ? await deps.onchainEarlyUnstake(req)
      : await deps.onchainUnstake(req);
  const txHash = res.tx_hash as `0x${string}`;

  input.onState?.("unstake_confirming");
  const receipt = await deps.waitForReceipt(txHash);
  if (receipt.status === "reverted") {
    throw new UnstakeRevertedError(txHash, input.op);
  }

  input.onState?.("success");
  return { txHash };
}
