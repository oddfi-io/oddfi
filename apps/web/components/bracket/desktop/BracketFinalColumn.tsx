// DD-095 BracketFinalColumn — 决赛 + 季军（Figma 4580:6928）
// 中央列：BracketChampionCenter + BracketBronzeWinner

import type { TournamentBracket } from "@/lib/bracket/types";

import BracketBronzeWinner from "./BracketBronzeWinner";
import BracketChampionCenter from "./BracketChampionCenter";

interface BracketFinalColumnProps {
  bracket: TournamentBracket;
}

export default function BracketFinalColumn({ bracket }: BracketFinalColumnProps) {
  const finalMatch = bracket.matches.find((m) => m.round === "final");
  const bronzeMatch = bracket.matches.find((m) => m.round === "bronze");

  return (
    <div className="flex flex-col items-center justify-center gap-[32px] h-[996px] w-[200px]">
      <BracketChampionCenter finalMatch={finalMatch} />
      <BracketBronzeWinner bronzeMatch={bronzeMatch} />
    </div>
  );
}
