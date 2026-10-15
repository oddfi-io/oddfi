"use client";

import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import { useWalletClient } from "wagmi";
import { CHAIN_ICON_MAP, type TokenMeta } from "@/lib/token-registry";
import { CORE_CHAIN } from "@/lib/chains";
import { PLATFORM_TOKEN_SYMBOL } from "@/lib/platform-token";
import { TransactionConfirmCard } from "@/components/transaction/TransactionConfirmCard";
import { useConnectedWalletIcon } from "@/hooks/useConnectedWalletIcon";
import { useProxyWallet } from "@/hooks/useProxyWallet";
import { useWallet } from "@/hooks/useWallet";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { useRelayDepositTx } from "@/hooks/useRelayDepositTx";
import { getChainMeta } from "@/lib/chain-registry";
import { buildTxSummary } from "@/lib/proxy-wallet/utils";
import { div, formatAmount } from "@/lib/decimal";
import Decimal from "decimal.js";

// 用户意图状态机 —— 一键式跨链体验的核心
// idle → awaitSwitch（切链中）→ awaitQuote（等报价/walletClient）→ executing → idle
type ConfirmIntent = "idle" | "awaitSwitch" | "awaitQuote" | "executing";

interface Step5RelayConfirmProps {
  selectedAsset: TokenMeta;
  usdAmount: string;
  assetUsdPrice: string;
  onSuccess: () => void;
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
}

function useQuoteCountdown(expiresAt: number | undefined): number {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return secondsLeft;
}

