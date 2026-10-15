// DD-095 BracketGroupCard — 复用组件（PC 侧栏 118×146 + H5 列表 343×124）
// Figma 节点：4474:167492（pc-side） / 4702:148636（h5-list）

import Image from "next/image";

import type { GroupCell } from "@/lib/bracket/types";

interface BracketGroupCardProps {
  variant: "pc-side" | "h5-list";
  group: GroupCell;
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: () => void;
}

export default function BracketGroupCard({
  variant,
  group,
  onMouseEnter,
  onMouseLeave,
}: BracketGroupCardProps) {
  if (variant === "pc-side") {
    return <PcSideCard group={group} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />;
  }
  return <H5ListCard group={group} />;
}

// ─── PC variant: 118×146 竖版 (Figma 4474:167493) ────────────────────────────
// 圆角 16 + bg-tertiary + 顶 3px inset brand 高亮（跟随圆角）
// 内容：flex-col gap-12，两行国旗各 36×36 + 行内 justify-center gap-12
// 底部：Orbitron SemiBold 16 "Group X" 标签，pt-10 pb-14 px-10

function PcSideCard({
  group,
  onMouseEnter,
  onMouseLeave,
}: {
  group: GroupCell;
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: () => void;
}) {
  const flagRows = [group.teams.slice(0, 2), group.teams.slice(2, 4)];

  return (
    <div
      data-group={group.groupKey}
      className="relative w-[118px] h-[146px] rounded-[16px] bg-tertiary cursor-pointer shadow-[inset_0_3px_0_0_var(--text-brand-default)]"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 国旗组：top:16 + flex-col gap-12，每行 flex justify-center gap-12 */}
      <div className="absolute top-[16px] left-0 w-[118px] flex flex-col gap-[12px]">
        {flagRows.map((row, idx) => (
          <div key={idx} className="flex items-center justify-center gap-[12px] w-full">
            {row.map((team) => (
              <Image
                key={team.id}
                src={`/images/flags/${team.iso2}.svg`}
                alt={team.name}
                width={36}
                height={36}
                sizes="36px"
                className="rounded-full object-cover"
              />
            ))}
          </div>
        ))}
      </div>

      {/* 底部 Orbitron SemiBold 16 Group label */}
      <div className="absolute bottom-0 left-0 w-[118px] flex items-center justify-center pt-[10px] pb-[14px] px-[10px]">
        <span
          className="text-[16px] font-semibold text-primary whitespace-nowrap"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >
          Group {group.groupKey}
        </span>
      </div>
    </div>
  );
}

// ─── H5 variant: 343×124 横版 (Figma 4702:148636) ────────────────────────────
// 容器 bg-secondary + rounded-12 + 左侧 3px brand 内阴影
// 顶部 "Group X" 标签：14px Bold 白色，pl-24 pr-10 pt-14 pb-8
// 内容：flex-col gap-16，每行 px-24 + justify-between，每队 w-120 + 国旗 20×20 + 14/Body Medium 队名

function H5ListCard({ group }: { group: GroupCell }) {
  const rows = [group.teams.slice(0, 2), group.teams.slice(2, 4)];

  return (
    <div
      data-group={group.groupKey}
      className="relative w-full max-w-[343px] h-[124px] rounded-[12px] bg-secondary shadow-[inset_3px_0px_0px_0px_var(--text-brand-default)]"
    >
      {/* 顶部 Group label — Figma 4702:148419 (pl-24 pr-10 pt-14 pb-8) */}
      <div className="flex items-center pl-[24px] pr-[10px] pt-[14px] pb-[8px]">
        <span className="text-[14px] font-bold leading-none text-primary whitespace-nowrap">
          Group {group.groupKey}
        </span>
      </div>

      {/* 4 队 2 行 × 2 列 — Figma 4702:148412 (flex-col gap-16，行内 justify-between px-24) */}
      <div className="flex flex-col gap-[16px]">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center justify-between px-[24px] w-full">
            {row.map((team) => (
              <div key={team.id} className="flex items-center gap-[8px] w-[120px] min-w-0">
                <Image
                  src={`/images/flags/${team.iso2}.svg`}
                  alt={team.name}
                  width={20}
                  height={20}
                  sizes="20px"
                  className="shrink-0 rounded-full object-cover"
                />
                <span className="text-[14px] font-medium text-primary leading-[18px] truncate">
                  {team.name}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
