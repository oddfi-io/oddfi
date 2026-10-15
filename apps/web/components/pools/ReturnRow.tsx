"use client";

import { ReturnResultBadge } from "./StatusBadge";
import TeamAvatarPair from "@/components/common/TeamAvatarPair";
import type { ReturnRecord } from "./types";

interface ReturnRowProps {
  record: ReturnRecord;
  isLast?: boolean;
}

export default function ReturnRow({ record: r, isLast }: ReturnRowProps) {
  return (
    <tr
      className={`border-b border-secondary hover:bg-fill-card1 transition-colors h-[80px] ${isLast ? "border-b-0" : ""}`}
    >
      {/* Match */}
      <td className="px-[16px] py-[12px]">
        <div className="flex items-center gap-[12px]">
          <TeamAvatarPair homeTeamLogo={r.homeTeamLogo} awayTeamLogo={r.awayTeamLogo} size={32} />
          <div>
            <p className="text-[14px] text-primary font-medium leading-tight">{r.match}</p>
            <p className="text-[12px] text-secondary mt-[2px]">{r.matchDate}</p>
          </div>
        </div>
      </td>

      {/* Date */}
      <td className="px-[16px] py-[12px] text-[14px] text-primary">{r.date}</td>

      {/* Result */}
      <td className="px-[16px] py-[12px]">
        <ReturnResultBadge result={r.result} />
      </td>

      {/* Margin Earned */}
      <td className="px-[16px] py-[12px] text-[14px]">
        <span className={r.marginEarned === "0 ODD" ? "text-primary" : "text-green"}>
          {r.marginEarned}
        </span>
      </td>

      {/* Loss Absorbed */}
      <td className="px-[16px] py-[12px] text-[14px]">
        <span className={r.lossAbsorbed === "0 ODD" ? "text-primary" : "text-fn-red"}>
          {r.lossAbsorbed}
        </span>
      </td>

      {/* Net P&L */}
      <td className="px-[16px] py-[12px] text-[14px] font-medium">
        <span className={r.netPnlPositive ? "text-green" : "text-fn-red"}>{r.netPnl}</span>
      </td>
    </tr>
  );
}
