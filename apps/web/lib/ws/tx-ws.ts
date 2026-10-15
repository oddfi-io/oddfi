/**
 * DD-101: tx_status 业务层（单例 manager + subscribe API）
 *
 * - 第一次 subscribe 时懒建 WsClient
 * - 同 hash 多次 subscribe 共享同一个 Promise（去重）
 * - 终态事件（success/failed/timeout）由服务端推送，本地自动清理
 * - 重连后批量重订阅 activeSubs
 * - Page visibility hidden > 60s → close socket；visible → 若有 subs 则重连
 */

import { useAuthStore } from "@/stores/authStore";
import { doRefreshSingleton } from "@/lib/api";
import { WsClient } from "./client";
import { getTxWsConfig } from "./config";
import { WsError } from "./types";

export type TxFinalStatus =
  | { status: "success"; tx_hash: string; block_number: number; block_hash: string }
  | { status: "failed"; tx_hash: string; block_number: number; block_hash: string }
  | { status: "timeout"; tx_hash: string };

interface DocumentLike {
  hidden: boolean;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
}

export interface TxWsManagerOpts {
  url: string;
  getAccessToken: () => string | null;
  onAuthFailed: () => Promise<void>;
  webSocketCtor?: typeof WebSocket;
  /** Page hidden delay before closing socket (default 60_000). 0 = disabled. */
  hiddenCloseDelayMs?: number;
  /** Override WsClient liveness timeout (test seam — defaults to WsClient internal 60_000). */
  livenessTimeoutMs?: number;
  /** Document seam (test) — defaults to global `document` when available. */
  document?: DocumentLike;
}

interface ActiveSub {
  txHash: string;
  promise: Promise<TxFinalStatus>;
  resolve: (status: TxFinalStatus) => void;
  reject: (err: Error) => void;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  /** How many in-flight consumers share this sub. */
  refCount: number;
}

const DEFAULT_HIDDEN_CLOSE_DELAY_MS = 60_000;

export class TxWsManager {
  private client: WsClient | null = null;
  /** unlisten fn returned by client.onStateChange — must be called before nulling client to avoid memory leak */
  private stateChangeOff: (() => void) | null = null;
  private subs = new Map<string, ActiveSub>();
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private readonly doc: DocumentLike | null;

  constructor(private readonly opts: TxWsManagerOpts) {
    this.doc = opts.document ?? (typeof document !== "undefined" ? document : null);
    this.attachLifecycle();
  }

  get activeSubs(): ReadonlySet<string> {
    return new Set(this.subs.keys());
  }

  /**
   * Subscribe to a tx hash. Returns the terminal status Promise.
   * Multiple subscribers for the same hash share the exact same Promise (refCount + dedup).
   *
   * Errors are routed to sub.promise via sub.reject — never thrown synchronously.
   * Connection-closed mid-subscribe is NOT terminal: the sub stays alive and
   * `recoverSubs()` re-issues subscribe after reconnect.
   */
  subscribe(txHash: string, opts?: { timeoutMs?: number }): Promise<TxFinalStatus> {
    const existing = this.subs.get(txHash);
    if (existing) {
      existing.refCount += 1;
      return existing.promise;
    }
    const sub = this.createSub(txHash, opts?.timeoutMs);
    this.subs.set(txHash, sub);

    if (this.client?.state === "ready") {
      // Fast path — connection is already up; send subscribe RPC now.
      this.sendSubscribe(txHash);
    } else {
      // Cold start or mid-reconnect — recoverSubs will fire on ready transition
      // and is the single source of truth for issuing subscribe RPCs.
      if (!this.client) this.createClient();
      this.client!.connect().catch((err) => {
        console.warn("[TxWsManager] connect failed —", err);
      });
    }
    return sub.promise;
  }

  private sendSubscribe(txHash: string): void {
    if (!this.client) return;
    this.client.call("subscribe", { tx_hash: txHash }).catch((err) => {
      // Server-side WsError → terminal for this sub. Connection-closed → retry on reconnect.
      if (err instanceof WsError) this.failSub(txHash, err);
    });
  }

  private failSub(txHash: string, err: Error): void {
    const sub = this.subs.get(txHash);
    if (!sub) return;
    if (sub.timeoutTimer) clearTimeout(sub.timeoutTimer);
    this.subs.delete(txHash);
    sub.reject(err);
  }

  /**
   * Cancel a subscription. If `refCount > 1`, only decrements; final unsubscribe
   * also notifies the server (best-effort).
   */
  async unsubscribe(txHash: string): Promise<void> {
    const sub = this.subs.get(txHash);
    if (!sub) return;
    sub.refCount -= 1;
    if (sub.refCount > 0) return;
    if (sub.timeoutTimer) clearTimeout(sub.timeoutTimer);
    this.subs.delete(txHash);
    if (this.client?.state === "ready") {
      // Best-effort — server side has auto-cleanup on terminal anyway
      this.client.call("unsubscribe", { tx_hash: txHash }).catch((err) => {
        console.warn("[TxWsManager] unsubscribe RPC failed —", err);
      });
    }
  }

  /** Teardown — used on SPA logout / hard reset. */
  dispose(): void {
    if (this.visibilityHandler && this.doc) {
      this.doc.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.hiddenTimer) {
      clearTimeout(this.hiddenTimer);
      this.hiddenTimer = null;
    }
    for (const sub of this.subs.values()) {
      if (sub.timeoutTimer) clearTimeout(sub.timeoutTimer);
      sub.reject(new Error("[TxWsManager] disposed"));
    }
    this.subs.clear();
    this.destroyClient();
  }

