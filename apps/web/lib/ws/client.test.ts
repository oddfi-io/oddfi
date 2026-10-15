/**
 * DD-101 Batch 1: WsClient 单测
 *
 * 覆盖：
 * - 连接 + auth 成功 → ready
 * - 请求-响应 id 路由
 * - 请求超时
 * - 事件分发（onEvent）
 * - 重连指数退避
 * - close 后 pending 请求统一 reject
 * - 40103 token 过期 L1 自愈（refresh + 同连接重 auth + 重试）
 * - L1 失败兜底 L2 close + reconnect
 * - 用户 close → 不重连
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WS_ERR_CODES, WsError, WsTimeoutError, WsDisabledError } from "./types";
import { WsClient } from "./client";

// ─── MockWebSocket ─────────────────────────────────────────────

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];
  static last(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
  static reset() {
    MockWebSocket.instances = [];
  }

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new Event("close") as CloseEvent);
  }

  // Test helpers — simulate server side
  serverOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }
  serverSend(payload: object) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(payload) }));
  }
  serverClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new Event("close") as CloseEvent);
  }

  /** Read last request payload as object. */
  lastSent<T = unknown>(): T {
    return JSON.parse(this.sent[this.sent.length - 1]) as T;
  }
}

const MockWsCtor = MockWebSocket as unknown as typeof WebSocket;

// ─── Helpers ───────────────────────────────────────────────────

interface MakeClientOpts {
  getAccessToken?: () => string | null;
  onAuthFailed?: () => Promise<void>;
  onEvent?: (event: string, data: unknown) => void;
  requestTimeoutMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  livenessTimeoutMs?: number;
}

function makeClient(opts: MakeClientOpts = {}) {
  return new WsClient({
    url: "ws://test/ws",
    getAccessToken: opts.getAccessToken ?? (() => "tok-1"),
    onAuthFailed: opts.onAuthFailed ?? (() => Promise.resolve()),
    onEvent: opts.onEvent ?? (() => {}),
    requestTimeoutMs: opts.requestTimeoutMs,
    reconnectBaseMs: opts.reconnectBaseMs ?? 1000,
    reconnectMaxMs: opts.reconnectMaxMs ?? 30_000,
    livenessTimeoutMs: opts.livenessTimeoutMs ?? 60_000,
    webSocketCtor: MockWsCtor,
    logger: { warn: () => {}, error: () => {} },
  });
}

/** Flush microtask queue (Promise callbacks) without advancing fake timers. */
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Drive a client through open + auth-ok handshake. */
async function bringUpReady(client: WsClient) {
  const connectPromise = client.connect();
  await flush();
  const ws = MockWebSocket.last();
  ws.serverOpen();
  await flush();
  const req = ws.lastSent<{ id: string; method: string }>();
  expect(req.method).toBe("auth");
  ws.serverSend({ id: req.id, code: 0, msg: "ok" });
  await connectPromise;
}

// ─── Setup ─────────────────────────────────────────────────────

