// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  buildInfinitePageContext,
  getNextPageParam,
  injectHeadFixtures,
  remapOnchainTestOddsIds,
  shouldRetry,
  useMarketData,
} from "./useMarketData";
import { MarketApiError } from "@/lib/api";
import type { SportmonksFixture } from "@/types/api";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

// 在 import lib/api 前 mock：保留 MarketApiError，拦截 getMarketFixtures / getMarketFixturesByDate
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMarketFixtures: vi.fn(),
    getMarketFixturesByDate: vi.fn(),
    getMarketChips: vi.fn(),
    getOnchainTestFixtures: vi.fn(),
  };
});
const api = (await import("@/lib/api")) as typeof import("@/lib/api");
const mockedGetMarketFixtures = vi.mocked(api.getMarketFixtures);
const mockedGetMarketFixturesByDate = vi.mocked(api.getMarketFixturesByDate);
const mockedGetMarketChips = vi.mocked(api.getMarketChips);
const mockedGetOnchainTestFixtures = vi.mocked(api.getOnchainTestFixtures);

function makeFx(
  id: number,
  participants: string[] = [],
  league?: { id: number; country_id: number }
): SportmonksFixture {
  return {
    id,
    league_id: league?.id ?? 8,
    stage_id: 0,
    name: `Fixture ${id}`,
    starting_at: "2026-06-11 15:00:00",
    starting_at_timestamp: 0,
    state_id: 1,
    has_odds: true,
    odds: [],
    participants: participants.map((name) => ({ name })),
    ...(league ? { league } : {}),
  } as unknown as SportmonksFixture;
}

// ─── ENH-020 Phase 1 · B1.2 ──────────────────────────────────────────────

function makePage(n: number): SportmonksFixture[] {
  return Array.from({ length: n }, (_, i) => makeFx(i));
}

