"use client";

/**
 * MoneylinePanel — Moneyline 趋势图完整 panel（DD-102 Part 1）。
 *
 * Figma 节点：5107:182615
 * 结构：MoneylineHeader + MoneylineChart + MoneylineTeaser
 *
 * 数据来源：
 *   - 队伍标志 / 名称 / short code → 来自真实 SportmonksFixture.participants
 *   - 趋势百分比 → 真实接口（GET /api/v1/moneyline/history/{fixtureId}）
 *                  由父组件 useMoneylineHistory 拉取后透传 trend prop；
 *                  父组件按数据状态决定 渲染 Panel / Skeleton / 不渲染
 *   - Teaser stats → 仍走 mock（AI 文案统计，独立于历史曲线接口）
 *
 * 视觉规范：背景 #111114，圆角 14px，**无外边框**。
 */

import type { SportmonksFixture } from "@/types/api";
import type { MoneylineTrend } from "@/types/moneyline";
import MoneylineHeader from "@/components/match-detail/moneyline/MoneylineHeader";
import MoneylineChart from "@/components/match-detail/moneyline/MoneylineChart";
import MoneylineTeaser from "@/components/match-detail/moneyline/MoneylineTeaser";
import { teaserStatsMock } from "@/lib/moneyline-teaser";

// @figma-hardcoded: #e2b900 home-moneyline-color — pending design token
const HOME_COLOR = "#e2b900";
// @figma-hardcoded: #8b8d93 draw-moneyline-color — matches text/secondary token
const DRAW_COLOR = "#8b8d93";
// @figma-hardcoded: #02aee5 away-moneyline-color — pending design token
const AWAY_COLOR = "#02aee5";

function latestPct(points: { value: number }[]): number {
  return points.at(-1)?.value ?? 0;
}

function getParticipant(fixture: SportmonksFixture, location: "home" | "away") {
  return fixture.participants.find((p) => p.meta.location === location);
}

interface Props {
  fixture: SportmonksFixture;
  /** Moneyline 三方时序数据；由父组件 useMoneylineHistory 提供 */
  trend: MoneylineTrend;
}

export default function MoneylinePanel({ fixture, trend }: Props) {
  const home = getParticipant(fixture, "home");
  const away = getParticipant(fixture, "away");

  const homeName = home?.name ?? "Home";
  const awayName = away?.name ?? "Away";
  const homeShortCode = home?.short_code ?? "HOM";
  const awayShortCode = away?.short_code ?? "AWA";

  const homePct = latestPct(trend.home);
  const drawPct = latestPct(trend.draw);
  const awayPct = latestPct(trend.away);

  // Teaser stats 暂沿用 mock，但 teamCode 用真实主队 short_code
  const teaserStats = { ...teaserStatsMock, teamCode: homeShortCode };

  return (
    <div
      className="flex flex-col gap-4 p-4 rounded-[14px] overflow-hidden"
      // @figma-hardcoded: #111114 moneyline-panel-bg — pending design token
      style={{ backgroundColor: "#111114" }}
      data-figma-node="5107:182615"
    >
      <MoneylineHeader
        homeName={homeName}
        awayName={awayName}
        homeShortCode={homeShortCode}
        awayShortCode={awayShortCode}
        homeLogo={home?.image_path}
        awayLogo={away?.image_path}
        homePct={homePct}
        drawPct={drawPct}
        awayPct={awayPct}
        homeColor={HOME_COLOR}
        drawColor={DRAW_COLOR}
        awayColor={AWAY_COLOR}
      />

      {/* 通栏折线：抵消 panel 的 p-4 让 chart 占满宽度，提升信息密度。
          key={fixture.id}（ENH-031 B1.3 硬前置）：切赛事时强制 unmount 旧 chart 实例 +
          重新 mount 新实例，避免 lightweight-charts 闭包持续指向已销毁的旧 series。 */}
      <div className="mx-[-16px]">
        <MoneylineChart
          key={fixture.id}
          trend={trend}
          height={160}
          homeColor={HOME_COLOR}
          drawColor={DRAW_COLOR}
          awayColor={AWAY_COLOR}
          homeName={homeName}
          awayName={awayName}
        />
      </div>

      <MoneylineTeaser stats={teaserStats} />
    </div>
  );
}

/**
 * MoneylinePanelSkeleton — Loading 占位，复用 Panel 背景 + 圆角，保持布局稳定避免折叠跳变。
 * 与 Panel 同高（~280px）：header 36px + chart 160px + teaser 60px + padding。
 */
export function MoneylinePanelSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 p-4 rounded-[14px] overflow-hidden"
      // @figma-hardcoded: #111114 moneyline-panel-bg — pending design token
      style={{ backgroundColor: "#111114" }}
      aria-busy="true"
      aria-label="Loading moneyline trend"
    >
      <div className="h-[36px] bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
      <div className="h-[160px] bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
      <div className="h-[44px] bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
    </div>
  );
}
