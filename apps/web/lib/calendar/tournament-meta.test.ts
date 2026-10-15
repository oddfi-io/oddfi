import { describe, it, expect } from "vitest";
import { deriveTournamentMeta } from "./tournament-meta";
import wcFixtures from "./data/wc-fixtures.json";
import type { SportmonksFixture } from "@/types/api";

const fixtures = wcFixtures as unknown as SportmonksFixture[];

describe("deriveTournamentMeta — real WC 26 fixtures", () => {
  const meta = deriveTournamentMeta(fixtures);

  it("returns correct tournament_id and name", () => {
    expect(meta.tournament_id).toBe("fifa_wc_2026");
    expect(meta.name).toContain("FIFA World Cup");
  });

  it("tournament_window covers 2026-06-11 → 2026-07-19", () => {
    expect(meta.tournament_window.start).toBe("2026-06-11");
    expect(meta.tournament_window.end).toBe("2026-07-19");
  });

  it("derives 7 stages in correct order with correct match counts", () => {
    expect(meta.stages.map((s) => s.stage_id)).toEqual([
      "group",
      "r32",
      "r16",
      "qf",
      "sf",
      "third",
      "final",
    ]);
    const counts = meta.stages.map((s) => s.match_count);
    expect(counts).toEqual([72, 16, 8, 4, 2, 1, 1]);
  });

  it("derives 35 match days", () => {
    expect(meta.dates).toHaveLength(35);
    expect(meta.dates[0].date_iso).toBe("2026-06-11");
    expect(meta.dates[meta.dates.length - 1].date_iso).toBe("2026-07-19");
  });

  it("each match day belongs to one stage", () => {
    for (const d of meta.dates) {
      expect(["group", "r32", "r16", "qf", "sf", "third", "final"]).toContain(d.stage_id);
    }
    // 6/11 应归 group, 7/19 应归 final
    expect(meta.dates.find((d) => d.date_iso === "2026-06-11")!.stage_id).toBe("group");
    expect(meta.dates.find((d) => d.date_iso === "2026-07-19")!.stage_id).toBe("final");
  });

  it("groups list has 12 entries A~L", () => {
    expect(meta.groups).toHaveLength(12);
    expect(meta.groups[0]).toBe("A");
    expect(meta.groups[11]).toBe("L");
  });

  it("excludes rest days (7/8, 7/12, 7/13, 7/16, 7/17) — wait 7/12 has match per real data", () => {
    const isoSet = new Set(meta.dates.map((d) => d.date_iso));
    // 7/8 真实数据无比赛
    expect(isoSet.has("2026-07-08")).toBe(false);
    // 7/13 / 7/16 / 7/17 同样
    expect(isoSet.has("2026-07-13")).toBe(false);
    expect(isoSet.has("2026-07-16")).toBe(false);
    expect(isoSet.has("2026-07-17")).toBe(false);
    // 7/12 真实数据有比赛（PRD 漏标）
    expect(isoSet.has("2026-07-12")).toBe(true);
  });

  it("throws on empty fixtures", () => {
    expect(() => deriveTournamentMeta([])).toThrow();
  });
});