describe("getNextPageParam — ENH-020 pagination termination", () => {
  const WC_MAX = 20;
  const OTHER_MAX = 40;

  it("returns undefined on empty page (25 整倍数边界，M1 早停)", () => {
    // 当总量恰为 25 × N 时，第 N+1 页返空 → 必须立即停
    const allPages = [makePage(25), makePage(25)];
    expect(getNextPageParam([], allPages, WC_MAX)).toBeUndefined();
  });

  it("returns undefined on under-full page (< PAGE_SIZE 即尾页)", () => {
    const allPages = [makePage(25), makePage(10)];
    expect(getNextPageParam(makePage(10), allPages, WC_MAX)).toBeUndefined();
  });

  it("returns next page index when last page is full and under maxPages", () => {
    const allPages = [makePage(25)];
    expect(getNextPageParam(makePage(25), allPages, WC_MAX)).toBe(2);
  });

  it("respects WC/UCL maxPages=20 cap", () => {
    const allPages = Array.from({ length: 20 }, () => makePage(25));
    expect(getNextPageParam(makePage(25), allPages, WC_MAX)).toBeUndefined();

    const stillWithin = Array.from({ length: 19 }, () => makePage(25));
    expect(getNextPageParam(makePage(25), stillWithin, WC_MAX)).toBe(20);
  });

  it("respects Other Tab maxPages=40 cap (更宽裕)", () => {
    const withinOther = Array.from({ length: 25 }, () => makePage(25));
    // WC 上限会在 page=20 终止，Other 依然继续
    expect(getNextPageParam(makePage(25), withinOther, WC_MAX)).toBeUndefined();
    expect(getNextPageParam(makePage(25), withinOther, OTHER_MAX)).toBe(26);

    const atOtherLimit = Array.from({ length: 40 }, () => makePage(25));
    expect(getNextPageParam(makePage(25), atOtherLimit, OTHER_MAX)).toBeUndefined();
  });

  it("cross-page aggregation order: pages.flat() preserves page order", () => {
    // 测试 useInfiniteQuery 内部语义（data.pages.flat() 顺序正确性）
    const page1 = [makeFx(1), makeFx(2)];
    const page2 = [makeFx(3), makeFx(4)];
    const page3 = [makeFx(5)];
    const flat = [page1, page2, page3].flat();
    expect(flat.map((f) => f.id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("shouldRetry — ENH-020 retry 谓词", () => {
  it("does NOT retry on MarketApiError (业务错误 code !== 0)", () => {
    const err = new MarketApiError(1001, "League not found");
    expect(shouldRetry(0, err)).toBe(false);
    expect(shouldRetry(2, err)).toBe(false);
  });

  it("retries other errors up to failureCount < 3", () => {
    const netErr = new Error("Network error");
    expect(shouldRetry(0, netErr)).toBe(true);
    expect(shouldRetry(1, netErr)).toBe(true);
    expect(shouldRetry(2, netErr)).toBe(true);
    expect(shouldRetry(3, netErr)).toBe(false);
  });

  it("treats non-Error values as retriable (system-edge defensive)", () => {
    expect(shouldRetry(0, "string error")).toBe(true);
    expect(shouldRetry(0, undefined)).toBe(true);
    expect(shouldRetry(0, null)).toBe(true);
  });
});

// ─── ENH-020 Phase 1 · B1.5 ──────────────────────────────────────────────

describe("buildInfinitePageContext — 两分支分页契约", () => {
  beforeEach(() => {
    mockedGetMarketFixtures.mockReset();
    mockedGetMarketFixturesByDate.mockReset();
  });

  // 分支 1：calendar → fixture_date 一次全返（BUG-071 方案A：today/tomorrow 已移出此分支）
  describe("calendar 分支（fixture_date 单页全返）", () => {
    it("maxPages=1", () => {
      const ctx = buildInfinitePageContext("worldcup", "calendar", "2026-06-20", "en");
      expect(ctx.maxPages).toBe(1);
    });

    it("pageParam=1 走 getMarketFixturesByDate，按 league_id 客户端过滤", async () => {
      // fixture_date 接口不支持 league 参数，返回当天所有联赛；前端按 league_id 过滤
      mockedGetMarketFixturesByDate.mockResolvedValueOnce([
        makeFx(100, [], { id: 732, country_id: 1 }), // WC 联赛，保留
        makeFx(101, [], { id: 732, country_id: 1 }), // WC 联赛，保留
        makeFx(102, [], { id: 8, country_id: 2 }), // 非 WC 联赛，过滤掉
      ]);
      const ctx = buildInfinitePageContext("worldcup", "calendar", "2026-06-20", "en");
      const page = await ctx.fetchPage(1);
      expect(page.map((f) => f.id)).toEqual([100, 101]);
      // 传入选中日期；不传 league 参数给后端（fixture_date 不支持）
      expect(mockedGetMarketFixturesByDate).toHaveBeenCalledWith("2026-06-20", {
        app_lang: "en",
        locale: "en",
      });
    });

    it("pageParam > 1 返空不发请求", async () => {
      const ctx = buildInfinitePageContext("worldcup", "calendar", "2026-06-20", "en");
      const page = await ctx.fetchPage(2);
      expect(page).toEqual([]);
      expect(mockedGetMarketFixturesByDate).not.toHaveBeenCalled();
    });

    it("calendarDate 为空时不发请求返空", async () => {
      const ctx = buildInfinitePageContext("worldcup", "calendar", null, "en");
      expect(await ctx.fetchPage(1)).toEqual([]);
      expect(mockedGetMarketFixturesByDate).not.toHaveBeenCalled();
    });
  });

  // BUG-071 方案A：today/tomorrow 改走 sports_all 真分页（不再 fixture_date）
  describe("today/tomorrow 分支（方案A → sports_all 真分页）", () => {
    it("today 走 sports_all 非 fixture_date，WC maxPages=20 / Other=40", async () => {
      mockedGetMarketFixtures.mockResolvedValueOnce([makeFx(1)]);
      const wc = buildInfinitePageContext("worldcup", "today", null, "en");
      expect(wc.maxPages).toBe(20);
      await wc.fetchPage(2);
      expect(mockedGetMarketFixtures).toHaveBeenCalledWith(
        expect.objectContaining({ league: 732, page: 2 })
      );
      expect(mockedGetMarketFixturesByDate).not.toHaveBeenCalled();
      expect(buildInfinitePageContext("other", "today", null, "en").maxPages).toBe(40);
    });

    it("tomorrow 同走 sports_all，不附 type、不查 fixture_date", async () => {
      mockedGetMarketFixtures.mockResolvedValueOnce([]);
      const ctx = buildInfinitePageContext("worldcup", "tomorrow", null, "en");
      expect(ctx.maxPages).toBe(20);
      await ctx.fetchPage(1);
      const params = mockedGetMarketFixtures.mock.calls.at(-1)?.[0] ?? {};
      expect(params).not.toHaveProperty("type");
      expect(mockedGetMarketFixturesByDate).not.toHaveBeenCalled();
    });

    it("other tab today + 选中国家：league_country_id 透传 sports_all 服务端过滤", async () => {
      mockedGetMarketFixtures.mockResolvedValueOnce([]);
      const ctx = buildInfinitePageContext("other", "today", null, "en", null, 2);
      await ctx.fetchPage(1);
      expect(mockedGetMarketFixtures).toHaveBeenCalledWith(
        expect.objectContaining({ league: 0, league_country_id: 2 })
      );
    });
  });

  // 分支 2：默认 sports_all 真分页
  describe("default 分支（sports_all 真分页）", () => {
    it("WC 分支 maxPages=20", () => {
      const ctx = buildInfinitePageContext("worldcup", "all", null, "en");
      expect(ctx.maxPages).toBe(20);
    });

    it("Other 分支 maxPages=40", () => {
      const ctx = buildInfinitePageContext("other", "all", null, "en");
      expect(ctx.maxPages).toBe(40);
    });

    it("pageParam 直接映射 sports_all?page=N，league 参数透传", async () => {
      mockedGetMarketFixtures.mockResolvedValueOnce([makeFx(1)]);
      const ctx = buildInfinitePageContext("other", "all", null, "zh");
      await ctx.fetchPage(3);
      expect(mockedGetMarketFixtures).toHaveBeenCalledWith(
        expect.objectContaining({ league: 0, page: 3, app_lang: "zh", locale: "zh" })
      );
    });

    it("live filter 附加 type=live", async () => {
      mockedGetMarketFixtures.mockResolvedValueOnce([]);
      const ctx = buildInfinitePageContext("worldcup", "live", null, "en");
      await ctx.fetchPage(1);
      expect(mockedGetMarketFixtures).toHaveBeenCalledWith(
        expect.objectContaining({ type: "live", league: 732 })
      );
    });
  });
});

describe("useMarketData · visibility 守卫（ENH-031 B1.6）", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  function makeWrapper() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: qc }, children);
    }
    return Wrapper;
  }

  beforeEach(() => {
    addSpy = vi.spyOn(document, "addEventListener");
    removeSpy = vi.spyOn(document, "removeEventListener");
    mockedGetMarketFixtures.mockResolvedValue([]);
    mockedGetMarketFixturesByDate.mockResolvedValue([]);
    mockedGetMarketChips.mockResolvedValue({ teams: [], league_countries: [] });
    mockedGetOnchainTestFixtures.mockResolvedValue([]);
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("live 模式挂 visibilitychange 监听，unmount 时摘除", () => {
    const { unmount } = renderHook(
      () =>
        useMarketData({
          tournament: "worldcup",
          timeFilter: "live",
          calendarDate: null,
        }),
      { wrapper: makeWrapper() }
    );

    const visAdds = addSpy.mock.calls.filter((call: unknown[]) => call[0] === "visibilitychange");
    expect(visAdds.length).toBeGreaterThanOrEqual(1);

    act(() => unmount());

    const visRemoves = removeSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === "visibilitychange"
    );
    expect(visRemoves.length).toBeGreaterThanOrEqual(1);
  });

  it("today（非 live/all）模式不挂 visibilitychange 监听", () => {
    renderHook(
      () =>
        useMarketData({
          tournament: "worldcup",
          timeFilter: "today",
          calendarDate: null,
        }),
      { wrapper: makeWrapper() }
    );

    const visAdds = addSpy.mock.calls.filter((call: unknown[]) => call[0] === "visibilitychange");
    expect(visAdds.length).toBe(0);
  });
});

// ─── DD-138 · 链上测试赛事注入 ───────────────────────────────────────────

describe("remapOnchainTestOddsIds (DD-138)", () => {
  const fx = (id: number, oddsCount: number) =>
    ({
      ...makeFx(id),
      odds: Array.from({ length: oddsCount }, () => ({ id: 99301178082220000 })),
    }) as unknown as SportmonksFixture;

  it("同 fixture 内 odds.id 互不坍缩（后端 17 位 id JSON.parse 后全部相同）", () => {
    const [out] = remapOnchainTestOddsIds([fx(993011780822200, 7)]);
    const ids = out.odds.map((o) => o.id);
    expect(new Set(ids).size).toBe(7);
    ids.forEach((id) => expect(Number.isSafeInteger(id)).toBe(true));
  });

  it("跨 fixture 不冲突（base 99301/99302 前缀区分）", () => {
    const [a, b] = remapOnchainTestOddsIds([fx(993011780822200, 3), fx(993021780822200, 3)]);
    const all = [...a.odds, ...b.odds].map((o) => o.id);
    expect(new Set(all).size).toBe(6);
    expect(a.odds[0].id).toBe(9930100);
    expect(b.odds[0].id).toBe(9930200);
  });

  it("确定性：同输入两次调用输出一致（refetch 幂等，REV-v1-A #5）", () => {
    const input = [fx(993011780822200, 7)];
    const first = remapOnchainTestOddsIds(input).map((f) => f.odds.map((o) => o.id));
    const second = remapOnchainTestOddsIds(input).map((f) => f.odds.map((o) => o.id));
    expect(first).toEqual(second);
  });
});

describe("injectHeadFixtures (DD-138)", () => {
  it("head 拼接在最前，按 id 与底层列表去重", () => {
    const head = [makeFx(993011780822200), makeFx(993021780822200)];
    const list = [makeFx(1), makeFx(993011780822200), makeFx(2)];
    const out = injectHeadFixtures(list, head);
    expect(out.map((f) => f.id)).toEqual([993011780822200, 993021780822200, 1, 2]);
  });

  it("head 为空时原样返回（接口失败/活动窗口外的静默降级）", () => {
    const list = [makeFx(1)];
    expect(injectHeadFixtures(list, [])).toBe(list);
  });
});

describe("useMarketData · 链上测试赛事注入交互（DD-138 / REV-v1-A #1）", () => {
  function makeWrapper() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: qc }, children);
    }
    return Wrapper;
  }

  const onchainTestFx = [
    makeFx(993011780822200, [], { id: 2, country_id: 41 }),
    makeFx(993021780822200, [], { id: 2, country_id: 41 }),
  ];

  beforeEach(() => {
    mockedGetMarketFixtures.mockResolvedValue([]);
    mockedGetMarketFixturesByDate.mockResolvedValue([]);
    mockedGetMarketChips.mockResolvedValue({ teams: [], league_countries: [] });
    mockedGetOnchainTestFixtures.mockResolvedValue(onchainTestFx);
  });

  it("other tab + 选中国家 chip：服务端已过滤，注入测试赛事仍在最前且不重复", async () => {
    // DD-market-chips Phase 3：country 过滤已下沉后端（getMarketFixtures 收到 league_country_id），
    // 前端不再客户端按 country_id 过滤；服务端返回的 fixtures 全部保留，注入项置顶并按 id 去重。
    mockedGetMarketFixtures.mockResolvedValue([
      makeFx(1, [], { id: 8, country_id: 2 }),
      makeFx(2, [], { id: 9, country_id: 3 }),
    ]);

    const { result } = renderHook(
      () =>
        useMarketData({
          tournament: "other",
          timeFilter: "all",
          calendarDate: null,
          selectedLeagueCountryId: 2,
        }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fixtures.map((f) => f.id)).toEqual([
        993011780822200, 993021780822200, 1, 2,
      ]);
    });

    // 选中国家以 league_country_id 透传给后端
    expect(mockedGetMarketFixtures).toHaveBeenCalledWith(
      expect.objectContaining({ league: 0, league_country_id: 2 })
    );
  });

  it("worldcup tab：链上测试赛事在最前（早于普通列表）", async () => {
    mockedGetMarketFixtures.mockResolvedValue([makeFx(10, [], { id: 732, country_id: 1 })]);

    const { result } = renderHook(
      () => useMarketData({ tournament: "worldcup", timeFilter: "all", calendarDate: null }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fixtures.slice(0, 2).map((f) => f.id)).toEqual([
        993011780822200, 993021780822200,
      ]);
      expect(result.current.fixtures.map((f) => f.id)).toContain(10);
    });
  });

  it("other tab 国家 chip 来源为后端 market_chips（非 fixtures 派生）", async () => {
    // DD-market-chips §5.2：chip 列表由后端提供，与 fixtures（含注入项）无关。
    mockedGetMarketFixtures.mockResolvedValue([makeFx(1, [], { id: 8, country_id: 2 })]);
    mockedGetMarketChips.mockResolvedValue({
      teams: [],
      league_countries: [
        { country_id: 462, name: "England", image_path: "x.png", count: 40, league_ids: [8, 9] },
      ],
    });

    const { result } = renderHook(
      () => useMarketData({ tournament: "other", timeFilter: "all", calendarDate: null }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fixtures.length).toBeGreaterThan(0);
      expect(result.current.leagueCountries).toEqual([
        { countryId: 462, name: "England", imagePath: "x.png", count: 40, leagueIds: [8, 9] },
      ]);
    });
    // chip 接口与 list 同义参数：league=0、locale 透传
    expect(mockedGetMarketChips).toHaveBeenCalledWith(
      expect.objectContaining({ league: 0, app_lang: "en", locale: "en" })
    );
  });

  it("other tab + timeFilter=today + 选中国家：方案A 走 sports_all 服务端 league_country_id（不再客户端过滤）", async () => {
    // BUG-071 方案A：today 改走 sports_all，country 过滤下沉后端（league_country_id 透传）；
    // 服务端返回全部保留，前端不再按 f.league.country_id 客户端过滤（双重过滤/窗口为空回归）。
    mockedGetMarketFixtures.mockResolvedValue([
      makeFx(1, [], { id: 8, country_id: 2 }),
      makeFx(2, [], { id: 9, country_id: 3 }), // country 与选中不符，但服务端路径不应客户端滤掉
    ]);
    mockedGetOnchainTestFixtures.mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useMarketData({
          tournament: "other",
          timeFilter: "today",
          calendarDate: null,
          selectedLeagueCountryId: 2,
        }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fixtures.map((f) => f.id)).toEqual([1, 2]);
    });
    // today 走 sports_all，league_country_id 透传后端；不再走 fixture_date
    expect(mockedGetMarketFixtures).toHaveBeenCalledWith(
      expect.objectContaining({ league: 0, league_country_id: 2 })
    );
    expect(mockedGetMarketFixturesByDate).not.toHaveBeenCalled();
  });

  it("sports_all 分支不做客户端国家过滤（服务端 league_country_id 已滤）", async () => {
    // 服务端返回的全部 fixtures 须原样保留——即便某项 country_id 与选中不符，
    // 也不能客户端再滤一遍（否则双重过滤 / 窗口为空回归）。
    mockedGetMarketFixtures.mockResolvedValue([
      makeFx(1, [], { id: 8, country_id: 2 }),
      makeFx(2, [], { id: 9, country_id: 3 }), // country_id 与选中不符，但服务端路径不应客户端滤掉
    ]);
    mockedGetOnchainTestFixtures.mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useMarketData({
          tournament: "other",
          timeFilter: "all",
          calendarDate: null,
          selectedLeagueCountryId: 2,
        }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fixtures.map((f) => f.id)).toEqual([1, 2]);
    });
    expect(mockedGetMarketFixtures).toHaveBeenCalledWith(
      expect.objectContaining({ league: 0, league_country_id: 2 })
    );
  });

  it("接口失败静默降级：普通列表照常返回", async () => {
    mockedGetOnchainTestFixtures.mockRejectedValue(new Error("network down"));
    mockedGetMarketFixtures.mockResolvedValue([makeFx(1, [], { id: 8, country_id: 2 })]);

    const { result } = renderHook(
      () => useMarketData({ tournament: "other", timeFilter: "all", calendarDate: null }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fixtures.map((f) => f.id)).toEqual([1]);
    });
  });
});

