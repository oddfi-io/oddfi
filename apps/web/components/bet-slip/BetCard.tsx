"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { MinusCircleIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { parseUnits } from "viem";
import { useBetSlipStore } from "@/stores/betSlipStore";
import { getMarketFixtureDetail } from "@/lib/api";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import {
  MIN_BET_ODD,
  isStakeBelowMin,
  toOddAmount,
  isTestFixtureId,
} from "@/lib/betting/constants";
import { mul, formatAmount } from "@/lib/decimal";
import { usePreviewSignal } from "@/hooks/usePreviewSignal";
import {
  useOnchainMarketsByFixture,
  selectOnchainMarketForEntry,
} from "@/hooks/useOnchainMarketBySelection";
import { useLiveOddsForEntry } from "@/hooks/useLiveOddsForEntry";
import { flashOddsDirection } from "@/lib/betslip-animations";
import { ODDS_LOCKED_TEXT } from "@/lib/odds";
import SignalLightIndicator, { isSignalDisabled } from "./SignalLightIndicator";
import CircleFlag from "@/components/icons/CircleFlag";
import PlayerAvatar from "@/components/banner-detail/PlayerAvatar";
import type { BetSelection } from "@/types/betting";

/** BetSelection.marketType → sportmonks market_id（1X2=1 / AH=6 / Total=7） */
const MARKET_TYPE_TO_SPORTMONKS: Record<BetSelection["marketType"], number> = {
  "1x2": 1,
  asian_handicap: 6,
  asian_total: 7,
};

type CanonicalOutcomeLabel = "Home" | "Draw" | "Away" | "Over" | "Under";

const CANONICAL_OUTCOME_LABELS = new Set<string>(["Home", "Draw", "Away", "Over", "Under"]);

/**
 * 把 BetSelection.selection 收敛到合约 outcome label 域。
 * 实际值在主下注流程是 "Home"/"Draw"/"Away"/"Over"/"Under"；
 * banner 类下注的 selection 是球员名等任意串 — 此时返回 null，hook 走 fallback。
 */
function normalizeOutcomeLabel(raw: string): CanonicalOutcomeLabel | null {
  return CANONICAL_OUTCOME_LABELS.has(raw) ? (raw as CanonicalOutcomeLabel) : null;
}

/**
 * DD-119: AH 的 line 必须用主队视角 line_value 才能匹配链上盘口。
 * 链上 `line_value` = 主队 handicap（match-utils 也用 home handicap 作 hLineValue，故列表/详情
 * home+away 都传同一主队视角值能匹配）。但 betslip 的 `selection.handicap` 是该 outcome 自己的
 * 视角：主队为主队视角、客队为客队视角。AH 中两侧 handicap 互为相反数，故客队取反即主队视角。
 * 不归一会导致 betslip 客队 AH 匹配不到盘口 → 停在加入时快照（不实时刷新）。
 */
function homePerspectiveLine(
  sel: BetSelection,
  label: CanonicalOutcomeLabel | null
): string | null {
  if (sel.marketType === "asian_handicap" && sel.handicap) {
    if (label === "Away") {
      const n = Number(sel.handicap);
      return Number.isFinite(n) ? String(-n) : sel.handicap;
    }
    return sel.handicap; // 主队视角即 line_value
  }
  return sel.handicap ?? sel.total ?? null;
}

/** 球员类 banner（金球 / 金靴 / 金手套）— BetCard 头像走 PlayerAvatar 而非国旗 */
const PLAYER_MARKETS = new Set(["golden_ball", "golden_boot", "golden_glove"]);

/** Derive localized display strings from current-locale fixture cache */
function useLocalizedSelection(sel: BetSelection) {
  const t = useTranslations("markets");
  const locale = useLocale();
  const { data: fixture } = useQuery({
    queryKey: ["market-fixture", sel.fixtureId, locale],
    queryFn: () =>
      getMarketFixtureDetail(sel.fixtureId, "statis", { locale }).then((arr) => arr?.[0]),
    staleTime: 60_000,
  });

  const home = fixture?.participants.find((p) => p.meta.location === "home");
  const away = fixture?.participants.find((p) => p.meta.location === "away");

  const fixtureName = fixture?.name ?? sel.fixtureName;

  const marketDescription =
    sel.marketType === "asian_handicap"
      ? t("asianHandicap")
      : sel.marketType === "asian_total"
        ? t("asianTotal")
        : sel.marketDescription;

  let displayLabel = sel.displayLabel;
  if (sel.selection === "Draw") displayLabel = t("draw");
  else if (sel.selection === "Over" && sel.total) displayLabel = t("overLine", { line: sel.total });
  else if (sel.selection === "Under" && sel.total)
    displayLabel = t("underLine", { line: sel.total });
  else if (sel.selection === "Home" && home)
    displayLabel = sel.handicap ? `${home.name} ${sel.handicap}` : `${home.name} ${t("win")}`;
  else if (sel.selection === "Away" && away)
    displayLabel = sel.handicap ? `${away.name} ${sel.handicap}` : `${away.name} ${t("win")}`;

  return { fixtureName, marketDescription, displayLabel };
}

