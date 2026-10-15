"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { formatUnits, parseUnits } from "viem";
import { bsc } from "wagmi/chains";
import { useAccount } from "wagmi";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import TokenSelector from "./TokenSelector";
import TokenPickerModal from "./token-picker/TokenPickerModal";
import type { PickerItem, PickerMode } from "./token-picker/types";
import ExchangeIcon from "@/components/icons/ExchangeIcon";
import SettingsIcon from "@/components/icons/SettingsIcon";
import RelayIcon from "@/components/icons/RelayIcon";
import PancakeSwapIcon from "@/components/icons/PancakeSwapIcon";
import { useWallet } from "@/hooks/useWallet";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { useWalletSheetStore } from "@/stores/walletSheetStore";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTokenApproval } from "@/hooks/useTokenApproval";
import { usePancakeQuote, createPancakeSwap } from "@/lib/swap/pancake-adapter";
import { useRelayQuote } from "@/hooks/useRelayQuote";
import { useRelayExecute } from "@/hooks/useRelayExecute";
import { PLATFORM_TOKEN } from "@/lib/platform-token";
import { CORE_CHAIN } from "@/lib/chains";
import { selectSwapRoute } from "@/lib/swap/route-selector";
import { resolveDefaultToToken } from "@/lib/swap/resolve-to-token-list";
import { clampAmountToBalance, shouldTriggerSwitchAndQuote } from "@/lib/swap/amount-clamp";
import { getTokenByChainAndSymbol, BSC_TESTNET_TOKENS } from "@/lib/token-registry";
import { IS_TESTNET } from "@/lib/network-mode";
import { showToast } from "@/lib/toast";
import { useWalletDisplayStore } from "@/stores/walletDisplayStore";
import { useMultiChainPortfolio } from "@/hooks/useMultiChainPortfolio";
import { pickDefaultFromAsset } from "@/lib/chains/fallback-priority";
import { isGt, isValidAmount, div, mul, sub } from "@/lib/decimal";
import { formatAmount, formatBalance } from "@/lib/decimal";
import type { TokenMeta } from "@/lib/token-registry";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";

interface SwapCardProps {
  slippage: number;
  onOpenSlippage: () => void;
}

// 持久化用户上次选择的 from token（TokenMeta 以 symbol+chainId 唯一确定，
// 存最小字段而非整对象，避免 iconUrl/tier 后续变更导致读到过期数据）
const FROM_TOKEN_STORAGE_KEY = "swap:lastFromToken";

// 默认兑换方向：BSC USDT → 平台币（TODD）。无持久化/无 portfolio 数据时使用。
const DEFAULT_FROM_TOKEN: TokenMeta = getTokenByChainAndSymbol(bsc.id, "USDT") ?? PLATFORM_TOKEN;

// testnet 模式固定代币对：testnet USDT → testnet ODD（不可更改）
const TESTNET_FROM_TOKEN: TokenMeta = BSC_TESTNET_TOKENS.find((t) => t.symbol === "USDT")!;
const TESTNET_TO_TOKEN: TokenMeta = BSC_TESTNET_TOKENS.find((t) => t.symbol === "ODD")!;

