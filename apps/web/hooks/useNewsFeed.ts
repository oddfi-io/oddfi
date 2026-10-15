/**
 * DD-110 §3.3 — News 推送 hook（SSE + 翻页 + 去重 + 通知音）。
 *
 * 关键设计：
 * - 唯一权威：`cardsMap: Map<id, PushCard>` 单源；selector sort by ingestedAt desc + ringed 200
 * - SSE 状态机：connecting → open ↔ reconnecting → unstable（> 60s 仍未恢复）
 * - badge 友好：enabled = mode !== "closed"（不再 gate activeTab，让 badge 后台累积）
 * - 通知音：`card.new` → playNotifySound()；`card.update` 不响（仅复述）
 * - 卸载清理：es.close() + clearTimeout
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { fetchPush, isNewsApiConfigured, NewsRateLimitError, openPushStream } from "@/lib/news/api";
import { playNotifySound } from "@/lib/news/notify-sound";
import type { PushCard } from "@/types/news";

const RINGED_BUFFER_SIZE = 200;
const FIRST_PAGE_LIMIT = 20;
const RECONNECT_WARNING_MS = 15_000; // 15s 后仍 reconnecting → 保持但不升级
const RECONNECT_UNSTABLE_MS = 60_000; // 60s 后仍 reconnecting → unstable + 暴露手动 retry
// readyState=CLOSED（如 429）时手动重建 EventSource 的指数退避，封顶后稳定低频重试。
// 原生 EventSource 读不到 HTTP 状态/Retry-After，遇 429 直接 CLOSED 不自动重连；
// 固定 3s 重连会持续把限流器顶在 429（无限重连风暴），故改指数退避 + 抖动 + 封顶。
const RECONNECT_BASE_MS = 3_000; // 首次退避基数（3 → 6 → 12 → 24 → 48 → 封顶）
const RECONNECT_MAX_MS = 60_000; // 退避封顶（≤1 次/分钟，不再触发限流，仍可自动恢复）
const RECONNECT_JITTER_MS = 1_000; // 抖动上限，避免多端同时重连的 thundering herd

export type FeedStatus = "idle" | "loading" | "ready" | "error";
export type SseStatus = "connecting" | "open" | "reconnecting" | "unstable" | "closed";

interface FeedState {
  cardsMap: Map<string, PushCard>;
  cursorNext: number | null;
  cursorLatest: number | null;
  hasMore: boolean;
  truncated: boolean;
  status: FeedStatus;
  errorMessage?: string;
  /** 429/503 时后端 Retry-After 秒数（DD-110 §10.1 速率限制）。UI 用于「Xs 后再试」提示。 */
  retryAfterSec?: number;
  sseStatus: SseStatus;
  lastReadIngestedAt: number;
}

type Action =
  | { type: "fetch-start" }
  | {
      type: "fetch-success";
      cards: PushCard[];
      cursorNext: number | null;
      cursorLatest: number | null;
      hasMore: boolean;
      truncated: boolean;
      append: boolean;
    }
  | { type: "fetch-error"; message: string; retryAfterSec?: number }
  /**
   * source 区分 SSE 来源：
   * - "new"    → 新卡，参与 cursorLatest 推进（断线重连用作 since）
   * - "update" → enrich 完成的复述，**不**推进 cursorLatest（防 backlog 漏推 · REV-DD110-v3 B:M2）
   */
  | { type: "upsert"; card: PushCard; source: "new" | "update" }
  | { type: "sse-status"; status: SseStatus }
  | { type: "mark-all-read" }
  | { type: "reset" };

const initialState: FeedState = {
  cardsMap: new Map(),
  cursorNext: null,
  cursorLatest: null,
  hasMore: false,
  truncated: false,
  status: "idle",
  sseStatus: "closed",
  lastReadIngestedAt: 0,
};

