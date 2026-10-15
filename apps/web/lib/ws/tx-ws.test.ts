/**
 * DD-101 Batch 2: TxWsManager + config 单测
 *
 * 覆盖：
 * - subscribe → tx_status success/failed 事件 → resolve
 * - 客户端 timeoutMs 超时 → resolve "timeout" 状态
 * - 同 hash 多次 subscribe → 同一个 Promise（去重 + refCount）
 * - 重连后批量重订阅 activeSubs
 * - unsubscribe → 取消订阅，refCount 仅当归零才下发服务端
 * - page visibility hidden > delay → 关闭客户端，visible 重连
 * - getTxWsConfig 缺失 env → WsDisabledError
 * - subscribe RPC 失败 → 清理 sub + 抛错
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TxWsManager } from "./tx-ws";
import { getTxWsConfig } from "./config";
import { WsDisabledError } from "./types";

// ─── MockWebSocket (reused pattern) ─────────────────────────────

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
  /** Find the most recent payload matching method (e.g. "subscribe"). */
  findSent(method: string): { id: string; method: string; params: Record<string, unknown> } | null {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      const parsed = JSON.parse(this.sent[i]) as {
        id: string;
        method: string;
        params: Record<string, unknown>;
      };
      if (parsed.method === method) return parsed;
    }
    return null;
  }
}

const MockWsCtor = MockWebSocket as unknown as typeof WebSocket;

// ─── Mock document ──────────────────────────────────────────────

