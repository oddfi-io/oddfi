import { describe, expect, it } from "vitest";

import { BRACKET_GROUPS, BRACKET_MATCHES, BRACKET_TEAMS, MOCK_BRACKET } from "./mock-data";
import type { RoundKey } from "./types";

describe("MOCK_BRACKET 2026 FIFA World Cup 数据契约", () => {
  it("48 队不重复", () => {
    expect(BRACKET_TEAMS).toHaveLength(48);
    const ids = new Set(BRACKET_TEAMS.map((t) => t.id));
    expect(ids.size).toBe(48);
  });

  it("12 组 × 4 队 = 48", () => {
    expect(BRACKET_GROUPS).toHaveLength(12);
    BRACKET_GROUPS.forEach((g) => expect(g.teams).toHaveLength(4));
    const teamCount = BRACKET_GROUPS.flatMap((g) => g.teams).length;
    expect(teamCount).toBe(48);
  });

  it("分组键覆盖 A-L 且不重复", () => {
    const keys = BRACKET_GROUPS.map((g) => g.groupKey);
    expect(keys).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]);
  });

  it("每队恰好属于一个分组", () => {
    const seen = new Set<string>();
    BRACKET_GROUPS.flatMap((g) => g.teams).forEach((t) => {
      expect(seen.has(t.id)).toBe(false);
      seen.add(t.id);
    });
    expect(seen.size).toBe(48);
  });

  it("KO 阶段 32 场比赛分布正确", () => {
    const counts: Record<RoundKey, number> = {
      r32: 0,
      r16: 0,
      qf: 0,
      sf: 0,
      final: 0,
      bronze: 0,
    };
    BRACKET_MATCHES.forEach((m) => {
      counts[m.round] += 1;
    });
    expect(counts).toEqual({ r32: 16, r16: 8, qf: 4, sf: 2, final: 1, bronze: 1 });
    expect(BRACKET_MATCHES).toHaveLength(32);
  });

  it("R32 cell 必须携带 groupKey 用于 hover 弹层", () => {
    const r32 = BRACKET_MATCHES.filter((m) => m.round === "r32");
    r32.forEach((m) => expect(m.groupKey).toBeDefined());
  });

  it("MOCK_BRACKET.teams 字典覆盖所有 48 队", () => {
    expect(Object.keys(MOCK_BRACKET.teams)).toHaveLength(48);
    BRACKET_TEAMS.forEach((t) => {
      expect(MOCK_BRACKET.teams[t.id]).toEqual(t);
    });
  });

  it("R32 比赛中引用的队 id 必须在 teams 字典中", () => {
    const r32 = BRACKET_MATCHES.filter((m) => m.round === "r32");
    r32.forEach((m) => {
      if (m.homeTeamId) expect(MOCK_BRACKET.teams[m.homeTeamId]).toBeDefined();
      if (m.awayTeamId) expect(MOCK_BRACKET.teams[m.awayTeamId]).toBeDefined();
    });
  });
});
