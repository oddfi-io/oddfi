"use client";

import { useTranslations } from "next-intl";
import type { ActiveBorrow } from "@/types/lending";
import { formatAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import TeamAvatarPair from "./TeamAvatarPair";

interface H5RepayCardProps {
  borrow: ActiveBorrow;
  onRepay: (borrowId: string) => void;
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

export default function H5RepayCard({ borrow, onRepay }: H5RepayCardProps) {
  const t = useTranslations("lending");
  const { format } = useCurrencyDisplay();
  const isActive = borrow.status === "active";

  return (
    <div className="bg-fill-card1 rounded-16 px-[16px] py-[24px] flex flex-col gap-[24px] items-start w-full">
      {/* Match info */}
      <div className="flex gap-[8px] items-center w-full">
        <TeamAvatarPair
          homeTeamLogo={borrow.homeTeamLogo}
          awayTeamLogo={borrow.awayTeamLogo}
          size={32}
        />
        <div className="flex flex-col gap-[4px] items-start min-w-0">
          <span className="text-[14px] font-semibold text-primary leading-[19px] truncate w-full">
            {borrow.matchTitle}
          </span>
          <span className="text-[12px] font-normal text-secondary leading-[18px] opacity-50 truncate w-full">
            {borrow.collateralInfo}
          </span>
        </div>
      </div>

      {/* Data rows */}
      <div className="flex flex-col gap-[8px] w-full">
        <DataRow
          label={t("status")}
          value={isActive ? t("statusActive") : t("principalFrozen")}
          // @figma-hardcoded: #F68F15 frozen-status-text — pending design token
          valueClassName={isActive ? "text-green" : "text-[#F68F15]"}
        />
        <DataRow
          label={t("borrowed")}
          value={format(String(borrow.borrowedAmount), 0)}
          valueClassName="text-green"
        />
        {isActive ? (
          <>
            <DataRow label={t("colReturn")} value={`${formatAmount(borrow.times ?? 0, 2)} X`} />
            <DataRow
              label={t("potentialReturnLabel")}
              value={format(String(borrow.potentialReturn ?? 0), 0)}
            />
          </>
        ) : (
          <>
            <DataRow label={t("netProfit")} value={format(String(borrow.netProfit ?? 0), 0)} />
            <DataRow
              label={t("principalFrozen")}
              value={format(String(borrow.principalFrozen ?? 0), 0)}
              valueClassName="text-brand-default"
            />
          </>
        )}
      </div>

      {/* Repay button */}
      <button
        onClick={() => onRepay(borrow.id)}
        className="bg-btn-primary-white hover:bg-btn-primary-white-hover text-static-black rounded-12 w-full h-[35px] text-[14px] font-medium transition-colors shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
        style={{ touchAction: "manipulation" }}
      >
        {t("tabRepay")}
      </button>
    </div>
  );
}
