import { describe, it, expect, vi } from "vitest";
import {
  selectionToOnchainOutcome,
  findOnchainMarket,
  submitOnchainBetFromSelection,
  OnchainMarketNotFoundError,
  UnsupportedSelectionError,
} from "./submit-onchain-from-selection";
import type { OnchainMarket } from "@/types/onchain-betting";
import type { BetSelection } from "@/types/betting";

const mkSelection = (overrides: Partial<BetSelection> = {}): BetSelection => ({
  id: "sel1",
  oddId: 1,
  fixtureId: 19683241,
  fixtureName: "A vs B",
  leagueName: "L",
  marketType: "1x2",
  marketDescription: "Fulltime",
  selection: "Home",
  displayLabel: "A",
  odds: "1.85",
  ...overrides,
});

const market1X2: OnchainMarket = {
  fixture_id: 19683241,
  match_id: "0xf1bc",
  market_id: "0x0203",
  market_type: 0,
  line: 0,
  base_odds: [22900, 33600, 31700],
  status: "OPENED",
  quote_version: 1,
};

const marketAsianHandicap: OnchainMarket = {
  fixture_id: 19683241,
  match_id: "0xf1bc",
  market_id: "0x0204",
  market_type: 1,
  line: 2, // lineID 2 → "-1.5"
  line_value: "-1.5",
  base_odds: [19000, 20500],
  status: "OPENED",
  quote_version: 1,
};

const marketTotal: OnchainMarket = {
  fixture_id: 19683241,
  match_id: "0xf1bc",
  market_id: "0x0205",
  market_type: 2,
  line: 1, // lineID 1 → "2.5"
  line_value: "2.5",
  base_odds: [18500, 21000],
  status: "OPENED",
  quote_version: 1,
};

// ============================================================
// selectionToOnchainOutcome
// ============================================================

describe("selectionToOnchainOutcome", () => {
  it("maps 1X2: Home→0 / Draw→1 / Away→2", () => {
    expect(selectionToOnchainOutcome(mkSelection({ selection: "Home" }))).toBe(0);
    expect(selectionToOnchainOutcome(mkSelection({ selection: "Draw" }))).toBe(1);
    expect(selectionToOnchainOutcome(mkSelection({ selection: "Away" }))).toBe(2);
  });

  it("maps asian_handicap: Home→0 / Away→1", () => {
    expect(
      selectionToOnchainOutcome(mkSelection({ marketType: "asian_handicap", selection: "Home" }))
    ).toBe(0);
    expect(
      selectionToOnchainOutcome(mkSelection({ marketType: "asian_handicap", selection: "Away" }))
    ).toBe(1);
  });

  it("maps asian_total: Over→0 / Under→1", () => {
    expect(
      selectionToOnchainOutcome(mkSelection({ marketType: "asian_total", selection: "Over" }))
    ).toBe(0);
    expect(
      selectionToOnchainOutcome(mkSelection({ marketType: "asian_total", selection: "Under" }))
    ).toBe(1);
  });

  it("throws UnsupportedSelectionError for unknown selection text", () => {
    expect(() => selectionToOnchainOutcome(mkSelection({ selection: "WeirdValue" }))).toThrow(
      UnsupportedSelectionError
    );
  });

  it("throws UnsupportedSelectionError when 1X2 sees Over/Under", () => {
    expect(() =>
      selectionToOnchainOutcome(mkSelection({ marketType: "1x2", selection: "Over" }))
    ).toThrow(UnsupportedSelectionError);
  });
});

// ============================================================
// findOnchainMarket
// ============================================================

