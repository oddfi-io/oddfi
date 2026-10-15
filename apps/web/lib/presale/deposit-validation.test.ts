import { describe, it, expect } from "vitest";
import { validateDeposit, type ValidateDepositParams } from "./deposit-validation";
import type { PresaleRound } from "./types";

const NOW = 1_700_000_000_000;

function round(over: Partial<PresaleRound> = {}): PresaleRound {
  return {
    id: "seed",
    name: "种子轮",
    roundType: "private",
    price: "0.03",
    supply: "1000000",
    sold: "0",
    raised: "0",
    targetRaiseUsd: "30000",
    tgeReleasePct: 10,
    linearReleaseDays: 90,
    referralRewardPct: "10",
    tgeDiscountPct: "70",
    startTs: NOW - 86400000,
    endTs: NOW + 86400000, // 1 天后结束（远离 2min 边界）
    status: "active",
    badge: null,
    minPerOrderUsd: null,
    maxPerWalletUsd: null,
    ...over,
  };
}

function errorOf(r: ReturnType<typeof validateDeposit>): string | null {
  return r.ok ? null : r.error;
}

function params(over: Partial<ValidateDepositParams> = {}): ValidateDepositParams {
  return {
    amount: "100",
    isAuthenticated: true,
    chainId: 56,
    expectedChainId: 56,
    round: round(),
    minSubscribeUsd: "0.01",
    nowMs: NOW,
    usdtBalance: "1000",
    ...over,
  };
}

describe("validateDeposit — 认购前端预校验", () => {
  it("全通过 → ok", () => {
    expect(validateDeposit(params())).toEqual({ ok: true });
  });

  it("未登录 → not_authenticated", () => {
    expect(validateDeposit(params({ isAuthenticated: false }))).toEqual({
      ok: false,
      error: "not_authenticated",
    });
  });

  it("错链 → wrong_chain", () => {
    expect(validateDeposit(params({ chainId: 97 })).ok).toBe(false);
    expect(validateDeposit(params({ chainId: undefined })).ok).toBe(false);
  });

  it("金额非法（0/空/NaN）→ invalid_amount", () => {
    expect(validateDeposit(params({ amount: "0" }))).toEqual({
      ok: false,
      error: "invalid_amount",
    });
    expect(validateDeposit(params({ amount: "" })).ok).toBe(false);
    expect(validateDeposit(params({ amount: "abc" })).ok).toBe(false);
  });

  it("轮次非 active → round_not_active", () => {
    expect(validateDeposit(params({ round: round({ status: "paused" }) })).ok).toBe(false);
    expect(validateDeposit(params({ round: round({ status: "upcoming" }) })).ok).toBe(false);
    expect(validateDeposit(params({ round: null })).ok).toBe(false);
  });

  it("低于最小认购 → below_min（边界：等于 min 通过）", () => {
    expect(validateDeposit(params({ amount: "0.005", minSubscribeUsd: "0.01" }))).toEqual({
      ok: false,
      error: "below_min",
    });
    expect(validateDeposit(params({ amount: "0.01", minSubscribeUsd: "0.01" })).ok).toBe(true);
  });

  it("超本轮剩余容量（ODD 维度 amount/price > supply-sold）→ exceeds_remaining", () => {
    // price 0.03, supply 1000, sold 0 → 剩余 1000 ODD；amount 60 → 2000 ODD 超
    const r = round({ price: "0.03", supply: "1000", sold: "0" });
    expect(errorOf(validateDeposit(params({ amount: "60", round: r })))).toBe("exceeds_remaining");
    // amount 30 → 1000 ODD 刚好不超
    expect(validateDeposit(params({ amount: "30", round: r })).ok).toBe(true);
  });

  it("距 endTs < 2min → near_boundary", () => {
    const r = round({ endTs: NOW + 60_000 }); // 1min 后切轮
    expect(errorOf(validateDeposit(params({ round: r })))).toBe("near_boundary");
  });

  it("USDT 余额不足 → insufficient_balance；未知余额(null)不阻断", () => {
    expect(errorOf(validateDeposit(params({ amount: "100", usdtBalance: "50" })))).toBe(
      "insufficient_balance"
    );
    expect(validateDeposit(params({ amount: "100", usdtBalance: null })).ok).toBe(true);
  });

  it("校验顺序：未登录优先于其它错误", () => {
    expect(
      errorOf(validateDeposit(params({ isAuthenticated: false, amount: "0", chainId: 97 })))
    ).toBe("not_authenticated");
  });
});
