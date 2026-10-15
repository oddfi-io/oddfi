import { describe, it, expect } from "vitest";
import {
  deriveRecommendedSelection,
  deriveSelectionForPick,
  sortPicksByConfidence,
  type AnalysisPick,
} from "./recommend-selection";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";

function odd(
  label: string,
  value: string,
  overrides: Partial<SportmonksOddsEntry> = {}
): SportmonksOddsEntry {
  return {
    id: Math.floor(Math.random() * 1e6),
    fixture_id: 100,
    market_id: 1,
    bookmaker_id: 1,
    label,
    value,
    name: null,
    market_description: "Fulltime Result",
    probability: "",
    total: null,
    handicap: null,
    sort_order: 0,
    winning: false,
    stopped: false,
    ...overrides,
  };
}

function makeFx(
  odds: SportmonksOddsEntry[],
  overrides: Partial<SportmonksFixture> = {}
): SportmonksFixture {
  return {
    id: 100,
    league_id: 8,
    stage_id: 0,
    name: "Arsenal vs Chelsea",
    starting_at: "2026-06-12 19:00:00",
    starting_at_timestamp: 1781622000,
    state_id: 1,
    has_odds: odds.length > 0,
    league: { id: 8, name: "Premier League" },
    participants: [
      {
        id: 1,
        name: "Arsenal",
        short_code: "ARS",
        image_path: "",
        country_id: 0,
        type: "domestic",
        meta: { location: "home", winner: null, position: 1 },
      },
      {
        id: 2,
        name: "Chelsea",
        short_code: "CHE",
        image_path: "",
        country_id: 0,
        type: "domestic",
        meta: { location: "away", winner: null, position: 2 },
      },
    ],
    odds,
    ...overrides,
  };
}

describe("deriveRecommendedSelection — 前端选热门（最低赔率）", () => {
  it("Home 最低 → 推荐主队，displayLabel 为主队名", () => {
    const fx = makeFx([odd("Home", "1.50"), odd("Draw", "4.00"), odd("Away", "6.00")]);
    const rec = deriveRecommendedSelection(fx);
    expect(rec?.sel.selection).toBe("Home");
    expect(rec?.sel.displayLabel).toBe("Arsenal");
    expect(rec?.sel.odds).toBe("1.50");
    expect(rec?.sel.marketType).toBe("1x2");
    expect(rec?.sel.id).toBe("100-1-Home");
  });

  it("Draw 最低 → 推荐平局，selection=Draw", () => {
    const fx = makeFx([odd("Home", "3.20"), odd("Draw", "1.80"), odd("Away", "4.50")]);
    const rec = deriveRecommendedSelection(fx);
    expect(rec?.sel.selection).toBe("Draw");
    expect(rec?.sel.displayLabel).toBe("Draw");
  });

  it("Away 最低 → 推荐客队", () => {
    const fx = makeFx([odd("Home", "5.00"), odd("Draw", "3.80"), odd("Away", "1.65")]);
    const rec = deriveRecommendedSelection(fx);
    expect(rec?.sel.selection).toBe("Away");
    expect(rec?.sel.displayLabel).toBe("Chelsea");
  });

  it("仅 Home+Away（缺 Draw 一路）→ 在可用两路里取最低", () => {
    const fx = makeFx([odd("Home", "2.30"), odd("Away", "1.70")]);
    const rec = deriveRecommendedSelection(fx);
    expect(rec?.sel.selection).toBe("Away");
  });

  it("最低那路是 '—' / NaN → 跳过，取下一个可下注的", () => {
    const fx = makeFx([odd("Home", "—"), odd("Draw", "1.20"), odd("Away", "2.00")]);
    const rec = deriveRecommendedSelection(fx);
    expect(rec?.sel.selection).toBe("Draw");
  });

  it("多 bookmaker → 复用 get1X2Entry 取每 label 首个，赔率与赛事卡一致", () => {
    // bookmaker 1 在前，get1X2Entry 取首个 → 推荐 = bookmaker1 的最低（Home 1.40）
    const fx = makeFx([
      odd("Home", "1.40", { bookmaker_id: 1 }),
      odd("Draw", "4.50", { bookmaker_id: 1 }),
      odd("Away", "7.00", { bookmaker_id: 1 }),
      odd("Home", "1.38", { bookmaker_id: 2 }),
      odd("Away", "7.20", { bookmaker_id: 2 }),
    ]);
    const rec = deriveRecommendedSelection(fx);
    expect(rec?.sel.selection).toBe("Home");
    expect(rec?.sel.odds).toBe("1.40"); // bookmaker1 首个，非 bookmaker2 的 1.38
  });
});

