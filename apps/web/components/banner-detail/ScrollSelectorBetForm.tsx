"use client";

import type { BannerItemDetail } from "@/types/home-banner";
import BetPillButton from "./BetPillButton";

interface Props {
  /** 当前选中的 item（与 ScrollSelector selectedIndex 联动） */
  item: BannerItemDetail;
  /** Goals 显示文案（如 "7" / "8+"） */
  goalsLabel: string;
  /** Bet 点击 — 父组件 add(selection) */
  onBet: (item: BannerItemDetail, e: React.MouseEvent) => void;
  /**
   * H5 模式（mobile=true）：ScrollSelectorPanel mobile 分支已包含完整 layout，
   * 本组件在 mobile 时直接透传渲染 PC 形态（panel 不会在 mobile 分支调用本组件，
   * 此 prop 保留仅供外部单独使用时的语义标记，组件行为不变）
   */
  mobile?: boolean;
}

const PILL_TEAL_BASE =
  "flex h-8 items-center justify-center rounded-lg px-4 text-[14px] font-bold leading-[19px]";

const PILL_TEAL_STYLE = {
  // @figma-hardcoded: rgba(40,244,210,0.1) goals/odds-display-bg — pending design token
  backgroundColor: "rgba(40,244,210,0.1)",
  color: "#28f4d2",
};

/**
 * ScrollSelectorBetForm：B2 滚动块下注区
 *
 * Figma 节点：[3638:12287](https://www.figma.com/design/6WH0v3q8t3rImMXpt7uGXs/oddfi-UI-UX?node-id=3638-12287)
 * 视觉：bg-tertiary rounded-12 padding-24 + Goals/Odds 显示 pill + Bet 按钮
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ScrollSelectorBetForm({ item, goalsLabel, onBet, mobile: _mobile }: Props) {
  return (
    <div
      className="flex w-full items-center justify-between rounded-[12px] bg-tertiary p-6"
      data-figma-node="3638:12287"
    >
      <div className="flex items-center gap-3">
        <span className="text-[14px] font-medium leading-[19px] text-white">Goals</span>
        <div className={PILL_TEAL_BASE} style={PILL_TEAL_STYLE}>
          {goalsLabel}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[14px] font-medium leading-[19px] text-white">Odds</span>
        <div className={PILL_TEAL_BASE} style={PILL_TEAL_STYLE}>
          {item.odds}x
        </div>
      </div>

      <BetPillButton onClick={(e) => onBet(item, e)} ariaLabel={`Bet on ${item.name}`} />
    </div>
  );
}
