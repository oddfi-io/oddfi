// User-level staking summary cards (DD-107 §3.6)
//
// 4 cards: totalActiveStake (合约 view) / totalPendingReward (前端 derive) /
//          vipTier (合约 view) / dailyLimit (合约 view, BettingPool 投注限额)
//
// 内部直接 useReadContracts multicall，不抽 useVipTier hook（Deletion Test fail，N=1 调用方）。
"use client";

import { useTranslations } from "next-intl";
import { useAccount, useReadContracts } from "wagmi";
import { formatUnits, zeroAddress } from "viem";
import { formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { CORE_CHAIN } from "@/lib/wagmi.config";
import { getContracts } from "@/lib/contracts";
import { STAKING_POOL_ABI } from "@/lib/abi/stakingPool";
import VipTierBadge from "./VipTierBadge";

interface UserStakeStatsProps {
  /** Sum of pending rewards across active positions (前端 derive, in ODD decimal string) */
  totalPendingReward: string;
}

export default function UserStakeStats({ totalPendingReward }: UserStakeStatsProps) {
  const t = useTranslations("staking");
  const { address } = useAccount();
  const c = getContracts(CORE_CHAIN.id);
  // DD-147：删 IS_TESTNET 业务闸，门控收敛到「stakingPool 地址是否配置」（testnet/mainnet 统一）
  const isAvailable = c.stakingPool !== zeroAddress;

  const { data } = useReadContracts({
    contracts:
      isAvailable && address
        ? ([
            {
              address: c.stakingPool,
              abi: STAKING_POOL_ABI,
              functionName: "getActiveStakeAmount",
              args: [address],
            },
            {
              address: c.stakingPool,
              abi: STAKING_POOL_ABI,
              functionName: "getUserTier",
              args: [address],
            },
            {
              address: c.stakingPool,
              abi: STAKING_POOL_ABI,
              functionName: "getUserDailyLimit",
              args: [address],
            },
            {
              address: c.stakingPool,
              abi: STAKING_POOL_ABI,
              functionName: "isActiveStaker",
              args: [address],
            },
          ] as const)
        : [],
    query: { enabled: isAvailable && !!address },
  });

  const [activeAmount, tierRes, dailyLimitRes, isActiveStakerRes] = data ?? [];

  const isActiveStaker = isActiveStakerRes?.status === "success" ? isActiveStakerRes.result : false;

  // 未连接钱包 / 非活跃质押者 → 不渲染整张卡条
  if (!address || !isActiveStaker) return null;

  const totalActive =
    activeAmount?.status === "success" ? formatUnits(activeAmount.result, 18) : "0";
  const tier = tierRes?.status === "success" ? tierRes.result : 0;
  const dailyLimit =
    dailyLimitRes?.status === "success" ? formatUnits(dailyLimitRes.result, 18) : "0";

  const fmtToken = (raw: string) => `${formatAmount(raw)} ${PLATFORM_TOKEN_DISPLAY}`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] lg:gap-[16px]">
      <div className="bg-fill-card1 rounded-16 p-[16px]">
        <p className="text-secondary text-[12px] mb-[8px]">{t("totalActiveStake")}</p>
        <p className="text-primary text-[18px] font-bold">{fmtToken(totalActive)}</p>
      </div>
      <div className="bg-fill-card1 rounded-16 p-[16px]">
        <p className="text-secondary text-[12px] mb-[8px]">{t("totalPendingReward")}</p>
        <p className="text-green text-[18px] font-bold">{fmtToken(totalPendingReward)}</p>
      </div>
      <div className="bg-fill-card1 rounded-16 p-[16px]">
        <p className="text-secondary text-[12px] mb-[8px]">{t("vipTier")}</p>
        <div className="flex items-center h-[26px]">
          <VipTierBadge tier={Number(tier)} />
        </div>
      </div>
      <div className="bg-fill-card1 rounded-16 p-[16px]" title={t("dailyBetLimitTooltip")}>
        <p className="text-secondary text-[12px] mb-[8px]">{t("dailyBetLimit")}</p>
        <p className="text-primary text-[18px] font-bold">{fmtToken(dailyLimit)}</p>
      </div>
    </div>
  );
}
