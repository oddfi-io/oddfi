"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { mockReturns } from "./mock-data";
import ReturnRow from "./ReturnRow";
import ReturnCard from "./ReturnCard";
import type { ReturnResult } from "./types";

type Filter = "all" | ReturnResult;

export default function ReturnTable() {
  const t = useTranslations("pools");
  const [filter, setFilter] = useState<Filter>("all");

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: t("allMatches") },
    { key: "house_won", label: t("houseWon") },
    { key: "house_lost", label: t("houseLost") },
  ];

  const filtered = useMemo(() => {
    if (filter === "all") return mockReturns;
    return mockReturns.filter((r) => r.result === filter);
  }, [filter]);

  return (
    <div className="flex flex-col gap-[16px]">
      {/* 筛选 chips — Figma 2088:3409: 橙色选中态，与 CategoryFilter 统一 */}
      <div className="flex gap-[12px] flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{ touchAction: "manipulation" }}
            className={`shrink-0 h-[40px] px-[12px] py-[9px] rounded-full text-[12px] font-medium transition-colors min-h-[44px] flex items-center justify-center ${
              filter === f.key
                ? "bg-tag-brand border border-dt-hover text-primary"
                : "bg-fill-input border border-secondary text-secondary hover:bg-white/[0.08]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* PC 表格 */}
      <div className="hidden lg:block overflow-x-auto">
        <div className="border border-secondary rounded-16 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary h-[72px]">
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("colMatch")}
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("colDate")}
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("colResult")}
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("marginEarned")}
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("lossAbsorbed")}
                </th>
                <th className="px-[16px] text-left text-[14px] font-medium text-secondary">
                  {t("netPnl")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <ReturnRow key={r.id} record={r} isLast={idx === filtered.length - 1} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-[16px] py-[48px] text-center text-secondary text-[14px]"
                  >
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* H5 卡片列表 */}
      <div className="lg:hidden flex flex-col gap-[20px]">
        {filtered.map((r) => (
          <ReturnCard key={r.id} record={r} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-secondary text-[14px] py-[48px]">No records found</p>
        )}
      </div>
    </div>
  );
}
