"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { extractPicksBlock, hidePartialPicksBlock } from "@/lib/ai/picks";
import { type Intent, type Persona } from "@/lib/ai/schema";
import { useAiChatSessionStore, type ChatMsg } from "@/stores/aiChatSessionStore";

/**
 * AI Chat 业务 hook（DD-106 Batch 5）。
 *
 * 责任：
 *   - 维护「待发送 → in-flight → ok/error」的消息生命周期
 *   - 提供 send/abort/retry 接口；用户切走自动 abort（unmount cleanup）
 *   - 调 /api/ai/chat（直接 fetch + AbortController，绕过 ky 以便精细取消）
 *
 * 不负责：
 *   - 持久化（aiChatSessionStore 处理）
 *   - 视图渲染
 */

const CONTEXT_WINDOW = 20;

interface UseAiChatOptions {
  persona?: Persona;
  /** 注入 fetch / endpoint，便于测试 */
  fetchFn?: typeof fetch;
  endpoint?: string;
}

interface SendResult {
  ok: boolean;
  errorCode?: string;
}

/** DD-107 §3.4.3：send 调用方可选择 intent + matchId（AI Badge 触发场景） */
export interface SendOptions {
  intent?: Intent;
  matchId?: string;
}

type SseReadResult = { kind: "done" } | { kind: "error"; code: string };

/**
 * DD-107 Step 2：流式读 SSE 响应。
 * 每个 event=token 的 delta 转交 onDelta 增量更新 UI；
 * event=done 正常结束；event=error 返回错误码。
 */
