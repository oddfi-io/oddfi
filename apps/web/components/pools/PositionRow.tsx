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

interface PositionRowProps {
  position: LpPositionData;
  onAction: (position: LpPositionData) => void;
  isLast?: boolean;
}

function formatTimeLeft(msLeft: number): string {
  if (msLeft <= 0) return "";
  const hoursLeft = msLeft / 3600000;
  if (hoursLeft >= 24) return `${Math.ceil(hoursLeft / 24)}d`;
  if (hoursLeft >= 1) return `${Math.ceil(hoursLeft)}h`;
  return `${Math.ceil(msLeft / 60000)}m`;
}

// 合约 effective state → UI status 一对一映射
//   Active(0)       → active + 倒计时（unlockAt 之前显示 "Active·3d left"）
//   Unbonding(1)    → unbonding（排队等 epoch 满足；TODO: 后续接 epoch 倒计时）
//   Ready(2)        → ready（可调 requestUnbond，Action 列出 Redeem 按钮）
//   Withdrawn(3)    → withdrawn（终态，灰色）
//   Liquidated(4)   → liquidated（终态，红色）
//   Withdrawable(5) → withdrawable（可调 withdraw，Action 列出 Withdraw 按钮）
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
      // Guard: 合约未来若新增 LpPositionState，编译器不会报错（已有 default），
      // 这里显式 console.error 暴露到 Sentry 而不是静默归 active 掩盖问题。
      console.error(
        `[derivePositionStatus] Unknown LP position state: ${position.state} (positionId=${position.positionId})`
      );
      return { status: "active", timeLeft: "" };
    }
  }
}

export default function PositionRow({ position, onAction, isLast }: PositionRowProps) {
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
    <tr
      className={`border-b border-secondary hover:bg-fill-card1 transition-colors h-[80px] ${isLast ? "border-b-0" : ""}`}
    >
      {/* Pool / Plan — 三态文案由 derivePoolDisplay 统一派生，这里只管布局 */}
      <td className="px-[16px] py-[12px]">
        <div className={pool.isMatch ? "flex items-center gap-[10px]" : undefined}>
          {pool.isMatch && (
            <TeamAvatarPair
              homeTeamLogo={position.homeTeamLogo ?? ""}
              awayTeamLogo={position.awayTeamLogo ?? ""}
              size={32}
            />
          )}
          <div className="min-w-0">
            <p className="text-[14px] text-primary font-medium leading-tight truncate">
              {pool.title}
            </p>
            <p className="text-[12px] text-secondary mt-[2px] truncate">{pool.subline}</p>
          </div>
        </div>
      </td>

      {/* Deposited */}
      <td className="px-[16px] py-[12px] text-[14px] text-primary">{depositedDisplay}</td>

      {/* Current Value */}
      <td className="px-[16px] py-[12px] text-[14px] text-primary">{depositedDisplay}</td>

      {/* P&L */}
      <td className="px-[16px] py-[12px]">
        <span className="text-[14px] text-tertiary">—</span>
      </td>

      {/* Unlock */}
      <td className="px-[16px] py-[12px] text-[14px] text-primary">{unlockDisplay}</td>

      {/* Status */}
      <td className="px-[16px] py-[12px]">
        <PositionStatusBadge status={status} timeLeft={timeLeft} />
      </td>

      {/* Actions — 按 status 分四态：可操作按钮 / 锁定 / 排队中 / 已结束 */}
      <td className="px-[16px] py-[12px]">
        <PositionAction status={status} onClick={() => onAction(position)} />
      </td>
    </tr>
  );
}
