import { describe, it, expect } from "vitest";
import {
  scoreFeaturedMatch,
  detectCompetitionContext,
  getFeaturedMatches,
  getLeagueWeight,
  sortLeagueGroups,
} from "./featured-matches";
import { CLUB_FEATURED_TEAMS } from "@/config/featured/club-teams";
import { WORLD_CUP_FEATURED_TEAMS } from "@/config/featured/world-cup-teams";
import type { SportmonksFixture, SportmonksParticipant } from "@/types/api";

// ── Helpers ──

function makeParticipant(name: string, location: "home" | "away"): SportmonksParticipant {
  return {
    id: (Math.random() * 10000) | 0,
    name,
    short_code: name.slice(0, 3).toUpperCase(),
    image_path: "",
    country_id: 0,
    type: "domestic",
    meta: { location, winner: null, position: location === "home" ? 1 : 2 },
  };
}

function makeFixture(
  home: string,
  away: string,
  leagueId: number,
  opts?: { hasOdds?: boolean }
): SportmonksFixture {
  return {
    id: (Math.random() * 10000) | 0,
    league_id: leagueId,
    stage_id: 0,
    name: `${home} vs ${away}`,
    starting_at: "2026-03-22T15:00:00Z",
    starting_at_timestamp: 1774216800,
    state_id: 1,
    has_odds: opts?.hasOdds ?? true,
    odds:
      opts?.hasOdds === false
        ? []
        : [
            {
              id: 1,
              fixture_id: 1,
              market_id: 1,
              bookmaker_id: 2,
              label: "1",
              value: "1.50",
              name: null,
              market_description: "Full Time Result",
              probability: "66.67",
              total: null,
              handicap: null,
              sort_order: 1,
              winning: false,
              stopped: false,
            },
          ],
    participants: [makeParticipant(home, "home"), makeParticipant(away, "away")],
  };
}

// ── scoreFeaturedMatch ──

describe("scoreFeaturedMatch", () => {
  it("scores 3 when both teams are featured (Arsenal vs Liverpool)", () => {
    const fixture = makeFixture("Arsenal", "Liverpool", 8);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(3);
  });

  it("scores 2 when one team is featured (Arsenal vs Burnley)", () => {
    const fixture = makeFixture("Arsenal", "Burnley", 8);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(2);
  });

  it("scores 1 when neither team is featured but league is configured (Burnley vs Everton)", () => {
    const fixture = makeFixture("Burnley", "Everton", 8);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(1);
  });

  it("scores 0 when league is not configured", () => {
    const fixture = makeFixture("Random FC", "Unknown United", 9999);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(0);
  });

  it("handles accent-insensitive matching (Atletico matches Atlético Madrid)", () => {
    const fixture = makeFixture("Atlético Madrid", "Real Madrid", 564);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(3);
  });

  it("handles substring matching (Barcelona matches FC Barcelona)", () => {
    const fixture = makeFixture("FC Barcelona", "Real Madrid", 564);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(3);
  });

  it("handles substring matching (Tottenham matches Tottenham Hotspur)", () => {
    const fixture = makeFixture("Tottenham Hotspur", "Arsenal", 8);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(3);
  });

  it("handles Bayern matching FC Bayern München", () => {
    const fixture = makeFixture("FC Bayern München", "Borussia Dortmund", 82);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(3);
  });

  it("handles Paris Saint matching Paris Saint Germain", () => {
    const fixture = makeFixture("Paris Saint Germain", "Monaco", 301);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(2);
  });

  it("handles case-insensitive matching", () => {
    const fixture = makeFixture("ARSENAL", "liverpool", 8);
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(3);
  });

  it("adds world cup bonus for world cup fixtures", () => {
    const fixture = makeFixture("Brazil", "Argentina", 732);
    const score = scoreFeaturedMatch(fixture, WORLD_CUP_FEATURED_TEAMS);
    expect(score).toBe(3.5);
  });

  it("scores world cup fixture with one featured team", () => {
    const fixture = makeFixture("Brazil", "New Zealand", 732);
    const score = scoreFeaturedMatch(fixture, WORLD_CUP_FEATURED_TEAMS);
    expect(score).toBe(2.5);
  });

  it("scores world cup fixture with no featured team", () => {
    const fixture = makeFixture("Iceland", "New Zealand", 732);
    const score = scoreFeaturedMatch(fixture, WORLD_CUP_FEATURED_TEAMS);
    expect(score).toBe(1.5);
  });

  it("scores T2 league (UCL) with inherited T1 teams", () => {
    const fixture = makeFixture("Arsenal", "Real Madrid", 2); // UCL
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(3);
  });

  it("scores T2 league (UCL) with one inherited team", () => {
    const fixture = makeFixture("Arsenal", "Club Brugge", 2); // UCL
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(2);
  });

  it("scores T2 league (UCL) with no inherited teams", () => {
    const fixture = makeFixture("Club Brugge", "RB Salzburg", 2); // UCL
    expect(scoreFeaturedMatch(fixture, CLUB_FEATURED_TEAMS)).toBe(1);
  });
});

