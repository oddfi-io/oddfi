import { describe, it, expect, vi } from "vitest";
import { HTTPError } from "ky";
import {
  calcCashoutEstimate,
  fetchCashoutQuote,
  submitOnchainCashout,
  classifyCashoutError,
  CashoutQuoteUnavailableError,
  OnchainCashoutRevertedError,
  CASHOUT_CONTRACT_MIN_ODD,
} from "./onchain-cashout";
import type { OnchainMarket, OnchainMarketRes } from "@/types/onchain-betting";

// ─── calcCashoutEstimate ─────────────────────────────────────────────────────

describe("calcCashoutEstimate", () => {
  const HOUR = 3_600_000;
  const NOW = 1_780_000_000_000;

  const base = {
    acceptedAmountWei: "100000000000000000000", // 100 ODD
    lockedOdds: "25000", // 2.5
    currentOdds: "50000", // 5.0
    matchTimeMs: NOW + 2 * HOUR, // 距开赛 2h → feeBps 1000
    nowMs: NOW,
  };

  it("applies contract formula with 10% fee when >30min before kickoff", () => {
    // remaining=100, theoretical = 100×25000/50000 = 50 ODD, fee 10% → 45 ODD
    const r = calcCashoutEstimate(base);
    expect(r.feeBps).toBe(1000);
    expect(r.estimateOdd).toBe("45");
    expect(r.belowContractMin).toBe(false);
  });

  it("applies 20% fee within 30min of kickoff (boundary: exactly 30min is NOT >30min)", () => {
    const r = calcCashoutEstimate({ ...base, matchTimeMs: NOW + 30 * 60 * 1000 });
    expect(r.feeBps).toBe(2000);
    expect(r.estimateOdd).toBe("40"); // 50 × 0.8
  });

  it("applies 20% fee after kickoff (in-play)", () => {
    const r = calcCashoutEstimate({ ...base, matchTimeMs: NOW - HOUR });
    expect(r.feeBps).toBe(2000);
  });

  it("flags belowContractMin when estimate < 10 ODD", () => {
    // accepted 10 ODD → theoretical 5 → est 4.5 < 10
    const r = calcCashoutEstimate({ ...base, acceptedAmountWei: "10000000000000000000" });
    expect(r.belowContractMin).toBe(true);
    expect(CASHOUT_CONTRACT_MIN_ODD).toBe("10");
  });

  it("throws on degraded quote (currentOdds=0) instead of returning 0", () => {
    expect(() => calcCashoutEstimate({ ...base, currentOdds: "0" })).toThrow(/degraded/);
  });
});

// ─── fetchCashoutQuote ───────────────────────────────────────────────────────

