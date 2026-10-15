import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  assembleContext,
  buildMatchContext,
  ContextUnavailableError,
  fetchMatchData,
  resetInflightForTest,
  type MatchDataBundle,
} from "./match-context";
import type { MatchDetailOverviewWire, MatchDetailH2HWire } from "@/types/match-detail";
import type { SportmonksFixture, SportmonksOddsEntry } from "@/types/api";

function makeOverview(over: Partial<MatchDetailOverviewWire> = {}): MatchDetailOverviewWire {
  return {
    homeTeam: { participant_id: 1, name: "Arsenal", short_code: "ARS", image_path: "" },
    awayTeam: { participant_id: 2, name: "PSG", short_code: "PSG", image_path: "" },
    startingAt: "2026-05-30T19:00:00Z",
    starting_at_timestamp: 1748631600,
    venue: { name: "Wembley", city: "London", capacity: 90000, image_path: "", distance_km: null },
    seasonGoals: { home: 78, away: 92 },
    topScorers: { home: null, away: null },
    standingsRank: { home: 2, away: 1 },
    formPercentage: { home: 80, away: 75 },
    recentResults: { home: ["W", "W", "D", "W", "L"], away: ["W", "W", "W", "D", "W"] },
    periodGoals: [],
    winProbability: null,
    h2hSummary: { home_wins: 3, draws: 2, away_wins: 5 } as MatchDetailOverviewWire["h2hSummary"],
    referee: { name: "Daniele Orsato" },
    managers: { home: { name: "Arteta" }, away: { name: "Luis Enrique" } },
    ...over,
  };
}

function makeFixture(odds: SportmonksFixture["odds"] = []): SportmonksFixture {
  return {
    id: 12345,
    league_id: 2,
    stage_id: 0,
    name: "Arsenal vs PSG",
    starting_at: "2026-05-30T19:00:00Z",
    starting_at_timestamp: 1748631600,
    state_id: 1,
    has_odds: odds.length > 0,
    odds,
    participants: [],
  };
}

function makeH2H(sampleSize: number, over: Partial<MatchDetailH2HWire> = {}): MatchDetailH2HWire {
  return {
    h2h_sample_size: sampleSize,
    h2hAverageGoals: { scored: { home: 1.4, away: 1.1 }, conceded: { home: 0.9, away: 1.2 } },
    topScorers: { home: null, away: null },
    h2hForm: { home_percentage: 60, away_percentage: 40, home_matches: [], away_matches: [] },
    ...over,
  };
}

function makeOddsEntry(over: Partial<SportmonksOddsEntry>): SportmonksOddsEntry {
  return {
    id: 1,
    fixture_id: 12345,
    market_id: 1,
    bookmaker_id: 0,
    label: "Home",
    value: "2.10",
    name: null,
    market_description: "Fulltime Result",
    probability: null,
    total: null,
    handicap: null,
    sort_order: 0,
    winning: false,
    stopped: false,
    ...over,
  } as SportmonksOddsEntry;
}

