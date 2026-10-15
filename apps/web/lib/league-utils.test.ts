import { describe, it, expect } from "vitest";
import { groupLeaguesByRegion } from "./league-utils";
import type { SportmonksLeague } from "@/types/api";

function makeLeague(id: number, countryId: number, name = `L${id}`): SportmonksLeague {
  return {
    id,
    country_id: countryId,
    name,
    image_path: "",
  } as SportmonksLeague;
}

describe("groupLeaguesByRegion", () => {
  it("groups leagues by country_id into known regions", () => {
    const leagues = [
      makeLeague(8, 462, "Premier League"),
      makeLeague(9, 462, "FA Cup"),
      makeLeague(564, 32, "La Liga"),
      makeLeague(82, 11, "Bundesliga"),
    ];

    const result = groupLeaguesByRegion(leagues);

    const england = result.find((g) => g.labelKey === "regionEngland");
    expect(england?.leagues.map((l) => l.id)).toEqual([8, 9]);
    expect(result.find((g) => g.labelKey === "regionSpain")?.leagues.map((l) => l.id)).toEqual([
      564,
    ]);
    expect(result.find((g) => g.labelKey === "regionGermany")?.leagues.map((l) => l.id)).toEqual([
      82,
    ]);
  });

  it("puts unmatched leagues into 'Other' group", () => {
    const leagues = [
      makeLeague(8, 462, "Premier League"),
      makeLeague(999, 77777, "Unknown League"),
    ];

    const result = groupLeaguesByRegion(leagues);
    const other = result.find((g) => g.labelKey === "other");
    expect(other?.leagues.map((l) => l.id)).toEqual([999]);
  });

  it("omits regions with no matching leagues", () => {
    const leagues = [makeLeague(8, 462, "Premier League")];
    const result = groupLeaguesByRegion(leagues);
    expect(result).toHaveLength(1);
    expect(result[0].labelKey).toBe("regionEngland");
  });

  it("omits 'Other' group when all leagues matched", () => {
    const leagues = [makeLeague(8, 462), makeLeague(564, 32)];
    const result = groupLeaguesByRegion(leagues);
    expect(result.find((g) => g.labelKey === "other")).toBeUndefined();
  });

  it("handles empty input", () => {
    expect(groupLeaguesByRegion([])).toEqual([]);
  });
});
