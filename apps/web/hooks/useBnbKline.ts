"use client";

import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import type { UTCTimestamp, CandlestickData } from "lightweight-charts";

// ─── WS 原始消息类型 ──────────────────────────────────────────────────────────

interface WsKlineBar {
  time: number; // 毫秒时间戳
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

type WsMessage = { type: "history"; data: WsKlineBar[] } | { type: "update"; data: WsKlineBar };

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const CACHE_KEY = "bnb-kline-history-v1";
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 小时
const LIVENESS_CHECK_INTERVAL_MS = 30_000; // 30s
const LIVENESS_TIMEOUT_MS = 90_000; // 90s
const RECONNECT_BASE_MS = 1_000; // 1s 起始退避
const RECONNECT_MAX_MS = 30_000; // 30s 上限

// ─── 纯函数：数据转换与处理 ───────────────────────────────────────────────────

function transformBar(raw: WsKlineBar): CandlestickData {
  return {
    time: (raw.time / 1000) as UTCTimestamp, // ms → s
    open: new Decimal(raw.open).toNumber(),
    high: new Decimal(raw.high).toNumber(),
    low: new Decimal(raw.low).toNumber(),
    close: new Decimal(raw.close).toNumber(),
  };
}

/**
 * history 批量处理：转换 → 按时间升序排序 → Map 去重
 * 防御环形缓冲区尾部倒序问题（§2.2 异常 1）
 */
function processHistory(rawBars: WsKlineBar[]): CandlestickData[] {
  const bars = rawBars.map(transformBar);

  // 1. 按时间升序排序
  bars.sort((a, b) => (a.time as number) - (b.time as number));

  // 2. Map 去重：同一时间戳保留最后出现的（index 更大的）
  const seen = new Map<number, number>(); // time → index
  bars.forEach((bar, i) => seen.set(bar.time as number, i));
  return [...seen.values()].sort((a, b) => a - b).map((i) => bars[i]);
}

/**
 * JSON.parse + type/data 字段校验，失败返回 null
 */
function parseWsMessage(raw: string): WsMessage | null {
  try {
    const msg = JSON.parse(raw) as Record<string, unknown>;
    if (msg.type === "history" && Array.isArray(msg.data)) {
      return msg as unknown as WsMessage;
    }
    if (
      msg.type === "update" &&
      msg.data !== null &&
      typeof msg.data === "object" &&
      typeof (msg.data as Record<string, unknown>).time === "number"
    ) {
      return msg as unknown as WsMessage;
    }
    console.warn("[useBnbKline] Unknown WS message type —", msg.type);
    return null;
  } catch {
    console.warn("[useBnbKline] Failed to parse WS message");
    return null;
  }
}

/**
 * update 消息处理，含 stale 过滤（§2.2 异常 2）
 * - updateTime < lastTime → 丢弃（后端推送滞后）
 * - updateTime === lastTime → 替换末尾 bar
 * - updateTime > lastTime → 追加新 bar
 */
function handleUpdate(
  updateBar: CandlestickData,
  currentData: CandlestickData[]
): { action: "replace" | "append"; bar: CandlestickData } | null {
  if (currentData.length === 0) return null;

  const lastTime = currentData[currentData.length - 1].time as number;
  const updateTime = updateBar.time as number;

  if (updateTime < lastTime) {
    console.warn(
      "[useBnbKline] Stale update ignored — update:",
      new Date(updateTime * 1000).toISOString(),
      "< latest:",
      new Date(lastTime * 1000).toISOString()
    );
    return null;
  }

  if (updateTime === lastTime) {
    return { action: "replace", bar: updateBar };
  }

  return { action: "append", bar: updateBar };
}

// ─── localStorage 缓存 ────────────────────────────────────────────────────────

interface CachePayload {
  ts: number;
  data: WsKlineBar[];
}

function readCache(): WsKlineBar[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as CachePayload;
    if (Date.now() - payload.ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return payload.data;
  } catch {
    // 损坏数据：清除并忽略
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // 忽略
    }
    return null;
  }
}

