/**
 * useMarketData — V2 data fetching hook (DD-052 §3.5)
 *
 * ENH-020 Phase 1：useInfiniteQuery 单通道路径（legacy 分支 B4.1a 清理，
 * stage 分支 B4.1b 清理）。tournament × timeFilter × calendarDate 驱动；
 * refetch 走 queryClient.fetchQuery 单页刷（B1.6）而非原生 refetchInterval。
 */
import { useEffect, useMemo, useRef } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  getMarketFixtures,
  getMarketFixtureDetail,
  getMarketFixturesByDate,
  getMarketChips,
  getOnchainTestFixtures,
  MarketApiError,
} from "@/lib/api";
import { getTournamentConfig } from "@/config/featured/tournament-stages";
import type { TournamentKey } from "@/config/featured/tournament-stages";
import type { TimeFilter } from "@/stores/marketsLayoutStore";
import type { SportmonksFixture } from "@/types/api";

// ─── Types ───────────────────────────────────────────────────────────────

// DD-market-chips：chip 数据源由后端 market_chips 接口提供（不再前端派生）。
export interface TeamOption {
  team_id: number;
  name: string;
  logo: string;
  count: number; // fixture appearance count (for sorting)
}

export interface LeagueCountryOption {
  countryId: number;
  name: string;
  imagePath: string;
  count: number; // fixture count (for sorting)
  leagueIds: number[]; // distinct league ids in this country
}

interface UseMarketDataOptions {
  tournament: TournamentKey;
  timeFilter: TimeFilter;
  calendarDate: string | null;
  /** Other Tab 内选中的国家 country_id；null 表示不过滤 */
  selectedLeagueCountryId?: number | null;
  /** WC Tab 内选中的球队 team_id；null 表示不过滤 */
  selectedTeamFilter?: number | null;
}

