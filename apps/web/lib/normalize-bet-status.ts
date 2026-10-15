import type { BetSettlementStatus } from "@/types/portfolio";

// 后端混用大小写：DB 大写 PENDING/WON/LOST/PUSH/VOID/CLAIMED/CANCELLED
// 接口 query / active 列表小写 live / pending；前端统一收敛为小写单一源（DD-087 §3.1）。
const KNOWN_STATUSES: ReadonlySet<BetSettlementStatus> = new Set([
  "live",
  "pending",
  "won",
  "lost",
  "push",
  "void",
  // DD-140 TC — claim 中间态，防止小写 "claiming" 被兜底成 "active"
  "claiming",
]);

export function normalizeBetStatus(raw: string | null | undefined): BetSettlementStatus {
  const v = (raw ?? "").trim().toLowerCase();
  if (KNOWN_STATUSES.has(v as BetSettlementStatus)) {
    return v as BetSettlementStatus;
  }
  return "active";
}