function reducer(state: FeedState, action: Action): FeedState {
  switch (action.type) {
    case "fetch-start":
      return { ...state, status: "loading", errorMessage: undefined };
    case "fetch-success": {
      const next = new Map(action.append ? state.cardsMap : []);
      for (const c of action.cards) next.set(c.id, c);
      return {
        ...state,
        cardsMap: next,
        cursorNext: action.cursorNext,
        // latest 只在首次或更晚时刷新
        cursorLatest:
          action.cursorLatest !== null && action.cursorLatest > (state.cursorLatest ?? 0)
            ? action.cursorLatest
            : state.cursorLatest,
        hasMore: action.hasMore,
        truncated: action.truncated,
        status: "ready",
      };
    }
    case "fetch-error":
      return {
        ...state,
        status: "error",
        errorMessage: action.message,
        retryAfterSec: action.retryAfterSec,
      };
    case "upsert": {
      const next = new Map(state.cardsMap);
      next.set(action.card.id, action.card);
      // ringed buffer：超过 200 条按 ingestedAt 截尾
      if (next.size > RINGED_BUFFER_SIZE) {
        const sorted = Array.from(next.values()).sort((a, b) => b.ingestedAt - a.ingestedAt);
        next.clear();
        for (const c of sorted.slice(0, RINGED_BUFFER_SIZE)) next.set(c.id, c);
      }
      // 仅 card.new 推进 cursorLatest；card.update 不动（防漏 backlog · REV-DD110-v3 B:M2）
      const latest =
        action.source === "new" && action.card.ingestedAt > (state.cursorLatest ?? 0)
          ? action.card.ingestedAt
          : state.cursorLatest;
      return { ...state, cardsMap: next, cursorLatest: latest };
    }
    case "sse-status":
      return { ...state, sseStatus: action.status };
    case "mark-all-read": {
      let max = state.lastReadIngestedAt;
      for (const c of state.cardsMap.values()) {
        if (c.ingestedAt > max) max = c.ingestedAt;
      }
      return { ...state, lastReadIngestedAt: max };
    }
    case "reset":
      return { ...initialState, cardsMap: new Map() };
    default:
      return state;
  }
}

export interface UseNewsFeedResult {
  cards: PushCard[];
  status: FeedStatus;
  errorMessage?: string;
  /** 429/503 速率限制时的 Retry-After 秒数（DD-110 §10.1）。 */
  retryAfterSec?: number;
  hasMore: boolean;
  truncated: boolean;
  sseStatus: SseStatus;
  unreadCount: number;
  isConfigured: boolean;
  loadMore: () => Promise<void>;
  retry: () => void;
  markAllRead: () => void;
}

