"use client";

import { useState, useEffect, memo } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(targetDate: string): TimeLeft {
  const diff = Math.max(0, new Date(targetDate).getTime() - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
}

const CountdownTimer = memo(function CountdownTimer({
  targetDate,
  className,
}: CountdownTimerProps) {
  // null on server → real value after hydration，避免 SSR mismatch
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setTimeLeft(calcTimeLeft(targetDate));
    const id = setInterval(() => setTimeLeft(calcTimeLeft(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!timeLeft) return null;

  const units = [
    { value: timeLeft.days, label: "Day" },
    { value: timeLeft.hours, label: "Hours" },
    { value: timeLeft.minutes, label: "Minutes" },
    { value: timeLeft.seconds, label: "Seconds" },
  ];

  return (
    <div className={`flex items-start justify-center gap-4 ${className ?? ""}`}>
      {units.map(({ value, label }, idx) => (
        <div key={label} className="flex items-start gap-4">
          {/* 冒号分隔符：与数字顶部对齐，同等字号 */}
          {idx > 0 && (
            <span
              className="text-white select-none"
              style={{ fontWeight: 500, fontSize: "29.43px", lineHeight: 1 }}
            >
              :
            </span>
          )}
          {/* 数字 + 单位标签容器 */}
          <div className="flex flex-col items-center">
            {/* 数字：Inter 500, 29.43px, #FFFFFF, line-height 100% */}
            <span
              className="text-white tabular-nums"
              style={{ fontWeight: 500, fontSize: "29.43px", lineHeight: 1 }}
            >
              {String(value).padStart(2, "0")}
            </span>
            {/* 单位标签：Inter 400, 17.66px, #FFFFFF 50%, line-height 100% */}
            <span
              className="text-white/50 text-center"
              style={{ fontWeight: 400, fontSize: "17.66px", lineHeight: 1, marginTop: "6px" }}
            >
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
});

export default CountdownTimer;