interface UseMarketDataResult {
  fixtures: SportmonksFixture[];
  isLoading: boolean;
  isError: boolean;
  teams: TeamOption[];
  leagueCountries: LeagueCountryOption[];
  /** ENH-020 Phase 1：useInfiniteQuery 分页控制字段 */
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
// WC/UCL 单联赛 20 页已够；Other Tab 聚合 10+ 联赛（MLS/瑞超 400+ 场），上限提到 40（= 1000 场）
const DEFAULT_MAX_PAGES = 20;
const OTHER_MAX_PAGES = 40;

// 测试比赛 fixture id（葡萄牙 vs 阿根廷）：UCL tab 下线后注入到世界杯列表首项
const INJECTED_TEST_FIXTURE_ID = 99200001;

// ─── Pure helpers (exported for unit test) ───────────────────────────────

/**
 * 分页终止判定（纯函数 · ENH-020 §3.1 点 3）。
 * - 空页早停：处理"总量恰为 PAGE_SIZE 整倍数时下一页返空"的边界
 * - 未满页：后端契约 25/页，< 25 即尾页
 * - maxPages：防御上限，避免后端异常数据无限翻页
 */
export function getNextPageParam(
  lastPage: SportmonksFixture[],
  allPages: SportmonksFixture[][],
  maxPages: number
): number | undefined {
  if (lastPage.length === 0) return undefined;
  if (lastPage.length < PAGE_SIZE) return undefined;
  if (allPages.length >= maxPages) return undefined;
  return allPages.length + 1;
}

/**
 * Retry 谓词（纯函数，供 useQuery/useInfiniteQuery 共用 + 单测）。
 * - MarketApiError 视为业务级错误（code !== 0），不重试
 * - 其它错误（网络、5xx）最多重试 3 次
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(error instanceof MarketApiError) && failureCount < 3;
}

/**
 * 链上测试赛事 odds[].id 重映射（DD-138 §2.3）。
 *
 * 后端 odds.id 为 17 位整数（> Number.MAX_SAFE_INTEGER），JSON.parse 后同
 * fixture 内 7 条 odds 的 id 坍缩为同一值。重映射为确定性安全整数
 * `base(99301/99302) × 100 + index`，保证：
 * - 同 fixture 内互不坍缩（React key / oddId 本地标识可用）
 * - 跨 fixture 不冲突（base 不同）
 * - refetch 幂等（禁随机值 — REV-v1-A #5）
 *
 * oddId 在链上下注路径仅作本地标识（链上按 marketType+line 匹配），重映射无副作用。
 */
export function remapOnchainTestOddsIds(fixtures: SportmonksFixture[]): SportmonksFixture[] {
  return fixtures.map((f) => {
    // 从 fixture_id = base(99301/99302) × 10^10 + round_start_unix 还原 base，
    // 再 × 100 + idx 得到同 fixture 内互异、跨 fixture 不冲突的安全整数 id。
    const base = Math.floor(f.id / 1e10);
    return { ...f, odds: f.odds.map((o, idx) => ({ ...o, id: base * 100 + idx })) };
  });
}

/**
 * 列表头部注入（DD-138 / REV-v1-A #1 · 纯函数供单测）。
 *
 * 在 selectedLeagueCountryId 过滤**之后**拼接，保证国家 chip 不会滤掉注入项；
 * 与底层列表按 fixture.id 去重（同场赛事以注入版本为准，含重映射后的 odds）。
 */
export function injectHeadFixtures(
  filtered: SportmonksFixture[],
  head: SportmonksFixture[]
): SportmonksFixture[] {
  if (head.length === 0) return filtered;
  const headIds = new Set(head.map((f) => f.id));
  return [...head, ...filtered.filter((f) => !headIds.has(f.id))];
}

// ─── Query key builder ───────────────────────────────────────────────────

function buildQueryKey(
  tournament: TournamentKey,
  timeFilter: TimeFilter,
  calendarDate: string | null,
  locale: string,
  /** DD-market-chips Phase 3：选中的国家 country_id（other tab 服务端过滤维度） */
  countryId: number | null = null,
  /** DD-market-chips Phase 3：选中的球队 team_id（worldcup tab 服务端过滤维度） */
  teamId: number | null = null
): unknown[] {
  // 选中维度纳入 key，使切换 chip 触发服务端重拉。
  return ["market-fixtures", tournament, timeFilter, calendarDate, locale, countryId, teamId];
}

// ─── Infinite query page fn builder ─────────────────────────────────────
// 两分支路由；所有分支统一吐 SportmonksFixture[] 单页，
// 由 getNextPageParam 决定是否继续翻页。
// - timeFilter === calendar → fixture_date 一次全返；pageParam > 1 返空让链终止
// - 默认（all / live / today / tomorrow）→ sports_all 真分页（每次一个 page）
//   BUG-071 方案A：today/tomorrow 与 all 共用 sports_all，本地分桶视图由 TimelineMatchList 第1层负责

export interface InfinitePageContext {
  /** 当前分支的单页最大上限：用于 getNextPageParam 终止判定 */
  maxPages: number;
  /** 分页器：给定 pageParam 返回单页 fixtures */
  fetchPage: (pageParam: number) => Promise<SportmonksFixture[]>;
}

/**
 * 导出供单测使用（不建议业务消费）。
 * 两分支契约（BUG-071 方案A 后）：
 * - timeFilter === calendar → maxPages=1；pageParam=1 走 fixture_date 一次全返；pageParam>1 返 []
 * - 默认（all / live / today / tomorrow）→ maxPages=20(WC/UCL) / 40(Other)；pageParam 映射 sports_all?page=N
 */
export function buildInfinitePageContext(
  tournament: TournamentKey,
  timeFilter: TimeFilter,
  calendarDate: string | null,
  locale: string,
  /** DD-market-chips Phase 3：sports_all 分支注入服务端过滤维度 */
  selectedTeamFilter: number | null = null,
  selectedLeagueCountryId: number | null = null
): InfinitePageContext {
  const config = getTournamentConfig(tournament);
  const leagueParam = config.leagueId;
  const isOther = config.leagueId === 0;
  const maxPages = isOther ? OTHER_MAX_PAGES : DEFAULT_MAX_PAGES;
  const langParam = locale;

  // 分支 1：calendar（任意日期选择）→ fixture_date 一次全返。
  // BUG-071 方案A：today/tomorrow **不再**走 fixture_date —— 单 UTC date 查询与本地显示口径
  // 错位（本地一天横跨 2 个 UTC 日，既多查本地次日凌晨、又漏本地今天凌晨）。改为退化成
  // sports_all 全量 + TimelineMatchList 本地分桶视图（下方第 2 分支 + 第 1 层 dayKey）。
  // ⚠️ calendar 目前 UI 禁用（LeagueChips:179 不可点、setCalendarDate 无调用方）。重新启用时
  //    按 BD-071 §10 A2：拉覆盖目标本地日的相邻 2 个 UTC date（D 与 D±1）合并 + dayKey 客户端过滤。
  if (timeFilter === "calendar") {
    return {
      maxPages: 1,
      fetchPage: async (pageParam: number) => {
        if (pageParam !== 1 || !calendarDate) return [];
        // fixture_date 接口不支持 league 参数（sports_all 才支持），
        // 需客户端按 league_id 过滤；leagueId=0 为 Other Tab，不过滤。
        const fixtures = await getMarketFixturesByDate(calendarDate, {
          ...(langParam ? { app_lang: langParam, locale: langParam } : {}),
        });
        return leagueParam > 0 ? fixtures.filter((f) => f.league_id === leagueParam) : fixtures;
      },
    };
  }

  // 分支 2：默认 sports_all 真分页
  // DD-market-chips Phase 3：选中 chip 后由后端过滤（worldcup→team_id，other→league_country_id），
  // 替代旧的客户端分页窗口过滤，消除「chip 全量、过滤窗口为空」回归。
  const baseParams = {
    league: leagueParam,
    ...(timeFilter === "live" ? { type: "live" as const } : {}),
    ...(langParam ? { app_lang: langParam, locale: langParam } : {}),
    ...(!isOther && selectedTeamFilter != null ? { team_id: selectedTeamFilter } : {}),
    ...(isOther && selectedLeagueCountryId != null
      ? { league_country_id: selectedLeagueCountryId }
      : {}),
  };
  return {
    maxPages,
    fetchPage: (pageParam: number) => getMarketFixtures({ ...baseParams, page: pageParam }),
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useMarketData(options: UseMarketDataOptions): UseMarketDataResult {
  const {
    tournament,
    timeFilter,
    calendarDate,
    selectedLeagueCountryId = null,
    selectedTeamFilter = null,
  } = options;
  const locale = useLocale();
  return useMarketDataInfinite({
    tournament,
    timeFilter,
    calendarDate,
    selectedLeagueCountryId,
    selectedTeamFilter,
    locale,
  });
}

// ─── Internal ────────────────────────────────────────────────────────────

interface InternalOptions {
  tournament: TournamentKey;
  timeFilter: TimeFilter;
  calendarDate: string | null;
  selectedLeagueCountryId: number | null;
  selectedTeamFilter: number | null;
  locale: string;
}

function useMarketDataInfinite(opts: InternalOptions): UseMarketDataResult {
  const {
    tournament,
    timeFilter,
    calendarDate,
    selectedLeagueCountryId,
    selectedTeamFilter,
    locale,
  } = opts;
  const queryClient = useQueryClient();

  // DD-market-chips Phase 3：选中维度纳入 key，切换 chip 触发服务端重拉。
  const queryKey = useMemo(
    () =>
      buildQueryKey(
        tournament,
        timeFilter,
        calendarDate,
        locale,
        selectedLeagueCountryId,
        selectedTeamFilter
      ),
    [tournament, timeFilter, calendarDate, locale, selectedLeagueCountryId, selectedTeamFilter]
  );

  const pageCtx = useMemo(
    () =>
      buildInfinitePageContext(
        tournament,
        timeFilter,
        calendarDate,
        locale,
        selectedTeamFilter,
        selectedLeagueCountryId
      ),
    [tournament, timeFilter, calendarDate, locale, selectedTeamFilter, selectedLeagueCountryId]
  );

  // B1.6：用 ref 持有最新 fetchPage，避免 setInterval 闭包陈旧
  const fetchPageRef = useRef(pageCtx.fetchPage);
  fetchPageRef.current = pageCtx.fetchPage;

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey,
      queryFn: ({ pageParam }) => pageCtx.fetchPage(pageParam as number),
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) =>
        getNextPageParam(
          lastPage as SportmonksFixture[],
          allPages as SportmonksFixture[][],
          pageCtx.maxPages
        ),
      staleTime: 30_000,
      // B1.6：原生 refetchInterval 会重拉全部已加载页（反向放大），
      // 改由下方 useEffect + queryClient.fetchQuery 单页刷新
      refetchInterval: false,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
      retry: shouldRetry,
    });

