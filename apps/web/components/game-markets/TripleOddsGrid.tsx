"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { LockSimpleIcon } from "@phosphor-icons/react";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";
import type { BetSelection } from "@/types/betting";
import type { OnchainMarket } from "@/types/onchain-betting";
import { getAllOddsDisplay } from "@/lib/match-utils";
import { parseOddsLines } from "@/lib/parse-odds-lines";
import {
  pickOnchainAlignedLine,
  hasOnchainLine,
  shouldAlignToOnchain,
} from "@/lib/onchain-line-filter";
import { makeSelectionId } from "@/lib/selection-id";
import { useBetSlipStore, selectIsSelected } from "@/stores/betSlipStore";
import { handleOddsClickAction } from "@/lib/betslip-click-handler";
import { ODDS_LOCKED_TEXT, ODDS_LOCKED_CLASS } from "@/lib/odds";
import { LiveOdds } from "./LiveOdds";

// ─── WinnerOddsBtn (single value, same as before) ──────────────────────

function WinnerOddsBtn({
  value,
  selId,
  onClick,
  locked = false,
}: {
  value: string;
  selId: string | null;
  onClick?: (e: React.MouseEvent) => void;
  /** DD-119 红灯：signal===3 → 置灰 + "--" + 不可点 */
  locked?: boolean;
}) {
  const isSelected = useBetSlipStore(selId ? selectIsSelected(selId) : () => false);
  const isDisabled = locked || !onClick || value === "—";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={`flex items-center justify-center
        w-[48px] h-[32px] rounded-8
        font-semibold text-[14px] leading-[19px]
        transition-all
        active:scale-[0.90] active:duration-[120ms] active:ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${
          locked
            ? ODDS_LOCKED_CLASS
            : isSelected
              ? "bg-fn-brand border border-fn-brand text-static-black"
              : isDisabled
                ? "cursor-default opacity-40 text-brand-default"
                : "bg-btn-secondary text-brand-default cursor-pointer hover:bg-btn-secondary-hover"
        }`}
    >
      {locked ? ODDS_LOCKED_TEXT : value}
    </button>
  );
}

// ─── CompoundOddsBtn (label + odds, for handicap/total) ─────────────────

