"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import CaretDownIcon from "@/components/icons/CaretDownIcon";

interface BreakdownRow {
  label: string;
  value: string;
  tooltip?: string;
  icon?: string;
}

interface TransactionBreakdownProps {
  networkCost?: string;
  priceImpact?: string;
  maxSlippage?: string;
  extra?: BreakdownRow[];
  defaultCollapsed?: boolean;
}

export function TransactionBreakdown({
  networkCost,
  priceImpact,
  maxSlippage,
  extra,
  defaultCollapsed = true,
}: TransactionBreakdownProps) {
  const t = useTranslations("deposit");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const rows: BreakdownRow[] = [];
  if (networkCost)
    rows.push({ label: t("networkCost"), value: networkCost, icon: "/icons/gas.svg" });
  if (priceImpact) rows.push({ label: t("priceImpact"), value: priceImpact });
  if (maxSlippage) rows.push({ label: t("maxSlippage"), value: maxSlippage });
  if (extra) rows.push(...extra);

  if (rows.length === 0) return null;

  return (
    <div>
      {/* Toggle row */}
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="flex items-center gap-[8px] w-full text-[14px] text-[#575966] leading-[19px]
                   hover:text-white/80 transition-colors touch-manipulation cursor-pointer"
      >
        <span>{t("transactionBreakdown")}</span>
        <CaretDownIcon
          size={20}
          className={`transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
        />
      </button>

      {/* Expanded rows */}
      {!collapsed && (
        <div className="flex flex-col gap-[12px] mt-[12px]">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <div className="border-b border-dashed border-[#575966] flex items-center justify-center">
                <span className="text-[14px] text-[#575966] leading-[19px]">{row.label}</span>
              </div>
              <div className="flex items-center gap-[6px]">
                {row.icon && <Image src={row.icon} alt="" width={16} height={16} sizes="16px" />}
                <span className="text-[14px] text-white leading-[19px]">{row.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
