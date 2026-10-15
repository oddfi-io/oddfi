/**
 * Featured match scoring, selection & sorting logic.
 *
 * This file is pure logic — it consumes config data from config/featured/.
 * PM adjusts strategy by editing config files, not this file.
 */

import { CLUB_FEATURED_TEAMS } from '@/config/featured/club-teams'
import { WORLD_CUP_FEATURED_TEAMS } from '@/config/featured/world-cup-teams'
import { WORLD_CUP_LEAGUE, LEAGUE_WEIGHT_MAP, type CompetitionContext } from '@/config/featured/leagues'
import { SCORING } from '@/config/featured/scoring'
import type { SportmonksFixture } from '@/types/api'

export type FeaturedTeamsConfig = Record<number, string[]>

/**
 * Strip diacritics for accent-insensitive matching.
 * e.g. "Atlético" → "Atletico", "München" → "Munchen"
 */
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Get the featured teams config for a given competition context */
function getActiveFeaturedTeams(context: CompetitionContext): FeaturedTeamsConfig {
  switch (context) {
    case 'world-cup':
      return WORLD_CUP_FEATURED_TEAMS
    case 'club':
    default:
      return CLUB_FEATURED_TEAMS
  }
}

/** Auto-detect: if any fixture has league_id=732, switch to world-cup mode */
export function detectCompetitionContext(fixtures: SportmonksFixture[]): CompetitionContext {
  return fixtures.some((f) => f.league_id === WORLD_CUP_LEAGUE.id) ? 'world-cup' : 'club'
}

/** Check if a team name matches any keyword (accent-insensitive, case-insensitive substring match) */
function isTeamFeatured(teamName: string, keywords: string[]): boolean {
  const normalized = stripDiacritics(teamName).toLowerCase()
  return keywords.some((kw) => normalized.includes(stripDiacritics(kw).toLowerCase()))
}

/** Score a single fixture based on featured team config */
export function scoreFeaturedMatch(
  fixture: SportmonksFixture,
  featuredTeams: FeaturedTeamsConfig,
): number {
  const worldCupBonus = fixture.league_id === WORLD_CUP_LEAGUE.id ? SCORING.WORLD_CUP_BONUS : 0

  const leagueTeams = featuredTeams[fixture.league_id]
  if (!leagueTeams) return SCORING.NOT_FEATURED

  const home = fixture.participants.find((p) => p.meta.location === 'home')
  const away = fixture.participants.find((p) => p.meta.location === 'away')

  const homeIsFeatured = home ? isTeamFeatured(home.name, leagueTeams) : false
  const awayIsFeatured = away ? isTeamFeatured(away.name, leagueTeams) : false

  let base: number = SCORING.TOP_LEAGUE_ONLY
  if (homeIsFeatured && awayIsFeatured) base = SCORING.BOTH_FEATURED
  else if (homeIsFeatured || awayIsFeatured) base = SCORING.ONE_FEATURED

  return base + worldCupBonus
}

/** Get league weight (0 for unconfigured leagues) */
export function getLeagueWeight(leagueId: number): number {
  return LEAGUE_WEIGHT_MAP[leagueId] ?? 0
}

/** Get Hero Carousel featured matches (auto-detects context, fully config-driven) */
export function getFeaturedMatches(fixtures: SportmonksFixture[]): SportmonksFixture[] {
  const context = detectCompetitionContext(fixtures)
  const featuredTeams = getActiveFeaturedTeams(context)

  return fixtures
    .map((f) => ({ fixture: f, score: scoreFeaturedMatch(f, featuredTeams) }))
    .filter(({ score }) => score >= SCORING.MIN_SCORE_FOR_HERO)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Tiebreaker: league weight (PL > Serie A when scores equal)
      return getLeagueWeight(b.fixture.league_id) - getLeagueWeight(a.fixture.league_id)
    })
    .slice(0, SCORING.HERO_MATCH_LIMIT)
    .map(({ fixture }) => fixture)
}

/**
 * Sort league groups for the match list.
 *
 * Sorting formula: bestMatchScore * 10 + leagueWeight (descending)
 * - Configured leagues with high-quality matches rank first
 * - Unconfigured leagues are appended at the end, sorted by fixture count (descending)
 *
 * Within each league group, fixtures are sorted by featured score (descending).
 */
export function sortLeagueGroups(
  groups: Map<number, SportmonksFixture[]>,
  featuredTeams: FeaturedTeamsConfig,
): [number, SportmonksFixture[]][] {
  const entries = Array.from(groups.entries())

  const scored = entries.map(([leagueId, fixtures]) => {
    const bestScore = fixtures.reduce(
      (max, f) => Math.max(max, scoreFeaturedMatch(f, featuredTeams)),
      0,
    )
    const leagueWeight = getLeagueWeight(leagueId)
    const sortScore = bestScore * 10 + leagueWeight

    // Sort fixtures within league by featured score (descending)
    const sortedFixtures = [...fixtures].sort(
      (a, b) => scoreFeaturedMatch(b, featuredTeams) - scoreFeaturedMatch(a, featuredTeams),
    )

    return { leagueId, fixtures: sortedFixtures, sortScore, fixtureCount: fixtures.length }
  })

  scored.sort((a, b) => {
    if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore
    // Final tiebreaker: more fixtures = higher priority
    return b.fixtureCount - a.fixtureCount
  })

  return scored.map(({ leagueId, fixtures }) => [leagueId, fixtures])
}

/** Get the active featured teams config for the current fixture set */
export function getActiveFeaturedTeamsForFixtures(fixtures: SportmonksFixture[]): FeaturedTeamsConfig {
  const context = detectCompetitionContext(fixtures)
  return getActiveFeaturedTeams(context)
}