function CompoundOddsBtn({
  label,
  value,
  selId,
  onClick,
  locked = false,
}: {
  label: string;
  value: string;
  selId: string | null;
  onClick?: (e: React.MouseEvent) => void;
  /** DD-119 红灯：signal===3 → 置灰 + value "--" + 不可点 */
  locked?: boolean;
}) {
  const isSelected = useBetSlipStore(selId ? selectIsSelected(selId) : () => false);
  const isDisabled = locked || !onClick || value === "—";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={`group flex items-center justify-center gap-[8px]
        h-[32px] rounded-8 px-[8px]
        text-[14px] leading-[19px]
        transition-all
        active:scale-[0.90] active:duration-[120ms] active:ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${
          locked
            ? ODDS_LOCKED_CLASS
            : isSelected
              ? "bg-fn-brand border border-fn-brand"
              : isDisabled
                ? "cursor-default opacity-40"
                : "bg-btn-secondary cursor-pointer hover:bg-btn-secondary-hover"
        }`}
    >
      <span
        className={`font-normal whitespace-nowrap ${locked ? "text-tertiary" : isSelected ? "text-static-black" : "text-primary"}`}
      >
        {label}
      </span>
      <span
        className={`font-semibold ${locked ? "text-tertiary" : isSelected ? "text-static-black" : "text-brand-default"}`}
      >
        {locked ? ODDS_LOCKED_TEXT : value}
      </span>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

interface TripleOddsGridProps {
  odds: SportmonksOddsEntry[];
  fixture: SportmonksFixture;
  leagueName: string;
  noOdds: boolean;
  /** Onchain markets for this fixture (DD-118 Batch 5b — list-page live odds) */
  onchainMarkets?: OnchainMarket[] | null;
  /** Whether WS subscriptions should be active (viewport gate). Default true. */
  liveEnabled?: boolean;
}

export default memo(function TripleOddsGrid({
  odds,
  fixture,
  leagueName,
  noOdds,
  onchainMarkets = null,
  liveEnabled = true,
}: TripleOddsGridProps) {
  const t = useTranslations("markets");
  const toggleSelection = useBetSlipStore((s) => s.toggleSelection);

  const handleOddsClick = (e: React.MouseEvent, sel: BetSelection) =>
    handleOddsClickAction(e, sel, fixture.id, toggleSelection);

  // ── Pending state ─────────────────────────────────────────────────────
  if (noOdds) {
    return (
      <div className="shrink-0 grid grid-cols-[48px_48px_48px] gap-y-[4px] gap-x-[8px] text-center text-[14px] leading-[19px]">
        <span className="flex items-center justify-center font-medium text-secondary">1</span>
        <span className="flex items-center justify-center font-medium text-secondary">1x2</span>
        <span className="flex items-center justify-center font-medium text-secondary">2</span>
        <div className="col-span-3 flex items-center justify-center gap-[6px] h-[32px]">
          <LockSimpleIcon size={14} weight="fill" className="text-secondary" />
          <span className="text-secondary font-medium">{t("oddsPending")}</span>
        </div>
      </div>
    );
  }

  // ── Build odds data ───────────────────────────────────────────────────
  const home = fixture.participants?.find((p) => p.meta?.location === "home");
  const away = fixture.participants?.find((p) => p.meta?.location === "away");
  const allOdds = getAllOddsDisplay(odds, home?.name, away?.name);

  function makeSelection(
    entry: SportmonksOddsEntry | undefined,
    displayLabel: string,
    value: string,
    lineValue?: string
  ): { sel: BetSelection; id: string } | null {
    if (value === "—" || !entry) return null;
    const id = makeSelectionId(fixture.id, entry.market_id, entry.label, lineValue);
    return {
      id,
      sel: {
        id,
        oddId: entry.id,
        fixtureId: fixture.id,
        fixtureName: fixture.name,
        leagueName,
        marketType:
          entry.market_id === 1 ? "1x2" : entry.market_id === 6 ? "asian_handicap" : "asian_total",
        marketDescription: entry.market_description,
        selection: entry.label,
        displayLabel,
        odds: value,
        handicap: entry.handicap || undefined,
        total: entry.total || undefined,
        homeLogo: home?.image_path || undefined,
        awayLogo: away?.image_path || undefined,
      },
    };
  }

  const { winner, handicap, total } = allOdds;

  // ── 展示什么 = 能下什么（onchain 线对齐） ─────────────────────────────
  // 行情主线可能停盘/漂移而链上未开（实测 19609127：行情 AH -1 / AT 2.5，链上只有 -1.25），
  // 点击必抛 OnchainMarketNotFoundError。这里以链上可投线为展示依据：
  //   undefined = 未加载/链上零盘/门控关（测试赛事、mainnet 走中心化）→ 沿用行情主线
  //   OddsLine  = 对齐到链上有盘的那条线（优先行情主线，其次 basis 最近的可投线）
  //   null      = 链上有盘体系但该玩法无任何盘 → 横杠缺省、不可点
  const marketsForAlign = shouldAlignToOnchain(fixture.id) ? onchainMarkets : null;
  const hFeedLineValue =
    "lineValue" in handicap.entries ? (handicap.entries.lineValue ?? undefined) : undefined;
  const tFeedLineValue =
    "lineValue" in total.entries ? (total.entries.lineValue ?? undefined) : undefined;
  const alignedH = pickOnchainAlignedLine(
    parseOddsLines(
      odds.filter((o) => o.market_id === 6),
      "asian_handicap"
    ),
    marketsForAlign,
    6,
    hFeedLineValue
  );
  const alignedT = pickOnchainAlignedLine(
    parseOddsLines(
      odds.filter((o) => o.market_id === 7),
      "asian_total"
    ),
    marketsForAlign,
    7,
    tFeedLineValue
  );
  // 1x2 同三态：零盘/门控关不进入对齐（与 pickOnchainAlignedLine 的透传条件一致）
  const has1x2Onchain =
    !marketsForAlign || marketsForAlign.length === 0 || hasOnchainLine(marketsForAlign, 1, null);
  const entryById = (id: number) => odds.find((o) => o.id === id);

  // Winner（1x2）：链上无盘 → 三列横杠不可点
  const wCol1 = has1x2Onchain ? winner.display.col1 : "—";
  const wCol2 = has1x2Onchain ? winner.display.col2 : "—";
  const wCol3 = has1x2Onchain ? winner.display.col3 : "—";
  const wSel1 = has1x2Onchain
    ? makeSelection(winner.entries.entry1, winner.entries.displayLabel1, wCol1)
    : null;
  const wSel2 = has1x2Onchain
    ? makeSelection(winner.entries.entry2, winner.entries.displayLabel2, wCol2)
    : null;
  const wSel3 = has1x2Onchain
    ? makeSelection(winner.entries.entry3, winner.entries.displayLabel3, wCol3)
    : null;

  // Handicap（2 列：home + away）—— aligned 三态展开
  const hEntry1 =
    alignedH === undefined ? handicap.entries.entry1 : alignedH && entryById(alignedH.homeEntryId);
  const hEntry3 =
    alignedH === undefined ? handicap.entries.entry3 : alignedH && entryById(alignedH.awayEntryId);
  const hCol1 = alignedH === undefined ? handicap.display.col1 : (alignedH?.homeOdds ?? "—");
  const hCol3 = alignedH === undefined ? handicap.display.col3 : (alignedH?.awayOdds ?? "—");
  const hLineValue = alignedH === undefined ? hFeedLineValue : alignedH?.lineValue;
  const hLabel1 =
    alignedH === undefined
      ? handicap.entries.displayLabel1
      : `${home?.name ?? "Home"} ${alignedH?.homeHandicap ?? alignedH?.lineValue ?? "—"}`;
  const hLabel3 =
    alignedH === undefined
      ? handicap.entries.displayLabel3
      : `${away?.name ?? "Away"} ${alignedH?.awayHandicap ?? "—"}`;
  const hSel1 = makeSelection(hEntry1 || undefined, hLabel1, hCol1, hLineValue);
  const hSel3 = makeSelection(hEntry3 || undefined, hLabel3, hCol3, hLineValue);

  // Total（2 列：over + under）—— aligned 三态展开
  const tEntry1 =
    alignedT === undefined ? total.entries.entry1 : alignedT && entryById(alignedT.homeEntryId);
  const tEntry3 =
    alignedT === undefined ? total.entries.entry3 : alignedT && entryById(alignedT.awayEntryId);
  const tCol1 = alignedT === undefined ? total.display.col1 : (alignedT?.homeOdds ?? "—");
  const tCol3 = alignedT === undefined ? total.display.col3 : (alignedT?.awayOdds ?? "—");
  const tLineValue = alignedT === undefined ? tFeedLineValue : alignedT?.lineValue;
  const tLabel1 =
    alignedT === undefined ? total.entries.displayLabel1 : `Over ${alignedT?.lineValue ?? "—"}`;
  const tLabel3 =
    alignedT === undefined ? total.entries.displayLabel3 : `Under ${alignedT?.lineValue ?? "—"}`;
  const tSel1 = makeSelection(tEntry1 || undefined, tLabel1, tCol1, tLineValue);
  const tSel3 = makeSelection(tEntry3 || undefined, tLabel3, tCol3, tLineValue);

  // Compound button labels（缺省态 = "—" / "O —" / "U —"，与既有空态语义一致）
  const hcHomeLabel =
    alignedH === undefined
      ? (handicap.entries.entry1?.handicap ?? "—")
      : (alignedH?.homeHandicap ?? "—");
  const hcAwayLabel =
    alignedH === undefined
      ? (handicap.entries.entry3?.handicap ?? "—")
      : (alignedH?.awayHandicap ?? "—");
  const ttOverLabel =
    alignedT === undefined
      ? total.entries.entry1?.total
        ? `O ${total.entries.entry1.total}`
        : "O —"
      : alignedT
        ? `O ${alignedT.lineValue}`
        : "O —";
  const ttUnderLabel =
    alignedT === undefined
      ? total.entries.entry3?.total
        ? `U ${total.entries.entry3.total}`
        : "U —"
      : alignedT
        ? `U ${alignedT.lineValue}`
        : "U —";

  return (
    <div
      className="flex gap-[16px] shrink-0 items-end"
      style={{ transition: "opacity 150ms ease-out" }}
    >
      {/* Full Time Result — 3 odds buttons (DD-118 Batch 5b: live odds) */}
      <div className="flex flex-col gap-[4px]">
        <span className="text-[12px] font-medium text-secondary leading-[16px] whitespace-nowrap text-center">
          {t("fullTimeResult")}
        </span>
        <div className="flex gap-[8px]">
          <LiveOdds
            markets={onchainMarkets}
            sportmonksMarketId={1}
            outcomeLabel="Home"
            fallbackValue={wCol1}
            enabled={liveEnabled}
          >
            {(value, ref, meta) => (
              <div ref={ref}>
                <WinnerOddsBtn
                  value={value}
                  locked={meta.locked}
                  selId={wSel1?.id ?? null}
                  onClick={wSel1 ? (e) => handleOddsClick(e, wSel1.sel) : undefined}
                />
              </div>
            )}
          </LiveOdds>
          {wSel2 ? (
            <LiveOdds
              markets={onchainMarkets}
              sportmonksMarketId={1}
              outcomeLabel="Draw"
              fallbackValue={wCol2}
              enabled={liveEnabled}
            >
              {(value, ref, meta) => (
                <div ref={ref}>
                  <WinnerOddsBtn
                    value={value}
                    locked={meta.locked}
                    selId={wSel2.id}
                    onClick={(e) => handleOddsClick(e, wSel2.sel)}
                  />
                </div>
              )}
            </LiveOdds>
          ) : (
            <span className="flex items-center justify-center w-[48px] h-[32px] font-medium text-secondary text-[14px]">
              {wCol2}
            </span>
          )}
          <LiveOdds
            markets={onchainMarkets}
            sportmonksMarketId={1}
            outcomeLabel="Away"
            fallbackValue={wCol3}
            enabled={liveEnabled}
          >
            {(value, ref, meta) => (
              <div ref={ref}>
                <WinnerOddsBtn
                  value={value}
                  locked={meta.locked}
                  selId={wSel3?.id ?? null}
                  onClick={wSel3 ? (e) => handleOddsClick(e, wSel3.sel) : undefined}
                />
              </div>
            )}
          </LiveOdds>
        </div>
      </div>

      {/* Asian Handicap — 2 compound buttons */}
      <div className="flex flex-col gap-[4px]">
        <span className="text-[12px] font-medium text-secondary leading-[16px] whitespace-nowrap text-center">
          {t("asianHandicap")}
        </span>
        <div className="flex gap-[8px]">
          <LiveOdds
            markets={onchainMarkets}
            sportmonksMarketId={6}
            outcomeLabel="Home"
            line={hLineValue}
            fallbackValue={hCol1}
            enabled={liveEnabled}
          >
            {(value, ref, meta) => (
              <div ref={ref}>
                <CompoundOddsBtn
                  label={hcHomeLabel}
                  value={value}
                  locked={meta.locked}
                  selId={hSel1?.id ?? null}
                  onClick={hSel1 ? (e) => handleOddsClick(e, hSel1.sel) : undefined}
                />
              </div>
            )}
          </LiveOdds>
          <LiveOdds
            markets={onchainMarkets}
            sportmonksMarketId={6}
            outcomeLabel="Away"
            line={hLineValue}
            fallbackValue={hCol3}
            enabled={liveEnabled}
          >
            {(value, ref, meta) => (
              <div ref={ref}>
                <CompoundOddsBtn
                  label={hcAwayLabel}
                  value={value}
                  locked={meta.locked}
                  selId={hSel3?.id ?? null}
                  onClick={hSel3 ? (e) => handleOddsClick(e, hSel3.sel) : undefined}
                />
              </div>
            )}
          </LiveOdds>
        </div>
      </div>

      {/* Asian Total — 2 compound buttons */}
      <div className="flex flex-col gap-[4px]">
        <span className="text-[12px] font-medium text-secondary leading-[16px] whitespace-nowrap text-center">
          {t("asianTotal")}
        </span>
        <div className="flex gap-[8px]">
          <LiveOdds
            markets={onchainMarkets}
            sportmonksMarketId={7}
            outcomeLabel="Over"
            line={tLineValue}
            fallbackValue={tCol1}
            enabled={liveEnabled}
          >
            {(value, ref, meta) => (
              <div ref={ref}>
                <CompoundOddsBtn
                  label={ttOverLabel}
                  value={value}
                  locked={meta.locked}
                  selId={tSel1?.id ?? null}
                  onClick={tSel1 ? (e) => handleOddsClick(e, tSel1.sel) : undefined}
                />
              </div>
            )}
          </LiveOdds>
          <LiveOdds
            markets={onchainMarkets}
            sportmonksMarketId={7}
            outcomeLabel="Under"
            line={tLineValue}
            fallbackValue={tCol3}
            enabled={liveEnabled}
          >
            {(value, ref, meta) => (
              <div ref={ref}>
                <CompoundOddsBtn
                  label={ttUnderLabel}
                  value={value}
                  locked={meta.locked}
                  selId={tSel3?.id ?? null}
                  onClick={tSel3 ? (e) => handleOddsClick(e, tSel3.sel) : undefined}
                />
              </div>
            )}
          </LiveOdds>
        </div>
      </div>
    </div>
  );
});
