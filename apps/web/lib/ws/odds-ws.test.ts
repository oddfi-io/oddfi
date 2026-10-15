import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OddsWsManager, injectMockOddsPush } from "./odds-ws";
import { onchainOddsStore } from "@/stores/onchainOddsStore";

const MID = "0x020368b0e5316baa9a48b3e7c77872b0e7ca0ffcfd2f18319ebea5b25e762164";
const MID2 = "0x" + "1".repeat(64);

class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((this: FakeWebSocket, ev: Event) => void) | null = null;
  onmessage: ((this: FakeWebSocket, ev: MessageEvent) => void) | null = null;
  onerror: ((this: FakeWebSocket, ev: Event) => void) | null = null;
  onclose: ((this: FakeWebSocket, ev: CloseEvent) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.call(this, new Event("close") as CloseEvent);
  }

  // helpers for tests
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.call(this, new Event("open"));
  }

  push(envelope: unknown) {
    this.onmessage?.call(this, { data: JSON.stringify(envelope) } as MessageEvent);
  }

  pushRaw(data: string) {
    this.onmessage?.call(this, { data } as MessageEvent);
  }
}

class FakeDoc {
  hidden = false;
  private listeners: Array<() => void> = [];
  addEventListener(_type: "visibilitychange", l: () => void) {
    this.listeners.push(l);
  }
  removeEventListener(_type: "visibilitychange", l: () => void) {
    this.listeners = this.listeners.filter((x) => x !== l);
  }
  fire() {
    for (const l of this.listeners) l();
  }
}

