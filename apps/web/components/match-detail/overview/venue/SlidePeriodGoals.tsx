"use client";

// @reference-screenshot: venue-3-period-goals.png

/** DD-104 Batch 3：接 MatchOverviewDomain.periodGoals（PeriodGoalDomain，camelCase homeAvg/awayAvg）。 */
import type { PeriodGoalDomain } from "@/types/match-detail-domain";
import { HOME_BLUE, AWAY_ORANGE } from "@/lib/match-colors";

interface Props {
  periodGoals: PeriodGoalDomain[];
}

const Y_MAX = 0.7; // Y 轴最大值
const Y_LABELS = ["0.57", "0.38", "0.19"]; // Y 轴刻度（字符串字面量，避开 toFixed lint）

export default function SlidePeriodGoals({ periodGoals }: Props) {
  return (
    <div className="flex h-full flex-col justify-between px-3 py-2.5">
      <p className="text-center text-[11px] font-medium text-white/70">Avg Goals / Period</p>

      <div className="flex flex-1 items-end gap-1 pt-1">
        <div className="flex h-full flex-col justify-between pb-3.5 pr-0.5">
          {Y_LABELS.map((label) => (
            <span key={label} className="text-[9px] leading-none text-white/50">
              {label}
            </span>
          ))}
        </div>

        <div className="flex flex-1 items-end justify-between gap-0.5">
          {periodGoals.map((period) => {
            const homeHeightPct = (period.homeAvg / Y_MAX) * 100;
            const awayHeightPct = (period.awayAvg / Y_MAX) * 100;
            return (
              <div key={period.period} className="flex flex-1 flex-col items-center gap-0.5">
                <div className="flex h-12 w-full items-end gap-0.5">
                  <div
                    className="flex-1 rounded-t-sm"
                    style={{ height: `${homeHeightPct}%`, backgroundColor: HOME_BLUE }}
                  />
                  <div
                    className="flex-1 rounded-t-sm"
                    style={{ height: `${awayHeightPct}%`, backgroundColor: AWAY_ORANGE }}
                  />
                </div>
                <span className="text-[9px] leading-none text-white/50">{period.period}&apos;</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
