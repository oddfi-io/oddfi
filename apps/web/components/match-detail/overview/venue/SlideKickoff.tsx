"use client";

// @reference-screenshot: venue-5-kickoff.png

/** DD-104 Batch 3：接 MatchOverviewDomain.kickoff + referee + managers。 */
import { useEffect, useState } from "react";
import { TShirtIcon } from "@phosphor-icons/react";

interface Props {
  kickoff: { iso: string; timestamp: number };
  referee: { name: string };
  managers: { home: { name: string }; away: { name: string } };
}

interface Countdown {
  days: number;
  hrs: number;
  mins: number;
  secs: number;
}

function calcCountdown(targetTimestamp: number): Countdown {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, targetTimestamp - now);

  const days = Math.floor(diff / 86400);
  const hrs = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;

  return { days, hrs, mins, secs };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function SlideKickoff({ kickoff, managers }: Props) {
  const starting_at_timestamp = kickoff.timestamp;

  // 防止 hydration mismatch：SSR 阶段不渲染倒计时
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState<Countdown>({ days: 0, hrs: 0, mins: 0, secs: 0 });

  useEffect(() => {
    setMounted(true);
    setCountdown(calcCountdown(starting_at_timestamp));

    const timer = setInterval(() => {
      setCountdown(calcCountdown(starting_at_timestamp));
    }, 1000);

    return () => clearInterval(timer);
  }, [starting_at_timestamp]);

  const blocks = [
    { label: "Days", value: mounted ? pad(countdown.days) : "--" },
    { label: "Hrs", value: mounted ? pad(countdown.hrs) : "--" },
    { label: "Mins", value: mounted ? pad(countdown.mins) : "--" },
    { label: "Secs", value: mounted ? pad(countdown.secs) : "--" },
  ];

  return (
    <div className="flex h-full flex-col justify-between px-3 py-2.5">
      <p className="text-center text-[11px] font-medium text-white/70">Kickoff Time</p>

      <div className="flex justify-center gap-2">
        {blocks.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className="flex h-8 w-8 items-center justify-center rounded text-[14px] font-bold text-white"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              {value}
            </div>
            <span className="text-[9px] leading-none text-white/50">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/70">
        <div className="flex min-w-0 items-center gap-1">
          <TShirtIcon size={12} className="text-white/50 shrink-0" />
          <span className="truncate font-medium text-white">{managers.home.name}</span>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1">
          <span className="truncate font-medium text-white">{managers.away.name}</span>
          <TShirtIcon size={12} className="text-white/50 shrink-0" />
        </div>
      </div>
    </div>
  );
}
