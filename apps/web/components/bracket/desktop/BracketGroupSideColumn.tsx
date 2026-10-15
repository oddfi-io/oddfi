// DD-095 BracketGroupSideColumn — PC 远端 12 组小组卡列（Figma 4474:168084 / 4652:18177）
// props: side="left"|"right"
// left → Group A-F（6 张 BracketGroupCard pc-side），right → Group G-L
// 容器 118×996，xl(≥1280) 显示，lg-md 隐藏

import type { GroupKey } from "@/lib/bracket/types";
import { BRACKET_GROUPS } from "@/lib/bracket/mock-data";

import BracketGroupCard from "@/components/bracket/BracketGroupCard";

interface BracketGroupSideColumnProps {
  side: "left" | "right";
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>, groupKey: GroupKey) => void;
  onMouseLeave?: () => void;
}

// Group A-F → left side；Group G-L → right side
const LEFT_KEYS: GroupKey[] = ["A", "B", "C", "D", "E", "F"];
const RIGHT_KEYS: GroupKey[] = ["G", "H", "I", "J", "K", "L"];

export default function BracketGroupSideColumn({
  side,
  onMouseEnter,
  onMouseLeave,
}: BracketGroupSideColumnProps) {
  const keys = side === "left" ? LEFT_KEYS : RIGHT_KEYS;
  const groups = BRACKET_GROUPS.filter((g) => keys.includes(g.groupKey));

  return (
    // 响应式：xl(≥1280) 显示，lg-md 隐藏
    <div className="hidden xl:flex flex-col gap-[24px] w-[118px] h-[996px]">
      {groups.map((group) => (
        <BracketGroupCard
          key={group.groupKey}
          variant="pc-side"
          group={group}
          onMouseEnter={(e) => onMouseEnter?.(e, group.groupKey)}
          onMouseLeave={onMouseLeave}
        />
      ))}
    </div>
  );
}
