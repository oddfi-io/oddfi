"use client";

/**
 * DD-102 §3.3 · Part 3 下注区抽取自 MatchDetailContent.tsx。
 *
 * 抽取范围：1x2 / Asian Handicap / Asian Total 三个 MarketSection。
 *
 * DD-119 / DD-118：每个赔率格走 useLiveOddsForEntry —— 命中链上盘口时实时展示
 * quotedOdds + 信号灯，signal===3（红灯）锁定该方向显示 "--" 不可点；未命中/未订阅
 * 时回退 SportMonks 赔率。markets 一次性按 fixture 拉取（与投注单共享 RQ 缓存）。
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CaretUpIcon } from "@phosphor-icons/react";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";
import type { BetSelection } from "@/types/betting";
import type { OnchainMarket } from "@/types/onchain-betting";
import { useBetSlipStore, selectIsSelected } from "@/stores/betSlipStore";
import { parseOddsLines } from "@/lib/parse-odds-lines";
import {
  filterLinesToOnchain,
  hasOnchainLine,
  shouldAlignToOnchain,
} from "@/lib/onchain-line-filter";
import {
  flashOddsBtn,
  flyChipToPanel,
  isPcRapidAdd,
  shakePanel,
  scrollToNewest,
} from "@/lib/betslip-animations-pc";
import { flashOddsDirection } from "@/lib/betslip-animations";
import { makeSelectionId } from "@/lib/selection-id";
import { formatOdds } from "@/lib/odds";
import { useOnchainMarketsByFixture } from "@/hooks/useOnchainMarketBySelection";
import { useLiveOddsForEntry } from "@/hooks/useLiveOddsForEntry";

// ─── Helpers ───────────────────────────────────────────────────────────────

function getTeam(fixture: SportmonksFixture, location: "home" | "away") {
  return fixture.participants.find((p) => p.meta.location === location);
}

type OutcomeLabel = "Home" | "Draw" | "Away" | "Over" | "Under";

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

// ─── Odds Button (connected to BetSlip store + live odds/signal) ───────────

function OddsBtn({
  label,
  handicap,
  fallbackOdds,
  selectionId,
  markets,
  sportmonksMarketId,
  line,
  outcomeLabel,
  onClick,
}: {
  label?: string;
  handicap?: string;
  /** REST 兜底赔率（formatOdds 后 2 位小数字符串，或 "—"） */
  fallbackOdds: string;
  selectionId: string;
  markets: OnchainMarket[] | null;
  sportmonksMarketId: number; // 1=1x2 / 6=AH / 7=Total
  line: string | null; // AH/Total 盘口线（主队视角）；1x2 传 null
  outcomeLabel: OutcomeLabel;
  onClick?: () => void;
}) {
  const isSelected = useBetSlipStore(selectIsSelected(selectionId));

  // DD-119/118：实时赔率 + 信号灯。命中链上盘口才生效，否则回退 fallbackOdds、signal=null。
  const live = useLiveOddsForEntry({
    markets,
    sportmonksMarketId,
    line,
    outcomeLabel,
    fallbackValue: fallbackOdds,
  });
  const locked = live.signal === 3; // 红灯：停止接单
  const displayOdds = live.displayValue;

  // quotedOdds 实时变化时闪烁（与 BetCard 同一动画工具）
  const oddsRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!live.flashDirection || !oddsRef.current) return;
    flashOddsDirection(oddsRef.current, live.flashDirection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.flashSignature]);

  const handleClick = (e: React.MouseEvent) => {
    if (locked) return; // DD-119 红灯：禁止下注（与 disabled 双重拦截）
    const btn = e.currentTarget;
    if (!isSelected && displayOdds !== "—") {
      flashOddsBtn(btn);
      onClick?.();
      if (isPcRapidAdd()) {
        shakePanel();
      } else {
        flyChipToPanel(btn, displayOdds);
      }
      scrollToNewest();
    } else {
      onClick?.();
    }
  };

  // Figma 6096:57093 选中态：bg = brand 实色，文字 = static-black。
  //   未选中: bg-transparent，文字 text-primary；hover 轻品牌底
  //   选中:   bg-fn-brand 实色，文字全部 text-static-black 反白
  //   DD-119 红灯锁定: bg-tertiary 置灰，文字 text-tertiary，odds 显示 "--"
  const textColor = locked ? "text-tertiary" : isSelected ? "text-static-black" : "text-primary";
  const oddsColor = locked
    ? "text-tertiary"
    : isSelected
      ? "text-static-black"
      : "text-brand-default";
  const oddsText = locked ? "--" : displayOdds;
  return (
    <button
      onClick={handleClick}
      disabled={locked}
      aria-disabled={locked}
      className={`group flex flex-1 gap-[8px] h-[40px] items-center justify-center px-[12px] py-[8px] rounded-8 min-h-[40px] min-w-0 transition-colors
        ${
          locked
            ? "bg-tertiary border border-transparent cursor-not-allowed"
            : isSelected
              ? "bg-fn-brand border border-fn-brand"
              : "bg-btn-secondary border border-transparent hover:bg-btn-secondary-hover"
        }`}
    >
      {label && (
        <span className={`text-[14px] leading-[19px] text-center truncate min-w-0 ${textColor}`}>
          {label}
        </span>
      )}
      {handicap && (
        <span
          className={`text-[14px] leading-[19px] text-center whitespace-nowrap shrink-0 ${textColor}`}
        >
          {handicap}
        </span>
      )}
      <span
        ref={oddsRef}
        className={`text-[14px] leading-[19px] font-semibold whitespace-nowrap shrink-0 ${oddsColor}`}
      >
        {oddsText}
      </span>
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export interface MatchBettingMarketsProps {
  fixture: SportmonksFixture;
  locale: string;
}

export default function MatchBettingMarkets({ fixture }: MatchBettingMarketsProps) {
  const t = useTranslations("markets");
  const toggleSelection = useBetSlipStore((s) => s.toggleSelection);

  const fixtureId = fixture.id;
  // DD-119/118 — 单场链上盘口（含 signal/quoted_odds）；与投注单共享 ONCHAIN_MARKETS 缓存。
  // 无链上盘口时 markets 为 null → 各 OddsBtn 走 SportMonks 兜底。
  const { markets } = useOnchainMarketsByFixture(fixtureId);
  const home = getTeam(fixture, "home");
  const away = getTeam(fixture, "away");
  const homeName = home?.name ?? "—";
  const awayName = away?.name ?? "—";
  const fixtureName = fixture.name;
  const leagueName = fixture.league?.name ?? fixture.name ?? `Match #${fixture.id}`;

  const odds = fixture.odds ?? [];
  const homeEntry = odds.filter((o) => o.market_id === 1).find((o) => o.label === "Home");
  const drawEntry = odds.filter((o) => o.market_id === 1).find((o) => o.label === "Draw");
  const awayEntry = odds.filter((o) => o.market_id === 1).find((o) => o.label === "Away");

  // 展示什么 = 能下什么：AH/AT 只渲染链上有盘的线，杜绝"点了才报 OnchainMarketNotFoundError"。
  // markets 未加载（null）时 filterLinesToOnchain 原样透传，避免加载闪缺省态；
  // 已加载但被过滤为空 → 渲染缺省占位行（横杠），与列表卡片缺省语义一致。
  const rawHandicapLines = parseOddsLines(
    odds.filter((o) => o.market_id === 6),
    "asian_handicap"
  );
  const rawTotalLines = parseOddsLines(
    odds.filter((o) => o.market_id === 7),
    "asian_total"
  );
  // 门控：测试赛事/mainnet 走中心化下注，行情线即可投线，不做链上对齐（critic Major#3）
  const marketsForAlign = shouldAlignToOnchain(fixtureId) ? markets : null;
  const handicapLines = filterLinesToOnchain(rawHandicapLines, marketsForAlign, 6);
  const totalLines = filterLinesToOnchain(rawTotalLines, marketsForAlign, 7);
  // 1x2 同规则：链上有盘体系但无 market_type=0 的盘（如历史脏盘被隔离期间）→ 三键横杠不可点。
  const has1x2Onchain =
    !marketsForAlign || marketsForAlign.length === 0 || hasOnchainLine(marketsForAlign, 1, null);

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
      homeLogo: home?.image_path || undefined,
      awayLogo: away?.image_path || undefined,
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
      homeLogo: home?.image_path || undefined,
      awayLogo: away?.image_path || undefined,
      ...extra,
    };
  }

  return (
    <div className="flex flex-col gap-[24px]">
      {/* 1x2 — 链上无盘时三键横杠不可点（has1x2Onchain=false） */}
      <MarketSection title="1x2" titleSize="sm">
        <div className="flex gap-[16px] items-center p-[16px]">
          <OddsBtn
            label={homeName}
            fallbackOdds={has1x2Onchain ? formatOdds(homeEntry?.value) : "—"}
            selectionId={makeSelectionId(fixtureId, 1, "Home")}
            markets={markets}
            sportmonksMarketId={1}
            line={null}
            outcomeLabel="Home"
            onClick={has1x2Onchain ? () => homeSel && toggleSelection(homeSel) : undefined}
          />
          <OddsBtn
            label={t("draw")}
            fallbackOdds={has1x2Onchain ? formatOdds(drawEntry?.value) : "—"}
            selectionId={makeSelectionId(fixtureId, 1, "Draw")}
            markets={markets}
            sportmonksMarketId={1}
            line={null}
            outcomeLabel="Draw"
            onClick={has1x2Onchain ? () => drawSel && toggleSelection(drawSel) : undefined}
          />
          <OddsBtn
            label={awayName}
            fallbackOdds={has1x2Onchain ? formatOdds(awayEntry?.value) : "—"}
            selectionId={makeSelectionId(fixtureId, 1, "Away")}
            markets={markets}
            sportmonksMarketId={1}
            line={null}
            outcomeLabel="Away"
            onClick={has1x2Onchain ? () => awaySel && toggleSelection(awaySel) : undefined}
          />
        </div>
      </MarketSection>

      {/* Asian Handicap — 行情有该玩法即渲染区块；链上无可投线时显示缺省横杠 */}
      {rawHandicapLines.length > 0 && (
        <MarketSection title={t("asianHandicap")} titleSize="lg">
          <div className="flex flex-col gap-[8px] p-[24px]">
            {handicapLines.length === 0 && (
              <div className="flex gap-[16px] items-center">
                <div className="flex flex-1 items-center justify-center h-[40px] rounded-8 bg-btn-secondary opacity-40 text-[14px] leading-[19px] text-primary">
                  {homeName} —
                </div>
                <div className="flex flex-1 items-center justify-center h-[40px] rounded-8 bg-btn-secondary opacity-40 text-[14px] leading-[19px] text-primary">
                  {awayName} —
                </div>
              </div>
            )}
            {handicapLines.map((line) => {
              const hId = makeSelectionId(fixtureId, 6, "Home", line.lineValue);
              const aId = makeSelectionId(fixtureId, 6, "Away", line.lineValue);

              const hSel = makeLineSel(
                6,
                "Home",
                `${homeName} ${line.homeHandicap ?? line.lineValue}`,
                line.homeOdds,
                line.lineValue,
                line.homeEntryId,
                { handicap: line.homeHandicap }
              );
              const aSel = makeLineSel(
                6,
                "Away",
                `${awayName} ${line.awayHandicap ?? line.lineValue}`,
                line.awayOdds,
                line.lineValue,
                line.awayEntryId,
                { handicap: line.awayHandicap }
              );

              return (
                <div key={line.lineValue} className="flex gap-[16px] items-center">
                  <OddsBtn
                    label={homeName}
                    handicap={line.homeHandicap}
                    fallbackOdds={line.homeOdds}
                    selectionId={hId}
                    markets={markets}
                    sportmonksMarketId={6}
                    line={line.lineValue}
                    outcomeLabel="Home"
                    onClick={() => line.homeOdds !== "—" && toggleSelection(hSel)}
                  />
                  <OddsBtn
                    label={awayName}
                    handicap={line.awayHandicap}
                    fallbackOdds={line.awayOdds}
                    selectionId={aId}
                    markets={markets}
                    sportmonksMarketId={6}
                    line={line.lineValue}
                    outcomeLabel="Away"
                    onClick={() => line.awayOdds !== "—" && toggleSelection(aSel)}
                  />
                </div>
              );
            })}
          </div>
        </MarketSection>
      )}

      {/* Asian Total — 行情有该玩法即渲染区块；链上无可投线时显示缺省横杠（O — / U —） */}
      {rawTotalLines.length > 0 && (
        <MarketSection title={t("asianTotal")} titleSize="lg">
          <div className="flex flex-col gap-[8px] p-[24px]">
            <div className="flex gap-[16px] h-[24px] items-center">
              <div className="flex flex-1" />
              <div className="flex flex-1 items-center justify-center text-[14px] leading-[19px] text-secondary text-center">
                {t("over")}
              </div>
              <div className="flex flex-1 items-center justify-center text-[14px] leading-[19px] text-secondary text-center">
                {t("under")}
              </div>
            </div>

            {totalLines.length === 0 && (
              <div className="flex gap-[16px] items-center">
                <div className="flex flex-1 items-center justify-center h-[40px] px-[12px] py-[8px] text-[14px] leading-[19px] text-primary text-center">
                  —
                </div>
                <div className="flex flex-1 items-center justify-center h-[40px] rounded-8 bg-btn-secondary opacity-40 text-[14px] leading-[19px] text-primary">
                  O —
                </div>
                <div className="flex flex-1 items-center justify-center h-[40px] rounded-8 bg-btn-secondary opacity-40 text-[14px] leading-[19px] text-primary">
                  U —
                </div>
              </div>
            )}
            {totalLines.map((line) => {
              const oId = makeSelectionId(fixtureId, 7, "Over", line.lineValue);
              const uId = makeSelectionId(fixtureId, 7, "Under", line.lineValue);

              const oSel = makeLineSel(
                7,
                "Over",
                t("overLine", { line: line.lineValue }),
                line.homeOdds,
                line.lineValue,
                line.homeEntryId,
                { total: line.lineValue }
              );
              const uSel = makeLineSel(
                7,
                "Under",
                t("underLine", { line: line.lineValue }),
                line.awayOdds,
                line.lineValue,
                line.awayEntryId,
                { total: line.lineValue }
              );

              return (
                <div key={line.lineValue} className="flex gap-[16px] items-center">
                  <div className="flex flex-1 items-center justify-center h-[40px] px-[12px] py-[8px] text-[14px] leading-[19px] text-primary text-center">
                    {line.lineValue}
                  </div>
                  <OddsBtn
                    fallbackOdds={line.homeOdds}
                    selectionId={oId}
                    markets={markets}
                    sportmonksMarketId={7}
                    line={line.lineValue}
                    outcomeLabel="Over"
                    onClick={() => line.homeOdds !== "—" && toggleSelection(oSel)}
                  />
                  <OddsBtn
                    fallbackOdds={line.awayOdds}
                    selectionId={uId}
                    markets={markets}
                    sportmonksMarketId={7}
                    line={line.lineValue}
                    outcomeLabel="Under"
                    onClick={() => line.awayOdds !== "—" && toggleSelection(uSel)}
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
