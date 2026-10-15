import { describe, it, expect } from "vitest";
import { statusColor, statusI18nKey, claimButtonKey, payoutDisplay } from "./settle-display";
import type { PortfolioBet } from "@/types/portfolio";

function bet(overrides: Partial<PortfolioBet>): PortfolioBet {
  return {
    id: "bet-1",
    homeTeam: { name: "A", iconUrl: "" },
    awayTeam: { name: "B", iconUrl: "" },
    leagueTag: "",
    marketTag: "Fulltime Result",
    selectionTag: "Home",
    betAmount: "100",
    betAmountUsd: "10",
    potentialWin: "210",
    potentialWinUsd: "21",
    odds: "2.1",
    matchStatus: "finished",
    settlementStatus: "won",
    matchTime: "2026-05-26T00:00:00Z",
    ...overrides,
  };
}

describe("statusColor", () => {
  it.each([
    ["won", "text-fn-green"],
    ["push", "text-fn-green"],
    ["void", "text-fn-green"],
    ["lost", "text-fn-red"],
  ] as const)("%s → %s", (s, expected) => {
    expect(statusColor(s)).toBe(expected);
  });

  it.each(["pending", "live", "active", "cashback"] as const)("%s → text-primary 兜底", (s) => {
    expect(statusColor(s)).toBe("text-primary");
  });
});

describe("statusI18nKey", () => {
  it.each([
    ["won", "resultWon"],
    ["lost", "resultLost"],
    ["void", "resultVoid"],
    ["push", "resultPush"],
    ["cashback", "resultCashback"],
  ] as const)("%s → %s", (s, expected) => {
    expect(statusI18nKey(s)).toBe(expected);
  });

  it("未知态 → resultVoid 兜底", () => {
    expect(statusI18nKey("pending")).toBe("resultVoid");
  });
});

describe("claimButtonKey", () => {
  it("void → claimRefund（退款语义）", () => {
    expect(claimButtonKey("void")).toBe("claimRefund");
  });

  it.each(["won", "push", "lost", "cashback"] as const)("%s → claimWinnings", (s) => {
    expect(claimButtonKey(s)).toBe("claimWinnings");
  });
});

describe("payoutDisplay", () => {
  it("won → +claimAmount 优先，回退 potentialWin", () => {
    expect(
      payoutDisplay(bet({ settlementStatus: "won", claimAmount: "150", claimAmountUsd: "15" }))
    ).toEqual({ prefix: "+", amount: "150", usd: "15" });

    expect(payoutDisplay(bet({ settlementStatus: "won" }))).toEqual({
      prefix: "+",
      amount: "210",
      usd: "21",
    });
  });

  it("push → +claimAmount（push 走水按潜在收益派彩）", () => {
    expect(
      payoutDisplay(bet({ settlementStatus: "push", claimAmount: "100", claimAmountUsd: "10" }))
    ).toEqual({ prefix: "+", amount: "100", usd: "10" });
  });

  it("lost → -stake（亏损本金）", () => {
    expect(payoutDisplay(bet({ settlementStatus: "lost" }))).toEqual({
      prefix: "-",
      amount: "100",
      usd: "10",
    });
  });

  it("void → +stake（退款回本）", () => {
    expect(payoutDisplay(bet({ settlementStatus: "void" }))).toEqual({
      prefix: "+",
      amount: "100",
      usd: "10",
    });
  });

  it("cashback → +cashoutAmount 优先回退 stake", () => {
    expect(payoutDisplay(bet({ settlementStatus: "cashback", cashoutAmount: "80" }))).toEqual({
      prefix: "+",
      amount: "80",
      usd: "10",
    });

    expect(payoutDisplay(bet({ settlementStatus: "cashback" }))).toEqual({
      prefix: "+",
      amount: "100",
      usd: "10",
    });
  });

  it("未结算态 → 空 prefix + stake", () => {
    expect(payoutDisplay(bet({ settlementStatus: "pending" }))).toEqual({
      prefix: "",
      amount: "100",
      usd: "10",
    });
  });
});
