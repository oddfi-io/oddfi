// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import {
  PENDING_POLL_LEAD_MS,
  shouldPollPending,
  shouldRetryStreams,
  useFixtureStreams,
} from "./useFixtureStreams";
import type { FixtureStreamsResponse } from "@/types/streams";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { getFixtureStreams: vi.fn(), MarketApiError: actual.MarketApiError };
});
import { getFixtureStreams, MarketApiError } from "@/lib/api";

const NOW = 1_700_000_000_000;
const startingAtSec = NOW / 1000 + 3600; // 开赛在 1h 后

describe("shouldPollPending", () => {
  it("非 pending 一律不轮询", () => {
    expect(shouldPollPending("available", null, NOW)).toBe(false);
    expect(shouldPollPending("unavailable", null, NOW)).toBe(false);
    expect(shouldPollPending(undefined, null, NOW)).toBe(false);
  });

  it("pending 且无开赛时间 → 轮询", () => {
    expect(shouldPollPending("pending", null, NOW)).toBe(true);
  });

  it("pending 且距开赛 > 5min → 不轮询（远期不刷请求）", () => {
    const startMs = NOW + 3600_000; // 1h 后开赛
    expect(shouldPollPending("pending", startMs, NOW)).toBe(false);
  });

  it("pending 且进入开赛前 5min 窗口 → 轮询", () => {
    const startMs = NOW + PENDING_POLL_LEAD_MS - 1_000; // 还剩 ~5min 差 1s
    expect(shouldPollPending("pending", startMs, NOW)).toBe(true);
  });

  it("pending 且已过开赛时间 → 仍轮询（边界）", () => {
    const startMs = NOW - 60_000;
    expect(shouldPollPending("pending", startMs, NOW)).toBe(true);
  });
});

describe("shouldRetryStreams", () => {
  it("code 400 不重试", () => {
    expect(shouldRetryStreams(0, new MarketApiError(400, "bad id"))).toBe(false);
  });

  it("code 429 / 500 在 2 次内重试", () => {
    expect(shouldRetryStreams(0, new MarketApiError(429, "rate limit"))).toBe(true);
    expect(shouldRetryStreams(1, new MarketApiError(500, "internal"))).toBe(true);
    expect(shouldRetryStreams(2, new MarketApiError(500, "internal"))).toBe(false);
  });

  it("普通网络错误在 2 次内重试", () => {
    expect(shouldRetryStreams(0, new Error("network"))).toBe(true);
    expect(shouldRetryStreams(2, new Error("network"))).toBe(false);
  });
});

describe("useFixtureStreams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeWrapper() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: qc }, children);
    }
    return Wrapper;
  }

  it("available → 透出 status + 已排序 streams", async () => {
    const sample: FixtureStreamsResponse = {
      fixture_id: 12345,
      stream_status: "available",
      streams: [
        {
          provider: "streamed.pk",
          embed_url: "https://embedme.top/embed/a/1",
          language: "English",
          hd: true,
          stream_no: 1,
        },
        {
          provider: "streamed.pk",
          embed_url: "https://embedme.top/embed/b/2",
          language: "Spanish",
          hd: false,
          stream_no: 2,
        },
      ],
    };
    vi.mocked(getFixtureStreams).mockResolvedValue(sample);

    const { result } = renderHook(
      () => useFixtureStreams(12345, { startingAtTimestamp: startingAtSec }),
      { wrapper: makeWrapper() }
    );

    await vi.waitFor(() => expect(result.current.status).toBe("available"));
    expect(result.current.streams).toHaveLength(2);
    expect(result.current.streams[0].embed_url).toBe("https://embedme.top/embed/a/1");
    expect(result.current.isError).toBe(false);
  });

  it("unavailable → status=unavailable, streams 空", async () => {
    vi.mocked(getFixtureStreams).mockResolvedValue({
      fixture_id: 99,
      stream_status: "unavailable",
      streams: [],
    });

    const { result } = renderHook(() => useFixtureStreams(99), { wrapper: makeWrapper() });
    await vi.waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.streams).toEqual([]);
  });

  it("enabled=false → 不发请求（status 维持 null）", () => {
    const { result } = renderHook(() => useFixtureStreams(1, { enabled: false }), {
      wrapper: makeWrapper(),
    });
    expect(getFixtureStreams).not.toHaveBeenCalled();
    expect(result.current.status).toBeNull();
  });

  it("fixtureId<=0 → 不发请求", () => {
    renderHook(() => useFixtureStreams(0), { wrapper: makeWrapper() });
    expect(getFixtureStreams).not.toHaveBeenCalled();
  });
});
