import { describe, it, expect } from "vitest";
import { normalizeTeamName, resolveFixtureByText } from "./news-fixture-match";
import type { SportmonksFixture, SportmonksParticipant } from "@/types/api";

let seq = 0;
function team(name: string, shortCode: string, loc: "home" | "away"): SportmonksParticipant {
  return {
    id: ++seq,
    name,
    short_code: shortCode,
    image_path: "",
    country_id: 0,
    type: "national",
    meta: { location: loc, winner: null, position: loc === "home" ? 1 : 2 },
  };
}

function fx(home: [string, string], away: [string, string], ts: number): SportmonksFixture {
  const id = ++seq;
  return {
    id,
    league_id: 2,
    stage_id: 0,
    name: `${home[0]} vs ${away[0]}`,
    starting_at: "2026-06-12 19:00:00",
    starting_at_timestamp: ts,
    state_id: 1,
    has_odds: true,
    participants: [team(home[0], home[1], "home"), team(away[0], away[1], "away")],
    odds: [],
  };
}

describe("normalizeTeamName", () => {
  it("去重音 + 小写 + 折叠标点", () => {
    expect(normalizeTeamName("Atlético Madrid")).toBe("atletico madrid");
    expect(normalizeTeamName("Bayern  München!")).toBe("bayern munchen");
  });
});

describe("resolveFixtureByText — 经 short_code 桥接英文（dev 中文名场景）", () => {
  // dev 后端：participant.name 中文，short_code 稳定 → 映射到英文匹配
  const fixtures = [
    fx(["巴黎圣日耳曼", "PSG"], ["阿森纳", "ARS"], 1000), // id
    fx(["阿根廷", "ARG"], ["墨西哥", "MEX"], 2000),
    fx(["巴塞罗那", "BAR"], ["利物浦", "LIV"], 3000), // BAR → "FC Barcelona"
  ];

  it("Arsenal 转会新闻（中文 fixture）→ 命中 PSG vs Arsenal", () => {
    expect(resolveFixtureByText("Arsenal transfer target set for move.", fixtures)?.id).toBe(
      fixtures[0]!.id
    );
  });

  it("梅西新闻含 Argentina → 命中阿根廷赛事", () => {
    expect(
      resolveFixtureByText("Lionel Messi carried Argentina to win the World Cup.", fixtures)?.id
    ).toBe(fixtures[1]!.id);
  });

  it("俱乐部简称：'FC Barcelona' 映射 → 新闻 'Barcelona' 命中（去 FC 变体）", () => {
    expect(resolveFixtureByText("BREAKING: Barcelona have joined the race.", fixtures)?.id).toBe(
      fixtures[2]!.id
    );
  });

  it("提及分属不同赛事的两队 → 歧义 null", () => {
    expect(resolveFixtureByText("Arsenal and Argentina both in form", fixtures)).toBeNull();
  });

  it("无队名 → null", () => {
    expect(resolveFixtureByText("Ebola epidemic update in Congo", fixtures)).toBeNull();
  });
});

describe("resolveFixtureByText — prod 兜底（name 已英文 / short_code 缺失）", () => {
  it("short_code 不在映射表 → 回退 participant.name（prod 英文名）", () => {
    const fixtures = [fx(["Inter", "ZZZ"], ["Roma", "YYY"], 1000)];
    expect(resolveFixtureByText("Roma beat Inter last night", fixtures)?.id).toBe(fixtures[0]!.id);
  });

  it("词边界：'international' 不被 'inter' 误命中", () => {
    const fixtures = [fx(["Inter", "ZZZ"], ["Roma", "YYY"], 1000)];
    expect(resolveFixtureByText("an international friendly recap", fixtures)).toBeNull();
  });
});

describe("resolveFixtureByText — 简称/多词别名 + 误匹配防护", () => {
  it("USA 简称命中（United States 映射含 'usa'）", () => {
    const fixtures = [fx(["美国", "USA"], ["巴拉圭", "PRY"], 1000)];
    expect(resolveFixtureByText("USA beat Paraguay in a friendly", fixtures)?.id).toBe(
      fixtures[0]!.id
    );
  });

  it("South Korea 命中（Korea Republic 映射含 'south korea'）", () => {
    const fixtures = [fx(["韩国共和国", "KOR"], ["日本", "JPN"], 1000)];
    expect(resolveFixtureByText("South Korea name their World Cup squad", fixtures)?.id).toBe(
      fixtures[0]!.id
    );
  });

  it("PSG 简称命中（Paris Saint Germain 映射含 'psg'）", () => {
    const fixtures = [fx(["巴黎圣日耳曼", "PSG"], ["阿森纳", "ARS"], 1000)];
    expect(resolveFixtureByText("PSG complete signing of a new striker", fixtures)?.id).toBe(
      fixtures[0]!.id
    );
  });

  it("'Sporting CP' 不被普通词 'sporting' 误命中", () => {
    const fixtures = [fx(["里斯本竞技", "SCP"], ["阿森纳", "ARS"], 1000)];
    expect(resolveFixtureByText("What a great sporting weekend it was", fixtures)).toBeNull();
  });
});

describe("resolveFixtureByText — 边界", () => {
  it("空文本 → null", () => {
    expect(resolveFixtureByText("", [])).toBeNull();
    expect(resolveFixtureByText(undefined, [])).toBeNull();
  });

  it("同一队多场未来赛事 → 取最近一场（升序首个）", () => {
    const a = fx(["阿森纳", "ARS"], ["利物浦", "LIV"], 5000);
    const b = fx(["巴塞罗那", "BAR"], ["阿森纳", "ARS"], 9000);
    expect(resolveFixtureByText("Arsenal news today", [a, b])?.id).toBe(a.id);
  });
});