async function readSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onDelta: (delta: string) => void,
  onPhase?: (phase: "thinking" | "searching") => void
): Promise<SseReadResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const onAbort = () => reader.cancel().catch(() => {});
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let event = "message";
        const dataLines: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length === 0) continue;
        const data = dataLines.join("\n");
        if (event === "token") {
          const payload = JSON.parse(data) as { delta?: string };
          if (payload.delta) onDelta(payload.delta);
        } else if (event === "phase") {
          const payload = JSON.parse(data) as { phase?: string };
          if (payload.phase === "thinking" || payload.phase === "searching") {
            onPhase?.(payload.phase);
          }
        } else if (event === "error") {
          const payload = JSON.parse(data) as { code?: string };
          return { kind: "error", code: payload.code ?? "AI_INTERNAL" };
        } else if (event === "done") {
          return { kind: "done" };
        }
      }
    }
    return { kind: "done" };
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export function useAiChat(opts: UseAiChatOptions = {}) {
  const { fetchFn = fetch, endpoint = "/api/ai/chat", persona } = opts;
  const messages = useAiChatSessionStore((s) => s.messages);
  const appendMessage = useAiChatSessionStore((s) => s.appendMessage);
  const updateMessage = useAiChatSessionStore((s) => s.updateMessage);
  const streamPatchMessage = useAiChatSessionStore((s) => s.streamPatchMessage);
  const removeMessage = useAiChatSessionStore((s) => s.removeMessage);
  const setPendingMatchId = useAiChatSessionStore((s) => s.setPendingMatchId);

  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // unmount 时取消 in-flight 请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const post = useCallback(
    async (history: ChatMsg[], pendingId: string, sendOpts?: SendOptions): Promise<SendResult> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      let accumulated = "";

      // DD-107 §3.4.3：除了 status==="ok"，还要 !isPlaceholder
      // placeholder 是前端显示用的"请分析 X vs Y"占位，不能作为 LLM 上下文
      const requestMessages = history
        .filter((m) => m.status === "ok" && !m.isPlaceholder && m.content.trim().length > 0)
        .slice(-CONTEXT_WINDOW)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetchFn(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            messages: requestMessages,
            persona,
            intent: sendOpts?.intent,
            matchId: sendOpts?.matchId,
          }),
          signal: controller.signal,
        });

        // 前置错误（zod / rate limit / context / config）仍是 JSON 路径
        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok || !contentType.includes("text/event-stream")) {
          const body = (await res.json().catch(() => ({}))) as { code?: string };
          const code = body.code ?? `HTTP_${res.status}`;
          updateMessage(pendingId, {
            status: "error",
            errorCode: code,
            content: "AI service unavailable. Please retry.",
          });
          return { ok: false, errorCode: code };
        }

        // SSE 流式读：每个 delta 直接调用 streamPatchMessage（不写 localStorage，
        // zustand set 是同步的，React 18 在同一 event loop tick 内自动 batch 多次 setState）。
        // 注意：不使用 rAF 节流 —— xAI web_search 完成后会突发大量 delta，rAF 节流会把
        // 同一帧内到达的所有 delta 合并成一次渲染，导致"一股脑全到"的视觉现象。
        if (!res.body) {
          updateMessage(pendingId, {
            status: "error",
            errorCode: "AI_EMPTY_RESPONSE",
            content: "AI returned an empty response.",
          });
          return { ok: false, errorCode: "AI_EMPTY_RESPONSE" };
        }
        const result = await readSseStream(
          res.body,
          controller.signal,
          (delta) => {
            accumulated += delta;
            // DD-136 W3：oddfi-picks 机器协议块（含流式中的部分前缀）不渲染给用户
            streamPatchMessage(pendingId, hidePartialPicksBlock(accumulated));
          },
          (phase) => {
            // phase 事件低频（2-4 次/请求），直接用 updateMessage 走持久化路径，
            // 不需要 streamPatchMessage 的免持久化优化
            updateMessage(pendingId, { phase });
          }
        );

        if (result.kind === "error") {
          updateMessage(pendingId, {
            status: "error",
            errorCode: result.code,
            content: "AI service unavailable. Please retry.",
          });
          return { ok: false, errorCode: result.code };
        }
        if (accumulated.length === 0) {
          updateMessage(pendingId, {
            status: "error",
            errorCode: "AI_EMPTY_RESPONSE",
            content: "AI returned an empty response.",
          });
          return { ok: false, errorCode: "AI_EMPTY_RESPONSE" };
        }
        // DD-136 W3：流结束后剥离 oddfi-picks 块；match-analysis 消息把解析结果回填到
        // recommendation.picks（解析失败 → picks 缺省，渲染层走纯赔率派生兜底）
        const { cleanContent, picks } = extractPicksBlock(accumulated);
        const pendingMsg = useAiChatSessionStore
          .getState()
          .messages.find((m) => m.id === pendingId);
        updateMessage(pendingId, {
          status: "ok",
          content: cleanContent,
          ...(pendingMsg?.recommendation && picks
            ? { recommendation: { ...pendingMsg.recommendation, picks } }
            : {}),
        });
        return { ok: true };
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") {
          // 用户主动中止 / unmount：删除 pending assistant 占位，保留用户消息
          removeMessage(pendingId);
          return { ok: false, errorCode: "ABORTED" };
        }
        console.error("[useAiChat] network fail", e);
        updateMessage(pendingId, {
          status: "error",
          errorCode: "NETWORK_ERROR",
          content: "Network error, please retry.",
        });
        return { ok: false, errorCode: "NETWORK_ERROR" };
      } finally {
        setIsLoading(false);
        if (abortRef.current === controller) abortRef.current = null;
        // DD-107 §3.4.2：解锁 match-analysis button
        if (sendOpts?.matchId) setPendingMatchId(null);
      }
    },
    [
      endpoint,
      fetchFn,
      persona,
      removeMessage,
      setPendingMatchId,
      streamPatchMessage,
      updateMessage,
    ]
  );

  const send = useCallback(
    async (text: string, sendOpts?: SendOptions) => {
      const trimmed = text.trim();
      if (!trimmed) return { ok: false, errorCode: "EMPTY_INPUT" } satisfies SendResult;

      const now = Date.now();
      const userMsg: ChatMsg = {
        id: `u-${now}-${Math.random().toString(36).slice(2, 6)}`,
        role: "user",
        content: trimmed,
        createdAt: now,
        status: "ok",
      };
      const pendingAssistant: ChatMsg = {
        id: `a-${now}-${Math.random().toString(36).slice(2, 6)}`,
        role: "assistant",
        content: "",
        createdAt: now,
        status: "pending",
        // DD-120：match-analysis 触发 → 标记此回复下方渲染推荐卡。
        // 盖在 message 对象上（而非 post 内），retry 复用同对象自然保留（retry 不传 sendOpts）。
        recommendation:
          sendOpts?.intent === "match-analysis" && sendOpts?.matchId
            ? { matchId: sendOpts.matchId }
            : undefined,
      };
      appendMessage(userMsg);
      appendMessage(pendingAssistant);

      const history = [...useAiChatSessionStore.getState().messages].filter(
        (m) => m.id !== pendingAssistant.id
      );
      return post(history, pendingAssistant.id, sendOpts);
    },
    [appendMessage, post]
  );

  const retry = useCallback(
    async (assistantMsgId: string) => {
      const target = useAiChatSessionStore.getState().messages.find((m) => m.id === assistantMsgId);
      if (!target || target.role !== "assistant") {
        return { ok: false, errorCode: "RETRY_NOT_FOUND" } satisfies SendResult;
      }
      updateMessage(assistantMsgId, {
        status: "pending",
        content: "",
        errorCode: undefined,
        // REV-v1-A M-1：retry = 重新生成，旧 picks 必须清除——
        // 否则新流解析失败时旧推荐卡残留，与新正文盘口解读方向可能自相矛盾
        recommendation: target.recommendation
          ? { matchId: target.recommendation.matchId }
          : undefined,
      });
      const history = useAiChatSessionStore
        .getState()
        .messages.filter((m) => m.id !== assistantMsgId);
      return post(history, assistantMsgId);
    },
    [post, updateMessage]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    isLoading,
    send,
    abort,
    retry,
  };
}
