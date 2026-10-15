import { describe, it, expect } from "vitest";
import { groupLeaguesByRegion } from "@/lib/league-utils";
import type { SportmonksLeague } from "@/types/api";

const makeLeague = (id: number, countryId: number, name: string): SportmonksLeague => ({
  id,
  sport_id: 1,
  country_id: countryId,
  name,
  short_code: name.slice(0, 3).toUpperCase(),
  image_path: `https://cdn.sportmonks.com/images/soccer/leagues/${id}.png`,
  type: "league",
  sub_type: "domestic",
  category: 1,
  active: true,
  last_played_at: "2026-03-15",
  has_jerseys: false,
});

describe("groupLeaguesByRegion", () => {
  it("groups leagues into correct regions by country_id", () => {
    const leagues = [
      makeLeague(8, 462, "Premier League"),
      makeLeague(82, 11, "Bundesliga"),
      makeLeague(301, 17, "Ligue 1"),
      makeLeague(20, 20, "Liga Portugal"),
    ];

    const result = groupLeaguesByRegion(leagues);

    expect(result.map((r) => r.label)).toEqual(["England", "Germany", "France", "Portugal"]);
    expect(result[0].leagues[0].name).toBe("Premier League");
    expect(result[1].leagues[0].name).toBe("Bundesliga");
    expect(result[2].leagues[0].name).toBe("Ligue 1");
    expect(result[3].leagues[0].name).toBe("Liga Portugal");
  });

  it("puts unmatched leagues into Other group", () => {
    const leagues = [makeLeague(8, 462, "Premier League"), makeLeague(999, 9999, "Unknown League")];

    const result = groupLeaguesByRegion(leagues);

    expect(result.map((r) => r.label)).toEqual(["England", "Other"]);
    expect(result[1].leagues[0].name).toBe("Unknown League");
  });

  it("returns empty array for no leagues", () => {
    expect(groupLeaguesByRegion([])).toEqual([]);
  });

  it("does not duplicate leagues across regions", () => {
    const leagues = [makeLeague(8, 462, "Premier League"), makeLeague(9, 462, "Championship")];

    const result = groupLeaguesByRegion(leagues);

    // Both should be in England only
    expect(result.length).toBe(1);
    expect(result[0].label).toBe("England");
    expect(result[0].leagues.length).toBe(2);
  });

  it("correctly maps Netherlands (38) and Belgium (556)", () => {
    const leagues = [makeLeague(38, 38, "Eredivisie"), makeLeague(556, 556, "Pro League")];

    const result = groupLeaguesByRegion(leagues);

    expect(result.map((r) => r.label)).toEqual(["Netherlands", "Belgium"]);
  });
});
