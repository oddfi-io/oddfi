/**
 * ENH-020 Phase 1 · B1.3 — Market Fixtures 契约集成测试
 *
 * 补齐 8a70bdb 漏测：
 * - Other Tab 必须发 league=0（不发 type=other）
 * - Live Tab 才发 type=live
 * - app_lang + locale 必须同时出现
 * - 分页语义：page=1 首屏 + page=2 追加 + 空页终止
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SportmonksFixture } from "@/types/api";

// 在 import lib/api 前 mock ky — 捕获 GET 调用的 path + searchParams
vi.mock("ky", () => {
  const mockGet = vi.fn();
  return {
    default: {
      create: () => ({
        get: mockGet,
        post: vi.fn(),
      }),
    },
    __mockGet: mockGet,
  };
});

const { __mockGet } = (await import("ky")) as unknown as {
  __mockGet: ReturnType<typeof vi.fn>;
};

/** 生成 N 条 fixture mock，id 递增 */
function makePage(start: number, count: number): SportmonksFixture[] {
  return Array.from({ length: count }, (_, i) => ({
    id: start + i,
    league_id: 0,
    stage_id: 0,
    name: `Fixture ${start + i}`,
    starting_at: "2026-06-11 15:00:00",
    starting_at_timestamp: 0,
    state_id: 1,
    has_odds: true,
    odds: [],
    participants: [],
  })) as unknown as SportmonksFixture[];
}

/** 构造 ky().json() 返回的 ApiResponse<T> */
function wrap<T>(data: T) {
  return {
    json: () => Promise.resolve({ code: 200, msg: "ok", data }),
  };
}

describe("Market fixtures API contract — ENH-020 §4 B1.3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Other Tab sends league=0 + no type (补齐 8a70bdb 漏测)", async () => {
    __mockGet.mockReturnValue(wrap([]));
    const { getMarketFixtures } = await import("@/lib/api");

    await getMarketFixtures({
      league: 0,
      page: 1,
      app_lang: "en",
      locale: "en",
    });

    expect(__mockGet).toHaveBeenCalledWith("v1/detail/sports_all", {
      searchParams: { league: 0, page: 1, app_lang: "en", locale: "en" },
      retry: { limit: 0 },
    });
    const calls = __mockGet.mock.calls[0]?.[1]?.searchParams;
    expect(calls).not.toHaveProperty("type");
  });

  it("Live Tab sends type=live explicitly", async () => {
    __mockGet.mockReturnValue(wrap([]));
    const { getMarketFixtures } = await import("@/lib/api");

    await getMarketFixtures({
      league: 0,
      type: "live",
      page: 1,
      app_lang: "zh",
      locale: "zh",
    });

    const params = __mockGet.mock.calls[0]?.[1]?.searchParams;
    expect(params).toMatchObject({ league: 0, type: "live", page: 1 });
  });

  it("sends app_lang + locale as paired locale params", async () => {
    __mockGet.mockReturnValue(wrap([]));
    const { getMarketFixtures } = await import("@/lib/api");

    await getMarketFixtures({ league: 8, page: 1, app_lang: "zh", locale: "zh" });
    const params = __mockGet.mock.calls[0]?.[1]?.searchParams;
    expect(params).toMatchObject({ app_lang: "zh", locale: "zh" });
  });

  it("paginated 25/25/10 — terminates on under-full page", async () => {
    // 模拟 3 页：25 → 25 → 10
    __mockGet
      .mockReturnValueOnce(wrap(makePage(0, 25)))
      .mockReturnValueOnce(wrap(makePage(25, 25)))
      .mockReturnValueOnce(wrap(makePage(50, 10)));

    const { getMarketFixtures } = await import("@/lib/api");
    const { getNextPageParam } = await import("@/hooks/useMarketData");

    // page 1
    const p1 = await getMarketFixtures({ league: 0, page: 1 });
    expect(p1).toHaveLength(25);
    expect(getNextPageParam(p1, [p1], 40)).toBe(2);

    // page 2
    const p2 = await getMarketFixtures({ league: 0, page: 2 });
    expect(p2).toHaveLength(25);
    expect(getNextPageParam(p2, [p1, p2], 40)).toBe(3);

    // page 3 (尾页)
    const p3 = await getMarketFixtures({ league: 0, page: 3 });
    expect(p3).toHaveLength(10);
    // 未满页 → 终止
    expect(getNextPageParam(p3, [p1, p2, p3], 40)).toBeUndefined();

    expect(__mockGet).toHaveBeenCalledTimes(3);
  });

  it("paginated 25/25/0 edge — terminates on empty page (M1 整倍数边界)", async () => {
    // 模拟总量恰为 PAGE_SIZE × 2，第 3 页返空
    __mockGet
      .mockReturnValueOnce(wrap(makePage(0, 25)))
      .mockReturnValueOnce(wrap(makePage(25, 25)))
      .mockReturnValueOnce(wrap([]));

    const { getMarketFixtures } = await import("@/lib/api");
    const { getNextPageParam } = await import("@/hooks/useMarketData");

    const p1 = await getMarketFixtures({ league: 0, page: 1 });
    expect(getNextPageParam(p1, [p1], 40)).toBe(2);

    const p2 = await getMarketFixtures({ league: 0, page: 2 });
    // 满页 → 继续请求下一页
    expect(getNextPageParam(p2, [p1, p2], 40)).toBe(3);

    const p3 = await getMarketFixtures({ league: 0, page: 3 });
    expect(p3).toHaveLength(0);
    // 空页 → hasNextPage 应为 false，不应再请求 page=4
    expect(getNextPageParam(p3, [p1, p2, p3], 40)).toBeUndefined();

    expect(__mockGet).toHaveBeenCalledTimes(3);
  });

  it("invokes v1/detail/sports_all path (not sports or v2/...)", async () => {
    __mockGet.mockReturnValue(wrap([]));
    const { getMarketFixtures } = await import("@/lib/api");

    await getMarketFixtures({ league: 8, page: 1 });
    expect(__mockGet.mock.calls[0]?.[0]).toBe("v1/detail/sports_all");
  });
});
