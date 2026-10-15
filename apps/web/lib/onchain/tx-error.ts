/**
 * 链上写操作（stake / unstake / deposit / unbond / withdraw）统一错误 → 用户友好文案。
 *
 * ASSETS.md 已查（关键词 tx-error / error map / friendly / onchain error）：
 *   betting/onchain-error-i18n、presale/error-map、wallet-error 各自专用，无 stake+LP 共用映射。
 * 新建理由：DD-130 stake+LP 写流程共用，把后端 500 / 合约 revert / receipt 超时 / 业务码
 *   统一映射成简短友好句，供各写 hook 在 catch 里 setErrorMessage + toastError 使用，
 *   避免把 "HTTPError: Request failed with status code 500" / Go 内部串 透传到 UI。
 *
 * 输入来源：
 *   - ReceiptTimeoutError（lib/onchain/receipt-poller）
 *   - *RevertedError（lib/staking/submit-onchain-stake、lib/liquidity/submit-onchain-lp）按 name 识别
 *   - ky HTTPError：lib/api.ts beforeError 已把 body 解析挂到 err.responseJSON（含 code/message）
 */

import { ReceiptTimeoutError } from "./receipt-poller";

interface HttpishError {
  name?: string;
  response?: { status?: number };
  responseJSON?: { code?: number | string; message?: string };
  message?: string;
}

/** 后端稳定业务 code token（出现在 responseJSON.message / message 里）→ 友好句 */
const BUSINESS_TOKENS: Array<[RegExp, string]> = [
  [/INSUFFICIENT_BALANCE/i, "Insufficient balance for this transaction."],
  [/(STAKE|DEPOSIT)_AMOUNT_TOO_SMALL/i, "Amount is below the minimum."],
  [/INVALID_STAKE_PLAN/i, "Invalid lock period selected."],
  [/POSITION_NOT_OWNED/i, "Position not found or not yours."],
];

/**
 * 把任意写操作错误映射为简短、可直接展示给用户的英文句子。
 * 兜底永不返回原始 HTTPError / stack / Go 内部串。
 */
export function toUserTxMessage(err: unknown): string {
  if (err instanceof ReceiptTimeoutError) {
    return "Submitted, but confirmation is taking longer than expected. Check your positions in a moment.";
  }

  const e = (err ?? {}) as HttpishError;

  // 链上 revert（submit-onchain-* 抛的 Stake/Unstake/Deposit/Unbond/WithdrawRevertedError）
  if (typeof e.name === "string" && e.name.endsWith("RevertedError")) {
    return "The transaction was rejected on-chain. Please check the status and try again.";
  }

  // 后端业务错误：优先匹配 message 里的稳定 code token
  const raw = e.responseJSON?.message ?? e.message ?? "";
  for (const [re, msg] of BUSINESS_TOKENS) {
    if (re.test(raw)) return msg;
  }

  // HTTP 状态兜底：5xx 服务端（含后端 retryable / ErrInfraRPC）、其它 4xx
  const status = e.response?.status;
  if (typeof status === "number") {
    if (status >= 500) return "Server is busy, please try again in a moment.";
    if (status >= 400) return "Request failed. Please check and try again.";
  }

  return "Transaction failed, please try again.";
}
