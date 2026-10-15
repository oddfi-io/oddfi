import type { LineupFormation, SportmonksLineupEntry } from "@/types/moneyline";
import { HOME_BLUE as HOME_COLOR, AWAY_ORANGE as AWAY_COLOR } from "@/lib/match-colors";

interface LineupCardFormationProps {
  home: LineupFormation;
  away: LineupFormation;
}

/** 解析 formation_field "行:列" → { row, col } */
function parseField(field: string): { row: number; col: number } {
  const parts = field.split(":");
  return { row: parseInt(parts[0], 10), col: parseInt(parts[1], 10) };
}

type RowMap = Map<number, SportmonksLineupEntry[]>;

/** 按 row 分组并按 col 升序排列球员，确保每行内球员的 indexInRow 稳定 */
function buildRowMap(starters: SportmonksLineupEntry[]): RowMap {
  const byRow: RowMap = new Map();
  for (const p of starters) {
    const { row } = parseField(p.formation_field);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row)!.push(p);
  }
  for (const list of byRow.values()) {
    list.sort((a, b) => parseField(a.formation_field).col - parseField(b.formation_field).col);
  }
  return byRow;
}

/**
 * 计算球员在球场 SVG 坐标系中的位置。
 * 球场高度方向 0=顶(门将) → 100=底(对方)
 * 球场分为两半：home 占上半（0–46%），away 占下半（54–100%），中间留 8% 中线空间。
 *
 * 横向：按所在 row 内的球员数均匀分布。row 只 1 人（GK / 单前锋）自动居中。
 */
function calcPosition(
  player: SportmonksLineupEntry,
  team: "home" | "away",
  maxRow: number,
  byRow: RowMap
): { x: number; y: number } {
  const { row } = parseField(player.formation_field);
  const rowPlayers = byRow.get(row) ?? [];
  const count = rowPlayers.length;
  const indexInRow = rowPlayers.findIndex((p) => p.player_id === player.player_id);
  const xPct = count <= 1 ? 50 : ((indexInRow + 0.5) / count) * 100;

  // 纵向：home 从顶部 4% 到 46%，away 从 54% 到 96%（镜像）
  const rowFraction = (row - 1) / Math.max(maxRow - 1, 1);
  let yPct: number;
  if (team === "home") {
    yPct = 4 + rowFraction * 42;
  } else {
    // away 镜像：row=1 在底，row=max 在顶
    yPct = 96 - rowFraction * 42;
  }

  return { x: xPct, y: yPct };
}

function PlayerMarker({
  player,
  color,
  x,
  y,
}: {
  player: SportmonksLineupEntry;
  color: string;
  x: number;
  y: number;
}) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-md"
        style={{ backgroundColor: color }}
      >
        {player.jersey_number}
      </div>
    </div>
  );
}

export function LineupCardFormation({ home, away }: LineupCardFormationProps) {
  const homeStarters = home.players.filter((p) => p.type_id === 11);
  const awayStarters = away.players.filter((p) => p.type_id === 11);

  const homeMaxRow = Math.max(...homeStarters.map((p) => parseField(p.formation_field).row));
  const awayMaxRow = Math.max(...awayStarters.map((p) => parseField(p.formation_field).row));
  const homeByRow = buildRowMap(homeStarters);
  const awayByRow = buildRowMap(awayStarters);

  return (
    <div>
      {/* 顶部阵型标签 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] font-bold" style={{ color: HOME_COLOR }}>
          {home.formation}
        </span>
        <span className="text-[10px] text-tertiary uppercase tracking-wide font-semibold">
          Formation
        </span>
        <span className="text-[14px] font-bold" style={{ color: AWAY_COLOR }}>
          {away.formation}
        </span>
      </div>

      {/* 足球场 */}
      <div
        className="relative w-full rounded-lg overflow-hidden"
        style={{
          // @figma-hardcoded: #1a3a1a football-pitch-bg — pending design token
          background: "linear-gradient(180deg, #1a3a20 0%, #1d4224 50%, #1a3a20 100%)",
          paddingTop: "140%",
        }}
      >
        {/* 球场线条 SVG */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 140"
          preserveAspectRatio="none"
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="0.5"
        >
          {/* 外框 */}
          <rect x="5" y="3" width="90" height="134" />
          {/* 中线 */}
          <line x1="5" y1="70" x2="95" y2="70" />
          {/* 中圆 */}
          <circle cx="50" cy="70" r="12" />
          <circle cx="50" cy="70" r="0.8" fill="rgba(255,255,255,0.4)" stroke="none" />
          {/* 上方禁区 */}
          <rect x="25" y="3" width="50" height="16" />
          <rect x="35" y="3" width="30" height="8" />
          {/* 下方禁区 */}
          <rect x="25" y="121" width="50" height="16" />
          <rect x="35" y="129" width="30" height="8" />
          {/* 上方角旗 */}
          <line x1="5" y1="5" x2="7" y2="3" />
          <line x1="95" y1="5" x2="93" y2="3" />
          <line x1="5" y1="135" x2="7" y2="137" />
          <line x1="95" y1="135" x2="93" y2="137" />
        </svg>

        {/* Home 球员 */}
        {homeStarters.map((player) => {
          const { x, y } = calcPosition(player, "home", homeMaxRow, homeByRow);
          return (
            <PlayerMarker key={player.player_id} player={player} color={HOME_COLOR} x={x} y={y} />
          );
        })}

        {/* Away 球员 */}
        {awayStarters.map((player) => {
          const { x, y } = calcPosition(player, "away", awayMaxRow, awayByRow);
          return (
            <PlayerMarker key={player.player_id} player={player} color={AWAY_COLOR} x={x} y={y} />
          );
        })}
      </div>
    </div>
  );
}
