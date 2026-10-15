/**
 * Calendar 时区切换工具。
 *
 * 设计原因（DD-091 §3.5(3) + PRECHECK §6）：
 *   - `lib/date-utils.ts` 仅做 UTC 偏移，不支持 IANA tz toggle
 *   - `lib/format/relative-time.ts` 仅做「浏览器隐式 local」，不支持显式 IANA 字符串
 *   - PRD §A.1 强制 UTC ↔ Local toggle + 跨日重派列，必须有显式 IANA 入口
 *
 * 本模块为 Calendar 时区切换的**唯一入口**，所有 axis / cell 派位都走此处。
 */
import { Y_TIMES_UTC } from "./constants";

/** 时区模式：'UTC' 或 IANA 时区字符串（如 'Asia/Shanghai'） */
export type TimezoneMode = "UTC" | string;

export interface TimeAxisCell {
  /** 显示小时 "00"~"23" */
  hour: string;
  /** 显示标签，如 "16:00" */
  label: string;
  /** 是否次日（用于跨日视觉提示，可选） */
  isNextDay: boolean;
}

/**
 * 用于跨日检测的锚点日期（小组赛揭幕日）。
 * 平移逻辑取一个固定日期作锚，比赛实际跨日由 `formatKickoff` 单独算。
 */
const TIME_AXIS_ANCHOR_ISO = "2026-06-11";

/**
 * 构建 14 档 Y 轴时间标签（按目标时区）。
 * UTC 模式下保持 PRD 原始数组；IANA 时区下按对应小时偏移生成。
 *
 * @example
 *   buildTimeAxis('UTC')
 *   // [{ hour: '15', label: '15:00', isNextDay: false }, ..., { hour: '04', label: '04:00', isNextDay: true }]
 *   buildTimeAxis('Asia/Shanghai')  // CST = UTC+8
 *   // [{ hour: '23', label: '23:00', ... }, ..., { hour: '12', label: '12:00', ... }]
 */
export function buildTimeAxis(tz: TimezoneMode): TimeAxisCell[] {
  if (tz === "UTC") {
    // UTC 模式：直接用 PRD 数组；'00'~'04' 标记 isNextDay（相对锚点 06-11 的 UTC 视图）
    let nextDayStarted = false;
    return Y_TIMES_UTC.map((h) => {
      // 一旦从 23 跨到 00，后续都是次日
      if (h === "00") nextDayStarted = true;
      return { hour: h, label: `${h}:00`, isNextDay: nextDayStarted };
    });
  }

  // IANA 时区：把每个 UTC 整点转换到目标时区
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return Y_TIMES_UTC.map((utcHour) => {
    // '00'~'04' 是 UTC 次日凌晨档：日期需要 +1 天才能正确换算
    const isNextUtcDay = parseInt(utcHour, 10) < 15;
    const date = isNextUtcDay ? "2026-06-12" : TIME_AXIS_ANCHOR_ISO;
    const utcDate = new Date(`${date}T${utcHour}:00:00Z`);
    const parts = formatter.formatToParts(utcDate);
    const h = parts.find((p) => p.type === "hour")!.value;
    const m = parts.find((p) => p.type === "minute")!.value;
    const targetDay = parts.find((p) => p.type === "day")!.value;
    const anchorDay = TIME_AXIS_ANCHOR_ISO.slice(8, 10);
    // 次日判断：目标时区下日期与锚点不同
    const isNextDay = isNextUtcDay
      ? targetDay !== "12" // UTC 视图就跨日，如果目标时区还在 12 算同日（前一日）
      : targetDay !== anchorDay;
    return { hour: h, label: `${h}:${m}`, isNextDay };
  });
}

export interface KickoffParts {
  /** ISO date "yyyy-mm-dd"（目标时区视角） */
  date: string;
  /** 小时 "00"~"23"（目标时区） */
  hour: string;
  /** 分钟 "00"~"59" */
  minute: string;
}

/**
 * 把 UTC unix 时间戳 → 目标时区下的 (date, hour, minute)。
 *
 * 用于：
 *   - Match Card 显示开始时间
 *   - getCellPosition 算 grid 行/列位置
 */
