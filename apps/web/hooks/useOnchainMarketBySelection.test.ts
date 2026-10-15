import { describe, expect, it } from "vitest";

import {
  selectionLabelToOutcomeIndex,
  selectOnchainMarketForEntry,
} from "./useOnchainMarketBySelection";
import type { OnchainMarket } from "@/types/onchain-betting";

const MARKETS: OnchainMarket[] = [
  {
    fixture_id: 19683241,
    match_id: "0x" + "f".repeat(64),
    market_id: "0x" + "a".repeat(64),
    market_type: 0,
    line: 0,
    base_odds: [22900, 33600, 31700],
    status: "OPENED",
    quote_version: 1,
    // 1X2 没有 line 概念，line_value 通常缺省（后端可不返回）
  },
  {
    fixture_id: 19683241,
    match_id: "0x" + "f".repeat(64),
    market_id: "0x" + "b".repeat(64),
    market_type: 1, // AH
    line: 2, // lineID 2（合约白名单：0→-0.5, 1→-1, 2→-1.5）
    line_value: "-1.5",
    base_odds: [19000, 20000],
    status: "OPENED",
    quote_version: 1,
  },
  {
    fixture_id: 19683241,
    match_id: "0x" + "f".repeat(64),
    market_id: "0x" + "c".repeat(64),
    market_type: 2, // Total
    line: 1, // lineID 1（合约白名单：0→1.5, 1→2.5, 2→3.5）
    line_value: "2.5",
    base_odds: [18500, 19500],
    status: "OPENED",
    quote_version: 1,
  },
];

describe("selectionLabelToOutcomeIndex", () => {
  it("maps 1X2 labels to 0/1/2", () => {
    expect(selectionLabelToOutcomeIndex(0, "Home")).toBe(0);
    expect(selectionLabelToOutcomeIndex(0, "Draw")).toBe(1);
    expect(selectionLabelToOutcomeIndex(0, "Away")).toBe(2);
  });

  it("maps AH labels to 0/1 (no Draw)", () => {
    expect(selectionLabelToOutcomeIndex(1, "Home")).toBe(0);
    expect(selectionLabelToOutcomeIndex(1, "Away")).toBe(1);
    expect(selectionLabelToOutcomeIndex(1, "Draw")).toBeNull();
  });

  it("maps Total labels to 0/1", () => {
    expect(selectionLabelToOutcomeIndex(2, "Over")).toBe(0);
    expect(selectionLabelToOutcomeIndex(2, "Under")).toBe(1);
  });

  it("returns null for unsupported market_type", () => {
    expect(selectionLabelToOutcomeIndex(99, "Home")).toBeNull();
  });

  it("returns null for outcome not valid on the market", () => {
    expect(selectionLabelToOutcomeIndex(0, "Over")).toBeNull();
    expect(selectionLabelToOutcomeIndex(2, "Home")).toBeNull();
  });
});

