"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useWalletClient } from "wagmi";
import { parseUnits } from "viem";
import type { ProgressData } from "@relayprotocol/relay-sdk";
import { useRelayQuote } from "./useRelayQuote";
import { CORE_CHAIN } from "@/lib/chains";
import { getChainMeta } from "@/lib/chain-registry";
import { div, formatAmount } from "@/lib/decimal";
import { IS_TESTNET } from "@/lib/network-mode";
import { PLATFORM_TOKEN } from "@/lib/platform-token";
import type { TokenMeta } from "@/lib/token-registry";
import type { RelayQuoteParams, RelayQuoteState } from "@/lib/relay/types";

// ── Types ─────────────────────────────────────────────────────────

export type RelayDepositPhase =
  | "idle"
  | "approve" // ERC-20 授权签名等待中
  | "send" // 跨链交易签名等待中
  | "relaying" // 跨链交易已提交，Relay Solver 处理中
  | "complete"
  | "failed";

interface UseRelayDepositTxOptions {
  /** 源链代币信息（含正确的源链 decimals，如 USDT on ARB = 6 位，on BSC = 18 位） */
  selectedAsset: TokenMeta;
  /** USD 金额字符串，如 "50" */
  usdAmount: string;
  /** selectedAsset 的 USD 单价 */
  assetUsdPrice: string;
  /** BSC 代理钱包地址（目标收款方） */
  proxyWalletAddress: `0x${string}` | undefined;
  /** 源链用户 EOA（退款接收方） */
  userAddress: `0x${string}` | undefined;
  /** 源链 chainId */
  sourceChainId: number;
}

interface UseRelayDepositTxReturn {
  phase: RelayDepositPhase;
  /** 跨链交易哈希（仅 bridge tx，不含 approval） */
  txHash: string | undefined;
  errorMessage: string | undefined;
  /** 暴露报价状态，供 UI 倒计时展示 */
  quoteState: RelayQuoteState;
  execute: () => Promise<void>;
  reset: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────

export function useRelayDepositTx({
  selectedAsset,
  usdAmount,
  assetUsdPrice,
  proxyWalletAddress,
  userAddress,
  sourceChainId,
}: UseRelayDepositTxOptions): UseRelayDepositTxReturn {
  const { data: walletClient } = useWalletClient();
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [phase, setPhase] = useState<RelayDepositPhase>("idle");
  const [txHash, setTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // ── 关键：使用源链实际 decimals 计算 raw amount ─────────────────
  // USDT on BSC = 18 decimals; USDT on ETH/ARB/BASE/POLYGON = 6 decimals
  // 使用错误的 decimals 会导致 10^12 倍的金额错误，必须用 selectedAsset.decimals
  const tokenAmountStr = useMemo(() => {
    if (!usdAmount || !assetUsdPrice || assetUsdPrice === "0") return "0";
    return formatAmount(div(usdAmount, assetUsdPrice), selectedAsset.decimals);
  }, [usdAmount, assetUsdPrice, selectedAsset.decimals]);

  const amountRaw = useMemo(() => {
    if (!tokenAmountStr || tokenAmountStr === "0") return "0";
    try {
      return parseUnits(tokenAmountStr, selectedAsset.decimals).toString();
    } catch {
      return "0";
    }
  }, [tokenAmountStr, selectedAsset.decimals]);

  // ── 构建报价参数（输入不完整时返回 null → useRelayQuote 进入 idle）──
  const quoteParams = useMemo((): RelayQuoteParams | null => {
    // DD-079: testnet 禁用 Relay 跨链路径，params=null 让 useRelayQuote 进入 idle
    if (IS_TESTNET) return null;
    if (!userAddress || !proxyWalletAddress || !amountRaw || amountRaw === "0") return null;
    return {
      chainId: sourceChainId,
      // 原生代币使用零地址（Relay 约定），ERC-20 使用合约地址
      currency: selectedAsset.address,
      toChainId: CORE_CHAIN.id,
      // 终点统一为平台币（TODD → ODD 切换时跟随 PLATFORM_TOKEN 变更，
      // 三条路径（BSC transfer/BSC swap/Relay）代理钱包到账币种一致）
      toCurrency: PLATFORM_TOKEN.address,
      amount: amountRaw,
      user: userAddress,
      recipient: proxyWalletAddress, // 目标收款方 = BSC 代理钱包
      // 失败退款到用户 EOA —— 不传则 Relay fallback 到 recipient（Proxy Wallet），
      // 资金会进代理钱包而非用户钱包，违反 DD-065 §风险承诺
      refundTo: userAddress,
    };
  }, [sourceChainId, selectedAsset.address, amountRaw, userAddress, proxyWalletAddress]);

  const quoteState = useRelayQuote(quoteParams);

  // useRef 持有 quoteState 最新值，使 execute 的 deps 不含 quoteState 对象引用，
  // 避免 28s 报价刷新时因对象引用变化触发 execute 函数重建
  const quoteStateRef = useRef(quoteState);
  quoteStateRef.current = quoteState;

  // ── 验证日志用 ref：保存 Relay SDK 最新 onProgress 数据，供 execute 结束时
  // 提取源链 tx、BSC 到账 tx（internalTxHashes）打印结构化验证日志。
  // 注意：该日志为多链测试阶段的必要验证手段（生产环境也保留），上线前统一清理。
  const progressDataRef = useRef<ProgressData | null>(null);

  // ── Reset ─────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setPhase("idle");
    setTxHash(undefined);
    setErrorMessage(undefined);
  }, []);

