"use client";

/**
 * FixtureDetailClient — Figma 6090:59808 赛事详情页
 *
 * 布局（PC）：左栏下注区（Figma 6096:57093）+ 右栏详情区（Part 1 Moneyline + Part 2 Overview）
 * - 左栏：返回按钮 + 比赛 header 卡（队徽 vs 队徽 + 日期）+ MatchBettingMarkets（1x2/Asian Handicap/Asian Total）
 * - 右栏：MatchDetailColumn 隐藏 title 头与 Part 3，留 Part 1 + Part 2
 *
 * H5：纵向堆叠 — 左栏在上、右栏在下。
 */

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { getMarketFixtureDetail } from "@/lib/api";
import type { SportmonksFixture } from "@/types/api";
import { formatMatchDate, formatMatchTime } from "@/lib/format-utils";
import MatchDetailColumn from "@/components/match-detail/MatchDetailColumn";
import MatchBettingMarkets from "@/components/match-detail/MatchBettingMarkets";
import LiveStreamSection from "@/components/match-detail/live-stream/LiveStreamSection";
import { useBetSlipStore } from "@/stores/betSlipStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import BetSlipPanel from "@/app/[locale]/markets/BetSlipPanel";

function DetailSkeleton() {
  return (
    <div className="lg:flex lg:gap-6 p-4 lg:p-6">
      <div className="flex-1 flex flex-col gap-4">
        <div className="h-[40px] w-[40px] rounded-8 bg-white/10 animate-pulse" />
        <div className="h-[157px] rounded-16 bg-secondary border border-DEFAULT animate-pulse" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[120px] rounded-16 bg-secondary border border-DEFAULT animate-pulse"
          />
        ))}
      </div>
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col gap-4">
        <div className="h-[276px] rounded-16 bg-secondary animate-pulse" />
        <div className="h-[683px] rounded-16 bg-secondary animate-pulse" />
      </div>
    </div>
  );
}

/** 左栏顶部比赛 header 卡片 — Figma 6123:84184 */
function FixtureHeaderCard({ fixture, locale }: { fixture: SportmonksFixture; locale: string }) {
  const home = fixture.participants.find((p) => p.meta.location === "home");
  const away = fixture.participants.find((p) => p.meta.location === "away");
  const dateLine = `${formatMatchDate(fixture.starting_at, locale)}, ${formatMatchTime(fixture.starting_at, locale)}`;

  return (
    <div className="bg-secondary rounded-16 px-4 py-6 flex flex-col items-center gap-[24px]">
      <span className="text-[12px] leading-[18px] text-secondary">{dateLine}</span>
      <div className="flex items-center justify-center gap-[40px]">
        {/* Home */}
        <div className="flex flex-col items-center gap-[9px] w-[102px]">
          <div className="size-[48px] rounded-full overflow-hidden bg-white/5 flex items-center justify-center">
            {home?.image_path && (
              <Image
                src={home.image_path}
                alt={home.name}
                width={43}
                height={43}
                className="object-contain"
              />
            )}
          </div>
          <span className="text-[12px] leading-[18px] text-primary text-center truncate w-full">
            {home?.name ?? "—"}
          </span>
        </div>
        {/* VS — Figma 6123:85251 自定义图标 */}
        <Image
          src="/images/match-detail/vs.svg"
          alt="VS"
          width={54}
          height={54}
          className="shrink-0"
          unoptimized
        />
        {/* Away */}
        <div className="flex flex-col items-center gap-[9px] w-[102px]">
          <div className="size-[48px] rounded-full overflow-hidden bg-white/5 flex items-center justify-center">
            {away?.image_path && (
              <Image
                src={away.image_path}
                alt={away.name}
                width={43}
                height={43}
                className="object-contain"
              />
            )}
          </div>
          <span className="text-[12px] leading-[18px] text-primary text-center truncate w-full">
            {away?.name ?? "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface FixtureDetailClientProps {
  fixtureId: number;
}

export default function FixtureDetailClient({ fixtureId }: FixtureDetailClientProps) {
  const locale = useLocale();
  const t = useTranslations("markets");
  const router = useRouter();
  // BetSlip 显隐：根据 store.isOpen 自动控制（选中任意赔率自动开启）
  const betSlipOpen = useBetSlipStore((s) => s.isOpen && s.selections.length > 0);
  // DD-126：直播卡片 PC 放右栏 Moneyline 下方、H5 放左栏对决卡片下方。
  // 用断点分流互斥挂载，保证只渲染一个 iframe（同 queryKey 亦由 React Query 去重）。
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const {
    data: fixture,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["market-fixture", fixtureId, locale],
    queryFn: () => getMarketFixtureDetail(fixtureId, "statis", { locale }).then((arr) => arr?.[0]),
    enabled: !isNaN(fixtureId),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  if (isLoading) return <DetailSkeleton />;

  if (isError || !fixture) {
    return (
      <div className="max-w-3xl mx-auto p-4 lg:p-6">
        <div className="rounded-8 px-6 py-10 text-center text-secondary text-sm bg-secondary border border-secondary">
          {t("loadError")}
        </div>
      </div>
    );
  }

  // PC 三栏独立滚动：父级由 markets layout 提供 lg:h-full + lg:overflow-y-hidden 的视口高度容器，
  // 此处用 lg:h-full + 各列 lg:overflow-y-auto 让 左栏 / 详情列 / BetSlip 互不联动滚动。
  // H5 保持纵向堆叠 + 页面整体滚动，不引入子滚动容器。
  return (
    <div className="lg:flex lg:gap-6 lg:px-6 lg:py-6 lg:h-full lg:min-h-0 px-4 py-4">
      {/* 左栏：下注区 */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 lg:h-full lg:overflow-y-auto lg:min-h-0 lg:pr-1">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center size-[40px] rounded-8 bg-secondary hover:bg-fill-hover transition-colors min-h-[40px] min-w-[40px] cursor-pointer touch-manipulation"
          aria-label="Back"
        >
          <ArrowLeftIcon size={20} weight="bold" className="text-primary" />
        </button>
        <FixtureHeaderCard fixture={fixture} locale={locale} />
        {/* DD-126 H5：直播卡片在对决卡片下、赔率卡片上（仅移动端，PC 走右栏） */}
        {!isDesktop && (
          <LiveStreamSection
            fixtureId={fixture.id}
            startingAtTimestamp={fixture.starting_at_timestamp}
          />
        )}
        <MatchBettingMarkets fixture={fixture} locale={locale} />
      </div>

      {/* 中栏：Part 1 Moneyline + Part 2 Overview（无 title 头、无 Part 3） */}
      <div className="hidden lg:block w-[420px] shrink-0 lg:h-full lg:overflow-y-auto lg:min-h-0 lg:pr-1">
        <MatchDetailColumn
          fixture={fixture}
          locale={locale}
          fullPageHref={null}
          hideHeader
          hideBettingMarkets
          liveStreamSlot={
            isDesktop ? (
              <LiveStreamSection
                fixtureId={fixture.id}
                startingAtTimestamp={fixture.starting_at_timestamp}
              />
            ) : null
          }
        />
      </div>

      {/* BetSlip：选中赔率后自动弹出（独立滚动） */}
      {betSlipOpen && (
        <div className="hidden lg:block w-[440px] shrink-0 animate-slide-in-right lg:h-full lg:overflow-y-auto lg:min-h-0">
          <BetSlipPanel />
        </div>
      )}
    </div>
  );
}
