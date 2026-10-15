// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  toMatchOverviewDomain,
  toMatchH2HDomain,
  toMatchStandingsDomain,
  toMatchLineupsDomain,
  parseBackendDateTime,
} from "./match-detail-adapter";
import type {
  MatchDetailOverviewWire,
  MatchDetailH2HWire,
  MatchDetailStandingsWire,
  MatchDetailLineupsWire,
} from "@/types/match-detail";

// ─── Fixtures ─────────────────────────────────────────────────────────────

const makeTeam = (id: number) => ({
  participant_id: id,
  name: `Team ${id}`,
  short_code: `T${id}`,
  image_path: `/images/t${id}.png`,
});

const baseOverviewWire: MatchDetailOverviewWire = {
  homeTeam: makeTeam(1),
  awayTeam: makeTeam(2),
  startingAt: "2026-06-11T18:00:00Z",
  starting_at_timestamp: 1781136000,
  venue: { name: "Lusail", city: "Doha", capacity: 88966, image_path: "/v.jpg", distance_km: 12.5 },
  seasonGoals: { home: 35, away: 28 },
  topScorers: { home: null, away: null },
  standingsRank: { home: 3, away: 7 },
  formPercentage: { home: 72, away: 60 },
  recentResults: { home: ["W", "W", "D", "L", "W"], away: ["L", "D", "W", "W", "D"] },
  periodGoals: [{ period: 45, home_avg: 0.8, away_avg: 0.6 }],
  winProbability: { home: 52, draw: 28, away: 20 },
  h2hSummary: { home_wins: 5, draws: 3, away_wins: 2 },
  referee: { name: "Björn Kuipers" },
  managers: { home: { name: "Pep Guardiola" }, away: { name: "Jürgen Klopp" } },
};

// ─── parseBackendDateTime ──────────────────────────────────────────────────

describe("parseBackendDateTime", () => {
  it("parses YYYY-MM-DD HH:mm:ss as UTC", () => {
    const d = parseBackendDateTime("2026-05-18 14:00:00");
    // UTC: 2026-05-18T14:00:00Z
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4); // month is 0-indexed
    expect(d.getUTCDate()).toBe(18);
    expect(d.getUTCHours()).toBe(14);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });

  it("returns a valid Date object", () => {
    const d = parseBackendDateTime("2026-06-11 18:00:00");
    expect(d instanceof Date).toBe(true);
    expect(isNaN(d.getTime())).toBe(false);
  });
});

// ─── toMatchOverviewDomain ────────────────────────────────────────────────