function makeManager(overrides: Partial<ConstructorParameters<typeof OddsWsManager>[0]> = {}) {
  const sink = {
    applyUpdate: vi.fn(),
    markAllStale: vi.fn(),
  };
  const doc = new FakeDoc();
  const mgr = new OddsWsManager({
    url: "wss://test/ws",
    webSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    document: doc,
    storeSink: sink,
    pingIntervalMs: 0, // disabled by default — opt-in per test
    healthCheckIntervalMs: 0,
    hiddenCloseDelayMs: 60_000,
    ...overrides,
  });
  return { mgr, sink, doc };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  onchainOddsStore.getState().reset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("OddsWsManager subscribe", () => {
  it("normalizes marketId and sends subscribe after socket opens", () => {
    const { mgr } = makeManager();
    const off = mgr.subscribe(MID);
    expect(FakeWebSocket.instances).toHaveLength(1);
    const ws = FakeWebSocket.instances[0];
    expect(ws.sent).toEqual([]); // not open yet
    ws.open();
    expect(ws.sent[0]).toBe(JSON.stringify({ action: "subscribe", marketIds: [MID] }));
    off();
  });

  it("throws InvalidMarketIdError synchronously for bad input", () => {
    const { mgr } = makeManager();
    expect(() => mgr.subscribe("not-hex")).toThrow(/InvalidMarketId/);
  });

  it("refCounts duplicate subscribe — only one network subscribe per market", () => {
    const { mgr } = makeManager();
    const off1 = mgr.subscribe(MID);
    const off2 = mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    const subscribes = ws.sent.filter((m) => m.includes('"subscribe"'));
    expect(subscribes).toHaveLength(1);
    expect(mgr.activeMarketIds.size).toBe(1);
    off1();
    expect(mgr.activeMarketIds.size).toBe(1); // still alive via ref2
    off2();
    expect(mgr.activeMarketIds.size).toBe(0);
    // final unsubscribe should send
    const unsubs = ws.sent.filter((m) => m.includes('"unsubscribe"'));
    expect(unsubs).toHaveLength(1);
  });

  it("calling the returned unsubscribe twice is a no-op", () => {
    const { mgr } = makeManager();
    const off = mgr.subscribe(MID);
    FakeWebSocket.instances[0].open();
    off();
    off(); // should not double-unsubscribe
    const ws = FakeWebSocket.instances[0];
    const unsubs = ws.sent.filter((m) => m.includes('"unsubscribe"'));
    expect(unsubs).toHaveLength(1);
  });

  it("recoverSubs sends full subs map on reconnect", () => {
    const { mgr } = makeManager();
    mgr.subscribe(MID);
    mgr.subscribe(MID2);
    FakeWebSocket.instances[0].open();
    expect(FakeWebSocket.instances[0].sent[0]).toContain(MID);
    // simulate disconnect → triggers scheduleReconnect
    FakeWebSocket.instances[0].close();
    vi.advanceTimersByTime(2_000); // backoff 1000 * 2^0 = 1000ms → enough
    expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(2);
    const ws2 = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    ws2.open();
    const lastSent = JSON.parse(ws2.sent[0]);
    expect(lastSent.action).toBe("subscribe");
    expect(lastSent.marketIds).toEqual(expect.arrayContaining([MID, MID2]));
  });
});

describe("OddsWsManager push handling", () => {
  it("dispatches odds_updated push to store sink", () => {
    const { mgr, sink } = makeManager();
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.push({
      type: "odds_updated",
      marketId: MID,
      data: { baseOdds: ["1"], quotedOdds: ["2"], signal: 0, quoteVersion: 21, updatedAt: 1 },
    });
    expect(sink.applyUpdate).toHaveBeenCalledWith(
      MID,
      expect.objectContaining({ quoteVersion: 21 })
    );
  });

  it("normalizes uppercase marketId in incoming push", () => {
    const { mgr, sink } = makeManager();
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    const upper = "0x" + MID.slice(2).toUpperCase();
    ws.push({ type: "odds_updated", marketId: upper, data: payloadData() });
    expect(sink.applyUpdate).toHaveBeenCalledWith(MID, expect.any(Object));
  });

  it("drops push for non-subscribed marketId", () => {
    const { mgr, sink } = makeManager();
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.push({ type: "odds_updated", marketId: MID2, data: payloadData() });
    expect(sink.applyUpdate).not.toHaveBeenCalled();
  });

  it("drops invalid JSON push without disconnecting", () => {
    const { mgr, sink } = makeManager();
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.pushRaw("not-json");
    expect(sink.applyUpdate).not.toHaveBeenCalled();
    expect(ws.readyState).toBe(FakeWebSocket.OPEN);
  });

  it("drops envelope missing marketId or data", () => {
    const { mgr, sink } = makeManager();
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.push({ type: "odds_updated" });
    ws.push({ type: "odds_updated", marketId: MID });
    expect(sink.applyUpdate).not.toHaveBeenCalled();
  });
});

describe("OddsWsManager reconnect", () => {
  it("indeed reconnects after close with exponential backoff", () => {
    const { mgr } = makeManager();
    mgr.subscribe(MID);
    const ws1 = FakeWebSocket.instances[0];
    ws1.open();
    ws1.close();
    expect(FakeWebSocket.instances).toHaveLength(1); // not yet reconnected
    vi.advanceTimersByTime(1_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("does not reconnect when no subscriptions remain", () => {
    const { mgr } = makeManager();
    const off = mgr.subscribe(MID);
    FakeWebSocket.instances[0].open();
    off();
    FakeWebSocket.instances[0].close();
    vi.advanceTimersByTime(30_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("markAllStale called on disconnect from open state", () => {
    const { mgr, sink } = makeManager();
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.close();
    expect(sink.markAllStale).toHaveBeenCalled();
  });

  it("retryCount resets only after 5s of stable open", () => {
    const { mgr } = makeManager({ reconnectBaseMs: 100, reconnectMaxMs: 10_000 });
    mgr.subscribe(MID);
    // fail twice
    FakeWebSocket.instances[0].open();
    FakeWebSocket.instances[0].close();
    vi.advanceTimersByTime(100); // backoff 100
    const ws2 = FakeWebSocket.instances[1];
    ws2.open();
    // close within 5s — counts as flap, retry should NOT reset
    vi.advanceTimersByTime(1_000);
    ws2.close();
    vi.advanceTimersByTime(400); // backoff 100 * 2^2 = 400 (since retry=2)
    expect(FakeWebSocket.instances.length).toBe(3);
  });
});

describe("OddsWsManager ping + health check", () => {
  it("sends ping at configured interval while open", () => {
    const { mgr } = makeManager({ pingIntervalMs: 25_000 });
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.sent.length = 0;
    vi.advanceTimersByTime(25_000);
    expect(ws.sent.some((m) => m.includes('"ping"'))).toBe(true);
  });

  it("re-subscribes stale markets on health check tick", () => {
    const { mgr } = makeManager({ healthCheckIntervalMs: 1_000, staleThresholdMs: 5_000 });
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.sent.length = 0;
    // no push for 6s → stale
    vi.advanceTimersByTime(6_000);
    const subs = ws.sent.filter((m) => m.includes('"subscribe"'));
    expect(subs.length).toBeGreaterThanOrEqual(1);
    expect(subs[0]).toContain(MID);
  });

  it("does not re-subscribe when push arrived recently", () => {
    const { mgr } = makeManager({ healthCheckIntervalMs: 1_000, staleThresholdMs: 5_000 });
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    vi.advanceTimersByTime(500);
    ws.push({ type: "odds_updated", marketId: MID, data: payloadData() });
    ws.sent.length = 0;
    // health check tick at 1000ms — last push was 500ms ago, not stale
    vi.advanceTimersByTime(1_000);
    expect(ws.sent.filter((m) => m.includes('"subscribe"'))).toHaveLength(0);
  });
});

describe("OddsWsManager visibility lifecycle", () => {
  it("closes socket after hiddenCloseDelayMs and reconnects on visible", () => {
    const { mgr, doc, sink } = makeManager({ hiddenCloseDelayMs: 60_000 });
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    doc.hidden = true;
    doc.fire();
    vi.advanceTimersByTime(60_000);
    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
    expect(sink.markAllStale).toHaveBeenCalled();
    doc.hidden = false;
    doc.fire();
    expect(FakeWebSocket.instances.length).toBe(2);
  });

  it("cancels hidden close timer when visible before delay elapses", () => {
    const { mgr, doc } = makeManager({ hiddenCloseDelayMs: 60_000 });
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    doc.hidden = true;
    doc.fire();
    vi.advanceTimersByTime(30_000);
    doc.hidden = false;
    doc.fire();
    vi.advanceTimersByTime(60_000);
    expect(ws.readyState).toBe(FakeWebSocket.OPEN);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

describe("OddsWsManager dispose", () => {
  it("closes socket and clears subs", () => {
    const { mgr } = makeManager();
    mgr.subscribe(MID);
    mgr.subscribe(MID2);
    FakeWebSocket.instances[0].open();
    mgr.dispose();
    expect(mgr.activeMarketIds.size).toBe(0);
    expect(FakeWebSocket.instances[0].readyState).toBe(FakeWebSocket.CLOSED);
  });

  it("ignores subsequent visibility events after dispose", () => {
    const { mgr, doc } = makeManager();
    mgr.subscribe(MID);
    FakeWebSocket.instances[0].open();
    mgr.dispose();
    expect(() => {
      doc.hidden = true;
      doc.fire(); // no listener registered any more
    }).not.toThrow();
  });
});

describe("OddsWsManager connect error path (REV-v1-A M2)", () => {
  it("resets state to idle after WebSocket constructor throws", () => {
    class ThrowingWebSocket {
      static OPEN = 1;
      static CLOSED = 3;
      static CONNECTING = 0;
      constructor() {
        throw new Error("invalid url");
      }
    }
    const sink = { applyUpdate: vi.fn(), markAllStale: vi.fn() };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mgr = new OddsWsManager({
      url: "wss://bad",
      webSocketCtor: ThrowingWebSocket as unknown as typeof WebSocket,
      document: new FakeDoc(),
      storeSink: sink,
      reconnectBaseMs: 100,
      reconnectMaxMs: 10_000,
      pingIntervalMs: 0,
      healthCheckIntervalMs: 0,
    });
    mgr.subscribe(MID);
    // Constructor threw — state must be "idle" so a later subscribe could retry,
    // and scheduleReconnect should be queued (not asserted directly; covered by reconnect tests).
    expect(mgr.connectionState).toBe("idle");
    warn.mockRestore();
  });
});

describe("OddsWsManager close + reconnect ordering (REV-v1-A C2)", () => {
  it("registers reconnect timer before flipping state to idle", () => {
    const { mgr } = makeManager({ reconnectBaseMs: 100 });
    mgr.subscribe(MID);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.close();
    // After handleClose returns, state is idle and reconnect should be queued.
    expect(mgr.connectionState).toBe("idle");
    // Timer should fire and produce exactly one new WebSocket, not two.
    vi.advanceTimersByTime(100);
    expect(FakeWebSocket.instances.length).toBe(2);
  });
});

function payloadData() {
  return { baseOdds: ["1"], quotedOdds: ["2"], signal: 0, quoteVersion: 21, updatedAt: 1 };
}

describe("injectMockOddsPush (Batch 5a)", () => {
  beforeEach(() => {
    onchainOddsStore.getState().reset();
  });

  it("creates an entry with default payload when store is empty", () => {
    injectMockOddsPush(MID);
    const entry = onchainOddsStore.getState().byMarketId[MID];
    expect(entry).toBeTruthy();
    expect(entry.baseOdds).toEqual(["20000", "20000"]);
    expect(entry.quotedOdds).toEqual(["20000", "20000"]);
    expect(entry.signal).toBe(0);
    expect(entry.quoteVersion).toBe(1);
  });

  it("auto-bumps quoteVersion from current entry +1 when not provided", () => {
    onchainOddsStore.getState().applyUpdate(MID, {
      baseOdds: ["22900", "32800"],
      quotedOdds: ["23000", "32500"],
      signal: 1,
      quoteVersion: 42,
      updatedAt: 100,
    });
    injectMockOddsPush(MID, { quotedOdds: ["24000", "31000"] });
    const entry = onchainOddsStore.getState().byMarketId[MID];
    expect(entry.quoteVersion).toBe(43);
    expect(entry.quotedOdds).toEqual(["24000", "31000"]);
    // baseOdds inherited from previous entry
    expect(entry.baseOdds).toEqual(["22900", "32800"]);
    // signal inherited
    expect(entry.signal).toBe(1);
  });

  it("respects explicit quoteVersion when caller provides one", () => {
    injectMockOddsPush(MID, { quoteVersion: 9999 });
    const entry = onchainOddsStore.getState().byMarketId[MID];
    expect(entry.quoteVersion).toBe(9999);
  });

  it("normalizes marketId (lowercase + 0x prefix tolerance)", () => {
    const upper = MID.toUpperCase().replace("0X", "0x");
    injectMockOddsPush(upper);
    const entry = onchainOddsStore.getState().byMarketId[MID];
    expect(entry).toBeTruthy();
  });

  it("throws InvalidMarketIdError for malformed marketId", () => {
    expect(() => injectMockOddsPush("not-a-marketid")).toThrow();
  });

  it("is no-op in production (NODE_ENV=production)", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      injectMockOddsPush(MID, { quotedOdds: ["99999", "99999"] });
      expect(onchainOddsStore.getState().byMarketId[MID]).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("subsequent mock pushes monotonically increase version", () => {
    injectMockOddsPush(MID); // v1
    injectMockOddsPush(MID); // v2
    injectMockOddsPush(MID); // v3
    const entry = onchainOddsStore.getState().byMarketId[MID];
    expect(entry.quoteVersion).toBe(3);
  });
});
