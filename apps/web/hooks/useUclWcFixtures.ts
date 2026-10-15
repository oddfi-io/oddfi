/**
 * useUclWcFixtures — DD-097 Batch 1
 *
 * ⛳ DD-097-FRONTEND-BFF：本 hook 是前端临时 BFF，后端 /v1/liquidity/featured-pools
 *    单接口就绪后整文件删除。grep `DD-097-FRONTEND-BFF` 一次性清理所有过渡代码。
 *
 * 一次性拉完 UCL (league=2) + 世界杯 (league=732) 全部页，合并 / 去重 /
 * 按 starting_at_timestamp 升序排序 / 客户端搜索（队名）。
 *
 * 设计取舍：
 * - 用 useQueries 静态发 24 个并发请求（2 联赛 × MAX_PAGES），
 *   TanStack Query 自动缓存 + 浏览器 HTTP/2 自动并发；空页早停未做
 *   （useQueries 静态化），靠 staleTime + 空数组合并兜底。
 * - 纯逻辑（合并 / 去重 / 排序 / 搜索）拆出 mergeAndDedupFixtures，
 *   方便单测，hook 本体只做 useQueries 编织。
 */
"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { getMarketFixtures } from "@/lib/api";
import type { SportmonksFixture } from "@/types/api";

const UCL_LEAGUE_ID = 2;
const WORLD_CUP_LEAGUE_ID = 732;
const MAX_PAGES = 12; // 单联赛 12 页 = 300 场，足够覆盖 UCL+WC 全季

/**
 * 比赛时长容错（秒）— 与 DD-097 §3.6 batch-open-pool 脚本 matchEndTime 计算口径一致：
 *   matchEndTime = starting_at_timestamp + 7200
 *
 * 用作"已完赛"过滤阈值：starting_at_timestamp + MATCH_DURATION_SEC <= now → 已完赛 → 不展示。
 */
const MATCH_DURATION_SEC = 7200;

/**
 * 后端 mock 测试 fixture 黑名单（用于演示 / 联调）。
 * 命中 ID 或 fixture.mock_activity 任一即视为测试场次，不展示给用户也不进运营脚本。
 */
const TEST_FIXTURE_IDS: ReadonlySet<number> = new Set([99200001]);

export interface UseUclWcFixturesOpts {
  /** 客户端模糊匹配队名（不区分大小写） */
  search?: string;
}

export interface UseUclWcFixturesResult {
  fixtures: SportmonksFixture[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * 合并多份 fixture 数组，按 fixture.id 去重，按 starting_at_timestamp 升序排序，
 * 可选客户端搜索（队名 includes，不区分大小写）。
 *
 * 导出供单测使用，业务侧请通过 useUclWcFixtures 消费。
 */
export function mergeAndDedupFixtures(
  pages: ReadonlyArray<SportmonksFixture[] | undefined>,
  search?: string
): SportmonksFixture[] {
  const all: SportmonksFixture[] = [];
  const seen = new Set<number>();
  for (const page of pages) {
    if (!page) continue;
    for (const f of page) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      all.push(f);
    }
  }
  all.sort((a, b) => a.starting_at_timestamp - b.starting_at_timestamp);

  const trimmed = search?.trim();
  if (!trimmed) return all;
  const q = trimmed.toLowerCase();
  return all.filter((f) => f.participants?.some((p) => p.name?.toLowerCase().includes(q)));
}

/**
 * 过滤已完赛 fixture（`starting_at_timestamp + 7200 <= nowSec`）。
 *
 * 「完赛」=「开赛 + 2h 容错」：保留 live match（进行中），仅过滤真正已结束的场次；
 * 与 DD-097 §3.6 batch-open-pool 脚本的 matchEndTime 口径完全一致。
 *
 * 导出供单测使用，业务侧请通过 useUclWcFixtures 消费。
 */
export function filterEndedFixtures(
  fixtures: SportmonksFixture[],
  nowSec: number
): SportmonksFixture[] {
  return fixtures.filter((f) => f.starting_at_timestamp + MATCH_DURATION_SEC > nowSec);
}

/**
 * 过滤后端 mock 测试 fixture（黑名单 ID 或 mock_activity 字段任一命中）。
 *
 * 后端会注入测试比赛用于 settlement / mock_activity 演示，这些场次
 * 不应进入流动性池 UI 也不应进入运营批量开池脚本。
 */
export function filterTestFixtures(fixtures: SportmonksFixture[]): SportmonksFixture[] {
  return fixtures.filter((f) => !TEST_FIXTURE_IDS.has(f.id) && !f.mock_activity);
}

export function useUclWcFixtures(opts: UseUclWcFixturesOpts = {}): UseUclWcFixturesResult {
  const { search } = opts;
  // 跟随 next-intl 全局 locale：中文环境拿中文队名/联赛名，英文环境拿英文。
  // queryKey 含 locale → 语言切换自动重拉，旧语种数据不复用。
  const locale = useLocale();

  const queries = useQueries({
    queries: [
      ...Array.from({ length: MAX_PAGES }, (_, i) => ({
        queryKey: ["ucl-wc-fixtures", UCL_LEAGUE_ID, i + 1, locale] as const,
        queryFn: () =>
          getMarketFixtures({
            league: UCL_LEAGUE_ID,
            page: i + 1,
            app_lang: locale,
            locale,
          }),
        staleTime: 60_000,
      })),
      ...Array.from({ length: MAX_PAGES }, (_, i) => ({
        queryKey: ["ucl-wc-fixtures", WORLD_CUP_LEAGUE_ID, i + 1, locale] as const,
        queryFn: () =>
          getMarketFixtures({
            league: WORLD_CUP_LEAGUE_ID,
            page: i + 1,
            app_lang: locale,
            locale,
          }),
        staleTime: 60_000,
      })),
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const fixtures = useMemo(
    () => {
      const merged = mergeAndDedupFixtures(
        queries.map((q) => q.data),
        search
      );
      const ongoing = filterEndedFixtures(merged, Math.floor(Date.now() / 1000));
      return filterTestFixtures(ongoing);
    },
    // queries 数组每次渲染都是新引用，但内部 data 引用在 staleTime 内稳定；
    // Date.now() 不进依赖：fixture 列表变更（每 60s staleTime）会触发重算，
    // 同一渲染批次内 nowSec 稳定即可，不需要每秒级精度刷新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...queries.map((q) => q.data), search]
  );

  return {
    fixtures,
    isLoading,
    isError,
    refetch: () => queries.forEach((q) => q.refetch()),
  };
}
