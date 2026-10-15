"use client";

// 投注页筛选栏 — Figma node 3354:45605 + 与历史页一致含漏斗
// 组合：搜索输入 + StatusFilterMenu（按状态筛选 bet variant，仅 settled 展示） + TransactionDateRange
// 状态上浮由容器统一管理

import { memo, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import PortfolioSearchInput from "@/components/portfolio/common/PortfolioSearchInput";
import StatusFilterMenu from "@/components/portfolio/common/StatusFilterMenu";
import TransactionDateRange from "@/components/portfolio/transactions/TransactionDateRange";
import type { FilterStatus } from "@/lib/portfolio-filter";
import type { BetsView } from "@/components/portfolio/BetsSwitcher";

export interface BetsFilterState {
  search: string;
  status: FilterStatus;
  beginDate?: string;
  endDate?: string;
}

type Patch =
  | { search: string }
  | { status: FilterStatus }
  | { beginDate?: string; endDate?: string };

interface Props {
  betsView: BetsView;
  filters: BetsFilterState;
  onChange: (patch: Patch) => void;
}

function BetsFilterBar({ betsView, filters, onChange }: Props) {
  const t = useTranslations("portfolio");
  const [searchInput, setSearchInput] = useState(filters.search);
  const [h5SearchOpen, setH5SearchOpen] = useState(false);

  // 搜索 debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => onChange({ search: searchInput.trim() }), 300);
    return () => clearTimeout(timer);
  }, [searchInput, onChange]);

  return (
    <div className="flex gap-[8px] items-center">
      <PortfolioSearchInput
        value={searchInput}
        onChange={setSearchInput}
        placeholder={t("searchPlaceholder")}
        hasActiveSearch={!!filters.search}
        onH5OpenChange={setH5SearchOpen}
      />

      {!h5SearchOpen && betsView === "settled" && (
        <StatusFilterMenu
          variant="bet"
          status={filters.status}
          hideAllOption
          onChange={(status) => onChange({ status })}
        />
      )}

      {!h5SearchOpen && (
        <TransactionDateRange
          beginDate={filters.beginDate}
          endDate={filters.endDate}
          onChange={(v) => onChange({ beginDate: v.beginDate, endDate: v.endDate })}
        />
      )}
    </div>
  );
}

export default memo(BetsFilterBar);
