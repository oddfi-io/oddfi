"use client";

import { memo, useEffect, useMemo, useReducer, useState } from "react";
import { addDays, format } from "date-fns";
import { useTranslations } from "next-intl";
import TransactionRow from "./TransactionRow";
import TransactionCard from "./TransactionCard";
import PortfolioSearchInput from "@/components/portfolio/common/PortfolioSearchInput";
import LoadMoreButton from "@/components/portfolio/common/LoadMoreButton";
import StatusFilterMenu from "@/components/portfolio/common/StatusFilterMenu";
import TransactionDateRange from "./TransactionDateRange";
import SortHeader from "@/components/portfolio/common/SortHeader";
import { usePortfolioHistoryInfinite } from "@/hooks/usePortfolioHistoryInfinite";
import { ledgerToTransaction } from "@/lib/adapters/portfolio";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { statusToApiParams, type FilterStatus } from "@/lib/portfolio-filter";

// ─── TransactionHistory ─────────────────────────────────────────────────────
// Figma P3 [2006:94205] — PC: search/filter bar + table
// Figma P6 [2116:118512] — H5: filter bar + card list
// Figma H8 [2116:118715] — H5 filter bar (search + filter + date picker)

type OrderBy = "created_at" | "amount";
type Sort = "asc" | "desc";

interface Filters {
  search: string;
  status: FilterStatus;
  beginDate?: string;
  endDate?: string;
  orderBy: OrderBy;
  sort: Sort;
}

type Action =
  | { type: "setSearch"; value: string }
  | { type: "setStatus"; value: FilterStatus }
  | { type: "setDateRange"; begin?: string; end?: string }
  | { type: "toggleSort"; column: OrderBy };

function makeInitialFilters(): Filters {
  const today = new Date();
  return {
    search: "",
    status: "all",
    beginDate: format(addDays(today, -30), "yyyy-MM-dd"),
    endDate: format(today, "yyyy-MM-dd"),
    orderBy: "created_at",
    sort: "desc",
  };
}

const INITIAL: Filters = makeInitialFilters();

function reducer(state: Filters, action: Action): Filters {
  switch (action.type) {
    case "setSearch":
      return { ...state, search: action.value };
    case "setStatus":
      return { ...state, status: action.value };
    case "setDateRange":
      return { ...state, beginDate: action.begin, endDate: action.end };
    case "toggleSort": {
      // cycle: 非激活 → 该列 desc → 该列 asc → 回默认 (created_at desc)
      if (state.orderBy !== action.column) {
        return { ...state, orderBy: action.column, sort: "desc" };
      }
      if (state.sort === "desc") return { ...state, sort: "asc" };
      return {
        orderBy: "created_at",
        sort: "desc",
        search: state.search,
        status: state.status,
        beginDate: state.beginDate,
        endDate: state.endDate,
      };
    }
    default:
      return state;
  }
}

function TransactionHistory() {
  const t = useTranslations("portfolio");
  const [filters, dispatch] = useReducer(reducer, INITIAL);
  const [searchInput, setSearchInput] = useState("");
  const [h5SearchOpen, setH5SearchOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: "setSearch", value: searchInput.trim() }), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    usePortfolioHistoryInfinite({
      search: filters.search || undefined,
      ...statusToApiParams(filters.status),
      begin_date: filters.beginDate,
      end_date: filters.endDate,
      order_by: filters.orderBy,
      sort: filters.sort,
    });

  const { rate } = useCurrencyDisplay();
  const transactions = useMemo(() => {
    const records = data?.pages.flatMap((p) => p.asset_ledgers) ?? [];
    // bet_placed 行 adapter 返回 null（与 onchain_single 成对的链上扣款流水，不展示）
    return records
      .map((r) => ledgerToTransaction(r, rate))
      .filter((tx): tx is NonNullable<typeof tx> => tx !== null);
  }, [data, rate]);

  const hasActiveFilter =
    filters.status !== "all" ||
    Boolean(filters.beginDate) ||
    Boolean(filters.endDate) ||
    Boolean(filters.search);

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[24px]">
      {/* Filter bar — Figma [1689:82592]: search + filter + date range */}
      <div className="flex gap-[8px] items-center">
        <PortfolioSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("searchPlaceholder")}
          hasActiveSearch={!!filters.search}
          onH5OpenChange={setH5SearchOpen}
        />

        {!h5SearchOpen && (
          <>
            <StatusFilterMenu
              variant="history"
              status={filters.status}
              onChange={(value) => dispatch({ type: "setStatus", value })}
            />
            <TransactionDateRange
              beginDate={filters.beginDate}
              endDate={filters.endDate}
              onChange={(v) =>
                dispatch({ type: "setDateRange", begin: v.beginDate, end: v.endDate })
              }
            />
          </>
        )}
      </div>

      {/* Loading skeleton（仅首屏） */}
      {isLoading && (
        <div className="flex flex-col gap-[16px] lg:gap-[24px]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-8 bg-secondary animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!isLoading && isError && (
        <div className="flex items-center justify-center py-[48px]">
          <span className="text-[14px] text-fn-red">Failed to load transactions</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && transactions.length === 0 && (
        <div className="flex items-center justify-center py-[48px]">
          <span className="text-[14px] text-tertiary">
            {hasActiveFilter ? t("noResult") : "No transactions yet"}
          </span>
        </div>
      )}

      {/* Data */}
      {!isLoading && !isError && transactions.length > 0 && (
        <>
          {/* PC: 表格 */}
          <div className="hidden lg:block w-full border border-secondary rounded-16 overflow-hidden">
            <div className="border-b border-secondary flex items-center h-[72px]">
              <div className="w-[160px] shrink-0 px-[24px] flex items-center h-full">
                <span className="text-[14px] font-normal text-secondary leading-[19px] opacity-65">
                  {t("colActivity")}
                </span>
              </div>
              <div className="w-[400px] shrink-0 px-[16px] flex items-center h-full">
                <span className="text-[14px] font-normal text-secondary leading-[19px] opacity-65">
                  {t("colMarket")}
                </span>
              </div>
              <SortHeader<OrderBy>
                label={t("colCash")}
                column="amount"
                activeColumn={filters.orderBy}
                sort={filters.sort}
                onToggle={(col) => dispatch({ type: "toggleSort", column: col })}
                className="flex-1"
              />
              <SortHeader<OrderBy>
                label={t("colTime")}
                column="created_at"
                activeColumn={filters.orderBy}
                sort={filters.sort}
                onToggle={(col) => dispatch({ type: "toggleSort", column: col })}
                className="flex-1"
              />
              <div className="flex-1 px-[16px] flex items-center h-full">
                <span className="text-[14px] font-normal text-secondary leading-[19px] opacity-65">
                  {t("colStatus")}
                </span>
              </div>
            </div>
            {transactions.map((tx, i) => (
              <TransactionRow key={tx.id} tx={tx} isLast={i === transactions.length - 1} />
            ))}
          </div>

          {/* H5: 卡片列表 */}
          <div className="flex lg:hidden flex-col gap-[12px]">
            {transactions.map((tx) => (
              <TransactionCard key={tx.id} tx={tx} />
            ))}
          </div>

          <LoadMoreButton
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </>
      )}
    </div>
  );
}

export default memo(TransactionHistory);