describe("fetchCashoutQuote（纯方案 B）", () => {
  const NOW = 1_780_000_000_000;

  function buildMarket(overrides: Partial<OnchainMarket> = {}): OnchainMarket {
    return {
      fixture_id: 993021780890000,
      match_id: "0xmatch",
      market_id: "0xmarket",
      market_type: 0,
      line: 0,
      base_odds: [20000, 30000, 50000],
      quoted_odds: [25000, 30000, 50000], // outcome 0 → 2.5
      status: "OPENED",
      quote_version: 12,
      ...overrides,
    };
  }

  function res(markets: OnchainMarket[]): OnchainMarketRes {
    return { fixture_id: 993021780890000, markets };
  }

  // 100 ODD 本金 × locked 2.5 / current 5.0 × 0.9 = 45 ODD（开赛前 2h → fee 10%）
  const args = {
    fixtureId: 993021780890000,
    outcome: 2, // quoted_odds[2] = 50000 (5.0) 作 currentOdds
    marketTypeCode: 0,
    lineCode: 0,
    acceptedAmountWei: "100000000000000000000", // 100 ODD
    lockedOddsRaw: "25000", // 2.5
    betAmountOdd: "100",
    oddsDecimal: "2.5",
    matchTimeMs: NOW + 7_200_000,
    nowMs: NOW,
  };

  it("单次 getOnchainMarkets → 按 (market_type,line) 匹配 → quoted_odds[outcome] → estimate", async () => {
    const getOnchainMarkets = vi.fn(async () => res([buildMarket()]));
    const quote = await fetchCashoutQuote(args, { getOnchainMarkets });

    expect(getOnchainMarkets).toHaveBeenCalledWith(993021780890000);
    expect(quote.estimate.estimateOdd).toBe("45");
    expect(quote.quoteVersion).toBe("12");
  });

  it("falsy-zero：outcome=0 / market_type_code=0 / line_code=0 正常匹配取值", async () => {
    const getOnchainMarkets = vi.fn(async () => res([buildMarket()]));
    // outcome 0 → quoted_odds[0]=25000(2.5)；100×2.5/2.5×0.9 = 90 ODD
    const quote = await fetchCashoutQuote(
      { ...args, outcome: 0, marketTypeCode: 0, lineCode: 0 },
      { getOnchainMarkets }
    );
    expect(quote.estimate.estimateOdd).toBe("90");
  });

  it("多盘口时按 (market_type,line) 精确匹配，不取错盘口", async () => {
    const getOnchainMarkets = vi.fn(async () =>
      res([
        buildMarket({ market_type: 0, line: 0, quoted_odds: [11111], quote_version: 1 }),
        buildMarket({
          market_type: 1,
          line: 2,
          quoted_odds: [99999, 88888, 50000],
          quote_version: 7,
        }),
      ])
    );
    const quote = await fetchCashoutQuote(
      { ...args, marketTypeCode: 1, lineCode: 2, outcome: 2 },
      { getOnchainMarkets }
    );
    expect(quote.quoteVersion).toBe("7"); // 命中第二个盘口
  });

  it("缺 accepted_amount_wei/locked_odds_raw → 回退 stake×1e18 / odds×1e4（结果等价）", async () => {
    const getOnchainMarkets = vi.fn(async () => res([buildMarket()]));
    const quote = await fetchCashoutQuote(
      { ...args, acceptedAmountWei: undefined, lockedOddsRaw: undefined },
      { getOnchainMarkets }
    );
    expect(quote.estimate.estimateOdd).toBe("45"); // 100×1e18 / 2.5×1e4 与原始值同
  });

  it("throws market-not-found 当 markets 无匹配 (market_type,line)", async () => {
    const getOnchainMarkets = vi.fn(async () => res([buildMarket({ market_type: 2, line: 5 })]));
    await expect(fetchCashoutQuote(args, { getOnchainMarkets })).rejects.toMatchObject({
      name: "CashoutQuoteUnavailableError",
      reason: "market-not-found",
    });
  });

  it("throws market-not-found 当 markets 为空数组（盘口未返回）", async () => {
    const getOnchainMarkets = vi.fn(async () => res([]));
    await expect(fetchCashoutQuote(args, { getOnchainMarkets })).rejects.toMatchObject({
      reason: "market-not-found",
    });
  });

  it("throws no-live-quote 当 quoted_odds[outcome] 缺失或 <= 0（盘口锁定/降级）", async () => {
    const missing = vi.fn(async () => res([buildMarket({ quoted_odds: [25000, 30000] })])); // outcome 2 越界
    await expect(fetchCashoutQuote(args, { getOnchainMarkets: missing })).rejects.toMatchObject({
      reason: "no-live-quote",
    });
    const zero = vi.fn(async () => res([buildMarket({ quoted_odds: [25000, 30000, 0] })]));
    await expect(fetchCashoutQuote(args, { getOnchainMarkets: zero })).rejects.toBeInstanceOf(
      CashoutQuoteUnavailableError
    );
  });
});

// ─── submitOnchainCashout ────────────────────────────────────────────────────