describe("findOnchainMarket", () => {
  const all = [market1X2, marketAsianHandicap, marketTotal];

  it("finds 1X2 market (line ignored)", () => {
    expect(findOnchainMarket(all, mkSelection({ marketType: "1x2" }))).toBe(market1X2);
  });

  it("finds asian_handicap by line_value match (DD-118 forward-compat)", () => {
    expect(
      findOnchainMarket(
        all,
        mkSelection({ marketType: "asian_handicap", handicap: "-1.5", selection: "Home" })
      )
    ).toBe(marketAsianHandicap);
  });

  it("finds asian_total by line_value match (DD-118 forward-compat)", () => {
    expect(
      findOnchainMarket(
        all,
        mkSelection({ marketType: "asian_total", total: "2.5", selection: "Over" })
      )
    ).toBe(marketTotal);
  });

  it("throws OnchainMarketNotFoundError when no matching market exists", () => {
    expect(() =>
      findOnchainMarket([market1X2], mkSelection({ marketType: "asian_total", total: "3.5" }))
    ).toThrow(OnchainMarketNotFoundError);
  });

  it("throws OnchainMarketNotFoundError when 1X2 not in list", () => {
    expect(() => findOnchainMarket([marketAsianHandicap], mkSelection())).toThrow(
      OnchainMarketNotFoundError
    );
  });

  // DD-128: 主客视角对齐 —— 后端 line_value 恒主队视角，客队选择需取反匹配
  // 实测 fixture 19609127 南非（客队）+1：后端市场 line_value "-1"，前端客队盘口 "1"
  const marketAhMinusOne: OnchainMarket = {
    ...marketAsianHandicap,
    market_id: "0xahm1",
    line: 1,
    line_value: "-1",
  };

  it("DD-128: AH 客队选择 +1 匹配主队视角 line_value -1 市场", () => {
    expect(
      findOnchainMarket(
        [market1X2, marketAhMinusOne],
        mkSelection({ marketType: "asian_handicap", handicap: "1", selection: "Away" })
      )
    ).toBe(marketAhMinusOne);
  });

  it("DD-128: AH 主队选择 -1 仍匹配同一 line_value -1 市场（不取反）", () => {
    expect(
      findOnchainMarket(
        [marketAhMinusOne],
        mkSelection({ marketType: "asian_handicap", handicap: "-1", selection: "Home" })
      )
    ).toBe(marketAhMinusOne);
  });

  it("DD-128: AH 客队 -0.25（客队视角）匹配 line_value +0.25 市场（取反 + 数值口径）", () => {
    const marketAhPlusQuarter: OnchainMarket = {
      ...marketAsianHandicap,
      market_id: "0xq",
      line: 7,
      line_value: "+0.25",
    };
    expect(
      findOnchainMarket(
        [marketAhPlusQuarter],
        mkSelection({ marketType: "asian_handicap", handicap: "-0.25", selection: "Away" })
      )
    ).toBe(marketAhPlusQuarter);
  });

  it("DD-128: 数值口径容差 —— 主队 +0.5 写成 '0.5'（缺正号）仍匹配 line_value '+0.5'", () => {
    const marketAhHalf: OnchainMarket = {
      ...marketAsianHandicap,
      market_id: "0xh",
      line: 8,
      line_value: "+0.5",
    };
    expect(
      findOnchainMarket(
        [marketAhHalf],
        mkSelection({ marketType: "asian_handicap", handicap: "0.5", selection: "Home" })
      )
    ).toBe(marketAhHalf);
  });

  // DD-118 defensive: 后端未发版前 line_value 缺失 → AH/Total 找不到 market 显式抛错
  // （submit 路径宁可显式失败也不静默错下注；1X2 依然正常）
  it("throws when AH/Total market has no line_value (backend not yet upgraded)", () => {
    const legacyAH: OnchainMarket = {
      ...marketAsianHandicap,
      // 删除 line_value 模拟旧 API 响应
      line_value: undefined,
    };
    expect(() =>
      findOnchainMarket(
        [legacyAH],
        mkSelection({ marketType: "asian_handicap", handicap: "-1.5", selection: "Home" })
      )
    ).toThrow(OnchainMarketNotFoundError);
  });

  it("1X2 still matches by market_type only (line_value irrelevant)", () => {
    // 1X2 没有 line 概念，无论 line_value 是否存在都能匹配
    expect(findOnchainMarket([market1X2], mkSelection({ marketType: "1x2" }))).toBe(market1X2);
  });
});

// ============================================================
// submitOnchainBetFromSelection — integration
// ============================================================

