"use client";

import { useTranslations } from "next-intl";
import type { ActiveBorrow } from "@/types/lending";
import { formatAmount } from "@/lib/decimal";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import TeamAvatarPair from "./TeamAvatarPair";

interface RepayBorrowCardProps {
  borrow: ActiveBorrow;
  onRepay: (borrowId: string) => void;
}

function StatusTag({
  status,
  t,
}: {
  status: ActiveBorrow["status"];
  t: ReturnType<typeof useTranslations<"lending">>;
}) {
  const isActive = status === "active";
  return (
    <div
      className={`absolute top-0 right-[32px] h-[24px] px-[8px] py-[2px] rounded-bl-8 rounded-br-8 flex items-center justify-center text-[11px] font-medium leading-[16px] ${
        // @figma-hardcoded: #F68F151A frozen-tag-bg, #F68F15 frozen-tag-text — pending design token
        isActive ? "bg-tag-green text-green" : "bg-[#F68F151A] text-[#F68F15]"
      }`}
    >
      {isActive ? t("statusActive") : t("principalFrozen")}
    </div>
  );
}

function DataColumn({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div className="w-[120px] flex flex-col gap-[6px]">
      <span className="text-[14px] text-secondary leading-[19px]">{label}</span>
      <span className={`text-[18px] font-semibold leading-normal ${valueClassName}`}>{value}</span>
    </div>
  );
}

export default function RepayBorrowCard({ borrow, onRepay }: RepayBorrowCardProps) {
  const t = useTranslations("lending");
  const { format } = useCurrencyDisplay();
  const isActive = borrow.status === "active";

  return (
    <div className="bg-fill-card1 rounded-16 h-[116px] p-[32px] relative">
      <div className="flex items-center justify-between w-full">
        {/* Left: match info */}
        <div className="w-[520px] flex gap-[12px] items-center">
          <TeamAvatarPair
            homeTeamLogo={borrow.homeTeamLogo}
            awayTeamLogo={borrow.awayTeamLogo}
            size={44}
          />
          <div className="flex flex-col gap-[4px]">
            <span className="text-[16px] font-bold text-primary leading-[24px]">
              {borrow.matchTitle}
            </span>
            <span className="text-[14px] text-tertiary leading-[19px]">
              {borrow.collateralInfo}
            </span>
          </div>
        </div>

        {/* Center: data columns */}
        <div className="w-[434px] flex gap-[12px] items-center">
          <DataColumn
            label={t("borrowed")}
            value={format(String(borrow.borrowedAmount), 0)}
            valueClassName="text-green"
          />
          {isActive ? (
            <>
              <DataColumn
                label={t("times")}
                value={`${formatAmount(borrow.times ?? 0, 2)}×`}
                valueClassName="text-primary"
              />
              <DataColumn
                label={t("potentialReturnLabel")}
                value={format(String(borrow.potentialReturn ?? 0), 0)}
                valueClassName="text-primary"
              />
            </>
          ) : (
            <>
              <DataColumn
                label={t("netProfit")}
                value={format(String(borrow.netProfit ?? 0), 0)}
                valueClassName="text-primary"
              />
              <DataColumn
                label={t("principalFrozen")}
                value={format(String(borrow.principalFrozen ?? 0), 0)}
                valueClassName="text-brand-default"
              />
            </>
          )}
        </div>

        {/* Right: repay button */}
        <div className="flex-1 flex items-center justify-end">
          <button
            onClick={() => onRepay(borrow.id)}
            className="bg-btn-primary-white hover:bg-btn-primary-white-hover text-static-black rounded-8 min-w-[80px] px-[12px] py-[8px] text-[14px] font-medium whitespace-nowrap text-center shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
            style={{ touchAction: "manipulation" }}
          >
            {t("confirmRepay")}
          </button>
        </div>
      </div>

      {/* Status tag */}
      <StatusTag status={borrow.status} t={t} />
    </div>
  );
}