function readPersistedFromToken(): TokenMeta | null {
  try {
    const raw = window.localStorage.getItem(FROM_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { symbol?: string; chainId?: number };
    if (!parsed.symbol || typeof parsed.chainId !== "number") return null;
    return getTokenByChainAndSymbol(parsed.chainId, parsed.symbol) ?? null;
  } catch {
    return null;
  }
}

export default function SwapCard({ slippage, onOpenSlippage }: SwapCardProps) {
  const t = useTranslations("swap");

  // ── Portfolio（多链，不再过滤 BSC-only）────────────────────────
  const { portfolio: allPortfolio } = useMultiChainPortfolio();

  // 初始化：SSR / client 首次渲染保持一致（都是 DEFAULT_FROM_TOKEN），
  // 避免读 localStorage 造成 Hydration 失配。mount 后 useEffect 从 LS 恢复用户选择。
  // testnet 模式直接固定为 testnet USDT → testnet ODD，跳过 LS/portfolio 逻辑。
  const [fromToken, setFromToken] = useState<TokenMeta>(
    IS_TESTNET ? TESTNET_FROM_TOKEN : DEFAULT_FROM_TOKEN
  );
  const [toToken, setToToken] = useState<TokenMeta>(() =>
    IS_TESTNET ? TESTNET_TO_TOKEN : resolveDefaultToToken(DEFAULT_FROM_TOKEN)
  );
  const [fromAmount, setFromAmount] = useState("");

  const [pickerOpen, setPickerOpen] = useState<PickerMode | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ENH-018: 防止 LS persist effect 在 mount-once hydrate 之前先写 DEFAULT 覆盖 LS。
  // React effect 按声明顺序执行：hydrate effect 里 setFromToken(persisted) 只是调度下一次
  // 渲染；同一 commit 内后续 persist effect 的闭包里 fromToken 仍是 DEFAULT，
  // 写入会把用户上次持久化的选择覆盖成 DEFAULT，刷新后 fromToken 看起来被"重置"。
  const hasRestoredRef = useRef(false);

  // mount-once：hydration 完成后从 localStorage 恢复上次选择（testnet 跳过，代币固定）
  useEffect(() => {
    if (IS_TESTNET) return;
    const persisted = readPersistedFromToken();
    if (persisted) {
      setFromToken(persisted);
      setToToken(resolveDefaultToToken(persisted));
    }
  }, []);

  // 首次 portfolio 加载完成且用户无持久化选择时，按链优先级选默认 from（testnet 跳过）
  const portfolioSyncedRef = useRef(false);
  useEffect(() => {
    if (IS_TESTNET) return;
    if (portfolioSyncedRef.current) return;
    if (allPortfolio.length === 0) return;
    portfolioSyncedRef.current = true;
    if (readPersistedFromToken()) return; // 已从 LS 恢复，不覆盖
    const pick = pickDefaultFromAsset(allPortfolio);
    if (pick) {
      setFromToken(pick.meta);
      setToToken(resolveDefaultToToken(pick.meta));
    }
  }, [allPortfolio]);

  // fromToken 变化时持久化（仅写 symbol+chainId 两字段）
  // ENH-018: 首次 mount 不写 —— mount-once hydrate 还没把 persisted 刷进 state；
  // 此时闭包里的 fromToken 仍是 DEFAULT，写下去会覆盖 LS 里用户真实的上次选择。
  // 等到下一次渲染（hydrate 的 setFromToken 已 flush，或用户主动切 token），再写。
  useEffect(() => {
    if (IS_TESTNET) return; // testnet 代币固定，无需持久化
    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      return;
    }
    try {
      window.localStorage.setItem(
        FROM_TOKEN_STORAGE_KEY,
        JSON.stringify({ symbol: fromToken.symbol, chainId: fromToken.chainId })
      );
    } catch {
      // 忽略 quota / 隐私模式等写入失败
    }
  }, [fromToken.symbol, fromToken.chainId]);

  // Wallet & network state
  const { address } = useWallet();
  const {
    canOperateOnCore,
    isDisconnected,
    isOnChain,
    switchTo,
    isSwitching,
    switchError,
    currentChain,
  } = useNetworkGuard();
  const triggerConnect = useWalletSheetStore((s) => s.triggerConnect);

  // 钱包真正断开（非 wagmi reconnecting 中间态）→ 重置 swap 选择，避免残留的
  // fromToken.chainId 与下次 performLogin 的 BSC 切链竞态。
  // ENH-018: 改用 wagmi 原始 status 而非 useNetworkGuard.isDisconnected —— 后者仅看
  // !address，在 status='reconnecting' 阶段 address 也是 undefined，会误触发重置并
  // 清掉 LS，刷新后 fromToken 看起来被"重置"（即本次要修的 bug）。
  const { status: accountStatus } = useAccount();
  useEffect(() => {
    if (accountStatus !== "disconnected") return;
    if (IS_TESTNET) {
      setFromToken(TESTNET_FROM_TOKEN);
      setToToken(TESTNET_TO_TOKEN);
    } else {
      setFromToken(DEFAULT_FROM_TOKEN);
      setToToken(resolveDefaultToToken(DEFAULT_FROM_TOKEN));
      portfolioSyncedRef.current = false;
      try {
        window.localStorage.removeItem(FROM_TOKEN_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    setFromAmount("");
  }, [accountStatus]);

  // ── 路由判断 ─────────────────────────────────────────────────
  const route = selectSwapRoute(fromToken.chainId);

  // Real on-chain balances
  const {
    balance: fromBalance,
    formatted: fromBalanceFormatted,
    refetch: refetchFromBalance,
  } = useTokenBalance(address, fromToken);
  const { refetch: refetchToBalance } = useTokenBalance(address, toToken);

  // ── Pancake 路径 ──────────────────────────────────────────────
  const pancakeParams =
    route === "pancake" && address
      ? {
          fromToken,
          toToken,
          amount: fromAmount,
          slippageBps: Math.round(slippage * 100),
          recipient: address as `0x${string}`,
          owner: address as `0x${string}`,
        }
      : undefined;

  const { data: pancakeQuote, isLoading: isPancakeQuoteLoading } = usePancakeQuote(pancakeParams);

  // amountIn derived from pancake quote
  const amountIn = pancakeQuote?.amountIn ?? 0n;

  // ERC-20 approval (only for Pancake path)
  const {
    needsApproval,
    isApproving,
    isApproveConfirmed,
    approveTxHash,
    approve,
    refetchAllowance,
  } = useTokenApproval(address, fromToken, route === "pancake" ? amountIn : 0n);

  const bumpBalance = useWalletDisplayStore((s) => s.bumpBalance);

  // ── Relay 路径 ────────────────────────────────────────────────
  const relayQuoteParams = useMemo(() => {
    if (route !== "relay" || !address || !isValidAmount(fromAmount)) return null;
    try {
      const rawAmount = parseUnits(fromAmount, fromToken.decimals).toString();
      return {
        chainId: fromToken.chainId,
        currency: fromToken.address as string,
        toChainId: bsc.id,
        toCurrency: PLATFORM_TOKEN.address as string,
        amount: rawAmount,
        user: address,
        // Swap 语义：资金留在用户自己的 EOA（与 Deposit 发往 proxyWallet 不同）
        recipient: address,
        refundTo: address,
      };
    } catch {
      return null;
    }
  }, [route, address, fromAmount, fromToken]);

  const relayQuoteState = useRelayQuote(relayQuoteParams);
  const { state: relayExecState, execute: relayExecute } = useRelayExecute();

  // ── Approve → Swap auto-chain (Pancake only) ──────────────────
  const [autoSwapPending, setAutoSwapPending] = useState(false);
  const handledApproveHashRef = useRef<string | undefined>(undefined);
  const pendingSwapRef = useRef<{ fa: string; fs: string; ta: string; ts: string } | null>(null);
  const executeSwapRef = useRef<() => void>(() => {});

  /** Pure Pancake swap execution */
  function executeSwap() {
    // DD-113: 认购模式短路（按钮已 disabled，此处兜底防御）
    if (IS_SUBSCRIPTION_MODE) return;
    if (!address || !pancakeQuote || !canOperateOnCore || !pancakeParams) return;

    pendingSwapRef.current = {
      fa: fromAmount,
      fs: fromToken.symbol,
      ta: pancakeQuote.amountOutFormatted,
      ts: toToken.symbol,
    };

    const adapter = createPancakeSwap(pancakeParams);

    adapter
      .execute(pancakeQuote)
      .then(() => {
        showToast("Swap submitted — awaiting confirmation", "info");
        setFromAmount("");
        refetchFromBalance();
        refetchToBalance();
        refetchAllowance();
        bumpBalance();
        if (pendingSwapRef.current) {
          const { fa, fs, ta, ts } = pendingSwapRef.current;
          showToast(
            `Swap successful — ${formatAmount(fa, 6)} ${fs} → ${formatAmount(ta, 6)} ${ts}`,
            "success"
          );
          pendingSwapRef.current = null;
        }
      })
      .catch((err: Error) => {
        console.error("[SwapCard] Swap rejected", err);
        const msg = err.message?.split("\n")[0]?.slice(0, 80) || "Unknown error";
        showToast(`Swap failed — ${msg}`, "error");
        pendingSwapRef.current = null;
      });
  }

  executeSwapRef.current = executeSwap;

  /** Main action handler */
  function handleAction() {
    // DD-113: 认购模式短路
    if (IS_SUBSCRIPTION_MODE) return;
    if (route === "relay") {
      if (relayQuoteState.status !== "success") return;
      relayExecute(relayQuoteState.quote).catch((err: Error) => {
        console.error("[SwapCard] Relay execute failed", err);
        showToast(
          `Swap failed — ${err.message?.split("\n")[0]?.slice(0, 80) || "Unknown error"}`,
          "error"
        );
      });
      return;
    }

    // Pancake path
    if (!address || !pancakeQuote || !canOperateOnCore) return;

    if (needsApproval) {
      setAutoSwapPending(true);
      approve({
        onError(err) {
          console.error("[SwapCard] Approval rejected", err);
          setAutoSwapPending(false);
          showToast("Approval rejected", "error");
        },
      });
    } else {
      executeSwap();
    }
  }

  // Auto-chain: after approval tx confirms → immediately fire swap
  useEffect(() => {
    if (!autoSwapPending || !isApproveConfirmed || isApproving) return;
    if (approveTxHash === handledApproveHashRef.current) return;
    handledApproveHashRef.current = approveTxHash;

    setAutoSwapPending(false);
    showToast("Approved — submitting swap...", "info");
    executeSwapRef.current();
  }, [autoSwapPending, isApproveConfirmed, isApproving, approveTxHash]);

  // Relay 完成后自动切回 BSC，避免钱包停留在源链影响后续登录/交易
  useEffect(() => {
    if (relayExecState.status !== "completed") return;
    if (isOnChain(CORE_CHAIN.id)) return;
    switchTo(CORE_CHAIN.id);
  }, [relayExecState.status, isOnChain, switchTo]);

  // ── 自动切链：fromToken 所在链与钱包当前链不同时，防抖后触发 switchChain
  //    用户可能快速切换代币，用 600ms 防抖避免连续弹出钱包确认框
  //    Relay 完成态由上面的 effect 接管，这里跳过避免循环
  const switchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSwitchTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (isDisconnected) return;
    // currentChain 在 wagmi 初始化/重连过程中可能暂时为 undefined；
    // 此时无法判断是否需要切链，直接返回，等链信息稳定后再判断。
    // 若缺此 guard，undefined !== fromToken.chainId 会误触发 switchTo，
    // 导致 wagmi 短暂 disconnect → fromAmount 被 disconnect effect 清空。
    if (!currentChain) return;
    if (relayExecState.status === "completed") return;
    if (currentChain.id === fromToken.chainId) {
      lastSwitchTargetRef.current = null;
      return;
    }
    // 仅当用户输入了合法金额（正数且 ≤ 余额）后才触发切链，避免仅选代币就弹钱包
    // 具体 gating 规则见 lib/swap/amount-clamp.ts，已单测覆盖
    if (!shouldTriggerSwitchAndQuote(fromAmount, fromBalance, fromToken.decimals)) return;
    if (isSwitching && lastSwitchTargetRef.current === fromToken.chainId) return;

    if (switchDebounceRef.current) clearTimeout(switchDebounceRef.current);
    switchDebounceRef.current = setTimeout(() => {
      lastSwitchTargetRef.current = fromToken.chainId;
      switchTo(fromToken.chainId);
    }, 600);

    return () => {
      if (switchDebounceRef.current) clearTimeout(switchDebounceRef.current);
    };
  }, [
    fromToken.chainId,
    fromToken.decimals,
    currentChain?.id,
    isDisconnected,
    isSwitching,
    switchTo,
    relayExecState.status,
    fromAmount,
    fromBalance,
  ]);

  // 切链失败（用户拒绝、钱包不支持等）→ toast 提示；用 ref 去重避免 switchError 持久化刷屏
  const lastSwitchErrorRef = useRef<unknown>(null);
  useEffect(() => {
    if (!switchError) {
      lastSwitchErrorRef.current = null;
      return;
    }
    if (switchError === lastSwitchErrorRef.current) return;
    lastSwitchErrorRef.current = switchError;
    console.error("[SwapCard] Chain switch rejected", switchError);
    showToast("Network switch rejected — tap the button to retry", "error");
  }, [switchError]);

  const isSwapping = false;

  // ── Derived state ─────────────────────────────────────────────
  const hasAmount =
    !!fromAmount && (route === "pancake" ? amountIn > 0n : isValidAmount(fromAmount));
  const isInsufficientBalance = route === "pancake" && hasAmount && fromBalance < amountIn;
  const isQuoteLoading =
    route === "pancake" ? isPancakeQuoteLoading : relayQuoteState.status === "loading";

  const handleSwapTokens = useCallback(() => {
    // Relay 路径 toToken 锁定为 PLATFORM_TOKEN，不允许反转
    if (route === "relay") return;
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount("");
  }, [fromToken, toToken, route]);

  const handleFromTokenChange = (token: TokenMeta) => {
    if (token.symbol === toToken.symbol && token.chainId === toToken.chainId) {
      if (route !== "relay") {
        handleSwapTokens();
      }
      return;
    }
    setFromToken(token);
    // to 固定锁定 PLATFORM_TOKEN（BSC TODD）—— 除非路由变到 Relay 需要强制 PLATFORM_TOKEN，
    // 或 new from 与当前 to 冲突（例如 from=TODD 时）才用 resolveDefaultToToken 回退
    const newRoute = selectSwapRoute(token.chainId);
    if (newRoute === "relay") {
      setToToken(PLATFORM_TOKEN);
    } else if (toToken.symbol === token.symbol && toToken.chainId === token.chainId) {
      setToToken(resolveDefaultToToken(token));
    }
    // 其他情况保留当前 toToken（通常就是 PLATFORM_TOKEN）
    setFromAmount("");
  };

  const handleToTokenChange = (token: TokenMeta) => {
    if (token.symbol === fromToken.symbol && token.chainId === fromToken.chainId) {
      if (route !== "relay") {
        handleSwapTokens();
      }
    } else {
      setToToken(token);
      setFromAmount("");
    }
  };

  /** Sanitize amount input — only digits + single dot, no negatives/exponents */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      setFromAmount("");
      return;
    }
    if (!/^\d*\.?\d*$/.test(raw)) return;
    // 超余额自动抹到 max —— 具体逻辑见 lib/swap/amount-clamp.ts，已单测覆盖边界
    setFromAmount(clampAmountToBalance(raw, fromBalance, fromToken.decimals));
  };

  const handleSetMax = () => {
    if (fromBalance > 0n) {
      setFromAmount(formatBalance(formatUnits(fromBalance, fromToken.decimals), 6));
    }
  };

  // ── 输出金额展示 ──────────────────────────────────────────────
  const toAmountDisplay = useMemo(() => {
    if (route === "pancake" && pancakeQuote) {
      return formatAmount(pancakeQuote.amountOutFormatted, 6);
    }
    if (route === "relay" && relayQuoteState.status === "success") {
      const details = relayQuoteState.quote.details;
      const currencyOut = details?.currencyOut;
      if (currencyOut?.amountFormatted) {
        return formatAmount(currencyOut.amountFormatted, 6);
      }
    }
    return "";
  }, [route, pancakeQuote, relayQuoteState]);

  // ── Relay 输出金额 (formatted) ────────────────────────────────
  const relayAmountOutFormatted = useMemo(() => {
    if (route !== "relay" || relayQuoteState.status !== "success") return "";
    return relayQuoteState.quote.details?.currencyOut?.amountFormatted ?? "";
  }, [route, relayQuoteState]);

  // ── 汇率文本 ──────────────────────────────────────────────────
  const rateText = useMemo(() => {
    if (route === "pancake") {
      return pancakeQuote
        ? `1 ${fromToken.symbol} ≈ ${formatAmount(pancakeQuote.rate, 6)} ${toToken.symbol}`
        : isQuoteLoading && hasAmount
          ? t("fetchingRate")
          : "—";
    }
    // Relay: rate = amountOut / amountIn
    if (relayAmountOutFormatted && isValidAmount(fromAmount) && isGt(fromAmount, "0")) {
      try {
        const r = div(relayAmountOutFormatted, fromAmount);
        return `1 ${fromToken.symbol} ≈ ${formatAmount(r, 6)} ${toToken.symbol}`;
      } catch {
        return "—";
      }
    }
    return isQuoteLoading && hasAmount ? t("fetchingRate") : "—";
  }, [
    route,
    pancakeQuote,
    relayAmountOutFormatted,
    fromAmount,
    fromToken,
    toToken,
    isQuoteLoading,
    hasAmount,
    t,
  ]);

  // ── 路由路径文本 ──────────────────────────────────────────────
  const routePathText = useMemo(() => {
    if (route === "pancake" && pancakeQuote) {
      return pancakeQuote.path.length === 2
        ? `${fromToken.symbol} → ${toToken.symbol}`
        : `${fromToken.symbol} → BNB → ${toToken.symbol}`;
    }
    if (route === "relay") {
      return `${fromToken.symbol} → ${toToken.symbol}`;
    }
    return "";
  }, [route, pancakeQuote, fromToken, toToken]);

  // ── 最少收到文本 ──────────────────────────────────────────────
  const minReceivedText = useMemo(() => {
    if (route === "pancake" && pancakeQuote) {
      return `${formatAmount(pancakeQuote.minReceivedFormatted, 6)} ${toToken.symbol}`;
    }
    if (route === "relay" && relayAmountOutFormatted) {
      try {
        const factor = sub("1", div(String(slippage), "100"));
        const min = mul(relayAmountOutFormatted, factor);
        return `${formatAmount(min, 6)} ${toToken.symbol}`;
      } catch {
        return "—";
      }
    }
    return "—";
  }, [route, pancakeQuote, relayAmountOutFormatted, slippage, toToken]);

  // ── Button state machine ──────────────────────────────────────
  const renderButton = () => {
    const baseClass =
      "min-h-[48px] w-full flex items-center justify-center gap-2 rounded-12 px-4 text-[14px] font-medium transition-opacity shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]";

    if (!mounted || isDisconnected) {
      return (
        <button
          onClick={triggerConnect}
          className={`${baseClass} bg-btn-primary-white text-static-black hover:bg-btn-primary-white-hover`}
          style={{ touchAction: "manipulation" }}
        >
          {t("connectWallet")}
        </button>
      );
    }

    // 未输入金额：按钮静默禁用（无金额不做切链/报价，避免频繁弹钱包）
    if (!hasAmount) {
      return (
        <button
          disabled
          className={`${baseClass} cursor-not-allowed bg-btn-primary-white text-static-black opacity-50`}
        >
          {t("swap")}
        </button>
      );
    }

    // 有金额但不在源链 → auto-switch effect 处理；按钮显示切链进度，可点击手动重试
    const requiredChainId = fromToken.chainId;
    if (!isOnChain(requiredChainId)) {
      return (
        <button
          onClick={() => !isSwitching && switchTo(requiredChainId)}
          disabled={isSwitching}
          className={`${baseClass} bg-btn-primary-white text-static-black ${
            isSwitching
              ? "cursor-not-allowed opacity-60"
              : "hover:bg-btn-primary-white-hover cursor-pointer"
          }`}
          style={{ touchAction: "manipulation" }}
        >
          {t("switchingNetwork")}
        </button>
      );
    }

    if (isInsufficientBalance) {
      return (
        <button
          disabled
          className={`${baseClass} cursor-not-allowed border border-fn-red bg-fn-red/10 text-fn-red opacity-70`}
        >
          {t("insufficientBalance", { token: fromToken.symbol })}
        </button>
      );
    }

    // ── Relay 路径状态机 ─────────────────────────────────────────
    if (route === "relay") {
      const execStatus = relayExecState.status;
      if (execStatus === "signing" || execStatus === "relaying") {
        return (
          <button disabled className={`${baseClass} bg-fn-brand text-static-black opacity-60`}>
            {execStatus === "signing" ? t("approving") : t("swapping")}
          </button>
        );
      }
      if (relayQuoteState.status === "loading") {
        return (
          <button
            disabled
            className={`${baseClass} bg-btn-primary-white text-static-black opacity-60`}
          >
            {t("fetchingQuote")}
          </button>
        );
      }
      if (relayQuoteState.status === "expired") {
        return (
          <button
            disabled
            className={`${baseClass} bg-btn-primary-white text-static-black opacity-60`}
          >
            {t("fetchingQuote")}
          </button>
        );
      }
      if (relayQuoteState.status === "error") {
        return (
          <button
            disabled
            className={`${baseClass} cursor-not-allowed bg-btn-primary-white text-static-black opacity-50`}
          >
            {t("swap")}
          </button>
        );
      }
      if (relayQuoteState.status === "success") {
        return (
          <button
            onClick={handleAction}
            disabled={IS_SUBSCRIPTION_MODE}
            className={`${baseClass} bg-btn-primary-white text-static-black hover:bg-btn-primary-white-hover ${IS_SUBSCRIPTION_MODE ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{ touchAction: "manipulation" }}
          >
            {/* DD-113: 认购模式文案改 Coming Soon */}
            {IS_SUBSCRIPTION_MODE ? "Coming Soon" : t("swap")}
          </button>
        );
      }
      // idle
      return (
        <button
          disabled
          className={`${baseClass} cursor-not-allowed bg-btn-primary-white text-static-black opacity-50`}
        >
          {t("swap")}
        </button>
      );
    }

    // ── Pancake 路径状态机 ────────────────────────────────────────
    if (isApproving || autoSwapPending) {
      return (
        <button disabled className={`${baseClass} bg-fn-brand text-static-black opacity-60`}>
          {t("approving")}
        </button>
      );
    }

    if (isSwapping) {
      return (
        <button
          disabled
          className={`${baseClass} bg-btn-primary-white text-static-black opacity-60`}
        >
          <span>⟳</span>
          {t("swapping")}
        </button>
      );
    }

    return (
      <button
        onClick={handleAction}
        disabled={isPancakeQuoteLoading || !pancakeQuote || IS_SUBSCRIPTION_MODE}
        className={`${baseClass} bg-btn-primary-white text-static-black hover:bg-btn-primary-white-hover ${isPancakeQuoteLoading ? "opacity-60" : ""} ${IS_SUBSCRIPTION_MODE ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ touchAction: "manipulation" }}
      >
        {/* DD-113: 认购模式文案改 Coming Soon */}
        {IS_SUBSCRIPTION_MODE
          ? "Coming Soon"
          : isPancakeQuoteLoading
            ? t("fetchingQuote")
            : t("swap")}
      </button>
    );
  };

  const handlePickerSelect = (item: PickerItem) => {
    // 防冲突早退：选中的 token 与对侧相同则直接忽略（UI 上该行已 disabled，
    // 此处为双重保险，防止键盘/外部事件绕过）
    const otherSide = pickerOpen === "pay" ? toToken : fromToken;
    if (item.chainId === otherSide.chainId && item.symbol === otherSide.symbol) return;

    // 现场组装 TokenMeta：owned 分支的 token 可能不在 registry（portfolio 扫链发现的长尾代币），
    // 必须从 PickerItem 自带字段组装而非回查 registry，避免静默丢选
    const meta: TokenMeta = {
      chainId: item.chainId,
      symbol: item.symbol,
      name: item.name,
      decimals: item.decimals ?? 18,
      address: (item.address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      isNative: item.isNative ?? false,
      iconUrl: item.tokenIconUrl,
      tier: item.tier ?? 3,
    };

    if (pickerOpen === "pay") {
      handleFromTokenChange(meta);
    } else if (pickerOpen === "receive") {
      handleToTokenChange(meta);
    }
  };

  const pickerSelectedId =
    pickerOpen === "pay"
      ? `${fromToken.chainId}:${fromToken.symbol}`
      : pickerOpen === "receive"
        ? `${toToken.chainId}:${toToken.symbol}`
        : undefined;

  // 防冲突 disable（DD-078 §3.3 D6）：pay 列表灰掉当前 toToken；receive 列表灰掉当前 fromToken
  const pickerDisabledId = useMemo(() => {
    if (pickerOpen === "pay") return `${toToken.chainId}:${toToken.symbol}`;
    if (pickerOpen === "receive") return `${fromToken.chainId}:${fromToken.symbol}`;
    return undefined;
  }, [pickerOpen, fromToken.chainId, fromToken.symbol, toToken.chainId, toToken.symbol]);

  return (
    <div className="w-full flex flex-col gap-[24px] lg:h-full lg:rounded-16 lg:border-4 lg:border-secondary lg:bg-fill-card1 lg:p-[32px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron text-[20px] font-bold leading-[28px] tracking-[-0.24px] text-primary lg:text-[24px] lg:leading-[32px]">
          {t("title")}
        </h2>
        <button
          onClick={onOpenSlippage}
          className="hidden lg:flex min-h-[44px] min-w-[44px] items-center justify-center text-secondary transition-colors hover:text-primary"
          title={t("slippageSettings")}
          style={{ touchAction: "manipulation" }}
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      {/* Inputs area: Pay + toggle + Receive — Figma 用 flex-[1_0_0] 让两 input 平分剩余高度 */}
      <div className="relative flex flex-col gap-[12px] lg:flex-1 lg:min-h-0">
        {/* From panel — Figma: flex-col gap-[18px], justify-between, flex-[1_0_0] */}
        <div className="flex flex-col gap-[18px] rounded-12 border border-secondary p-[16px] lg:flex-1 lg:min-h-0 lg:px-[24px] lg:py-[21px]">
          <div className="text-[14px] leading-[19px] text-secondary">{t("pay")}</div>
          <div className="flex items-center justify-between">
            <TokenSelector
              value={fromToken}
              onClick={() => setPickerOpen("pay")}
              locked={IS_TESTNET}
            />
            <div className="flex flex-1 flex-col items-end gap-px">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={fromAmount}
                onChange={handleAmountChange}
                className="w-full bg-transparent text-right text-[24px] font-bold leading-[24px] tracking-[-0.24px] outline-none placeholder:text-tertiary text-tertiary [&:not(:placeholder-shown)]:text-primary"
              />
              {mounted && !isDisconnected ? (
                <div className="flex items-center gap-2 text-[12px] font-medium leading-[18px] text-tertiary">
                  <span>{fromBalance === 0n ? "0" : formatAmount(fromBalanceFormatted, 6)}</span>
                  {fromBalance > 0n && (
                    <button
                      onClick={handleSetMax}
                      className="min-h-[28px] rounded-full border border-secondary px-2.5 text-[11px] text-secondary transition-colors hover:text-primary"
                      style={{ touchAction: "manipulation" }}
                    >
                      {t("max")}
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[12px] font-medium leading-[18px] text-tertiary">--</span>
              )}
            </div>
          </div>
        </div>

        {/* To panel — Figma: flex-col gap-[18px], justify-between, flex-[1_0_0] */}
        <div className="flex flex-col gap-[18px] rounded-12 border border-secondary p-[16px] lg:flex-1 lg:min-h-0 lg:px-[24px] lg:py-[21px]">
          <div className="text-[14px] leading-[19px] text-secondary">{t("receive")}</div>
          <div className="flex items-center justify-between">
            <TokenSelector
              value={toToken}
              onClick={() => setPickerOpen("receive")}
              locked={IS_TESTNET}
            />
            <div className="flex flex-1 flex-col items-end gap-px">
              <input
                type="text"
                placeholder="0"
                value={toAmountDisplay}
                disabled
                className="w-full cursor-default bg-transparent text-right text-[24px] font-bold leading-[24px] tracking-[-0.24px] outline-none placeholder:text-tertiary text-tertiary [&:not(:placeholder-shown)]:text-primary"
              />
              <span className="text-[12px] font-medium leading-[18px] text-tertiary">
                {isQuoteLoading && hasAmount ? t("loading") : "--"}
              </span>
            </div>
          </div>
        </div>

        {/* Swap 方向切换 — 绝对居中，Figma 自定义 exchange icon */}
        <button
          onClick={handleSwapTokens}
          className="absolute left-1/2 top-1/2 flex size-[38px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[20px] border border-secondary bg-fill-card1 text-secondary transition-transform duration-300 hover:rotate-180 hover:text-primary"
          style={{ touchAction: "manipulation" }}
        >
          <ExchangeIcon size={22} />
        </button>
      </div>

      {/* Quote details — Figma 3376:77651：4 行明细（参考汇率 / 路由 / 滑点 / 最少收到） */}
      {/* Relay 报价失败（流动性/价格影响过高）时用红字替换整块明细，
          引导用户增加金额而非让用户对着空白的汇率区疑惑 */}
      {hasAmount && route === "relay" && relayQuoteState.status === "error" && (
        <p className="text-center text-[13px] text-fn-red leading-[18px]">
          {t("quoteErrorLowLiquidity")}
        </p>
      )}
      {hasAmount && !(route === "relay" && relayQuoteState.status === "error") && (
        <div className="flex flex-col gap-[12px] text-[14px] leading-[19px]">
          {/* 参考汇率 */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">{t("referenceRate")}</span>
            <span className="text-primary">{rateText}</span>
          </div>

          {/* 路由 */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">{t("routing")}</span>
            <div className="flex items-center gap-[4px]">
              {route === "relay" ? <RelayIcon size={20} /> : <PancakeSwapIcon size={20} />}
              <span className="text-primary">{route === "relay" ? "Relay" : "PancakeSwap"}</span>
              {routePathText && <span className="text-secondary">{routePathText}</span>}
            </div>
          </div>

          {/* 滑点设置 — 复用右上角 SlippageModal */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">{t("slippageSettings")}</span>
            <button
              type="button"
              onClick={onOpenSlippage}
              className="flex items-center gap-[4px] text-primary hover:opacity-80 transition-opacity"
              style={{ touchAction: "manipulation" }}
            >
              <span>
                {t("auto")} · {slippage}%
              </span>
              <PencilSimpleIcon size={18} className="text-secondary" />
            </button>
          </div>

          {/* 最少收到 */}
          <div className="flex items-center justify-between">
            <span className="text-secondary">{t("minimumReceived")}</span>
            <span className="text-primary">{minReceivedText}</span>
          </div>
        </div>
      )}

      {/* Action button */}
      {renderButton()}

      {/* Token picker (DD-078 真实数据源，PC Modal / H5 BottomSheet) */}
      <TokenPickerModal
        open={pickerOpen !== null}
        mode={pickerOpen ?? "pay"}
        onClose={() => setPickerOpen(null)}
        onSelect={handlePickerSelect}
        selectedId={pickerSelectedId}
        disabledId={pickerDisabledId}
      />
    </div>
  );
}
