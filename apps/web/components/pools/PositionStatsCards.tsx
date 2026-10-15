"use client";

import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import { formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { useLpPositions } from "@/hooks/useLpPositions";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";
import { useWallet } from "@/hooks/useWallet";

export default function PositionStatsCards() {
  const t = useTranslations("pools");
  const { address } = useWallet();
  const { positions, isLoading } = useLpPositions(address);

  // 累计存入：历史快照，所有仓位本金的和（含终态）
  const totalDeposited = positions.reduce((sum, p) => sum + p.principal, 0n);
  // 当前价值：资金仍在合约里的部分。Withdrawn/Liquidated 已离开合约，不计入。
  // V1 简化：当前价值 = Σ (非终态 principal)；V2 接入 reward/loss 累加器后再算 PnL
  const currentValue = positions
    .filter(
      (p) => p.state !== LP_POSITION_STATE.Withdrawn && p.state !== LP_POSITION_STATE.Liquidated
    )
    .reduce((sum, p) => sum + p.principal, 0n);
  const readyToWithdraw = positions
    .filter((p) => p.state === LP_POSITION_STATE.Withdrawable)
    .reduce((sum, p) => sum + p.principal, 0n);
  // 活跃仓位：钱还在合约里就算（Active / Unbonding / Ready / Withdrawable）
  const activePositions = positions.filter(
    (p) =>
      p.state === LP_POSITION_STATE.Active ||
      p.state === LP_POSITION_STATE.Unbonding ||
      p.state === LP_POSITION_STATE.Ready ||
      p.state === LP_POSITION_STATE.Withdrawable
  ).length;

  const dash = "—";
  const fmtToken = (raw: bigint) =>
    `${formatAmount(formatUnits(raw, 18))} ${PLATFORM_TOKEN_DISPLAY}`;

  const stats = [
    {
      label: t("totalDeposited"),
      value: !address || isLoading ? dash : fmtToken(totalDeposited),
    },
    {
      label: t("currentValue"),
      value: !address || isLoading ? dash : fmtToken(currentValue),
    },
    {
      label: t("readyToWithdraw"),
      value: !address || isLoading ? dash : fmtToken(readyToWithdraw),
    },
    {
      label: t("activePositions"),
      value: !address || isLoading ? dash : String(activePositions),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] lg:gap-[16px]">
      {stats.map((s) => (
        <div key={s.label} className="bg-fill-card1 rounded-16 p-[16px]">
          <p className="text-secondary text-[12px] mb-[8px]">{s.label}</p>
          <p className="text-primary text-[18px] font-bold">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
