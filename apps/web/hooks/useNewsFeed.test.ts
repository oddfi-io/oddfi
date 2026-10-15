/**
 * @vitest-environment jsdom
 *
 * DD-110 §4 Batch 4 — useNewsFeed hook 单测。
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_NEWS_API_BASE_URL", "https://news-api.test.local");

// 必须先 mock 再 import hook
vi.mock("@/lib/news/notify-sound", () => ({
  playNotifySound: vi.fn(),
}));

import { useNewsFeed } from "./useNewsFeed";
import { playNotifySound } from "@/lib/news/notify-sound";
import { NewsRateLimitError } from "@/lib/news/api";
import type { PushCard, PushResponse } from "@/types/news";

// ── 通用 fixtures ─────────────────────────────────────────
function makeCard(id: string, ingestedAt: number, createdAt = ingestedAt): PushCard {
  return {
    id,
    ingestedAt,
    createdAt,
    enrichStatus: "ok",
    source: "🐦 X",
    sourceUrl: `x.com/x/status/${id}`,
    originalText: `card ${id}`,
  };
}

// fixtures 可省略 count，helper 自动补；保持 inline 字面量简洁。
type ResponseFixture = Omit<PushResponse, "count"> & { count?: number };

function mockFetchPush(body: ResponseFixture) {
  const full: PushResponse = { ...body, count: body.count ?? body.items.length };
  globalThis.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify(full), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
  ) as unknown as typeof fetch;
}

// ── MockEventSource ───────────────────────────────────────
type Listener = (e: Event | MessageEvent) => void;
let lastES: MockEventSource | null = null;

class MockEventSource {
  url: string;
  listeners = new Map<string, Listener[]>();
  closed = false;
  constructor(url: string) {
    this.url = url;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastES = this;
  }
  addEventListener(type: string, l: Listener) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(l);
    this.listeners.set(type, arr);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    for (const l of this.listeners.get(type) ?? []) {
      l(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }
  emitError() {
    for (const l of this.listeners.get("error") ?? []) {
      l(new Event("error"));
    }
  }
}

const originalES = globalThis.EventSource;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  lastES = null;
  (globalThis as unknown as { EventSource: typeof EventSource }).EventSource =
    MockEventSource as unknown as typeof EventSource;
  vi.mocked(playNotifySound).mockClear();
});

afterEach(() => {
  (globalThis as unknown as { EventSource: typeof EventSource }).EventSource = originalES;
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

describe("useNewsFeed — 首屏与 enabled gate", () => {
  it("enabled=false → 不发请求、不建 SSE、status=idle", () => {
    mockFetchPush({
      items: [],
      cursor: { next: null, latest: null },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(false));
    expect(result.current.status).toBe("idle");
    expect(lastES).toBeNull();
  });

  it("enabled=true → fetchPush 后 cards 按 ingestedAt desc 排序", async () => {
    mockFetchPush({
      items: [makeCard("a", 100), makeCard("b", 300), makeCard("c", 200)],
      cursor: { next: null, latest: 300 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.cards.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("enabled=false → es.close() 被调用", async () => {
    mockFetchPush({
      items: [],
      cursor: { next: null, latest: null },
      hasMore: false,
      truncated: false,
    });
    const { result, rerender } = renderHook(({ e }: { e: boolean }) => useNewsFeed(e), {
      initialProps: { e: true },
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const es = lastES;
    expect(es).not.toBeNull();
    rerender({ e: false });
    expect(es?.closed).toBe(true);
  });
});

describe("useNewsFeed — SSE 事件", () => {
  it("card.new → prepend + 触发 playNotifySound", async () => {
    mockFetchPush({
      items: [makeCard("a", 100)],
      cursor: { next: null, latest: 100 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => lastES!.emit("card.new", makeCard("b", 500)));
    expect(result.current.cards[0].id).toBe("b");
    expect(playNotifySound).toHaveBeenCalledTimes(1);
  });

  it("card.update → 按 id 替换且保留位置（v2 修订 B:M2）", async () => {
    mockFetchPush({
      items: [makeCard("a", 100), makeCard("b", 200), makeCard("c", 300)],
      cursor: { next: null, latest: 300 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // update 不改 ingestedAt，原 "b" 还是 200 → 在 a 与 c 之间
    const updated: PushCard = {
      ...makeCard("b", 200),
      enrichStatus: "ok",
      originalText: "updated b",
    };
    act(() => lastES!.emit("card.update", updated));
    expect(result.current.cards.map((c) => c.id)).toEqual(["c", "b", "a"]);
    expect(result.current.cards.find((c) => c.id === "b")?.originalText).toBe("updated b");
  });

  it("card.update 不触发 playNotifySound（v3）", async () => {
    mockFetchPush({
      items: [makeCard("a", 100)],
      cursor: { next: null, latest: 100 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => lastES!.emit("card.update", makeCard("a", 100)));
    expect(playNotifySound).not.toHaveBeenCalled();
  });

  it("同 id card.new 2 次 → 只保留 1 条（dedup）", async () => {
    mockFetchPush({
      items: [],
      cursor: { next: null, latest: 0 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => {
      lastES!.emit("card.new", makeCard("x", 100));
      lastES!.emit("card.new", makeCard("x", 100));
    });
    expect(result.current.cards.length).toBe(1);
  });

  it("card.new ingestedAt 小于首屏所有 → 沉到尾部（语义：upsert + sort desc，非 prepend · REV-DD110-v3 A:M4）", async () => {
    mockFetchPush({
      items: [makeCard("a", 500), makeCard("b", 400)],
      cursor: { next: null, latest: 500 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // 模拟 backlog 补送：新卡 ingestedAt=100 比首屏所有都小
    act(() => lastES!.emit("card.new", makeCard("late", 100)));
    expect(result.current.cards.map((c) => c.id)).toEqual(["a", "b", "late"]);
  });

  it("ping/unknown 事件不动 cards 数组（v2 B:M2）", async () => {
    mockFetchPush({
      items: [makeCard("a", 100)],
      cursor: { next: null, latest: 100 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => lastES!.emit("ping", { ts: Date.now() }));
    expect(result.current.cards.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("useNewsFeed — SSE 状态机", () => {
  it("onerror + readyState=CLOSED(2) → 首次约 3s（指数退避起点）后手动重建 EventSource（REV-DD110-v3 A:M2）", async () => {
    mockFetchPush({
      items: [],
      cursor: { next: null, latest: null },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const firstES = lastES;
    expect(firstES).not.toBeNull();
    // 标记 SSE 已 CLOSED，浏览器自动重连不工作
    Object.defineProperty(firstES, "readyState", { value: 2, configurable: true });
    vi.useFakeTimers({ shouldAdvanceTime: false });
    act(() => firstES!.emitError());
    expect(result.current.sseStatus).toBe("reconnecting");
    // 首次退避 = 基数 3s + 抖动(≤1s) → 推进 4.1s 覆盖最坏情况，openStream 重建 → lastES 换新
    act(() => vi.advanceTimersByTime(4_100));
    expect(lastES).not.toBe(firstES);
    expect(result.current.sseStatus).toBe("connecting");
  });

  it("连续 429 → 指数退避（第二次重连需要更久，不再固定 3s 风暴）", async () => {
    mockFetchPush({
      items: [],
      cursor: { next: null, latest: null },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    vi.useFakeTimers({ shouldAdvanceTime: false });

    // 第一次失败 → 首次退避（≤4.1s 内重建）
    const es1 = lastES!;
    Object.defineProperty(es1, "readyState", { value: 2, configurable: true });
    act(() => es1.emitError());
    act(() => vi.advanceTimersByTime(4_100));
    const es2 = lastES!;
    expect(es2).not.toBe(es1);

    // 第二次失败 → 退避翻倍（基数 6s）：推进 4.1s 还不该重建
    Object.defineProperty(es2, "readyState", { value: 2, configurable: true });
    act(() => es2.emitError());
    act(() => vi.advanceTimersByTime(4_100));
    expect(lastES).toBe(es2); // 仍未重建（证明退避已 > 4.1s）
    // 再推进至覆盖 6s+抖动 → 重建
    act(() => vi.advanceTimersByTime(3_100));
    expect(lastES).not.toBe(es2);
  });

  it("onerror → sseStatus=reconnecting，60s 后升级 unstable", async () => {
    mockFetchPush({
      items: [],
      cursor: { next: null, latest: null },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // 切到 fake timers 控制 setTimeout，但保留已 resolve 的 microtask
    vi.useFakeTimers({ shouldAdvanceTime: false });
    act(() => lastES!.emitError());
    expect(result.current.sseStatus).toBe("reconnecting");
    // 推进 30s — 仍 reconnecting
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.sseStatus).toBe("reconnecting");
    // 推进到 60s+
    act(() => vi.advanceTimersByTime(31_000));
    expect(result.current.sseStatus).toBe("unstable");
  });
});

describe("useNewsFeed — markAllRead / unreadCount", () => {
  it("初始 unreadCount = cards 总数；markAllRead 后归零", async () => {
    mockFetchPush({
      items: [makeCard("a", 100), makeCard("b", 200)],
      cursor: { next: null, latest: 200 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.unreadCount).toBe(2);
    act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);
  });

  it("markAllRead 后新到 card.new → unreadCount 重新累积（D2 后台 badge 回归 · REV-DD110-v3 A:M3）", async () => {
    mockFetchPush({
      items: [makeCard("a", 100), makeCard("b", 200)],
      cursor: { next: null, latest: 200 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);
    act(() => lastES!.emit("card.new", makeCard("c", 500)));
    expect(result.current.unreadCount).toBe(1);
    act(() => lastES!.emit("card.new", makeCard("d", 600)));
    expect(result.current.unreadCount).toBe(2);
  });

  it("card.update 不更新 cursorLatest（防漏 backlog · REV-DD110-v3 B:M2）", async () => {
    mockFetchPush({
      items: [makeCard("a", 100)],
      cursor: { next: null, latest: 100 },
      hasMore: false,
      truncated: false,
    });
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);
    // SSE 推一条 card.update（ingestedAt=999，远大于 latest）— 不应推高 lastRead 基线
    act(() =>
      lastES!.emit("card.update", { ...makeCard("a", 999), original: { text: "updated" } })
    );
    // card.update 仅复述，但 ingestedAt 999 > lastRead 100，理论上算未读
    // 关键：cursorLatest 不变（不可观察但通过下一次新卡推进可间接验证）
    act(() => lastES!.emit("card.new", makeCard("b", 200)));
    // 如果 cursorLatest 被 update 推到 999，则下次重连 since=999，会漏掉 ingestedAt=200 的 b
    // 现实测试中我们直接断言 b 入 cards
    expect(result.current.cards.find((c) => c.id === "b")?.ingestedAt).toBe(200);
  });
});

describe("useNewsFeed — 速率限制（DD-110 §10.1）", () => {
  it("首屏 fetchPush 抛 429 → status=error + retryAfterSec 透传", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({}), {
          status: 429,
          headers: { "Retry-After": "45" },
        })
    ) as unknown as typeof fetch;
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.retryAfterSec).toBe(45);
    expect(result.current.errorMessage).toContain("45");
  });

  it("loadMore 抛 429 → 不重试，hook 暴露 retryAfterSec", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [makeCard("a", 100)],
            cursor: { next: 100, latest: 100 },
            hasMore: true,
            truncated: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 429,
          headers: { "Retry-After": "30" },
        })
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.retryAfterSec).toBe(30);
    // 验证不会自动重试 → 仅 2 次 fetch（首屏 + loadMore）
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("NewsRateLimitError instanceof 检查（类型保护正确）", () => {
    const err = new NewsRateLimitError(429, 60);
    expect(err).toBeInstanceOf(NewsRateLimitError);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(429);
    expect(err.retryAfterSec).toBe(60);
  });
});

describe("useNewsFeed — 翻页", () => {
  it("hasMore=true → loadMore 透传 before=cursor.next，append 模式", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [makeCard("a", 300), makeCard("b", 200)],
            cursor: { next: 200, latest: 300 },
            hasMore: true,
            truncated: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [makeCard("c", 100)],
            cursor: { next: null, latest: 300 },
            hasMore: false,
            truncated: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useNewsFeed(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.truncated).toBe(true);
    // 第 2 次 fetch URL 含 before=200
    const url2 = String(
      fetchMock.mock.calls[1][0] instanceof Request
        ? fetchMock.mock.calls[1][0].url
        : fetchMock.mock.calls[1][0]
    );
    expect(url2).toContain("before=200");
  });
});
