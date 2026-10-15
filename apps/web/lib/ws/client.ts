/**
 * DD-101: 通用 JSON-RPC 风格 WebSocket 客户端
 *
 * - 单例连接 → auth → ready，request/response 通过 id 路由
 * - 服务端推送（event 字段）走 onEvent 分发
 * - 40103 token 过期：L1 同连接 refresh + 重发 auth + 重试请求；失败兜底 L2 close+reconnect
 * - 指数退避重连（与 useBnbKline 一致），断线后 pending 请求统一 reject
 * - 60s 软活性探针（服务端 30s ping 浏览器自动 pong，前端不主动 ping）
 */

import {
  WS_ERR_CODES,
  WsError,
  WsTimeoutError,
  type WsClientLogger,
  type WsClientOpts,
  type WsRequest,
  type WsResponse,
  type WsState,
} from "./types";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_RECONNECT_BASE_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 30_000;
const DEFAULT_LIVENESS_TIMEOUT_MS = 60_000;

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: string;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private _state: WsState = "idle";
  private pending = new Map<string, PendingRequest>();
  private stateListeners = new Set<(s: WsState) => void>();
  private reqIdSeq = 0;
  private retryCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private livenessTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  /**
   * In-flight L1 refresh promise. Concurrent callers piggyback on this single Promise
   * instead of waiting on a boolean flag — guarantees they see the same refresh
   * outcome (resolve or reject) and avoids retrying with stale token while refresh
   * is still pending.
   */
  private refreshPromise: Promise<void> | null = null;
  private readonly WSCtor: typeof WebSocket;
  private readonly logger: WsClientLogger;

  constructor(private readonly opts: WsClientOpts) {
    this.WSCtor = opts.webSocketCtor ?? WebSocket;
    this.logger = opts.logger ?? console;
  }

  get state(): WsState {
    return this._state;
  }

  onStateChange(listener: (state: WsState) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private setState(next: WsState) {
    if (this._state === next) return;
    this._state = next;
    for (const l of this.stateListeners) l(next);
  }

  /** Open connection + auth handshake. Resolves on first ready; rejects on user-initiated close. */
  connect(): Promise<void> {
    if (this._state === "ready") return Promise.resolve();
    if (this._state !== "connecting" && this._state !== "authing") {
      this.closedByUser = false;
      this.openSocket();
    }
    return this.waitForReady();
  }

  /**
   * Wait for state to transition to "ready".
   * @param timeoutMs Optional upper bound. Defaults to no timeout (legacy behavior).
   *                  Callers in `call()` pass their tmo budget so a stuck reconnect
   *                  loop doesn't trap the hook in "subscribing" indefinitely.
   */
  private waitForReady(timeoutMs?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._state === "ready") return resolve();
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (action: () => void) => {
        if (timer) clearTimeout(timer);
        off();
        action();
      };
      const off = this.onStateChange((s) => {
        if (s === "ready") finish(resolve);
        else if (s === "closed") {
          finish(() => reject(new Error("[WS] Connection closed before ready")));
        }
      });
      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => {
          off();
          reject(new Error(`[WS] Timed out waiting for ready state after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  private openSocket() {
    this.setState("connecting");
    const ws = new this.WSCtor(this.opts.url);
    this.ws = ws;
    ws.onopen = () => this.handleOpen();
    ws.onmessage = (e: MessageEvent) => this.handleMessage(e.data as string);
    ws.onerror = () => this.logger.warn("[WS] socket error");
    ws.onclose = () => this.handleClose();
  }

  private async handleOpen() {
    this.setState("authing");
    this.touchLiveness();
    try {
      await this.sendAuth();
      this.retryCount = 0;
      this.setState("ready");
    } catch (err) {
      // initial auth failed → close, reconnect loop handles backoff
      this.logger.warn("[WS] initial auth failed —", err);
      this.ws?.close();
    }
  }

  private sendAuth(): Promise<void> {
    const token = this.opts.getAccessToken();
    if (!token) return Promise.reject(new Error("[WS] No access token for auth"));
    return this.rawCall(
      "auth",
      { access_token: token },
      this.opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    ).then(() => undefined);
  }

  private handleMessage(raw: string) {
    this.touchLiveness();
    let parsed: WsResponse | { event: string; data: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      this.logger.warn(
        "[WS] Failed to parse message frame —",
        String(parseErr),
        raw?.slice(0, 100)
      );
      return;
    }
    // Server-initiated event push (e.g. tx_status)
    if ("event" in parsed && typeof parsed.event === "string") {
      this.opts.onEvent(parsed.event, parsed.data);
      return;
    }
    // RPC response — route by id
    if ("id" in parsed && typeof parsed.id === "string") {
      const p = this.pending.get(parsed.id);
      if (!p) return;
      this.pending.delete(parsed.id);
      clearTimeout(p.timer);
      if (parsed.code === 0) {
        p.resolve(parsed.data);
      } else {
        p.reject(new WsError(parsed.code, parsed.msg));
      }
    }
  }

  private handleClose() {
    if (this.livenessTimer) {
      clearTimeout(this.livenessTimer);
      this.livenessTimer = null;
    }
    // Reject all in-flight requests
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error("[WS] Connection closed"));
      this.pending.delete(id);
    }
    if (this.closedByUser) {
      this.setState("closed");
      return;
    }
    this.setState("reconnecting");
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    const base = this.opts.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS;
    const max = this.opts.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS;
    const delay = Math.min(base * Math.pow(2, this.retryCount), max);
    this.retryCount += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closedByUser) return;
      this.openSocket();
    }, delay);
  }

  private touchLiveness() {
    if (this.livenessTimer) clearTimeout(this.livenessTimer);
    const timeout = this.opts.livenessTimeoutMs ?? DEFAULT_LIVENESS_TIMEOUT_MS;
    this.livenessTimer = setTimeout(() => {
      this.logger.warn("[WS] Liveness timeout — closing stale socket");
      this.ws?.close();
    }, timeout);
  }

  private nextId(): string {
    this.reqIdSeq += 1;
    return `r${this.reqIdSeq}`;
  }

  /** Low-level send without ready-state gating; used by sendAuth and re-auth flows. */
  private rawCall<T = unknown>(method: string, params: unknown, timeoutMs: number): Promise<T> {
    const ws = this.ws;
    if (!ws || ws.readyState !== this.WSCtor.OPEN) {
      return Promise.reject(new Error("[WS] Socket not open"));
    }
    const id = this.nextId();
    const req: WsRequest = { id, method, params };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new WsTimeoutError(method));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (d: unknown) => void,
        reject,
        timer,
        method,
      });
      ws.send(JSON.stringify(req));
    });
  }

  /**
   * Public RPC call. Waits for ready state, handles 40103 token-expired self-heal
   * by L1 (refresh + re-auth on same connection) with L2 fallback (close + reconnect).
   */
  async call<T = unknown>(method: string, params: unknown, timeoutMs?: number): Promise<T> {
    const tmo = timeoutMs ?? this.opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    // Pass tmo as upper bound for the pre-send wait — protects against indefinite
    // hangs when reconnect backoff overruns the caller's expected response window.
    if (this._state !== "ready") await this.waitForReady(tmo);
    try {
      return await this.rawCall<T>(method, params, tmo);
    } catch (err) {
      if (err instanceof WsError && err.code === WS_ERR_CODES.TOKEN_EXPIRED) {
        await this.handleTokenExpired();
        return this.rawCall<T>(method, params, tmo);
      }
      throw err;
    }
  }

  /**
   * L1 strategy: refresh token via REST, re-auth on same connection.
   * Fallback to L2 close+reconnect on failure.
   *
   * Concurrent callers piggyback on the same refreshPromise so they all see the
   * identical resolve/reject outcome — fixes the "piggyback returns immediately
   * because state is still ready" race that would otherwise retry rawCall with
   * still-expired token and loop on 40103.
   */
  private handleTokenExpired(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    const refresh = (async () => {
      try {
        await this.opts.onAuthFailed();
        await this.sendAuth();
      } catch (err) {
        this.logger.warn("[WS] L1 token refresh failed, falling back to L2 reconnect —", err);
        // L2: close → handleClose triggers reconnect with fresh token next time
        this.ws?.close();
        throw err;
      }
    })();
    this.refreshPromise = refresh.finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  /** User-initiated close (page lifecycle / logout). Prevents reconnect. */
  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.livenessTimer) {
      clearTimeout(this.livenessTimer);
      this.livenessTimer = null;
    }
    if (this.ws && this.ws.readyState !== this.WSCtor.CLOSED) {
      this.ws.close();
    } else {
      this.setState("closed");
    }
  }
}
