import { describe, it, expect } from "vitest";
import { makeSelectionId } from "./selection-id";

describe("makeSelectionId", () => {
  describe("1X2 (market_id=1)", () => {
    it("Home label 保持不变", () => {
      expect(makeSelectionId(123, 1, "Home")).toBe("123-1-Home");
    });

    it("Draw label 保持不变", () => {
      expect(makeSelectionId(123, 1, "Draw")).toBe("123-1-Draw");
    });

    it("Away label 保持不变", () => {
      expect(makeSelectionId(123, 1, "Away")).toBe("123-1-Away");
    });
  });

  describe("asian_handicap label 归一化 (market_id=6)", () => {
    it('label="1" 归一化为 "Home"', () => {
      expect(makeSelectionId(123, 6, "1", "-0.5")).toBe("123-6-Home--0.5");
    });

    it('label="2" 归一化为 "Away"', () => {
      expect(makeSelectionId(123, 6, "2", "-0.5")).toBe("123-6-Away--0.5");
    });

    it('market_id=7 不做 label 归一化，"1" 原样保留', () => {
      expect(makeSelectionId(123, 7, "1", "2.5")).toBe("123-7-1-2.5");
    });
  });

  describe("lineValue 归一化", () => {
    it('"0.50" → "0.5"', () => {
      expect(makeSelectionId(123, 6, "Home", "0.50")).toBe("123-6-Home-0.5");
    });

    it('"-0.50" → "-0.5"', () => {
      expect(makeSelectionId(123, 6, "Home", "-0.50")).toBe("123-6-Home--0.5");
    });

    it('"2.0" → "2"', () => {
      expect(makeSelectionId(123, 7, "Over", "2.0")).toBe("123-7-Over-2");
    });
  });

  describe("lineValue=null/undefined/空字符串", () => {
    it("lineValue=null 不带 line", () => {
      expect(makeSelectionId(123, 1, "Home", null)).toBe("123-1-Home");
    });

    it("lineValue=undefined 不带 line", () => {
      expect(makeSelectionId(123, 1, "Home", undefined)).toBe("123-1-Home");
    });

    it("lineValue 为空字符串 不带 line", () => {
      expect(makeSelectionId(123, 1, "Home", "")).toBe("123-1-Home");
    });
  });

  describe("market_id=7 不做 label 归一化", () => {
    it('"Over" 原样保留', () => {
      expect(makeSelectionId(123, 7, "Over", "2.5")).toBe("123-7-Over-2.5");
    });

    it('"Under" 原样保留', () => {
      expect(makeSelectionId(123, 7, "Under", "2.5")).toBe("123-7-Under-2.5");
    });
  });

  describe("交叉验证：MatchCard 路径 === OddsTable 路径", () => {
    it("handicap Home: label='1' vs label='Home'，lineValue='-0.5' 产生相同 ID", () => {
      const matchCardId = makeSelectionId(123, 6, "1", "-0.5");
      const oddsTableId = makeSelectionId(123, 6, "Home", "-0.5");
      expect(matchCardId).toBe(oddsTableId);
    });

    it("handicap Away: label='2' vs label='Away'，lineValue='-0.5' 产生相同 ID", () => {
      const matchCardId = makeSelectionId(123, 6, "2", "-0.5");
      const oddsTableId = makeSelectionId(123, 6, "Away", "-0.5");
      expect(matchCardId).toBe(oddsTableId);
    });

    it("total Over: lineValue='2.50' vs '2.5' 产生相同 ID", () => {
      const matchCardId = makeSelectionId(123, 7, "Over", "2.50");
      const oddsTableId = makeSelectionId(123, 7, "Over", "2.5");
      expect(matchCardId).toBe(oddsTableId);
    });
  });
});