describe("deriveRecommendedSelection — 降级（不渲染卡）", () => {
  it("has_odds=false → null", () => {
    const fx = makeFx([], { has_odds: false });
    expect(deriveRecommendedSelection(fx)).toBeNull();
  });

  it("无 1X2 entry（只有让球 market_id=6）→ null", () => {
    const fx = makeFx([
      odd("Home", "1.90", { market_id: 6 }),
      odd("Away", "1.90", { market_id: 6 }),
    ]);
    expect(deriveRecommendedSelection(fx)).toBeNull();
  });

  it("三路赔率全 '—' → null", () => {
    const fx = makeFx([odd("Home", "—"), odd("Draw", "—"), odd("Away", "—")]);
    expect(deriveRecommendedSelection(fx)).toBeNull();
  });
});

describe("DD-136 deriveSelectionForPick — 三玩法派生", () => {
  const pick = (over: Partial<AnalysisPick>): AnalysisPick => ({
    market: "1x2",
    side: "Home",
    confidence: "high",
    ...over,
  });

  const fullOdds = [
    odd("Home", "1.50"),
    odd("Draw", "4.00"),
    odd("Away", "6.00"),
    odd("Home", "1.95", { market_id: 6, handicap: "-0.50", market_description: "Asian Handicap" }),
    odd("Away", "1.85", { market_id: 6, handicap: "0.50", market_description: "Asian Handicap" }),
    odd("Over", "1.90", { market_id: 7, total: "2.5", market_description: "Asian Total" }),
    odd("Under", "1.88", { market_id: 7, total: "2.5", market_description: "Asian Total" }),
  ];

  it("1x2 Away → 与赛事卡同 id / 同赔率", () => {
    const rec = deriveSelectionForPick(makeFx(fullOdds), pick({ market: "1x2", side: "Away" }));
    expect(rec?.sel.id).toBe("100-1-Away");
    expect(rec?.sel.odds).toBe("6.00");
    expect(rec?.sel.marketType).toBe("1x2");
  });

  it("asian_handicap Home → handicap 取所选方线值，id 用主线 lineValue（尾零归一）", () => {
    const rec = deriveSelectionForPick(
      makeFx(fullOdds),
      pick({ market: "asian_handicap", side: "Home" })
    );
    expect(rec?.sel.id).toBe("100-6-Home--0.5"); // "-0.50" 归一为 "-0.5"
    expect(rec?.sel.marketType).toBe("asian_handicap");
    expect(rec?.sel.selection).toBe("Home");
    expect(rec?.sel.handicap).toBe("-0.50");
    expect(rec?.sel.displayLabel).toBe("Arsenal");
  });

  it("REV-v1-A N-1: asian_handicap Away → id 用主线 lineValue（homeEntry 线 -0.5），与 MatchCard 去重一致", () => {
    // MatchCard.makeSelection：sel1/sel3 共用 entries.lineValue = homeEntry?.handicap ?? awayEntry?.handicap
    // 因此 Away 的 id 也用主队线 "-0.5"（归一后），与赛事卡点击产生的 id 完全一致 → betslip 天然去重
    const rec = deriveSelectionForPick(
      makeFx(fullOdds),
      pick({ market: "asian_handicap", side: "Away" })
    );
    expect(rec?.sel.id).toBe("100-6-Away--0.5");
    expect(rec?.sel.handicap).toBe("0.50"); // handicap 字段存用户所选方（客队）视角线
    expect(rec?.sel.odds).toBe("1.85");
  });

  it("asian_handicap：SportMonks '1'/'2' label 变体也能派生，selection 归一为 Home/Away", () => {
    const variantOdds = [
      odd("1", "1.92", { market_id: 6, handicap: "-1", market_description: "Asian Handicap" }),
      odd("2", "1.88", { market_id: 6, handicap: "1", market_description: "Asian Handicap" }),
    ];
    const rec = deriveSelectionForPick(
      makeFx(variantOdds),
      pick({ market: "asian_handicap", side: "Away" })
    );
    expect(rec?.sel.selection).toBe("Away"); // 归一后可被 BetSummary.selectionToLabel 正确映射
    expect(rec?.sel.handicap).toBe("1");
  });

  it("asian_total Over → total 线 + displayLabel 带线值", () => {
    const rec = deriveSelectionForPick(
      makeFx(fullOdds),
      pick({ market: "asian_total", side: "Over" })
    );
    expect(rec?.sel.id).toBe("100-7-Over-2.5");
    expect(rec?.sel.marketType).toBe("asian_total");
    expect(rec?.sel.total).toBe("2.5");
    expect(rec?.sel.displayLabel).toBe("Over 2.5");
    expect(rec?.sel.odds).toBe("1.90");
  });

  it("该玩法无盘口 → null（不阻塞其他玩法）", () => {
    const only1x2 = [odd("Home", "1.50"), odd("Draw", "4.00"), odd("Away", "6.00")];
    expect(
      deriveSelectionForPick(makeFx(only1x2), pick({ market: "asian_handicap", side: "Home" }))
    ).toBeNull();
    expect(
      deriveSelectionForPick(makeFx(only1x2), pick({ market: "asian_total", side: "Over" }))
    ).toBeNull();
  });

  it("side 非法（如 1x2/Over、total/Home）→ null", () => {
    const fx = makeFx(fullOdds);
    expect(deriveSelectionForPick(fx, pick({ market: "1x2", side: "Over" }))).toBeNull();
    expect(deriveSelectionForPick(fx, pick({ market: "asian_total", side: "Home" }))).toBeNull();
    expect(deriveSelectionForPick(fx, pick({ market: "asian_handicap", side: "Draw" }))).toBeNull();
  });

  it("has_odds=false → null", () => {
    expect(
      deriveSelectionForPick(makeFx([], { has_odds: false }), pick({ market: "1x2", side: "Home" }))
    ).toBeNull();
  });
});