// ── getLeagueWeight ──

describe("getLeagueWeight", () => {
  it("returns correct weight for Premier League", () => {
    expect(getLeagueWeight(8)).toBe(14);
  });

  it("returns correct weight for Champions League", () => {
    expect(getLeagueWeight(2)).toBe(15);
  });

  it("returns correct weight for World Cup", () => {
    expect(getLeagueWeight(732)).toBe(100);
  });

  it("returns 0 for unconfigured league", () => {
    expect(getLeagueWeight(9999)).toBe(0);
  });
});

// ── detectCompetitionContext ──

describe("detectCompetitionContext", () => {
  it('returns "club" when no world cup fixtures present', () => {
    const fixtures = [makeFixture("Arsenal", "Chelsea", 8)];
    expect(detectCompetitionContext(fixtures)).toBe("club");
  });

  it('returns "world-cup" when any fixture has league_id=732', () => {
    const fixtures = [
      makeFixture("Arsenal", "Chelsea", 8),
      makeFixture("Brazil", "Argentina", 732),
    ];
    expect(detectCompetitionContext(fixtures)).toBe("world-cup");
  });

  it('returns "club" for empty fixtures', () => {
    expect(detectCompetitionContext([])).toBe("club");
  });
});

// ── getFeaturedMatches ──

