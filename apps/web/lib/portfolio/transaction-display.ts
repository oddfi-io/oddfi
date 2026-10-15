// Portfolio History 流水展示派生工具（DD-087 §4.4，模式对齐 settle-display.ts）
// TransactionRow.tsx (PC) 与 TransactionCard.tsx (H5) 共用同一套
// TransactionType → Activity 颜色 / Activity i18n key / Cash 颜色 的派生逻辑。
// ASSETS.md 已查（关键词：transaction / activity / portfolio），无替代；
// 新建理由：消除 Row/Card 两份重复 switch，与 settle-display.ts 平行的展示单一源。

import type { TransactionRecord } from "@/types/portfolio";

/**
 * Activity 列文字颜色（DD-087 §4.4）
 * lost → 红；won / push / claim → 绿；其余（bet / cancel / void / 资金与质押流水）→ 白
 */
export function activityColor(type: TransactionRecord["type"]): string {
  switch (type) {
    case "lost":
      return "text-fn-red";
    case "won":
    case "push":
    case "claim":
      return "text-fn-green";
    default:
      return "text-primary";
  }
}

/** Activity 列 → portfolio.* i18n key（DD-087 §4.4 单一源） */
export function activityI18nKey(type: TransactionRecord["type"]): string {
  switch (type) {
    case "bet":
      return "actBet";
    case "cancel":
      return "actCancel";
    case "cashout":
      return "actCashout";
    case "claim":
      return "actClaim";
    case "won":
      return "actWon";
    case "lost":
      return "actLost";
    case "push":
      return "actPush";
    case "void":
      return "actVoid";
    case "deposit":
      return "actDeposit";
    case "withdraw":
      return "actWithdraw";
    case "stake":
      return "actStake";
    case "unstake":
      return "actUnstake";
    case "add_lp":
      return "actAddLp";
    case "remove_lp":
      return "actRemoveLp";
  }
}

/**
 * Cash 列数字颜色：按活动类型覆盖
 * - cancel（链下撤单）/ claim / void(退款) → 白
 * - withdraw / won（赢的派彩）→ 灰
 * - cashout（链上撤单兑现，ENH-037）→ 走默认正负 → +兑现额绿色（产品确认）
 * - 其余按金额正负 → 绿 / 红
 */
export function cashColor(type: TransactionRecord["type"], isPositive: boolean): string {
  if (type === "cancel" || type === "claim" || type === "void") return "text-primary";
  if (type === "withdraw" || type === "won") return "text-tertiary";
  return isPositive ? "text-fn-green" : "text-fn-red";
}
