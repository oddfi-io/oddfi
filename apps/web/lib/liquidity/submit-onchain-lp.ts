/**
 * DD-130 链上加流动性 / 取钱 状态机（仿 lib/staking/submit-onchain-stake.ts）。
 *
 *   deposit_global / deposit_match: depositing → deposit_confirming → success
 *   request_unbond:                 unbonding  → unbond_confirming  → success
 *   withdraw:                       withdrawing→ withdraw_confirming→ success
 *
 * 与 stake 同：**无 approve 步**（后端 deposit 内部自动 approve max）。
 *
 * 错误模型：
 * - DepositRevertedError / UnbondRevertedError / WithdrawRevertedError —— receipt status=reverted
 *   （含"冷却未过调 withdraw / 非 redeemable 调 unbond / 过期 match_id"等后端不校验、合约 revert 场景）
 * - ReceiptTimeoutError —— RPC 轮询超时
 * - 其他后端 4xx（DEPOSIT_AMOUNT_TOO_SMALL / INSUFFICIENT_BALANCE）由 api 封装原样抛
 *
 * 测试 seam：deps 全部可注入。
 */

import { parseUnits } from "viem";
import {
  onchainDepositGlobal,
  onchainDepositMatch,
  onchainRequestUnbond,
  onchainWithdrawLp,
} from "@/lib/api";
import { waitForReceipt } from "@/lib/onchain/receipt-poller";
import type {
  OnchainDepositGlobalReq,
  OnchainDepositMatchReq,
  OnchainLpPositionReq,
  OnchainTxRes,
} from "@/types/onchain-liquidity";
import type { WaitForReceiptResult } from "@/lib/onchain/receipt-poller";

export type OnchainDepositState = "depositing" | "deposit_confirming" | "success";
export type OnchainUnbondState = "unbonding" | "unbond_confirming" | "success";
export type OnchainWithdrawState = "withdrawing" | "withdraw_confirming" | "success";

export interface OnchainDepositGlobalInput {
  planId: number;
  stakeOdd: string;
  seq: string;
  onState?: (state: OnchainDepositState) => void;
}

export interface OnchainDepositMatchInput {
  matchId: string;
  stakeOdd: string;
  seq: string;
  onState?: (state: OnchainDepositState) => void;
}

export interface OnchainLpPositionInput {
  positionId: string;
}

export class DepositRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[OnchainLp] deposit reverted on chain: ${txHash}`);
    this.name = "DepositRevertedError";
  }
}

export class UnbondRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[OnchainLp] request_unbond reverted on chain: ${txHash}`);
    this.name = "UnbondRevertedError";
  }
}

export class WithdrawRevertedError extends Error {
  constructor(public txHash: string) {
    super(`[OnchainLp] withdraw reverted on chain: ${txHash}`);
    this.name = "WithdrawRevertedError";
  }
}

interface Deps {
  onchainDepositGlobal: (req: OnchainDepositGlobalReq) => Promise<OnchainTxRes>;
  onchainDepositMatch: (req: OnchainDepositMatchReq) => Promise<OnchainTxRes>;
  onchainRequestUnbond: (req: OnchainLpPositionReq) => Promise<OnchainTxRes>;
  onchainWithdrawLp: (req: OnchainLpPositionReq) => Promise<OnchainTxRes>;
  waitForReceipt: (hash: `0x${string}`) => Promise<WaitForReceiptResult>;
}

const defaultDeps: Deps = {
  onchainDepositGlobal,
  onchainDepositMatch,
  onchainRequestUnbond,
  onchainWithdrawLp,
  waitForReceipt: (hash) => waitForReceipt(hash),
};

function toWei(stakeOdd: string): string {
  return parseUnits(stakeOdd as `${number}`, 18).toString();
}

export async function submitOnchainDepositGlobal(
  input: OnchainDepositGlobalInput,
  deps: Deps = defaultDeps
): Promise<{ txHash: `0x${string}` }> {
  const amountWei = toWei(input.stakeOdd);
  input.onState?.("depositing");
  const res = await deps.onchainDepositGlobal({
    amount_wei: amountWei,
    plan_id: input.planId,
    // DD-141：随机幂等 nonce = 业务 seq（useIdempotentRefId UUID）；retry 复用、新点击重生成。
    nonce: input.seq,
  });
  const txHash = res.tx_hash as `0x${string}`;
  input.onState?.("deposit_confirming");
  const receipt = await deps.waitForReceipt(txHash);
  if (receipt.status === "reverted") throw new DepositRevertedError(txHash);
  input.onState?.("success");
  return { txHash };
}

export async function submitOnchainDepositMatch(
  input: OnchainDepositMatchInput,
  deps: Deps = defaultDeps
): Promise<{ txHash: `0x${string}` }> {
  const amountWei = toWei(input.stakeOdd);
  input.onState?.("depositing");
  const res = await deps.onchainDepositMatch({
    match_id: input.matchId,
    amount_wei: amountWei,
    // DD-141：随机幂等 nonce = 业务 seq（useIdempotentRefId UUID）；retry 复用、新点击重生成。
    nonce: input.seq,
  });
  const txHash = res.tx_hash as `0x${string}`;
  input.onState?.("deposit_confirming");
  const receipt = await deps.waitForReceipt(txHash);
  if (receipt.status === "reverted") throw new DepositRevertedError(txHash);
  input.onState?.("success");
  return { txHash };
}

export async function submitOnchainRequestUnbond(
  input: OnchainLpPositionInput & { onState?: (state: OnchainUnbondState) => void },
  deps: Deps = defaultDeps
): Promise<{ txHash: `0x${string}` }> {
  input.onState?.("unbonding");
  // DD-141：request_unbond 幂等键由后端按 position_id 派生，前端不传字段。
  const res = await deps.onchainRequestUnbond({
    position_id: input.positionId,
  });
  const txHash = res.tx_hash as `0x${string}`;
  input.onState?.("unbond_confirming");
  const receipt = await deps.waitForReceipt(txHash);
  if (receipt.status === "reverted") throw new UnbondRevertedError(txHash);
  input.onState?.("success");
  return { txHash };
}

export async function submitOnchainWithdrawLp(
  input: OnchainLpPositionInput & { onState?: (state: OnchainWithdrawState) => void },
  deps: Deps = defaultDeps
): Promise<{ txHash: `0x${string}` }> {
  input.onState?.("withdrawing");
  // DD-141：withdraw 幂等键由后端按 position_id 派生，前端不传字段。
  const res = await deps.onchainWithdrawLp({
    position_id: input.positionId,
  });
  const txHash = res.tx_hash as `0x${string}`;
  input.onState?.("withdraw_confirming");
  const receipt = await deps.waitForReceipt(txHash);
  if (receipt.status === "reverted") throw new WithdrawRevertedError(txHash);
  input.onState?.("success");
  return { txHash };
}