interface BetCardProps {
  selection: BetSelection;
  showAmountInput?: boolean;
  mobile?: boolean;
}

function BetCard({ selection, showAmountInput, mobile }: BetCardProps) {
  const t = useTranslations("betSlip");
  const { fixtureName, marketDescription, displayLabel } = useLocalizedSelection(selection);
  const removeSelection = useBetSlipStore((s) => s.removeSelection);
  const requestRemoval = useBetSlipStore((s) => s.requestRemoval);
  const confirmRemoval = useBetSlipStore((s) => s.confirmRemoval);
  const clearNewest = useBetSlipStore((s) => s.clearNewest);
  const clearFocusAfterRemoval = useBetSlipStore((s) => s.clearFocusAfterRemoval);
  const setAmount = useBetSlipStore((s) => s.setAmount);
  const amount = useBetSlipStore((s) => s.amounts[selection.id] || "");
  const isNewest = useBetSlipStore((s) => s.newestSelectionId === selection.id);
  const isPendingRemoval = useBetSlipStore((s) => s.pendingRemovalId === selection.id);
  // DD-119 P2 — 部分成交结果（BetSummary 提交后写入）：卡下黄字文案
  const partialFill = useBetSlipStore((s) => s.partialFillById[selection.id]);
  const isFocusAfterRemoval = useBetSlipStore((s) => s.focusAfterRemovalId === selection.id);
  const cardRef = useRef<HTMLDivElement>(null);
  const { canConvert, convert, rate } = useCurrencyDisplay();
  const unitLabel = canConvert ? "USD" : PLATFORM_TOKEN_DISPLAY;
  const { data: accountBalance } = useAccountBalance();
  const balance = accountBalance?.available_balance ?? "0";
  const mode = useBetSlipStore((s) => s.mode);
  const [inputFocused, setInputFocused] = useState(false);

  // DD-118 Phase C: BetCard 锁定赔率走 WS 推送（命中链上盘口才生效）
  // banner-* 类下注 selection 是球员名 → normalizeOutcomeLabel 返回 null → hook 走 fallback
  const canonicalLabel = normalizeOutcomeLabel(selection.selection);
  const { markets: onchainMarkets } = useOnchainMarketsByFixture(selection.fixtureId);
  const live = useLiveOddsForEntry({
    markets: onchainMarkets,
    sportmonksMarketId: MARKET_TYPE_TO_SPORTMONKS[selection.marketType],
    line: homePerspectiveLine(selection, canonicalLabel),
    outcomeLabel: canonicalLabel ?? "Home", // sentinel; enabled=false 时不查询
    fallbackValue: selection.odds,
    enabled: canonicalLabel !== null,
  });
  // DD-119 P2: WS 盘口级红灯（signal===3 停收）→ 赔率锁 "--" + 卡片 blocked 态 + 禁提交
  const blocked = live.signal === 3;
  const oddsRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // 红灯锁定格不参与变动（PRD §3.3 规则 3）
    if (blocked || !live.flashDirection || !oddsRef.current) return;
    flashOddsDirection(oddsRef.current, live.flashDirection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.flashSignature]);

  // 折算到 ODD 后做最低金额校验（合约校验在 ODD 维度）。
  // 与 BetSummary 共用 toOddAmount 工具，避免两处实现漂移（M-01 修复）。
  const oddAmount = toOddAmount(amount, canConvert, rate);
  const showBelowMinWarning = showAmountInput && isStakeBelowMin(oddAmount);

  // ─── DD-117 信号灯接入 ─────────────────────────────────────────────────────
  // 触发条件：single + 真实赛事 + 非 banner selection
  // （DD-147：testnet/mainnet 链上行为统一，删除 IS_TESTNET 业务闸，门控收敛到 single + 真实赛事）
  // 焦点限流（DD-117 §3.3 方案 A）：仅在输入框 focus 且金额 > 0 时启用 hook
  const goesOnchain =
    mode === "single" && !isTestFixtureId(selection.fixtureId) && !selection.bannerMeta;

  // DD-118/119 合并：信号灯预览与 live 赔率共用同一套盘口匹配（selectOnchainMarketForEntry），
  // 复用上面已拉的 onchainMarkets。AH/Total 依赖后端 line_value；缺失时 marketId=null →
  // previewSignal 自然禁用（与 live 赔率的降级口径一致）。
  const onchainLookup = goesOnchain
    ? selectOnchainMarketForEntry({
        markets: onchainMarkets,
        sportmonksMarketId: MARKET_TYPE_TO_SPORTMONKS[selection.marketType],
        line: homePerspectiveLine(selection, canonicalLabel),
        outcomeLabel: canonicalLabel ?? "Home",
      })
    : { marketId: null, outcomeIndex: null };

  const amountWei =
    goesOnchain && oddAmount && oddAmount !== "0"
      ? (() => {
          try {
            return parseUnits(oddAmount, 18).toString();
          } catch {
            return null;
          }
        })()
      : null;

  const previewState = usePreviewSignal({
    marketId: onchainLookup.marketId,
    outcome: onchainLookup.outcomeIndex,
    amountWei,
    enabled: goesOnchain && inputFocused,
  });

  // 把 signal 禁用状态发布到 store，供 BetSummary submit 按钮门控（REV-v3 C-01 修复）
  const setSignalDisabledInStore = useBetSlipStore((s) => s.setSignalDisabled);
  useEffect(() => {
    if (!goesOnchain) {
      setSignalDisabledInStore(selection.id, false);
      return;
    }
    // DD-119 P2 场景2：WS 盘口红灯（blocked）即使输入框未聚焦（previewState idle）也必须禁提交
    setSignalDisabledInStore(selection.id, blocked || isSignalDisabled(previewState));
  }, [goesOnchain, blocked, previewState, selection.id, setSignalDisabledInStore]);
  // ──────────────────────────────────────────────────────────────────────────

  // PC: two-phase removal with exit animation; H5: instant removal
  const handleRemove = useCallback(() => {
    if (mobile) {
      removeSelection(selection.id);
    } else {
      requestRemoval(selection.id);
    }
  }, [mobile, removeSelection, requestRemoval, selection.id]);

  // PC entry animation — WAAPI (replaces unreliable CSS class approach)
  useEffect(() => {
    if (mobile || !isNewest || !cardRef.current) return;
    const el = cardRef.current;
    const anim = el.animate(
      [
        { transform: "translateY(20px)", opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: 250, easing: "ease-out", fill: "backwards" }
    );
    anim.onfinish = () => clearNewest();
    return () => anim.cancel();
  }, [mobile, isNewest, clearNewest]);

  // PC exit animation — WAAPI + collapse (ref: betCardSlideOut in prototype HTML)
  useEffect(() => {
    if (mobile || !isPendingRemoval || !cardRef.current) return;
    const el = cardRef.current;
    const h = el.offsetHeight;
    const anim = el.animate(
      [
        { transform: "translateY(0)", opacity: 1, maxHeight: `${h}px`, marginBottom: "16px" },
        { transform: "translateY(20px)", opacity: 0, maxHeight: "0px", marginBottom: "0px" },
      ],
      { duration: 250, easing: "ease-in", fill: "forwards" }
    );
    anim.onfinish = () => confirmRemoval();
    // Fallback timer in case onfinish doesn't fire
    const timer = setTimeout(confirmRemoval, 280);
    return () => {
      anim.cancel();
      clearTimeout(timer);
    };
  }, [mobile, isPendingRemoval, confirmRemoval]);

  // PC: auto-focus previous card after deletion — WAAPI outline pulse
  useEffect(() => {
    if (mobile || !isFocusAfterRemoval || !cardRef.current) return;
    const el = cardRef.current;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const anim = el.animate(
      [
        { outline: "2px solid rgba(237,116,66,0)", outlineOffset: "0px" },
        { outline: "2px solid rgba(237,116,66,0.5)", outlineOffset: "0px" },
        { outline: "2px solid rgba(237,116,66,0)", outlineOffset: "0px" },
      ],
      { duration: 500, easing: "ease-out" }
    );
    anim.onfinish = () => clearFocusAfterRemoval();
    const timer = setTimeout(clearFocusAfterRemoval, 550);
    return () => {
      anim.cancel();
      clearTimeout(timer);
    };
  }, [mobile, isFocusAfterRemoval, clearFocusAfterRemoval]);

  return (
    <div
      ref={cardRef}
      data-newest={isNewest || undefined}
      className={`${
        mobile
          ? `bg-secondary border rounded-16 overflow-hidden shrink-0 ${blocked ? "border-fn-red/45" : "border-secondary"}`
          : `rounded-16 overflow-hidden shrink-0 border ${
              blocked ? "border-fn-red/45" : isNewest ? "border-dt-hover/40" : "border-transparent"
            }`
      }`}
    >
      {/* Top header bar */}
      <div className="bg-secondary h-[40px] flex items-center justify-between pl-[16px]">
        <span className="text-secondary text-[12px] font-medium truncate mr-[8px]">
          {fixtureName}
        </span>
        <button
          type="button"
          className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={handleRemove}
          aria-label="Remove selection"
        >
          <MinusCircleIcon size={20} className="text-secondary" />
        </button>
      </div>

      {/* Body — Figma 816:64570: px-16 pt-4 pb-16 gap-12 */}
      <div
        className={`bg-secondary px-[16px] ${mobile ? "pt-[4px]" : "pt-[8px]"} pb-[16px] flex flex-col gap-[12px]`}
      >
        {/* Figma 816:64571: market info group — gap-4 between type and selection */}
        <div className={mobile ? "flex flex-col gap-[4px]" : "flex flex-col gap-[6px]"}>
          <span className="text-secondary text-[12px] font-medium">{marketDescription}</span>

          <div className="flex items-center justify-between gap-[8px]">
            <div className="flex items-center gap-[8px] min-w-0">
              {selection.bannerMeta &&
                (PLAYER_MARKETS.has(selection.bannerMeta.market) ? (
                  <PlayerAvatar name={selection.selection} size={20} className="shrink-0" />
                ) : (
                  selection.bannerMeta.countryCode && (
                    <CircleFlag
                      code={selection.bannerMeta.countryCode}
                      size={20}
                      className="shrink-0"
                    />
                  )
                ))}
              <span className="text-primary text-[14px] font-medium truncate">{displayLabel}</span>
            </div>
            <span
              ref={oddsRef}
              className={`${
                mobile
                  ? "text-[14px] leading-[19px] font-bold shrink-0"
                  : "text-[18px] leading-[26px] font-bold shrink-0"
              } ${blocked ? "text-tertiary opacity-45" : "text-brand-default"}`}
            >
              {blocked ? ODDS_LOCKED_TEXT : `${live.displayValue}x`}
            </span>
          </div>
        </div>

        {/* Amount input (single mode) / Combo warning (multi mode + banner item) */}
        {/* @figma-hardcoded: #1c1c1f bet-input-bg — pending design token */}
        {showAmountInput ? (
          <div className="flex flex-col gap-[6px]">
            <div
              className={`${mobile ? "bg-tertiary h-[40px]" : "bg-[#1c1c1f] h-[48px]"} rounded-8 px-[16px] flex items-center justify-between ${
                showBelowMinWarning ? "border border-dt-error" : ""
              } ${blocked ? "opacity-45" : ""}`}
            >
              <input
                type="text"
                inputMode="decimal"
                placeholder={t("inputAmount")}
                value={amount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(selection.id, v);
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                className="bg-transparent text-primary text-[14px] placeholder:text-tertiary
                  focus:outline-none w-full min-w-0"
              />
              <div className="flex items-center gap-[8px] shrink-0 ml-[8px]">
                <span className="text-primary text-[14px] font-medium">{unitLabel}</span>
                <button
                  type="button"
                  className="text-brand-default text-[14px] font-medium"
                  onClick={() => setAmount(selection.id, canConvert ? convert(balance) : balance)}
                >
                  {t("max")}
                </button>
              </div>
            </div>
            {showBelowMinWarning && (
              <p className="text-fn-red text-[12px] leading-[16px]">
                {canConvert && rate
                  ? t("minBetWarning", {
                      min: formatAmount(mul(String(MIN_BET_ODD), rate), 2),
                      symbol: "USD",
                    })
                  : t("minBetWarning", {
                      min: MIN_BET_ODD,
                      symbol: PLATFORM_TOKEN_DISPLAY,
                    })}
              </p>
            )}
            {/* blocked（WS 盘口红灯）时由下方 blockedRedline 文案接管，隐藏金额预览指示器 */}
            {goesOnchain && !blocked && <SignalLightIndicator state={previewState} />}
          </div>
        ) : selection.bannerMeta ? (
          <div className="bg-tag-yellow rounded-8 p-[12px] flex items-center gap-[8px]">
            <WarningCircleIcon size={16} className="text-fn-yellow shrink-0" weight="fill" />
            <span className="text-fn-yellow text-[12px] leading-[18px]">
              {t("cannotPlaceComboOrder")}
            </span>
          </div>
        ) : null}

        {/* DD-119 P2 场景2/3：盘口红灯停收 → 卡下红字文案（HTML .sel-blocked） */}
        {blocked && (
          <p className="flex items-center gap-[6px] text-fn-red text-[12px] font-semibold leading-[1.5]">
            <XCircleIcon size={14} weight="fill" className="shrink-0" />
            <span>{t("blockedRedline")}</span>
          </p>
        )}

        {/* DD-119 P2 部分成交：卡下黄字文案（HTML .sel-partfill），preview 估值口径 */}
        {!blocked && partialFill && (
          <p className="text-fn-yellow text-[12px] font-semibold leading-[1.5]">
            {t("partialFill", {
              accepted: partialFill.accepted,
              origin: partialFill.origin,
              remain: partialFill.remain,
            })}
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(BetCard);