describe("submitOnchainCashout", () => {
  const input = {
    betId: "0xdeadbeef",
    expectedQuoteVersion: "12",
    quotedAt: 1_780_000_000,
  };

  it("posts cash_out without idempotency_key (server derives from bet_id) and waits receipt", async () => {
    const onchainCashOut = vi.fn(async () => ({
      order_id: 7,
      tx_hash: "0xABC",
      action_id: 1,
      idempotency_key: "0xdeadbeef",
    }));
    const waitForReceipt = vi.fn(async () => ({
      status: "success" as const,
      blockNumber: 1n,
      txHash: "0xABC" as const,
    }));

    const res = await submitOnchainCashout(input, { onchainCashOut, waitForReceipt });

    expect(onchainCashOut).toHaveBeenCalledWith({
      bet_id: "0xdeadbeef",
      expected_quote_version: "12",
      quoted_at: 1_780_000_000,
      min_amount_out: "0", // 缺省不设滑点下限
    });
    expect(waitForReceipt).toHaveBeenCalledWith("0xABC");
    expect(res.txHash).toBe("0xABC");
  });

  it("passes through user minAmountOut", async () => {
    const onchainCashOut = vi.fn(async () => ({
      order_id: 7,
      tx_hash: "0xABC",
      action_id: 1,
      idempotency_key: "0xdeadbeef",
    }));
    const waitForReceipt = vi.fn(async () => ({
      status: "success" as const,
      blockNumber: 1n,
      txHash: "0xABC" as const,
    }));

    await submitOnchainCashout(
      { ...input, minAmountOut: "42.5" },
      { onchainCashOut, waitForReceipt }
    );
    expect(onchainCashOut).toHaveBeenCalledWith(
      expect.objectContaining({ min_amount_out: "42.5" })
    );
  });

  it("throws OnchainCashoutRevertedError when receipt reverted", async () => {
    const onchainCashOut = vi.fn(async () => ({
      order_id: 7,
      tx_hash: "0xBAD",
      action_id: 1,
      idempotency_key: "0xdeadbeef",
    }));
    const waitForReceipt = vi.fn(async () => ({
      status: "reverted" as const,
      blockNumber: 1n,
      txHash: "0xBAD" as const,
    }));

    await expect(
      submitOnchainCashout(input, { onchainCashOut, waitForReceipt })
    ).rejects.toBeInstanceOf(OnchainCashoutRevertedError);
  });
});

// ─── classifyCashoutError ────────────────────────────────────────────────────

/** 构造带 responseJSON 的 ky HTTPError 形状（lib/api.ts beforeError 挂载行为的镜像） */
function fakeHttpError(message: string, code: unknown = 500): HTTPError {
  const err = Object.create(HTTPError.prototype) as HTTPError & { responseJSON?: unknown };
  Object.defineProperty(err, "message", { value: "Request failed", writable: true });
  err.responseJSON = { code, message };
  return err;
}

describe("classifyCashoutError", () => {
  it.each(["QuoteExpired", "QuoteVersionMismatch", "SlippageExceeded"])(
    "classifies contract revert %s as quote-stale (retryable)",
    (marker) => {
      expect(classifyCashoutError(fakeHttpError(`execution reverted: ${marker}`))).toBe(
        "quote-stale"
      );
    }
  );

  it.each(["NotPending", "MarketNotOpen", "NotOwner"])(
    "classifies contract revert %s as not-cancellable (terminal)",
    (marker) => {
      expect(classifyCashoutError(fakeHttpError(marker))).toBe("not-cancellable");
    }
  );

  it("classifies backend index-lag message as not-ready", () => {
    expect(
      classifyCashoutError(
        fakeHttpError("onchain bet id not found or not ready for current user", 1001)
      )
    ).toBe("not-ready");
  });

  it("falls back to unknown for network errors / null", () => {
    expect(classifyCashoutError(new Error("fetch failed"))).toBe("unknown");
    expect(classifyCashoutError(null)).toBe("unknown");
  });

  it("matches plain Error message too (non-HTTPError path)", () => {
    expect(classifyCashoutError(new Error("QuoteExpired"))).toBe("quote-stale");
  });

  // ─── 后端 ENH-007 guard：relay 前同步拒绝（HTTP 400/503，无 tx 上链） ─────────

  it("classifies guard reject state=cashed_out as already-cashed-out（细分文案）", () => {
    expect(
      classifyCashoutError(fakeHttpError("onchain bet not pending: state=cashed_out", 400))
    ).toBe("already-cashed-out");
  });

  it.each(["pending", "refunded", "lost", "won_unclaimed", "won_claimed", "state_7"])(
    "classifies guard reject state=%s as not-cancellable（其余终态走泛用文案）",
    (state) => {
      expect(
        classifyCashoutError(fakeHttpError(`onchain bet not pending: state=${state}`, 400))
      ).toBe("not-cancellable");
    }
  );

  it("guard message（带空格 'not pending'）不被旧合约 marker 'notpending' 漏掉", () => {
    // 回归钉子：旧 marker 无空格，若误删新 marker 此用例必红
    expect(classifyCashoutError(new Error("onchain bet not pending: state=refunded"))).toBe(
      "not-cancellable"
    );
  });

  it("classifies 503 state unverified as state-unverified（可原地重试）", () => {
    expect(
      classifyCashoutError(fakeHttpError("onchain bet state unverified, try later", 503))
    ).toBe("state-unverified");
  });

  it("legacy contract revert NotPending（无空格）仍归 not-cancellable", () => {
    expect(classifyCashoutError(fakeHttpError("execution reverted: NotPending"))).toBe(
      "not-cancellable"
    );
  });
});
