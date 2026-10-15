"use client";

import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import TeamAvatarPair from "@/components/common/TeamAvatarPair";
import { PositionStatusBadge, PositionAction } from "./StatusBadge";
import { LP_POSITION_STATE } from "@/lib/abi/liquidityPool";
import { formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { derivePoolDisplay } from "@/hooks/useLpPositions";
import type { LpPositionData } from "@/hooks/useLpPositions";
import type { PositionStatus } from "./types";

interface PositionCardProps {
  position: LpPositionData;
  onAction: (position: LpPositionData) => void;
}

function formatTimeLeft(msLeft: number): string {
  if (msLeft <= 0) return "";
  const hoursLeft = msLeft / 3600000;
  if (hoursLeft >= 24) return `${Math.ceil(hoursLeft / 24)}d`;
  if (hoursLeft >= 1) return `${Math.ceil(hoursLeft)}h`;
  return `${Math.ceil(msLeft / 60000)}m`;
}

// 合约 effective state → UI status 一对一映射（与 PositionRow 对齐）
function derivePositionStatus(position: LpPositionData): {
  status: PositionStatus;
  timeLeft: string;
} {
  switch (position.state) {
    case LP_POSITION_STATE.Ready:
      return { status: "ready", timeLeft: "" };
    case LP_POSITION_STATE.Withdrawable:
      return { status: "withdrawable", timeLeft: "" };
    case LP_POSITION_STATE.Unbonding:
      return { status: "unbonding", timeLeft: "" };
    case LP_POSITION_STATE.Withdrawn:
      return { status: "withdrawn", timeLeft: "" };
    case LP_POSITION_STATE.Liquidated:
      return { status: "liquidated", timeLeft: "" };
    case LP_POSITION_STATE.Active: {
      const msLeft = Number(position.unlockAt) * 1000 - Date.now();
      return { status: "active", timeLeft: formatTimeLeft(msLeft) };
    }
    default: {
      console.error(
        `[derivePositionStatus] Unknown LP position state: ${position.state} (positionId=${position.positionId})`
      );
      return { status: "active", timeLeft: "" };
    }
  }
}

export default function PositionCard({ position, onAction }: PositionCardProps) {
  const t = useTranslations("pools");
  const { status, timeLeft } = derivePositionStatus(position);
  const pool = derivePoolDisplay(position, t("allPoolsTitle"));

  const depositedDisplay =
    formatAmount(formatUnits(position.principal, 18)) + " " + PLATFORM_TOKEN_DISPLAY;

  const unlockDisplay =
    position.unlockAt === 0n
      ? "—"
      : new Date(Number(position.unlockAt) * 1000).toLocaleDateString();

  return (
    <div className="bg-fill-card1 rounded-16 p-[16px] flex flex-col gap-[24px]">
      {/* 顶部：Pool / Plan 信息 */}
      <div className="flex flex-col gap-[12px]">
        {/* 顶部头区 — 三态文案由 derivePoolDisplay 统一派生，这里只管布局 */}
        <div className="flex items-center gap-[8px]">
          {pool.isMatch && (
            <TeamAvatarPair
              homeTeamLogo={position.homeTeamLogo ?? ""}
              awayTeamLogo={position.awayTeamLogo ?? ""}
              size={32}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-primary font-medium leading-[19px] truncate">
              {pool.title}
            </p>
            <p className="text-[12px] text-secondary mt-[2px] opacity-50 truncate">
              {pool.subline}
            </p>
          </div>
        </div>

        {/* 5 行 key-value */}
        <div className="flex flex-col gap-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-secondary">{t("deposited")}</span>
            <span className="text-[14px] text-primary">{depositedDisplay}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-secondary">{t("currentValue")}</span>
            <span className="text-[14px] text-primary">{depositedDisplay}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-secondary">{t("pnl")}</span>
            <span className="text-[14px] text-tertiary">—</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-secondary">{t("unlock")}</span>
            <span className="text-[14px] text-primary">{unlockDisplay}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-secondary">{t("colStatus")}</span>
            <PositionStatusBadge status={status} timeLeft={timeLeft} />
          </div>
        </div>
      </div>

      {/* 底部：按 status 派生 4 态（Redeem/Withdraw 按钮 / Locked / Pending / —） */}
      <PositionAction status={status} onClick={() => onAction(position)} variant="card" />
    </div>
  );
}
