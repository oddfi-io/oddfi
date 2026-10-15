"use client";

/**
 * Calendar 页客户端编排器（DD-091 §3.1）。
 *
 * 三栏自适应：
 *   - default: 仅主网格
 *   - detail: 主网格 + 详情列
 *   - betslip-only: 主网格 + BetSlip
 *   - betslip: 主网格 + 详情列 + BetSlip
 *
 * 派生 layoutState 复用 marketsLayoutStore.useLayoutState（calendarStore.openMatch
 * 内部已同步到 marketsLayoutStore.selectFixture）。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCalendarTournament, useCalendarMatches } from "@/hooks/useCalendarData";
import { useCalendarActiveStage } from "@/hooks/useCalendarActiveStage";
import { useLayoutState } from "@/stores/marketsLayoutStore";
import { useCalendarStore, selectDateRange, selectOpenMatchId } from "@/stores/calendarStore";
import { useIsPhone } from "@/hooks/useIsPhone";
import { getStageId } from "@/lib/calendar/derivers";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import CalendarSectionBanner from "@/components/calendar/CalendarSectionBanner";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import CalendarGridHeader from "@/components/calendar/CalendarGridHeader";
import CalendarDetailPanelHost from "@/components/calendar/CalendarDetailPanelHost";
import ContentTypeTabs from "@/components/game-markets/ContentTypeTabs";
import CalendarSkeleton from "@/components/calendar/CalendarSkeleton";
import BetSlipPanel from "../BetSlipPanel";

export default function CalendarPageClient() {
  const t = useTranslations("calendarPage");
  const { data: tournament, isLoading: tLoading, isError: tError } = useCalendarTournament();
  const { data: matches, isLoading: mLoading, isError: mError } = useCalendarMatches();
  const layoutState = useLayoutState();
  const dateRange = useCalendarStore(selectDateRange);
  const openMatchId = useCalendarStore(selectOpenMatchId);
  const isPhone = useIsPhone();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const groupsInitialized = useRef(false);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  // ⚠️ Hooks 在所有早返回之前调用
  const stages = tournament?.stages ?? [];
  const dates = tournament?.dates ?? [];
  const groups = tournament?.groups ?? [];

  // tournament 加载完成后一次性初始化为全选（skeleton 期间 groups=[]，用户不可见）
  useEffect(() => {
    if (groups.length > 0 && !groupsInitialized.current) {
      groupsInitialized.current = true;
      setSelectedGroups([...groups]);
    }
  }, [groups]);

  // 应用 Date Range 过滤 → 仅保留区间内 match days；Banner 用全量 stages
  // 但传给 Grid 的 dates 是 filtered（X 轴列收窄）
  const filteredDates = useMemo(() => {
    if (!dateRange) return dates;
    return dates.filter((d) => d.date_iso >= dateRange.start && d.date_iso <= dateRange.end);
  }, [dates, dateRange]);

  // Mock group 映射：Group Stage 场次按 starting_at 排序后每 6 场归一组（A-L）
  const fixtureGroupMap = useMemo(() => {
    const allMatches = matches ?? [];
    const groupStage = allMatches
      .filter((f) => getStageId(f) === "group")
      .sort((a, b) => a.starting_at.localeCompare(b.starting_at));
    return new Map<number, string>(
      groupStage.map((f, i) => [f.id, groups[Math.floor(i / 6)] ?? ""])
    );
  }, [matches, groups]);

  // 按选中组过滤：
  //   全选（= groups.length）→ 全量（含 R32+ 非小组赛）
  //   全不选（= 0）→ 空结果（用户主动 uncheck All）
  //   部分选 → 仅保留命中组的 Group Stage 场次（R32+ 无 group，过滤掉）
  const displayedMatches = useMemo(() => {
    const allMatches = matches ?? [];
    if (selectedGroups.length === groups.length) return allMatches;
    if (selectedGroups.length === 0) return [];
    return allMatches.filter((f) => {
      const group = fixtureGroupMap.get(f.id);
      return group !== undefined && selectedGroups.includes(group);
    });
  }, [matches, selectedGroups, fixtureGroupMap, groups.length]);

  const { gridScrollRef, onStageSelect, scrollLeft } = useCalendarActiveStage(
    stages,
    filteredDates
  );

  // 单向同步：body 横向滚动 → header scrollLeft（header 不接受用户横向输入）
  // 依赖 tournament/matches：loading 期渲染 Skeleton 时 ref 为 null，数据就绪后
  // CalendarGrid/CalendarGridHeader 才挂载并填充 ref，此时 effect 重跑挂上 listener
  useEffect(() => {
    if (!tournament || !matches) return;
    const bodyEl = gridScrollRef.current;
    const headerEl = headerScrollRef.current;
    if (!bodyEl || !headerEl) return;
    const syncHeader = () => {
      headerEl.scrollLeft = bodyEl.scrollLeft;
    };
    bodyEl.addEventListener("scroll", syncHeader, { passive: true });
    return () => bodyEl.removeEventListener("scroll", syncHeader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament, matches]);

  if (tError || mError) {
    return (
      <div className="p-[24px] text-primary">
        <div className="rounded-12 bg-secondary px-[24px] py-[40px] text-center text-secondary text-[14px]">
          Failed to load Calendar data
        </div>
      </div>
    );
  }

  if (tLoading || mLoading || !tournament || !matches) {
    return <CalendarSkeleton />;
  }

  // H5 下无右侧栏（MobileBetSlipFAB 由 markets/layout.tsx 全局管理；详情由 router.push 跳转）
  // hasDetail 基于 calendar 自己的 openMatchId — 全局 layoutState=betslip 仅由其他页面的 selectFixture
  // 触发时不应让 calendar 拉出空 detail 列（视觉上是右侧 400px 黑区）
  const hasDetail = !isPhone && openMatchId !== null;
  const hasBetSlip = !isPhone && (layoutState === "betslip" || layoutState === "betslip-only");

  const gridCols =
    hasDetail && hasBetSlip
      ? "1fr 12px 400px 12px 376px"
      : hasDetail
        ? "1fr 12px 400px"
        : hasBetSlip
          ? "1fr 12px 376px"
          : "1fr";

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: gridCols }}>
      {/* 主网格区 */}
      <div className="flex flex-col gap-0 pb-[24px] min-w-0">
        {/* 吸顶上半：H5 二级导航 + title/chips/filters + SectionBanner + 日期轴 */}
        <div className="sticky top-[64px] lg:top-[100px] z-30 bg-primary flex flex-col gap-[16px] pb-[12px]">
          {/* H5 sport-type tab bar（Soccer / News / Calendar），PC 下隐藏 */}
          <div className="lg:hidden px-[16px] border-b border-divider-secondary">
            <ContentTypeTabs />
          </div>
          <CalendarHeader
            title={t("title")}
            stages={tournament.stages}
            windowStart={tournament.tournament_window.start}
            windowEnd={tournament.tournament_window.end}
            onStageSelect={onStageSelect}
            groups={groups}
            selectedGroups={selectedGroups}
            onGroupsChange={setSelectedGroups}
          />
          <div className="px-[24px]">
            <CalendarSectionBanner
              stages={tournament.stages}
              dates={filteredDates}
              scrollLeft={scrollLeft}
            />
          </div>
          <div className="px-[24px]">
            <CalendarGridHeader ref={headerScrollRef} dates={filteredDates} />
          </div>
        </div>

        {/* 可滚动下半：时间标签列 + 比赛行 */}
        <div className="px-[24px]">
          <CalendarGrid
            ref={gridScrollRef}
            dates={filteredDates}
            fixtures={displayedMatches}
            fixtureGroupMap={fixtureGroupMap}
          />
        </div>
      </div>

      {/* gap + 详情列 */}
      {hasDetail && (
        <>
          <div aria-hidden />
          <div className="overflow-y-auto py-[24px] pr-[12px]">
            <CalendarDetailPanelHost />
          </div>
        </>
      )}

      {/* gap + BetSlip */}
      {hasBetSlip && (
        <>
          <div aria-hidden />
          <div className="overflow-y-auto py-[24px] pr-[24px]">
            <BetSlipPanel />
          </div>
        </>
      )}
    </div>
  );
}