function makeMockDoc() {
  const listeners = new Set<() => void>();
  return {
    hidden: false,
    addEventListener: (_t: "visibilitychange", l: () => void) => listeners.add(l),
    removeEventListener: (_t: "visibilitychange", l: () => void) => listeners.delete(l),
    fire() {
      for (const l of listeners) l();
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

interface MakeManagerOpts {
  hiddenCloseDelayMs?: number;
  document?: ReturnType<typeof makeMockDoc>;
  onAuthFailed?: () => Promise<void>;
}

function makeManager(opts: MakeManagerOpts = {}) {
  return new TxWsManager({
    url: "ws://test/tx",
    getAccessToken: () => "tok-1",
    onAuthFailed: opts.onAuthFailed ?? (() => Promise.resolve()),
    webSocketCtor: MockWsCtor,
    hiddenCloseDelayMs: opts.hiddenCloseDelayMs,
    livenessTimeoutMs: 600_000, // avoid interference with fake-timer advancement in tests
    document: opts.document,
  });
}

/** Drive the manager's underlying WsClient through open + auth handshake. */
async function settleAuth() {
  const ws = MockWebSocket.last();
  ws.serverOpen();
  await flush();
  const auth = ws.findSent("auth");
  expect(auth).not.toBeNull();
  ws.serverSend({ id: auth!.id, code: 0, msg: "ok" });
  await flush();
  return ws;
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

describe("TxWsManager.subscribe", () => {
  it("resolves with success status when server pushes tx_status success", async () => {
    const mgr = makeManager();
    const subPromise = mgr.subscribe("0xaa");
    await flush();
    const ws = await settleAuth();
    // subscribe RPC response
    const sub = ws.findSent("subscribe")!;
    expect(sub.params).toEqual({ tx_hash: "0xaa" });
    ws.serverSend({ id: sub.id, code: 0, msg: "ok" });
    await flush();
    // Server pushes terminal event
    ws.serverSend({
      event: "tx_status",
      data: { status: "success", tx_hash: "0xaa", block_number: 100, block_hash: "0xbb" },
    });
    await expect(subPromise).resolves.toEqual({
      status: "success",
      tx_hash: "0xaa",
      block_number: 100,
      block_hash: "0xbb",
    });
    expect(mgr.activeSubs.size).toBe(0); // auto-cleanup on terminal
    mgr.dispose();
  });

  it("resolves with failed status", async () => {
    const mgr = makeManager();
    const subPromise = mgr.subscribe("0xcc");
    await flush();
    const ws = await settleAuth();
    const sub = ws.findSent("subscribe")!;
    ws.serverSend({ id: sub.id, code: 0, msg: "ok" });
    await flush();
    ws.serverSend({
      event: "tx_status",
      data: { status: "failed", tx_hash: "0xcc", block_number: 200, block_hash: "0xdd" },
    });
    const res = await subPromise;
    expect(res.status).toBe("failed");
    mgr.dispose();
  });

  it("resolves with timeout status when client timeoutMs elapses with no push", async () => {
    const mgr = makeManager();
    const subPromise = mgr.subscribe("0xee", { timeoutMs: 5_000 });
    await flush();
    const ws = await settleAuth();
    const sub = ws.findSent("subscribe")!;
    ws.serverSend({ id: sub.id, code: 0, msg: "ok" });
    await flush();
    vi.advanceTimersByTime(5_001);
    await expect(subPromise).resolves.toEqual({ status: "timeout", tx_hash: "0xee" });
    mgr.dispose();
  });

  it("dedups same hash — returns the same Promise on second call", async () => {
    const mgr = makeManager();
    const p1 = mgr.subscribe("0xff");
    p1.catch(() => {}); // dispose at end rejects pending — silence unhandled
    await flush();
    const ws = await settleAuth();
    const p2 = mgr.subscribe("0xff"); // should NOT send a new subscribe RPC
    expect(p1).toBe(p2);
    expect(mgr.activeSubs.size).toBe(1);
    const subscribesSent = ws.sent.filter((s) => {
      const parsed = JSON.parse(s) as { method: string };
      return parsed.method === "subscribe";
    });
    expect(subscribesSent).toHaveLength(1);
    mgr.dispose();
  });

  it("rejects + cleans up when subscribe RPC fails", async () => {
    const mgr = makeManager();
    const subPromise = mgr.subscribe("0x11");
    await flush();
    const ws = await settleAuth();
    const sub = ws.findSent("subscribe")!;
    ws.serverSend({ id: sub.id, code: 40001, msg: "bad param" });
    await expect(subPromise).rejects.toThrow(/code: 40001/);
    expect(mgr.activeSubs.size).toBe(0);
    mgr.dispose();
  });
});

describe("TxWsManager.unsubscribe", () => {
  it("removes sub and sends server-side unsubscribe RPC when refCount reaches zero", async () => {
    const mgr = makeManager();
    const subPromise = mgr.subscribe("0x22");
    subPromise.catch(() => {}); // tolerate possible rejection if mgr closes mid-test
    await flush();
    const ws = await settleAuth();
    const sub = ws.findSent("subscribe")!;
    ws.serverSend({ id: sub.id, code: 0, msg: "ok" });
    await flush();

    await mgr.unsubscribe("0x22");
    await flush();
    expect(mgr.activeSubs.size).toBe(0);
    const unsub = ws.findSent("unsubscribe");
    expect(unsub?.params).toEqual({ tx_hash: "0x22" });
    mgr.dispose();
  });

  it("ref-counts: two subscribes + one unsubscribe keeps sub active", async () => {
    const mgr = makeManager();
    const p1 = mgr.subscribe("0x33");
    p1.catch(() => {});
    await flush();
    const ws = await settleAuth();
    const sub = ws.findSent("subscribe")!;
    ws.serverSend({ id: sub.id, code: 0, msg: "ok" });
    await flush();
    mgr.subscribe("0x33"); // refCount=2

    await mgr.unsubscribe("0x33"); // refCount=1 — should NOT remove
    expect(mgr.activeSubs.size).toBe(1);
    expect(ws.findSent("unsubscribe")).toBeNull();
    mgr.dispose();
  });
});

describe("TxWsManager reconnection recovery", () => {
  it("re-subscribes active subs after reconnect → ready", async () => {
    const mgr = makeManager();
    const subPromise = mgr.subscribe("0x44");
    subPromise.catch(() => {});
    await flush();
    const firstWs = await settleAuth();
    const firstSub = firstWs.findSent("subscribe")!;
    firstWs.serverSend({ id: firstSub.id, code: 0, msg: "ok" });
    await flush();

    // Server-side close → WsClient schedules reconnect with default backoff 1s
    firstWs.serverClose();
    await flush();
    vi.advanceTimersByTime(1_000);
    await flush();
    expect(MockWebSocket.instances.length).toBe(2);

    // Drive new socket through handshake → recoverSubs should fire on ready
    const secondWs = MockWebSocket.last();
    secondWs.serverOpen();
    await flush();
    const reauth = secondWs.findSent("auth")!;
    secondWs.serverSend({ id: reauth.id, code: 0, msg: "ok" });
    await flush();

    // After ready, recoverSubs should have re-issued subscribe for 0x44
    const reSub = secondWs.findSent("subscribe");
    expect(reSub).not.toBeNull();
    expect(reSub!.params).toEqual({ tx_hash: "0x44" });
    mgr.dispose();
  });
});

describe("TxWsManager page lifecycle", () => {
  it("closes client after hidden delay and reconnects when visible", async () => {
    const doc = makeMockDoc();
    const mgr = makeManager({ hiddenCloseDelayMs: 60_000, document: doc });
    const subPromise = mgr.subscribe("0x55");
    subPromise.catch(() => {});
    await flush();
    const ws = await settleAuth();
    const sub = ws.findSent("subscribe")!;
    ws.serverSend({ id: sub.id, code: 0, msg: "ok" });
    await flush();

    // Hidden → schedule close
    doc.hidden = true;
    doc.fire();
    vi.advanceTimersByTime(60_000);
    await flush();
    // ws should be closed
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);

    // Visible → reconnect (active sub exists)
    doc.hidden = false;
    doc.fire();
    await flush();
    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    mgr.dispose();
  });
});

describe("getTxWsConfig", () => {
  const original = process.env.NEXT_PUBLIC_WS_TX_URL;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_WS_TX_URL;
    } else {
      process.env.NEXT_PUBLIC_WS_TX_URL = original;
    }
  });

  it("returns url when env set", () => {
    process.env.NEXT_PUBLIC_WS_TX_URL = "ws://example/tx";
    expect(getTxWsConfig()).toEqual({ url: "ws://example/tx" });
  });

  it("throws WsDisabledError when env empty", () => {
    process.env.NEXT_PUBLIC_WS_TX_URL = "";
    expect(() => getTxWsConfig()).toThrow(WsDisabledError);
  });

  it("throws WsDisabledError when env whitespace only", () => {
    process.env.NEXT_PUBLIC_WS_TX_URL = "   ";
    expect(() => getTxWsConfig()).toThrow(WsDisabledError);
  });

  it("throws WsDisabledError when env missing", () => {
    delete process.env.NEXT_PUBLIC_WS_TX_URL;
    expect(() => getTxWsConfig()).toThrow(WsDisabledError);
  });
});