describe("toMatchOverviewDomain", () => {
  it("maps basic fields correctly", () => {
    const domain = toMatchOverviewDomain(baseOverviewWire);
    expect(domain.homeTeam.participantId).toBe(1);
    expect(domain.homeTeam.name).toBe("Team 1");
    expect(domain.homeTeam.shortCode).toBe("T1");
    expect(domain.homeTeam.imagePath).toBe("/images/t1.png");
    expect(domain.awayTeam.participantId).toBe(2);
    expect(domain.kickoff.iso).toBe("2026-06-11T18:00:00Z");
    expect(domain.kickoff.timestamp).toBe(1781136000);
    expect(domain.venue.name).toBe("Lusail");
    expect(domain.venue.city).toBe("Doha");
    expect(domain.venue.capacity).toBe(88966);
    expect(domain.venue.distanceKm).toBe(12.5);
  });

  it("preserves non-zero seasonGoals", () => {
    const domain = toMatchOverviewDomain(baseOverviewWire);
    expect(domain.seasonGoals).toEqual({ home: 35, away: 28 });
  });

  it("converts seasonGoals {0,0} → {null,null} (zero-value trap, each side independent)", () => {
    const wire = { ...baseOverviewWire, seasonGoals: { home: 0, away: 0 } };
    const domain = toMatchOverviewDomain(wire);
    expect(domain.seasonGoals).toEqual({ home: null, away: null });
  });

  it("nullifies home seasonGoals independently when home is 0 but away is non-zero", () => {
    const wire = { ...baseOverviewWire, seasonGoals: { home: 0, away: 5 } };
    const domain = toMatchOverviewDomain(wire);
    expect(domain.seasonGoals).toEqual({ home: null, away: 5 });
  });

  it("nullifies away seasonGoals independently when away is 0 but home is non-zero", () => {
    const wire = { ...baseOverviewWire, seasonGoals: { home: 8, away: 0 } };
    const domain = toMatchOverviewDomain(wire);
    expect(domain.seasonGoals).toEqual({ home: 8, away: null });
  });

  it("preserves non-zero standingsRank", () => {
    const domain = toMatchOverviewDomain(baseOverviewWire);
    expect(domain.standingsRank).toEqual({ home: 3, away: 7 });
  });

  it("converts standingsRank {0,0} → {null,null} (zero-value trap, each side independent)", () => {
    const wire = { ...baseOverviewWire, standingsRank: { home: 0, away: 0 } };
    const domain = toMatchOverviewDomain(wire);
    expect(domain.standingsRank).toEqual({ home: null, away: null });
  });

  it("nullifies home standingsRank independently when home is 0 but away is non-zero", () => {
    const wire = { ...baseOverviewWire, standingsRank: { home: 0, away: 7 } };
    const domain = toMatchOverviewDomain(wire);
    expect(domain.standingsRank).toEqual({ home: null, away: 7 });
  });

  it("nullifies away standingsRank independently when away is 0 but home is non-zero", () => {
    const wire = { ...baseOverviewWire, standingsRank: { home: 3, away: 0 } };
    const domain = toMatchOverviewDomain(wire);
    expect(domain.standingsRank).toEqual({ home: 3, away: null });
  });

  it("passes through null winProbability", () => {
    const wire = { ...baseOverviewWire, winProbability: null };
    expect(toMatchOverviewDomain(wire).winProbability).toBeNull();
  });

  it("passes through null topScorers", () => {
    const domain = toMatchOverviewDomain(baseOverviewWire);
    expect(domain.topScorers.home).toBeNull();
    expect(domain.topScorers.away).toBeNull();
  });

  it("maps recentResults strings to MatchOutcomeDomain (uppercase passthrough)", () => {
    const domain = toMatchOverviewDomain(baseOverviewWire);
    expect(domain.recentResults.home).toEqual(["W", "W", "D", "L", "W"]);
    expect(domain.recentResults.away).toEqual(["L", "D", "W", "W", "D"]);
  });

  it("normalizes lowercase recentResults to uppercase", () => {
    const wire = {
      ...baseOverviewWire,
      recentResults: { home: ["w", "d", "l", "W", "D"], away: ["l", "w", "w", "d", "L"] },
    };
    const domain = toMatchOverviewDomain(wire);
    expect(domain.recentResults.home).toEqual(["W", "D", "L", "W", "D"]);
    expect(domain.recentResults.away).toEqual(["L", "W", "W", "D", "L"]);
  });

  it("maps periodGoals snake_case to camelCase", () => {
    const domain = toMatchOverviewDomain(baseOverviewWire);
    expect(domain.periodGoals).toEqual([{ period: 45, homeAvg: 0.8, awayAvg: 0.6 }]);
  });

  it("maps venue imagePath and distance_km correctly", () => {
    const wire = { ...baseOverviewWire, venue: { ...baseOverviewWire.venue, distance_km: null } };
    const domain = toMatchOverviewDomain(wire);
    expect(domain.venue.distanceKm).toBeNull();
  });
});

// ─── toMatchH2HDomain ─────────────────────────────────────────────────────

describe("toMatchH2HDomain", () => {
  const h2hWire: MatchDetailH2HWire = {
    h2h_sample_size: 10,
    topScorers: { home: null, away: null },
    h2hAverageGoals: { scored: { home: 1.8, away: 1.2 }, conceded: { home: 0.9, away: 1.1 } },
    h2hForm: {
      home_percentage: 65,
      away_percentage: 55,
      home_matches: [],
      away_matches: [],
    },
  };

  it("maps h2h_sample_size to h2hSampleSize", () => {
    const domain = toMatchH2HDomain(h2hWire);
    expect(domain.h2hSampleSize).toBe(10);
  });

  it("passes through h2hAverageGoals and h2hForm (h2hSummary is from overview, not H2H endpoint)", () => {
    const domain = toMatchH2HDomain(h2hWire);
    expect(domain.h2hAverageGoals).toEqual(h2hWire.h2hAverageGoals);
    expect(domain.h2hForm).toEqual(h2hWire.h2hForm);
  });

  it("passes through null topScorers", () => {
    const domain = toMatchH2HDomain(h2hWire);
    expect(domain.topScorers.home).toBeNull();
    expect(domain.topScorers.away).toBeNull();
  });
});