  // ── internals ────────────────────────────────────────────────

  private createSub(txHash: string, timeoutMs?: number): ActiveSub {
    let resolve!: (s: TxFinalStatus) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<TxFinalStatus>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const sub: ActiveSub = {
      txHash,
      promise,
      resolve,
      reject,
      timeoutTimer: null,
      refCount: 1,
    };
    if (timeoutMs && timeoutMs > 0) {
      sub.timeoutTimer = setTimeout(() => {
        const current = this.subs.get(txHash);
        if (!current) return;
        current.resolve({ status: "timeout", tx_hash: txHash });
        this.subs.delete(txHash);
      }, timeoutMs);
    }
    return sub;
  }

  private createClient(): void {
    this.client = new WsClient({
      url: this.opts.url,
      getAccessToken: this.opts.getAccessToken,
      onAuthFailed: this.opts.onAuthFailed,
      onEvent: (event, data) => this.handleEvent(event, data),
      webSocketCtor: this.opts.webSocketCtor,
      livenessTimeoutMs: this.opts.livenessTimeoutMs,
    });
    this.stateChangeOff = this.client.onStateChange((s) => {
      if (s === "ready") this.recoverSubs();
    });
  }

  /** Drop client + its state-change listener. Avoids leak when manager outlives its WsClient. */
  private destroyClient(): void {
    this.stateChangeOff?.();
    this.stateChangeOff = null;
    this.client?.close();
    this.client = null;
  }

  /**
   * Runtime structural check for tx_status push payload.
   * Cast-based type assertion would silently let missing block fields through;
   * we validate explicitly here since it's the only entry point for server data.
   */
  private handleEvent(event: string, data: unknown): void {
    if (event !== "tx_status") return;
    if (!data || typeof data !== "object") return;
    const d = data as Record<string, unknown>;
    if (typeof d.tx_hash !== "string" || !d.tx_hash) return;
    if (d.status !== "success" && d.status !== "failed" && d.status !== "timeout") return;
    if (d.status === "success" || d.status === "failed") {
      if (typeof d.block_number !== "number" || typeof d.block_hash !== "string") {
        console.warn("[TxWsManager] tx_status event missing block fields —", d);
        return;
      }
    }
    const sub = this.subs.get(d.tx_hash);
    if (!sub) return;
    if (sub.timeoutTimer) clearTimeout(sub.timeoutTimer);
    this.subs.delete(d.tx_hash);
    sub.resolve(d as unknown as TxFinalStatus);
  }

  /**
   * After every ready transition, re-issue subscribe RPC for every active sub.
   * This is the single source of truth for sending subscribe RPCs (cold start + reconnect).
   * Only WsError responses (server-side rejections) kill a sub —
   * connection-closed mid-flight means another reconnect cycle will retry.
   */
  private recoverSubs(): void {
    if (!this.client || this.subs.size === 0) return;
    for (const txHash of [...this.subs.keys()]) {
      this.sendSubscribe(txHash);
    }
  }

  private attachLifecycle(): void {
    if (!this.doc) return;
    const handler = () => {
      if (this.doc!.hidden) {
        const delay = this.opts.hiddenCloseDelayMs ?? DEFAULT_HIDDEN_CLOSE_DELAY_MS;
        if (delay <= 0) return;
        if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
        this.hiddenTimer = setTimeout(() => {
          this.hiddenTimer = null;
          this.destroyClient();
        }, delay);
      } else {
        if (this.hiddenTimer) {
          clearTimeout(this.hiddenTimer);
          this.hiddenTimer = null;
        }
        if (this.subs.size > 0 && !this.client) {
          this.createClient();
          this.client!.connect().catch((err) => {
            console.warn("[TxWsManager] Reconnect after visible failed —", err);
          });
        }
      }
    };
    this.doc.addEventListener("visibilitychange", handler);
    this.visibilityHandler = handler;
  }
}

// ─── Singleton facade ─────────────────────────────────────────

let _instance: TxWsManager | null = null;

function getInstance(): TxWsManager {
  if (_instance) return _instance;
  const config = getTxWsConfig(); // throws WsDisabledError when env missing
  _instance = new TxWsManager({
    url: config.url,
    getAccessToken: () => useAuthStore.getState().accessToken,
    onAuthFailed: () => doRefreshSingleton(),
  });
  return _instance;
}

/**
 * Process-level tx_status singleton. Lazily instantiated on first subscribe.
 * Throws WsDisabledError if NEXT_PUBLIC_WS_TX_URL is empty — consumers must downgrade.
 */
export const txWs = {
  subscribe(txHash: string, opts?: { timeoutMs?: number }): Promise<TxFinalStatus> {
    return getInstance().subscribe(txHash, opts);
  },
  unsubscribe(txHash: string): Promise<void> {
    return getInstance().unsubscribe(txHash);
  },
  get activeSubs(): ReadonlySet<string> {
    return _instance ? _instance.activeSubs : new Set();
  },
};

/** Test seam — reset singleton between tests. Not for production use. */
export function resetTxWsForTest(): void {
  _instance?.dispose();
  _instance = null;
}
