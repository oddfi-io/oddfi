"use client";

import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { formatAmount } from "@/lib/decimal";
import type { RelayQuoteState } from "@/lib/relay/types";
import type { TokenMeta } from "@/lib/token-registry";

interface BridgeQuoteDisplayProps {
  quoteState: RelayQuoteState;
  /** 目标代币（用于显示 symbol，兜底使用 quote 返回的 symbol） */
  toToken: TokenMeta | null;
}

function useCountdown(expiresAt: number | undefined): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!expiresAt) {
      setSeconds(0);
      return;
    }
    const tick = () => setSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return seconds;
}

export function BridgeQuoteDisplay({ quoteState, toToken }: BridgeQuoteDisplayProps) {
  const expiresAt = quoteState.status === "success" ? quoteState.expiresAt : undefined;
  const secondsLeft = useCountdown(expiresAt);

  if (quoteState.status === "idle") return null;

  if (quoteState.status === "loading" || quoteState.status === "expired") {
    return (
      <div className="rounded-[10px] bg-fill-card2 p-[14px] flex flex-col gap-[8px]">
        {quoteState.status === "expired" ? (
          <p className="text-center text-[13px] text-tertiary">Quote expired, refreshing...</p>
        ) : (
          <>
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-white/10" />
          </>
        )}
      </div>
    );
  }

  if (quoteState.status === "error") {
    return (
      <div className="rounded-[10px] bg-fill-card2 p-[14px]">
        <p className="text-[13px] text-fn-red">Failed to get quote. Please try again.</p>
      </div>
    );
  }

  // Success 状态
  const { quote } = quoteState;
  const receiveAmountRaw = quote.details?.currencyOut?.amountFormatted ?? "";
  const receiveUsd = quote.details?.currencyOut?.amountUsd;
  const totalImpactUsd = quote.details?.totalImpact?.usd;
  const timeEstimateSec = quote.details?.timeEstimate;
  const destSymbol = toToken?.symbol ?? quote.details?.currencyOut?.currency?.symbol ?? "USDT";

  // 费用：totalImpact.usd 为负数（成本），取绝对值展示
  // try/catch 防御 SDK 返回非数值字符串（与 Step5RelayConfirm 保持一致）
  const rawFee = totalImpactUsd ?? "";
  let absFee = "";
  try {
    absFee = rawFee ? new Decimal(rawFee).abs().toString() : "";
  } catch {
    absFee = "";
  }
  const feeDisplay = absFee ? `~$${formatAmount(absFee, 3)}` : "–";

  const receiveDisplay = receiveAmountRaw
    ? `${formatAmount(receiveAmountRaw, 5)} ${destSymbol}`
    : "–";

  // 预计到账时间：SDK `timeEstimate` 单位是秒，>60 秒折分钟显示
  const timeDisplay =
    typeof timeEstimateSec === "number" && timeEstimateSec > 0
      ? timeEstimateSec < 60
        ? `${timeEstimateSec}s`
        : `${Math.round(timeEstimateSec / 60)}m`
      : "2–4s";

  return (
    <div className="rounded-[10px] border border-divider bg-fill-card2 p-[14px] flex flex-col gap-[10px]">
      {/* 到账金额 */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-tertiary">You receive</span>
        <div className="flex flex-col items-end gap-[2px]">
          <span className="text-[15px] font-semibold text-primary">{receiveDisplay}</span>
          {receiveUsd && (
            <span className="text-[11px] text-tertiary">≈ ${formatAmount(receiveUsd, 2)}</span>
          )}
        </div>
      </div>

      <hr className="border-0 border-t border-divider" />

      {/* 费用 */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-tertiary">Network fee</span>
        <span className="text-[12px] text-secondary">{feeDisplay}</span>
      </div>

      {/* 预计时间 */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-tertiary">Estimated time</span>
        <span className="text-[12px] text-secondary">{timeDisplay}</span>
      </div>

      {/* 报价倒计时 */}
      {secondsLeft > 0 && (
        <p className="text-center text-[11px] text-tertiary">Quote valid for {secondsLeft}s</p>
      )}
    </div>
  );
}