export function Step5RelayConfirm({
  selectedAsset,
  usdAmount,
  assetUsdPrice,
  onSuccess,
  onTxResult,
}: Step5RelayConfirmProps) {
  const { wallet, isLoading: isWalletLoading } = useProxyWallet();
  const { address } = useWallet();
  const walletIconUrl = useConnectedWalletIcon();
  const { isOnChain, switchTo, isSwitching, switchError } = useNetworkGuard();
  const { data: walletClient } = useWalletClient();

  // 源链 = 所选资产所在链（直接派生，无 store 中间态）
  const sourceChainId = selectedAsset.chainId;
  const isOnSourceChain = isOnChain(sourceChainId);

  // 意图状态机：点击后登记用户意图，由 effect 在切链/报价/钱包就绪后推进
  const [intent, setIntent] = useState<ConfirmIntent>("idle");

  const tx = useRelayDepositTx({
    selectedAsset,
    usdAmount,
    assetUsdPrice,
    proxyWalletAddress: wallet?.address,
    userAddress: address as `0x${string}` | undefined,
    sourceChainId,
  });

  // W2 fix: prevent onSuccess/onTxResult from being called multiple times if
  // parent re-renders while phase is still "complete" with unstable callback refs
  const hasCompletedRef = useRef(false);

  const expiresAt = tx.quoteState.status === "success" ? tx.quoteState.expiresAt : undefined;
  const secondsLeft = useQuoteCountdown(expiresAt);

  const isQuoteReady = tx.quoteState.status === "success" && secondsLeft > 0;
  const isQuoteExpired =
    tx.quoteState.status === "expired" || (tx.quoteState.status === "success" && secondsLeft === 0);
  const isProcessing = tx.phase === "approve" || tx.phase === "send" || tx.phase === "relaying";

  const sendAmount = useMemo(() => {
    if (!usdAmount || !assetUsdPrice || assetUsdPrice === "0") return "0";
    return formatAmount(div(usdAmount, assetUsdPrice), 5);
  }, [usdAmount, assetUsdPrice]);

  // Relay 官方字段（仅在 quote success 时可读），否则 fallback 到用户输入 USD
  const quoteDetails = tx.quoteState.status === "success" ? tx.quoteState.quote.details : undefined;

  // 收款金额：优先 quote.details.currencyOut.amountFormatted（真实到账 USDT，含费用/滑点）
  const receiveAmount = useMemo(() => {
    const raw = quoteDetails?.currencyOut?.amountFormatted;
    if (raw) return formatAmount(raw, 5);
    return formatAmount(usdAmount || "0", 5);
  }, [quoteDetails, usdAmount]);

  // 网络费：quote.details.totalImpact.usd 为负数（净成本），绝对值化展示
  const networkCost = useMemo(() => {
    const raw = quoteDetails?.totalImpact?.usd;
    if (!raw) return "~$0.10";
    try {
      const abs = new Decimal(raw).abs();
      return `~$${formatAmount(abs.toString(), 3)}`;
    } catch {
      return "~$0.10";
    }
  }, [quoteDetails]);

  // 预计时间：quote.details.timeEstimate 单位是秒（SDK schema），直接展示
  const estimatedTime = useMemo(() => {
    const seconds = quoteDetails?.timeEstimate;
    if (typeof seconds !== "number" || seconds <= 0) return "2–4s";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  }, [quoteDetails]);

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
            receiveSymbol: PLATFORM_TOKEN_SYMBOL,
            receiveChainIconUrl: CHAIN_ICON_MAP[CORE_CHAIN.id] ?? "",
            sourceAddress: address,
            sourceIconUrl: walletIconUrl,
            sourceLabel: "Wallet",
            destAddress,
            destLabel: "ODD Wallet",
            networkCost,
            estimatedTime,
          })
        : null,
    [
      usdAmount,
      sendAmount,
      receiveAmount,
      networkCost,
      estimatedTime,
      selectedAsset,
      address,
      destAddress,
      walletIconUrl,
    ]
  );

  useEffect(() => {
    if (tx.phase !== "complete" || hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    onTxResult?.({
      sendAmount: `${sendAmount} ${selectedAsset.symbol}`,
      sendSymbol: selectedAsset.symbol,
      sendIconUrl: selectedAsset.iconUrl,
      receiveAmount: `${receiveAmount} ${PLATFORM_TOKEN_SYMBOL}`,
      receiveSymbol: PLATFORM_TOKEN_SYMBOL,
      sourceAddress: address ?? "",
      sourceIconUrl: walletIconUrl,
      destAddress,
    });
    onSuccess();
  }, [
    tx.phase,
    onSuccess,
    onTxResult,
    sendAmount,
    receiveAmount,
    selectedAsset,
    address,
    destAddress,
    walletIconUrl,
  ]);

  // 一键意图：点击登记意图 → effect 监听前置条件满足后自动推进到下一步
  const handleConfirm = useCallback(() => {
    if (intent !== "idle") return; // 防重复点击
    if (!isOnSourceChain) {
      setIntent("awaitSwitch");
      switchTo(sourceChainId);
      return;
    }
    if (!isQuoteReady || !walletClient) {
      setIntent("awaitQuote");
      return;
    }
    setIntent("executing");
    tx.execute();
  }, [intent, isOnSourceChain, switchTo, sourceChainId, isQuoteReady, walletClient, tx]);

  // awaitSwitch → 切链完成/失败 → 前进 awaitQuote 或回退 idle
  useEffect(() => {
    if (intent !== "awaitSwitch") return;
    if (switchError) {
      setIntent("idle");
      return;
    }
    if (!isSwitching && isOnSourceChain) {
      setIntent("awaitQuote");
    }
  }, [intent, isSwitching, isOnSourceChain, switchError]);

  // awaitQuote → 报价 + walletClient 就绪 → 自动 execute
  useEffect(() => {
    if (intent !== "awaitQuote") return;
    if (isOnSourceChain && isQuoteReady && walletClient) {
      setIntent("executing");
      tx.execute();
    }
  }, [intent, isOnSourceChain, isQuoteReady, walletClient, tx]);

  // executing → tx 完成/失败 → 回到 idle
  useEffect(() => {
    if (intent !== "executing") return;
    if (tx.phase === "complete" || tx.phase === "failed") {
      setIntent("idle");
    }
  }, [intent, tx.phase]);

  const chainName = useMemo(() => {
    try {
      return getChainMeta(sourceChainId).name;
    } catch {
      return `chain ${sourceChainId}`;
    }
  }, [sourceChainId]);

  const confirmLabel = useMemo(() => {
    // 切链优先级最高（intent=awaitSwitch 或 wagmi 仍在切链中）
    if (intent === "awaitSwitch" || isSwitching) return `Switching to ${chainName}...`;
    // 交易进行中
    if (tx.phase === "approve") return "Approving...";
    if (tx.phase === "send") return "Sign transfer...";
    if (tx.phase === "relaying") return "Bridging...";
    // 等报价（用户已点击，但报价未就绪）
    if (intent === "awaitQuote") return "Getting quote...";
    // 静默状态下的报价态提示
    if (isQuoteExpired) return "Quote expired, refreshing...";
    if (tx.quoteState.status === "loading") return "Getting quote...";
    return "Confirm Cross-chain Transfer";
  }, [intent, isSwitching, chainName, tx.phase, tx.quoteState.status, isQuoteExpired]);

  // W1 fix: wallet loaded but EOA disconnected → summary is null → render skeleton
  if (!wallet || isWalletLoading || !summary) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse mb-4" />
        <div className="w-48 h-4 rounded bg-white/10 animate-pulse" />
      </div>
    );
  }

  // 点击禁用条件：意图已登记（切链/等报价/执行中）、tx 进行中、报价过期、报价参数未就绪
  const confirmDisabled =
    intent !== "idle" ||
    isSwitching ||
    isProcessing ||
    isQuoteExpired ||
    tx.quoteState.status === "idle";

  return (
    <div className="flex flex-col gap-[16px] w-full">
      {isOnSourceChain && isQuoteReady && !isProcessing && intent === "idle" && (
        <p className="text-center text-[13px] text-tertiary leading-[18px]">
          Quote valid for {secondsLeft}s
        </p>
      )}
      {tx.phase === "failed" && tx.errorMessage && (
        <p className="text-center text-[13px] text-fn-red leading-[18px]">{tx.errorMessage}</p>
      )}
      {switchError && intent === "idle" && (
        <p className="text-center text-[13px] text-fn-red leading-[18px]">
          Network switch cancelled
        </p>
      )}
      <TransactionConfirmCard
        summary={summary}
        confirmLabel={confirmLabel}
        onConfirm={handleConfirm}
        isLoading={
          isProcessing || isSwitching || intent === "awaitSwitch" || intent === "awaitQuote"
        }
        disabled={confirmDisabled}
      />
    </div>
  );
}
