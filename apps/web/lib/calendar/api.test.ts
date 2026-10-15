import { describe, it, expect } from "vitest";
import { getCalendarTournament, getCalendarMatches, getCalendarMatchById } from "./api";

describe("getCalendarTournament", () => {
  it("returns tournament with 7 stages and 35 match days", async () => {
    const t = await getCalendarTournament();
    expect(t.tournament_id).toBe("fifa_wc_2026");
    expect(t.stages).toHaveLength(7);
    expect(t.dates).toHaveLength(35);
    expect(t.groups).toHaveLength(12);
  });
});

describe("getCalendarMatches", () => {
  it("returns 104 fixtures", async () => {
    const list = await getCalendarMatches();
    expect(list).toHaveLength(104);
  });

  it("all fixtures have valid SportMonks shape", async () => {
    const list = await getCalendarMatches();
    for (const f of list) {
      expect(typeof f.id).toBe("number");
      expect(typeof f.starting_at_timestamp).toBe("number");
      expect(typeof f.has_odds).toBe("boolean");
      expect(Array.isArray(f.participants)).toBe(true);
      expect(Array.isArray(f.odds)).toBe(true);
    }
  });

  it("all fixtures are pre_open (演示阶段统一待开盘，后端真实赔率上线前不注入 mock odds)", async () => {
    const list = await getCalendarMatches();
    for (const f of list) {
      expect(f.has_odds).toBe(false);
    }
  });
});

describe("getCalendarMatchById", () => {
  it("finds Mexico vs South Africa by id", async () => {
    const f = await getCalendarMatchById(19609127);
    expect(f).toBeTruthy();
    expect(f!.name).toContain("Mexico");
    expect(f!.name).toContain("South Africa");
  });

  it("returns null for unknown id", async () => {
    const f = await getCalendarMatchById(999);
    expect(f).toBeNull();
  });
});
