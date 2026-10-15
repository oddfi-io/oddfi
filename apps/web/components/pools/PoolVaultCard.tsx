"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";
import { useLiquidityPoolStats } from "@/hooks/useLiquidityPoolStats";
import { useLpPositions } from "@/hooks/useLpPositions";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";

interface PoolVaultCardProps {
  onDeposit: () => void;
}

export default function PoolVaultCard({ onDeposit }: PoolVaultCardProps) {
  const t = useTranslations("pools");
  const { address } = useAccount();
  const { totalActiveDeposited, isLoading } = useLiquidityPoolStats();
  const { positions, isLoading: isPositionsLoading } = useLpPositions(address);
  const { format } = useCurrencyDisplay();

  // My Balance = 用户在 Global Pool（poolId=0）所有 active 仓位 principal 之和
  // 排除 Withdrawn/Liquidated（已提取）；保留 Active/Unbonding/Ready/Withdrawable（钱仍在合约）
  const myGlobalDeposited = positions
    .filter(
      (p) =>
        p.poolId === 0n &&
        p.state !== LP_POSITION_STATE.Withdrawn &&
        p.state !== LP_POSITION_STATE.Liquidated
    )
    .reduce((sum, p) => sum + p.principal, 0n);

  const hasData = !isLoading && totalActiveDeposited > 0n;
  const totalSupplyDisplay = hasData ? format(formatUnits(totalActiveDeposited, 18)) : "—";
  const myBalanceDisplay = isPositionsLoading ? "—" : format(formatUnits(myGlobalDeposited, 18));

  return (
    <div className="bg-fill-card1 rounded-16 p-[16px] lg:p-[36px] mb-[36px] lg:mb-[54px]">
      {/* Stats + Actions */}
      {/* PC: flex row; H5: flex col */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-[20px]">
        {/* Stats */}
        <div className="flex flex-col lg:flex-row gap-[24px] lg:gap-[48px]">
          <div>
            <p className="text-secondary text-[12px] mb-[4px]">{t("totalSupply")}</p>
            <p className="font-bold text-[20px] text-primary">{totalSupplyDisplay}</p>
          </div>
          <div>
            <p className="text-secondary text-[12px] mb-[4px]">{t("estApy")}</p>
            <p className="font-bold text-[20px] text-green">42.6%</p>
          </div>
          <div>
            <p className="text-secondary text-[12px] mb-[4px]">{t("myBalance")}</p>
            <p className="font-bold text-[20px] text-primary">{myBalanceDisplay}</p>
          </div>
        </div>

        {/* Action button — single Add (Redeem removed; per-position redeem in Positions tab) */}
        <div className="flex gap-[8px] lg:gap-[12px]">
          <button
            onClick={onDeposit}
            style={{ touchAction: "manipulation" }}
            className="flex items-center gap-[8px] justify-center bg-btn-primary rounded-8 lg:rounded-12 h-[40px] lg:h-[48px] px-[24px] lg:w-[160px] text-[14px] font-medium min-h-[44px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-colors flex-1 lg:flex-none"
          >
            <DownloadSimpleIcon size={16} weight="regular" className="text-static-black" />
            <span className="text-static-black">{t("add")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
