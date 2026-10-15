"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import CategoryFilter, { type CategoryKey } from "./CategoryFilter";
import PoolMarketRow, { PoolMarketTableHeader } from "./PoolMarketRow";
import PoolMarketCard from "./PoolMarketCard";
// DD-130：池列表已切后端 /liquidity/match/pools（旧 DD-097 SportMonks 前端拼接已删）。
//    仅 Total Supply（totalDeposited）仍走链上只读补（后端暂不返回，见 BACKEND-FIELDS §1）。
import { useLiquidityFeaturedPools, type LpMatchPoolData } from "@/hooks/useLiquidityFeaturedPools";

const PAGE_SIZE = 8;

interface PoolMarketTableProps {
  onDeposit: (pool: LpMatchPoolData) => void;
}

export default function PoolMarketTable({ onDeposit }: PoolMarketTableProps) {
  const t = useTranslations("pools");
  const { address } = useAccount();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // 搜索透传到 hook 内部按 participant 名匹配（Batch 1 实现）；
  // category / favorites 仍走客户端过滤
  const { pools, isLoading, isBalanceFetching } = useLiquidityFeaturedPools({
    search,
    userAddress: address,
  });

  const toggleFav = (poolIdStr: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(poolIdStr)) next.delete(poolIdStr);
      else next.add(poolIdStr);
      return next;
    });
  };

  const handleCategoryChange = (c: CategoryKey) => {
    setCategory(c);
    setPage(1);
  };

  const handleSearchChange = (s: string) => {
    setSearch(s);
    setPage(1);
  };

  const filtered = useMemo(() => {
    return pools.filter((p) => {
      if (category === "fav") return favorites.has(p.poolId.toString());
      const sportFilter = category === "soccer" ? "football" : category;
      if (sportFilter !== "all" && sportFilter !== "more" && p.sport !== sportFilter) return false;
      // search 已在 hook 内部按队名过滤，UI 层不再重复 match 字符串过滤
      return true;
    });
  }, [pools, category, favorites]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div>
      {/* Section header */}
      <div className="mb-[16px]">
        <h2 className="font-orbitron text-[24px] font-bold text-primary leading-[32px]">
          {t("matchMarketsTitle")}
        </h2>
        <p className="text-[14px] text-secondary mt-[4px] leading-[19px]">
          {t("matchMarketsSubtitle")}
        </p>
      </div>

      {/* Category filter + search */}
      <CategoryFilter
        category={category}
        search={search}
        onCategoryChange={handleCategoryChange}
        onSearchChange={handleSearchChange}
      />

      {/* PC: table */}
      <div className="hidden lg:block overflow-x-auto">
        <div className="border border-secondary rounded-16 overflow-hidden">
          <table className="w-full">
            <PoolMarketTableHeader />
            <tbody>
              {pageItems.map((p, idx) => (
                <PoolMarketRow
                  key={p.poolId.toString()}
                  pool={p}
                  isFavorite={favorites.has(p.poolId.toString())}
                  onToggleFav={() => toggleFav(p.poolId.toString())}
                  onDeposit={onDeposit}
                  isLast={idx === pageItems.length - 1}
                  isFetching={isLoading}
                  isBalanceFetching={isBalanceFetching}
                />
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-[16px] py-[48px] text-center text-tertiary text-[14px]"
                  >
                    {isLoading ? "Loading..." : t("noMatches")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* H5: cards */}
      <div className="flex flex-col gap-[20px] lg:hidden">
        {pageItems.map((p) => (
          <PoolMarketCard
            key={p.poolId.toString()}
            pool={p}
            isFavorite={favorites.has(p.poolId.toString())}
            onToggleFav={() => toggleFav(p.poolId.toString())}
            onDeposit={onDeposit}
            isFetching={isLoading}
            isBalanceFetching={isBalanceFetching}
          />
        ))}
        {pageItems.length === 0 && (
          <p className="py-[48px] text-center text-tertiary text-[14px]">
            {isLoading ? "Loading..." : t("noMatches")}
          </p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-[4px] mt-[16px]">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            style={{ touchAction: "manipulation" }}
            className="px-[8px] min-h-[44px] text-secondary hover:text-primary disabled:opacity-40 text-[16px]"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{ touchAction: "manipulation" }}
              className={`w-[36px] min-h-[44px] rounded-8 text-[14px] font-medium transition-colors ${
                p === safePage
                  ? "bg-btn-primary text-static-black"
                  : "text-secondary hover:text-primary hover:bg-fill-card1"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            style={{ touchAction: "manipulation" }}
            className="px-[8px] min-h-[44px] text-secondary hover:text-primary disabled:opacity-40 text-[16px]"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
