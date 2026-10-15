// DD-095 Bracket 数据契约（2026 FIFA World Cup 格式：48 队 / 12 组 / KO 32 场）

export type RoundKey = "r32" | "r16" | "qf" | "sf" | "final" | "bronze";

export type GroupKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export interface BracketTeam {
  id: string;
  iso2: string;
  name: string;
}

export interface GroupCell {
  groupKey: GroupKey;
  teams: BracketTeam[];
}

export interface BracketMatch {
  id: string;
  round: RoundKey;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore?: number;
  awayScore?: number;
  startsAt: string;
  groupKey?: GroupKey;
}

export interface TournamentBracket {
  teams: Record<string, BracketTeam>;
  groups: GroupCell[];
  matches: BracketMatch[];
  champion?: BracketTeam;
  bronze?: BracketTeam;
}
