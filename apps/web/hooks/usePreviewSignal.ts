/**
 * DD-117 — preview-signal hook。
 *
 * 关键设计（DD §3.2）：
 * - 300ms 防抖（trailing）：marketId / outcome / amountWei 变化
 * - externalQuoteVersion 变化走 leading-edge：WS 推过来时立即重发，不卡 loading
 * - 单 in-flight + stale guard：新 key 触发旧 AbortController.abort()，resolve 前比对 ref
 * - 错误细分：network / params / server，params + server 触发 Sentry 上报
 * - disabled / amount=0 / null 任一 → idle，并立即 abort 任何挂起请求
 */

import { useEffect, useRef, useState } from "react";
import { HTTPError, TimeoutError } from "ky";
import * as Sentry from "@sentry/nextjs";
import { previewSignal } from "@/lib/api";
import type { PreviewSignalRes } from "@/types/onchain-betting";

export type PreviewError =
  | { kind: "network"; message: string }
  | { kind: "params"; code: number; message: string }
  | { kind: "server"; status: number; message: string };

export interface PreviewSignalState {
  data: PreviewSignalRes | null;
  loading: boolean;
  error: PreviewError | null;
  /** 来自 data.quoteVersion；用于反向喂给 DD-118 WS 订阅做对齐 */
  lastQuoteVersion: string | null;
}

export interface UsePreviewSignalArgs {
  marketId: string | null;
  outcome: number | null;
  /** ODD wei 字符串，"" / "0" / null 视为 idle */
  amountWei: string | null;
  enabled?: boolean;
  debounceMs?: number;
  /** WS 推送的最新 quoteVersion；变化时绕过防抖立即重发 */
  externalQuoteVersion?: string;
}

const IDLE: PreviewSignalState = {
  data: null,
  loading: false,
  error: null,
  lastQuoteVersion: null,
};

function makeKey(
  marketId: string | null,
  outcome: number | null,
  amountWei: string | null,
  externalQuoteVersion?: string
): string {
  return `${marketId ?? ""}|${outcome ?? ""}|${amountWei ?? ""}|${externalQuoteVersion ?? ""}`;
}

function isIdleInput(
  marketId: string | null,
  outcome: number | null,
  amountWei: string | null,
  enabled: boolean
): boolean {
  if (!enabled) return true;
  if (!marketId || outcome == null || !amountWei) return true;
  // amountWei <= 0
  if (amountWei === "0" || amountWei.replace(/^0+/, "") === "") return true;
  return false;
}

async function classifyError(err: unknown): Promise<PreviewError> {
  if (err instanceof TimeoutError) {
    return { kind: "network", message: "Request timed out" };
  }
  if (err instanceof HTTPError) {
    const status = err.response.status;
    let code = status;
    let message = err.message;
    try {
      const body = (await err.response.clone().json()) as { code?: number; message?: string };
      if (typeof body.code === "number") code = body.code;
      if (typeof body.message === "string") message = body.message;
    } catch {
      // body non-JSON — fall back to status/message
    }
    if (status >= 400 && status < 500) {
      return { kind: "params", code, message };
    }
    return { kind: "server", status, message };
  }
  if (err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"))) {
    // 别覆盖 state — 调用方判断 ref 是否仍是当前 controller
    return { kind: "network", message: "aborted" };
  }
  return { kind: "network", message: (err as Error)?.message ?? "Unknown network error" };
}

export function usePreviewSignal(args: UsePreviewSignalArgs): PreviewSignalState {
  const {
    marketId,
    outcome,
    amountWei,
    enabled = true,
    debounceMs = 300,
    externalQuoteVersion,
  } = args;

  const [state, setState] = useState<PreviewSignalState>(IDLE);
  const acRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalVersionRef = useRef<string | undefined>(externalQuoteVersion);

  useEffect(() => {
    // idle 短路
    if (isIdleInput(marketId, outcome, amountWei, enabled)) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (acRef.current) {
        acRef.current.abort();
        acRef.current = null;
      }
      setState(IDLE);
      lastExternalVersionRef.current = externalQuoteVersion;
      return;
    }

    const key = makeKey(marketId, outcome, amountWei, externalQuoteVersion);
    const externalChanged = externalQuoteVersion !== lastExternalVersionRef.current;
    lastExternalVersionRef.current = externalQuoteVersion;

    const fire = async () => {
      if (acRef.current) acRef.current.abort();
      const ac = new AbortController();
      acRef.current = ac;
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const data = await previewSignal(marketId as string, {
          outcome: outcome as number,
          requestedAmount: amountWei as string,
        });
        if (acRef.current !== ac) return; // stale guard
        setState({
          data,
          loading: false,
          error: null,
          lastQuoteVersion: data.quoteVersion,
        });
      } catch (err) {
        if (acRef.current !== ac) return; // stale guard — aborted by next key
        const classified = await classifyError(err);
        if (acRef.current !== ac) return; // 二次 stale guard：classifyError await 期间可能被新 key abort（REV-v3 M-02）
        if (classified.message === "aborted") return;
        if (classified.kind === "params" || classified.kind === "server") {
          Sentry.captureException(err, {
            tags: {
              feature: "preview-signal",
              error_kind: classified.kind,
            },
            extra: { key },
          });
        }
        setState({ data: null, loading: false, error: classified, lastQuoteVersion: null });
      }
    };

    // externalQuoteVersion 变化 → leading edge 立即发
    if (externalChanged) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      fire();
      return;
    }

    // 其余 key 变化 → trailing debounce
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      fire();
    }, debounceMs);
  }, [marketId, outcome, amountWei, enabled, debounceMs, externalQuoteVersion]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (acRef.current) acRef.current.abort();
    };
  }, []);

  return state;
}
