/**
 * DD-118: 链上赔率推送 WebSocket 客户端（subscribe-style，无 auth）。
 *
 * 协议契约（oddfi-data-ws/internal/ws/）：
 *   - 客户端发：{ action: "subscribe" | "unsubscribe", marketIds: string[] }
 *   - 服务端推：{ type: "odds_updated", marketId, data: { baseOdds, quotedOdds, signal, quoteVersion, updatedAt } }
 *   - 无 ack，订阅成功与否前端只能通过是否收到推送旁路确认
 *   - 非法 marketId / 不合法 JSON 服务端 silently 丢弃
 *
 * 与 tx-ws.ts 的差异：无 auth、无 id 路由、无 request/response（纯 pub/sub）。
 *
 * 设计要点：
 *   - 单连接（全应用单例 + facade pattern）
 *   - subscribe 用 refCount 去重；recoverSubs 是首次连接 + 重连后发 subscribe 的**唯一入口**
 *   - 重连指数退避 1s → 30s，onopen 后 5s 才清零 retryCount（防 flap）
 *   - 客户端 25s 主动 ping（防中间代理空闲断）
 *   - 5min 健康度自检：长时间未收推送的 marketId 静默重订阅
 *   - visibility hidden > 60s → 关闭连接（保留 subs map）；visible → 重连
 *
 * SSR 安全：模块顶层不 new WebSocket / 不访问 document。facade 内 lazy instantiate。
 */

import { onchainOddsStore } from "@/stores/onchainOddsStore";
import { normalizeMarketId } from "@/lib/onchain/market-id";
import { IS_TESTNET } from "@/lib/network-mode";
import { getOddsWsConfig } from "./config";
import { WsDisabledError } from "./types";

export interface OddsServerPushData {
  baseOdds: string[];
  quotedOdds: string[];
  signal: number;
  quoteVersion: number;
  updatedAt: number;
}

interface OddsServerPushEnvelope {
  type?: string;
  marketId?: string;
  data?: OddsServerPushData;
}

interface DocumentLike {
  hidden: boolean;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
}

export interface OddsWsManagerOpts {
  url: string;
  webSocketCtor?: typeof WebSocket;
  document?: DocumentLike;
  /** Page hidden delay before closing socket. Default 60_000. 0 = disabled. */
  hiddenCloseDelayMs?: number;
  /** Client-side keep-alive interval (default 25_000). 0 = disabled. */
  pingIntervalMs?: number;
  /** Health-check interval — re-subscribe when no push for marketId in 5min. Default 60_000. 0 = disabled. */
  healthCheckIntervalMs?: number;
  /** Stale threshold for health check. Default 300_000 (5min). */
  staleThresholdMs?: number;
  /** Reconnect backoff base / cap in ms (default 1_000 / 30_000). */
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  /** Soft cap on concurrent subscriptions; warn when exceeded. Default 50. */
  maxSubscriptions?: number;
  /** Inject store sink for tests (default: real onchainOddsStore). */
  storeSink?: {
    applyUpdate: (mid: string, data: OddsServerPushData) => void;
    markAllStale: () => void;
  };
}

const DEFAULTS = {
  hiddenCloseDelayMs: 60_000,
  pingIntervalMs: 25_000,
  healthCheckIntervalMs: 60_000,
  staleThresholdMs: 5 * 60_000,
  reconnectBaseMs: 1_000,
  reconnectMaxMs: 30_000,
  maxSubscriptions: 50,
} as const;

type State = "idle" | "connecting" | "open" | "closed";

export class OddsWsManager {
  private ws: WebSocket | null = null;
  private state: State = "idle";
  private subs = new Map<string, number>(); // marketId -> refCount
  private retryCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryResetTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private hiddenCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPushAt = new Map<string, number>();
  private subscribedAt = new Map<string, number>();
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private readonly doc: DocumentLike | null;
  private readonly WS: typeof WebSocket | null;
  private readonly storeSink: NonNullable<OddsWsManagerOpts["storeSink"]>;

  constructor(private readonly opts: OddsWsManagerOpts) {
    this.doc = opts.document ?? (typeof document !== "undefined" ? document : null);
    this.WS = opts.webSocketCtor ?? (typeof WebSocket !== "undefined" ? WebSocket : null);
    this.storeSink = opts.storeSink ?? {
      applyUpdate: (mid, data) => onchainOddsStore.getState().applyUpdate(mid, data),
      markAllStale: () => onchainOddsStore.getState().markAllStale(),
    };
    this.attachLifecycle();
  }

