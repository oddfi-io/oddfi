"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { OddsFilter } from "@/types/betting";
import type { SportmonksFixture } from "@/types/api";
import type { TimeFilter } from "@/stores/marketsLayoutStore";
import { useMarketsLayoutStore, selectSelectedTeamFilter } from "@/stores/marketsLayoutStore";
import { useLayoutState, selectSelectedFixtureId } from "@/stores/marketsLayoutStore";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { getDateFromBaseUTC } from "@/lib/date-utils";
import { dayKey, todayKey, getBrowserTimezone } from "@/lib/calendar/timezone";
import { resolveKickoffSeconds } from "@/lib/format-utils";
import { getFixtureStatus } from "@/lib/fixture-state";
import { isAnyTestFixture, isOnchainTestFixture } from "@/lib/betting/constants";
import MatchCard from "./MatchCard";
import DateSectionHeader from "./DateSectionHeader";
import DateGroupSection from "./DateGroupSection";
import { MatchCardSkeleton } from "./MatchList";

// ─── Pure helpers ────────────────────────────────────────────────────────

export interface PartitionResult {
  /**
   * 测试赛事统一分组（链上测试 99301/99302 + 演示测试 99200001）。
   * 不按时间分桶，统一收进「测试」折叠块，跨各 chips / 时间筛选恒定展示。
   */
  test: SportmonksFixture[];
  live: SportmonksFixture[];
  upcomingByDate: Map<string, SportmonksFixture[]>;
}

/**
 * Split fixtures into test (test/demo fixtures, never time-bucketed), live (sorted
 * by kickoff asc) and upcoming (grouped by **local** date asc). Finished fixtures are dropped.
 *
 * 测试赛事归类（用户需求 2026-06-15）：链上测试（`isOnchainTestFixture` 99301/99302 系，
 * state_id 恒为 1 且 starting_at 为封盘时间）+ 演示测试（`isTestFixtureId` 99200001）
 * **都不按时间分桶**，统一进 `test` 组，由「测试」折叠块渲染，跨各 chips 恒显示。
 * 否则它们会被埋进日期桶中部 / 随时间筛选时有时无。
 *
 * BUG-071：upcoming 分桶 key 改用 `dayKey(开赛 unix 秒, tz)`（目标时区本地运营日），
 * 替代裸切 `starting_at.slice(0,10)`（UTC 日历日）。卡片显示也走同 tz 同时刻源
 * （MatchCard 的 formatKickoffDisplay），分桶口径 === 显示口径，杜绝午夜边界错位。
 * `tz` 省略走浏览器本地时区；测试传固定 IANA（如 "UTC"）做确定性断言。
 *
 * 排序统一用开赛绝对时刻数值比（`resolveKickoffSeconds`），替换字符串 localeCompare
 * （SportMonks v3 偶发无 Z 后缀，裸字符串比较不确定 — REV-v1-A #N-1）。
 */
export function partitionFixtures(
  fixtures: SportmonksFixture[],
  tz: string = getBrowserTimezone()
): PartitionResult {
  const test: SportmonksFixture[] = [];
  const live: SportmonksFixture[] = [];
  const upcomingByDate = new Map<string, SportmonksFixture[]>();

  for (const f of fixtures) {
    // 测试赛事（链上测试 + 演示测试）统一进测试组，不参与 live / 日期分桶
    if (isAnyTestFixture(f.id)) {
      test.push(f);
      continue;
    }
    const status = getFixtureStatus(f.state_id);
    if (status === "live") {
      live.push(f);
    } else if (status === "upcoming") {
      // 本地运营日 key；时刻缺失/不可解析时兜底裸切 UTC 字符串，不让单条坏数据丢桶
      const date = dayKey(resolveKickoffSeconds(f), tz) || f.starting_at.slice(0, 10);
      const bucket = upcomingByDate.get(date);
      if (bucket) {
        bucket.push(f);
      } else {
        upcomingByDate.set(date, [f]);
      }
    }
  }

  // 链上测试（活跃滚动）在前、演示测试在后；同类按 id 升序稳定（base 99301 先于 99302）
  test.sort((a, b) => {
    const ra = isOnchainTestFixture(a.id) ? 0 : 1;
    const rb = isOnchainTestFixture(b.id) ? 0 : 1;
    return ra - rb || a.id - b.id;
  });
  live.sort((a, b) => resolveKickoffSeconds(a) - resolveKickoffSeconds(b));

  // 桶内按开赛时刻升序；桶间按本地日 key（ISO 字符串排序 = 时序）升序
  for (const bucket of upcomingByDate.values()) {
    bucket.sort((a, b) => resolveKickoffSeconds(a) - resolveKickoffSeconds(b));
  }
  const sortedEntries = Array.from(upcomingByDate.entries()).sort(([a], [b]) => a.localeCompare(b));

  return { test, live, upcomingByDate: new Map(sortedEntries) };
}