export function formatKickoffInTz(unixSeconds: number, tz: TimezoneMode): KickoffParts {
  const date = new Date(unixSeconds * 1000);
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  // BUG-071 REV-v1-B #B5：垃圾 tz 会让 Intl.DateTimeFormat 构造抛 RangeError；
  // 兜底回 UTC，退化为安全行为，不让分桶 / 卡片显示因非法时区崩溃。
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", { timeZone: tz === "UTC" ? "UTC" : tz, ...opts });
  } catch {
    formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts });
  }
  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  const h = parts.find((p) => p.type === "hour")!.value;
  const min = parts.find((p) => p.type === "minute")!.value;
  return {
    date: `${y}-${m}-${d}`,
    // Intl 的 hour: '2-digit' + hour12: false 在 24:00 边界会输出 "24"，归一化到 "00"
    hour: h === "24" ? "00" : h.padStart(2, "0"),
    minute: min,
  };
}

/**
 * 取浏览器当前 IANA 时区字符串。SSR 阶段返回 'UTC' 兜底。
 */
export function getBrowserTimezone(): string {
  if (typeof window === "undefined") return "UTC";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// ─── BUG-071 唯一事实源：「一场比赛属于哪一天 + 怎么显示」 ──────────────────
//
// 病根（BUG-071）：「比赛归属哪一天」在仓里有 5 处各自为政实现（分桶 slice /
// today getTodayUTC / 组头 formatDateLabel / 卡片 toLocale / 请求 buildMarketParams），
// 三种口径（UTC 字符串切 / UTC 日历 / 浏览器隐式本地）并存 → 午夜边界必错位。
// 这里把「运营日 + 时刻展示」收敛成唯一入口，全仓只此一处，杜绝再加第 6 个补丁。
//
// ⚠️ 契约（REV-v1-B #B6）：dayKey / todayKey / formatKickoffDisplay 依赖**客户端时区**
// （getBrowserTimezone 在 SSR 返回 "UTC"）。宿主页必须 `dynamic(..., { ssr: false })`，
// 否则服务端按 UTC 分桶、客户端按本地显示会重新裂开、复发 BUG-071。

/**
 * 一场比赛的**本地运营日** key `YYYY-MM-DD`（目标时区视角）。
 * @param unixSeconds 开赛 unix 秒（已验证 = UTC）；缺失 / NaN 返回 ""，调用方走 fallback。
 * @param tz 目标时区（业务永远传 getBrowserTimezone()）。
 */
export function dayKey(unixSeconds: number, tz: TimezoneMode): string {
  // REV-v1-B #B3：缺失 / NaN 时刻直接返回空串，避免 formatToParts(Invalid Date) 抛 RangeError 致列表白屏。
  if (!Number.isFinite(unixSeconds)) return "";
  return formatKickoffInTz(unixSeconds, tz).date;
}

/** 本地「今天」运营日 key。与 dayKey 同函数同 tz，保证锚点与分桶同源。 */
export function todayKey(nowUnixSeconds: number, tz: TimezoneMode): string {
  return dayKey(nowUnixSeconds, tz);
}

export interface KickoffDisplay {
  /** "Thu, Jun 26"（weekday short + month short + day） */
  date: string;
  /** "3:00 PM" */
  time: string;
}

/**
 * 卡片日期 / 时间显示（BUG-071 REV 采纳 #B1）。
 * 与 dayKey 同输入（unix 时间戳）、同 tz（显式 getBrowserTimezone）、同函数族，
 * 杜绝「分桶显式 tz / 显示隐式本地 toLocale」非同源裂口（SSR 兜底 / Intl 异常 /
 * timestamp-string 跨午夜漂移三处会让二者分叉 → BUG-071 边角复发）。
 */
export function formatKickoffDisplay(
  unixSeconds: number,
  tz: TimezoneMode,
  locale: string
): KickoffDisplay {
  if (!Number.isFinite(unixSeconds)) return { date: "", time: "" };
  const zone = tz === "UTC" ? "UTC" : tz;
  const d = new Date(unixSeconds * 1000);
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
  try {
    return {
      date: d.toLocaleDateString(locale, { ...dateOpts, timeZone: zone }),
      time: d.toLocaleTimeString(locale, { ...timeOpts, timeZone: zone }),
    };
  } catch {
    // 垃圾 tz → 兜底 UTC，避免卡片白屏（与 formatKickoffInTz #B5 同策略）
    return {
      date: d.toLocaleDateString(locale, { ...dateOpts, timeZone: "UTC" }),
      time: d.toLocaleTimeString(locale, { ...timeOpts, timeZone: "UTC" }),
    };
  }
}
