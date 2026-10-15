"use client";

/**
 * 详情列纯展示组件（DD-091 §3.4 抽离）。
 *
 * 与 MatchDetailPanel 的差异：
 *   - MatchDetailPanel 内置 useQuery（市场页用，含 refetchInterval=15s）
 *   - MatchDetailContent **零数据获取**，接受外部传入的 fixture
 *
 * 使用场景：
 *   - 市场页：MatchDetailPanel 包 useQuery 后渲染 MatchDetailContent
 *   - Calendar 页：直接 <MatchDetailContent fixture={mockFixture} />，无 useQuery / refetch
 *
 * 行为约束：渲染层 100% 与原 MatchDetailPanel 一致，不做视觉/语义调整。
 */
import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CornersOutIcon, CaretUpIcon, XIcon } from "@phosphor-icons/react";
import SportIcon from "@/components/ui/SportIcon";
import type { SportmonksFixture, SportmonksOddsEntry, SportmonksStatistic } from "@/types/api";
import type { BetSelection } from "@/types/betting";
import { useBetSlipStore, selectIsSelected } from "@/stores/betSlipStore";
import { parseOddsLines } from "@/lib/parse-odds-lines";
import {
  flashOddsBtn,
  flyChipToPanel,
  isPcRapidAdd,
  shakePanel,
  scrollToNewest,
} from "@/lib/betslip-animations-pc";
import { formatMatchDate, formatMatchTime } from "@/lib/format-utils";
import { makeSelectionId } from "@/lib/selection-id";
import { formatOdds } from "@/lib/odds";

// ─── Helpers ───────────────────────────────────────────────────────────────

function getTeam(fixture: SportmonksFixture, location: "home" | "away") {
  return fixture.participants.find((p) => p.meta.location === location);
}

// SportMonks stat type_ids
const STAT_SHOTS_ON_TARGET = 34;
const STAT_CORNERS = 41;
const STAT_YELLOW_CARDS = 84;
const STAT_RED_CARDS = 85;

export const STAT_CATEGORIES = [
  { typeId: STAT_SHOTS_ON_TARGET, key: "shots" },
  { typeId: STAT_YELLOW_CARDS, key: "yellowCards" },
  { typeId: STAT_RED_CARDS, key: "redCards" },
  { typeId: STAT_CORNERS, key: "corners" },
] as const;

export function getStatValue(
  statistics: SportmonksStatistic[] | undefined,
  typeId: number,
  location: "home" | "away"
): string {
  if (!statistics) return "-";
  const stat = statistics.find((s) => s.type_id === typeId && s.location === location);
  return stat ? String(stat.data?.value ?? 0) : "-";
}

// ─── Stat Icons (exported from Figma) ──────────────────────────────────────

export const STAT_ICONS: Record<string, { src: string; alt: string; size: string }> = {
  shots: { src: "/images/match-stats/goals.svg", alt: "Goals", size: "size-[20px]" },
  yellowCards: {
    src: "/images/match-stats/yellow-card.svg",
    alt: "Yellow cards",
    size: "size-[20px]",
  },
  redCards: { src: "/images/match-stats/red-card.svg", alt: "Red cards", size: "size-[20px]" },
  corners: { src: "/images/match-stats/corners.svg", alt: "Corners", size: "size-[16px]" },
};

// ─── Collapsible Market Section ────────────────────────────────────────────

function MarketSection({
  title,
  titleSize = "sm",
  defaultOpen = true,
  children,
}: {
  title: string;
  titleSize?: "sm" | "lg";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col overflow-hidden rounded-16">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="bg-secondary flex h-[48px] items-center justify-between px-[16px] w-full min-h-[44px]"
      >
        <span
          className={
            titleSize === "sm"
              ? "text-[14px] leading-[19px] font-semibold text-primary"
              : "text-[16px] leading-[24px] font-bold text-primary"
          }
        >
          {title}
        </span>
        <div className="size-[24px] rounded-8 bg-fill-input-modal flex items-center justify-center">
          <CaretUpIcon
            size={18}
            className={`text-primary transition-transform duration-200 ${open ? "" : "rotate-180"}`}
          />
        </div>
      </button>
      {open && <div className="bg-secondary w-full">{children}</div>}
    </div>
  );
}

// ─── Odds Button (connected to BetSlip store) ─────────────────────────────