describe("DD-136 sortPicksByConfidence", () => {
  it("high → mid → low 降序，不改原数组", () => {
    const picks: AnalysisPick[] = [
      { market: "asian_total", side: "Over", confidence: "low" },
      { market: "1x2", side: "Home", confidence: "high" },
      { market: "asian_handicap", side: "Away", confidence: "mid" },
    ];
    const sorted = sortPicksByConfidence(picks);
    expect(sorted.map((p) => p.confidence)).toEqual(["high", "mid", "low"]);
    expect(picks[0]!.confidence).toBe("low"); // 原数组不变
  });
});

describe("deriveRecommendedSelection — backendRec 前向兼容分支", () => {
  it("给定 backendRec.label=Away → 选 Away（即使 Home 赔率更低）", () => {
    const fx = makeFx([odd("Home", "1.50"), odd("Draw", "4.00"), odd("Away", "6.00")]);
    const rec = deriveRecommendedSelection(fx, { label: "Away" });
    expect(rec?.sel.selection).toBe("Away");
    expect(rec?.sel.odds).toBe("6.00");
  });

  it("backendRec 指定的 label 不可下注 → null", () => {
    const fx = makeFx([odd("Home", "1.50"), odd("Away", "6.00")]);
    expect(deriveRecommendedSelection(fx, { label: "Draw" })).toBeNull();
  });
});
