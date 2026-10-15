/**
 * DD-104: Match Detail wire → domain 适配层。
 *
 * 后端 commit: 873beed (origin/dev · oddfi-backend)
 *
 * 职责：
 *   1. snake_case → camelCase 字段映射
 *   2. 零值陷阱处理：seasonGoals / standingsRank 全零 → null（后端 assemble.go 行为）
 *   3. recentResults 大小写归一：小写 w/d/l → 大写 W/D/L
 *   4. available_at 时间解析：视作 UTC（parseBackendDateTime）
 */

import type {
  MatchDetailOverviewWire,
  MatchDetailH2HWire,
  MatchDetailStandingsWire,
  MatchDetailLineupsWire,
  MatchDetailTeamWire,
} from "@/types/match-detail";
import type {
  MatchOverviewDomain,
  MatchH2HDomain,
  MatchStandingsDomain,
  MatchStandingsRowDomain,
  MatchLineupsDomain,
  MatchTeam,
  MatchVenue,
  MatchOutcomeDomain,
  PeriodGoalDomain,
} from "@/types/match-detail-domain";

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * 将后端 "YYYY-MM-DD HH:mm:ss" 格式（无时区）视作 UTC 解析。
 * DD §3.7: new Date(s.replace(' ', 'T') + 'Z')
 */
export function parseBackendDateTime(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

function toMatchTeam(wire: MatchDetailTeamWire): MatchTeam {
  return {
    participantId: wire.participant_id,
    name: wire.name,
    shortCode: wire.short_code,
    imagePath: wire.image_path,
    ...(wire.jersey_path !== undefined ? { jerseyPath: wire.jersey_path } : {}),
  };
}

function toVenue(wire: MatchDetailOverviewWire["venue"]): MatchVenue {
  return {
    name: wire.name,
    city: wire.city,
    capacity: wire.capacity,
    imagePath: wire.image_path,
    distanceKm: wire.distance_km,
  };
}

/**
 * 将 recentResults 字符串归一为大写 MatchOutcomeDomain。
 * 后端有时返回小写 "w"/"d"/"l"，前端统一处理。
 */
function toMatchOutcome(s: string): MatchOutcomeDomain {
  return s.toUpperCase() as MatchOutcomeDomain;
}

// ─── Overview ──────────────────────────────────────────────────────────────

export function toMatchOverviewDomain(wire: MatchDetailOverviewWire): MatchOverviewDomain {
  // 零值陷阱：home/away 独立归 null（DD §5 修正）
  // home=0 → home:null，away=0 → away:null，互不影响，UI 逐字段显示 '—'
  const seasonGoals = {
    home: wire.seasonGoals.home === 0 ? null : wire.seasonGoals.home,
    away: wire.seasonGoals.away === 0 ? null : wire.seasonGoals.away,
  };

  const standingsRank = {
    home: wire.standingsRank.home === 0 ? null : wire.standingsRank.home,
    away: wire.standingsRank.away === 0 ? null : wire.standingsRank.away,
  };

  const periodGoals: PeriodGoalDomain[] = wire.periodGoals.map((pg) => ({
    period: pg.period,
    homeAvg: pg.home_avg,
    awayAvg: pg.away_avg,
  }));

  return {
    homeTeam: toMatchTeam(wire.homeTeam),
    awayTeam: toMatchTeam(wire.awayTeam),
    kickoff: {
      iso: wire.startingAt,
      timestamp: wire.starting_at_timestamp,
    },
    venue: toVenue(wire.venue),
    seasonGoals,
    topScorers: wire.topScorers,
    standingsRank,
    formPercentage: wire.formPercentage,
    recentResults: {
      home: wire.recentResults.home.map(toMatchOutcome),
      away: wire.recentResults.away.map(toMatchOutcome),
    },
    periodGoals,
    winProbability: wire.winProbability,
    h2hSummary: wire.h2hSummary,
    referee: wire.referee,
    managers: wire.managers,
  };
}

// ─── H2H ───────────────────────────────────────────────────────────────────

export function toMatchH2HDomain(wire: MatchDetailH2HWire): MatchH2HDomain {
  return {
    h2hSampleSize: wire.h2h_sample_size,
    topScorers: wire.topScorers,
    h2hAverageGoals: wire.h2hAverageGoals,
    h2hForm: wire.h2hForm,
  };
}

// ─── Standings ─────────────────────────────────────────────────────────────

function toStandingsRows(
  rows: MatchDetailStandingsWire["standings"]["overall"]
): MatchStandingsRowDomain[] {
  return rows.map((row) => ({
    participantId: row.participant_id,
    position: row.position,
    // DD §3.7: result === "" → null（灰点）
    result: row.result === "" ? null : row.result,
    points: row.points,
    played: row.played,
    won: row.won,
    draw: row.draw,
    lost: row.lost,
    goalDifference: row.goal_difference,
    teamName: row.team_name,
    teamLogo: row.team_logo,
    shortCode: row.short_code,
  }));
}

export function toMatchStandingsDomain(wire: MatchDetailStandingsWire): MatchStandingsDomain {
  return {
    leagueName: wire.league_name,
    seasonName: wire.season_name,
    byScope: {
      overall: toStandingsRows(wire.standings.overall),
      home: toStandingsRows(wire.standings.home),
      away: toStandingsRows(wire.standings.away),
    },
  };
}

// ─── Lineups ───────────────────────────────────────────────────────────────

export function toMatchLineupsDomain(wire: MatchDetailLineupsWire): MatchLineupsDomain {
  return {
    lineups: wire.lineups,
    availableAt: parseBackendDateTime(wire.available_at),
  };
}
