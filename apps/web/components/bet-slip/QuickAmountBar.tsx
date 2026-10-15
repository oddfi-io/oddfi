"use client";

import { memo } from "react";
import { useCurrencyDisplay } from "@/hooks/useCurrencyDisplay";

// 合约最低下注 100 ODD（lib/betting/constants.ts MIN_BET_ODD），USD 模式按 0.1 USD/ODD 换算 → 最低 10 USD。
// quick amount 起点从合约 floor 开始，避免一键选低于最低值触发链上 revert。
const QUICK_AMOUNTS_ODD = [
  { value: "100", display: "100" },
  { value: "200", display: "200" },
  { value: "500", display: "500" },
  { value: "1000", display: "1,000" },
] as const;

const QUICK_AMOUNTS_USD = [
  { value: "10", display: "10" },
  { value: "20", display: "20" },
  { value: "50", display: "50" },
  { value: "100", display: "100" },
] as const;

interface QuickAmountBarProps {
  currentAmount: string;
  onSelect: (amount: string) => void;
  mobile?: boolean;
}

function QuickAmountBar({ currentAmount, onSelect, mobile }: QuickAmountBarProps) {
  const { canConvert } = useCurrencyDisplay();
  const QUICK_AMOUNTS = canConvert ? QUICK_AMOUNTS_USD : QUICK_AMOUNTS_ODD;
  return (
    <div className="flex gap-[8px]">
      {QUICK_AMOUNTS.map((amt) => {
        const isActive = currentAmount === amt.value;
        return (
          <button
            key={amt.value}
            className={
              mobile
                ? `flex-1 h-[28px] rounded-8 text-[12px] font-semibold text-primary text-center transition-colors
                ${isActive ? "bg-tag-brand border border-dt-hover" : "bg-tertiary"}`
                : `flex-1 h-[28px] rounded-8 text-[12px] font-bold text-primary text-center transition-colors
                ${isActive ? "bg-tag-brand text-brand-default" : "bg-secondary"}`
            }
            onClick={() => onSelect(amt.value)}
          >
            {amt.display}
          </button>
        );
      })}
    </div>
  );
}

export default memo(QuickAmountBar);