describe("getFeaturedMatches", () => {
  it("returns featured matches sorted by score (highest first)", () => {
    const fixtures = [
      makeFixture("Burnley", "Everton", 8), // score=1, below threshold
      makeFixture("Arsenal", "Liverpool", 8), // score=3
      makeFixture("Arsenal", "Burnley", 8), // score=2
      makeFixture("FC Barcelona", "Real Madrid", 564), // score=3
    ];
    const result = getFeaturedMatches(fixtures);
    expect(result).toHaveLength(3);
    // score=3 matches first, PL (weight=14) before La Liga (weight=13)
    expect(result[0].name).toContain("Arsenal");
    expect(result[0].name).toContain("Liverpool");
  });

  it("breaks ties by league weight (PL before Serie A)", () => {
    const fixtures = [
      makeFixture("Cagliari", "Napoli", 384), // score=2, Serie A weight=10
      makeFixture("Bournemouth", "Manchester United", 8), // score=2, PL weight=14
    ];
    const result = getFeaturedMatches(fixtures);
    expect(result).toHaveLength(2);
    expect(result[0].name).toContain("Manchester United"); // PL first
    expect(result[1].name).toContain("Napoli"); // Serie A second
  });

  it("filters out fixtures below MIN_SCORE_FOR_HERO", () => {
    const fixtures = [
      makeFixture("Burnley", "Everton", 8),
      makeFixture("Random FC", "Unknown", 9999),
    ];
    const result = getFeaturedMatches(fixtures);
    expect(result).toHaveLength(0);
  });

  it("limits results to HERO_MATCH_LIMIT", () => {
    const fixtures = [
      makeFixture("Arsenal", "Liverpool", 8),
      makeFixture("Chelsea", "Manchester City", 8),
      makeFixture("Tottenham Hotspur", "Manchester United", 8),
      makeFixture("FC Barcelona", "Real Madrid", 564),
      makeFixture("Atlético Madrid", "FC Barcelona", 564),
      makeFixture("FC Bayern München", "Borussia Dortmund", 82),
      makeFixture("AC Milan", "Juventus", 384),
    ];
    const result = getFeaturedMatches(fixtures);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("returns empty array when no fixtures provided", () => {
    expect(getFeaturedMatches([])).toHaveLength(0);
  });

  it("prioritizes world cup fixtures when present (club fixtures excluded in WC mode)", () => {
    const fixtures = [
      makeFixture("Arsenal", "Liverpool", 8),
      makeFixture("Brazil", "Argentina", 732),
    ];
    const result = getFeaturedMatches(fixtures);
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain("Brazil");
  });
});

// ── sortLeagueGroups ──

describe("sortLeagueGroups", () => {
  it("sorts PL before Serie A when both have same best match score", () => {
    const groups = new Map<number, SportmonksFixture[]>([
      [384, [makeFixture("Cagliari", "Napoli", 384)]], // score=2, weight=10
      [8, [makeFixture("Bournemouth", "Manchester United", 8)]], // score=2, weight=14
    ]);
    const sorted = sortLeagueGroups(groups, CLUB_FEATURED_TEAMS);
    expect(sorted[0][0]).toBe(8); // PL first
    expect(sorted[1][0]).toBe(384); // Serie A second
  });

  it("sorts UCL with big match above PL with small match", () => {
    const groups = new Map<number, SportmonksFixture[]>([
      [8, [makeFixture("Burnley", "Everton", 8)]], // score=1, sortScore=1*10+14=24
      [2, [makeFixture("Arsenal", "Real Madrid", 2)]], // score=3, sortScore=3*10+15=45
    ]);
    const sorted = sortLeagueGroups(groups, CLUB_FEATURED_TEAMS);
    expect(sorted[0][0]).toBe(2); // UCL first (higher best match score)
    expect(sorted[1][0]).toBe(8); // PL second
  });

  it("sorts PL with big match above UCL with small teams", () => {
    const groups = new Map<number, SportmonksFixture[]>([
      [2, [makeFixture("Club Brugge", "RB Salzburg", 2)]], // score=1, sortScore=1*10+15=25
      [8, [makeFixture("Arsenal", "Liverpool", 8)]], // score=3, sortScore=3*10+14=44
    ]);
    const sorted = sortLeagueGroups(groups, CLUB_FEATURED_TEAMS);
    expect(sorted[0][0]).toBe(8); // PL first (big match)
    expect(sorted[1][0]).toBe(2); // UCL second (small teams)
  });

  it("sorts unconfigured leagues after configured leagues", () => {
    const groups = new Map<number, SportmonksFixture[]>([
      [9999, [makeFixture("Random FC", "Unknown", 9999)]], // score=0, sortScore=0
      [8, [makeFixture("Burnley", "Everton", 8)]], // score=1, sortScore=24
    ]);
    const sorted = sortLeagueGroups(groups, CLUB_FEATURED_TEAMS);
    expect(sorted[0][0]).toBe(8); // PL first
    expect(sorted[1][0]).toBe(9999); // Unknown last
  });

  it("sorts fixtures within a league by featured score (descending)", () => {
    const groups = new Map<number, SportmonksFixture[]>([
      [
        8,
        [
          makeFixture("Burnley", "Everton", 8), // score=1
          makeFixture("Arsenal", "Liverpool", 8), // score=3
          makeFixture("Arsenal", "Burnley", 8), // score=2
        ],
      ],
    ]);
    const sorted = sortLeagueGroups(groups, CLUB_FEATURED_TEAMS);
    const plFixtures = sorted[0][1];
    expect(plFixtures[0].name).toContain("Arsenal");
    expect(plFixtures[0].name).toContain("Liverpool"); // score=3 first
    expect(plFixtures[1].name).toContain("Arsenal");
    expect(plFixtures[1].name).toContain("Burnley"); // score=2 second
    expect(plFixtures[2].name).toContain("Burnley");
    expect(plFixtures[2].name).toContain("Everton"); // score=1 last
  });

  it("follows T1 league order: PL > La Liga > Bundesliga > Ligue 1 > Serie A", () => {
    // All leagues have one non-featured match (score=1), so sorting by weight only
    const groups = new Map<number, SportmonksFixture[]>([
      [384, [makeFixture("Sassuolo", "Lecce", 384)]], // weight=10
      [8, [makeFixture("Burnley", "Everton", 8)]], // weight=14
      [301, [makeFixture("Auxerre", "Brest", 301)]], // weight=11
      [564, [makeFixture("Getafe", "Girona", 564)]], // weight=13
      [82, [makeFixture("Augsburg", "Mainz", 82)]], // weight=12
    ]);
    const sorted = sortLeagueGroups(groups, CLUB_FEATURED_TEAMS);
    expect(sorted.map(([id]) => id)).toEqual([8, 564, 82, 301, 384]);
  });
});