  get activeMarketIds(): ReadonlySet<string> {
    return new Set(this.subs.keys());
  }

  get connectionState(): State {
    return this.state;
  }

  /**
   * Subscribe to a market. Returns an unsubscribe function.
   * Throws InvalidMarketIdError synchronously for malformed marketId.
   */
  subscribe(rawMarketId: string): () => void {
    const mid = normalizeMarketId(rawMarketId);
    const prev = this.subs.get(mid) ?? 0;
    this.subs.set(mid, prev + 1);
    if (!this.subscribedAt.has(mid)) {
      this.subscribedAt.set(mid, Date.now());
    }
    const cap = this.opts.maxSubscriptions ?? DEFAULTS.maxSubscriptions;
    if (this.subs.size > cap) {
      console.warn(
        `[OddsWs] subscription count ${this.subs.size} exceeds soft cap ${cap} — may cause server send-chan overflow`
      );
    }
    if (prev === 0) {
      // First reference for this market: ensure connection + send subscribe immediately if open.
      this.ensureConnected();
      if (this.state === "open" && this.ws) {
        this.sendSubscribe([mid]);
      }
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.releaseRef(mid);
    };
  }

  /** Teardown — clear subs + close socket + remove lifecycle handlers. */
  dispose(): void {
    this.detachLifecycle();
    this.clearTimers();
    this.subs.clear();
    this.lastPushAt.clear();
    this.subscribedAt.clear();
    this.closeSocket();
    this.state = "closed";
  }

  // ── internals ───────────────────────────────────────────────

  private releaseRef(mid: string): void {
    const count = this.subs.get(mid);
    if (!count) return;
    if (count > 1) {
      this.subs.set(mid, count - 1);
      return;
    }
    this.subs.delete(mid);
    this.lastPushAt.delete(mid);
    this.subscribedAt.delete(mid);
    if (this.state === "open" && this.ws) {
      this.sendUnsubscribe([mid]);
    }
  }

  private ensureConnected(): void {
    if (this.state === "connecting" || this.state === "open") return;
    if (!this.WS) {
      // SSR or test env without WebSocket — defer; nothing to do.
      return;
    }
    this.connect();
  }