  // ── Execute ───────────────────────────────────────────────────────
  const execute = useCallback(async () => {
    // DD-079: 写操作层 defense-in-depth — hook 顶部不能 throw，guard 放在 execute 回调内
    if (IS_TESTNET) {
      throw new Error("[useRelayDepositTx] Relay disabled in testnet");
    }
    if (!walletClient) {
      setErrorMessage("Wallet not connected");
      setPhase("failed");
      return;
    }
    // 读取调用时的最新 quoteState（非创建时的闭包快照）
    const currentQuoteState = quoteStateRef.current;
    if (currentQuoteState.status !== "success") {
      setErrorMessage("Quote not available");
      setPhase("failed");
      return;
    }

    setErrorMessage(undefined);
    setTxHash(undefined);

    try {
      const { getRelayClient } = await import("@/lib/relay/client");
      const client = await getRelayClient();

      await client.actions.execute({
        quote: currentQuoteState.quote,
        wallet: walletClient,
        onProgress: (data) => {
          // 保存最新进度快照（含 txHashes / internalTxHashes）供最终日志使用
          progressDataRef.current = data;
          if (!mountedRef.current) return;

          if (data.error) {
            console.error("[useRelayDepositTx] Relay execution error", data.error);
            setErrorMessage("Transaction failed. Refund initiated to your wallet.");
            setPhase("failed");
            return;
          }

          const stepId = data.currentStep?.id ?? "";

          if (stepId === "approve") {
            // ERC-20 授权步骤
            setPhase("approve");
          } else if (stepId) {
            // 跨链交易步骤 — 有 txHash = 已提交链上（Relaying），否则等待签名
            const latestTx = data.txHashes?.at(-1);
            if (latestTx) {
              setTxHash(latestTx.txHash);
              setPhase("relaying");
            } else {
              setPhase("send");
            }
          }
        },
      });

      if (mountedRef.current) {
        // 不覆盖 onProgress 已设置的 failed 状态（SDK execute 失败后仍会 resolve）
        setPhase((prev) => (prev === "failed" ? prev : "complete"));
      }

      // ── 多链测试验证日志（上线前移除）────────────────────────────────
      // 打印结构化入金结果，便于团队在浏览器 Console 验证源链 tx / BSC 到账 tx /
      // 实际到账金额是否正确。格式与 Pancake 路径保持一致，便于对比。
      logRelayDepositResult({
        progress: progressDataRef.current,
        quoteState: currentQuoteState,
        sourceChainId,
        selectedAsset,
        tokenAmountStr,
        status: mountedRef.current ? "success" : "submitted",
      });
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("[useRelayDepositTx] Execute failed", err);
      setErrorMessage(
        err instanceof Error
          ? err.message.split("\n")[0]?.slice(0, 120) || "Transaction failed"
          : "Transaction failed"
      );
      setPhase("failed");

      // 失败场景同样打印验证日志（含失败原因），便于排查
      logRelayDepositResult({
        progress: progressDataRef.current,
        quoteState: currentQuoteState,
        sourceChainId,
        selectedAsset,
        tokenAmountStr,
        status: "failed",
        error: err,
      });
    }
  }, [walletClient]);

  return { phase, txHash, errorMessage, quoteState, execute, reset };
}

// ── 多链测试验证日志（上线前统一移除）─────────────────────────────────
// 在浏览器 Console 打印结构化跨链入金结果：路径、源链交易、目标链到账交易、
// 到账币种、实际到账金额、状态。生产环境也会打印——便于团队分工验证。
function logRelayDepositResult(params: {
  progress: ProgressData | null;
  quoteState: RelayQuoteState;
  sourceChainId: number;
  selectedAsset: TokenMeta;
  tokenAmountStr: string;
  status: "success" | "submitted" | "failed";
  error?: unknown;
}) {
  const { progress, quoteState, sourceChainId, selectedAsset, tokenAmountStr, status, error } =
    params;

  const allItems = progress?.steps?.flatMap((s) => s.items ?? []) ?? [];
  const allTxHashes = allItems.flatMap((i) => i.txHashes ?? []);
  const allInternalTxHashes = allItems.flatMap((i) => i.internalTxHashes ?? []);

  const originTx =
    allTxHashes.find((t) => t.chainId === sourceChainId)?.txHash ??
    allTxHashes.at(0)?.txHash ??
    "(not captured)";
  const destTx =
    allInternalTxHashes.find((t) => t.chainId === CORE_CHAIN.id)?.txHash ??
    allTxHashes.find((t) => t.chainId === CORE_CHAIN.id)?.txHash ??
    "(pending / not captured)";

  const amountReceivedFormatted =
    quoteState.status === "success"
      ? (quoteState.quote.details?.currencyOut?.amountFormatted ?? "(unknown)")
      : "(quote lost)";

  const sourceChainName = safeChainName(sourceChainId);
  const destChainName = safeChainName(CORE_CHAIN.id);

  const payload = {
    route: "Relay",
    originChain: `${sourceChainName} (${sourceChainId})`,
    originTx,
    originAmount: `${tokenAmountStr} ${selectedAsset.symbol}`,
    destChain: `${destChainName} (${CORE_CHAIN.id})`,
    destToken: `${PLATFORM_TOKEN.symbol} (${PLATFORM_TOKEN.address})`,
    destTx,
    amountReceived: `${amountReceivedFormatted} ${PLATFORM_TOKEN.symbol}`,
    status,
    ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
  };

  const icon = status === "success" ? "✅" : status === "failed" ? "❌" : "⏳";
  console.log(`[Deposit] ${icon} cross-chain deposit result`, payload);
}

function safeChainName(chainId: number): string {
  try {
    return getChainMeta(chainId).name;
  } catch {
    return `chain ${chainId}`;
  }
}
