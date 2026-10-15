import type { H2HForm, FormMatchRow, MatchOutcome } from "@/types/moneyline";
import {
  HOME_BLUE as HOME_COLOR,
  AWAY_ORANGE as AWAY_COLOR,
  OUTCOME_BG_CLASS,
} from "@/lib/match-colors";

interface H2HCardFormProps {
  h2hForm: H2HForm;
  homeShortCode: string;
  awayShortCode: string;
}

function OutcomeBadge({ outcome }: { outcome: MatchOutcome }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold shrink-0 text-white ${OUTCOME_BG_CLASS[outcome]}`}
    >
      {outcome}
    </span>
  );
}

function MatchRow({ match, align }: { match: FormMatchRow; align: "left" | "right" }) {
  const score = `${match.score_home}:${match.score_away}`;
  const venue = match.is_home ? "⌂" : "@";

  if (align === "left") {
    return (
      <div className="flex items-center gap-1.5 h-[26px]">
        <OutcomeBadge outcome={match.outcome} />
        <span className="text-[10px] text-tertiary">{venue}</span>
        <span className="text-[11px] text-secondary font-medium">{match.opponent_short}</span>
        <span className="text-[11px] text-primary font-semibold ml-auto">{score}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 h-[26px] justify-end">
      <span className="text-[11px] text-primary font-semibold mr-auto">{score}</span>
      <span className="text-[11px] text-secondary font-medium">{match.opponent_short}</span>
      <span className="text-[10px] text-tertiary">{venue}</span>
      <OutcomeBadge outcome={match.outcome} />
    </div>
  );
}

export function H2HCardForm({ h2hForm, homeShortCode, awayShortCode }: H2HCardFormProps) {
  const total = h2hForm.home_percentage + h2hForm.away_percentage;
  const homeShare = total > 0 ? (h2hForm.home_percentage / total) * 100 : 50;
  const awayShare = total > 0 ? (h2hForm.away_percentage / total) * 100 : 50;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-medium text-secondary uppercase tracking-wide text-center">
        Form · Win Rate (Last 5)
      </p>

      {/* 队码 + 百分比 + 横向比例条（替代原竖向柱状图，节省垂直空间并明确语义） */}
      <div className="flex flex-col gap-1">
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-[16px] font-bold leading-none" style={{ color: HOME_COLOR }}>
              {h2hForm.home_percentage}%
            </span>
            <span className="text-[10px] text-tertiary mt-0.5">{homeShortCode}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[16px] font-bold leading-none" style={{ color: AWAY_COLOR }}>
              {h2hForm.away_percentage}%
            </span>
            <span className="text-[10px] text-tertiary mt-0.5">{awayShortCode}</span>
          </div>
        </div>
        <div className="flex h-[6px] w-full overflow-hidden rounded-full">
          <div style={{ width: `${homeShare}%`, backgroundColor: HOME_COLOR }} />
          <div style={{ width: `${awayShare}%`, backgroundColor: AWAY_COLOR }} />
        </div>
      </div>

      {/* 双列近 5 场 */}
      <div className="grid grid-cols-2 gap-x-3">
        <div className="space-y-0.5">
          {h2hForm.home_matches.map((match, idx) => (
            <MatchRow key={idx} match={match} align="left" />
          ))}
        </div>
        <div className="space-y-0.5">
          {h2hForm.away_matches.map((match, idx) => (
            <MatchRow key={idx} match={match} align="right" />
          ))}
        </div>
      </div>
    </div>
  );
}
