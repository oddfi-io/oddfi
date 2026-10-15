"use client";

import { StarIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import FireIcon from "@/components/icons/FireIcon";
import TeamAvatarPair from "@/components/common/TeamAvatarPair";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import type { LpMatchPoolData } from "@/hooks/useLiquidityFeaturedPools";

interface PoolMarketCardProps {
  pool: LpMatchPoolData;
  isFavorite: boolean;
  onToggleFav: () => void;
  onDeposit: (pool: LpMatchPoolData) => void;
  isFetching?: boolean;
  /** 用户 LP 仓位 refetch 中（合约交互后）— 仅 myBalance 行上骨架 */
  isBalanceFetching?: boolean;
}

function NumberSkeleton({ width = "w-[80px]" }: { width?: string }) {
  return <div className={`h-[14px] ${width} rounded bg-fill-card2 animate-pulse`} />;
}

export default function PoolMarketCard({
  pool,
  isFavorite,
  onToggleFav,
  onDeposit,
  isFetching,
  isBalanceFetching,
}: PoolMarketCardProps) {
  const t = useTranslations("pools");
  const { format } = useCurrencyDisplay();
  const fmtToken = (raw: bigint) => format(formatUnits(raw, 18));

  return (
    <div className="bg-fill-card1 rounded-16 p-[16px] flex flex-col gap-[24px]">
      {/* Top: match header + key-value pairs */}
      <div className="flex flex-col gap-[16px]">
        <div className="flex items-center gap-[8px]">
          <TeamAvatarPair
            homeTeamLogo={pool.homeTeamLogo}
            awayTeamLogo={pool.awayTeamLogo}
            size={32}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[4px]">
              <span className="text-[14px] font-medium text-primary leading-[19px] truncate">
                {pool.match}
              </span>
              {pool.hot && <FireIcon size={16} />}
            </div>
            <p className="text-[12px] text-secondary mt-[2px] opacity-50">{pool.matchDate}</p>
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-secondary text-[14px]">{t("totalSupply")}</span>
            <span className="text-primary text-[14px] font-medium">
              {isFetching ? <NumberSkeleton width="w-[100px]" /> : fmtToken(pool.totalDeposited)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-secondary text-[14px]">{t("colVolume24h")}</span>
            <span className="text-primary text-[14px] font-medium">
              {isFetching ? <NumberSkeleton width="w-[100px]" /> : fmtToken(pool.totalBet)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-secondary text-[14px]">{t("estApy")}</span>
            <span className="text-green text-[14px] font-medium">
              {isFetching ? <NumberSkeleton width="w-[40px]" /> : pool.estApy}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-secondary text-[14px]">{t("myBalance")}</span>
            <span className="text-primary text-[14px] font-medium">
              {isFetching || isBalanceFetching ? (
                <NumberSkeleton width="w-[100px]" />
              ) : (
                fmtToken(pool.myBalance)
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom: star + Add */}
      <div className="flex items-center gap-[12px] h-[40px]">
        <button
          onClick={onToggleFav}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          className="flex items-center justify-center size-[40px] shrink-0 bg-btn-tertiary rounded-8 focus:outline-none"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <StarIcon
            size={20}
            weight={isFavorite ? "fill" : "regular"}
            className={isFavorite ? "text-fn-yellow" : "text-primary"}
          />
        </button>
        <button
          onClick={() => onDeposit(pool)}
          disabled={!pool.canDeposit}
          style={{ touchAction: "manipulation" }}
          className="flex-1 bg-btn-primary-white text-static-black rounded-8 h-full text-[12px] font-medium hover:bg-btn-primary-white-hover transition-colors shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("add")}
        </button>
      </div>
    </div>
  );
}