// ─── toMatchStandingsDomain ───────────────────────────────────────────────

describe("toMatchStandingsDomain", () => {
  const makeRow = (overrides?: Partial<MatchDetailStandingsWire["standings"]["overall"][0]>) => ({
    participant_id: 1,
    position: 1,
    result: "up" as const,
    points: 75,
    played: 32,
    won: 23,
    draw: 6,
    lost: 3,
    goal_difference: 42,
    team_name: "Manchester City",
    team_logo: "/logos/mci.png",
    short_code: "MCI",
    ...overrides,
  });

  const standingsWire: MatchDetailStandingsWire = {
    league_name: "Premier League",
    season_name: "2025/2026",
    standings: {
      overall: [makeRow()],
      home: [makeRow({ position: 2, points: 40 })],
      away: [makeRow({ position: 3, points: 35 })],
    },
  };

  it("maps league_name and season_name to camelCase", () => {
    const domain = toMatchStandingsDomain(standingsWire);
    expect(domain.leagueName).toBe("Premier League");
    expect(domain.seasonName).toBe("2025/2026");
  });

  it("produces byScope with overall/home/away arrays", () => {
    const domain = toMatchStandingsDomain(standingsWire);
    expect(domain.byScope.overall).toHaveLength(1);
    expect(domain.byScope.home).toHaveLength(1);
    expect(domain.byScope.away).toHaveLength(1);
  });

  it("maps rows with snake_case fields to camelCase", () => {
    const domain = toMatchStandingsDomain(standingsWire);
    const row = domain.byScope.overall[0];
    expect(row.participantId).toBe(1);
    expect(row.goalDifference).toBe(42);
    expect(row.teamName).toBe("Manchester City");
    expect(row.teamLogo).toBe("/logos/mci.png");
    expect(row.shortCode).toBe("MCI");
    expect(row.result).toBe("up");
  });

  it("handles null result in standings rows", () => {
    const wire: MatchDetailStandingsWire = {
      ...standingsWire,
      standings: {
        ...standingsWire.standings,
        overall: [makeRow({ result: null as unknown as "up" })],
      },
    };
    const domain = toMatchStandingsDomain(wire);
    expect(domain.byScope.overall[0].result).toBeNull();
  });

  it("handles empty result string as null", () => {
    // DD §3.7: Standings result === "" → treat as null / equal
    const wire: MatchDetailStandingsWire = {
      ...standingsWire,
      standings: {
        ...standingsWire.standings,
        overall: [makeRow({ result: "" as unknown as "up" })],
      },
    };
    const domain = toMatchStandingsDomain(wire);
    expect(domain.byScope.overall[0].result).toBeNull();
  });
});

// ─── toMatchLineupsDomain ─────────────────────────────────────────────────

describe("toMatchLineupsDomain", () => {
  const homeFormation = {
    team_id: 1,
    team_name: "Man City",
    formation: "4-2-3-1",
    players: [],
  };
  const awayFormation = {
    team_id: 2,
    team_name: "Liverpool",
    formation: "4-3-3",
    players: [],
  };

  it("maps lineups when present", () => {
    const wire: MatchDetailLineupsWire = {
      lineups: { home: homeFormation, away: awayFormation },
      available_at: "2026-06-11 17:00:00",
    };
    const domain = toMatchLineupsDomain(wire);
    expect(domain.lineups).not.toBeNull();
    expect(domain.lineups!.home.formation).toBe("4-2-3-1");
    expect(domain.lineups!.away.formation).toBe("4-3-3");
  });

  it("passes through null lineups (pre-match ≥ 1h)", () => {
    const wire: MatchDetailLineupsWire = {
      lineups: null,
      available_at: "2026-06-11 17:00:00",
    };
    const domain = toMatchLineupsDomain(wire);
    expect(domain.lineups).toBeNull();
  });

  it("parses available_at as UTC Date", () => {
    const wire: MatchDetailLineupsWire = {
      lineups: null,
      available_at: "2026-06-11 17:00:00",
    };
    const domain = toMatchLineupsDomain(wire);
    expect(domain.availableAt instanceof Date).toBe(true);
    expect(domain.availableAt.getUTCHours()).toBe(17);
    expect(domain.availableAt.getUTCDate()).toBe(11);
  });
});
