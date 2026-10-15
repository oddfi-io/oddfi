"use client";

import { useEffect, useState } from "react";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 倒计时已结束 / 无效 endTime / null endTime 时为 true */
  isExpired: boolean;
}

const ZERO: Countdown = { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };

/**
 * 后端 end_time 字符串 → UTC Date 对象
 *
 * 后端格式 `"YYYY-MM-DD HH:mm:ss"` 是 UTC+0 但**无时区标记**。
 * 直接 `new Date("2026-07-22 23:59:59")` 浏览器按本地时区解析（错），
 * 须拼成 ISO 8601 UTC：把空格换 `T`、补 `Z` 后缀。
 */
export function parseUtcEndTime(input: string): Date | null {
  if (!input) return null;
  let iso = input.replace(" ", "T");
  if (!iso.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(iso)) iso = `${iso}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function diffToCountdown(target: Date): Countdown {
  const remaining = target.getTime() - Date.now();
  if (remaining <= 0) return ZERO;
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return { days, hours, minutes, seconds, isExpired: false };
}

/**
 * useCountdown：通用倒计时 hook
 *
 * @param endTime UTC+0 时间字符串（"YYYY-MM-DD HH:mm:ss" 后端格式）/ ISO 8601 / Date
 * @returns Countdown — 每秒 tick；endTime 为 null/undefined/无效时返回 ZERO（isExpired=true）
 *
 * 时区：endTime 视为 UTC；浏览器本地时区差由 Date 自动处理（getTime() 返回绝对 ms）
 */
export function useCountdown(endTime: string | Date | null | undefined): Countdown {
  const [countdown, setCountdown] = useState<Countdown>(ZERO);

  useEffect(() => {
    const target = !endTime ? null : endTime instanceof Date ? endTime : parseUtcEndTime(endTime);

    if (!target) {
      setCountdown(ZERO);
      return;
    }

    const tick = () => setCountdown(diffToCountdown(target));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return countdown;
}