beforeEach(() => {
  MockWebSocket.reset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ─────────────────────────────────────────────────────

describe("WsClient", () => {
  it("transitions idle → connecting → authing → ready on successful handshake", async () => {
    const client = makeClient();
    const states: string[] = [];
    client.onStateChange((s) => states.push(s));
    await bringUpReady(client);
    expect(states).toEqual(["connecting", "authing", "ready"]);
    expect(client.state).toBe("ready");
  });

  it("routes RPC response to caller by id", async () => {
    const client = makeClient();
    await bringUpReady(client);
    const ws = MockWebSocket.last();
    const callPromise = client.call<{ ok: boolean }>("subscribe", { tx_hash: "0xaa" });
    await flush();
    const req = ws.lastSent<{ id: string; method: string; params: unknown }>();
    expect(req.method).toBe("subscribe");
    expect(req.params).toEqual({ tx_hash: "0xaa" });
    ws.serverSend({ id: req.id, code: 0, msg: "ok", data: { ok: true } });
    await expect(callPromise).resolves.toEqual({ ok: true });
  });

  it("rejects with WsError on non-zero code response", async () => {
    const client = makeClient();
    await bringUpReady(client);
    const ws = MockWebSocket.last();
    const callPromise = client.call("subscribe", {});
    await flush();
    const req = ws.lastSent<{ id: string }>();
    ws.serverSend({ id: req.id, code: WS_ERR_CODES.PARAM_ERROR, msg: "bad" });
    await expect(callPromise).rejects.toBeInstanceOf(WsError);
  });

  it("times out a request when no response arrives", async () => {
    const client = makeClient({ requestTimeoutMs: 5_000 });
    await bringUpReady(client);
    const callPromise = client.call("subscribe", {});
    callPromise.catch(() => {}); // prevent unhandled rejection warning during advance
    vi.advanceTimersByTime(5_001);
    await expect(callPromise).rejects.toBeInstanceOf(WsTimeoutError);
  });

  it("dispatches server-pushed events via onEvent", async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const client = makeClient({ onEvent: (event, data) => events.push({ event, data }) });
    await bringUpReady(client);
    MockWebSocket.last().serverSend({
      event: "tx_status",
      data: { tx_hash: "0xbb", status: "success", block_number: 100 },
    });
    expect(events).toEqual([
      { event: "tx_status", data: { tx_hash: "0xbb", status: "success", block_number: 100 } },
    ]);
  });

  it("schedules reconnect with exponential backoff after server close", async () => {
    const client = makeClient({ reconnectBaseMs: 1000 });
    await bringUpReady(client);
    const firstWs = MockWebSocket.last();
    firstWs.serverClose();
    expect(client.state).toBe("reconnecting");
    // base * 2^0 = 1000ms → new socket created
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(2);
    // Second close — backoff becomes 2000ms
    const secondWs = MockWebSocket.last();
    secondWs.serverClose();
    vi.advanceTimersByTime(1999);
    expect(MockWebSocket.instances.length).toBe(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances.length).toBe(3);
  });

  it("rejects in-flight pending requests on close", async () => {
    const client = makeClient();
    await bringUpReady(client);
    const ws = MockWebSocket.last();
    const callPromise = client.call("subscribe", { tx_hash: "0xcc" });
    await flush();
    expect(ws.sent.length).toBeGreaterThan(1);
    ws.serverClose();
    await expect(callPromise).rejects.toThrow(/closed/i);
  });

  it("recovers from 40103 token expired via L1 refresh + re-auth + retry", async () => {
    let currentToken = "tok-stale";
    const refreshCalls: number[] = [];
    const client = makeClient({
      getAccessToken: () => currentToken,
      onAuthFailed: async () => {
        refreshCalls.push(Date.now());
        currentToken = "tok-fresh";
      },
    });
    await bringUpReady(client);
    const ws = MockWebSocket.last();

    const callPromise = client.call<{ ok: boolean }>("subscribe", { tx_hash: "0xdd" });
    await flush();
    const firstReq = ws.lastSent<{ id: string; method: string }>();
    expect(firstReq.method).toBe("subscribe");

    // Server says token expired
    ws.serverSend({ id: firstReq.id, code: WS_ERR_CODES.TOKEN_EXPIRED, msg: "token expired" });
    await flush();
    expect(refreshCalls).toHaveLength(1);

    // After refresh, a fresh `auth` request goes out on the SAME socket
    const reauthReq = JSON.parse(ws.sent[ws.sent.length - 2]) as {
      id: string;
      method: string;
      params: { access_token: string };
    };
    // The most recent send is now the auth; verify token was refreshed
    const latest = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: string;
      method: string;
      params: { access_token: string };
    };
    // sendAuth is queued before retry — order: [auth (initial), subscribe (failed), auth (re), subscribe (retry)]
    // The "second-to-last" depends on timing; verify _some_ auth used fresh token
    const usedFreshToken = [reauthReq, latest].some(
      (r) => r.method === "auth" && r.params.access_token === "tok-fresh"
    );
    expect(usedFreshToken).toBe(true);
    // Re-auth response
    const authReq = [reauthReq, latest].find((r) => r.method === "auth")!;
    ws.serverSend({ id: authReq.id, code: 0, msg: "ok" });
    await flush();

    // Retry of original subscribe arrives — find latest non-auth send
    const retrySubReq = JSON.parse(ws.sent[ws.sent.length - 1]) as { id: string; method: string };
    expect(retrySubReq.method).toBe("subscribe");
    ws.serverSend({ id: retrySubReq.id, code: 0, msg: "ok", data: { ok: true } });
    await expect(callPromise).resolves.toEqual({ ok: true });
    // Same socket throughout — no reconnect
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("falls back to L2 close+reconnect when L1 refresh fails", async () => {
    const client = makeClient({
      reconnectBaseMs: 1000,
      onAuthFailed: () => Promise.reject(new Error("refresh failed")),
    });
    await bringUpReady(client);
    const firstWs = MockWebSocket.last();

    const callPromise = client.call("subscribe", { tx_hash: "0xee" });
    await flush();
    const req = firstWs.lastSent<{ id: string }>();
    firstWs.serverSend({ id: req.id, code: WS_ERR_CODES.TOKEN_EXPIRED, msg: "expired" });

    // L1 fails → ws.close() invoked → handleClose rejects pending + schedules reconnect
    await expect(callPromise).rejects.toThrow();
    expect(client.state).toBe("reconnecting");
    // Backoff fires
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(2);
  });

  it("does not reconnect after user-initiated close", async () => {
    const client = makeClient({ reconnectBaseMs: 1000 });
    await bringUpReady(client);
    client.close();
    expect(client.state).toBe("closed");
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("closes socket on liveness timeout", async () => {
    const client = makeClient({ livenessTimeoutMs: 60_000, reconnectBaseMs: 1000 });
    await bringUpReady(client);
    expect(client.state).toBe("ready");
    // No messages for 60s → soft close
    vi.advanceTimersByTime(60_000);
    expect(client.state).toBe("reconnecting");
  });

  // ── REV-DD101 #3: concurrent 40103 piggyback (Reviewer A C-A1) ──

  it("concurrent 40103: refresh is called only once and both calls retry on same connection", async () => {
    let refreshCount = 0;
    let resolveRefresh!: () => void;
    const refreshGate = new Promise<void>((res) => {
      resolveRefresh = res;
    });
    const client = makeClient({
      onAuthFailed: async () => {
        refreshCount += 1;
        await refreshGate;
      },
    });
    await bringUpReady(client);
    const ws = MockWebSocket.last();

    // Fire two calls in parallel; both will receive 40103
    const callA = client.call("subscribe", { tx_hash: "0xaaa" });
    const callB = client.call("subscribe", { tx_hash: "0xbbb" });
    await flush();

    const subA = JSON.parse(ws.sent[1]) as { id: string };
    const subB = JSON.parse(ws.sent[2]) as { id: string };

    ws.serverSend({ id: subA.id, code: WS_ERR_CODES.TOKEN_EXPIRED, msg: "expired" });
    ws.serverSend({ id: subB.id, code: WS_ERR_CODES.TOKEN_EXPIRED, msg: "expired" });
    await flush();

    // Both calls now in handleTokenExpired; refreshPromise shared
    expect(refreshCount).toBe(1);

    // Allow refresh to complete → sendAuth fires
    resolveRefresh();
    await flush();

    // Re-auth request now in flight — find the second auth frame on this socket
    const authFrames = ws.sent
      .map((s) => JSON.parse(s) as { id: string; method: string })
      .filter((p) => p.method === "auth");
    expect(authFrames.length).toBe(2); // initial handshake + re-auth
    const reauth = authFrames[1];
    ws.serverSend({ id: reauth.id, code: 0, msg: "ok" });
    await flush();

    // Both calls retry their subscribe RPCs on the same socket
    const retries = ws.sent
      .map((s) => JSON.parse(s) as { id: string; method: string; params: { tx_hash?: string } })
      .filter((r) => r.method === "subscribe");
    expect(retries.length).toBe(4); // original A, B + retried A, B
    const retryA = retries[2];
    const retryB = retries[3];
    ws.serverSend({ id: retryA.id, code: 0, msg: "ok", data: { ok: "a" } });
    ws.serverSend({ id: retryB.id, code: 0, msg: "ok", data: { ok: "b" } });

    await expect(callA).resolves.toEqual({ ok: "a" });
    await expect(callB).resolves.toEqual({ ok: "b" });
    expect(refreshCount).toBe(1); // never re-triggered
    // No reconnect — same socket throughout
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("concurrent 40103: both calls reject with refresh error when L1 fails", async () => {
    let refreshCount = 0;
    const refreshErr = new Error("refresh failed");
    const client = makeClient({
      reconnectBaseMs: 1000,
      onAuthFailed: async () => {
        refreshCount += 1;
        throw refreshErr;
      },
    });
    await bringUpReady(client);
    const ws = MockWebSocket.last();

    const callA = client.call("subscribe", { tx_hash: "0xccc" });
    const callB = client.call("subscribe", { tx_hash: "0xddd" });
    callA.catch(() => {});
    callB.catch(() => {});
    await flush();

    const subA = JSON.parse(ws.sent[1]) as { id: string };
    const subB = JSON.parse(ws.sent[2]) as { id: string };
    ws.serverSend({ id: subA.id, code: WS_ERR_CODES.TOKEN_EXPIRED, msg: "expired" });
    ws.serverSend({ id: subB.id, code: WS_ERR_CODES.TOKEN_EXPIRED, msg: "expired" });
    await flush();

    // onAuthFailed throws → L2: ws.close → handleClose → reconnecting
    // Both calls receive the refresh error via the shared refreshPromise
    await expect(callA).rejects.toThrow(/refresh failed/);
    await expect(callB).rejects.toThrow(/refresh failed/);
    expect(refreshCount).toBe(1);
    expect(client.state).toBe("reconnecting");
  });

  it("call rejects with timeout when ready is never reached within tmo", async () => {
    const client = makeClient({ requestTimeoutMs: 2_000, reconnectBaseMs: 1000 });
    // Don't bring up — start a call while still idle, advance time past tmo
    const callPromise = client.call("subscribe", { tx_hash: "0xeee" });
    callPromise.catch(() => {});
    await flush();
    // No openSocket has been driven through serverOpen — state stays "connecting" → waitForReady hangs
    vi.advanceTimersByTime(2_001);
    await expect(callPromise).rejects.toThrow(/Timed out waiting for ready/);
  });
});

describe("WsDisabledError", () => {
  it("constructs with service name", () => {
    const err = new WsDisabledError("tx");
    expect(err.name).toBe("WsDisabledError");
    expect(err.message).toContain("tx");
  });
});