function writeCache(data: WsKlineBar[]): void {
  try {
    const payload: CachePayload = { ts: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage 写入失败（隐私模式/容量满），静默忽略
  }
}

// ─── Hook 接口 ────────────────────────────────────────────────────────────────

interface UseBnbKlineReturn {
  /** 完整 30 天 1h K 线（已排序去重，转换为 lightweight-charts 格式） */
  data: CandlestickData[];
  /** 最新一根 K 线（用于 series.update 增量更新） */
  latestBar: CandlestickData | null;
  /** 连接状态 */
  status: "connecting" | "connected" | "disconnected";
}

// ─── Hook 实现 ────────────────────────────────────────────────────────────────

export function useBnbKline(): UseBnbKlineReturn {
  const WS_URL = process.env.NEXT_PUBLIC_WS_KLINE_URL;

  const [data, setData] = useState<CandlestickData[]>([]);
  const [latestBar, setLatestBar] = useState<CandlestickData | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  // 用 ref 持有稳定引用，避免 effect 重复注册
  const wsRef = useRef<WebSocket | null>(null);
  const dataRef = useRef<CandlestickData[]>([]);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const livenessTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const unmountedRef = useRef(false);

  // 同步 dataRef 与 data state
  function updateData(newData: CandlestickData[]) {
    dataRef.current = newData;
    setData(newData);
  }

  function clearTimers() {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (livenessTimerRef.current !== null) {
      clearInterval(livenessTimerRef.current);
      livenessTimerRef.current = null;
    }
  }

  function startLivenessCheck() {
    if (livenessTimerRef.current !== null) return;
    livenessTimerRef.current = setInterval(() => {
      const ws = wsRef.current;
      // 前端主动 ping：后端靠 ReadMessage 保活，无服务端 ping（后端【1】）
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send('{"type":"ping"}');
      }
      if (Date.now() - lastMessageTimeRef.current > LIVENESS_TIMEOUT_MS) {
        console.warn("[useBnbKline] No message received for 90s — closing stale connection");
        ws?.close();
      }
    }, LIVENESS_CHECK_INTERVAL_MS);
  }

  function connect() {
    if (unmountedRef.current) return;
    if (!WS_URL) {
      console.error(
        "[useBnbKline] NEXT_PUBLIC_WS_KLINE_URL is not configured — returning empty data"
      );
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      retryCountRef.current = 0; // 成功后重置重试计数器
      lastMessageTimeRef.current = Date.now();
      setStatus("connected");
      startLivenessCheck();
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      if (unmountedRef.current) return;

      // 更新活性时间戳（基于"收到消息"，不基于"数据新鲜度"）
      lastMessageTimeRef.current = Date.now();

      const msg = parseWsMessage(event.data);
      if (!msg) return;

      if (msg.type === "history") {
        const processed = processHistory(msg.data);
        updateData(processed);
        const latest = processed.length > 0 ? processed[processed.length - 1] : null;
        setLatestBar(latest);
        // 缓存原始数据（排序去重前，避免重复序列化开销）
        writeCache(msg.data);
      } else if (msg.type === "update") {
        const updateBar = transformBar(msg.data);
        const result = handleUpdate(updateBar, dataRef.current);
        if (!result) return;

        let newData: CandlestickData[];
        if (result.action === "replace") {
          newData = [...dataRef.current.slice(0, -1), result.bar];
        } else {
          newData = [...dataRef.current, result.bar];
        }
        updateData(newData);
        setLatestBar(result.bar);
      }
    };

    ws.onerror = () => {
      console.warn("[useBnbKline] WebSocket error — will attempt reconnect");
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;

      // 清除活性检测，等待重连后重新启动
      if (livenessTimerRef.current !== null) {
        clearInterval(livenessTimerRef.current);
        livenessTimerRef.current = null;
      }

      setStatus("disconnected");

      // 指数退避重连：1s → 2s → 4s → ... → 30s（无限重试）
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, retryCountRef.current),
        RECONNECT_MAX_MS
      );
      retryCountRef.current += 1;

      console.warn(
        `[useBnbKline] Connection closed — reconnecting in ${delay}ms (attempt ${retryCountRef.current})`
      );

      retryTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) connect();
      }, delay);
    };
  }

  useEffect(() => {
    unmountedRef.current = false;

    // 先从缓存恢复数据（stale-while-revalidate）
    const cached = readCache();
    if (cached && cached.length > 0) {
      const processed = processHistory(cached);
      updateData(processed);
      const latest = processed.length > 0 ? processed[processed.length - 1] : null;
      setLatestBar(latest);
    }

    // 建立 WS 连接
    connect();

    // visibilitychange：页面恢复前台时检查连接活性
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.warn("[useBnbKline] Page became visible with closed connection — reconnecting");
          // 重置退避计数器，立即重连
          retryCountRef.current = 0;
          if (retryTimerRef.current !== null) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          ws?.close();
          connect();
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unmountedRef.current = true;
      clearTimers();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wsRef.current) {
        wsRef.current.onclose = null; // 阻止卸载时触发重连
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, latestBar, status };
}
