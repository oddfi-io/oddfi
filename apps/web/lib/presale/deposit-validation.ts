/**
 * DD-119 §4.1 / §6 认购前端本地预校验（纯函数，可单测）。
 *
 * 全部金额用 decimal（lib/decimal）比较，禁止原生浮点。
 * 后端 report-tx 会再次兜底校验 + overflow anomaly，前端预校验只为交互即时反馈。
 * 单位说明：amount/min 是 USDT(USD)；supply/sold 是 ODD 数量 →
 *   剩余容量校验在 ODD 维度：sharesWanted = amount/price ≤ (supply - sold)。
 */
import { cmp, div, isValidAmount, sub } from "@/lib/decimal";
import type { PresaleRound } from "./types";

export type DepositValidationError =
  | "not_authenticated"
  | "wrong_chain"
  | "invalid_amount"
  | "round_not_active"
  | "below_min"
  | "exceeds_remaining"
  | "near_boundary"
  | "insufficient_balance";

export interface ValidateDepositParams {
  amount: string; // 用户输入 USDT
  isAuthenticated: boolean;
  chainId: number | undefined;
  expectedChainId: number; // 56 BSC
  round: PresaleRound | null;
  minSubscribeUsd: string;
  nowMs: number;
  /** 人类可读 USDT 余额；null = 未知（不阻断，交给钱包兜底） */
  usdtBalance: string | null;
  /** 距 endTs 安全边界，默认 2min（§4.1 #6） */
  boundaryMs?: number;
}

const TWO_MINUTES_MS = 2 * 60 * 1000;

export function validateDeposit(
  p: ValidateDepositParams
): { ok: true } | { ok: false; error: DepositValidationError } {
  if (!p.isAuthenticated) return { ok: false, error: "not_authenticated" };
  if (p.chainId !== p.expectedChainId) return { ok: false, error: "wrong_chain" };
  if (!isValidAmount(p.amount) || cmp(p.amount, "0") <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  if (!p.round || p.round.status !== "active") return { ok: false, error: "round_not_active" };

  // 最小认购额
  if (cmp(p.amount, p.minSubscribeUsd) < 0) return { ok: false, error: "below_min" };

  // 剩余容量（ODD 维度）：amount/price ≤ supply - sold
  if (p.round.price && cmp(p.round.price, "0") > 0) {
    const sharesWanted = div(p.amount, p.round.price);
    const remaining = sub(p.round.supply, p.round.sold);
    if (cmp(sharesWanted, remaining) > 0) return { ok: false, error: "exceeds_remaining" };
  }

  // 距切轮 ≥ 2min
  const boundary = p.boundaryMs ?? TWO_MINUTES_MS;
  if (p.round.endTs - p.nowMs < boundary) return { ok: false, error: "near_boundary" };

  // USDT 余额（已知时才校验；未知交给钱包）
  if (p.usdtBalance != null && cmp(p.amount, p.usdtBalance) > 0) {
    return { ok: false, error: "insufficient_balance" };
  }

  return { ok: true };
}
