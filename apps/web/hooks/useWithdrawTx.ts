"use client";

import { useCallback, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useSignMessage } from "wagmi";
import { isAddress } from "viem";
import { withdrawApply } from "@/lib/api";
import type { WithdrawApplyRes } from "@/types/auth";

// ─── useWithdrawTx (DD-080 · 防重放 nonce DD-123) ─────────────────────────────
// 签名 → apply HTTP 串行，收敛 5 态。与 useWithdrawFlow（UI 步骤机）解耦：
// - flow 管「form / result」弹窗步
// - tx  管「idle / signing / submitting / success / failed」网络步
// DD-123: 每次签名生成新 wallet_nonce（crypto.randomUUID），message 末尾追加
// `, nonce: <uuid>`；apply 409 → wdErrNonceUsed（已成功落库，禁止 retry）

export type WithdrawPhase = "idle" | "signing" | "submitting" | "success" | "failed";
export type WithdrawErrorKey = "wdErrSigRejected" | "wdErrFailedDesc" | "wdErrNonceUsed";

interface ExecuteArgs {
  address: string;
  amount: string;
}

interface UseWithdrawTxReturn {
  phase: WithdrawPhase;
  result: WithdrawApplyRes | undefined;
  errorKey: WithdrawErrorKey | undefined;
  /** true=success / false=failed；同步更新 phase/result/errorKey */
  execute: (args: ExecuteArgs) => Promise<boolean>;
  reset: () => void;
}

const CHAIN = "bsc";

function isUserRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number; shortMessage?: string; message?: string };
  if (e.name === "UserRejectedRequestError") return true;
  if (e.code === 4001) return true;
  const msg = e.shortMessage ?? e.message ?? "";
  return /reject/i.test(msg);
}

// DD-123 · ky HTTPError 识别 409 nonce 重放。
// 主路径：HTTP status 409（ky 原生 .response.status，永远可用）。
// 辅路径：业务 code === 409（lib/api.ts beforeError 已注入 responseJSON，但仍兜底防御）。
// 后端 ErrWithdrawNonceUsed → HTTP 409，business code 由 response.CodeConflict 给定（联调时确认数值）。
function isHttp409NonceUsed(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { response?: { status?: number }; responseJSON?: { code?: number | string } };
  if (e.response?.status === 409) return true;
  const code = e.responseJSON?.code;
  return code === 409 || code === "409";
}

type WithdrawErrorKind = "nonce_used" | "sig_time_invalid" | "other";

function classifyApplyError(err: unknown): WithdrawErrorKind {
  if (isHttp409NonceUsed(err)) return "nonce_used";
  // 后端 400 message 含 "withdraw sig time is invalid"（对照 backend handler/auth.go:676）
  // 同时检查 status === 400 兜底（responseJSON 解析失败时 message 也读不到 → 仍归 other）
  const e = err as {
    response?: { status?: number };
    responseJSON?: { message?: string };
  };
  const msg = e.responseJSON?.message ?? "";
  if (e.response?.status === 400 && /withdraw sig time is invalid/i.test(msg)) {
    return "sig_time_invalid";
  }
  return "other";
}

export function useWithdrawTx(): UseWithdrawTxReturn {
  const { signMessageAsync } = useSignMessage();
  const [phase, setPhase] = useState<WithdrawPhase>("idle");
  const [result, setResult] = useState<WithdrawApplyRes | undefined>();
  const [errorKey, setErrorKey] = useState<WithdrawErrorKey | undefined>();

  const reset = useCallback(() => {
    setPhase("idle");
    setResult(undefined);
    setErrorKey(undefined);
  }, []);

  const execute = useCallback(
    async ({ address, amount }: ExecuteArgs): Promise<boolean> => {
      setErrorKey(undefined);
      setResult(undefined);

      // 防御性兜底：form 按钮已禁用，这里再校一次，避免越权 dispatch
      const amountNum = Number(amount);
      if (!isAddress(address) || !Number.isFinite(amountNum) || amountNum < 1) {
        setErrorKey("wdErrFailedDesc");
        setPhase("failed");
        return false;
      }

      // sig_time 后端硬约束 60 秒（DD-123）。点击 Continue 瞬间生成，串行 sign→apply，无缓存。
      // address 统一转 lowercase：后端 recover 时按 lowercase 拼 message，大小写不一致会导致 invalid signature。
      const sigTime = Math.floor(Date.now() / 1000);
      const normalizedAddress = address.toLowerCase();

      // W-2 (REV-v3): crypto.randomUUID() 在非 secure context 抛 TypeError（HTTP staging / 老 iOS Safari < 15.4 / file://）。
      // 必须包 try/catch，否则透传到 caller 的未 catch await → unhandled rejection → 按钮假死。
      // wallet_nonce 36 字符，落在后端 binding 8-64 区间，字符集 [0-9a-f-] 是 Lark 文档 [a-zA-Z0-9-_] 合法子集。
      let walletNonce: string;
      try {
        walletNonce = crypto.randomUUID();
      } catch (err) {
        console.error("[useWithdrawTx] crypto.randomUUID unavailable — non-secure context?", err);
        Sentry.captureException(err, {
          tags: { feature: "withdraw", withdraw_error_kind: "uuid_unavailable" },
        });
        setErrorKey("wdErrFailedDesc");
        setPhase("failed");
        return false;
      }

      const message = `Oddfi withdraw amount: ${amount}, withdraw address: ${normalizedAddress}, sig time: ${sigTime}, nonce: ${walletNonce}`;

      setPhase("signing");
      let signature: string;
      try {
        signature = await signMessageAsync({ message });
      } catch (err) {
        const rejected = isUserRejection(err);
        console.error(`[useWithdrawTx] signMessage failed — rejected=${rejected}`, err);
        Sentry.captureException(err, {
          tags: {
            feature: "withdraw",
            withdraw_error_kind: rejected ? "sig_rejected" : "sig_other",
          },
        });
        setErrorKey(rejected ? "wdErrSigRejected" : "wdErrFailedDesc");
        setPhase("failed");
        return false;
      }

      setPhase("submitting");
      try {
        const res = await withdrawApply({
          withdraw_address: normalizedAddress,
          withdraw_sign: signature,
          sig_time: sigTime,
          amount,
          chain: CHAIN,
          wallet_nonce: walletNonce,
        });
        setResult(res);
        setPhase("success");
        return true;
      } catch (err) {
        const kind = classifyApplyError(err);
        console.error(`[useWithdrawTx] withdrawApply failed — kind=${kind}`, err);
        Sentry.captureException(err, {
          tags: { feature: "withdraw", withdraw_error_kind: kind },
        });
        setErrorKey(kind === "nonce_used" ? "wdErrNonceUsed" : "wdErrFailedDesc");
        setPhase("failed");
        return false;
      }
    },
    [signMessageAsync]
  );

  return { phase, result, errorKey, execute, reset };
}