  // B1.6（原）：live / all 模式下每 30s 单页刷新 page[0]，不重拉全部已加载页
  // ENH-031 B1.6（新）：visibility 守卫 —— 后台 tab 暂停 30s 轮询，可见后立即刷新一次再恢复
  // 行为对齐：TanStack Query `refetchIntervalInBackground: false` 的默认语义
  useEffect(() => {
    if (timeFilter !== "live" && timeFilter !== "all") return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const refreshPage1 = async () => {
      try {
        // 独立 queryKey 的 fetchQuery 仅走 HTTP，不污染主 infinite cache
        const fresh = await queryClient.fetchQuery({
          queryKey: [...queryKey, "refresh-page-1"],
          queryFn: () => fetchPageRef.current(1),
          staleTime: 0,
        });
        queryClient.setQueryData<InfiniteData<SportmonksFixture[], number>>(queryKey, (old) => {
          if (!old || old.pageParams[0] !== 1) return old;
          return { ...old, pages: [fresh, ...old.pages.slice(1)] };
        });
      } catch (e) {
        console.error("[useMarketData] Page 1 refresh failed", e);
      }
    };

    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(refreshPage1, 30_000);
    };
    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // 切回前台：立即拉一次 + 恢复定时器
        void refreshPage1();
        start();
      } else {
        // 切到后台：暂停定时器
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  }, [timeFilter, queryKey, queryClient]);

  const allFixtures = useMemo<SportmonksFixture[]>(
    () => (data?.pages.flat() as SportmonksFixture[] | undefined) ?? [],
    [data]
  );

  // 世界杯 tab 注入测试比赛（99200001）作为列表首项。UCL tab 下线后保留这条用于演示。
  const { data: testFixture } = useQuery({
    queryKey: ["market-fixture-test", INJECTED_TEST_FIXTURE_ID, locale],
    queryFn: () =>
      getMarketFixtureDetail(INJECTED_TEST_FIXTURE_ID, "preview", { locale }).then(
        (arr) => arr?.[0] ?? null
      ),
    enabled: tournament === "worldcup",
    staleTime: 60_000,
    retry: 1,
  });

  // DD-138：链上测试赛事注入（worldcup + other 两个 tab 都置顶展示）。
  // 每 10 分钟一轮滚动，30s 轮询保活轮次切换；v5 默认后台 tab 暂停轮询，
  // hook 卸载即停。失败 / 空数组静默降级（活动窗口外接口返回空属预期）。
  // 置顶渲染由 TimelineMatchList 的 pinned 分区负责（partition 不保数组序）。
  const { data: onchainTestFixtures } = useQuery({
    queryKey: ["onchain-test-fixtures", locale],
    queryFn: () => getOnchainTestFixtures({ locale }).then(remapOnchainTestOddsIds),
    refetchInterval: 30_000,
    // staleTime 对齐 refetchInterval：否则 15s 变 stale 会触发额外 refetch，请求频率翻倍
    staleTime: 30_000,
    retry: 1,
  });

  // DD-market-chips §5.2：chip 列表由后端 market_chips 提供。
  // key 仅含 tournament/timeFilter/locale（不含选中过滤）—— chip 列表不随选中变；
  // 不继承 list 的 30s 轮询（staleTime 长、refetchInterval 关）。
  const config = getTournamentConfig(tournament);
  const { data: chipData } = useQuery({
    queryKey: ["market-chips", tournament, timeFilter, locale],
    queryFn: () =>
      getMarketChips({
        league: config.leagueId,
        ...(timeFilter === "live" ? { type: "live" } : {}),
        ...(locale ? { app_lang: locale, locale } : {}),
      }),
    staleTime: 5 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: shouldRetry,
  });

  const teams = useMemo<TeamOption[]>(
    () =>
      (chipData?.teams ?? []).map((t) => ({
        team_id: t.team_id,
        name: t.name,
        logo: t.logo,
        count: t.count,
      })),
    [chipData]
  );

  const leagueCountries = useMemo<LeagueCountryOption[]>(
    () =>
      (chipData?.league_countries ?? []).map((c) => ({
        countryId: c.country_id,
        name: c.name,
        imagePath: c.image_path,
        count: c.count,
        leagueIds: c.league_ids,
      })),
    [chipData]
  );

  const fixtures = useMemo(() => {
    // DD-market-chips Phase 3：sports_all 分支的 team/country 过滤已下沉后端
    // （由 buildInfinitePageContext 注入 team_id / league_country_id），此处不再客户端过滤。
    // BUG-071 方案A：today/tomorrow 已并入 sports_all（服务端 league_country_id 过滤），
    // 仅剩 calendar 走 fixture_date（后端不支持 league_country_id），须保留客户端国家过滤
    // （match f.league.country_id）；避免对 sports_all 重复过滤（服务端已滤 + 客户端窗口为空回归）。
    const isCalendarBranch = timeFilter === "calendar";
    const filtered =
      isCalendarBranch && selectedLeagueCountryId != null
        ? allFixtures.filter((f) => f.league?.country_id === selectedLeagueCountryId)
        : allFixtures;
    // 注入头部（DD-138）：[链上测试赛事 ×2（两 tab 都注入）, 旧演示赛事 99200001（仅 worldcup）]
    const head: SportmonksFixture[] = [
      ...(onchainTestFixtures ?? []),
      ...(tournament === "worldcup" && testFixture ? [testFixture] : []),
    ];
    return injectHeadFixtures(filtered, head);
  }, [
    allFixtures,
    tournament,
    testFixture,
    onchainTestFixtures,
    timeFilter,
    selectedLeagueCountryId,
  ]);

  return {
    fixtures,
    isLoading,
    isError,
    teams,
    leagueCountries,
    fetchNextPage: () => {
      void fetchNextPage();
    },
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
  };
}
