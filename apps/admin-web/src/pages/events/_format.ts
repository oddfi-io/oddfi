// 赛事风险页展示层纯函数（DD002 T07）。色值零硬编码：色彩一律返回 AntD Tag preset 名。
import Decimal from "decimal.js";
import type { EventScore, EventStatus } from "@/types/events";

// 终场比分（对象 {home,away}，联调 A schema diff）→ "2 : 1"；null → null（调用方渲染「—」/隐藏）。
export function formatScore(score: EventScore | null | undefined): string | null {
  if (score == null || score.home == null || score.away == null) return null;
  return `${score.home} : ${score.away}`;
}

// 时间线当前阶段映射（DD003 W2 走查 6/5 修订，原 §2.2）：高亮跟随业务阶段，
// 纯 status 驱动，不再被「未开盘」抢占（opened 与 status 正交，未开盘语义由
// 整行置灰 + SignalTag 独立承担）。
// pending(未开赛)→开赛 / active(已开赛未锁定+锁定中)→锁盘 / settled→结算。
export type Stage = "open" | "lock" | "kickoff" | "settle";

export function currentStage(status: EventStatus): Stage {
  if (status === "pending") return "kickoff";
  if (status === "active") return "lock";
  return "settle";
}

// 收益率三态（原型 :4628）：>0.5 红 / >0.3 黄 / 其余绿；null →「—」（D6 落库前预期态）。
export function yieldTier(ratio: number | null | undefined): {
  color: "red" | "gold" | "green";
  text: string;
} | null {
  if (ratio == null || Number.isNaN(ratio)) return null;
  const text = new Intl.NumberFormat("zh-CN", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio);
  if (ratio > 0.5) return { color: "red", text };
  if (ratio > 0.3) return { color: "gold", text };
  return { color: "green", text };
}

// settled 盈亏（settle_pl，正=平台盈利绿 / 负红）。金额 string 走 decimal.js，禁 parseFloat。
export function settlePlTier(value: string | null | undefined): {
  color: "green" | "red";
  negative: boolean;
} | null {
  if (value == null || value === "") return null;
  let dec: Decimal;
  try {
    dec = new Decimal(value);
  } catch {
    console.warn("[events] settlePlTier received invalid decimal —", value);
    return null;
  }
  const negative = dec.isNegative();
  return { color: negative ? "red" : "green", negative };
}

// 赔率类数值展示（JSON number，仅展示不参与运算）。null →「—」。
export function formatOdds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return String(value);
}

// 赔率差值（odds_diff，第三方 − 当前）：带正负号展示。null →「—」。
export function formatSignedOdds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value > 0 ? `+${value}` : String(value);
}

// 压缩率/上浮率（adjust_ratio，比率：-0.09 = 压缩 9%）：带符号百分比。null →「—」。
export function formatRatioPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
}
