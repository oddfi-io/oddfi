"use client";

import { useTranslations } from "next-intl";
import type { CollateralPosition } from "@/types/lending";
import { formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import TeamAvatarPair from "./TeamAvatarPair";

interface H5BorrowCardProps {
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

interface DataRowProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function DataRow({ label, value, valueClassName = "text-primary" }: DataRowProps) {
  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-[14px] font-normal text-secondary leading-[19px]">{label}</span>
      <span className={`text-[14px] font-medium leading-[19px] ${valueClassName}`}>{value}</span>
    </div>
  );
}

export default function H5BorrowCard({ position, onBorrow }: H5BorrowCardProps) {
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
    <div className="bg-fill-card1 rounded-16 px-[16px] py-[24px] flex flex-col gap-[24px] items-start w-full">
      {/* Match info */}
      <div className="flex gap-[8px] items-center w-full">
        <TeamAvatarPair homeTeamLogo={homeTeamLogo} awayTeamLogo={awayTeamLogo} size={32} />
        <div className="flex flex-col gap-[4px] items-start min-w-0">
          <span className="text-[14px] font-semibold text-primary leading-[19px] truncate w-full">
            {matchTitle}
          </span>
          <span className="text-[12px] font-medium text-secondary leading-[18px] opacity-50">
            {matchDate}
          </span>
        </div>
      </div>

      {/* Data rows */}
      <div className="flex flex-col gap-[8px] w-full">
        <DataRow
          label={t("colPrincipal")}
          value={`${formatWithCommas(principal, 2)} ${PLATFORM_TOKEN_DISPLAY}`}
        />
        <DataRow label={t("colReturn")} value={`${formatAmount(returnMultiplier, 2)} X`} />
        <DataRow
          label={t("colCreditLimit")}
          value={
            creditLimit != null && !isBorrowed
              ? `${formatWithCommas(creditLimit, 0)} ${PLATFORM_TOKEN_DISPLAY}`
              : "--"
          }
          valueClassName={creditLimit != null && !isBorrowed ? "text-green" : "text-secondary"}
        />
      </div>

      {/* Action button */}
      {isBorrowed ? (
        <button
          disabled
          className="bg-btn-primary-white opacity-20 text-static-black rounded-12 w-full h-[35px] text-[14px] font-medium cursor-not-allowed shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
          style={{ touchAction: "manipulation" }}
        >
          {t("borrowed")}
        </button>
      ) : (
        <button
          onClick={() => onBorrow(id)}
          className="bg-btn-primary hover:bg-btn-primary-hover text-static-black rounded-12 w-full h-[35px] text-[14px] font-medium transition-colors shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
          style={{ touchAction: "manipulation" }}
        >
          {t("tabBorrow")}
        </button>
      )}
    </div>
  );
}
