"use client";

// DD-095 BracketGroupHoverCard — hover 弹层（Figma 5024:60798 · 280×219 自适应）
// Portal 到 document.body 避免父级 overflow-clip 裁切
// 定位算法：trigger.right + 12px；溢出右边时翻转到左侧
// SSR 安全：useEffect 后才 mount portal

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import Image from "next/image";

import type { GroupCell, GroupKey } from "@/lib/bracket/types";
import { BRACKET_GROUPS } from "@/lib/bracket/mock-data";

interface BracketGroupHoverCardProps {
  groupKey: GroupKey | null;
  triggerRect: DOMRect | null;
  visible: boolean;
}

const CARD = { w: 280, h: 220 };
const GAP = 12;

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function calcPosition(triggerRect: DOMRect): { top: number; left: number } {
  const wantLeft = triggerRect.right + GAP;
  const overflowRight = wantLeft + CARD.w > window.innerWidth;
  return {
    top: clamp(triggerRect.top, 16, window.innerHeight - CARD.h - 16),
    left: overflowRight ? triggerRect.left - GAP - CARD.w : wantLeft,
  };
}

export default function BracketGroupHoverCard({
  groupKey,
  triggerRect,
  visible,
}: BracketGroupHoverCardProps) {
  const [mounted, setMounted] = useState(false);

  // SSR 安全：仅在客户端挂载 portal
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !visible || !groupKey || !triggerRect) return null;

  const group: GroupCell | undefined = BRACKET_GROUPS.find((g) => g.groupKey === groupKey);
  if (!group) return null;

  const { top, left } = calcPosition(triggerRect);

  const card = (
    <div
      role="tooltip"
      data-bracket-hover-card
      className="fixed z-50 w-[280px] rounded-[8px] border border-divider bg-fill-modal pointer-events-none p-[16px] flex flex-col gap-[16px]"
      style={{ top, left }}
    >
      {/* 标题区：Group 名 + M1 日期（Figma 5024:60800 · gap-8 vertical） */}
      <div className="flex flex-col gap-[8px]">
        <span className="text-[14px] font-bold leading-none text-primary">
          Group {group.groupKey}
        </span>
        <span className="text-[12px] font-medium leading-[1.8] text-secondary">
          M1, Jun 14·16:00 UTC
        </span>
      </div>

      {/* 4 队列表（Figma 5024:60805 · 单列 flex-col gap-12） */}
      <div className="flex flex-col gap-[12px]">
        {group.teams.slice(0, 4).map((team) => (
          <div key={team.id} className="flex items-center gap-[8px] min-w-0">
            {/* 国旗 20×20 */}
            <Image
              src={`/images/flags/${team.iso2}.svg`}
              alt={team.name}
              width={20}
              height={20}
              sizes="20px"
              className="shrink-0 rounded-full object-cover"
            />
            <span className="text-[12px] font-bold leading-[1.8] text-primary truncate">
              {team.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(card, document.body);
}
