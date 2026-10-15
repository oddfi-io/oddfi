"use client";

import { memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import { LockSimpleIcon } from "@phosphor-icons/react";
import SportIcon from "@/components/ui/SportIcon";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";
import type { OddsFilter, BetSelection } from "@/types/betting";
import { resolveKickoffSeconds } from "@/lib/format-utils";
import { formatKickoffDisplay, getBrowserTimezone } from "@/lib/calendar/timezone";
import { getFixtureStatus, getStatePeriodKey } from "@/lib/fixture-state";
import { getTeam, getOddsDisplay, getOddsEntries } from "@/lib/match-utils";
import { parseOddsLines } from "@/lib/parse-odds-lines";
import {
  pickOnchainAlignedLine,
  hasOnchainLine,
  shouldAlignToOnchain,
} from "@/lib/onchain-line-filter";
import { makeSelectionId } from "@/lib/selection-id";
import { ODDS_LOCKED_TEXT, ODDS_LOCKED_CLASS } from "@/lib/odds";
import { isTestFixtureId, isOnchainTestFixture } from "@/lib/betting/constants";
import { useBetSlipStore, selectIsSelected } from "@/stores/betSlipStore";
import { handleOddsClickAction } from "@/lib/betslip-click-handler";
import { useForceDisableBet } from "@/lib/dev-toggles";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";
import { useChatOpener } from "@/hooks/useChatOpener";
import { useInViewport } from "@/hooks/useInViewport";
import { useOnchainMarketsByFixture } from "@/hooks/useOnchainMarketBySelection";
import TripleOddsGrid from "./TripleOddsGrid";
import { LiveOdds } from "./LiveOdds";
import LiveTag from "./LiveTag";

// ─── Types ─────────────────────────────────────────────────────────────────

interface MatchCardProps {
  fixture: SportmonksFixture;
  locale: string;
  isSelected?: boolean;
  compact?: boolean;
  oddsFilter?: OddsFilter;
  tripleOdds?: boolean;
  onClick?: () => void;
  /** 赛事级禁投开关（DD-087 §4.1）；缺省视为 true */
  enableBet?: boolean;
  /** 首屏首卡加 priority hint，每页严格 ≤2（home+away 各一） */
  priorityImages?: boolean;
}

// ─── OddsBtn ──────────────────────────────────────────────────────────────

function OddsBtn({
  value,
  selId,
  compact = false,
  onClick,
  bettingClosed = false,
  locked = false,
}: {
  value: string;
  selId: string | null;
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  /** 赛事级禁投：true 时按钮置灰 + cursor-not-allowed（DD-087 §4.1） */
  bettingClosed?: boolean;
  /** DD-119 红灯：signal===3 → 置灰 + "--" + 不可点 */
  locked?: boolean;
}) {
  const isSelected = useBetSlipStore(selId ? selectIsSelected(selId) : () => false);
  const isDisabled = locked || bettingClosed || !onClick || value === "—";

  if (compact) {
    return (
      <button
        type="button"
        disabled={isDisabled}
        onClick={isDisabled ? undefined : onClick}
        className={`font-bold transition-all rounded-4 px-[4px] -mx-[4px]
          active:scale-[0.90] active:duration-[120ms] active:ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${
            locked
              ? ODDS_LOCKED_CLASS
              : isDisabled
                ? `opacity-40 text-brand-default ${bettingClosed ? "cursor-not-allowed" : "cursor-default"}`
                : isSelected
                  ? "bg-fn-brand text-static-black cursor-pointer"
                  : "bg-btn-secondary text-brand-default cursor-pointer hover:bg-btn-secondary-hover"
          }`}
      >
        {locked ? ODDS_LOCKED_TEXT : value}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={`flex items-center justify-center
        h-[20px] px-[10px] rounded-[6px]
        lg:w-[64px] lg:h-[32px] lg:rounded-8
        font-medium lg:font-semibold
        transition-all
        active:scale-[0.90] active:duration-[120ms] active:ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${
          locked
            ? ODDS_LOCKED_CLASS
            : isSelected
              ? "bg-fn-brand lg:border lg:border-fn-brand text-static-black"
              : isDisabled
                ? `opacity-40 text-brand-default ${bettingClosed ? "cursor-not-allowed" : "cursor-default"}`
                : "bg-tag-brand lg:bg-btn-secondary text-brand-default cursor-pointer lg:hover:bg-btn-secondary-hover"
        }`}
    >
      {locked ? ODDS_LOCKED_TEXT : value}
    </button>
  );
}

// ─── SingleCompoundOddsBtn (label + odds, for handicap/total in single mode) ─

function SingleCompoundOddsBtn({
  label,
  value,
  selId,
  onClick,
  bettingClosed = false,
  locked = false,
}: {
  label: string;
  value: string;
  selId: string | null;
  onClick?: (e: React.MouseEvent) => void;
  /** 赛事级禁投：true 时按钮置灰 + cursor-not-allowed（DD-087 §4.1） */
  bettingClosed?: boolean;
  /** DD-119 红灯：signal===3 → 置灰 + value "--" + 不可点 */
  locked?: boolean;
}) {
  const isSelected = useBetSlipStore(selId ? selectIsSelected(selId) : () => false);
  const isDisabled = locked || bettingClosed || !onClick || value === "—";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={`group flex items-center justify-center gap-[6px] lg:gap-[8px]
        h-[20px] px-[8px] rounded-[6px]
        lg:h-[32px] lg:rounded-8
        text-[12px] lg:text-[14px] leading-[18px] lg:leading-[19px]
        transition-all
        active:scale-[0.90] active:duration-[120ms] active:ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${
          locked
            ? ODDS_LOCKED_CLASS
            : isSelected
              ? "bg-fn-brand lg:border lg:border-fn-brand"
              : isDisabled
                ? `opacity-40 ${bettingClosed ? "cursor-not-allowed" : "cursor-default"}`
                : "bg-tag-brand lg:bg-btn-secondary cursor-pointer lg:hover:bg-btn-secondary-hover"
        }`}
    >
      <span
        className={`font-normal whitespace-nowrap ${locked ? "text-tertiary" : isSelected ? "text-static-black" : "text-primary"}`}
      >
        {label}
      </span>
      <span
        className={`font-medium lg:font-semibold ${locked ? "text-tertiary" : isSelected ? "text-static-black" : "text-brand-default"}`}
      >
        {locked ? ODDS_LOCKED_TEXT : value}
      </span>
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default memo(function MatchCard({
  fixture,
  locale,
  isSelected = false,
  compact = false,
  oddsFilter = "winner",
  tripleOdds = false,
  onClick,
  enableBet = true,
  priorityImages = false,
}: MatchCardProps) {
  const t = useTranslations("markets");
  // dev override：localStorage `dev:disable_bet=1` 强制禁投，便于 DD-087 §4.1 验收
  const forceDisable = useForceDisableBet();
  const effectiveEnableBet = enableBet && !forceDisable;
  const odds = fixture.odds ?? [];
  // 防御：tripleOdds 覆盖 compact
  const effectiveCompact = tripleOdds ? false : compact;
  // BUG-071：开赛日期/时间显示走唯一事实源（同输入 timestamp + 显式本地 tz），
  // 与 TimelineMatchList 分桶 dayKey 同源，杜绝「分桶显式 tz / 显示隐式 toLocale」裂口。
  const tz = useMemo(() => getBrowserTimezone(), []);
  const kickoff = useMemo(
    () => formatKickoffDisplay(resolveKickoffSeconds(fixture), tz, locale),
    [fixture, tz, locale]
  );
  const home = getTeam(fixture, "home");
  const away = getTeam(fixture, "away");
  const homeName = home?.name ?? "—";
  const awayName = away?.name ?? "—";
  const homeLogoUrl = home?.image_path ?? "";
  const awayLogoUrl = away?.image_path ?? "";
  const leagueName = fixture.league?.name ?? "";

  const isLive = getFixtureStatus(fixture.state_id) === "live";
  const periodKey = getStatePeriodKey(fixture.state_id);
  const periodLabel = periodKey ? t(periodKey as Parameters<typeof t>[0]) : null;

  const noOdds = odds.length === 0;
  const display = getOddsDisplay(odds, oddsFilter);
  const isCompoundFilter = oddsFilter === "handicap" || oddsFilter === "total";
  const isCompoundEmpty = isCompoundFilter && (noOdds || display.isFallback);
  // winner filter 下无赔率 → pending 文案;compound filter 走自己的空态渲染,不覆盖 display
  if (noOdds && !isCompoundFilter) {
    const pending = t("oddsPending");
    display.col1 = pending;
    display.col2 = pending;
    display.col3 = pending;
  }
  const toggleSelection = useBetSlipStore((s) => s.toggleSelection);
  // DD-118 Batch 5b — viewport gate + onchain markets for live odds.
  const [cardRef, isVisible] = useInViewport<HTMLDivElement>({ rootMargin: "300px 0px" });
  const { markets: onchainMarkets } = useOnchainMarketsByFixture(isVisible ? fixture.id : null);
  // DD-107 §3.4.1: AI Badge 一键唤起 AI 聊天悬浮窗（未登录 gate 由 useChatOpener 接管）
  const { openChatWithIntent } = useChatOpener();
  const pendingMatchId = useAiChatSessionStore((s) => s.pendingMatchId);
  const aiBadgeMatchId = String(fixture.id);
  const aiBadgePending = pendingMatchId === aiBadgeMatchId;
  const aiBadgeLabel = `AI 分析 ${homeName} vs ${awayName}`;
  // DD-120：测试比赛（QA/演示场）不暴露 AI 分析入口 —— 推荐卡只覆盖真实赛事
  const showAiBadge = !isTestFixtureId(fixture.id) && !fixture.mock_activity;
  function handleAiBadgeClick(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  }

  // Build BetSelection for each odds column
  function makeSelection(
    label: string,
    displayLabel: string,
    value: string,
    entry?: SportmonksOddsEntry,
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
        homeLogo: homeLogoUrl || undefined,
        awayLogo: awayLogoUrl || undefined,
      },
    };
  }

  // Resolve entries for selection building
  const entries = getOddsEntries(odds, oddsFilter, homeName, awayName);
  const lineValue = "lineValue" in entries ? entries.lineValue : undefined;

  // ── 展示什么 = 能下什么（onchain 线对齐，三态规则同 TripleOddsGrid） ──
  // 行情主线可能停盘/漂移而链上未开，点击必抛 OnchainMarketNotFoundError；
  // markets 已加载时以链上可投线为展示依据，未加载/零盘/门控关沿用现状。
  const marketsForAlign = shouldAlignToOnchain(fixture.id) ? onchainMarkets : null;
  const has1x2Card =
    isCompoundFilter ||
    !marketsForAlign ||
    marketsForAlign.length === 0 ||
    hasOnchainLine(marketsForAlign, 1, null);
  if (!has1x2Card) {
    // winner 模式且链上无 1x2 盘：三列横杠（makeSelection 对 "—" 返回 null → 按钮禁用）
    display.col1 = "—";
    display.col2 = "—";
    display.col3 = "—";
  }
  const compoundSmType = oddsFilter === "handicap" ? 6 : oddsFilter === "total" ? 7 : null;
  const alignedCard =
    compoundSmType !== null
      ? pickOnchainAlignedLine(
          parseOddsLines(
            odds.filter((o) => o.market_id === compoundSmType),
            compoundSmType === 6 ? "asian_handicap" : "asian_total"
          ),
          marketsForAlign,
          compoundSmType,
          lineValue
        )
      : undefined;
  // 已加载且链上无该玩法任何盘 → 并入既有 compound 空态渲染（横杠 + 不可点）
  const compoundEmptyEffective = isCompoundEmpty || alignedCard === null;
  const cardEntry1 =
    alignedCard == null ? entries.entry1 : odds.find((o) => o.id === alignedCard.homeEntryId);
  const cardEntry3 =
    alignedCard == null ? entries.entry3 : odds.find((o) => o.id === alignedCard.awayEntryId);
  const cardCol1 = alignedCard == null ? display.col1 : alignedCard.homeOdds;
  const cardCol3 = alignedCard == null ? display.col3 : alignedCard.awayOdds;
  const cardLineValue = alignedCard === undefined ? lineValue : alignedCard?.lineValue;

  const sel1 = makeSelection(
    display.header1,
    entries.displayLabel1,
    cardCol1,
    cardEntry1,
    cardLineValue
  );
  const sel2 = makeSelection(display.header2, entries.displayLabel2, display.col2, entries.entry2);
  const sel3 = makeSelection(
    display.header3,
    entries.displayLabel3,
    cardCol3,
    cardEntry3,
    cardLineValue
  );

  const handleOddsClick = (e: React.MouseEvent, sel: BetSelection) =>
    handleOddsClickAction(e, sel, fixture.id, toggleSelection, effectiveEnableBet);

  // Compound display for handicap/total (2 buttons with label+odds instead of 3-col grid)
  const compoundMarketLabel = oddsFilter === "handicap" ? t("asianHandicap") : t("asianTotal");
  const compoundLabel1 = compoundEmptyEffective
    ? oddsFilter === "handicap"
      ? "—"
      : "O —"
    : oddsFilter === "handicap"
      ? (cardEntry1?.handicap ?? "—")
      : cardEntry1?.total
        ? `O ${cardEntry1.total}`
        : "O —";
  const compoundLabel2 = compoundEmptyEffective
    ? oddsFilter === "handicap"
      ? "—"
      : "U —"
    : oddsFilter === "handicap"
      ? (cardEntry3?.handicap ?? "—")
      : cardEntry3?.total
        ? `U ${cardEntry3.total}`
        : "U —";

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className={`relative bg-secondary rounded-12 lg:rounded-16 p-[16px] flex flex-col gap-[16px] cursor-pointer transition-colors overflow-hidden
        ${isSelected ? "border border-dt-hover" : "border border-secondary lg:border-transparent lg:hover:border-dt-hover"}`}
    >
      {/* Selected-state decorative watermark (pitch lines, Figma 3485:137400) */}
      {isSelected && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/selected-card-watermark.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-[0.04]"
        />
      )}
      {/* Top row: live status OR date/time + icons, with optional league name */}
      <div className="flex items-center justify-between gap-[8px]">
        <div className="flex items-center gap-[8px]">
          {isLive ? (
            <>
              <span className="text-[14px] leading-[19px] font-medium text-secondary">
                {periodLabel}
              </span>
              <LiveTag />
            </>
          ) : (
            <>
              <span className="text-[12px] lg:text-[14px] leading-[18px] lg:leading-[19px] text-secondary">
                {kickoff.date}
              </span>
              <span className="text-[12px] lg:text-[14px] leading-[18px] lg:leading-[19px] text-secondary">
                {kickoff.time}
              </span>
            </>
          )}
          {showAiBadge && (
            <button
              type="button"
              onClick={(e) => {
                handleAiBadgeClick(e);
                openChatWithIntent({
                  intent: "match-analysis",
                  matchId: aiBadgeMatchId,
                  matchLabel: `${homeName} vs ${awayName}`,
                });
              }}
              onPointerDown={handleAiBadgeClick}
              disabled={aiBadgePending}
              aria-label={aiBadgeLabel}
              aria-haspopup="dialog"
              aria-busy={aiBadgePending || undefined}
              // H5-AI-DISABLED: H5 暂不展示 AI 触发按钮，H5 设计稿到位后去掉 hidden lg:inline-flex
              className="hidden lg:inline-flex shrink-0 cursor-pointer items-center justify-center bg-transparent p-0 transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ touchAction: "manipulation" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/match-stats/ai-badge-v3.svg"
                alt=""
                className="size-[12px] lg:size-[16px] shrink-0"
              />
            </button>
          )}
          {fixture.mock_activity && (
            /* @figma-hardcoded: #F68F151A beta-tag-bg — pending design token */
            <span
              className="shrink-0 rounded-full font-semibold text-warning"
              style={{
                background: "#F68F151A",
                fontSize: 10,
                lineHeight: "14px",
                padding: "2px 6px",
                letterSpacing: "0.5px",
              }}
            >
              TEST
            </span>
          )}
          {/* DD-138：链上测试赛事标签（仅 ID 区间判定 — 旧 99200001 带 mock_activity 但非链上） */}
          {isOnchainTestFixture(fixture.id) && (
            <span
              className="shrink-0 rounded-full font-semibold bg-tag-brand text-brand-default"
              style={{
                fontSize: 10,
                lineHeight: "14px",
                padding: "2px 6px",
                letterSpacing: "0.5px",
              }}
            >
              {t("onchainTag")}
            </span>
          )}
        </div>
        {!effectiveCompact && fixture.league?.name && (
          <span className="text-[12px] lg:text-[13px] leading-[18px] text-secondary truncate">
            {fixture.league.name}
          </span>
        )}
      </div>

      {/* Content: teams (left) + odds (right) — items-start so rows align */}
      <div className="flex items-start lg:items-center justify-between gap-[12px]">
        {/* Teams */}
        <div
          className={`flex flex-col gap-[4px] lg:gap-[10px] min-w-0${tripleOdds ? " lg:min-w-[120px]" : ""}`}
        >
          <div className="flex items-center gap-[8px]">
            <SportIcon
              src={homeLogoUrl}
              withBg
              priority={priorityImages}
              className="size-[16px] lg:size-[24px]"
            />
            <span className="text-[12px] lg:text-[14px] leading-[18px] lg:leading-[19px] font-medium lg:font-semibold text-primary truncate">
              {homeName}
            </span>
          </div>
          <div className="flex items-center gap-[8px]">
            <SportIcon
              src={awayLogoUrl}
              withBg
              priority={priorityImages}
              className="size-[16px] lg:size-[24px]"
            />
            <span className="text-[12px] lg:text-[14px] leading-[18px] lg:leading-[19px] font-medium lg:font-semibold text-primary truncate">
              {awayName}
            </span>
          </div>
        </div>

        {/* Odds — grid layout ensures header/value column alignment */}
        {tripleOdds ? (
          <TripleOddsGrid
            odds={odds}
            fixture={fixture}
            leagueName={leagueName}
            noOdds={noOdds}
            onchainMarkets={onchainMarkets}
            liveEnabled={isVisible}
          />
        ) : isCompoundFilter ? (
          <div className="shrink-0 flex flex-col gap-[4px] items-center">
            <span className="text-[12px] font-medium text-secondary leading-[16px] whitespace-nowrap">
              {compoundMarketLabel}
            </span>
            <div className="flex gap-[8px]">
              <LiveOdds
                markets={onchainMarkets}
                sportmonksMarketId={oddsFilter === "handicap" ? 6 : 7}
                outcomeLabel={oddsFilter === "handicap" ? "Home" : "Over"}
                line={
                  oddsFilter === "handicap"
                    ? (cardEntry1?.handicap ?? null)
                    : (cardEntry1?.total ?? null)
                }
                fallbackValue={compoundEmptyEffective ? "—" : cardCol1}
                enabled={isVisible && !compoundEmptyEffective}
              >
                {(value, ref, meta) => (
                  <div ref={ref}>
                    <SingleCompoundOddsBtn
                      label={compoundLabel1}
                      value={value}
                      selId={compoundEmptyEffective ? null : (sel1?.id ?? null)}
                      onClick={
                        compoundEmptyEffective || !sel1
                          ? undefined
                          : (e) => handleOddsClick(e, sel1.sel)
                      }
                      bettingClosed={!effectiveEnableBet}
                      locked={meta.locked}
                    />
                  </div>
                )}
              </LiveOdds>
              <LiveOdds
                markets={onchainMarkets}
                sportmonksMarketId={oddsFilter === "handicap" ? 6 : 7}
                outcomeLabel={oddsFilter === "handicap" ? "Away" : "Under"}
                line={
                  oddsFilter === "handicap"
                    ? (cardEntry3?.handicap ?? null)
                    : (cardEntry3?.total ?? null)
                }
                fallbackValue={compoundEmptyEffective ? "—" : cardCol3}
                enabled={isVisible && !compoundEmptyEffective}
              >
                {(value, ref, meta) => (
                  <div ref={ref}>
                    <SingleCompoundOddsBtn
                      label={compoundLabel2}
                      value={value}
                      selId={compoundEmptyEffective ? null : (sel3?.id ?? null)}
                      onClick={
                        compoundEmptyEffective || !sel3
                          ? undefined
                          : (e) => handleOddsClick(e, sel3.sel)
                      }
                      bettingClosed={!effectiveEnableBet}
                      locked={meta.locked}
                    />
                  </div>
                )}
              </LiveOdds>
            </div>
          </div>
        ) : effectiveCompact ? (
          <div
            className={`shrink-0 grid grid-cols-[auto_auto_auto] gap-y-[4px] gap-x-[10px] text-center text-[14px] leading-[19px]${display.isFallback ? " opacity-40" : ""}`}
          >
            <span className="font-medium text-secondary">{display.header1}</span>
            <span className="font-medium text-secondary">{display.header2}</span>
            <span className="font-medium text-secondary">{display.header3}</span>
            {noOdds ? (
              <div className="col-span-3 flex items-center justify-center gap-[6px]">
                <LockSimpleIcon size={14} weight="fill" className="text-secondary" />
                <span className="font-medium text-secondary">{t("oddsPending")}</span>
              </div>
            ) : (
              <>
                <LiveOdds
                  markets={onchainMarkets}
                  sportmonksMarketId={1}
                  outcomeLabel="Home"
                  fallbackValue={display.col1}
                  enabled={isVisible}
                >
                  {(value, ref, meta) => (
                    <div ref={ref}>
                      <OddsBtn
                        compact
                        value={value}
                        selId={sel1?.id ?? null}
                        onClick={sel1 ? (e) => handleOddsClick(e, sel1.sel) : undefined}
                        bettingClosed={!effectiveEnableBet}
                        locked={meta.locked}
                      />
                    </div>
                  )}
                </LiveOdds>
                {sel2 ? (
                  <LiveOdds
                    markets={onchainMarkets}
                    sportmonksMarketId={1}
                    outcomeLabel="Draw"
                    fallbackValue={display.col2}
                    enabled={isVisible}
                  >
                    {(value, ref, meta) => (
                      <div ref={ref}>
                        <OddsBtn
                          compact
                          value={value}
                          selId={sel2.id}
                          onClick={(e) => handleOddsClick(e, sel2.sel)}
                          bettingClosed={!effectiveEnableBet}
                          locked={meta.locked}
                        />
                      </div>
                    )}
                  </LiveOdds>
                ) : (
                  <span className="font-medium text-secondary">{display.col2}</span>
                )}
                <LiveOdds
                  markets={onchainMarkets}
                  sportmonksMarketId={1}
                  outcomeLabel="Away"
                  fallbackValue={display.col3}
                  enabled={isVisible}
                >
                  {(value, ref, meta) => (
                    <div ref={ref}>
                      <OddsBtn
                        compact
                        value={value}
                        selId={sel3?.id ?? null}
                        onClick={sel3 ? (e) => handleOddsClick(e, sel3.sel) : undefined}
                        bettingClosed={!effectiveEnableBet}
                        locked={meta.locked}
                      />
                    </div>
                  )}
                </LiveOdds>
              </>
            )}
          </div>
        ) : (
          <div
            className={`shrink-0 grid grid-cols-[48px_48px_48px] lg:grid-cols-[64px_64px_64px] gap-y-[4px] gap-x-[8px] lg:gap-x-[16px] text-center text-[12px] lg:text-[14px] leading-[18px] lg:leading-[19px]${display.isFallback ? " opacity-40" : ""}`}
          >
            <span className="flex items-center justify-center h-[20px] px-[10px] rounded-8 lg:h-auto lg:px-0 lg:rounded-none font-normal lg:font-medium text-secondary">
              {display.header1}
            </span>
            <span className="flex items-center justify-center h-[20px] px-[10px] rounded-8 lg:h-auto lg:px-0 lg:rounded-none font-normal lg:font-medium text-secondary">
              {display.header2}
            </span>
            <span className="flex items-center justify-center h-[20px] px-[10px] rounded-8 lg:h-auto lg:px-0 lg:rounded-none font-normal lg:font-medium text-secondary">
              {display.header3}
            </span>
            {noOdds ? (
              <div className="col-span-3 flex items-center justify-center gap-[6px] h-[20px] lg:h-[32px]">
                <LockSimpleIcon size={14} weight="fill" className="text-secondary" />
                <span className="font-medium text-secondary">{t("oddsPending")}</span>
              </div>
            ) : (
              <>
                <LiveOdds
                  markets={onchainMarkets}
                  sportmonksMarketId={1}
                  outcomeLabel="Home"
                  fallbackValue={display.col1}
                  enabled={isVisible}
                >
                  {(value, ref, meta) => (
                    <div ref={ref}>
                      <OddsBtn
                        value={value}
                        selId={sel1?.id ?? null}
                        onClick={sel1 ? (e) => handleOddsClick(e, sel1.sel) : undefined}
                        bettingClosed={!effectiveEnableBet}
                        locked={meta.locked}
                      />
                    </div>
                  )}
                </LiveOdds>
                {sel2 ? (
                  <LiveOdds
                    markets={onchainMarkets}
                    sportmonksMarketId={1}
                    outcomeLabel="Draw"
                    fallbackValue={display.col2}
                    enabled={isVisible}
                  >
                    {(value, ref, meta) => (
                      <div ref={ref}>
                        <OddsBtn
                          value={value}
                          selId={sel2.id}
                          onClick={(e) => handleOddsClick(e, sel2.sel)}
                          bettingClosed={!effectiveEnableBet}
                          locked={meta.locked}
                        />
                      </div>
                    )}
                  </LiveOdds>
                ) : (
                  <span className="flex items-center justify-center h-[20px] lg:h-[32px] font-medium text-secondary">
                    {display.col2}
                  </span>
                )}
                <LiveOdds
                  markets={onchainMarkets}
                  sportmonksMarketId={1}
                  outcomeLabel="Away"
                  fallbackValue={display.col3}
                  enabled={isVisible}
                >
                  {(value, ref, meta) => (
                    <div ref={ref}>
                      <OddsBtn
                        value={value}
                        selId={sel3?.id ?? null}
                        onClick={sel3 ? (e) => handleOddsClick(e, sel3.sel) : undefined}
                        bettingClosed={!effectiveEnableBet}
                        locked={meta.locked}
                      />
                    </div>
                  )}
                </LiveOdds>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