// ─── Main ────────────────────────────────────────────────────────────────

interface TimelineMatchListProps {
  fixtures: SportmonksFixture[];
  locale: string;
  /** 当前时间筛选 tab；today/tomorrow 在方案 A 下退化为对 sports_all 的本地分桶视图（BUG-071 第2层） */
  timeFilter: TimeFilter;
  searchQuery?: string;
  oddsFilter?: OddsFilter;
  isError: boolean;
  isTripleOdds?: boolean;
  /** ENH-020 Phase 1 B1.4：无限滚动触底回调 */
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  /**
   * 内层滚动列的 ref（layoutState !== "default" 时），用作 IntersectionObserver.root。
   * 为 null / undefined 时回退到 viewport（与 H5 + default lg 场景匹配）。
   */
  scrollHostRef?: React.RefObject<HTMLElement | null>;
}

export default function TimelineMatchList({
  fixtures,
  locale,
  timeFilter,
  searchQuery,
  oddsFilter,
  isError,
  isTripleOdds,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  scrollHostRef,
}: TimelineMatchListProps) {
  const t = useTranslations("markets");
  const router = useRouter();
  const selectedTeamFilter = useMarketsLayoutStore(selectSelectedTeamFilter);
  const selectedFixtureId = useMarketsLayoutStore(selectSelectedFixtureId);
  const selectFixture = useMarketsLayoutStore((s) => s.selectFixture);
  const layoutState = useLayoutState();
  const mode = useResponsiveMode();

  // BUG-071：分桶 / 锚点 / 显示统一到浏览器本地时区（页面 ssr:false，可直接取）
  const tz = useMemo(() => getBrowserTimezone(), []);
  // 本地「今天」运营日；第3层活性：≤60s 低频 tick 比对，跨午夜才重算（休眠唤醒/改时区/NTP 校正都兜得住）
  const [today, setToday] = useState(() => todayKey(Date.now() / 1000, tz));
  useEffect(() => {
    const id = setInterval(() => {
      const k = todayKey(Date.now() / 1000, tz);
      setToday((prev) => (prev === k ? prev : k));
    }, 60_000);
    return () => clearInterval(id);
  }, [tz]);
  // 本地次日 / 后天：纯日历日字符串递增，不引时区漂移（仅服务 today/tomorrow 视图过滤与完整性判定）
  const tomorrow = useMemo(() => getDateFromBaseUTC(today, 1), [today]);

  const searchLower = searchQuery?.toLowerCase() ?? "";

  const filteredFixtures = useMemo(() => {
    let result = fixtures;
    // DD-market-chips：selectedTeamFilter 现为 team_id(number)。sports_all 分支已服务端过滤，
    // 此处过滤主要服务 fixture_date 分支（单页全返、无服务端 team 过滤）；按 participant id 匹配。
    if (selectedTeamFilter != null) {
      result = result.filter((f) => f.participants.some((p) => p.id === selectedTeamFilter));
    }
    if (searchLower) {
      result = result.filter((f) =>
        f.participants.some((p) => p.name.toLowerCase().includes(searchLower))
      );
    }
    return result;
  }, [fixtures, selectedTeamFilter, searchLower]);

  const { test, live, upcomingByDate } = useMemo(
    () => partitionFixtures(filteredFixtures, tz),
    [filteredFixtures, tz]
  );

  // 方案 A（BUG-071 第2层）：today/tomorrow tab 退化为 sports_all 全量的本地分桶视图，
  // 仅在客户端过滤出目标本地日桶（today→today 桶，tomorrow→次日桶），不再单独请求 fixture_date。
  const isBucketView = timeFilter === "today" || timeFilter === "tomorrow";
  const viewByDate = useMemo(() => {
    if (timeFilter === "today") {
      const b = upcomingByDate.get(today);
      return b ? new Map([[today, b]]) : new Map<string, SportmonksFixture[]>();
    }
    if (timeFilter === "tomorrow") {
      const b = upcomingByDate.get(tomorrow);
      return b ? new Map([[tomorrow, b]]) : new Map<string, SportmonksFixture[]>();
    }
    return upcomingByDate;
  }, [upcomingByDate, timeFilter, today, tomorrow]);
  // live 区属「今天」语义：today/all/live/calendar 显示；tomorrow 视图隐藏
  const showLive = timeFilter !== "tomorrow";

  // 方案 A 完整性兜底（REV-v1-A C-1 / REV-v1-B A1）：sports_all 按 starting_at 升序分页，
  // 目标本地日的赛事可能落在后续页（尤其 Other tab 赛事密集 / 历史 FT 占满首页）。
  // 自动 fetchNextPage 直到「已加载任一真实赛事的本地日 > 目标日（证明目标桶收齐）」或「流耗尽」。
  // 用原始 fixtures（非搜索过滤后），并剔除注入的测试赛事，避免其时刻误判完整。
  useEffect(() => {
    if (!isBucketView) return;
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;
    const targetKey = timeFilter === "today" ? today : tomorrow;
    const sawBeyondTarget = fixtures.some((f) => {
      if (isAnyTestFixture(f.id)) return false;
      const k = dayKey(resolveKickoffSeconds(f), tz);
      return k !== "" && k > targetKey;
    });
    if (!sawBeyondTarget) fetchNextPage();
  }, [
    isBucketView,
    timeFilter,
    today,
    tomorrow,
    tz,
    fixtures,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  ]);

  const isDefault = layoutState === "default";
  const buildGridStyle = (count: number) => ({
    gridTemplateColumns:
      isDefault && count > 1
        ? isTripleOdds
          ? mode === "ultra"
            ? "repeat(auto-fill, minmax(min(100%, 680px), 1fr))"
            : "repeat(2, minmax(0, 1fr))"
          : "repeat(auto-fill, minmax(min(100%, 480px), 1fr))"
        : "minmax(0, 1fr)",
  });
  const liveGridStyle = buildGridStyle(live.length);
  // Skeleton while fetching next page — assume multi-card layout
  const skeletonGridStyle = buildGridStyle(2);

  // ─── Sentinel + IntersectionObserver (ENH-020 B1.4) ───────────────────
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    if (!fetchNextPage || !hasNextPage) return;
    // BUG-071 REV-v2 M-1：today/tomorrow 视图下分页由 C-1 完整性 useEffect 独占驱动，
    // 触底 sentinel 在此场景关闭——既避免双触发 fetchNextPage 竞态，也避免为「只显示一天」的视图
    // 过度预拉用户看不到的后续日页。
    if (isBucketView) return;

    // layoutState default → viewport root；其它 → 内层列表列
    const root = isDefault ? null : (scrollHostRef?.current ?? null);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fetchNextPage();
            break;
          }
        }
      },
      { root, rootMargin: "400px 0px", threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isDefault, scrollHostRef, isBucketView]);

  const hasAny = test.length > 0 || (showLive && live.length > 0) || viewByDate.size > 0;
  if (!hasAny && !isError) {
    return (
      <div className="bg-secondary rounded-16 px-6 py-10 text-center text-secondary text-sm border border-transparent">
        {t("noMatches")}
      </div>
    );
  }

  const handleLiveCardClick = (fixtureId: number) => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      selectFixture(fixtureId);
    } else {
      router.push(`/${locale}/markets/fixture/${fixtureId}`);
    }
  };

  return (
    <div className="space-y-1 isolate">
      {/* 测试赛事统一折叠块（顶部·默认展开）：链上测试 + 演示测试，不按时间分桶，跨各 chips 恒显示 */}
      {test.length > 0 && (
        <DateGroupSection
          label={t("testGroup")}
          fixtures={test}
          locale={locale}
          oddsFilter={oddsFilter}
          isTripleOdds={isTripleOdds}
        />
      )}
      {showLive && live.length > 0 && (
        <section>
          <DateSectionHeader date="live" today={today} isLive />
          <div className="grid gap-[16px] mt-1" style={liveGridStyle}>
            {live.map((fixture, index) => (
              <div
                key={fixture.id}
                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}
              >
                <MatchCard
                  fixture={fixture}
                  locale={locale}
                  isSelected={fixture.id === selectedFixtureId}
                  compact={mode === "standard" && layoutState === "betslip"}
                  tripleOdds={isTripleOdds}
                  oddsFilter={oddsFilter}
                  priorityImages={index === 0}
                  onClick={() => handleLiveCardClick(fixture.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}
      {Array.from(viewByDate.entries()).map(([date, dateFixtures]) => (
        <DateGroupSection
          key={date}
          date={date}
          today={today}
          fixtures={dateFixtures}
          locale={locale}
          oddsFilter={oddsFilter}
          isTripleOdds={isTripleOdds}
        />
      ))}
      {isFetchingNextPage && (
        <div className="grid gap-[16px] mt-1" style={skeletonGridStyle}>
          {[0, 1, 2].map((i) => (
            <MatchCardSkeleton key={`enh020-loadmore-${i}`} />
          ))}
        </div>
      )}
      {/* ENH-020 B1.4：触底哨兵（viewport 或 innerScrollRef 作 root） */}
      {/* BUG-071 M-1：bucket view 不挂触底 sentinel，分页由 C-1 完整性 useEffect 独占 */}
      {!isBucketView && hasNextPage && (
        <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      )}
    </div>
  );
}