function OddsBtn({
  label,
  handicap,
  odds,
  selectionId,
  onClick,
}: {
  label?: string;
  handicap?: string;
  odds: string;
  selectionId: string;
  onClick?: () => void;
}) {
  const isSelected = useBetSlipStore(selectIsSelected(selectionId));

  const handleClick = (e: React.MouseEvent) => {
    const btn = e.currentTarget;
    if (!isSelected && odds !== "—") {
      flashOddsBtn(btn);
      onClick?.();
      if (isPcRapidAdd()) {
        shakePanel();
      } else {
        flyChipToPanel(btn, odds);
      }
      scrollToNewest();
    } else {
      onClick?.();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`group flex flex-1 gap-[8px] h-[40px] items-center justify-center px-[12px] py-[8px] rounded-8 min-h-[44px] min-w-0 transition-colors
        ${
          isSelected
            ? "bg-fn-brand border border-fn-brand"
            : "bg-btn-secondary border border-transparent hover:bg-btn-secondary-hover"
        }`}
    >
      {label && (
        <span
          className={`text-[14px] leading-[19px] text-center truncate min-w-0 ${isSelected ? "text-static-black" : "text-primary"}`}
        >
          {label}
        </span>
      )}
      {handicap && (
        <span
          className={`text-[14px] leading-[19px] text-center whitespace-nowrap shrink-0 ${isSelected ? "text-static-black" : "text-primary"}`}
        >
          {handicap}
        </span>
      )}
      <span
        className={`text-[14px] leading-[19px] font-semibold whitespace-nowrap shrink-0 ${isSelected ? "text-static-black" : "text-brand-default"}`}
      >
        {odds}
      </span>
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export interface MatchDetailContentProps {
  fixture: SportmonksFixture;
  locale: string;
  /** 关闭按钮回调（市场页 = closeDetail；Calendar = closeMatch） */
  onClose?: () => void;
  /** 全屏链接，默认指向市场页 fixture path；Calendar 可关闭 */
  fullPageHref?: string | null;
}

export default function MatchDetailContent({
  fixture,
  locale,
  onClose,
  fullPageHref,
}: MatchDetailContentProps) {
  const t = useTranslations("markets");
  const toggleSelection = useBetSlipStore((s) => s.toggleSelection);

  const fixtureId = fixture.id;
  const home = getTeam(fixture, "home");
  const away = getTeam(fixture, "away");
  const homeName = home?.name ?? "—";
  const awayName = away?.name ?? "—";
  const fixtureName = fixture.name;
  const leagueName = fixture.league?.name ?? fixture.name ?? `Match #${fixture.id}`;

  // Odds — grouped by market
  const odds = fixture.odds ?? [];
  const homeEntry = odds.filter((o) => o.market_id === 1).find((o) => o.label === "Home");
  const drawEntry = odds.filter((o) => o.market_id === 1).find((o) => o.label === "Draw");
  const awayEntry = odds.filter((o) => o.market_id === 1).find((o) => o.label === "Away");

  const handicapLines = parseOddsLines(
    odds.filter((o) => o.market_id === 6),
    "asian_handicap"
  );
  const totalLines = parseOddsLines(
    odds.filter((o) => o.market_id === 7),
    "asian_total"
  );

  function make1x2Sel(
    entry: SportmonksOddsEntry | undefined,
    displayLabel: string
  ): BetSelection | null {
    if (!entry) return null;
    return {
      id: makeSelectionId(fixtureId, 1, entry.label),
      oddId: entry.id,
      fixtureId,
      fixtureName,
      leagueName,
      marketType: "1x2",
      marketDescription: entry.market_description,
      selection: entry.label,
      displayLabel,
      odds: entry.value,
    };
  }

  const homeSel = make1x2Sel(homeEntry, homeName);
  const drawSel = make1x2Sel(drawEntry, t("draw"));
  const awaySel = make1x2Sel(awayEntry, awayName);

  function makeLineSel(
    marketId: number,
    selection: string,
    displayLabel: string,
    oddsValue: string,
    lineValue: string,
    oddId: number,
    extra?: { handicap?: string; total?: string }
  ): BetSelection {
    return {
      id: makeSelectionId(fixtureId, marketId, selection, lineValue),
      oddId,
      fixtureId,
      fixtureName,
      leagueName,
      marketType: marketId === 6 ? "asian_handicap" : "asian_total",
      marketDescription: marketId === 6 ? t("asianHandicap") : t("asianTotal"),
      selection,
      displayLabel,
      odds: oddsValue,
      ...extra,
    };
  }

  // Match statistics from SportMonks API
  const stats = fixture.statistics;

  // 默认全屏链接指向市场页 fixture 详情；Calendar 显式传 null 隐藏
  const resolvedFullPageHref =
    fullPageHref === null ? null : (fullPageHref ?? `/${locale}/markets/fixture/${fixtureId}`);

  return (
    <div className="bg-primary border border-secondary rounded-16 px-[16px] py-[24px] flex flex-col gap-[24px]">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-[18px] leading-[26px] font-semibold text-primary truncate">
            {fixtureName}
          </h2>
          {fixture.league?.name && (
            <p className="text-[13px] leading-[18px] text-secondary truncate mt-[2px]">
              {fixture.league.name}
            </p>
          )}
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
            >
              <XIcon size={20} className="text-primary" />
            </button>
          )}
        </div>
      </div>

      {/* ── Match Banner ───────────────────────────────────────── */}
      <div className="h-[217px] rounded-12 overflow-hidden relative">
        {/* Background — soccer stadium image */}
        <div className="absolute inset-0">
          <Image
            src="/images/match-banner-bg.png"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 700px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[rgba(4,6,12,0.5)]" />
        </div>

        {/* Centered info card */}
        <div className="absolute inset-0 flex items-center justify-center p-[12px]">
          <div className="bg-[rgba(23,24,29,0.9)] border border-DEFAULT rounded-12 p-[24px] flex flex-col gap-[12px] max-w-full overflow-hidden">
            {/* Row 1: Date/Time + Stat category icons */}
            <div className="flex gap-[24px] items-center">
              <div className="flex gap-[8px] items-center w-[148px] text-[14px] leading-[19px] text-secondary whitespace-nowrap">
                <span>{formatMatchDate(fixture.starting_at, locale)}</span>
                <span>{formatMatchTime(fixture.starting_at, locale)}</span>
              </div>
              <div className="flex gap-[12px] items-center shrink-0">
                {STAT_CATEGORIES.map((cat) => {
                  const icon = STAT_ICONS[cat.key];
                  return (
                    <div key={cat.key} className="size-[20px] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={icon.src} alt={icon.alt} className={icon.size} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Home team + stats */}
            <div className="flex gap-[24px] items-center">
              <div className="flex gap-[8px] items-center w-[148px]">
                {home?.image_path && (
                  <SportIcon src={home.image_path} alt={homeName} size={24} withBg />
                )}
                <span className="text-[14px] leading-[19px] text-primary whitespace-nowrap truncate">
                  {homeName}
                </span>
              </div>
              <div className="flex gap-[12px] items-center shrink-0">
                {STAT_CATEGORIES.map((cat) => (
                  <div
                    key={cat.key}
                    className="size-[20px] flex items-center justify-center text-[14px] leading-[19px] text-primary"
                  >
                    {getStatValue(stats, cat.typeId, "home")}
                  </div>
                ))}
              </div>
            </div>

            {/* Row 3: Away team + stats */}
            <div className="flex gap-[24px] items-center">
              <div className="flex gap-[8px] items-center w-[148px]">
                {away?.image_path && (
                  <SportIcon src={away.image_path} alt={awayName} size={24} withBg />
                )}
                <span className="text-[14px] leading-[19px] text-primary whitespace-nowrap truncate">
                  {awayName}
                </span>
              </div>
              <div className="flex gap-[12px] items-center shrink-0">
                {STAT_CATEGORIES.map((cat) => (
                  <div
                    key={cat.key}
                    className="size-[20px] flex items-center justify-center text-[14px] leading-[19px] text-primary"
                  >
                    {getStatValue(stats, cat.typeId, "away")}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 1x2 ────────────────────────────────────────────────── */}
      <MarketSection title="1x2" titleSize="sm">
        <div className="flex gap-[16px] items-center p-[16px]">
          <OddsBtn
            label={homeName}
            odds={formatOdds(homeEntry?.value)}
            selectionId={makeSelectionId(fixtureId, 1, "Home")}
            onClick={() => homeSel && toggleSelection(homeSel)}
          />
          <OddsBtn
            label={t("draw")}
            odds={formatOdds(drawEntry?.value)}
            selectionId={makeSelectionId(fixtureId, 1, "Draw")}
            onClick={() => drawSel && toggleSelection(drawSel)}
          />
          <OddsBtn
            label={awayName}
            odds={formatOdds(awayEntry?.value)}
            selectionId={makeSelectionId(fixtureId, 1, "Away")}
            onClick={() => awaySel && toggleSelection(awaySel)}
          />
        </div>
      </MarketSection>

      {/* ── Asian Handicap ─────────────────────────────────────── */}
      {handicapLines.length > 0 && (
        <MarketSection title={t("asianHandicap")} titleSize="lg">
          <div className="flex flex-col gap-[8px] p-[24px]">
            {handicapLines.map((line) => {
              const hId = makeSelectionId(fixtureId, 6, "Home", line.lineValue);
              const aId = makeSelectionId(fixtureId, 6, "Away", line.lineValue);

              return (
                <div key={line.lineValue} className="flex gap-[16px] items-center">
                  <OddsBtn
                    label={homeName}
                    handicap={line.homeHandicap}
                    odds={line.homeOdds}
                    selectionId={hId}
                    onClick={() =>
                      line.homeOdds !== "—" &&
                      toggleSelection(
                        makeLineSel(
                          6,
                          "Home",
                          `${homeName} ${line.homeHandicap ?? line.lineValue}`,
                          line.homeOdds,
                          line.lineValue,
                          line.homeEntryId,
                          { handicap: line.homeHandicap }
                        )
                      )
                    }
                  />
                  <OddsBtn
                    label={awayName}
                    handicap={line.awayHandicap}
                    odds={line.awayOdds}
                    selectionId={aId}
                    onClick={() =>
                      line.awayOdds !== "—" &&
                      toggleSelection(
                        makeLineSel(
                          6,
                          "Away",
                          `${awayName} ${line.awayHandicap ?? line.lineValue}`,
                          line.awayOdds,
                          line.lineValue,
                          line.awayEntryId,
                          { handicap: line.awayHandicap }
                        )
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
        </MarketSection>
      )}

      {/* ── Asian Total ────────────────────────────────────────── */}
      {totalLines.length > 0 && (
        <MarketSection title={t("asianTotal")} titleSize="lg">
          <div className="flex flex-col gap-[8px] p-[24px]">
            {/* Column headers */}
            <div className="flex gap-[16px] h-[24px] items-center">
              <div className="flex flex-1" />
              <div className="flex flex-1 items-center justify-center text-[14px] leading-[19px] text-secondary text-center">
                {t("over")}
              </div>
              <div className="flex flex-1 items-center justify-center text-[14px] leading-[19px] text-secondary text-center">
                {t("under")}
              </div>
            </div>

            {/* Data rows */}
            {totalLines.map((line) => {
              const oId = makeSelectionId(fixtureId, 7, "Over", line.lineValue);
              const uId = makeSelectionId(fixtureId, 7, "Under", line.lineValue);

              return (
                <div key={line.lineValue} className="flex gap-[16px] items-center">
                  {/* Line value */}
                  <div className="flex flex-1 items-center justify-center h-[40px] px-[12px] py-[8px] text-[14px] leading-[19px] text-primary text-center">
                    {line.lineValue}
                  </div>
                  {/* Over */}
                  <OddsBtn
                    odds={line.homeOdds}
                    selectionId={oId}
                    onClick={() =>
                      line.homeOdds !== "—" &&
                      toggleSelection(
                        makeLineSel(
                          7,
                          "Over",
                          t("overLine", { line: line.lineValue }),
                          line.homeOdds,
                          line.lineValue,
                          line.homeEntryId,
                          { total: line.lineValue }
                        )
                      )
                    }
                  />
                  {/* Under */}
                  <OddsBtn
                    odds={line.awayOdds}
                    selectionId={uId}
                    onClick={() =>
                      line.awayOdds !== "—" &&
                      toggleSelection(
                        makeLineSel(
                          7,
                          "Under",
                          t("underLine", { line: line.lineValue }),
                          line.awayOdds,
                          line.lineValue,
                          line.awayEntryId,
                          { total: line.lineValue }
                        )
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
        </MarketSection>
      )}
    </div>
  );
}
