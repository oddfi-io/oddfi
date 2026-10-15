/**
 * DD-110 — lib/news/api 单测。
 * 覆盖：fetchPush 透传 cursor、5xx 抛错；openPushStream addEventListener 注册次数；
 *      未配置 NEWS_API_BASE_URL 时抛错。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_NEWS_API_BASE_URL", "https://news-api.test.local");

import { fetchPush, openPushStream, isNewsApiConfigured, NewsRateLimitError } from "./api";
import type { PushResponse } from "@/types/news";

describe("isNewsApiConfigured", () => {
  it("非空 base url 返回 true", () => {
    expect(isNewsApiConfigured()).toBe(true);
  });
});

describe("fetchPush", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockJson(body: unknown, status = 200) {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        })
    ) as unknown as typeof fetch;
  }

  it("透传 limit + before 查询参数", async () => {
    const body: PushResponse = {
      items: [],
      count: 0,
      cursor: { next: null, latest: 1234 },
      hasMore: false,
      truncated: false,
    };
    mockJson(body);
    await fetchPush({ limit: 20, before: 999 });
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const arg = fetchMock.mock.calls[0][0];
    const url = arg instanceof Request ? arg.url : String(arg);
    expect(url).toContain("limit=20");
    expect(url).toContain("before=999");
    expect(url).toContain("https://news-api.test.local/api/push");
  });

  it("200 → 解析 PushResponse", async () => {
    const body: PushResponse = {
      items: [],
      count: 0,
      cursor: { next: 1, latest: 2 },
      hasMore: true,
      truncated: false,
    };
    mockJson(body);
    const result = await fetchPush();
    expect(result).toEqual(body);
  });

  it("5xx → 抛错", async () => {
    mockJson({ error: "boom" }, 500);
    await expect(fetchPush({ limit: 10 })).rejects.toThrow();
  });

  it("429 → NewsRateLimitError，解析 Retry-After header", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "rate limited" }), {
          status: 429,
          headers: { "Retry-After": "60", "Content-Type": "application/json" },
        })
    ) as unknown as typeof fetch;
    await expect(fetchPush()).rejects.toMatchObject({
      name: "NewsRateLimitError",
      status: 429,
      retryAfterSec: 60,
    });
  });

  it("503 → NewsRateLimitError；Retry-After 缺失时默认 60s", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("over capacity", { status: 503 })
    ) as unknown as typeof fetch;
    try {
      await fetchPush();
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NewsRateLimitError);
      expect((e as NewsRateLimitError).status).toBe(503);
      expect((e as NewsRateLimitError).retryAfterSec).toBe(60);
    }
  });

  it("429 不触发 ky 自动重试（最多 1 次 fetch 调用）", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({}), {
          status: 429,
          headers: { "Retry-After": "30" },
        })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(fetchPush()).rejects.toBeInstanceOf(NewsRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("openPushStream", () => {
  type EventListener = (e: Event | MessageEvent) => void;

  class MockEventSource {
    public listeners = new Map<string, EventListener[]>();
    public url: string;
    public closed = false;

    constructor(url: string) {
      this.url = url;
    }
    addEventListener(type: string, listener: EventListener) {
      const arr = this.listeners.get(type) ?? [];
      arr.push(listener);
      this.listeners.set(type, arr);
    }
    close() {
      this.closed = true;
    }
    dispatch(type: string, data: unknown) {
      const arr = this.listeners.get(type) ?? [];
      for (const l of arr) {
        l(new MessageEvent(type, { data: JSON.stringify(data) }));
      }
    }
    dispatchError() {
      const arr = this.listeners.get("error") ?? [];
      for (const l of arr) {
        l(new Event("error"));
      }
    }
  }

  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    (globalThis as unknown as { EventSource: typeof EventSource }).EventSource =
      MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    (globalThis as unknown as { EventSource: typeof EventSource }).EventSource =
      originalEventSource;
  });

  it("since=null → URL 不带查询参数", () => {
    const es = openPushStream(null, { onNew: vi.fn(), onUpdate: vi.fn(), onError: vi.fn() });
    expect((es as unknown as MockEventSource).url).toBe(
      "https://news-api.test.local/api/push/stream"
    );
  });

  it("since 数值 → URL 拼 ?since=<ts>", () => {
    const es = openPushStream(1700000000000, {
      onNew: vi.fn(),
      onUpdate: vi.fn(),
      onError: vi.fn(),
    });
    expect((es as unknown as MockEventSource).url).toBe(
      "https://news-api.test.local/api/push/stream?since=1700000000000"
    );
  });

  it("注册 card.new / card.update / error 三类 listener", () => {
    const es = openPushStream(null, { onNew: vi.fn(), onUpdate: vi.fn(), onError: vi.fn() });
    const mock = es as unknown as MockEventSource;
    expect(mock.listeners.get("card.new")?.length).toBe(1);
    expect(mock.listeners.get("card.update")?.length).toBe(1);
    expect(mock.listeners.get("error")?.length).toBe(1);
  });

  it("card.new 事件 → onNew 解析并回调", () => {
    const onNew = vi.fn();
    const es = openPushStream(null, { onNew, onUpdate: vi.fn(), onError: vi.fn() });
    const mock = es as unknown as MockEventSource;
    mock.dispatch("card.new", { id: "c1", ingestedAt: 100, createdAt: 99 });
    expect(onNew).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1", ingestedAt: 100, createdAt: 99 })
    );
  });

  it("error 事件 → onError 回调", () => {
    const onError = vi.fn();
    const es = openPushStream(null, { onNew: vi.fn(), onUpdate: vi.fn(), onError });
    const mock = es as unknown as MockEventSource;
    mock.dispatchError();
    expect(onError).toHaveBeenCalled();
  });
});