export function useNewsFeed(enabled: boolean): UseNewsFeedResult {
  const [state, dispatch] = useReducer(reducer, initialState);
  const esRef = useRef<EventSource | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unstableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorLatestRef = useRef<number | null>(null);

  cursorLatestRef.current = state.cursorLatest;

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (unstableTimerRef.current) clearTimeout(unstableTimerRef.current);
    warningTimerRef.current = null;
    unstableTimerRef.current = null;
  }, []);

  const closeStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    clearTimers();
  }, [clearTimers]);

  const reconnectScheduledRef = useRef(false);
  // 连续重连失败次数，驱动指数退避；任一次成功 open / 收到 card.new 即归零。
  const reconnectAttemptsRef = useRef(0);

  const openStream = useCallback(() => {
    if (!isNewsApiConfigured()) return;
    closeStream();
    reconnectScheduledRef.current = false;
    dispatch({ type: "sse-status", status: "connecting" });
    const es = openPushStream(cursorLatestRef.current, {
      onNew: (card) => {
        dispatch({ type: "upsert", card, source: "new" });
        dispatch({ type: "sse-status", status: "open" });
        clearTimers();
        reconnectAttemptsRef.current = 0; // 收到数据 = 连接健康，退避归零
        playNotifySound();
      },
      onUpdate: (card) => {
        // card.update 仅 enrich 完成的复述：upsert 但不推 cursorLatest、不触发音效
        dispatch({ type: "upsert", card, source: "update" });
      },
      onError: () => {
        const current = esRef.current;
        // readyState=CLOSED (=2) 浏览器已放弃 → 手动指数退避重建 EventSource（REV-DD110-v3 A:M2）
        // 硬编码 2 而非 EventSource.CLOSED：jsdom 中 EventSource 常量可能为 undefined，硬编码可避免误判
        if (current && current.readyState === 2) {
          dispatch({ type: "sse-status", status: "reconnecting" });
          if (!reconnectScheduledRef.current) {
            reconnectScheduledRef.current = true;
            const attempt = reconnectAttemptsRef.current;
            reconnectAttemptsRef.current = attempt + 1;
            // 3 → 6 → 12 → 24 → 48 → 封顶 60s，+ 抖动；防 429 无限重连风暴
            const backoff = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
            const delay = backoff + Math.random() * RECONNECT_JITTER_MS;
            setTimeout(() => {
              reconnectScheduledRef.current = false;
              openStream();
            }, delay);
          }
          return;
        }
        // CONNECTING 期间走浏览器自动重连，仅维护 UI 状态机
        dispatch({ type: "sse-status", status: "reconnecting" });
        if (!warningTimerRef.current) {
          warningTimerRef.current = setTimeout(() => {
            // timer fire 后清 ref，让下一次 onerror 能重置计时（REV-DD110-v3 B:M1）
            warningTimerRef.current = null;
          }, RECONNECT_WARNING_MS);
        }
        if (!unstableTimerRef.current) {
          unstableTimerRef.current = setTimeout(() => {
            dispatch({ type: "sse-status", status: "unstable" });
            unstableTimerRef.current = null;
          }, RECONNECT_UNSTABLE_MS);
        }
      },
    });
    es.addEventListener("open", () => {
      dispatch({ type: "sse-status", status: "open" });
      clearTimers();
      reconnectAttemptsRef.current = 0; // 连接成功，退避归零
    });
    esRef.current = es;
  }, [clearTimers, closeStream]);

  const fetchFirstPage = useCallback(async () => {
    if (!isNewsApiConfigured()) {
      dispatch({ type: "fetch-error", message: "News API not configured" });
      return;
    }
    dispatch({ type: "fetch-start" });
    try {
      const res = await fetchPush({ limit: FIRST_PAGE_LIMIT });
      dispatch({
        type: "fetch-success",
        cards: res.items,
        cursorNext: res.cursor.next,
        cursorLatest: res.cursor.latest,
        hasMore: res.hasMore,
        truncated: res.truncated,
        append: false,
      });
    } catch (e) {
      if (e instanceof NewsRateLimitError) {
        // 用户主动操作不自动重试，UI 显示倒计时（handoff §2）
        dispatch({
          type: "fetch-error",
          message: `请求过频，${e.retryAfterSec}s 后再试`,
          retryAfterSec: e.retryAfterSec,
        });
        return;
      }
      const message = e instanceof Error ? e.message : "Failed to load news";
      dispatch({ type: "fetch-error", message });
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.cursorNext === null) return;
    if (state.status === "loading") return;
    if (!isNewsApiConfigured()) return;
    dispatch({ type: "fetch-start" });
    try {
      const res = await fetchPush({ limit: FIRST_PAGE_LIMIT, before: state.cursorNext });
      dispatch({
        type: "fetch-success",
        cards: res.items,
        cursorNext: res.cursor.next,
        cursorLatest: res.cursor.latest,
        hasMore: res.hasMore,
        truncated: res.truncated,
        append: true,
      });
    } catch (e) {
      if (e instanceof NewsRateLimitError) {
        dispatch({
          type: "fetch-error",
          message: `请求过频，${e.retryAfterSec}s 后再试`,
          retryAfterSec: e.retryAfterSec,
        });
        return;
      }
      const message = e instanceof Error ? e.message : "Failed to load more";
      dispatch({ type: "fetch-error", message });
    }
  }, [state.hasMore, state.cursorNext, state.status]);

  const retry = useCallback(() => {
    void fetchFirstPage();
    openStream();
  }, [fetchFirstPage, openStream]);

  const markAllRead = useCallback(() => {
    dispatch({ type: "mark-all-read" });
  }, []);

  // enabled 切换 → 初始化 / 清理
  useEffect(() => {
    if (!enabled) {
      closeStream();
      dispatch({ type: "sse-status", status: "closed" });
      return;
    }
    reconnectAttemptsRef.current = 0; // 全新启用 → 退避序列复位
    void fetchFirstPage();
    openStream();
    return () => {
      closeStream();
      dispatch({ type: "sse-status", status: "closed" });
    };
  }, [enabled, fetchFirstPage, openStream, closeStream]);

  // selector: sort by ingestedAt desc + ringed
  // useMemo 减少高频 SSE 时 NewsCard 列的全量 reconcile（REV-DD110-v3 B:M3）
  const cards = useMemo(
    () =>
      Array.from(state.cardsMap.values())
        .sort((a, b) => b.ingestedAt - a.ingestedAt)
        .slice(0, RINGED_BUFFER_SIZE),
    [state.cardsMap]
  );

  const unreadCount = useMemo(
    () => cards.filter((c) => c.ingestedAt > state.lastReadIngestedAt).length,
    [cards, state.lastReadIngestedAt]
  );

  return {
    cards,
    status: state.status,
    errorMessage: state.errorMessage,
    retryAfterSec: state.retryAfterSec,
    hasMore: state.hasMore,
    truncated: state.truncated,
    sseStatus: state.sseStatus,
    unreadCount,
    isConfigured: isNewsApiConfigured(),
    loadMore,
    retry,
    markAllRead,
  };
}
