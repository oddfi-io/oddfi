"use client";

/**
 * DD-102 · 详情列整体组装（Part 1 + Part 2 + Part 3）。
 *
 * 顶部 column header：fixture 名 + league + 全屏链接 + 关闭按钮（复用自 MatchDetailContent）。
 * 下方三段堆叠：
 *   Part 1: MoneylinePanel（趋势图）
 *   Part 2: MatchOverviewPanel（对决信息 · 可折叠 tabs）
 *   Part 3: MatchBettingMarkets（1x2 / 亚让 / 亚大小）
 *
 * 视口 fixed 折叠箭头 MatchOverviewToggle 控制 Part 2 tabs 区显示/隐藏。
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CornersOutIcon, XIcon } from "@phosphor-icons/react";
import type { SportmonksFixture } from "@/types/api";
import type { MatchTeam } from "@/types/match-detail-domain";
import { useMoneylineHistory } from "@/hooks/useMoneylineHistory";
import { getHomeAway } from "@/lib/calendar/derivers";
import { participantToMatchTeam } from "@/lib/match-utils";
import MoneylinePanel, { MoneylinePanelSkeleton } from "./MoneylinePanel";
import MatchOverviewPanel from "./MatchOverviewPanel";
import MatchBettingMarkets from "./MatchBettingMarkets";

interface Props {
  fixture: SportmonksFixture;
  locale: string;
  /** 关闭按钮回调（市场页 = closeDetail；全屏页传 undefined） */
  onClose?: () => void;
  /** 全屏链接；传 `null` 隐藏（全屏页本身） */
  fullPageHref?: string | null;
  /** 隐藏顶部列头（fixture name + maximize/close 按钮）— Figma 6090:59808 详情页右侧不展示标题 */
  hideHeader?: boolean;
  /** 隐藏 Part 3 下注盘 — Figma 6090:59808 详情页将下注盘放到左栏 */
  hideBettingMarkets?: boolean;
  /** 把整个详情列包裹在带边框的卡片里 — Figma 6123:92531 市场页详情列布局 */
  wrapInCard?: boolean;
  /** 隐藏 Part 1 Moneyline 趋势区 — Figma 6123:92531 市场页详情列不展示 */
  hidePart1?: boolean;
  /** Part 2 切紧凑双列排版（市场页详情列样式） */
  compactPart2?: boolean;
  /** DD-126：插在 Part 1 Moneyline 下方的直播卡片（PC 右栏）；H5 由 FixtureDetailClient 另渲染 */
  liveStreamSlot?: ReactNode;
  /** DD-126：市场页详情列在 MatchTimeline 下方展示直播（与 liveStreamSlot 的 Moneyline 下方位置互斥使用） */
  showLiveStreamBelowTimeline?: boolean;
}

export default function MatchDetailColumn({
  fixture,
  locale,
  onClose,
  fullPageHref,
  hideHeader = false,
  hideBettingMarkets = false,
  wrapInCard = false,
  hidePart1 = false,
  compactPart2 = false,
  liveStreamSlot,
  showLiveStreamBelowTimeline = false,
}: Props) {
  const t = useTranslations("markets");
  const [collapsed, setCollapsed] = useState(false);

  // Part 1 数据：真实历史曲线（后端 commit 0ffc071）。
  // 渲染策略：loading → skeleton；isError 或 trend===null（三方均空）→ 整个 Part 1 不渲染。
  const moneyline = useMoneylineHistory(fixture.id);

  // overview 接口失败时 OverviewHeader/MatchTimeline 仍需展示，从 fixture.participants 兜底构造 MatchTeam。
  // useMemo 依赖只取参与 MatchTeam 构造的 primitive 字段（id / name / short_code / image_path / 本侧 team_kits URL），
  // 避开 useQuery 15s 轮询每次返回新 participants 数组引用导致 React.memo 级联失效。
  const { home, away } = getHomeAway(fixture);
  const homeKitUrl = home?.team_kits?.find((k) => k.type === "home")?.url;
  const awayKitUrl = away?.team_kits?.find((k) => k.type === "away")?.url;
  const fixtureHomeTeam = useMemo<MatchTeam>(
    () => participantToMatchTeam(home, "home"),
    [home?.id, home?.name, home?.short_code, home?.image_path, homeKitUrl]
  );
  const fixtureAwayTeam = useMemo<MatchTeam>(
    () => participantToMatchTeam(away, "away"),
    [away?.id, away?.name, away?.short_code, away?.image_path, awayKitUrl]
  );

  const fixtureName = fixture.name;
  const resolvedFullPageHref =
    fullPageHref === null ? null : (fullPageHref ?? `/${locale}/markets/fixture/${fixture.id}`);

  // ENH-031 B2.3 配套：onToggle 必须 useCallback 才能让下方 MatchOverviewPanel 的 React.memo 命中
  const onToggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  let part1: ReactNode = null;
  if (!hidePart1) {
    if (moneyline.isLoading) {
      part1 = <MoneylinePanelSkeleton />;
    } else if (!moneyline.isError && moneyline.trend) {
      part1 = <MoneylinePanel fixture={fixture} trend={moneyline.trend} />;
    }
    // isError 或 trend===null → part1 维持 null（不渲染）
  }

  const panels = (
    <>
      {part1}
      {/* DD-126：直播卡片紧跟 Moneyline 下方（PC 右栏）。无直播时 slot 自身返回 null。 */}
      {liveStreamSlot}
      {/* DD-104 Batch 3：MatchOverviewPanel 内部拉取真实数据，不再接 overview prop。
          fixtureXxx 是 overview 接口失败时的兜底基础信息（OverviewHeader/MatchTimeline 始终展示）。 */}
      <MatchOverviewPanel
        fixtureId={fixture.id}
        locale={locale}
        stateId={moneyline.fixture?.state_id ?? undefined}
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
        compactBody={compactPart2}
        showLiveStream={showLiveStreamBelowTimeline}
        fixtureHomeTeam={fixtureHomeTeam}
        fixtureAwayTeam={fixtureAwayTeam}
        fixtureStartingAt={fixture.starting_at}
        fixtureStartingAtTimestamp={fixture.starting_at_timestamp}
      />
    </>
  );

  // 市场页：整体外边框 + 内边距（Figma 6123:92531 info-panel）
  //   border-radius: 16px / border: line/border-secondary (#212124) / bg: bg/primary (#04060E)
  const outerClass = wrapInCard
    ? "flex flex-col gap-[16px] rounded-[16px] border border-secondary bg-primary p-[16px]"
    : "flex flex-col gap-[16px]";

  return (
    <div className={outerClass}>
      {/* Column Header — 仅 fixture 名（league 不展示）+ 全屏 + 关闭（hideHeader 时跳过） */}
      {!hideHeader && (
        <div className="flex items-center justify-between gap-[12px]">
          <div className="min-w-0">
            <h2 className="text-[18px] leading-[26px] font-semibold text-primary truncate">
              {fixtureName}
            </h2>
          </div>
          <div className="shrink-0 flex items-center gap-[12px]">
            {resolvedFullPageHref && (
              <Link
                href={resolvedFullPageHref}
                className="flex items-center justify-center min-h-[44px] min-w-[20px]"
                title={t("openFullPage")}
              >
                <CornersOutIcon size={20} className="text-primary" />
              </Link>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center min-h-[44px] min-w-[20px]"
                aria-label="Close"
              >
                <XIcon size={20} className="text-primary" />
              </button>
            )}
          </div>
        </div>
      )}

      {panels}

      {!hideBettingMarkets && <MatchBettingMarkets fixture={fixture} locale={locale} />}
    </div>
  );
}