  private connect(): void {
    if (!this.WS) return;
    this.state = "connecting";
    try {
      this.ws = new this.WS(this.opts.url);
    } catch (err) {
      console.warn("[OddsWs] WebSocket constructor threw —", err);
      // Reset state so a later subscribe() can re-trigger ensureConnected().
      // Without this, state stays "connecting" forever if subs empty before retry timer fires.
      this.state = "idle";
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (ev) => this.handleMessage(ev);
    this.ws.onerror = () => this.handleError();
    this.ws.onclose = () => this.handleClose();
  }

  private handleOpen(): void {
    this.state = "open";
    // Defer retryCount reset by 5s so a flap-on-open doesn't look like a successful session.
    if (this.retryResetTimer) clearTimeout(this.retryResetTimer);
    this.retryResetTimer = setTimeout(() => {
      this.retryCount = 0;
      this.retryResetTimer = null;
    }, 5_000);
    this.startPing();
    this.startHealthCheck();
    this.recoverSubs();
  }

  private handleMessage(ev: MessageEvent): void {
    let envelope: OddsServerPushEnvelope;
    try {
      envelope = JSON.parse(String(ev.data));
    } catch (err) {
      console.warn("[OddsWs] Dropped non-JSON push —", err);
      return;
    }
    if (!envelope || typeof envelope !== "object") return;
    if (envelope.type && envelope.type !== "odds_updated") return; // ignore unknown types
    if (typeof envelope.marketId !== "string" || !envelope.data) {
      console.warn("[OddsWs] Dropped envelope missing marketId/data", envelope);
      return;
    }
    let mid: string;
    try {
      mid = normalizeMarketId(envelope.marketId);
    } catch {
      console.warn("[OddsWs] Dropped push with invalid marketId", envelope.marketId);
      return;
    }
    if (!this.subs.has(mid)) {
      // Defensive: server-side bug shouldn't fanout to unsubscribed clients.
      console.warn("[OddsWs] Received push for non-subscribed marketId", mid);
      return;
    }
    this.lastPushAt.set(mid, Date.now());
    this.storeSink.applyUpdate(mid, envelope.data);
  }

  private handleError(): void {
    // onerror fires before onclose; do nothing here — onclose triggers reconnect.
  }

  private handleClose(): void {
    const wasOpen = this.state === "open";
    this.ws = null;
    this.stopPing();
    this.stopHealthCheck();
    if (this.retryResetTimer) {
      // onopen happened then we closed within 5s → treat as flap, don't reset retry.
      clearTimeout(this.retryResetTimer);
      this.retryResetTimer = null;
    }
    if (this.subs.size > 0) {
      // markAllStale so UI can fall back to REST until live data resumes.
      if (wasOpen) this.storeSink.markAllStale();
      // Register reconnectTimer BEFORE flipping state to "idle". If we flipped first, a
      // window.online event landing between the assignment and scheduleReconnect would see
      // state==="idle" and connect() directly, while scheduleReconnect would then queue a
      // second timer — leading to two concurrent WebSocket instances.
      this.scheduleReconnect();
    }
    this.state = "idle";
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.subs.size === 0) return;
    const base = this.opts.reconnectBaseMs ?? DEFAULTS.reconnectBaseMs;
    const cap = this.opts.reconnectMaxMs ?? DEFAULTS.reconnectMaxMs;
    const delay = Math.min(cap, base * 2 ** this.retryCount);
    this.retryCount += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private recoverSubs(): void {
    if (this.subs.size === 0 || !this.ws || this.ws.readyState !== this.WS!.OPEN) return;
    this.sendSubscribe(Array.from(this.subs.keys()));
  }

  private sendSubscribe(marketIds: string[]): void {
    if (!this.ws || this.ws.readyState !== this.WS!.OPEN) return;
    this.ws.send(JSON.stringify({ action: "subscribe", marketIds }));
    const now = Date.now();
    for (const mid of marketIds) this.subscribedAt.set(mid, now);
  }

  private sendUnsubscribe(marketIds: string[]): void {
    if (!this.ws || this.ws.readyState !== this.WS!.OPEN) return;
    this.ws.send(JSON.stringify({ action: "unsubscribe", marketIds }));
  }

  private startPing(): void {
    const interval = this.opts.pingIntervalMs ?? DEFAULTS.pingIntervalMs;
    if (interval <= 0) return;
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === this.WS!.OPEN) {
        // Backend readPump switch ignores unknown actions but ReadMessage refreshes deadline → effective keep-alive.
        this.ws.send('{"type":"ping"}');
      }
    }, interval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private startHealthCheck(): void {
    const interval = this.opts.healthCheckIntervalMs ?? DEFAULTS.healthCheckIntervalMs;
    const threshold = this.opts.staleThresholdMs ?? DEFAULTS.staleThresholdMs;
    if (interval <= 0 || threshold <= 0) return;
    this.stopHealthCheck();
    this.healthCheckTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== this.WS!.OPEN) return;
      const now = Date.now();
      const staleMids: string[] = [];
      for (const mid of this.subs.keys()) {
        const last = this.lastPushAt.get(mid) ?? this.subscribedAt.get(mid) ?? now;
        if (now - last > threshold) staleMids.push(mid);
      }
      if (staleMids.length === 0) return;
      console.warn(
        `[OddsWs] no push for ${staleMids.length} markets in ${threshold}ms — silent re-subscribe`
      );
      // Re-subscribe is idempotent on backend (map[*Client]struct{}); avoid unsubscribe+subscribe race window.
      this.sendSubscribe(staleMids);
      for (const mid of staleMids) this.lastPushAt.set(mid, now);
    }, interval);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private closeSocket(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.retryResetTimer) {
      clearTimeout(this.retryResetTimer);
      this.retryResetTimer = null;
    }
    if (this.hiddenCloseTimer) {
      clearTimeout(this.hiddenCloseTimer);
      this.hiddenCloseTimer = null;
    }
    this.stopPing();
    this.stopHealthCheck();
  }

  private attachLifecycle(): void {
    if (this.doc) {
      const handler = () => this.onVisibilityChange();
      this.doc.addEventListener("visibilitychange", handler);
      this.visibilityHandler = handler;
    }
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      const handler = () => this.onOnline();
      window.addEventListener("online", handler);
      this.onlineHandler = handler;
    }
  }

  private detachLifecycle(): void {
    if (this.visibilityHandler && this.doc) {
      this.doc.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.onlineHandler && typeof window !== "undefined") {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  private onVisibilityChange(): void {
    if (!this.doc) return;
    if (this.doc.hidden) {
      const delay = this.opts.hiddenCloseDelayMs ?? DEFAULTS.hiddenCloseDelayMs;
      if (delay <= 0) return;
      if (this.hiddenCloseTimer) clearTimeout(this.hiddenCloseTimer);
      this.hiddenCloseTimer = setTimeout(() => {
        this.hiddenCloseTimer = null;
        // Preserve subs map but tear down socket + timers.
        this.stopPing();
        this.stopHealthCheck();
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.closeSocket();
        this.state = "idle";
        this.storeSink.markAllStale();
      }, delay);
    } else {
      if (this.hiddenCloseTimer) {
        clearTimeout(this.hiddenCloseTimer);
        this.hiddenCloseTimer = null;
      }
      if (this.subs.size > 0 && this.state === "idle") {
        this.ensureConnected();
      }
    }
  }

  private onOnline(): void {
    if (this.subs.size === 0) return;
    if (this.state !== "idle") return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ensureConnected();
  }
}

// ─── Singleton facade ─────────────────────────────────────────

let _instance: OddsWsManager | null = null;

function getInstance(): OddsWsManager {
  if (_instance) return _instance;
  const cfg = getOddsWsConfig(); // throws WsDisabledError when env missing
  _instance = new OddsWsManager({ url: cfg.url });
  return _instance;
}

export const oddsWs = {
  /**
   * Subscribe to a marketId. Returns an unsubscribe callback.
   * Throws WsDisabledError if NEXT_PUBLIC_WS_ODDS_URL is empty.
   * Throws InvalidMarketIdError if marketId is malformed.
   */
  subscribe(rawMarketId: string): () => void {
    return getInstance().subscribe(rawMarketId);
  },
  /** True when env URL is missing — consumer should downgrade to REST. */
  isDisabled(): boolean {
    try {
      getInstance();
      return false;
    } catch (e) {
      if (e instanceof WsDisabledError) return true;
      throw e;
    }
  },
  get activeMarketIds(): ReadonlySet<string> {
    return _instance ? _instance.activeMarketIds : new Set();
  },
};

/** Test seam — reset singleton between tests. Not for production use. */
export function resetOddsWsForTest(): void {
  _instance?.dispose();
  _instance = null;
}

// ─── Dev-only mock push (Batch 5a) ────────────────────────────

/**
 * Inject a fake odds push into the store, bypassing socket entirely.
 * Used for dev / e2e / visual-verification without backend involvement.
 *
 * Defaults are filled from the current store entry so callers can supply
 * a sparse `partialData` (e.g. `{ quotedOdds: [...] }`) and the rest is
 * preserved. `quoteVersion` auto-increments from current entry's version
 * + 1 to satisfy the monotonic filter.
 *
 * **NO-OP in production builds** (DCE drops the body when minified).
 */
export function injectMockOddsPush(
  rawMarketId: string,
  partialData: Partial<OddsServerPushData> = {}
): void {
  if (process.env.NODE_ENV === "production") return;
  const mid = normalizeMarketId(rawMarketId);
  const store = onchainOddsStore.getState();
  const current = store.byMarketId[mid];
  const data: OddsServerPushData = {
    baseOdds: partialData.baseOdds ?? current?.baseOdds ?? ["20000", "20000"],
    quotedOdds: partialData.quotedOdds ?? current?.quotedOdds ?? ["20000", "20000"],
    signal: partialData.signal ?? current?.signal ?? 0,
    quoteVersion: partialData.quoteVersion ?? (current?.quoteVersion ?? 0) + 1,
    updatedAt: partialData.updatedAt ?? Math.floor(Date.now() / 1000),
  };
  store.applyUpdate(mid, data);
}

// Dev-only + testnet: expose helpers on window for console / e2e / 信号灯模拟器.
// mainnet 生产构建 DCE 掉本块（NODE_ENV=production 且 IS_TESTNET 折叠为 false）；
// testnet 生产构建保留，供 DevTools 信号灯模拟器注入 mock 推送。
if ((process.env.NODE_ENV !== "production" || IS_TESTNET) && typeof window !== "undefined") {
  (window as unknown as { __oddsWsMock?: unknown }).__oddsWsMock = {
    push: injectMockOddsPush,
    activeMarketIds: () => Array.from(oddsWs.activeMarketIds),
  };
}
