import type { SportmonksFixture, SportmonksOddsEntry, SportmonksParticipant } from "@/types/api";
import type { OddsFilter } from "@/types/betting";
import type { MatchTeam, TeamSide } from "@/types/match-detail-domain";
import { parseMatchTime } from "./format-utils";
import { formatOdds } from "./odds";

// ─── Team helpers ─────────────────────────────────────────────────────────

export function getTeam(fixture: SportmonksFixture, location: TeamSide) {
  return fixture.participants?.find((p) => p.meta.location === location);
}

export function getTeamLogo(fixture: SportmonksFixture, location: TeamSide) {
  return getTeam(fixture, location)?.image_path ?? "";
}

export function getTeamName(fixture: SportmonksFixture, location: TeamSide) {
  return getTeam(fixture, location)?.name ?? "—";
}

/**
 * SportMonks participant → 详情列 MatchTeam（含本侧 team_kits URL）。
 * jerseyPath 取 team_kits[type=自身所属]；缺省由消费组件 Jersey 走灰度占位兜底。
 */
export function participantToMatchTeam(
  p: SportmonksParticipant | undefined,
  side: TeamSide
): MatchTeam {
  return {
    participantId: p?.id ?? 0,
    name: p?.name ?? "",
    shortCode: p?.short_code ?? "",
    imagePath: p?.image_path ?? "",
    jerseyPath: p?.team_kits?.find((k) => k.type === side)?.url,
  };
}

// ─── Time helpers ─────────────────────────────────────────────────────────

/**
 * 24h 格式 HH:mm，按用户当前时区显示。
 * 接受 ISO 字符串（无 Z 时按 UTC 补齐）或 unix 时间戳（秒/毫秒）。
 */
export function formatKickoff(input: string | number): string {
  try {
    const d = parseMatchTime(input);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return typeof input === "string" ? input : "";
  }
}

/**
 * 长格式开赛时间（如 "Wed, Jun 11, 7:00 PM"），按用户当前时区/locale 显示。
 * Pools 列表与 Positions 赛事行共用；短格式（HH:mm）用上面的 formatKickoff。
 */
export function formatKickoffLong(startSec: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startSec * 1000));
}

// ─── Odds extraction ──────────────────────────────────────────────────────

/** Extract odds by market_id (stable across all bookmakers, unlike market_description) */
export function getOddsByMarketId(odds: SportmonksOddsEntry[], marketId: number) {
  return odds.filter((o) => o.market_id === marketId);
}

/** Get 1X2 odds entry — market_id=1 */
export function get1X2Entry(
  odds: SportmonksOddsEntry[],
  label: string
): SportmonksOddsEntry | undefined {
  return getOddsByMarketId(odds, 1).find((o) => o.label === label);
}

/** Get first handicap/total line entries for compact display */
export function getFirstLineEntries(
  odds: SportmonksOddsEntry[],
  marketId: number,
  homeLabels: string[],
  awayLabels: string[]
) {
  const filtered = getOddsByMarketId(odds, marketId);
  return {
    home: filtered.find((o) => homeLabels.includes(o.label)),
    away: filtered.find((o) => awayLabels.includes(o.label)),
  };
}

/** Pick the first Asian Handicap line (market_id=6). Labels may be '1'/'2' or 'Home'/'Away'. */
export function getMainHandicapLine(odds: SportmonksOddsEntry[]) {
  const hcOdds = odds.filter((o) => o.market_id === 6);
  const homeEntry = hcOdds.find((o) => o.label === "Home" || o.label === "1");
  const awayEntry = hcOdds.find((o) => o.label === "Away" || o.label === "2");
  if (!homeEntry && !awayEntry) return null;
  return {
    homeOdds: formatOdds(homeEntry?.value),
    awayOdds: formatOdds(awayEntry?.value),
    line: homeEntry?.handicap ?? awayEntry?.handicap ?? "—",
  };
}