describe("selectOnchainMarketForEntry", () => {
  it("finds 1X2 market and Home outcome", () => {
    const res = selectOnchainMarketForEntry({
      markets: MARKETS,
      sportmonksMarketId: 1,
      outcomeLabel: "Home",
    });
    expect(res.marketId).toBe(MARKETS[0].market_id);
    expect(res.outcomeIndex).toBe(0);
  });

  it("finds AH market by line + outcome", () => {
    const res = selectOnchainMarketForEntry({
      markets: MARKETS,
      sportmonksMarketId: 6,
      line: "-1.5",
      outcomeLabel: "Home",
    });
    expect(res.marketId).toBe(MARKETS[1].market_id);
    expect(res.outcomeIndex).toBe(0);
  });

  it("finds Total market by line + outcome", () => {
    const res = selectOnchainMarketForEntry({
      markets: MARKETS,
      sportmonksMarketId: 7,
      line: "2.5",
      outcomeLabel: "Under",
    });
    expect(res.marketId).toBe(MARKETS[2].market_id);
    expect(res.outcomeIndex).toBe(1);
  });

  it("returns null marketId when no AH line matches", () => {
    const res = selectOnchainMarketForEntry({
      markets: MARKETS,
      sportmonksMarketId: 6,
      line: "3.5",
      outcomeLabel: "Home",
    });
    expect(res.marketId).toBeNull();
  });

  it("returns null for unsupported sportmonks marketId", () => {
    const res = selectOnchainMarketForEntry({
      markets: MARKETS,
      sportmonksMarketId: 42,
      outcomeLabel: "Home",
    });
    expect(res.marketId).toBeNull();
    expect(res.outcomeIndex).toBeNull();
  });

  it("returns null when markets is empty/null", () => {
    expect(
      selectOnchainMarketForEntry({ markets: null, sportmonksMarketId: 1, outcomeLabel: "Home" })
    ).toEqual({ marketId: null, outcomeIndex: null });
    expect(
      selectOnchainMarketForEntry({ markets: [], sportmonksMarketId: 1, outcomeLabel: "Home" })
    ).toEqual({ marketId: null, outcomeIndex: null });
  });

  it("matches AH by line_value string regardless of lineID (forward-compat after backend ships)", () => {
    const market: OnchainMarket = {
      fixture_id: 1,
      match_id: "0x" + "f".repeat(64),
      market_id: "0x" + "d".repeat(64),
      market_type: 1,
      line: 0, // lineID 0
      line_value: "-0.5",
      base_odds: [18000, 22000],
      status: "OPENED",
      quote_version: 1,
    };
    const res = selectOnchainMarketForEntry({
      markets: [market],
      sportmonksMarketId: 6,
      line: "-0.5",
      outcomeLabel: "Away",
    });
    expect(res.marketId).toBe(market.market_id);
    expect(res.outcomeIndex).toBe(1);
  });

  // DD-118 defensive: 后端未发版前 line_value 缺失，AH/Total 必须优雅回退 null（不订阅）
  it("returns null for AH/Total when line_value is missing (backend not yet upgraded)", () => {
    const legacyMarket: OnchainMarket = {
      fixture_id: 1,
      match_id: "0x" + "f".repeat(64),
      market_id: "0x" + "e".repeat(64),
      market_type: 1,
      line: 2, // lineID only — line_value not yet shipped
      base_odds: [19000, 20000],
      status: "OPENED",
      quote_version: 1,
    };
    const res = selectOnchainMarketForEntry({
      markets: [legacyMarket],
      sportmonksMarketId: 6,
      line: "-1.5",
      outcomeLabel: "Home",
    });
    expect(res.marketId).toBeNull();
    expect(res.outcomeIndex).toBeNull();
  });

  // DD-118 真实 fixture 场景：合约白名单一次开 3 个 AH market（-0.5 / -1 / -1.5），
  // selector 必须从中精确挑出与 SportMonks line 对应的那个，不能误匹配兜底
  it("picks the correct AH market from multiple lines on the same fixture", () => {
    const ahLines: OnchainMarket[] = [
      {
        fixture_id: 1,
        match_id: "0x" + "f".repeat(64),
        market_id: "0x" + "1".repeat(64),
        market_type: 1,
        line: 0,
        line_value: "-0.5",
        base_odds: [18000, 22000],
        status: "OPENED",
        quote_version: 1,
      },
      {
        fixture_id: 1,
        match_id: "0x" + "f".repeat(64),
        market_id: "0x" + "2".repeat(64),
        market_type: 1,
        line: 1,
        line_value: "-1",
        base_odds: [19000, 21000],
        status: "OPENED",
        quote_version: 1,
      },
      {
        fixture_id: 1,
        match_id: "0x" + "f".repeat(64),
        market_id: "0x" + "3".repeat(64),
        market_type: 1,
        line: 2,
        line_value: "-1.5",
        base_odds: [21000, 19000],
        status: "OPENED",
        quote_version: 1,
      },
    ];

    expect(
      selectOnchainMarketForEntry({
        markets: ahLines,
        sportmonksMarketId: 6,
        line: "-1",
        outcomeLabel: "Home",
      }).marketId
    ).toBe(ahLines[1].market_id);

    expect(
      selectOnchainMarketForEntry({
        markets: ahLines,
        sportmonksMarketId: 6,
        line: "-1.5",
        outcomeLabel: "Away",
      }).marketId
    ).toBe(ahLines[2].market_id);

    // 无匹配 line（合约白名单外）—— 不应误退到第一条
    expect(
      selectOnchainMarketForEntry({
        markets: ahLines,
        sportmonksMarketId: 6,
        line: "-0.25",
        outcomeLabel: "Home",
      }).marketId
    ).toBeNull();
  });

  it("picks the correct Total market from multiple lines on the same fixture", () => {
    const totalLines: OnchainMarket[] = [1.5, 2.5, 3.5].map(
      (v, i): OnchainMarket => ({
        fixture_id: 1,
        match_id: "0x" + "f".repeat(64),
        market_id: ("0x" + "a".repeat(63) + i) as string,
        market_type: 2,
        line: i,
        line_value: String(v),
        base_odds: [18500, 19500],
        status: "OPENED",
        quote_version: 1,
      })
    );
    expect(
      selectOnchainMarketForEntry({
        markets: totalLines,
        sportmonksMarketId: 7,
        line: "2.5",
        outcomeLabel: "Over",
      }).marketId
    ).toBe(totalLines[1].market_id);

    expect(
      selectOnchainMarketForEntry({
        markets: totalLines,
        sportmonksMarketId: 7,
        line: "3.5",
        outcomeLabel: "Under",
      }).marketId
    ).toBe(totalLines[2].market_id);
  });

  // 边界：后端如果意外返回 line_value="" 应当视为"缺失"，不能让 sportmonksLine="" 偶然匹配
  it("treats empty-string line_value as missing (defensive)", () => {
    const market: OnchainMarket = {
      fixture_id: 1,
      match_id: "0x" + "f".repeat(64),
      market_id: "0x" + "9".repeat(64),
      market_type: 1,
      line: 0,
      line_value: "",
      base_odds: [18000, 22000],
      status: "OPENED",
      quote_version: 1,
    };
    expect(
      selectOnchainMarketForEntry({
        markets: [market],
        sportmonksMarketId: 6,
        line: "-0.5",
        outcomeLabel: "Home",
      }).marketId
    ).toBeNull();
  });

  it("trims line_value whitespace when matching", () => {
    const market: OnchainMarket = {
      fixture_id: 1,
      match_id: "0x" + "f".repeat(64),
      market_id: "0x" + "f".repeat(64),
      market_type: 2,
      line: 1,
      line_value: "  2.5  ",
      base_odds: [18500, 19500],
      status: "OPENED",
      quote_version: 1,
    };
    const res = selectOnchainMarketForEntry({
      markets: [market],
      sportmonksMarketId: 7,
      line: "2.5",
      outcomeLabel: "Over",
    });
    expect(res.marketId).toBe(market.market_id);
  });
});
