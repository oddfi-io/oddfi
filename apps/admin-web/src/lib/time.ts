// 时间格式化。presale 时间是 epoch ms（number），admin-users 是 RFC3339（string）。
// 统一转 Asia/Shanghai (+08:00)。契约：00-architecture.md §1，03-pages.md §8/§9。
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Asia/Shanghai";

// 同时吃 epoch ms（number）和 RFC3339（string）→ Dayjs（+08:00）。null/undefined → null。
export function tsToDayjs(value: number | string | null | undefined): Dayjs | null {
  if (value == null || value === "") return null;
  const d = dayjs(value); // dayjs 同时接受 epoch ms（number）与 RFC3339（string）
  if (!d.isValid()) {
    console.warn("[time] tsToDayjs received invalid value —", value);
    return null;
  }
  return d.tz(TZ);
}

// 格式化为 +08:00 展示字符串。默认 "YYYY-MM-DD HH:mm"。
export function formatTs(
  value: number | string | null | undefined,
  format = "YYYY-MM-DD HH:mm",
): string {
  const d = tsToDayjs(value);
  return d ? d.format(format) : "—";
}
