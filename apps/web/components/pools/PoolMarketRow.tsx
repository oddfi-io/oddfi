"use client";

import { StarIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import FireIcon from "@/components/icons/FireIcon";
import TeamAvatarPair from "@/components/common/TeamAvatarPair";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import type { LpMatchPoolData } from "@/hooks/useLiquidityFeaturedPools";

interface PoolMarketRowProps {
  pool: LpMatchPoolData;
  isFavorite: boolean;
  onToggleFav: () => void;
  onDeposit: (pool: LpMatchPoolData) => void;
  isLast?: boolean;
  /** refetch 中：链上数字字段显示骨架占位避免旧值闪现 */
  isFetching?: boolean;
  /** 用户 LP 仓位 refetch 中（合约交互后）— 仅 myBalance 列上骨架，与全局 isFetching 解耦 */
  isBalanceFetching?: boolean;
}

export function PoolMarketTableHeader() {
  const t = useTranslations("pools");

  return (
    <thead>
      <tr className="border-b border-secondary h-[72px]">
        <th className="w-[44px] px-[16px]" />
        <th className="text-left px-[16px] text-[14px] font-medium text-secondary">
          {t("colMatch")}
        </th>
        <th className="text-left px-[16px] text-[14px] font-medium text-secondary">
          <span className="flex items-center gap-[4px]">
            {t("totalSupply")}
            <CaretUpDownIcon size={14} className="text-tertiary" />
          </span>
        </th>
        <th className="text-left px-[16px] text-[14px] font-medium text-secondary">
          <span className="flex items-center gap-[4px]">
            {t("colVolume24h")}
            <CaretUpDownIcon size={14} className="text-tertiary" />
          </span>
        </th>
        <th className="text-left px-[16px] text-[14px] font-medium text-secondary">
          <span className="flex items-center gap-[4px]">
            {t("myBalance")}
            <CaretUpDownIcon size={14} className="text-tertiary" />
          </span>
        </th>
        <th className="text-center px-[16px] text-[14px] font-medium text-secondary">
          {t("colActions")}
        </th>
      </tr>
    </thead>
  );
}

function NumberCell({ children }: { children: React.ReactNode }) {
  return <td className="px-[16px] py-[0] text-[14px] text-primary">{children}</td>;
}

function NumberSkeleton({ width = "w-[80px]" }: { width?: string }) {
  return <div className={`h-[14px] ${width} rounded bg-fill-card2 animate-pulse`} />;
}

export default function PoolMarketRow({
  pool,
  isFavorite,
  onToggleFav,
  onDeposit,
  isLast,
  isFetching,
  isBalanceFetching,
}: PoolMarketRowProps) {
  const t = useTranslations("pools");
  const { format } = useCurrencyDisplay();
  const fmtToken = (raw: bigint) => format(formatUnits(raw, 18));

  return (
    <tr
      className={`border-b border-secondary hover:bg-fill-card1 transition-colors h-[80px] ${isLast ? "border-b-0" : ""}`}
    >
      {/* Favorite */}
      <td className="px-[16px] py-[0]">
        <button
          onClick={onToggleFav}
          style={{ touchAction: "manipulation" }}
          className="flex items-center justify-center w-[28px] min-h-[44px]"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <StarIcon
            size={16}
            weight={isFavorite ? "fill" : "regular"}
            className={isFavorite ? "text-fn-yellow" : "text-tertiary hover:text-primary"}
          />
        </button>
      </td>

      {/* Match */}
      <td className="px-[16px] py-[0]">
        <div className="flex items-center gap-[10px]">
          <TeamAvatarPair
            homeTeamLogo={pool.homeTeamLogo}
            awayTeamLogo={pool.awayTeamLogo}
            size={32}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-[6px]">
              <span className="text-[14px] font-medium text-primary truncate">{pool.match}</span>
              {pool.hot && <FireIcon size={14} />}
            </div>
            <p className="text-[12px] text-secondary truncate">{pool.matchDate}</p>
          </div>
        </div>
      </td>

      <NumberCell>
        {isFetching ? <NumberSkeleton width="w-[100px]" /> : fmtToken(pool.totalDeposited)}
      </NumberCell>
      <NumberCell>
        {isFetching ? <NumberSkeleton width="w-[100px]" /> : fmtToken(pool.totalBet)}
      </NumberCell>
      <NumberCell>
        {isFetching || isBalanceFetching ? (
          <NumberSkeleton width="w-[100px]" />
        ) : (
          fmtToken(pool.myBalance)
        )}
      </NumberCell>

      {/* Actions */}
      <td className="px-[16px] py-[0]">
        <div className="flex items-center justify-center gap-[8px]">
          <button
            onClick={() => onDeposit(pool)}
            disabled={!pool.canDeposit}
            style={{ touchAction: "manipulation" }}
            className="bg-btn-primary-white text-static-black rounded-8 px-[16px] h-[32px] text-[14px] font-medium hover:bg-btn-primary-white-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("add")}
          </button>
        </div>
      </td>
    </tr>
  );
}
