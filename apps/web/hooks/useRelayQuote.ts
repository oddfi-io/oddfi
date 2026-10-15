"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { RelayQuoteParams, RelayQuoteState } from "@/lib/relay/types";

const QUOTE_TTL_MS = 28_000; // Relay quotes expire at 30s; refresh at 28s to avoid last-second failures
const DEBOUNCE_MS = 800;

/**
 * 跨链报价 Hook
 *
 * - params 为 null 时进入 idle 状态
 * - params 变化后防抖 800ms 再请求，避免用户输入过程中频繁调用 Relay API
 * - 报价成功后 28s 自动刷新（Relay 报价 30s 过期），过期瞬间短暂进入 expired 状态禁用确认按钮
 * - 组件卸载时清理所有定时器，避免内存泄漏
 */
export function useRelayQuote(params: RelayQuoteParams | null): RelayQuoteState {
  const [state, setState] = useState<RelayQuoteState>({ status: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // 卸载时清理定时器 + 标记 unmounted
  // effect body 显式设 true：React 18 StrictMode 下 cleanup 被双调用后，
  // 重新挂载时需在此恢复为 true，否则 mountedRef 永久 false、fetchQuote 被 guard 拦截
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (refreshRef.current) clearTimeout(refreshRef.current);
    };
  }, []);

  const fetchQuote = useCallback(async (p: RelayQuoteParams) => {
    if (!mountedRef.current) return;
    setState({ status: "loading" });

    try {
      const { getRelayClient } = await import("@/lib/relay/client");
      const client = await getRelayClient();
      const quote = await client.actions.getQuote({
        chainId: p.chainId,
        currency: p.currency,
        toChainId: p.toChainId,
        toCurrency: p.toCurrency,
        amount: p.amount,
        user: p.user,
        tradeType: "EXACT_INPUT",
        ...(p.recipient ? { recipient: p.recipient } : {}),
        // refundTo 属 SDK `QuoteBodyOptions`，必须放在 `options` 下，不在 quote 顶层
        ...(p.refundTo ? { options: { refundTo: p.refundTo } } : {}),
      });

      if (!mountedRef.current) return;
      const expiresAt = Date.now() + QUOTE_TTL_MS;
      setState({ status: "success", quote, expiresAt });

      // 28s 后标记过期并自动刷新
      if (refreshRef.current) clearTimeout(refreshRef.current);
      refreshRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setState((s) => (s.status === "success" ? { status: "expired" } : s));
        fetchQuote(p);
      }, QUOTE_TTL_MS);
    } catch (err) {
      if (!mountedRef.current) return;
      // Relay 的价格影响/流动性等业务错误降级为 warn，避免 Next.js dev overlay 弹窗
      // UI 层通过 state.status === "error" 统一展示用户友好提示
      console.warn("[useRelayQuote] Failed to fetch quote", err);
      setState({
        status: "error",
        error: err instanceof Error ? err : new Error("Failed to fetch Relay quote"),
      });
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (refreshRef.current) clearTimeout(refreshRef.current);

    if (!params) {
      setState({ status: "idle" });
      return;
    }

    debounceRef.current = setTimeout(() => fetchQuote(params), DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (refreshRef.current) clearTimeout(refreshRef.current);
    };
    // 以各字段为 deps，避免父组件每次 render 传新对象引用触发重复请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params?.chainId,
    params?.currency,
    params?.toChainId,
    params?.toCurrency,
    params?.amount,
    params?.user,
    params?.recipient,
    params?.refundTo,
    fetchQuote,
  ]);

  return state;
}
