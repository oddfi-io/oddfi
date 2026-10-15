"use client";

import { useMemo, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { TokenMeta } from "@/lib/token-registry";
import { CHAIN_ICON_MAP } from "@/lib/token-registry";
import { PLATFORM_TOKEN_SYMBOL } from "@/lib/platform-token";
import { TransactionConfirmCard } from "@/components/transaction/TransactionConfirmCard";
import { useConnectedWalletIcon } from "@/hooks/useConnectedWalletIcon";
import { useProxyWallet } from "@/hooks/useProxyWallet";
import { useWallet } from "@/hooks/useWallet";
import { useDepositTx } from "@/hooks/useDepositTx";
import { buildTxSummary } from "@/lib/proxy-wallet/utils";
import { div, formatAmount } from "@/lib/decimal";
import { selectSwapRoute } from "@/lib/swap/route-selector";
import { Step5RelayConfirm } from "./Step5RelayConfirm";

interface Step5TransactionConfirmProps {
  selectedAsset: TokenMeta;
  usdAmount: string;
  /** Price of selected asset in USD */
  assetUsdPrice: string;
  onSuccess: () => void;
  /** Callback to save tx result data before transitioning to result step */
  onTxResult?: (data: {
    sendAmount: string;
    sendSymbol: string;
    sendIconUrl?: string;
    receiveAmount: string;
    receiveSymbol: string;
    sourceAddress: string;
    sourceIconUrl?: string;
    destAddress: string;
  }) => void;
  /** True when selected asset is the platform token (transfer only, no swap) */
  isPlatformToken?: boolean;
}

// ── Router ────────────────────────────────────────────────────────────────────
// 双子组件模式：避免在同一组件内条件调用 Hook
// 判据 = `selectSwapRoute(fromChainId)`：
//   pancake → Step5PancakeConfirm（PancakeSwap 链上 swap）
//   relay   → Step5RelayConfirm（Relay 跨链入金）
// 钱包当前链不匹配所选资产链时，由 Step5RelayConfirm/Pancake 内部的切链 guard 引导

export function Step5TransactionConfirm(props: Step5TransactionConfirmProps) {
  const route = selectSwapRoute(props.selectedAsset.chainId);
  // DD-079: testnet 禁用 swap（UI 隐藏入口 + 此处兜底）
  if (route === "disabled") {
    console.warn("[Step5TransactionConfirm] swap disabled — testnet mode");
    return null;
  }
  if (route === "pancake") {
    return <Step5PancakeConfirm {...props} />;
  }
  return (
    <Step5RelayConfirm
      selectedAsset={props.selectedAsset}
      usdAmount={props.usdAmount}
      assetUsdPrice={props.assetUsdPrice}
      onSuccess={props.onSuccess}
      onTxResult={props.onTxResult}
    />
  );
}

// ── PancakeSwap confirm (BSC-only) ─────────────────────────────────────────────

function Step5PancakeConfirm({
  selectedAsset,
  usdAmount,
  assetUsdPrice,
  onSuccess,
  onTxResult,
  isPlatformToken,
}: Step5TransactionConfirmProps) {
  const t = useTranslations("deposit");
  const { wallet, isLoading: isWalletLoading } = useProxyWallet();
  const { address } = useWallet();
  const walletIconUrl = useConnectedWalletIcon();
  const tx = useDepositTx({
    selectedAsset,
    usdAmount,
    assetUsdPrice,
    isPlatformToken: !!isPlatformToken,
  });

  // Calculate send amount (token units from USD)
  const sendAmount = useMemo(() => {
    if (!usdAmount || !assetUsdPrice || assetUsdPrice === "0") return "0";
    return formatAmount(div(usdAmount, assetUsdPrice), 5);
  }, [usdAmount, assetUsdPrice]);

  // Receive amount: use real quote when available, fallback to USD parity
  const receiveAmount = useMemo(() => {
    if (tx.quoteData) return formatAmount(tx.quoteData.amountOutFormatted, 5);
    return formatAmount(usdAmount || "0", 5);
  }, [tx.quoteData, usdAmount]);

  const destAddress = wallet?.address ?? "";

  const summary = useMemo(
    () =>
      destAddress && address
        ? buildTxSummary({
            usdAmount: formatAmount(usdAmount || "0", 2),
            sendAmount,
            sendSymbol: selectedAsset.symbol,
            sendIconUrl: selectedAsset.iconUrl,
            sendChainIconUrl: CHAIN_ICON_MAP[selectedAsset.chainId] ?? "",
            receiveAmount,
            receiveSymbol: isPlatformToken ? selectedAsset.symbol : PLATFORM_TOKEN_SYMBOL,
            receiveChainIconUrl: CHAIN_ICON_MAP[selectedAsset.chainId] ?? "",
            sourceAddress: address,
            sourceIconUrl: walletIconUrl,
            sourceLabel: t("wallet"),
            destAddress,
            destLabel: t("oddWallet"),
            networkCost: isPlatformToken ? "$0.01" : "$0.03",
            priceImpact: tx.quoteData?.priceImpact
              ? `${tx.quoteData.priceImpact}%`
              : isPlatformToken
                ? "0%"
                : "0.48%",
            maxSlippage: isPlatformToken ? undefined : "Auto \u00B7 0.5%",
          })
        : null,
    [
      usdAmount,
      sendAmount,
      receiveAmount,
      selectedAsset,
      address,
      destAddress,
      isPlatformToken,
      tx.quoteData,
    ]
  );

  // Watch tx.phase changes — transition to result step on success
  useEffect(() => {
    if (tx.phase === "success") {
      onTxResult?.({
        sendAmount: `${sendAmount} ${selectedAsset.symbol}`,
        sendSymbol: selectedAsset.symbol,
        sendIconUrl: selectedAsset.iconUrl,
        receiveAmount: `${receiveAmount} ${isPlatformToken ? selectedAsset.symbol : PLATFORM_TOKEN_SYMBOL}`,
        receiveSymbol: isPlatformToken ? selectedAsset.symbol : PLATFORM_TOKEN_SYMBOL,
        sourceAddress: address ?? "",
        sourceIconUrl: walletIconUrl,
        destAddress,
      });
      onSuccess();
    }
  }, [
    tx.phase,
    onSuccess,
    onTxResult,
    sendAmount,
    receiveAmount,
    selectedAsset,
    isPlatformToken,
    address,
    destAddress,
    walletIconUrl,
  ]);

  const handleConfirm = useCallback(() => {
    tx.execute();
  }, [tx]);

  const isProcessing =
    tx.phase === "approving" || tx.phase === "executing" || tx.phase === "confirming";

  // Wallet not yet assigned — show loading skeleton
  if (!wallet || isWalletLoading) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse mb-4" />
        <div className="w-48 h-4 rounded bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <TransactionConfirmCard
      summary={summary!}
      confirmLabel={t("confirm")}
      onConfirm={handleConfirm}
      isLoading={isProcessing}
      disabled={isProcessing}
    />
  );
}
