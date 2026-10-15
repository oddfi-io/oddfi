// DD-095 BracketSwitcher — H5 分段切换器（Group ↔ Bracket）
// 复用 components/ui/SegmentedTabs，与流动性池 tab 视觉一致

"use client";

import SegmentedTabs from "@/components/ui/SegmentedTabs";

interface BracketSwitcherProps {
  mode: "group" | "bracket";
  onChange: (mode: "group" | "bracket") => void;
}

const TABS = [
  { key: "group" as const, label: "Group" },
  { key: "bracket" as const, label: "Bracket" },
];

export default function BracketSwitcher({ mode, onChange }: BracketSwitcherProps) {
  return (
    <div className="w-full max-w-[343px]">
      <SegmentedTabs
        tabs={TABS}
        value={mode}
        onChange={onChange}
        ariaLabel="Group / Bracket 视图切换"
      />
    </div>
  );
}