/** Pick the first Asian Total line (market_id=7). */
export function getMainTotalLine(odds: SportmonksOddsEntry[]) {
  const ttOdds = odds.filter((o) => o.market_id === 7);
  const overEntry = ttOdds.find((o) => o.label === "Over");
  const underEntry = ttOdds.find((o) => o.label === "Under");
  if (!overEntry && !underEntry) return null;
  return {
    overOdds: formatOdds(overEntry?.value),
    underOdds: formatOdds(underEntry?.value),
    line: overEntry?.total ?? underEntry?.total ?? "—",
  };
}

// ─── Display helpers ──────────────────────────────────────────────────────

export interface OddsDisplay {
  col1: string;
  col2: string;
  col3: string;
  header1: string;
  header2: string;
  header3: string;
  /** true when the requested market type is unavailable and we fell back to 1x2 */
  isFallback: boolean;
}

export function getOddsDisplay(odds: SportmonksOddsEntry[], filter: OddsFilter): OddsDisplay {
  if (filter === "handicap") {
    const hc = getMainHandicapLine(odds);
    if (hc)
      return {
        col1: hc.homeOdds,
        col2: hc.line,
        col3: hc.awayOdds,
        header1: "1",
        header2: "HC",
        header3: "2",
        isFallback: false,
      };
  }
  if (filter === "total") {
    const tt = getMainTotalLine(odds);
    if (tt)
      return {
        col1: tt.overOdds,
        col2: tt.line,
        col3: tt.underOdds,
        header1: "O",
        header2: "O/U",
        header3: "U",
        isFallback: false,
      };
  }
  // Default / fallback: 1x2
  return {
    col1: formatOdds(get1X2Entry(odds, "Home")?.value),
    col2: formatOdds(get1X2Entry(odds, "Draw")?.value),
    col3: formatOdds(get1X2Entry(odds, "Away")?.value),
    header1: "1",
    header2: "1x2",
    header3: "2",
    isFallback: filter !== "winner",
  };
}

/** Return the raw OddsEntry objects + display labels for each column (needed for BetSelection building) */
export function getOddsEntries(
  odds: SportmonksOddsEntry[],
  filter: OddsFilter,
  homeTeam?: string,
  awayTeam?: string
) {
  if (filter === "handicap") {
    const hcOdds = odds.filter((o) => o.market_id === 6);
    const homeEntry = hcOdds.find((o) => o.label === "Home" || o.label === "1");
    const awayEntry = hcOdds.find((o) => o.label === "Away" || o.label === "2");
    if (homeEntry || awayEntry) {
      return {
        entry1: homeEntry,
        displayLabel1: homeTeam ?? "Home",
        entry2: undefined,
        displayLabel2: "HC",
        entry3: awayEntry,
        displayLabel3: awayTeam ?? "Away",
        lineValue: homeEntry?.handicap ?? awayEntry?.handicap ?? undefined,
      };
    }
  }
  if (filter === "total") {
    const ttOdds = odds.filter((o) => o.market_id === 7);
    const overEntry = ttOdds.find((o) => o.label === "Over");
    const underEntry = ttOdds.find((o) => o.label === "Under");
    if (overEntry || underEntry) {
      return {
        entry1: overEntry,
        displayLabel1: "Over",
        entry2: undefined,
        displayLabel2: "O/U",
        entry3: underEntry,
        displayLabel3: "Under",
        lineValue: overEntry?.total ?? underEntry?.total ?? undefined,
      };
    }
  }
  // Default: 1x2
  return {
    entry1: get1X2Entry(odds, "Home"),
    displayLabel1: homeTeam ?? "Home",
    entry2: get1X2Entry(odds, "Draw"),
    displayLabel2: "Draw",
    entry3: get1X2Entry(odds, "Away"),
    displayLabel3: awayTeam ?? "Away",
    lineValue: undefined,
  };
}

// ─── Triple Odds Display ─────────────────────────────────────────────────

