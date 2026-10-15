"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import Image from "next/image";
import type { PortfolioBet } from "@/types/portfolio";
import { formatDisplayAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { tagClasses } from "@/lib/bet-tag-classes";
import { formatMatchTimeLocal } from "@/lib/format/relative-time";
import CashoutModal from "@/components/portfolio/cashout/CashoutModal";
import PortfolioBannerCell from "@/components/portfolio/bets/PortfolioBannerCell";
import OnchainBadge from "@/components/portfolio/bets/OnchainBadge";
import { TeamVsAvatars } from "@/components/ui/TeamVsAvatars";

// ─── MyBetCard ──────────────────────────────────────────────────────────────
// BetSlip My Bets 卡片 — PC: Figma 3474:80595 / 80644 / 80653
// H5: Figma 2154:108075 / 2154:106873（本次未改造，沿用旧版）
// Cancel 逻辑复用 Portfolio 的 CashoutModal（内部已切 useCancelBet → POST /account/bet_cancel）

interface MyBetCardProps {
  bet: PortfolioBet;
  mobile?: boolean;
}

function MyBetCard({ bet, mobile }: MyBetCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Banner 流水（business_type=banner_single）走 banner.title；
  // 普通赛事走 "A VS B"；多腿走 "N Leg Multi"
  const title = bet.isMulti
    ? `${bet.legCount} Leg Multi`
    : bet.banner
      ? bet.banner.title
      : `${bet.homeTeam.name} VS ${bet.awayTeam.name}`;

  const toggleExpand = () => bet.isMulti && setExpanded((v) => !v);

  if (mobile) {
    return <H5Card bet={bet} title={title} expanded={expanded} onToggle={toggleExpand} />;
  }

  return <PCCard bet={bet} title={title} expanded={expanded} onToggle={toggleExpand} />;
}

// ─── Shared: Team Avatar (48px dual-circle per Figma SoccerTeam property1="2") ──
function TeamAvatar({ home, away }: { home: string; away: string }) {
  return (
    <div className="relative size-[48px] shrink-0">
      {/* @figma-hardcoded: gradient from-[#f7fafc] to-[#d4dce3] team-avatar-gradient — pending design token */}
      <div className="absolute left-0 top-0 size-[36px] rounded-full overflow-hidden bg-gradient-to-t from-[#f7fafc] to-[#d4dce3]">
        <Image src={home} alt="" fill className="object-cover" sizes="36px" />
      </div>
      {/* @figma-hardcoded: #04060c team-avatar-border — pending design token */}
      <div className="absolute right-0 bottom-0 size-[36px] rounded-full overflow-hidden bg-gradient-to-t from-[#f7fafc] to-[#d4dce3] border-[2.25px] border-[#04060c]">
        <Image src={away} alt="" fill className="object-cover" sizes="36px" />
      </div>
    </div>
  );
}

// ─── Shared: 「上链中」badge（BUG-024）──
// 仅乐观链上注单（MyBetsView 置 bet.confirming=true）展示，复用 betSlip.confirming 文案（9 语言已就绪）。
// 品牌薄荷底+字，与灰色 OnchainBadge 区分「进行中」语义；history 稳态卡无此 badge。
function ConfirmingBadge() {
  const tBet = useTranslations("betSlip");
  return (
    <span className="bg-tag-brand text-brand-default h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center shrink-0">
      {tBet("confirming")}
    </span>
  );
}

// ─── Shared: Amount display — dual-unit with ODD/USD toggle ──
function AmountValue({ amount, usd }: { amount: string; usd: string }) {
  const { canConvert, hasRate, isUsd } = useCurrencyDisplay();
  const showUsd = isUsd && canConvert;
  const primary = showUsd ? `$${formatDisplayAmount(usd)}` : formatDisplayAmount(amount);
  const primaryUnit = showUsd ? "USD" : PLATFORM_TOKEN_DISPLAY;
  const secondary = showUsd
    ? `${formatDisplayAmount(amount)} ${PLATFORM_TOKEN_DISPLAY}`
    : `$${formatDisplayAmount(usd)}`;
  return (
    <div className="flex gap-[4px] items-center shrink-0">
      <span className="text-[14px] font-semibold leading-[19px] text-primary">{primary}</span>
      <span className="text-[14px] font-semibold leading-[19px] text-tertiary">{primaryUnit}</span>
      {hasRate && (
        <span className="text-[12px] font-medium leading-[18px] text-tertiary">(≈{secondary})</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PC Card — Figma 3474:80595（单注）/ 80644（多腿收起）/ 80653（多腿展开）
// ═══════════════════════════════════════════════════════════════════════════

function PCCard({
  bet,
  title,
  expanded,
  onToggle,
}: {
  bet: PortfolioBet;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("portfolio");
  const tBet = useTranslations("betSlip");
  const [cashoutOpen, setCashoutOpen] = useState(false);

  return (
    <div className="bg-fill-card1 rounded-16 overflow-hidden flex flex-col gap-[24px] pb-[16px] shrink-0">
      {/* ── Header — Figma: bg-fill-card2, p-[16px] ── */}
      <PCHeader bet={bet} title={title} expanded={expanded} onToggle={onToggle} />

      {/* ── Multi expanded legs — Figma 80660 / 80683 ── */}
      {bet.isMulti && expanded && bet.legs && (
        <div className="mx-[16px] flex flex-col gap-[12px]">
          {bet.legs.map((leg) => (
            <PCLegCard key={leg.id} leg={leg} />
          ))}
        </div>
      )}

      {/* ── Stats rows — Figma 80604: px-[16px] gap-[8px] ── */}
      <div className="px-[16px] flex flex-col gap-[8px]">
        <PCStatsRow label={tBet("colBetTime")} value={formatMatchTimeLocal(bet.createdAt) || "—"} />
        <PCStatsRow
          label={tBet("colSettledTime")}
          value={formatMatchTimeLocal(bet.settledAt) || "—"}
        />
        {/* Blend (Total Odds) — Figma 80623: 18px bold brand-default 纯文字（非 tag） */}
        {/* @figma-todo Blend (n) 中括号里的系数当前无后端字段，先只显示 "Blend" + 倍率 */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-normal leading-[19px] text-secondary">
            {tBet("blend")}
          </span>
          <span className="text-[18px] font-semibold leading-[26px] text-brand-default">
            {bet.odds}x
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-normal leading-[19px] text-secondary">
            {tBet("totalBet")}
          </span>
          <AmountValue amount={bet.betAmount} usd={bet.betAmountUsd} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-normal leading-[19px] text-secondary">
            {tBet("potentialWin")}
          </span>
          <AmountValue amount={bet.potentialWin} usd={bet.potentialWinUsd} />
        </div>
      </div>

      {/* ENH-038 · 正在取消（cash_out_state=cashing_out）：复用 Cancel 视觉，仅 disabled + 文案切换 */}
      {bet.cashoutState === "cashing_out" && !bet.viewOnly && (
        <div className="px-[16px]">
          <button
            type="button"
            disabled
            className="bg-white h-[40px] w-full rounded-12 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] flex items-center justify-center opacity-60 cursor-not-allowed"
          >
            <span className="text-[14px] font-medium leading-[19px] text-static-black">
              {t("cancelling")}
            </span>
          </button>
        </div>
      )}

      {/* ── Cancel — Figma 80643: h-[40px] white rounded-12 shadow-xs，复用 CashoutModal ── */}
      {bet.cashoutAvailable && !bet.viewOnly && (
        <>
          <div className="px-[16px]">
            <button
              type="button"
              onClick={() => setCashoutOpen(true)}
              className="bg-white h-[40px] w-full rounded-12 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] flex items-center justify-center touch-manipulation"
              style={{ touchAction: "manipulation" }}
            >
              <span className="text-[14px] font-medium leading-[19px] text-static-black">
                {t("cancelBet")}
              </span>
            </button>
          </div>
          <CashoutModal isOpen={cashoutOpen} onClose={() => setCashoutOpen(false)} bet={bet} />
        </>
      )}
    </div>
  );
}

// ─── PC Header — Figma 80596（单注）/ 80645（多腿） ──
function PCHeader({
  bet,
  title,
  expanded,
  onToggle,
}: {
  bet: PortfolioBet;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  // 单注：纯展示，div + avatar + 文本（无 caret，不可展开）
  if (!bet.isMulti) {
    return (
      <div className="bg-fill-card2 p-[16px] flex gap-[16px] items-center w-full min-w-0">
        {bet.banner ? (
          // Banner 预测（business_type=banner_single）：复用 Portfolio PortfolioBannerCell
          // 不传 odds —— 赔率已在下方 Blend 行展示，避免重复
          <PortfolioBannerCell
            bet={{ banner: bet.banner, selectionTag: bet.selectionTag }}
            avatarSize={48}
            tagGap={4}
          />
        ) : (
          <>
            <TeamAvatar home={bet.homeTeam.iconUrl} away={bet.awayTeam.iconUrl} />
            <div className="flex flex-col gap-[4px] min-w-0">
              <p className="text-[14px] font-semibold leading-[19px] text-primary truncate">
                {title}
              </p>
              <div className="flex gap-[4px] items-center">
                <span
                  className={`h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center shrink-0 ${tagClasses("market")}`}
                >
                  {bet.marketTag}
                </span>
                {bet.isOnchain && <OnchainBadge />}
                {bet.confirming && <ConfirmingBadge />}
                <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50 shrink-0">
                  {formatMatchTimeLocal(bet.matchTime)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // 多腿：button + 单 avatar 占位 + "N Leg Multi" + 右侧 caret
  return (
    <button
      type="button"
      className="bg-fill-card2 p-[16px] flex items-center justify-between w-full text-left touch-manipulation"
      style={{ touchAction: "manipulation" }}
      onClick={onToggle}
    >
      <div className="flex gap-[16px] items-center min-w-0">
        {/* Figma 80647 soccer team — 多腿头像取首腿主客双图（无 legs 时回退父单字段） */}
        <TeamVsAvatars
          home={bet.legs?.[0]?.homeTeam ?? bet.homeTeam}
          away={bet.legs?.[0]?.awayTeam ?? bet.awayTeam}
          size={48}
        />
        <p className="text-[14px] font-semibold leading-[19px] text-primary truncate">{title}</p>
      </div>
      {expanded ? (
        <CaretUpIcon size={20} className="text-primary shrink-0" />
      ) : (
        <CaretDownIcon size={20} className="text-primary shrink-0" />
      )}
    </button>
  );
}

function PCStatsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] font-normal leading-[19px] text-secondary">{label}</span>
      <span className="text-[14px] font-normal leading-[19px] text-primary">{value}</span>
    </div>
  );
}

// ─── PC Expanded Leg — Figma 2322:122948 ──
function PCLegCard({ leg }: { leg: PortfolioBet }) {
  const tBet = useTranslations("betSlip");
  return (
    <div className="border rounded-12 p-[16px] flex flex-col gap-[12px] overflow-hidden">
      {/* Leg header — Figma 80663 soccer team 48×48 双头像 */}
      <div className="flex gap-[16px] items-start">
        <TeamVsAvatars home={leg.homeTeam} away={leg.awayTeam} size={48} />
        <div className="flex flex-col gap-[4px]">
          <p className="text-[14px] font-semibold leading-[19px] text-primary">
            {leg.homeTeam.name} VS {leg.awayTeam.name}
          </p>
          <div className="flex gap-[4px] items-center">
            <span
              className={`h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center ${tagClasses("market")}`}
            >
              {leg.marketTag}
            </span>
            {leg.isOnchain && <OnchainBadge />}
            <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50">
              {formatMatchTimeLocal(leg.matchTime)}
            </span>
          </div>
        </div>
      </div>
      {/* Selection + Odds */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium leading-[19px] text-primary">
          {leg.selectionTag}
        </span>
        <span className="text-[18px] font-semibold leading-[26px] text-brand-default">
          {leg.odds}x
        </span>
      </div>
      {/* Bet amount */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-normal leading-[19px] text-secondary">
          {tBet("colBet")}
        </span>
        <AmountValue amount={leg.betAmount} usd={leg.betAmountUsd} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// H5 Card — Figma 2154:108075 / 2154:106873
// ═══════════════════════════════════════════════════════════════════════════

function H5Card({
  bet,
  title,
  expanded,
  onToggle,
}: {
  bet: PortfolioBet;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("portfolio");
  const tBet = useTranslations("betSlip");
  const [cashoutOpen, setCashoutOpen] = useState(false);
  return (
    // @figma-hardcoded: rgba(255,255,255,0.05) h5-mybets-card-bg — pending design token
    <div className="bg-[rgba(255,255,255,0.05)] border-b border-divider-light rounded-8 py-[8px] flex flex-col shrink-0">
      {/* ── Header — Figma: h-[90px] py-[8px] px-[16px] ── */}
      <button
        type="button"
        className="flex items-center py-[8px] gap-[4px] w-full text-left touch-manipulation"
        style={{ touchAction: "manipulation" }}
        onClick={onToggle}
      >
        <div className="flex-1 flex items-start px-[16px] min-w-0">
          <div className="flex gap-[16px] items-center min-w-0">
            {bet.isMulti ? (
              <>
                {/* 多腿头像取首腿主客双图（无 legs 时回退父单字段） */}
                <TeamVsAvatars
                  home={bet.legs?.[0]?.homeTeam ?? bet.homeTeam}
                  away={bet.legs?.[0]?.awayTeam ?? bet.awayTeam}
                  size={48}
                />
                <div className="flex flex-col gap-[4px] min-w-0">
                  <p className="text-[16px] font-medium leading-[24px] text-primary truncate">
                    {title}
                  </p>
                </div>
              </>
            ) : bet.banner ? (
              // Banner 预测：复用 Portfolio PortfolioBannerCell（H5 标题 16px medium）
              <PortfolioBannerCell
                bet={{ banner: bet.banner, selectionTag: bet.selectionTag }}
                avatarSize={48}
                tagGap={4}
                titleClassName="text-[16px] font-medium leading-[24px] text-primary"
              />
            ) : (
              <>
                <TeamAvatar home={bet.homeTeam.iconUrl} away={bet.awayTeam.iconUrl} />
                <div className="flex flex-col gap-[4px] min-w-0">
                  <p className="text-[16px] font-medium leading-[24px] text-primary truncate">
                    {title}
                  </p>
                  <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50">
                    {formatMatchTimeLocal(bet.matchTime)}
                  </span>
                  <div className="flex gap-[8px] items-center">
                    <span
                      className={`h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center ${tagClasses("market")}`}
                    >
                      {bet.marketTag}
                    </span>
                    {bet.isOnchain && <OnchainBadge />}
                    {bet.confirming && <ConfirmingBadge />}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {bet.isMulti && (
          <div className="shrink-0 pr-[4px]">
            {expanded ? (
              <CaretUpIcon size={20} className="text-primary" />
            ) : (
              <CaretDownIcon size={20} className="text-primary" />
            )}
          </div>
        )}
      </button>

      {/* ── Multi expanded legs — Figma 2154:107706 ── */}
      {bet.isMulti && expanded && bet.legs && (
        <div className="flex flex-col gap-[16px]">
          {bet.legs.map((leg) => (
            <H5LegCard key={leg.id} leg={leg} />
          ))}
        </div>
      )}

      {/* ── Stats rows ── */}
      {/* Bet time — Figma: 12px medium secondary opacity-50 */}
      <div className="flex items-center justify-between px-[16px] py-[8px] text-[12px] font-medium leading-[18px] text-secondary opacity-50">
        <span>{tBet("colBetTime")}</span>
        <span>{formatMatchTimeLocal(bet.createdAt) || "—"}</span>
      </div>
      {/* Settle time — Figma: opacity-90 wrapper, label opacity-50 secondary, value primary */}
      <div className="flex items-center justify-between px-[16px] py-[8px] text-[12px] font-medium leading-[18px] opacity-90">
        <span className="text-secondary opacity-50">{tBet("colSettledTime")}</span>
        <span className="text-primary">{formatMatchTimeLocal(bet.settledAt) || "—"}</span>
      </div>
      {/* Odds row — Figma: single=14px medium white, multi=14px regular secondary */}
      <div className="flex items-center justify-between px-[16px]">
        <span
          className={
            bet.isMulti
              ? "text-[14px] font-normal leading-[19px] text-secondary"
              : "text-[14px] font-medium leading-[19px] text-primary"
          }
        >
          {bet.isMulti ? tBet("totalOdds") : bet.selectionTag}
        </span>
        <span className="text-[18px] font-semibold leading-[26px] text-brand-default">
          {bet.odds}x
        </span>
      </div>
      {/* Bet + Potential Win — Figma: px-[16px] flex-col, each row py-[8px] */}
      <div className="flex flex-col px-[16px]">
        <div className="flex items-center justify-between py-[8px]">
          <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50">
            {tBet("colBet")}
          </span>
          <AmountValue amount={bet.betAmount} usd={bet.betAmountUsd} />
        </div>
        <div className="flex items-center justify-between py-[8px]">
          <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50">
            {tBet("potentialWin")}
          </span>
          <AmountValue amount={bet.potentialWin} usd={bet.potentialWinUsd} />
        </div>
      </div>

      {/* ENH-038 · 正在取消（cash_out_state=cashing_out）：复用 Cancel 视觉，仅 disabled + 文案切换 */}
      {bet.cashoutState === "cashing_out" && !bet.viewOnly && (
        <div className="flex gap-[16px] items-center py-[16px] px-[16px]">
          <button
            type="button"
            disabled
            className="bg-white h-[48px] flex-1 rounded-12 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] flex items-center justify-center opacity-60 cursor-not-allowed"
          >
            <span className="text-[14px] font-medium leading-[19px] text-static-black">
              {t("cancelling")}
            </span>
          </button>
        </div>
      )}

      {/* ── Cancel — Figma: h-[48px] white rounded-12 shadow-xs（复用 CashoutModal） ── */}
      {bet.cashoutAvailable && !bet.viewOnly && (
        <>
          <div className="flex gap-[16px] items-center py-[16px] px-[16px]">
            <button
              type="button"
              onClick={() => setCashoutOpen(true)}
              className="bg-white h-[48px] flex-1 rounded-12 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] flex items-center justify-center touch-manipulation"
              style={{ touchAction: "manipulation" }}
            >
              <span className="text-[14px] font-medium leading-[19px] text-static-black">
                {t("cancelBet")}
              </span>
            </button>
          </div>
          <CashoutModal isOpen={cashoutOpen} onClose={() => setCashoutOpen(false)} bet={bet} />
        </>
      )}
    </div>
  );
}

// ─── H5 Expanded Leg — Figma 2154:107707 ──
function H5LegCard({ leg }: { leg: PortfolioBet }) {
  const tBet = useTranslations("betSlip");
  return (
    // @figma-hardcoded: black h5-mybets-leg-bg — pending design token
    <div className="bg-black rounded-16 px-[16px] py-[8px] flex flex-col gap-[12px]">
      {/* Leg header — 48×48 双头像 */}
      <div className="flex gap-[16px] items-center">
        <TeamVsAvatars home={leg.homeTeam} away={leg.awayTeam} size={48} />
        <div className="flex flex-col gap-[4px]">
          <p className="text-[16px] font-medium leading-[24px] text-primary">
            {leg.homeTeam.name} VS {leg.awayTeam.name}
          </p>
          <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50">
            {formatMatchTimeLocal(leg.matchTime)}
          </span>
          <div className="flex gap-[8px] items-center">
            <span
              className={`h-[24px] px-[8px] py-[2px] rounded-8 text-[11px] font-medium leading-[16px] flex items-center ${tagClasses("market")}`}
            >
              {leg.marketTag}
            </span>
            {leg.isOnchain && <OnchainBadge />}
          </div>
        </div>
      </div>
      {/* Selection + Odds + Bet */}
      <div className="flex flex-col gap-[6px]">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium leading-[19px] text-primary">
            {leg.selectionTag}
          </span>
          <span className="text-[18px] font-semibold leading-[26px] text-brand-default">
            {leg.odds}x
          </span>
        </div>
        <div className="flex items-center justify-between py-[8px]">
          <span className="text-[12px] font-medium leading-[18px] text-secondary opacity-50">
            {tBet("colBet")}
          </span>
          <div className="flex items-center">
            <AmountValue amount={leg.betAmount} usd={leg.betAmountUsd} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MyBetCard);