describe("submitOnchainBetFromSelection", () => {
  it("fetches markets, maps outcome, then delegates to submitOnchainBet", async () => {
    const getOnchainMarkets = vi.fn(async () => ({
      fixture_id: 19683241,
      markets: [market1X2, marketAsianHandicap, marketTotal],
    }));
    const submit = vi.fn(async () => ({
      approveTxHash: "0xAAA" as const,
      betTxHash: "0xBBB" as const,
      orderId: 2,
    }));

    const result = await submitOnchainBetFromSelection(
      {
        selection: mkSelection({ selection: "Away" }),
        stakeOdd: "100",
        seq: "abc",
      },
      { getOnchainMarkets, submitOnchainBet: submit }
    );

    expect(getOnchainMarkets).toHaveBeenCalledWith(19683241);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureId: 19683241,
        matchId: "0xf1bc",
        marketType: 0,
        outcome: 2, // Away
        line: 0,
        stakeOdd: "100",
        decimalOdds: "1.85",
        seq: "abc",
      })
    );
    expect(result).toEqual({ approveTxHash: "0xAAA", betTxHash: "0xBBB", orderId: 2 });
  });

  it("DD-117: lockedOddsBps 提供且非降级 → minOddsBpsOverride 用 lockedOdds × (1-slippage)", async () => {
    const getOnchainMarkets = vi.fn(async () => ({
      fixture_id: 19683241,
      markets: [market1X2],
    }));
    const submit = vi.fn(async () => ({
      approveTxHash: "0xAAA" as const,
      betTxHash: "0xBBB" as const,
      orderId: 2,
    }));

    await submitOnchainBetFromSelection(
      {
        selection: mkSelection({ selection: "Away" }),
        stakeOdd: "100",
        seq: "abc",
        lockedOddsBps: "30000",
        degraded: false,
        slippageBps: 100,
      },
      { getOnchainMarkets, submitOnchainBet: submit }
    );

    // (30000 × 9900) / 10000 = 29700
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ minOddsBpsOverride: "29700" }));
  });

  it("DD-117: lockedOddsBps 缺省 → minOddsBpsOverride 走 base_odds × (1-slippage)", async () => {
    const getOnchainMarkets = vi.fn(async () => ({
      fixture_id: 19683241,
      markets: [market1X2],
    }));
    const submit = vi.fn(async () => ({
      approveTxHash: "0xA" as const,
      betTxHash: "0xB" as const,
      orderId: 2,
    }));

    await submitOnchainBetFromSelection(
      {
        selection: mkSelection({ selection: "Away" }),
        stakeOdd: "100",
        seq: "abc",
      },
      { getOnchainMarkets, submitOnchainBet: submit }
    );

    // base_odds[2]=31700; 默认 slippage 100 (1%) → (31700×9900)/10000 = 31383
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ minOddsBpsOverride: "31383" }));
  });

  it("DD-117: degraded=true → 即使 lockedOddsBps 非空也走 base_odds 兜底", async () => {
    const getOnchainMarkets = vi.fn(async () => ({
      fixture_id: 19683241,
      markets: [market1X2],
    }));
    const submit = vi.fn(async () => ({
      approveTxHash: "0xA" as const,
      betTxHash: "0xB" as const,
      orderId: 2,
    }));

    await submitOnchainBetFromSelection(
      {
        selection: mkSelection({ selection: "Away" }),
        stakeOdd: "100",
        seq: "abc",
        lockedOddsBps: "30000",
        degraded: true,
        slippageBps: 100,
      },
      { getOnchainMarkets, submitOnchainBet: submit }
    );

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ minOddsBpsOverride: "31383" }));
  });

  // DD-118 端到端验证：AH selection 通过 line_value 找到 market → outcome 索引 → submit
  it("AH selection: line_value lookup → market_type=1, line=lineID, outcome by Home/Away", async () => {
    const getOnchainMarkets = vi.fn(async () => ({
      fixture_id: 19683241,
      markets: [market1X2, marketAsianHandicap, marketTotal],
    }));
    const submit = vi.fn(async () => ({
      approveTxHash: "0xAAA" as const,
      betTxHash: "0xBBB" as const,
      orderId: 2,
    }));

    await submitOnchainBetFromSelection(
      {
        selection: mkSelection({
          marketType: "asian_handicap",
          handicap: "-1.5",
          selection: "Home",
        }),
        stakeOdd: "100",
        seq: "abc-ah",
      },
      { getOnchainMarkets, submitOnchainBet: submit }
    );

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        marketType: 1, // AH
        outcome: 0, // Home
        line: marketAsianHandicap.line, // 合约 uint8 lineID — 直接来自后端，不是 SportMonks 字符串
        matchId: "0xf1bc",
      })
    );
  });

  it("Total selection: line_value lookup → market_type=2, line=lineID, outcome by Over/Under", async () => {
    const getOnchainMarkets = vi.fn(async () => ({
      fixture_id: 19683241,
      markets: [market1X2, marketAsianHandicap, marketTotal],
    }));
    const submit = vi.fn(async () => ({
      approveTxHash: "0xAAA" as const,
      betTxHash: "0xBBB" as const,
      orderId: 2,
    }));

    await submitOnchainBetFromSelection(
      {
        selection: mkSelection({
          marketType: "asian_total",
          total: "2.5",
          selection: "Under",
        }),
        stakeOdd: "50",
        seq: "abc-tot",
      },
      { getOnchainMarkets, submitOnchainBet: submit }
    );

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        marketType: 2, // Total
        outcome: 1, // Under
        line: marketTotal.line,
        matchId: "0xf1bc",
      })
    );
  });

  // DD-118 防御性回归：后端未发版前 AH selection 永远拿不到 market，submit 必须拒绝
  it("AH selection rejects when backend hasn't shipped line_value yet", async () => {
    const legacyAH = { ...marketAsianHandicap, line_value: undefined };
    const getOnchainMarkets = vi.fn(async () => ({
      fixture_id: 19683241,
      markets: [market1X2, legacyAH], // 只有 1X2 + 老格式 AH
    }));
    const submit = vi.fn();

    await expect(
      submitOnchainBetFromSelection(
        {
          selection: mkSelection({
            marketType: "asian_handicap",
            handicap: "-1.5",
            selection: "Home",
          }),
          stakeOdd: "100",
          seq: "abc-ah-legacy",
        },
        { getOnchainMarkets, submitOnchainBet: submit }
      )
    ).rejects.toBeInstanceOf(OnchainMarketNotFoundError);
    expect(submit).not.toHaveBeenCalled();
  });

  it("propagates OnchainMarketNotFoundError without calling submitOnchainBet", async () => {
    const getOnchainMarkets = vi.fn(async () => ({
      fixture_id: 19683241,
      markets: [], // empty
    }));
    const submit = vi.fn();

    await expect(
      submitOnchainBetFromSelection(
        {
          selection: mkSelection(),
          stakeOdd: "100",
          seq: "abc",
        },
        { getOnchainMarkets, submitOnchainBet: submit }
      )
    ).rejects.toBeInstanceOf(OnchainMarketNotFoundError);
    expect(submit).not.toHaveBeenCalled();
  });
});