export interface OddsEntries {
  entry1: SportmonksOddsEntry | undefined;
  displayLabel1: string;
  entry2: SportmonksOddsEntry | undefined;
  displayLabel2: string;
  entry3: SportmonksOddsEntry | undefined;
  displayLabel3: string;
  lineValue?: string;
}

export interface TripleOddsData {
  display: OddsDisplay;
  entries: OddsEntries;
}

/**
 * Get all three market displays at once for triple-odds mode.
 * Unlike getOddsDisplay, this does NOT fallback — each market is independent.
 * Missing markets show "—" values with disabled buttons.
 */
export function getAllOddsDisplay(
  odds: SportmonksOddsEntry[],
  homeTeam?: string,
  awayTeam?: string
): {
  winner: TripleOddsData;
  handicap: TripleOddsData;
  total: TripleOddsData;
} {
  // Winner (1X2) — always independent, no fallback
  const winnerDisplay: OddsDisplay = {
    col1: formatOdds(get1X2Entry(odds, "Home")?.value),
    col2: formatOdds(get1X2Entry(odds, "Draw")?.value),
    col3: formatOdds(get1X2Entry(odds, "Away")?.value),
    header1: "1",
    header2: "X", // 三盘口用 "X"（Draw 列标题），单盘口 getOddsDisplay 用 "1x2"（整组标签）
    header3: "2",
    isFallback: false,
  };

  // Handicap — independent, "—" if missing
  const hc = getMainHandicapLine(odds);
  const handicapDisplay: OddsDisplay = hc
    ? {
        col1: hc.homeOdds,
        col2: hc.line,
        col3: hc.awayOdds,
        header1: "1",
        header2: "HC",
        header3: "2",
        isFallback: false,
      }
    : {
        col1: "—",
        col2: "—",
        col3: "—",
        header1: "1",
        header2: "HC",
        header3: "2",
        isFallback: false,
      };

  // Total — independent, "—" if missing
  const tt = getMainTotalLine(odds);
  const totalDisplay: OddsDisplay = tt
    ? {
        col1: tt.overOdds,
        col2: tt.line,
        col3: tt.underOdds,
        header1: "O",
        header2: "O/U",
        header3: "U",
        isFallback: false,
      }
    : {
        col1: "—",
        col2: "—",
        col3: "—",
        header1: "O",
        header2: "O/U",
        header3: "U",
        isFallback: false,
      };

  // winner entries — getOddsEntries 的 default 就是 1X2，可直接复用
  const winnerEntries = getOddsEntries(odds, "winner", homeTeam, awayTeam);

  // handicap entries — 独立构造，不经过 getOddsEntries 的 fallback 逻辑
  const hcOdds = odds.filter((o) => o.market_id === 6);
  const hcHome = hcOdds.find((o) => o.label === "Home" || o.label === "1");
  const hcAway = hcOdds.find((o) => o.label === "Away" || o.label === "2");
  const handicapEntries = {
    entry1: hcHome,
    displayLabel1: homeTeam ?? "Home",
    entry2: undefined as SportmonksOddsEntry | undefined,
    displayLabel2: "HC",
    entry3: hcAway,
    displayLabel3: awayTeam ?? "Away",
    lineValue: hcHome?.handicap ?? hcAway?.handicap ?? undefined,
  };

  // total entries — 独立构造，不 fallback
  const ttOdds = odds.filter((o) => o.market_id === 7);
  const ttOver = ttOdds.find((o) => o.label === "Over");
  const ttUnder = ttOdds.find((o) => o.label === "Under");
  const totalEntries = {
    entry1: ttOver,
    displayLabel1: "Over",
    entry2: undefined as SportmonksOddsEntry | undefined,
    displayLabel2: "O/U",
    entry3: ttUnder,
    displayLabel3: "Under",
    lineValue: ttOver?.total ?? ttUnder?.total ?? undefined,
  };

  return {
    winner: { display: winnerDisplay, entries: winnerEntries },
    handicap: { display: handicapDisplay, entries: handicapEntries },
    total: { display: totalDisplay, entries: totalEntries },
  };
}
