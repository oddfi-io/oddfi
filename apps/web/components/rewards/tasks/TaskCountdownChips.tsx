"use client";

import { useCountdown } from "@/hooks/useCountdown";

/**
 * TaskCountdownChips —— 任务组倒计时 chip 组（Figma PC 9003:159580 · H5 9021:164002）。
 * 数值复用 useCountdown（SSR 安全：ZERO 初值 + useEffect tick）；本组件只做展示。
 * showDays=false（每日任务）时不渲染「天」chip，只 HH/MM/SS。
 * 归零（isExpired）时显示 00（DD-150 §3.4 边界态）。
 */
const pad = (n: number) => String(n).padStart(2, "0");

export function TaskCountdownChips({
  endTime,
  showDays = true,
}: {
  endTime: string;
  showDays?: boolean;
}) {
  const { days, hours, minutes, seconds } = useCountdown(endTime);

  const units = [
    ...(showDays ? [{ key: "d", value: days, letter: "D" }] : []),
    { key: "h", value: hours, letter: "H" },
    { key: "m", value: minutes, letter: "M" },
    { key: "s", value: seconds, letter: "S" },
  ];

  return (
    <div className="flex items-center gap-3">
      {units.map((u) => (
        <div key={u.key} className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-tertiary md:w-12">
            <span className="text-center text-lg font-bold leading-[26px] text-primary md:text-xl md:leading-7">
              {pad(u.value)}
            </span>
          </div>
          <span className="text-sm font-bold leading-[18px] text-tertiary">{u.letter}</span>
        </div>
      ))}
    </div>
  );
}
