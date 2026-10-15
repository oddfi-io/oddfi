"use client";

import { memo, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDisplayAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { formatMatchTimeLocal, formatRelativeTime } from "@/lib/format/relative-time";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { translateMarketType } from "@/lib/market-type-i18n"; // @mock-market-type
import { CaretDownIcon } from "@phosphor-icons/react";
import { TeamVsAvatars } from "@/components/ui/TeamVsAvatars";
import SortHeader from "@/components/portfolio/common/SortHeader";
import {
  statusColor,
  statusI18nKey,
  claimButtonKey,
  payoutDisplay,
} from "@/lib/portfolio/settle-display";
import { TeamVsVerticalCell } from "./TeamVsVerticalCell";
import { BetTypeCell } from "./BetTypeCell";
import PortfolioBannerCell from "./PortfolioBannerCell";
import OnchainBadge from "./OnchainBadge";
import type { BetsSortColumn, BetsSortState } from "./bets-sort";
import type { PortfolioBet } from "@/types/portfolio";

// SettledBetsTable (PC · DD-115) — Figma 6712:102854
// 行路由：parlay → MultiSettledRow（父单 + 展开 parlay_legs）
//        single / onchain_single → SingleSettledRow（onchain 行追加 OnchainBadge）
// onchain_parlay 合约不支持，后端不返回，无兜底分支。

/** 货币显示派生（父级一次订阅、props 下传，避免每行重订阅 store） */
type CurrencyView = { showUsd: boolean; hasRate: boolean };

// 单注 row（business_type ∈ { single, onchain_single, banner_single }）
function SingleSettledRowImpl({
  bet,
  t,
  onClaim,
  isLast,
  currency,
}: {
  bet: PortfolioBet;
  t: ReturnType<typeof useTranslations>;
  onClaim?: (bet: PortfolioBet) => void;
  isLast: boolean;
  currency: CurrencyView;
}) {
  const color = statusColor(bet.settlementStatus);
  const payout = payoutDisplay(bet);
  const { showUsd, hasRate } = currency;
  const settledTimeText = bet.settledAt ? formatRelativeTime(bet.settledAt) : "";
  const showClaimBtn = bet.claimable && !bet.viewOnly;

  return (
    <div
      className={`${isLast ? "" : "border-b border-secondary"} relative flex items-center h-[120px] py-[16px]`}
    >
      {/* 链上标签 — 左上角贴边绝对定位，脱离行内 Flex 流，零布局影响（样式镜像质押右上角小标签） */}
      {bet.isOnchain && (
        <span className="absolute top-0 left-0 z-10 flex">
          <OnchainBadge corner />
        </span>
      )}

      {/* Match 列 — Figma 6712:103076 · w-[243px] pl-60 pr-24 */}
      <div className="w-[243px] shrink-0 pl-[60px] pr-[24px] h-full flex items-center">
        {bet.banner ? (
          // banner_single：复用现有 banner cell（标题 + tag），无 vs / 比分
          <PortfolioBannerCell bet={bet} avatarSize={40} />
        ) : (
          <TeamVsVerticalCell
            home={bet.homeTeam}
            away={bet.awayTeam}
            homeScore={bet.homeScore}
            awayScore={bet.awayScore}
          />
        )}
      </div>

      {/* Date of Event 列 — w-168 px-16，比赛开始时间 */}
      <div className="w-[168px] shrink-0 px-[16px]">
        <span className="text-[12px] font-medium leading-[18px] text-secondary">
          {formatMatchTimeLocal(bet.matchTime) || "—"}
        </span>
      </div>

      {/* Bet Type 列 — w-120，玩法 / 盘口 / 倍数 */}
      <BetTypeCell
        marketLabel={translateMarketType(bet.marketTag, t)}
        handicapLine={bet.handicapLine}
        odds={bet.odds}
      />

      {/* Result 列 — flex-1，Orbitron Bold uppercase */}
      <div className="flex-1 px-[16px]">
        <span
          className={`text-[14px] font-bold uppercase leading-normal ${color}`}
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          {t(statusI18nKey(bet.settlementStatus))}
        </span>
      </div>

      {/* Bet 列 — flex-1，stake 绝对值 + USD */}
      <div className="flex-1 px-[16px]">
        <div className="flex flex-col">
          <span className="text-[14px] font-bold leading-[18px] text-primary whitespace-nowrap">
            {showUsd
              ? `${formatDisplayAmount(bet.betAmountUsd)} USD`
              : `${formatDisplayAmount(bet.betAmount)} ${PLATFORM_TOKEN_DISPLAY}`}
          </span>
          {hasRate && (
            <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50 whitespace-nowrap">
              ≈{" "}
              {showUsd
                ? `${formatDisplayAmount(bet.betAmount)} ${PLATFORM_TOKEN_DISPLAY}`
                : `$${formatDisplayAmount(bet.betAmountUsd)}`}
            </span>
          )}
          {/* 链上部分成交退回（红灯撮合）：betAmount 已是真实成交本金，此处补退回量 */}
          {bet.refundAmount && (
            <span className="text-[12px] font-medium leading-[18px] text-secondary whitespace-nowrap">
              {t("partialRefund", {
                amount: `${formatDisplayAmount(bet.refundAmount)} ${PLATFORM_TOKEN_DISPLAY}`,
              })}
            </span>
          )}
        </div>
      </div>

      {/* Payout 列 — flex-1，签名金额 + USD */}
      <div className="flex-1 px-[16px]">
        <div className="flex flex-col">
          <span className={`text-[14px] font-bold leading-[18px] whitespace-nowrap ${color}`}>
            {payout.prefix}
            {showUsd
              ? `${formatDisplayAmount(payout.usd)} USD`
              : `${formatDisplayAmount(payout.amount)} ${PLATFORM_TOKEN_DISPLAY}`}
          </span>
          {hasRate && (
            <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50 whitespace-nowrap">
              ≈{" "}
              {showUsd
                ? `${formatDisplayAmount(payout.amount)} ${PLATFORM_TOKEN_DISPLAY}`
                : `$${formatDisplayAmount(payout.usd)}`}
            </span>
          )}
        </div>
      </div>

      {/* Settle time 列 — w-166 px-16 */}
      <div className="w-[166px] shrink-0 px-[16px]">
        <span className="text-[14px] font-medium leading-[18px] text-tertiary">
          {settledTimeText || "—"}
        </span>
      </div>

      {/* Actions 列 — flex-1 px-24（链上标签已移至行左上角，此处只剩领奖按钮，不再撑宽列） */}
      <div className="flex-1 px-[24px] flex items-center justify-end">
        {showClaimBtn && (
          <button
            onClick={() => onClaim?.(bet)}
            className="flex items-center justify-center min-h-[44px] shrink-0 touch-manipulation"
          >
            {/* @figma-hardcoded: #04060c static-black — pending design token */}
            <span className="flex items-center justify-center h-[32px] px-[12px] rounded-8 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]">
              <span className="text-[12px] font-medium text-[#04060c] leading-[18px] whitespace-nowrap">
                {t(claimButtonKey(bet.settlementStatus))}
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 串关子腿展开行（仅在 MultiSettledRow 展开时渲染）────────────────────────
// 沿用 SingleSettledRow 7 列布局，但金额维度三列（Bet / Payout / Settle time）
// 统一渲染 "--"，因为 parlay_legs[] 子腿不带这些字段（DD-115 §3.3）。
function SubLegRow({ leg, t }: { leg: PortfolioBet; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="border-b border-secondary flex items-center h-[120px] py-[16px] bg-white/[0.02]">
      <div className="w-[243px] shrink-0 pl-[60px] pr-[24px] h-full flex items-center">
        <TeamVsVerticalCell
          home={leg.homeTeam}
          away={leg.awayTeam}
          homeScore={leg.homeScore}
          awayScore={leg.awayScore}
        />
      </div>
      <div className="w-[168px] shrink-0 px-[16px]">
        <span className="text-[12px] font-medium leading-[18px] text-secondary">
          {formatMatchTimeLocal(leg.matchTime) || "—"}
        </span>
      </div>
      <BetTypeCell
        marketLabel={translateMarketType(leg.marketTag, t)}
        handicapLine={leg.handicapLine}
        odds={leg.odds}
      />
      <div className="flex-1 px-[16px]">
        <span
          className={`text-[14px] font-bold uppercase leading-normal ${statusColor(leg.settlementStatus)}`}
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          {t(statusI18nKey(leg.settlementStatus))}
        </span>
      </div>
      {/* 子腿 Bet / Payout / Settle time 三列固定 "--"（金额维度只在父单层有效） */}
      <div className="flex-1 px-[16px]">
        <span className="text-[14px] font-bold leading-[18px] text-primary">--</span>
      </div>
      <div className="flex-1 px-[16px]">
        <span className="text-[14px] font-bold leading-[18px] text-primary">--</span>
      </div>
      <div className="w-[166px] shrink-0 px-[16px]">
        <span className="text-[14px] font-medium leading-[18px] text-tertiary">--</span>
      </div>
      <div className="flex-1 px-[24px]" />
    </div>
  );
}

// ─── 串关 row（business_type === "parlay"）──────────────────────────────────
// Figma 6714:103300：父单汇总行 + 可展开子腿列表
// - 父单行：CaretDown + 双头像 + "N Leg Multi" 占合并的 Match+Date(w-411) 列
// - 子腿行：使用 SubLegRow，Bet / Payout / Settle time 固定 "--"
function MultiSettledRowImpl({
  bet,
  t,
  onClaim,
  isLast,
  currency,
}: {
  bet: PortfolioBet;
  t: ReturnType<typeof useTranslations>;
  onClaim?: (bet: PortfolioBet) => void;
  isLast: boolean;
  currency: CurrencyView;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = statusColor(bet.settlementStatus);
  const payout = payoutDisplay(bet);
  const { showUsd, hasRate } = currency;
  const settledTimeText = bet.settledAt ? formatRelativeTime(bet.settledAt) : "";
  const showClaimBtn = bet.claimable && !bet.viewOnly;
  const legs = bet.legs ?? [];
  const legCount = bet.legCount ?? legs.length;
  const canExpand = legs.length > 0;
  // 头像取首腿主客队（无 legs 时回退父单 home/away）
  const avatarHome = legs[0]?.homeTeam ?? bet.homeTeam;
  const avatarAway = legs[0]?.awayTeam ?? bet.awayTeam;

  return (
    <div className={isLast && !expanded ? "" : "border-b border-secondary"}>
      {/* 父单汇总行 */}
      <div className="flex items-center h-[120px] py-[16px]">
        {/* Match + Date 合并列：w-411 pl-16 — 24px 折叠图标 + 48 双头像 + N Leg Multi */}
        <div className="w-[411px] shrink-0 pl-[16px] flex items-center gap-[16px]">
          <button
            type="button"
            onClick={() => canExpand && setExpanded((v) => !v)}
            disabled={!canExpand}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse legs" : "Expand legs"}
            className={`size-[24px] rounded-6 flex items-center justify-center shrink-0 ${
              canExpand ? "hover:bg-secondary cursor-pointer" : "opacity-30 cursor-not-allowed"
            }`}
          >
            <CaretDownIcon
              size={20}
              className={`text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          <TeamVsAvatars home={avatarHome} away={avatarAway} size={48} />
          <span className="text-[14px] font-bold leading-[18px] text-primary">
            {legCount} Leg Multi
          </span>
        </div>

        {/* Bet Type 列 — 父单仅显示总赔率（单行） */}
        <div className="w-[120px] shrink-0 px-[16px]">
          <span className="text-[11px] font-medium leading-[16px] text-brand-default whitespace-nowrap">
            {bet.odds} x
          </span>
        </div>

        {/* Result 列 */}
        <div className="flex-1 px-[16px]">
          <span
            className={`text-[14px] font-bold uppercase leading-normal ${color}`}
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {t(statusI18nKey(bet.settlementStatus))}
          </span>
        </div>

        {/* Bet 列 — 父单 stake */}
        <div className="flex-1 px-[16px]">
          <div className="flex flex-col">
            <span className="text-[14px] font-bold leading-[18px] text-primary">
              {showUsd
                ? `${formatDisplayAmount(bet.betAmountUsd)} USD`
                : `${formatDisplayAmount(bet.betAmount)} ${PLATFORM_TOKEN_DISPLAY}`}
            </span>
            {hasRate && (
              <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50">
                ≈{" "}
                {showUsd
                  ? `${formatDisplayAmount(bet.betAmount)} ${PLATFORM_TOKEN_DISPLAY}`
                  : `$${formatDisplayAmount(bet.betAmountUsd)}`}
              </span>
            )}
          </div>
        </div>

        {/* Payout 列 — 父单签名金额 */}
        <div className="flex-1 px-[16px]">
          <div className="flex flex-col">
            <span className={`text-[14px] font-bold leading-[18px] ${color}`}>
              {payout.prefix}
              {showUsd
                ? `${formatDisplayAmount(payout.usd)} USD`
                : `${formatDisplayAmount(payout.amount)} ${PLATFORM_TOKEN_DISPLAY}`}
            </span>
            {hasRate && (
              <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50">
                ≈{" "}
                {showUsd
                  ? `${formatDisplayAmount(payout.amount)} ${PLATFORM_TOKEN_DISPLAY}`
                  : `$${formatDisplayAmount(payout.usd)}`}
              </span>
            )}
          </div>
        </div>

        {/* Settle time 列 */}
        <div className="w-[166px] shrink-0 px-[16px]">
          <span className="text-[14px] font-medium leading-[18px] text-tertiary">
            {settledTimeText || "—"}
          </span>
        </div>

        {/* Actions 列 */}
        <div className="flex-1 px-[24px] flex items-center justify-end">
          {showClaimBtn && (
            <button
              onClick={() => onClaim?.(bet)}
              className="flex items-center justify-center min-h-[44px] shrink-0 touch-manipulation"
            >
              {/* @figma-hardcoded: #04060c static-black — pending design token */}
              <span className="flex items-center justify-center h-[32px] px-[12px] rounded-8 bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                <span className="text-[12px] font-medium text-[#04060c] leading-[18px] whitespace-nowrap">
                  {t(claimButtonKey(bet.settlementStatus))}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 展开子腿 */}
      {expanded && legs.map((leg) => <SubLegRow key={leg.id} leg={leg} t={t} />)}
    </div>
  );
}

const SingleSettledRow = memo(SingleSettledRowImpl);
const MultiSettledRow = memo(MultiSettledRowImpl);

// 行路由（business_type 三分）
function pickRow(props: {
  bet: PortfolioBet;
  t: ReturnType<typeof useTranslations>;
  onClaim?: (bet: PortfolioBet) => void;
  isLast: boolean;
  currency: CurrencyView;
}) {
  if (props.bet.isMulti) return <MultiSettledRow key={props.bet.id} {...props} />;
  return <SingleSettledRow key={props.bet.id} {...props} />;
}

interface SettledBetsTableProps {
  bets: PortfolioBet[];
  onClaim?: (bet: PortfolioBet) => void;
  sort?: BetsSortState;
  onSortChange?: (column: BetsSortColumn) => void;
}

function SettledBetsTable({ bets, onClaim, sort, onSortChange }: SettledBetsTableProps) {
  const t = useTranslations("portfolio");
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  // 货币显示派生只在父级算一次，下传给所有 row，避免每行重新订阅 store
  const currency: CurrencyView = { showUsd: isUsd && canConvert, hasRate };
  const activeColumn = sort?.orderBy;
  const sortDir = sort?.sort ?? "desc";
  const handleToggle = useCallback((col: BetsSortColumn) => onSortChange?.(col), [onSortChange]);

  return (
    <div className="w-full border border-secondary rounded-16 overflow-hidden">
      {/* Table Header — 7 列对齐 Figma 6712:102855 */}
      <div className="border-b border-secondary flex items-center h-[72px]">
        <div className="w-[243px] shrink-0 pl-[60px] pr-[24px]">
          <span className="text-[14px] font-normal leading-[19px] text-secondary">
            {t("colMatch")}
          </span>
        </div>
        <div className="w-[168px] shrink-0 px-[16px]">
          <span className="text-[14px] font-normal leading-[19px] text-secondary">
            {t("colDateOfEvent")}
          </span>
        </div>
        <div className="w-[120px] shrink-0 px-[16px]">
          <span className="text-[14px] font-normal leading-[19px] text-secondary">
            {t("colBetType")}
          </span>
        </div>
        <div className="flex-1 px-[16px]">
          <span className="text-[14px] font-normal leading-[19px] text-secondary">
            {t("colResult")}
          </span>
        </div>
        <SortHeader<BetsSortColumn>
          label={t("colBet")}
          column="amount"
          activeColumn={activeColumn}
          sort={sortDir}
          onToggle={handleToggle}
          className="flex-1"
        />
        <SortHeader<BetsSortColumn>
          label={t("colPayoutSettled")}
          column="payout"
          activeColumn={activeColumn}
          sort={sortDir}
          onToggle={handleToggle}
          className="flex-1"
        />
        <SortHeader<BetsSortColumn>
          label={t("colSettledTime")}
          column="created_at"
          activeColumn={activeColumn}
          sort={sortDir}
          onToggle={handleToggle}
          className="w-[166px] shrink-0"
        />
        <div className="flex-1 px-[16px]" />
      </div>

      {/* Rows */}
      {bets.map((bet, i) => pickRow({ bet, t, onClaim, currency, isLast: i === bets.length - 1 }))}
    </div>
  );
}

export default memo(SettledBetsTable);
// 留导出便于将来在测试/Storybook 中单独引用子行组件
export { SingleSettledRow, MultiSettledRow };