// ─── DD-market-chips · 后端 chip + 服务端过滤透传 ────────────────────────────

describe("useMarketData · market_chips 接入 + 服务端过滤透传（DD-market-chips §5.2）", () => {
  function makeWrapper() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: qc }, children);
    }
    return Wrapper;
  }

  beforeEach(() => {
    mockedGetMarketFixtures.mockResolvedValue([]);
    mockedGetMarketFixturesByDate.mockResolvedValue([]);
    mockedGetOnchainTestFixtures.mockResolvedValue([]);
    mockedGetMarketChips.mockResolvedValue({ teams: [], league_countries: [] });
  });

  it("worldcup tab：team chips 来源后端，wire→TeamOption 映射正确", async () => {
    mockedGetMarketChips.mockResolvedValue({
      teams: [{ team_id: 3437, name: "阿根廷", logo: "3437.png", count: 12 }],
      league_countries: [],
    });

    const { result } = renderHook(
      () => useMarketData({ tournament: "worldcup", timeFilter: "all", calendarDate: null }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.teams).toEqual([
        { team_id: 3437, name: "阿根廷", logo: "3437.png", count: 12 },
      ]);
    });
    expect(mockedGetMarketChips).toHaveBeenCalledWith(
      expect.objectContaining({ league: 732, app_lang: "en", locale: "en" })
    );
  });

  it("live timeFilter：chip 接口附加 type=live", async () => {
    renderHook(
      () => useMarketData({ tournament: "worldcup", timeFilter: "live", calendarDate: null }),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => {
      expect(mockedGetMarketChips).toHaveBeenCalledWith(
        expect.objectContaining({ league: 732, type: "live" })
      );
    });
  });

  it("选中球队：sports_all 透传 team_id（worldcup 服务端过滤）", async () => {
    renderHook(
      () =>
        useMarketData({
          tournament: "worldcup",
          timeFilter: "all",
          calendarDate: null,
          selectedTeamFilter: 3437,
        }),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => {
      expect(mockedGetMarketFixtures).toHaveBeenCalledWith(
        expect.objectContaining({ league: 732, team_id: 3437 })
      );
    });
  });

  it("chip 列表不随选中过滤变化：选中 team_id 不传入 market_chips 接口", async () => {
    renderHook(
      () =>
        useMarketData({
          tournament: "worldcup",
          timeFilter: "all",
          calendarDate: null,
          selectedTeamFilter: 3437,
        }),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => {
      expect(mockedGetMarketChips).toHaveBeenCalled();
    });
    const lastCall = mockedGetMarketChips.mock.calls.at(-1)?.[0] ?? {};
    expect(lastCall).not.toHaveProperty("team_id");
    expect(lastCall).not.toHaveProperty("league_country_id");
  });
});
