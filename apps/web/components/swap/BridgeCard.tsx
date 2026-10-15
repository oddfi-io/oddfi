"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { bsc } from "wagmi/chains";
import { useBridgeStore } from "@/stores/bridgeStore";
import { useRelayQuote } from "@/hooks/useRelayQuote";
import { useRelayExecute } from "@/hooks/useRelayExecute";
import { ChainSelector } from "./ChainSelector";
import { BridgeTokenSelector } from "./BridgeTokenSelector";
import { BridgeQuoteDisplay } from "./BridgeQuoteDisplay";
import { BALANCE_READ_CHAINS } from "@/lib/chains";
import { getChainMeta } from "@/lib/chain-registry";
import { isValidAmount } from "@/lib/decimal";

// 仅允许非 BSC 链作为源链（BSC→BSC 走 PancakeSwap，不走 Relay）
const SOURCE_CHAIN_IDS = BALANCE_READ_CHAINS.filter((c) => c.id !== bsc.id).map((c) => c.id);

export function BridgeCard() {
  const t = useTranslations("bridge");
  const { address, isConnected } = useAccount();
  const {
    originChainId,
    originToken,
    destinationToken,
    amount,
    setOriginChainId,
    setOriginToken,
    setDestinationToken,
    setAmount,
    reset,
  } = useBridgeStore();

  const { state: execState, execute, reset: resetExec } = useRelayExecute();

  // 仅在所有必要字段齐全时构建报价参数
  const quoteParams = useMemo(() => {
    if (!isConnected || !address || !originToken || !destinationToken || !isValidAmount(amount)) {
      return null;
    }
    try {
      const rawAmount = parseUnits(amount, originToken.decimals).toString();
      return {
        chainId: originChainId,
        currency: originToken.address as string,
        toChainId: bsc.id,
        toCurrency: destinationToken.address as string,
        amount: rawAmount,
        user: address,
        // Bridge 场景 recipient = 用户 EOA，显式传 refundTo = 用户 EOA 保持契约一致
        // 防御未来若新增 "Bridge to Proxy Wallet" 场景导致默认 fallback 走偏
        refundTo: address,
      };
    } catch {
      return null;
    }
  }, [isConnected, address, originChainId, originToken, destinationToken, amount]);

  const quoteState = useRelayQuote(quoteParams);
  const destChainMeta = getChainMeta(bsc.id);

  // 推导按钮文案与禁用状态
  const { label: btnLabel, disabled: btnDisabled } = ((): {
    label: string;
    disabled: boolean;
  } => {
    if (execState.status === "signing") return { label: t("waitingSignature"), disabled: true };
    if (execState.status === "relaying") return { label: t("relaying"), disabled: true };
    if (execState.status === "completed") return { label: t("bridgeAgain"), disabled: false };
    if (!isConnected) return { label: t("connectWallet"), disabled: true };
    if (!originToken) return { label: t("selectSourceToken"), disabled: true };
    if (!destinationToken) return { label: t("selectDestToken"), disabled: true };
    if (!isValidAmount(amount)) return { label: t("enterAmount"), disabled: true };
    if (quoteState.status === "loading") return { label: t("fetchingQuote"), disabled: true };
    if (quoteState.status === "expired") return { label: t("refreshingQuote"), disabled: true };
    if (quoteState.status === "error") return { label: t("failedQuote"), disabled: true };
    if (quoteState.status === "success") {
      const needsApprove = (quoteState.quote.steps?.length ?? 0) > 1;
      return { label: needsApprove ? t("approveBridge") : t("bridge"), disabled: false };
    }
    return { label: t("bridge"), disabled: true };
  })();

  const handleBridge = async () => {
    if (execState.status === "completed") {
      reset();
      resetExec();
      return;
    }
    if (quoteState.status !== "success") return;
    await execute(quoteState.quote);
  };

  return (
    <div className="w-full flex flex-col gap-[16px] lg:rounded-[16px] lg:border-4 lg:border-secondary lg:bg-fill-card1 lg:p-[32px]">
      <h2 className="text-[18px] font-bold text-primary">{t("title")}</h2>

      {/* ── 源链 + 源代币 ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-[12px] rounded-[12px] border border-secondary p-[16px]">
        <span className="text-[12px] text-tertiary">{t("from")}</span>
        <div className="flex items-center gap-[8px]">
          <ChainSelector
            value={originChainId}
            onChange={setOriginChainId}
            chainIds={SOURCE_CHAIN_IDS}
          />
          <BridgeTokenSelector
            chainId={originChainId}
            value={originToken}
            onChange={setOriginToken}
          />
        </div>

        {/* 金额输入 */}
        <div className="flex items-center gap-[8px] rounded-[8px] bg-fill-input px-[12px]">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-h-[44px] flex-1 bg-transparent text-[16px] text-primary placeholder:text-tertiary outline-none"
            style={{ touchAction: "manipulation" }}
          />
          {originToken && (
            <span className="shrink-0 text-[13px] text-tertiary">{originToken.symbol}</span>
          )}
        </div>
      </div>

      {/* ── 分隔箭头 ─────────────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <span className="text-[18px] text-tertiary select-none">↓</span>
      </div>

      {/* ── 目标链（固定 BSC）+ 目标代币 ─────────────────────────────────── */}
      <div className="flex flex-col gap-[12px] rounded-[12px] border border-secondary p-[16px]">
        <span className="text-[12px] text-tertiary">{t("to")}</span>
        <div className="flex items-center gap-[8px]">
          {/* BSC 目标链不可更改 */}
          <div className="flex min-h-[44px] items-center gap-[6px] rounded-[8px] bg-fill-card2 px-[10px] opacity-60 cursor-not-allowed">
            <Image
              src={destChainMeta.iconUrl}
              alt={destChainMeta.name}
              width={20}
              height={20}
              sizes="20px"
              className="flex-shrink-0 rounded-full"
              unoptimized
            />
            <span className="text-[14px] font-medium text-primary">{destChainMeta.name}</span>
          </div>
          <BridgeTokenSelector
            chainId={bsc.id}
            value={destinationToken}
            onChange={setDestinationToken}
          />
        </div>
      </div>

      {/* ── 报价展示 ─────────────────────────────────────────────────────── */}
      <BridgeQuoteDisplay quoteState={quoteState} toToken={destinationToken} />

      {/* ── 执行进度 / 错误提示 ──────────────────────────────────────────── */}
      {execState.status === "signing" && (
        <p className="text-center text-[12px] text-tertiary">{t("waitingSignature")}</p>
      )}
      {execState.status === "relaying" && (
        <p className="text-center text-[12px] text-tertiary">
          {t("relayingStep", {
            current: execState.currentStep + 1,
            total: execState.totalSteps,
          })}
        </p>
      )}
      {execState.status === "completed" && (
        <p className="text-center text-[12px] text-fn-green">{t("transferComplete")}</p>
      )}
      {execState.status === "failed" && (
        <p className="text-center text-[12px] text-fn-red">
          {execState.errorMessage ?? t("transferFailed")}
        </p>
      )}

      {/* ── 操作按钮 ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        disabled={btnDisabled}
        onClick={handleBridge}
        className="min-h-[44px] w-full rounded-[12px] bg-fn-brand text-[14px] font-medium text-static-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ touchAction: "manipulation" }}
      >
        {btnLabel}
      </button>
    </div>
  );
}
