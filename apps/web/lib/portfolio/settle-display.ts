// Portfolio Settle 注单展示派生工具（DD-087 §3.2 + DD-115）
// SettledBetsTable.tsx (PC) 与 SettledBetCard.tsx (H5) 共用同一套状态 →
// 颜色 / i18n key / Claim 按钮文案 / Payout 主副金额 的派生逻辑。

import type { PortfolioBet } from "@/types/portfolio";

/**
 * settlementStatus → Tailwind 颜色 class
 * won / push / void 全部走绿色（push 走水退本金，void 退款，语义上"非亏"）
 * lost → 红，其他态（pending / live / active 等未结算）→ primary 默认色
 */
export function statusColor(status: PortfolioBet["settlementStatus"]): string {
  switch (status) {
    case "won":
    case "push":
    case "void":
      return "text-fn-green";
    case "lost":
      return "text-fn-red";
    default:
      return "text-primary";
  }
}

export type SettledResultI18nKey =
  | "resultWon"
  | "resultLost"
  | "resultVoid"
  | "resultPush"
  | "resultCashback"
  // DD-140 TC — claim 中间态文案
  | "statusClaiming";

/** settlementStatus → portfolio.* i18n key 后缀；未知态兜底 resultVoid */
export function statusI18nKey(status: PortfolioBet["settlementStatus"]): SettledResultI18nKey {
  switch (status) {
    case "won":
      return "resultWon";
    case "lost":
      return "resultLost";
    case "void":
      return "resultVoid";
    case "push":
      return "resultPush";
    case "cashback":
      return "resultCashback";
    // DD-140 TC — claim 交易已广播、链上结果未落定
    case "claiming":
      return "statusClaiming";
  }
  return "resultVoid";
}

/** Claim 按钮文案 i18n key：void → "Claim Refund"，其余可领态 → "Claim Winnings" */
export function claimButtonKey(
  status: PortfolioBet["settlementStatus"]
): "claimWinnings" | "claimRefund" {
  return status === "void" ? "claimRefund" : "claimWinnings";
}

/**
 * Payout 列展示派生：(prefix, amount, usd)
 * - won / push → +claimAmount（actual_payout，回退 potentialWin）
 * - lost       → -stake
 * - void       → +stake（退款，全额返本）
 * - cashback   → +cashoutAmount（回退 stake）
 * - 其他（active / live / pending）→ 空 prefix + stake，理论上 Settle 视图不会进
 */
export function payoutDisplay(bet: PortfolioBet): {
  prefix: "" | "+" | "-";
  amount: string;
  usd: string;
} {
  switch (bet.settlementStatus) {
    case "won":
    case "push":
      return {
        prefix: "+",
        amount: bet.claimAmount ?? bet.potentialWin,
        usd: bet.claimAmountUsd ?? bet.potentialWinUsd,
      };
    case "lost":
      return { prefix: "-", amount: bet.betAmount, usd: bet.betAmountUsd };
    case "void":
      return { prefix: "+", amount: bet.betAmount, usd: bet.betAmountUsd };
    case "cashback":
      return {
        prefix: "+",
        amount: bet.cashoutAmount ?? bet.betAmount,
        usd: bet.betAmountUsd,
      };
    // DD-140 TC — claiming 中间态：展示预期赔付金额（同 won/push），Claim 按钮由后端 enable_claim=false 控制
    case "claiming":
      return {
        prefix: "+",
        amount: bet.claimAmount ?? bet.potentialWin,
        usd: bet.claimAmountUsd ?? bet.potentialWinUsd,
      };
    default:
      return { prefix: "", amount: bet.betAmount, usd: bet.betAmountUsd };
  }
}
