"use client";

import { useTranslations } from "next-intl";
import type { CollateralPosition } from "@/types/lending";
import { formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import TeamAvatarPair from "./TeamAvatarPair";

interface BorrowPositionRowProps {
  position: CollateralPosition;
  onBorrow: (positionId: string) => void;
}

/** Format a number with comma separators for display (e.g. 520000 → "520,000") */
function formatWithCommas(val: number, decimals: number): string {
  const fixed = formatAmount(val, decimals);
  const [intPart, decPart] = fixed.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}

export default function BorrowPositionRow({ position, onBorrow }: BorrowPositionRowProps) {
  const t = useTranslations("lending");
  const {
    id,
    matchTitle,
    matchDate,
    homeTeamLogo,
    awayTeamLogo,
    principal,
    returnMultiplier,
    creditLimit,
    isBorrowed,
  } = position;

  return (
    <div className="flex items-center h-[73px] border-b border-secondary py-[16px]">
      {/* Match / Selection */}
      <div className="w-[380px] pl-[16px] flex items-center gap-[8px] shrink-0">
        <TeamAvatarPair homeTeamLogo={homeTeamLogo} awayTeamLogo={awayTeamLogo} size={32} />
        <div className="flex flex-col gap-[2px] min-w-0">
          <span className="text-[14px] font-semibold text-primary leading-[19px] truncate">
            {matchTitle}
          </span>
          <span className="text-[12px] text-secondary leading-[18px]">{matchDate}</span>
        </div>
      </div>

      {/* Principal */}
      <div className="w-[240px] px-[16px] shrink-0">
        <span className="text-[16px] font-bold text-primary leading-[24px]">
          {formatWithCommas(principal, 0)} {PLATFORM_TOKEN_DISPLAY}
        </span>
      </div>

      {/* Return */}
      <div className="w-[240px] px-[16px] shrink-0">
        <span className="text-[16px] font-bold text-primary leading-[24px]">
          {formatAmount(returnMultiplier, 2)} X
        </span>
      </div>

      {/* Credit Limit */}
      <div className="w-[179px] px-[16px] shrink-0">
        {creditLimit != null && !isBorrowed ? (
          <span className="text-[16px] font-bold text-green leading-[24px]">
            {formatWithCommas(creditLimit, 0)} {PLATFORM_TOKEN_DISPLAY}
          </span>
        ) : (
          <span className="text-[16px] font-bold text-secondary leading-[24px]">--</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex-1 flex justify-end pr-[16px]">
        {isBorrowed ? (
          <button
            disabled
            className="bg-btn-primary-white opacity-20 text-static-black rounded-8 min-w-[100px] px-[12px] py-[8px] text-[14px] font-medium cursor-not-allowed shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
            style={{ touchAction: "manipulation" }}
          >
            {t("borrowed")}
          </button>
        ) : (
          <button
            onClick={() => onBorrow(id)}
            className="bg-btn-primary hover:bg-btn-primary-hover text-static-black rounded-8 min-w-[100px] px-[12px] py-[8px] text-[14px] font-medium transition-colors shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
            style={{ touchAction: "manipulation" }}
          >
            {t("tabBorrow")}
          </button>
        )}
      </div>
    </div>
  );
}