function mockFetchReturning(responses: Record<string, unknown>): typeof fetch {
  return (async (url: string) => {
    const matched = Object.entries(responses).find(([path]) => String(url).includes(path));
    if (!matched) {
      return new Response(JSON.stringify({ code: 404, data: null }), { status: 404 });
    }
    return new Response(JSON.stringify(matched[1]), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("assembleContext", () => {
  const now = new Date("2026-05-19T03:42:00Z");

  it("includes team names + venue + referee when overview present", () => {
    const bundle: MatchDataBundle = {
      overview: makeOverview(),
      h2h: null,
      standings: null,
      lineups: null,
      fixture: null,
    };
    const out = assembleContext(bundle, "12345", now);
    expect(out).toContain("Arsenal vs PSG");
    expect(out).toContain("Wembley");
    expect(out).toContain("Daniele Orsato");
    expect(out).toContain('fixture_id="12345"');
    expect(out).toContain('fetched_at="2026-05-19 03:42"');
  });

  it("lists missing sources in section 2 when overview/h2h/lineups all null", () => {
    const bundle: MatchDataBundle = {
      overview: null,
      h2h: null,
      standings: null,
      lineups: null,
      fixture: null,
    };
    const out = assembleContext(bundle, "999", now);
    expect(out).toContain("⚠️ 关键缺失数据");
    expect(out).toContain("赛事基本信息");
    expect(out).toContain("历史交锋");
    expect(out).toContain("阵容 / 伤停");
    expect(out).toContain("实时盘口");
  });

  it("renders 1×2 moneyline from fixture odds when present", () => {
    const bundle: MatchDataBundle = {
      overview: makeOverview(),
      h2h: null,
      standings: null,
      lineups: null,
      fixture: makeFixture([
        {
          id: 1,
          fixture_id: 12345,
          market_id: 1,
          bookmaker_id: 0,
          label: "Home",
          value: "2.10",
          name: null,
          market_description: "Fulltime Result",
          probability: "47.6%",
          total: null,
          handicap: null,
          sort_order: 0,
          winning: false,
          stopped: false,
        },
        {
          id: 2,
          fixture_id: 12345,
          market_id: 1,
          bookmaker_id: 0,
          label: "Draw",
          value: "3.40",
          name: null,
          market_description: "Fulltime Result",
          probability: "29.4%",
          total: null,
          handicap: null,
          sort_order: 1,
          winning: false,
          stopped: false,
        },
        {
          id: 3,
          fixture_id: 12345,
          market_id: 1,
          bookmaker_id: 0,
          label: "Away",
          value: "3.20",
          name: null,
          market_description: "Fulltime Result",
          probability: "31.3%",
          total: null,
          handicap: null,
          sort_order: 2,
          winning: false,
          stopped: false,
        },
      ]),
    };
    const out = assembleContext(bundle, "12345", now);
    expect(out).toContain("主胜 2.10");
    expect(out).toContain("平 3.40");
    expect(out).toContain("客胜 3.20");
  });

  it("orders sections per DD-107 §3.1 (missing + injuries before odds)", () => {
    const bundle: MatchDataBundle = {
      overview: makeOverview(),
      h2h: null,
      standings: null,
      lineups: null,
      fixture: null,
    };
    const out = assembleContext(bundle, "12345", now);
    // 锚定 section heading（"# N. xxx"），避免命中 missing 列表内的字段名
    const idxMissing = out.indexOf("# 2. ⚠️ 关键缺失数据");
    const idxLineup = out.indexOf("# 3. 伤停 / 阵容");
    const idxOdds = out.indexOf("# 4. 实时盘口");
    expect(idxMissing).toBeGreaterThan(0);
    expect(idxLineup).toBeGreaterThan(idxMissing);
    expect(idxOdds).toBeGreaterThan(idxLineup);
  });

  // ─── DD-136 W1：小样本降级 ────────────────────────────────────────────────

  it("DD-136: small H2H sample (<5) marks 小样本 + 降权指引, no per-item win-rate recital", () => {
    const bundle: MatchDataBundle = {
      overview: makeOverview({ h2hSummary: { home_wins: 0, draws: 0, away_wins: 1 } }),
      h2h: makeH2H(1),
      standings: null,
      lineups: null,
      fixture: null,
    };
    const out = assembleContext(bundle, "12345", now);
    expect(out).toContain("小样本（仅 1 场，统计参考价值低）");
    expect(out).toContain("历史战绩：Arsenal 0 胜 · 平 0 · PSG 1 胜");
    expect(out).toContain("禁止逐项复述小样本胜率");
    // h2hForm 近况胜率归位到 #5 近期状态，不再混入 H2H 段
    const h2hIdx = out.indexOf("# 6. H2H 历史交锋");
    expect(out.indexOf("近况胜率：Arsenal 60% · PSG 40%")).toBeLessThan(h2hIdx);
  });

  it("REV-v1-B C1: 近况胜率双 0% → 守卫为未获取（禁止 0%/0% 流入 CONTEXT）", () => {
    const bundle: MatchDataBundle = {
      overview: makeOverview({ formPercentage: { home: 0, away: 0 } }),
      h2h: makeH2H(1, {
        h2hForm: { home_percentage: 0, away_percentage: 0, home_matches: [], away_matches: [] },
      }),
      standings: null,
      lineups: null,
      fixture: null,
    };
    const out = assembleContext(bundle, "12345", now);
    expect(out).not.toContain("0% · ");
    expect(out).toContain("近况胜率：未获取（无有效胜率样本");
    expect(out).toContain("禁止编造或复述 0%");
  });

  it("REV-v1-B N1: h2hForm 零值/缺失时回退 overview.formPercentage", () => {
    const bundle: MatchDataBundle = {
      overview: makeOverview({ formPercentage: { home: 72, away: 41 } }),
      h2h: makeH2H(1, {
        h2hForm: { home_percentage: 0, away_percentage: 0, home_matches: [], away_matches: [] },
      }),
      standings: null,
      lineups: null,
      fixture: null,
    };
    const out = assembleContext(bundle, "12345", now);
    expect(out).toContain("近况胜率：Arsenal 72% · PSG 41%");

    // h2h 整路失败 → 同样回退 overview
    const noH2h: MatchDataBundle = { ...bundle, h2h: null };
    expect(assembleContext(noH2h, "12345", now)).toContain("近况胜率：Arsenal 72% · PSG 41%");
  });

  it("DD-136: sufficient H2H sample (>=5) marks 充分 + average goals", () => {
    const bundle: MatchDataBundle = {
      overview: makeOverview(),
      h2h: makeH2H(8),
      standings: null,
      lineups: null,
      fixture: null,
    };
    const out = assembleContext(bundle, "12345", now);
    expect(out).toContain("样本充分性：充分（8 场）");
    expect(out).toContain("历史战绩：Arsenal 3 胜 · 平 2 · PSG 5 胜");
    expect(out).toContain("场均进球：Arsenal 1.4 · PSG 1.1");
    expect(out).not.toContain("小样本");
  });

  it("DD-136: renders AH + total main lines and implied probability when odds present", () => {
    const bundle: MatchDataBundle = {
      overview: makeOverview(),
      h2h: null,
      standings: null,
      lineups: null,
      fixture: makeFixture([
        makeOddsEntry({ id: 1, label: "Home", value: "2.10", probability: "47.6%" }),
        makeOddsEntry({ id: 2, label: "Draw", value: "3.40", probability: "29.4%", sort_order: 1 }),
        makeOddsEntry({ id: 3, label: "Away", value: "3.20", probability: "31.3%", sort_order: 2 }),
        makeOddsEntry({
          id: 4,
          market_id: 6,
          label: "Home",
          value: "1.95",
          handicap: "-0.5",
          market_description: "Asian Handicap",
        }),
        makeOddsEntry({
          id: 5,
          market_id: 6,
          label: "Away",
          value: "1.85",
          handicap: "0.5",
          market_description: "Asian Handicap",
        }),
        makeOddsEntry({
          id: 6,
          market_id: 7,
          label: "Over",
          value: "1.90",
          total: "2.5",
          market_description: "Asian Total",
        }),
        makeOddsEntry({
          id: 7,
          market_id: 7,
          label: "Under",
          value: "1.88",
          total: "2.5",
          market_description: "Asian Total",
        }),
      ]),
    };
    const out = assembleContext(bundle, "12345", now);
    expect(out).toContain("主胜 2.10（隐含 47.6%）");
    expect(out).toContain("让球（亚盘）：主队线 -0.5 · 主 1.95 / 客 1.85");
    expect(out).toContain("大小球：线 2.5 · 大 1.90 / 小 1.88");
  });

  it("treats zero-trap standingsRank (0/0) as 未获取", () => {
    const bundle: MatchDataBundle = {
      overview: makeOverview({ standingsRank: { home: 0, away: 0 } }),
      h2h: null,
      standings: {
        league_name: "UCL",
        season_name: "2025-26",
        standings: { overall: [], home: [], away: [] },
      },
      lineups: null,
      fixture: null,
    };
    const out = assembleContext(bundle, "12345", now);
    expect(out).toContain("# 7. 联赛积分\n- 未获取");
  });
});

describe("fetchMatchData", () => {
  it("returns partial bundle when 1 source fails", async () => {
    const fetchFn = mockFetchReturning({
      "match-detail/overview": { code: 0, data: makeOverview() },
      // h2h missing
      "match-detail/standings": {
        code: 0,
        data: {
          league_name: "UCL",
          season_name: "25-26",
          standings: { overall: [], home: [], away: [] },
        },
      },
      "match-detail/lineups": {
        code: 0,
        data: { lineups: null, available_at: "2026-05-30 18:00:00" },
      },
      "detail/fixture": { code: 200, data: [makeFixture()] },
    });
    const bundle = await fetchMatchData("12345", { fetchFn });
    expect(bundle.overview).not.toBeNull();
    expect(bundle.h2h).toBeNull();
    expect(bundle.fixture).not.toBeNull();
  });

  it("returns all-null bundle when overall timeout fires", async () => {
    const slowFetch = (async () => {
      await new Promise((r) => setTimeout(r, 200));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const bundle = await fetchMatchData("12345", {
      fetchFn: slowFetch,
      overallTimeoutMs: 20,
    });
    expect(bundle.overview).toBeNull();
    expect(bundle.fixture).toBeNull();
  });

  it("unwraps both code:0 and code:200 envelopes", async () => {
    const fetchFn = mockFetchReturning({
      "match-detail/overview": { code: 0, data: makeOverview() },
      "detail/fixture": { code: 200, data: [makeFixture()] },
    });
    const bundle = await fetchMatchData("12345", { fetchFn });
    expect(bundle.overview).not.toBeNull();
    expect(bundle.fixture).not.toBeNull();
  });

  it("treats code != 0/200 as failure (null)", async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ code: 500, data: null, msg: "server error" }), {
        status: 200,
      })) as unknown as typeof fetch;
    const bundle = await fetchMatchData("12345", { fetchFn });
    expect(bundle.overview).toBeNull();
  });
});

describe("buildMatchContext", () => {
  beforeEach(() => {
    resetInflightForTest();
    vi.restoreAllMocks();
  });

  it("throws ContextUnavailableError when all 5 sources fail", async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ code: 500, data: null }), {
        status: 200,
      })) as unknown as typeof fetch;
    await expect(buildMatchContext("12345", { fetchFn })).rejects.toBeInstanceOf(
      ContextUnavailableError
    );
  });

  it("returns CONTEXT string on partial success", async () => {
    const fetchFn = mockFetchReturning({
      "match-detail/overview": { code: 0, data: makeOverview() },
    });
    const out = await buildMatchContext("12345", { fetchFn });
    expect(out).toContain("Arsenal vs PSG");
    expect(out).toContain('type="match-analysis"');
  });

  it("inflight map: 2 concurrent calls share 1 fetch invocation per source", async () => {
    let callCount = 0;
    const fetchFn = (async () => {
      callCount += 1;
      await new Promise((r) => setTimeout(r, 30));
      return new Response(JSON.stringify({ code: 0, data: makeOverview() }), { status: 200 });
    }) as unknown as typeof fetch;
    const [a, b] = await Promise.all([
      buildMatchContext("12345", { fetchFn }),
      buildMatchContext("12345", { fetchFn }),
    ]);
    expect(a).toBe(b);
    expect(callCount).toBe(5);
  });

  it("bypassCoalescing=true skips inflight (per-call fetches)", async () => {
    let callCount = 0;
    const fetchFn = (async () => {
      callCount += 1;
      return new Response(JSON.stringify({ code: 0, data: makeOverview() }), { status: 200 });
    }) as unknown as typeof fetch;
    await Promise.all([
      buildMatchContext("12345", { fetchFn, bypassCoalescing: true }),
      buildMatchContext("12345", { fetchFn, bypassCoalescing: true }),
    ]);
    expect(callCount).toBe(10);
  });
});
